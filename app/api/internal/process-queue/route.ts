import { NextRequest, NextResponse } from 'next/server';
import { env } from '../../../../lib/env';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { decryptSecret, encryptSecret } from '../../../../lib/crypto';
import { joinGuildWithUser, refreshUserToken } from '../../../../lib/discord';

const BATCH_SIZE = 5; // ostrożnie wobec limitów Discorda - lepiej wolniej niż dostać rate-ban

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

  const { data: rawItems } = await db
    .from('join_queue_items')
    .select('id, discord_id, attempts')
    .eq('job_id', jobId)
    .in('status', ['pending', 'rate_limited'])
    .order('updated_at', { ascending: true })
    .limit(BATCH_SIZE);

  const items = (rawItems ?? []) as unknown as QueueItemRow[];

  if (items.length === 0) {
    // Nic nie zostało do zrobienia - zamykamy joba.
    await db.from('join_queue_jobs').update({ status: 'done' }).eq('id', jobId);
    return NextResponse.json({ ok: true, message: 'job_completed' });
  }

  let done = 0;
  let failed = 0;

  for (const item of items) {
    const itemId = item.id;
    const discordId = item.discord_id;

    await db.from('join_queue_items').update({ status: 'processing' }).eq('id', itemId);

    const { data: userRow } = await db
      .from('verified_users')
      .select('access_token_enc, refresh_token_enc, token_expires_at')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (!userRow) {
      await db
        .from('join_queue_items')
        .update({ status: 'failed', last_error: 'user_not_found' })
        .eq('id', itemId);
      failed += 1;
      continue;
    }

    const accessTokenEnc = userRow.access_token_enc as string;
    const refreshTokenEnc = userRow.refresh_token_enc as string;
    const tokenExpiresAt = userRow.token_expires_at as string;

    let accessToken = decryptSecret(accessTokenEnc);

    if (new Date(tokenExpiresAt).getTime() < Date.now() + 60_000) {
      try {
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
      } catch {
        await db
          .from('join_queue_items')
          .update({
            status: 'failed',
            last_error: 'token_refresh_failed',
            attempts: item.attempts + 1,
          })
          .eq('id', itemId);
        failed += 1;
        continue;
      }
    }

    const result = await joinGuildWithUser(targetGuildId, discordId, accessToken);

    if (result === 'joined') {
      await db.from('join_queue_items').update({ status: 'done' }).eq('id', itemId);
      done += 1;
    } else if (result === 'rate_limited') {
      await db
        .from('join_queue_items')
        .update({ status: 'rate_limited', attempts: item.attempts + 1 })
        .eq('id', itemId);
    } else {
      const nextAttempts = item.attempts + 1;
      await db
        .from('join_queue_items')
        .update({
          status: nextAttempts >= 5 ? 'failed' : 'pending',
          attempts: nextAttempts,
          last_error: 'join_failed',
        })
        .eq('id', itemId);
      if (nextAttempts >= 5) failed += 1;
    }
  }

  await db.rpc('increment_job_counters', { p_job_id: jobId, p_done: done, p_failed: failed });

  return NextResponse.json({ ok: true, processed: items.length, done, failed });
}
