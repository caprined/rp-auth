import { env } from './env';

const DISCORD_API = 'https://discord.com/api/v10';

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.discordClientId(),
    redirect_uri: `${env.authBaseUrl()}/api/auth/callback`,
    response_type: 'code',
    scope: 'identify guilds.join',
    state,
    prompt: 'consent',
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

// Stały link uzywany na przycisku "Zweryfikuj sie" na Discordzie i jako link "ponow" w UI.
export function buildAuthorizeUrlStatic(): string {
  return buildAuthorizeUrl(env.verifyStaticState());
}

export interface DiscordTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export async function exchangeCodeForToken(code: string): Promise<DiscordTokenResponse> {
  const body = new URLSearchParams({
    client_id: env.discordClientId(),
    client_secret: env.discordClientSecret(),
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${env.authBaseUrl()}/api/auth/callback`,
  });

  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error(`Discord token exchange nieudany: ${res.status}`);
  }
  return res.json();
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
}

export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Pobranie danych usera nieudane: ${res.status}`);
  }
  return res.json();
}

// Nadanie roli na serwerze źródłowym po weryfikacji - wywołanie tokenem BOTA.
export async function grantVerifiedRole(discordUserId: string): Promise<void> {
  const res = await fetch(
    `${DISCORD_API}/guilds/${env.sourceGuildId()}/members/${discordUserId}/roles/${env.verifiedRoleId()}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bot ${env.discordBotToken()}` },
    }
  );
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => '');
    throw new Error(`Nadanie roli nieudane: ${res.status} ${text}`);
  }
}

// Dodanie usera na NOWY serwer (guilds.join) - wymaga access_token usera + tokenu bota.
// Zwraca 'joined' | 'already_member' | 'rate_limited' | 'failed'.
export async function joinGuildWithUser(
  targetGuildId: string,
  discordUserId: string,
  userAccessToken: string
): Promise<'joined' | 'already_member' | 'rate_limited' | 'failed'> {
  const res = await fetch(`${DISCORD_API}/guilds/${targetGuildId}/members/${discordUserId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${env.discordBotToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ access_token: userAccessToken }),
  });

  if (res.status === 201 || res.status === 204) return 'joined'; // 201 = dodany, 204 = już był
  if (res.status === 429) return 'rate_limited';
  return 'failed';
}

export async function refreshUserToken(refreshToken: string): Promise<DiscordTokenResponse> {
  const body = new URLSearchParams({
    client_id: env.discordClientId(),
    client_secret: env.discordClientSecret(),
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Odświeżenie tokenu nieudane: ${res.status}`);
  }
  return res.json();
}

export async function verifyTurnstile(token: string, remoteIp: string): Promise<boolean> {
  const body = new URLSearchParams({
    secret: env.turnstileSecretKey(),
    response: token,
    remoteip: remoteIp,
  });
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.success === true;
}

// Admin OAuth (do panelu) - inny scope, inny redirect_uri, brak guilds.join potrzebnego.
export function buildAdminAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.discordClientId(),
    redirect_uri: `${env.panelBaseUrl()}/api/admin/callback`,
    response_type: 'code',
    scope: 'identify',
    state,
    prompt: 'consent',
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export async function exchangeAdminCode(code: string): Promise<DiscordTokenResponse> {
  const body = new URLSearchParams({
    client_id: env.discordClientId(),
    client_secret: env.discordClientSecret(),
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${env.panelBaseUrl()}/api/admin/callback`,
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Admin token exchange nieudany: ${res.status}`);
  }
  return res.json();
}
