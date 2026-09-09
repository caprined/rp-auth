'use client';

import { useEffect, useState, useCallback } from 'react';
import { LogOut, Search, Users, RefreshCw, Send, X, Square } from 'lucide-react';
import { discordAvatarUrl, relativeTimePl, formatDuration, errorLabelPl } from '../lib/format';

interface VerifiedUser {
  discord_id: string;
  username: string;
  global_name: string | null;
  avatar_hash: string | null;
  verified_at: string;
}

interface QueueJob {
  id: string;
  status: 'running' | 'done' | 'cancelled';
  total_count: number;
  done_count: number;
  failed_count: number;
  pending_count: number;
  target_guild_id: string;
  created_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
}

interface LastError {
  discord_id: string;
  last_error: string;
  updated_at: string;
}

export default function PanelDashboard() {
  const [users, setUsers] = useState<VerifiedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<QueueJob | null>(null);
  const [lastError, setLastError] = useState<LastError | null>(null);
  const [errorBreakdown, setErrorBreakdown] = useState<Record<string, number>>({});
  const [summaryDismissed, setSummaryDismissed] = useState(false);
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
      setLastError(data.lastError ?? null);
      setErrorBreakdown(data.errorBreakdown ?? {});
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

  async function handleCancelQueue() {
    await fetch('/api/admin/queue/cancel', { method: 'POST' });
    loadJobStatus();
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
    setSummaryDismissed(false);
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

        {job && (job.status === 'done' || job.status === 'cancelled') && !summaryDismissed && (
          <div className="mb-6 rounded-xl border border-border1 bg-surface1 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">
                {job.status === 'done' ? 'Podsumowanie zakończonej kolejki' : 'Kolejka przerwana'}
              </h2>
              <button onClick={() => setSummaryDismissed(true)} className="text-textMuted hover:text-textSecondary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg bg-surface2 p-3">
                <p className="text-xs text-textMuted">Łącznie</p>
                <p className="mt-0.5 text-lg font-medium">{job.total_count}</p>
              </div>
              <div className="rounded-lg bg-surface2 p-3">
                <p className="text-xs text-textMuted">Dodano poprawnie</p>
                <p className="mt-0.5 text-lg font-medium text-success">{job.done_count}</p>
              </div>
              <div className="rounded-lg bg-surface2 p-3">
                <p className="text-xs text-textMuted">Błędy</p>
                <p className="mt-0.5 text-lg font-medium text-danger">{job.failed_count}</p>
              </div>
              <div className="rounded-lg bg-surface2 p-3">
                <p className="text-xs text-textMuted">Czas trwania</p>
                <p className="mt-0.5 text-lg font-medium">
                  {job.duration_seconds !== null ? formatDuration(job.duration_seconds) : '—'}
                </p>
              </div>
            </div>
            {Object.keys(errorBreakdown).length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-textMuted">Rodzaje błędów:</p>
                <ul className="space-y-1 text-xs text-textSecondary">
                  {Object.entries(errorBreakdown).map(([key, count]) => (
                    <li key={key} className="flex justify-between gap-3 rounded-lg bg-surface2 px-3 py-2">
                      <span>{errorLabelPl(key)}</span>
                      <span className="mono shrink-0 text-textMuted">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {job?.status === 'running' && job.failed_count > 0 && lastError && (
          <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            <span className="font-medium">{job.failed_count}</span> {job.failed_count === 1 ? 'osoba nie dodała się' : 'osób nie dodało się'} do serwera.
            Ostatni błąd (<span className="mono">{lastError.discord_id}</span>): {lastError.last_error}
          </div>
        )}

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
          {job?.status === 'running' ? (
            <button
              onClick={handleCancelQueue}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-danger p-4 text-sm font-medium text-danger md:col-span-1"
            >
              <Square className="h-4 w-4" />
              Przerwij kolejkę
            </button>
          ) : (
            <button
              onClick={() => setModalOpen(true)}
              className="accent-gradient col-span-2 flex items-center justify-center gap-2 rounded-xl p-4 text-sm font-medium text-white md:col-span-1"
            >
              <Send className="h-4 w-4" />
              Dodaj wszystkich na nowy serwer
            </button>
          )}
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={discordAvatarUrl(u.discord_id, u.avatar_hash)}
                          alt=""
                          className="h-7 w-7 rounded-full"
                        />
                        {u.global_name ?? u.username}
                      </div>
                    </td>
                    <td className="mono px-4 py-3 text-textSecondary">{u.discord_id}</td>
                    <td className="px-4 py-3">
                      <div>{new Date(u.verified_at).toLocaleString('pl-PL')}</div>
                      <div className="text-xs text-textMuted">{relativeTimePl(u.verified_at)}</div>
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
