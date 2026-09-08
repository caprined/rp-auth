import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'realizatorzy.lol',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
