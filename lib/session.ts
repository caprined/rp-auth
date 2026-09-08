import { cookies } from 'next/headers';
import { env } from './env';
import { randomToken, sha256Hex, hashIp } from './crypto';
import { supabaseAdmin } from './supabaseAdmin';

export const SESSION_COOKIE = 'rz_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h, potem trzeba się zalogować ponownie

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    domain: env.cookieDomain(), // np. ".realizatorzy.lol" -> działa na auth. i cc.
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export async function createAdminSession(
  discordId: string,
  ip: string,
  userAgent: string
): Promise<string> {
  const rawToken = randomToken(32);
  const hashed = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  const { error } = await supabaseAdmin().from('admin_sessions').insert({
    session_id: hashed,
    discord_id: discordId,
    expires_at: expiresAt,
    ip_hash: hashIp(ip),
    user_agent: userAgent.slice(0, 255),
  });
  if (error) throw new Error('Nie udało się utworzyć sesji');

  return rawToken;
}

export interface AdminSession {
  discordId: string;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const hashed = sha256Hex(raw);
  const { data, error } = await supabaseAdmin()
    .from('admin_sessions')
    .select('discord_id, expires_at, revoked')
    .eq('session_id', hashed)
    .maybeSingle();

  if (error || !data) return null;
  if (data.revoked) return null;
  if (new Date(data.expires_at as string).getTime() < Date.now()) return null;

  const { data: allowed } = await supabaseAdmin()
    .from('admin_allowlist')
    .select('discord_id')
    .eq('discord_id', data.discord_id as string)
    .maybeSingle();
  if (!allowed) return null;

  return { discordId: data.discord_id as string };
}

export async function revokeCurrentSession(): Promise<void> {
  const store = cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return;
  const hashed = sha256Hex(raw);
  await supabaseAdmin().from('admin_sessions').update({ revoked: true }).eq('session_id', hashed);
}

export { SESSION_TTL_SECONDS };
