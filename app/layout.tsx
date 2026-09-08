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
      <head>
        {/* Font Awesome - tylko po to, zeby miec oficjalna ikonke marki Discorda (lucide jej nie ma) */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
