import { ShieldCheck } from 'lucide-react';

const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: 'Zbyt wiele prób. Spróbuj później.',
  invalid_request: 'Nieprawidłowe żądanie.',
  expired: 'Link wygasł. Spróbuj ponownie.',
  discord_error: 'Błąd komunikacji z Discordem.',
};

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[380px] rounded-2xl border border-border1 bg-surface1 p-8 text-center">
        <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-textSecondary" />
        <h1 className="text-lg font-medium">Panel realizatorzy.lol</h1>
        <p className="mt-2 mb-6 text-sm text-textSecondary">Dostęp tylko dla administracji.</p>
        {errorMessage && <p className="mb-4 text-sm text-danger">{errorMessage}</p>}
        <a
          href="/api/admin/login"
          className="accent-gradient inline-block w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white"
        >
          Zaloguj przez Discord
        </a>
      </div>
    </main>
  );
}
