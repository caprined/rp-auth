import { NextRequest, NextResponse } from 'next/server';
import { randomToken } from '../../../../lib/crypto';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { buildAdminAuthorizeUrl } from '../../../../lib/discord';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const allowed = await checkRateLimit(`admin_login:${ip}`, 10, 60);
  if (!allowed) {
    return new NextResponse('Zbyt wiele prób. Spróbuj później.', { status: 429 });
  }

  const state = randomToken(24);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await supabaseAdmin().from('oauth_states').insert({ state, expires_at: expiresAt, purpose: 'admin' });

  return NextResponse.redirect(buildAdminAuthorizeUrl(state));
}
