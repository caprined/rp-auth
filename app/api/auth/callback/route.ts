import { NextRequest, NextResponse } from 'next/server';
import { env } from '../../../../lib/env';
import { randomToken, encryptSecret } from '../../../../lib/crypto';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';
import { PV_COOKIE } from '../../../../lib/constants';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const allowed = await checkRateLimit(`auth_callback:${ip}`, 20, 60);
  if (!allowed) {
    return NextResponse.redirect(`${env.authBaseUrl()}/?error=rate_limited`);
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const errorParam = req.nextUrl.searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(`${env.authBaseUrl()}/?error=discord_denied`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${env.authBaseUrl()}/?error=invalid_request`);
  }

  const db = supabaseAdmin();
  const { data: stateRow, error: stateError } = await db
    .from('oauth_states')
    .select('state, expires_at, used, purpose')
    .eq('state', state)
    .maybeSingle();

  if (
    stateError ||
    !stateRow ||
    stateRow.used ||
    stateRow.purpose !== 'verify' ||
    new Date(stateRow.expires_at as string).getTime() < Date.now()
  ) {
    return NextResponse.redirect(`${env.authBaseUrl()}/?error=expired_or_invalid`);
  }

  // Jednorazowość: state jest oznaczany jako zużyty natychmiast, niezależnie od dalszego wyniku.
  await db.from('oauth_states').update({ used: true }).eq('state', state);

  const pvId = randomToken(24);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error: pvError } = await db.from('pending_verifications').insert({
    pv_id: pvId,
    code_enc: encryptSecret(code),
    expires_at: expiresAt,
  });
  if (pvError) {
    return NextResponse.redirect(`${env.authBaseUrl()}/?error=internal_error`);
  }

  const res = NextResponse.redirect(`${env.authBaseUrl()}/`);
  res.cookies.set(PV_COOKIE, pvId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60,
  });
  return res;
}
