import { NextRequest, NextResponse } from 'next/server';
import { env } from '../../../../lib/env';
import { randomToken } from '../../../../lib/crypto';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { buildAuthorizeUrl } from '../../../../lib/discord';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-bot-secret');
  if (secret !== env.botInternalSecret()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(req.headers);
  const allowed = await checkRateLimit(`auth_start:${ip}`, 30, 60);
  if (!allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const state = randomToken(24);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin().from('oauth_states').insert({
    state,
    expires_at: expiresAt,
    purpose: 'verify',
  });
  if (error) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({ url: buildAuthorizeUrl(state) });
}
