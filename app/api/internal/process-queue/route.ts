import { NextRequest, NextResponse } from 'next/server';
import { env } from '../../../../lib/env';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { decryptSecret, encryptSecret } from '../../../../lib/crypto';
import { joinGuildWithUser, refreshUserToken } from '../../../../lib/discord';

// Prawdziwy limit Discorda na dolaczanie userow jest dużo wyzszy niz wczesniejsze 5/min -
// to byla nadmiernie ostrozna wartosc. Idziemy odwazniej, z automatycznym backoffem na 429.
const BATCH_SIZE = 20;
const STUCK_PROCESSING_MINUTES = 2;

interface QueueItemRow {
  id: string;
  discord_id: string;
  attempts: number;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== env.internalCronSecret()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = supabaseAdmin();

  const { data: job } = await db
    .from('join_queue_jobs')
    .select('id, target_guild_id, total_count')
    .eq('status', 'running')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ ok: true, message: 'no_running_job' });
  }

  const jobId = job.id as string;
  const targetGuildId = job.target_guild_id as string;

  // Samoleczenie: itemy ktore utknely w "processing" (np. request padl w trakcie, proces
  // zostal przerwany) wracaja do "pending", zeby nie zniknely na zawsze z kolejki.
  const stuckSince = new Date(Date.now() - STUCK_PROCESSING_MINUTES * 60 * 1000).toISOString();
  await db
    .from('join_queue_items')
    .update({ status: 'pending' })
    .eq('job_id', jobId)
    .eq('status', 'processing')
    .lt('updated_at', stuckSince);

  const { data: rawItems } = await db
    .from('join_queue_items')
    .select('id, discord_id, attempts')
    .eq('job_id', jobId)
    .in('status', ['pending', 'rate_limited'])
    .order('updated_at', { ascending: true })
    .limit(BATCH_SIZE);

  const items = (rawItems ?? []) as unknown as QueueItemRow[];

  if (items.length === 0) {
    const { count: stillPending } = await db
      .from('join_queue_items')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .in('status', ['pending', 'processing', 'rate_limited']);

    if (!stillPending) {
      await db
        .from('join_queue_jobs')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', jobId);
      return NextResponse.json({ ok: true, message: 'job_completed' });
    }
    return NextResponse.json({ ok: true, message: 'nothing_ready_yet' });
  }

  for (const item of items) {
    const itemId = item.id;
    const discordId = item.discord_id;

    try {
      await db.from('join_queue_items').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', itemId);

      const { data: userRow } = await db
        .from('verified_users')
        .select('access_token_enc, refresh_token_enc, token_expires_at')
        .eq('discord_id', discordId)
        .maybeSingle();

      if (!userRow) {
        await db
          .from('join_queue_items')
          .update({ status: 'failed', last_error: 'user_not_found', updated_at: new Date().toISOString() })
          .eq('id', itemId);
        continue;
      }

      const accessTokenEnc = userRow.access_token_enc as string;
      const refreshTokenEnc = userRow.refresh_token_enc as string;
      const tokenExpiresAt = userRow.token_expires_at as string;

      let accessToken = decryptSecret(accessTokenEnc);

      if (new Date(tokenExpiresAt).getTime() < Date.now() + 60_000) {
        const refreshed = await refreshUserToken(decryptSecret(refreshTokenEnc));
        accessToken = refreshed.access_token;
        await db
          .from('verified_users')
          .update({
            access_token_enc: encryptSecret(refreshed.access_token),
            refresh_token_enc: encryptSecret(refreshed.refresh_token),
            token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            last_token_refresh_at: new Date().toISOString(),
          })
          .eq('discord_id', discordId);
      }

      const result = await joinGuildWithUser(targetGuildId, discordId, accessToken);

      if (result === 'joined') {
        await db.from('join_queue_items').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', itemId);
      } else if (result === 'rate_limited') {
        await db
          .from('join_queue_items')
          .update({ status: 'rate_limited', attempts: item.attempts + 1, updated_at: new Date().toISOString() })
          .eq('id', itemId);
      } else {
        const nextAttempts = item.attempts + 1;
        await db
          .from('join_queue_items')
          .update({
            status: nextAttempts >= 5 ? 'failed' : 'pending',
            attempts: nextAttempts,
            last_error: 'join_failed_status_not_ok',
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId);
      }
    } catch (err) {
      // KLUCZOWE: jeden zepsuty item (np. chwilowy blad sieci) NIE MOZE ubic calego batcha -
      // wczesniej dokladnie to sie dzialo i zaniedzialo dalsze zliczanie/przetwarzanie.
      const nextAttempts = item.attempts + 1;
      const message = err instanceof Error ? err.message : 'unknown_error';
      await db
        .from('join_queue_items')
        .update({
          status: nextAttempts >= 5 ? 'failed' : 'pending',
          attempts: nextAttempts,
          last_error: message.slice(0, 200),
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);
    }
  }

  return NextResponse.json({ ok: true, processed: items.length });
}
