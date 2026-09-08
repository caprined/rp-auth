import { Home, MessageCircle } from 'lucide-react';

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
          className="flex items-center gap-1.5 rounded-lg border border-border1 px-3 py-1.5 text-xs text-textSecondary hover:border-borderStrong hover:text-textPrimary"
        >
          <Home className="h-3.5 w-3.5" />
          Home
        </a>
        <a
          href="https://discord.gg/realizatorzy"
          className="accent-gradient flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Dołącz na Discord
        </a>
      </div>
    </header>
  );
}
