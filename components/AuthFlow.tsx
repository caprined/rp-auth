'use client';

import { useEffect, useRef, useState } from 'react';
import { Fingerprint, CircleCheck, CircleAlert, Info, RotateCcw } from 'lucide-react';

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

type Status = 'no_pending' | 'idle' | 'loading' | 'turnstile' | 'success' | 'error' | 'redirecting';

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
  const [infoOpen, setInfoOpen] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  function handleVerifyClick() {
    setStatus('loading');
    const loadingStarted = Date.now();
    const wait = () => Math.max(0, MIN_LOADING_MS - (Date.now() - loadingStarted));
    setTimeout(() => setStatus('turnstile'), wait());
  }

  // Uzywane dla wszystkich przyciskow "wracam przez Discorda" (no_pending / success / error) -
  // strona autoryzacji Discorda potrafi ladowac sie dlugo, wiec pokazujemy loading zamiast
  // twardej, natychmiastowej nawigacji bez feedbacku.
  function handleGoToDiscord(e: React.MouseEvent) {
    e.preventDefault();
    setStatus('redirecting');
    window.location.href = discordAuthorizeUrl;
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

  const showSubtitle = status === 'idle' || status === 'loading' || status === 'turnstile';

  return (
    <div className="relative w-full max-w-[400px] rounded-3xl border border-border1 bg-surface1 px-8 pb-8 pt-16 text-center">
      {/* Info button - klik, nie hover (dziala tez na telefonie), zawsze na wierzchu */}
      <div className="absolute right-4 top-4 z-50">
        <button
          type="button"
          aria-label="Informacje o weryfikacji"
          onClick={() => setInfoOpen((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-textMuted hover:text-textSecondary"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
        {infoOpen && (
          <div className="absolute right-0 top-9 w-64 rounded-xl border border-border1 bg-surface2 p-3 text-left text-xs leading-relaxed text-textSecondary shadow-lg">
            Ta weryfikacja dotyczy wyłącznie serwera discord Strefa Realizatorów. Nie zbieramy adresów e-mail,
            a pozyskane dane nie są nigdzie sprzedawane ani wykorzystywane poza tym projektem. Posłużą wyłącznie
            do przywrócenia dostępu, gdyby coś kiedyś stało się z serwerem. To także dodatkowa ochrona przed
            botami i automatycznymi zgłoszeniami.
          </div>
        )}
      </div>

      {/* Icon overflowing the top edge - bez dodatkowej ramki, znacznie wieksza */}
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://assets.realizatorzy.lol/icon.png" alt="" className="h-32 w-32" />
      </div>

      <h1 className="mt-4 text-lg font-medium tracking-wide">Sтяєƒα Rєαℓιzαтσяσω™</h1>

      {showSubtitle && (
        <p className="mb-6 mt-1 text-xs text-textMuted">
          Weryfikacja jest wymagana, żeby uzyskać dostęp do serwera.
        </p>
      )}

      {/* Kontener akcji - stala wysokosc/szerokosc, zeby zadna zmiana stanu nie zmieniala rozmiaru ramki */}
      <div className={showSubtitle ? '' : 'mt-6'}>
        {status === 'no_pending' && (
          <div className="mb-2">
            <CircleAlert className="mx-auto mb-3 h-8 w-8 text-danger" />
            <p className="mb-4 text-sm text-textSecondary">
              {errorMessage ?? 'Link wygasł lub jest nieprawidłowy. Wygeneruj nowy na Discordzie.'}
            </p>
          </div>
        )}


        {status === 'idle' && (
          <button
            onClick={handleVerifyClick}
            className="accent-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white"
          >
            <Fingerprint className="h-4 w-4" />
            Zweryfikuj się
          </button>
        )}

        {(status === 'loading' || status === 'redirecting') && (
          <div className="accent-gradient-animated flex w-full items-center justify-center gap-2 rounded-xl py-3 fade-in">
            <span className="loading-dots">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}

        {status === 'no_pending' && (
          <button
            onClick={handleGoToDiscord}
            className="accent-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white"
          >
            <Fingerprint className="h-4 w-4" />
            Zweryfikuj się ponownie
          </button>
        )}

        {status === 'turnstile' && (
          <div className="flex w-full justify-center fade-in">
            <div ref={widgetRef} />
          </div>
        )}

        {status === 'success' && (
          <div className="flex w-full items-center justify-center gap-3 fade-in">
            <CircleCheck className="h-10 w-10 shrink-0 text-success" />
            <p className="text-left text-sm font-medium">
              Zweryfikowano pomyślnie
              {successName && <span className="block text-xs font-normal text-textSecondary">Witaj, {successName}.</span>}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex w-full items-center justify-center gap-3 fade-in">
            <CircleAlert className="h-10 w-10 shrink-0 text-danger" />
            <p className="text-left text-sm text-textSecondary">{errorMessage}</p>
          </div>
        )}

        {(status === 'success' || status === 'error') && (
          <button
            onClick={handleGoToDiscord}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border1 py-2.5 text-xs text-textSecondary hover:border-borderStrong"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {status === 'success' ? 'Zweryfikuj ponownie' : 'Spróbuj ponownie'}
          </button>
        )}
      </div>
    </div>
  );
}
