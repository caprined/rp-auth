import { NextResponse } from 'next/server';
import { revokeCurrentSession, SESSION_COOKIE } from '../../../../lib/session';
import { env } from '../../../../lib/env';

export async function POST() {
  await revokeCurrentSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', {
    domain: env.cookieDomain(),
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
