import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Sтяєƒα Rєαℓιzαтσяσω™',
  robots: { index: false, follow: false },
  icons: {
    icon: 'https://assets.realizatorzy.lol/icon.png',
    shortcut: 'https://assets.realizatorzy.lol/icon.png',
    apple: 'https://assets.realizatorzy.lol/icon.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
