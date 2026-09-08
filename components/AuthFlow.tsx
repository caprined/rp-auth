'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, CircleCheck, CircleAlert, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void; 'error-callback'?: () => void }
      ) => string;
    };
  }
}

type Status = 'no_pending' | 'ready' | 'verifying' | 'success' | 'error';

export default function AuthFlow({
  hasPendingVerification,
  initialError,
  turnstileSiteKey,
}: {
  hasPendingVerification: boolean;
  initialError: string | null;
  turnstileSiteKey: string;
}) {
  const [status, setStatus] = useState<Status>(hasPendingVerification ? 'ready' : 'no_pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [successName, setSuccessName] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    if (status !== 'ready' || !turnstileSiteKey || renderedRef.current) return;

    function tryRender() {
      if (window.turnstile && widgetRef.current) {
        renderedRef.current = true;
        window.turnstile.render(widgetRef.current, {
          sitekey: turnstileSiteKey,
          callback: async (token: string) => {
            setStatus('verifying');
            try {
              const res = await fetch('/api/auth/finish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ turnstileToken: token }),
              });
              const data = await res.json();
              if (res.ok && data.ok) {
                setSuccessName(data.username ?? null);
                setStatus('success');
              } else {
                setErrorMessage('Nie udało się dokończyć weryfikacji. Wygeneruj nowy link na Discordzie.');
                setStatus('error');
              }
            } catch {
              setErrorMessage('Błąd sieci. Spróbuj ponownie.');
              setStatus('error');
            }
          },
          'error-callback': () => {
            setErrorMessage('Weryfikacja bezpieczeństwa nie powiodła się.');
            setStatus('error');
          },
        });
      }
    }

    if (window.turnstile) {
      tryRender();
    } else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.onload = tryRender;
      document.body.appendChild(script);
    }
  }, [status, turnstileSiteKey]);

  return (
    <div className="w-full max-w-[400px] rounded-2xl border border-border1 bg-surface1 p-8 text-center">
      {status === 'no_pending' && (
        <>
          <CircleAlert className="mx-auto mb-4 h-10 w-10 text-danger" />
          <h1 className="text-lg font-medium">Brak aktywnej weryfikacji</h1>
          <p className="mt-2 text-sm text-textSecondary">
            {errorMessage ?? 'Wygeneruj nowy link weryfikacyjny na Discordzie.'}
          </p>
        </>
      )}

      {status === 'ready' && (
        <>
          <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-textSecondary" />
          <h1 className="text-lg font-medium">Weryfikacja bezpieczeństwa</h1>
          <p className="mt-2 mb-6 text-sm text-textSecondary">Potwierdź, że nie jesteś botem.</p>
          <div ref={widgetRef} className="flex justify-center" />
        </>
      )}

      {status === 'verifying' && (
        <>
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-textSecondary" />
          <h1 className="text-lg font-medium">Trwa weryfikacja…</h1>
        </>
      )}

      {status === 'success' && (
        <>
          <CircleCheck className="mx-auto mb-4 h-12 w-12 text-success" />
          <h1 className="text-lg font-medium">Zweryfikowano pomyślnie</h1>
          {successName && (
            <p className="mt-2 text-sm text-textSecondary">Witaj, {successName}. Możesz wrócić na Discorda.</p>
          )}
        </>
      )}

      {status === 'error' && (
        <>
          <CircleAlert className="mx-auto mb-4 h-10 w-10 text-danger" />
          <h1 className="text-lg font-medium">Coś poszło nie tak</h1>
          <p className="mt-2 text-sm text-textSecondary">{errorMessage}</p>
        </>
      )}
    </div>
  );
}
