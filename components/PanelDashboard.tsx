'use client';

import { useEffect, useState, useCallback } from 'react';
import { LogOut, Search, Users, RefreshCw, Send, X } from 'lucide-react';

interface VerifiedUser {
  discord_id: string;
  username: string;
  global_name: string | null;
  verified_at: string;
}

interface QueueJob {
  id: string;
  status: 'running' | 'done' | 'cancelled';
  total_count: number;
  done_count: number;
  failed_count: number;
  target_guild_id: string;
}

export default function PanelDashboard() {
  const [users, setUsers] = useState<VerifiedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<QueueJob | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetGuildId, setTargetGuildId] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const loadUsers = useCallback(async (p: number, s: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (s) params.set('search', s);
    const res = await fetch(`/api/admin/users?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, []);

  const loadJobStatus = useCallback(async () => {
    const res = await fetch('/api/admin/queue/status');
    if (res.ok) {
      const data = await res.json();
      setJob(data.job ?? null);
    }
  }, []);

  useEffect(() => {
    loadUsers(page, search);
  }, [page, search, loadUsers]);

  useEffect(() => {
    loadJobStatus();
  }, [loadJobStatus]);

  useEffect(() => {
    if (job?.status !== 'running') return;
    const interval = setInterval(loadJobStatus, 3000);
    return () => clearInterval(interval);
  }, [job?.status, loadJobStatus]);

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/desc/login';
  }

  async function handleStartQueue() {
    setModalError(null);
    if (!/^[0-9]{15,25}$/.test(targetGuildId)) {
      setModalError('Nieprawidłowe ID serwera.');
      return;
    }
    const res = await fetch('/api/admin/queue/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetGuildId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setModalError(data.error === 'job_already_running' ? 'Kolejka już się przetwarza.' : 'Nie udało się uruchomić.');
      return;
    }
    setModalOpen(false);
    setTargetGuildId('');
    loadJobStatus();
  }

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <main className="min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-medium">realizatorzy.lol — panel</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-border1 px-3 py-2 text-sm text-textSecondary hover:border-borderStrong"
          >
            <LogOut className="h-4 w-4" />
            Wyloguj
          </button>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border1 bg-surface1 p-4">
            <p className="text-xs text-textMuted">Zweryfikowani łącznie</p>
            <p className="mt-1 text-2xl font-medium">{total}</p>
          </div>
          <div className="rounded-xl border border-border1 bg-surface1 p-4">
            <p className="text-xs text-textMuted">Status kolejki</p>
            <p className="mt-1 text-2xl font-medium">
              {job ? (job.status === 'running' ? `${job.done_count}/${job.total_count}` : 'brak') : '—'}
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            disabled={job?.status === 'running'}
            className="accent-gradient col-span-2 flex items-center justify-center gap-2 rounded-xl p-4 text-sm font-medium text-white disabled:opacity-50 md:col-span-1"
          >
            <Send className="h-4 w-4" />
            Dodaj wszystkich na nowy serwer
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border1 bg-surface1 px-3">
          <Search className="h-4 w-4 text-textMuted" />
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Szukaj po ID lub nicku..."
            className="w-full bg-transparent py-2.5 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-border1">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead>
              <tr className="border-b border-border1 text-xs text-textMuted">
                <th className="px-4 py-3 font-normal">Użytkownik</th>
                <th className="px-4 py-3 font-normal">Discord ID</th>
                <th className="px-4 py-3 font-normal">Zweryfikowano</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-textMuted">
                    <RefreshCw className="mx-auto h-4 w-4 animate-spin" />
                  </td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-textMuted">
                    <Users className="mx-auto mb-2 h-6 w-6" />
                    Brak wyników.
                  </td>
                </tr>
              )}
              {!loading &&
                users.map((u) => (
                  <tr key={u.discord_id} className="border-b border-border1 last:border-0">
                    <td className="px-4 py-3">{u.global_name ?? u.username}</td>
                    <td className="mono px-4 py-3 text-textSecondary">{u.discord_id}</td>
                    <td className="px-4 py-3 text-textSecondary">
                      {new Date(u.verified_at).toLocaleString('pl-PL')}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3 text-sm text-textSecondary">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-border1 px-3 py-1.5 disabled:opacity-40"
            >
              Poprzednia
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-border1 px-3 py-1.5 disabled:opacity-40"
            >
              Następna
            </button>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[380px] rounded-2xl border border-border1 bg-surface1 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium">Dodaj wszystkich na nowy serwer</h2>
              <button onClick={() => setModalOpen(false)}>
                <X className="h-4 w-4 text-textMuted" />
              </button>
            </div>
            <p className="mb-3 text-sm text-textSecondary">
              Zostanie dodanych <strong>{total}</strong> userów. To potrwa jakiś czas (Discord ogranicza tempo
              dołączania).
            </p>
            <input
              value={targetGuildId}
              onChange={(e) => setTargetGuildId(e.target.value)}
              placeholder="ID nowego serwera"
              className="mono mb-3 w-full rounded-lg border border-border1 bg-surface2 px-3 py-2.5 text-sm focus:outline-none"
            />
            {modalError && <p className="mb-3 text-sm text-danger">{modalError}</p>}
            <button
              onClick={handleStartQueue}
              className="accent-gradient w-full rounded-lg py-2.5 text-sm font-medium text-white"
            >
              Potwierdź i uruchom
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
