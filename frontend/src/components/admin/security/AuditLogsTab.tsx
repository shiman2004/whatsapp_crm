import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter, Search, ScrollText } from 'lucide-react';
import { securityApi } from './api';
import {
  Badge, ChangeList, Drawer, EmptyState, ErrorState, Notice, Pagination, SCOPE_LABEL, SkeletonBlock, formatDate,
} from './bits';
import type { AuditEvent, AuditPage, ModuleInfo } from './types';

const PAGE_SIZE = 25;

const OUTCOMES = [
  { value: '', label: 'Any outcome' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'denied', label: 'Denied' },
  { value: 'authorized', label: 'Authorized' },
];

const outcomeTone = (outcome: string) =>
  outcome === 'denied' ? 'rose' : outcome === 'succeeded' ? 'emerald' : outcome === 'authorized' ? 'teal' : 'slate';

export const AuditLogsTab: React.FC = () => {
  const [filters, setFilters] = useState({ search: '', action: '', module: '', outcome: '', from: '', to: '' });
  const [debounced, setDebounced] = useState({ search: '', action: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditPage | null>(null);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced({ search: filters.search.trim(), action: filters.action.trim() }), 250);
    return () => clearTimeout(timer);
  }, [filters.search, filters.action]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await securityApi.audit({
        page,
        pageSize: PAGE_SIZE,
        search: debounced.search,
        action: debounced.action,
        module: filters.module,
        outcome: filters.outcome,
        from: filters.from ? `${filters.from}T00:00:00` : '',
        to: filters.to ? `${filters.to}T23:59:59` : '',
      });
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the audit trail.');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, filters.module, filters.outcome, filters.from, filters.to]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    securityApi.roles()
      .then(result => setModules(result.modules))
      .catch(() => setModules([]));
  }, []);

  const update = (key: keyof typeof filters, value: string) => {
    setFilters(current => ({ ...current, [key]: value }));
    setPage(1);
  };

  const items = data?.items || [];
  const moduleLabel = useMemo(() => Object.fromEntries(modules.map(module => [module.id, module.label])), [modules]);

  return (
    <div className="space-y-3">
      <Notice tone="indigo">
        <div className="flex items-start gap-2">
          <ScrollText className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Permission changes, denied security access and administrative actions are recorded with the acting account, correlation id and before/after capability changes. Credentials are never written to this trail.</p>
        </div>
      </Notice>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_170px_190px_150px_150px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={filters.search}
              onChange={event => update('search', event.target.value)}
              placeholder="Search resource or actor"
              aria-label="Search audit trail"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <select value={filters.module} onChange={event => update('module', event.target.value)} aria-label="Filter by module" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            <option value="">All modules</option>
            {modules.map(module => <option key={module.id} value={module.id}>{module.label}</option>)}
          </select>
          <input
            value={filters.action}
            onChange={event => update('action', event.target.value)}
            placeholder="Action prefix e.g. permissions."
            aria-label="Filter by action"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <select value={filters.outcome} onChange={event => update('outcome', event.target.value)} aria-label="Filter by outcome" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            {OUTCOMES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <input type="date" value={filters.from} onChange={event => update('from', event.target.value)} aria-label="From date" className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-[11px] text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" />
            <span className="text-slate-400">–</span>
            <input type="date" value={filters.to} onChange={event => update('to', event.target.value)} aria-label="To date" className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-[11px] text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" />
          </div>
        </div>
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"><Filter className="h-3.5 w-3.5" />Filters apply on the server; results are newest first.</p>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                <th className="px-4 py-3 font-bold">When</th>
                <th className="px-4 py-3 font-bold">Actor</th>
                <th className="px-4 py-3 font-bold">Action</th>
                <th className="px-4 py-3 font-bold">Resource</th>
                <th className="px-4 py-3 font-bold">Outcome</th>
                <th className="px-4 py-3 text-right font-bold">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && <tr><td colSpan={6} className="p-4"><SkeletonBlock rows={6} /></td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={6} className="p-4"><EmptyState title="No audit events match" description="Try widening the date range or clearing filters." /></td></tr>}
              {items.map(event => (
                <tr key={event.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 dark:border-slate-800/70 dark:hover:bg-slate-800/30">
                  <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-slate-600 dark:text-slate-300">{formatDate(event.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <span className="block font-semibold text-slate-900 dark:text-slate-100">{event.actorName}</span>
                    <span className="block font-mono text-[10px] text-slate-500 dark:text-slate-400">{event.actorId}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{event.action}</code>
                    {event.module && <span className="mt-1 block text-[10px] text-slate-500 dark:text-slate-400">{moduleLabel[event.module] || event.module}</span>}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-[11px] text-slate-600 dark:text-slate-300">{event.resource}</td>
                  <td className="px-4 py-2.5"><Badge tone={outcomeTone(event.outcome) as 'rose' | 'emerald' | 'teal' | 'slate'}>{event.outcome}</Badge></td>
                  <td className="px-4 py-2.5 text-right">
                    <button type="button" onClick={() => setSelected(event)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold text-slate-700 hover:border-indigo-400 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300">View</button>
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

      <Drawer
        open={Boolean(selected)}
        title={selected?.action || 'Audit event'}
        subtitle={selected ? formatDate(selected.createdAt) : undefined}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Actor</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{selected.actorName}</p>
                <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{selected.actorId}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Outcome</p>
                <p className="mt-1"><Badge tone={outcomeTone(selected.outcome) as 'rose' | 'emerald' | 'teal' | 'slate'}>{selected.outcome}</Badge></p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Resource</p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-800 dark:text-slate-100">{selected.resource}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Correlation id</p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-800 dark:text-slate-100">{selected.correlationId}</p>
              </div>
            </div>

            {(selected.subjectType || selected.subjectId) && (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Subject</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{selected.subjectType || '—'} · {selected.subjectId || '—'}</p>
                {selected.revision !== null && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Revision after write: {selected.revision}</p>}
                {selected.scope && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Scope: {SCOPE_LABEL[selected.scope]}</p>}
              </div>
            )}

            {selected.reason && (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Reason</p>
                <p className="mt-1 text-slate-800 dark:text-slate-100">{selected.reason}</p>
              </div>
            )}

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Capability changes</p>
              <ChangeList changes={selected.changes} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
