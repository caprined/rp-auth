import { cookies } from 'next/headers';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import AuthFlow from '../components/AuthFlow';
import TopBar from '../components/TopBar';
import { PV_COOKIE } from '../lib/constants';
import { buildAuthorizeUrlStatic } from '../lib/discord';

const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: 'Zbyt wiele prób. Spróbuj ponownie za chwilę.',
  discord_denied: 'Autoryzacja została odrzucona.',
  invalid_request: 'Nieprawidłowe żądanie.',
  expired_or_invalid: 'Link wygasł lub jest nieprawidłowy. Wygeneruj nowy na Discordzie.',
  internal_error: 'Wystąpił błąd. Spróbuj ponownie.',
};

export default async function Page({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const store = cookies();
  const pvId = store.get(PV_COOKIE)?.value;

  let hasPendingVerification = false;
  if (pvId) {
    const { data } = await supabaseAdmin()
      .from('pending_verifications')
      .select('used, expires_at')
      .eq('pv_id', pvId)
      .maybeSingle();
    if (data && !data.used && new Date(data.expires_at as string).getTime() > Date.now()) {
      hasPendingVerification = true;
    }
  }

  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] ?? ERROR_MESSAGES.internal_error : null;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const discordAuthorizeUrl = buildAuthorizeUrlStatic();

  return (
    <main className="flex h-screen items-center justify-center px-4">
      <TopBar />
      <AuthFlow
        hasPendingVerification={hasPendingVerification}
        initialError={errorMessage}
        turnstileSiteKey={siteKey}
        discordAuthorizeUrl={discordAuthorizeUrl}
      />
    </main>
  );
}
