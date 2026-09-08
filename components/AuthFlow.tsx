'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, CircleCheck, CircleAlert, Info, RotateCcw } from 'lucide-react';

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

type Status = 'no_pending' | 'idle' | 'loading' | 'turnstile' | 'success' | 'error';

const MIN_LOADING_MS = 1500;

export default function AuthFlow({
  hasPendingVerification,
  initialError,
  turnstileSiteKey,
  discordAuthorizeUrl,
}: {
  hasPendingVerification: boolean;
  initialError: string | null;
  turnstileSiteKey: string;
  discordAuthorizeUrl: string;
}) {
  const [status, setStatus] = useState<Status>(hasPendingVerification ? 'idle' : 'no_pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [successName, setSuccessName] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  function handleVerifyClick() {
    setStatus('loading');
    const loadingStarted = Date.now();

    function goToTurnstile() {
      const elapsed = Date.now() - loadingStarted;
      const wait = Math.max(0, MIN_LOADING_MS - elapsed);
      setTimeout(() => setStatus('turnstile'), wait);
    }
    goToTurnstile();
  }

  useEffect(() => {
    if (status !== 'turnstile' || !turnstileSiteKey || renderedRef.current) return;

    function tryRender() {
      if (window.turnstile && widgetRef.current) {
        renderedRef.current = true;
        window.turnstile.render(widgetRef.current, {
          sitekey: turnstileSiteKey,
          callback: async (token: string) => {
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

  // "Ponow" zawsze wraca przez Discorda - poprzedni kod jednorazowy jest juz zuzyty,
  // wiec nie ma sensu resetowac lokalnego stanu bez nowej autoryzacji.


  return (
    <div className="relative w-full max-w-[400px] rounded-3xl border border-border1 bg-surface1 px-8 pb-8 pt-12 text-center">
      {/* Info button - top corner */}
      <div className="group absolute right-4 top-4">
        <button
          type="button"
          aria-label="Informacje o weryfikacji"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border1 text-textMuted hover:border-borderStrong hover:text-textSecondary"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
        <div className="pointer-events-none absolute right-0 top-9 w-64 rounded-xl border border-border1 bg-surface2 p-3 text-left text-xs leading-relaxed text-textSecondary opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          Ta weryfikacja dotyczy wyłącznie Sтяєƒα Rєαℓιzαтσяσω i nie doda Cię do żadnego innego, obcego serwera.
          Nie zbieramy adresów e-mail, a pozyskane dane nie są nigdzie sprzedawane ani wykorzystywane poza tym
          projektem — posłużą wyłącznie do przywrócenia dostępu, gdyby coś kiedyś stało się z serwerem. To także
          dodatkowa ochrona przed botami i automatycznymi zgłoszeniami.
        </div>
      </div>

      {/* Icon overflowing the top edge */}
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://assets.realizatorzy.lol/icon.png"
          alt=""
          className="h-20 w-20 rounded-2xl border-4 border-surface1 shadow-lg"
        />
      </div>

      <h1 className="mt-6 text-lg font-medium tracking-wide">Sтяєƒα Rєαℓιzαтσяσω™</h1>

      {status === 'no_pending' && (
        <>
          <CircleAlert className="mx-auto mb-2 mt-6 h-8 w-8 text-danger" />
          <p className="mb-4 text-sm text-textSecondary">
            {errorMessage ?? 'Link wygasł lub jest nieprawidłowy. Wygeneruj nowy na Discordzie.'}
          </p>
          <a
            href={discordAuthorizeUrl}
            className="accent-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white"
          >
            <ShieldCheck className="h-4 w-4" />
            Zweryfikuj się ponownie
          </a>
        </>
      )}

      {status !== 'no_pending' && (
        <p className="mb-6 mt-1 text-xs text-textMuted">
          Weryfikacja jest wymagana, żeby uzyskać dostęp do serwera.
        </p>
      )}

      {status === 'idle' && (
        <button
          onClick={handleVerifyClick}
          className="accent-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white"
        >
          <ShieldCheck className="h-4 w-4" />
          Zweryfikuj się
        </button>
      )}

      {status === 'loading' && (
        <div className="accent-gradient-animated flex w-full items-center justify-center gap-2 rounded-xl py-3 fade-in">
          <span className="loading-dots">
            <span />
            <span />
            <span />
          </span>
        </div>
      )}

      {status === 'turnstile' && (
        <div className="flex justify-center fade-in">
          <div ref={widgetRef} />
        </div>
      )}

      {status === 'success' && (
        <div className="fade-in">
          <CircleCheck className="mx-auto mb-2 h-10 w-10 text-success" />
          <p className="text-sm font-medium">Zweryfikowano pomyślnie</p>
          {successName && <p className="mt-1 text-xs text-textSecondary">Witaj, {successName}.</p>}
          <a
            href={discordAuthorizeUrl}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border1 py-2.5 text-xs text-textSecondary hover:border-borderStrong"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Zweryfikuj ponownie
          </a>
        </div>
      )}

      {status === 'error' && (
        <div className="fade-in">
          <CircleAlert className="mx-auto mb-2 h-10 w-10 text-danger" />
          <p className="text-sm text-textSecondary">{errorMessage}</p>
          <a
            href={discordAuthorizeUrl}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border1 py-2.5 text-xs text-textSecondary hover:border-borderStrong"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Spróbuj ponownie
          </a>
        </div>
      )}
    </div>
  );
}
