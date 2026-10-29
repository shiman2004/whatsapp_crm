import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, History, RefreshCw } from 'lucide-react';
import { ErrorState, LoadingSkeleton, SearchInput, SectionCard, cn } from '../../ui';
import { userManagementApi, COMPANY_OPTIONS, type Assignment, type AssignmentHistoryEntry, type ManagedUser, type Page } from './api';
import { ErrorNote, Field, GhostButton, PrimaryButton, formatWhen, inputClass, timeAgo } from './bits';

export const AssignmentsTab: React.FC<{
  onNotify: (title: string, message: string, tone?: 'success' | 'warning' | 'info') => void;
}> = ({ onNotify }) => {
  const [type, setType] = useState<'all' | 'lead' | 'marketing_contact'>('lead');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [company, setCompany] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [data, setData] = useState<Page<Assignment> | null>(null);
  const [history, setHistory] = useState<AssignmentHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [staff, setStaff] = useState<ManagedUser[]>([]);
  const [target, setTarget] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => { setPage(1); }, [type, debounced, company, ownerId]);

  const params = useMemo(() => ({
    type, search: debounced || undefined, company: company || undefined,
    ownerId: ownerId || undefined, page, pageSize,
  }), [type, debounced, company, ownerId, page, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assignments, people] = await Promise.all([
        userManagementApi.assignments(params),
        userManagementApi.users({ status: 'active', pageSize: 100, sort: 'name', order: 'asc' }),
      ]);
      setData(assignments);
      setStaff(people.items.filter((person) => person.role !== 'super_admin'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load assignments.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { void load(); }, [load]);

  const loadHistory = async () => {
    try {
      const result = await userManagementApi.assignmentHistory({ pageSize: 50 });
      setHistory(result.items);
      setShowHistory(true);
    } catch (cause) {
      onNotify('History unavailable', cause instanceof Error ? cause.message : 'Unable to load assignment history.', 'warning');
    }
  };

  const reassign = async (row: Assignment) => {
    const toUserId = target[row.id];
    if (!toUserId) return;
    setBusy(row.id);
    try {
      const result = await userManagementApi.reassign({ type: row.type, id: row.id, toUserId, reason: 'Reassigned from User Management' });
      onNotify('Reassigned', `${row.reference} now belongs to ${result.ownerName}.`, 'success');
      setTarget((current) => ({ ...current, [row.id]: '' }));
      await load();
    } catch (cause) {
      onNotify('Reassignment refused', cause instanceof Error ? cause.message : 'The record could not be reassigned.', 'warning');
    } finally {
      setBusy(null);
    }
  };

  const rows = data?.items || [];

  return (
    <div className="space-y-3">
      <SectionCard
        title="User assignments"
        description="Every operational record that is currently owned by a staff member. The server refuses cross-company reassignment and validates the target's role."
        action={
          <div className="flex gap-2">
            <GhostButton onClick={() => void loadHistory()}><History className="h-3.5 w-3.5" /> History</GhostButton>
            <GhostButton onClick={() => void load()} disabled={loading}><RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh</GhostButton>
          </div>
        }
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <SearchInput value={search} onValueChange={setSearch} placeholder="Search reference, customer or phone…" />
          </div>
          <Field label="Record type">
            <select className={cn(inputClass, 'w-auto')} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="lead">Leads</option>
              <option value="marketing_contact">Marketing contacts</option>
              <option value="all">Both</option>
            </select>
          </Field>
          <Field label="Company">
            <select className={cn(inputClass, 'w-auto')} value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">All companies</option>
              {COMPANY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
          <Field label="Owner">
            <select className={cn(inputClass, 'w-auto max-w-[200px]')} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Everyone</option>
              {staff.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
            </select>
          </Field>
        </div>

        {error && <div className="mt-3"><ErrorState message={error} onRetry={() => void load()} /></div>}

        {loading && !data ? <div className="mt-3"><LoadingSkeleton rows={6} /></div> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">Current record ownership</caption>
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10">
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Record</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Company</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Owner</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Assigned</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Reassign to</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">No assigned records match these filters.</td></tr>
                )}
                {rows.map((row) => (
                  <tr key={`${row.type}-${row.id}`} className="border-b border-slate-100 last:border-0 dark:border-white/5">
                    <td className="px-3 py-2">
                      <span className="block font-semibold text-slate-800 dark:text-slate-100">{row.reference}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {row.type === 'lead' ? 'Lead' : 'Marketing'} · {row.resourceName || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.company || '—'}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.status}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.ownerName || 'Unassigned'}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300" title={formatWhen(row.assignedAt)}>{timeAgo(row.assignedAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Reassign ${row.reference}`}
                          className={cn(inputClass, 'w-auto max-w-[170px]')}
                          value={target[row.id] || ''}
                          onChange={(e) => setTarget((current) => ({ ...current, [row.id]: e.target.value }))}
                        >
                          <option value="">Select staff…</option>
                          {staff
                            .filter((person) => person.id !== row.ownerId)
                            .filter((person) => !row.company || !person.company || person.company === row.company)
                            .map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
                        </select>
                        <PrimaryButton disabled={!target[row.id] || busy === row.id} onClick={() => void reassign(row)}>
                          <ArrowRightLeft className="h-3.5 w-3.5" /> {busy === row.id ? '…' : 'Move'}
                        </PrimaryButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-white/10">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {data ? `${data.total.toLocaleString()} assigned record${data.total === 1 ? '' : 's'} · page ${data.page} of ${data.pages}` : 'Loading…'}
          </p>
          <div className="flex gap-2">
            <GhostButton disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</GhostButton>
            <GhostButton disabled={!data || page >= data.pages} onClick={() => setPage((value) => value + 1)}>Next</GhostButton>
          </div>
        </div>
      </SectionCard>

      {showHistory && (
        <SectionCard
          title="Assignment history"
          description="Append-only trail of who moved which record, written with the change itself."
          action={<GhostButton onClick={() => setShowHistory(false)}>Hide</GhostButton>}
        >
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {history.length === 0 && <li className="py-2 text-xs text-slate-500 dark:text-slate-400">No assignment history yet.</li>}
            {history.map((entry) => (
              <li key={`${entry.type}-${entry.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[11px]">
                <span className="min-w-0 text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">{entry.reference || entry.resourceId}</span>
                  {' → '}{entry.toUserName || 'Unassigned'}
                  {entry.actorName ? ` by ${entry.actorName}` : ''}
                  {entry.reason ? ` · ${entry.reason}` : ''}
                </span>
                <time className="text-slate-400 dark:text-slate-500">{formatWhen(entry.assignedAt)}</time>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
      <ErrorNote message={null} />
    </div>
  );
};
