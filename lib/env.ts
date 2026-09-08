function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Brakuje zmiennej środowiskowej: ${name}`);
  }
  return v;
}

export const env = {
  discordClientId: () => required('DISCORD_CLIENT_ID'),
  discordClientSecret: () => required('DISCORD_CLIENT_SECRET'),
  discordBotToken: () => required('DISCORD_BOT_TOKEN'),
  sourceGuildId: () => required('DISCORD_GUILD_ID'),
  verifiedRoleId: () => required('DISCORD_VERIFIED_ROLE_ID'),
  authBaseUrl: () => required('AUTH_BASE_URL'), // np. https://auth.realizatorzy.lol
  panelBaseUrl: () => required('PANEL_BASE_URL'), // np. https://cc.realizatorzy.lol
  cookieDomain: () => required('COOKIE_DOMAIN'), // np. .realizatorzy.lol
  turnstileSecretKey: () => required('TURNSTILE_SECRET_KEY'),
  encryptionKey: () => required('TOKEN_ENCRYPTION_KEY'), // 64 znaki hex = 32 bajty
  supabaseUrl: () => required('SUPABASE_URL'),
  supabaseServiceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
  internalCronSecret: () => required('INTERNAL_CRON_SECRET'),
  verifyStaticState: () => required('VERIFY_STATIC_STATE'), // stały string wpisany też w link przycisku na Discordzie
};
