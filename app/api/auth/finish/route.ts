import { NextRequest, NextResponse } from 'next/server';
import { PV_COOKIE } from '../../../../lib/constants';
import { decryptSecret, encryptSecret } from '../../../../lib/crypto';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';
import {
  exchangeCodeForToken,
  getDiscordUser,
  grantVerifiedRole,
  verifyTurnstile,
} from '../../../../lib/discord';
import { env } from '../../../../lib/env';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  const allowed = await checkRateLimit(`auth_finish:${ip}`, 15, 60);
  if (!allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const pvId = req.cookies.get(PV_COOKIE)?.value;
  if (!pvId) {
    return NextResponse.json({ error: 'no_pending_verification' }, { status: 400 });
  }

  let body: { turnstileToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!body.turnstileToken || typeof body.turnstileToken !== 'string') {
    return NextResponse.json({ error: 'missing_turnstile_token' }, { status: 400 });
  }

  const turnstileOk = await verifyTurnstile(body.turnstileToken, ip);
  if (!turnstileOk) {
    return NextResponse.json({ error: 'turnstile_failed' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: pending, error: pendingError } = await db
    .from('pending_verifications')
    .select('pv_id, code_enc, expires_at, used')
    .eq('pv_id', pvId)
    .maybeSingle();

  if (
    pendingError ||
    !pending ||
    pending.used ||
    new Date(pending.expires_at as string).getTime() < Date.now()
  ) {
    return NextResponse.json({ error: 'expired_or_invalid' }, { status: 400 });
  }

  // Jednorazowość natychmiast, zanim cokolwiek zawoła Discorda.
  await db.from('pending_verifications').update({ used: true }).eq('pv_id', pvId);

  const code = decryptSecret(pending.code_enc as string);

  let tokenResponse;
  try {
    tokenResponse = await exchangeCodeForToken(code);
  } catch {
    return NextResponse.json({ error: 'discord_exchange_failed' }, { status: 502 });
  }

  let discordUser;
  try {
    discordUser = await getDiscordUser(tokenResponse.access_token);
  } catch {
    return NextResponse.json({ error: 'discord_user_fetch_failed' }, { status: 502 });
  }

  const tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();

  const { error: upsertError } = await db.from('verified_users').upsert(
    {
      discord_id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      global_name: discordUser.global_name,
      avatar_hash: discordUser.avatar,
      access_token_enc: encryptSecret(tokenResponse.access_token),
      refresh_token_enc: encryptSecret(tokenResponse.refresh_token),
      token_expires_at: tokenExpiresAt,
      source_guild_id: env.sourceGuildId(),
      last_token_refresh_at: new Date().toISOString(),
      ip_hash: null,
    },
    { onConflict: 'discord_id' }
  );

  if (upsertError) {
    return NextResponse.json({ error: 'db_write_failed' }, { status: 500 });
  }

  try {
    await grantVerifiedRole(discordUser.id);
  } catch {
    // User jest już zapisany w bazie (najważniejsze dla celu "backupu") - błąd roli zgłaszamy,
    // ale nie cofamy zapisu. Panel admina i tak pokaże usera jako zweryfikowanego.
    const res = NextResponse.json({
      ok: true,
      username: discordUser.global_name ?? discordUser.username,
      roleGranted: false,
    });
    res.cookies.delete(PV_COOKIE);
    return res;
  }

  const res = NextResponse.json({
    ok: true,
    username: discordUser.global_name ?? discordUser.username,
    roleGranted: true,
  });
  res.cookies.delete(PV_COOKIE);
  return res;
}
