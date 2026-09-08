import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getAdminSession, SESSION_COOKIE } from '../../../lib/session';

export default async function ProtectedDescLayout({ children }: { children: ReactNode }) {
  const store = cookies();
  const hasCookie = Boolean(store.get(SESSION_COOKIE)?.value);
  const session = await getAdminSession();

  if (!session) {
    if (!hasCookie) {
      redirect('/desc/login');
    }
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-medium">403 — brak dostępu</h1>
          <p className="mt-2 text-sm text-textSecondary">To konto nie ma dostępu do panelu.</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
