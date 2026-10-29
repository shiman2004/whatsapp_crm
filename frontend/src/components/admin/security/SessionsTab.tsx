import React, { useCallback, useEffect, useState } from 'react';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import { userManagementApi, type LoginSession, type Page } from '../user-management/api';
import { Badge, ConfirmDialog, ErrorState, EmptyState, Notice, Pagination, SkeletonBlock, formatDate } from './bits';

const PAGE_SIZE = 25;
const STATE_LABEL: Record<string, string> = { '': 'Any state', active: 'Active', revoked: 'Revoked' };

export const SessionsTab: React.FC = () => {
  const [state, setState] = useState('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<LoginSession> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<LoginSession | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await userManagementApi.sessions({ state: state || undefined, search: search.trim() || undefined, page, pageSize: PAGE_SIZE }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load login activity.');
    } finally {
      setLoading(false);
    }
  }, [state, search, page]);

  useEffect(() => { void load(); }, [load]);

  const revoke = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await userManagementApi.revokeSession(target.id);
      setTarget(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The session could not be revoked.');
    } finally {
      setBusy(false);
    }
  };

  const items = data?.items || [];

  return (
    <div className="space-y-3">
      <Notice tone="indigo">
        <div className="flex items-start gap-2">
          <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Sessions are recorded server-side on sign-in. Revoking one invalidates that device immediately; the account and its records are untouched.</p>
        </div>
      </Notice>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder="Search name, email, IP or device"
          aria-label="Search login activity"
          className="min-w-[220px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <select
          value={state}
          onChange={(event) => { setState(event.target.value); setPage(1); }}
          aria-label="Filter by session state"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          {Object.entries(STATE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          Refresh
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                <th className="px-4 py-3 font-bold">Account</th>
                <th className="px-4 py-3 font-bold">Device</th>
                <th className="px-4 py-3 font-bold">IP</th>
                <th className="px-4 py-3 font-bold">Started</th>
                <th className="px-4 py-3 font-bold">Last seen</th>
                <th className="px-4 py-3 font-bold">State</th>
                <th className="px-4 py-3 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && <tr><td colSpan={7} className="p-4"><SkeletonBlock rows={6} /></td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={7} className="p-4"><EmptyState title="No sessions match" description="Try clearing the state filter or the search." /></td></tr>}
              {items.map((session) => (
                <tr key={session.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/70">
                  <td className="px-4 py-2.5">
                    <span className="block font-semibold text-slate-900 dark:text-slate-100">{session.userName || 'Unknown account'}</span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">{session.email || session.userId}</span>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-[11px] text-slate-600 dark:text-slate-300" title={session.userAgent || ''}>{session.device}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">{session.ip || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-slate-600 dark:text-slate-300">{formatDate(session.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-slate-600 dark:text-slate-300">{formatDate(session.lastSeenAt)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={session.status === 'active' ? 'emerald' : 'slate'}>{session.status}</Badge>
                    {session.revokeReason && <span className="mt-1 block max-w-[160px] truncate text-[10px] text-slate-500 dark:text-slate-400" title={session.revokeReason}>{session.revokeReason}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {session.status === 'active' ? (
                      <button type="button" onClick={() => setTarget(session)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-2.5 py-1.5 font-semibold text-rose-700 hover:bg-rose-500/10 dark:text-rose-300">
                        <LogOut className="h-3.5 w-3.5" />Revoke
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">{formatDate(session.revokedAt)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <Pagination page={data?.page || page} pages={data?.pages || 1} total={data?.total || 0} busy={loading} onChange={setPage} />
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(target)}
        title="Revoke this session?"
        description={`${target?.userName || 'This account'} on ${target?.device || 'that device'} must sign in again.`}
        tone="danger"
        confirmLabel="Revoke session"
        busy={busy}
        onCancel={() => setTarget(null)}
        onConfirm={() => void revoke()}
      />
    </div>
  );
};
