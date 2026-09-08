import { Home } from 'lucide-react';

export default function TopBar() {
  return (
    <header className="fixed left-4 right-4 top-4 z-20 flex items-center justify-between rounded-2xl border border-border1 bg-surface1/90 px-4 py-2.5 backdrop-blur md:left-8 md:right-8">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://assets.realizatorzy.lol/icon.png" alt="" className="h-9 w-9 rounded-lg" />
        <span className="text-sm font-medium tracking-wide">Sтяєƒα Rєαℓιzαтσяσω</span>
      </div>
      <div className="flex items-center gap-2">
        <a
          href="https://realizatorzy.lol"
          aria-label="Strona główna"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-textSecondary hover:text-textPrimary"
        >
          <Home className="h-4 w-4" />
        </a>
        <a
          href="https://discord.gg/realizatorzy"
          aria-label="Dołącz na Discord"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-textSecondary hover:text-textPrimary"
        >
          <i className="fa-brands fa-discord text-base" />
        </a>
      </div>
    </header>
  );
}
