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
  const [infoOpen, setInfoOpen] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const infoWrapRef = useRef<HTMLDivElement>(null);

  // Zamkniecie tooltipa klikiem poza nim.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (infoWrapRef.current && !infoWrapRef.current.contains(e.target as Node)) {
        setInfoOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function handleVerifyClick() {
    setStatus('loading');
    const loadingStarted = Date.now();
    const wait = Math.max(0, MIN_LOADING_MS - (Date.now() - loadingStarted));
    setTimeout(() => setStatus('turnstile'), wait);
  }

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
  const isBusy = status === 'loading' || status === 'redirecting';

  // Jeden, ten sam <button> dla kazdego stanu tekstu/linku - zmieniamy tylko klasy i zawartosc,
  // NIGDY nie podmieniamy go na inny element, zeby nie bylo remountu (a wiec i migniecia).
  let buttonLabel: React.ReactNode;
  let buttonClass =
    'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium';
  let onButtonClick: ((e: React.MouseEvent) => void) | undefined;

  if (isBusy) {
    buttonClass += ' accent-gradient-animated text-white';
    buttonLabel = (
      <span className="loading-dots">
        <span />
        <span />
        <span />
      </span>
    );
  } else if (status === 'idle') {
    buttonClass += ' accent-gradient text-white';
    buttonLabel = (
      <>
        <Fingerprint className="h-4 w-4" />
        Zweryfikuj się
      </>
    );
    onButtonClick = () => handleVerifyClick();
  } else if (status === 'no_pending') {
    buttonClass += ' accent-gradient text-white';
    buttonLabel = (
      <>
        <Fingerprint className="h-4 w-4" />
        Zweryfikuj się ponownie
      </>
    );
    onButtonClick = handleGoToDiscord;
  } else if (status === 'success') {
    buttonClass += ' border border-border1 text-textSecondary hover:border-borderStrong';
    buttonLabel = (
      <>
        <RotateCcw className="h-3.5 w-3.5" />
        Zweryfikuj ponownie
      </>
    );
    onButtonClick = handleGoToDiscord;
  } else if (status === 'error') {
    buttonClass += ' border border-border1 text-textSecondary hover:border-borderStrong';
    buttonLabel = (
      <>
        <RotateCcw className="h-3.5 w-3.5" />
        Spróbuj ponownie
      </>
    );
    onButtonClick = handleGoToDiscord;
  }

  return (
    <div className="relative w-full max-w-[400px] rounded-3xl border border-border1 bg-surface1 px-8 pb-8 pt-16 text-center">
      {/* Info - klik (dziala na telefonie), fade in/out, zamyka sie klikiem poza nim */}
      <div ref={infoWrapRef} className="absolute right-4 top-4 z-50">
        <button
          type="button"
          aria-label="Informacje o weryfikacji"
          onClick={() => setInfoOpen((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-textMuted hover:text-textSecondary"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
        <div
          className={`absolute right-0 top-9 w-64 rounded-xl border border-border1 bg-surface2 p-3 text-left text-xs leading-relaxed text-textSecondary shadow-lg transition-opacity duration-200 ${
            infoOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          Ta weryfikacja dotyczy wyłącznie serwera discord Strefa Realizatorów. Nie zbieramy adresów e-mail,
          a pozyskane dane nie są nigdzie sprzedawane ani wykorzystywane poza tym projektem. Posłużą wyłącznie
          do przywrócenia dostępu, gdyby coś kiedyś stało się z serwerem. To także dodatkowa ochrona przed
          botami i automatycznymi zgłoszeniami.
        </div>
      </div>

      {/* Icon overflowing the top edge */}
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

      <div className={showSubtitle ? '' : 'mt-6'}>
        {status === 'no_pending' && (
          <div className="mb-4 flex items-center justify-center gap-2.5">
            <CircleAlert className="h-8 w-8 shrink-0 text-danger" />
            <p className="text-left text-sm text-textSecondary">
              {errorMessage ?? 'Link wygasł lub jest nieprawidłowy. Wygeneruj nowy na Discordzie.'}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="mb-4 flex items-center justify-center gap-3">
            <CircleCheck className="h-10 w-10 shrink-0 text-success" />
            <p className="text-left text-sm">
              <span className="font-medium">Zweryfikowano pomyślnie</span>
              <span className="block text-xs text-textSecondary">Możesz już zamknąć tę kartę.</span>
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="mb-4 flex items-center justify-center gap-3">
            <CircleAlert className="h-10 w-10 shrink-0 text-danger" />
            <p className="text-left text-sm text-textSecondary">{errorMessage}</p>
          </div>
        )}

        {/* Ten sam przycisk dla idle / loading / no_pending / redirecting / success / error.
            Chowany (nie odmontowywany) tylko na czas Turnstile. */}
        <button
          type="button"
          onClick={onButtonClick}
          disabled={isBusy}
          style={{ display: status === 'turnstile' ? 'none' : 'flex' }}
          className={buttonClass}
        >
          {buttonLabel}
        </button>

        <div
          className="flex w-full justify-center"
          style={{ display: status === 'turnstile' ? 'flex' : 'none' }}
        >
          <div ref={widgetRef} />
        </div>
      </div>
    </div>
  );
}
