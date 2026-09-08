import { NextRequest, NextResponse } from 'next/server';
import { env } from '../../../../lib/env';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { exchangeAdminCode, getDiscordUser } from '../../../../lib/discord';
import { createAdminSession, sessionCookieOptions, SESSION_COOKIE, SESSION_TTL_SECONDS } from '../../../../lib/session';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const allowed = await checkRateLimit(`admin_callback:${ip}`, 15, 60);
  if (!allowed) {
    return NextResponse.redirect(`${env.panelBaseUrl()}/desc/login?error=rate_limited`);
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  if (!code || !state) {
    return NextResponse.redirect(`${env.panelBaseUrl()}/desc/login?error=invalid_request`);
  }

  const db = supabaseAdmin();
  const { data: stateRow } = await db
    .from('oauth_states')
    .select('state, expires_at, used, purpose')
    .eq('state', state)
    .maybeSingle();

  if (
    !stateRow ||
    stateRow.used ||
    stateRow.purpose !== 'admin' ||
    new Date(stateRow.expires_at as string).getTime() < Date.now()
  ) {
    return NextResponse.redirect(`${env.panelBaseUrl()}/desc/login?error=expired`);
  }
  await db.from('oauth_states').update({ used: true }).eq('state', state);

  let tokenResponse;
  let discordUser;
  try {
    tokenResponse = await exchangeAdminCode(code);
    discordUser = await getDiscordUser(tokenResponse.access_token);
  } catch {
    return NextResponse.redirect(`${env.panelBaseUrl()}/desc/login?error=discord_error`);
  }

  const { data: allowed_entry } = await db
    .from('admin_allowlist')
    .select('discord_id')
    .eq('discord_id', discordUser.id)
    .maybeSingle();

  if (!allowed_entry) {
    // Celowo nie tworzymy sesji i nie logujemy niczego, co identyfikuje próbę - 403 wprost.
    return new NextResponse('403 Forbidden', { status: 403 });
  }

  const userAgent = req.headers.get('user-agent') ?? '';
  const rawToken = await createAdminSession(discordUser.id, ip, userAgent);

  const res = NextResponse.redirect(`${env.panelBaseUrl()}/desc`);
  res.cookies.set(SESSION_COOKIE, rawToken, sessionCookieOptions(SESSION_TTL_SECONDS));
  return res;
}
