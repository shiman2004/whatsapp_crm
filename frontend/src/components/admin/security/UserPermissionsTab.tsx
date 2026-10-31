import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Filter, Search, SlidersHorizontal, UserCog, XCircle } from 'lucide-react';
import { securityApi } from './api';
import {
  Badge, EmptyState, ErrorState, Notice, Pagination, ScopePill, SkeletonBlock, cx,
} from './bits';
import type { RoleSummary, UserPage } from './types';
import { UserPermissionDrawer } from './UserPermissionDrawer';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active only' },
  { value: 'disabled', label: 'Disabled only' },
];

const CUSTOM_OPTIONS = [
  { value: '', label: 'Default & custom' },
  { value: 'custom', label: 'Custom overrides' },
  { value: 'default', label: 'Role defaults only' },
];

const DEPARTMENT_OPTIONS = [
  { value: '', label: 'All departments' },
  { value: 'crm', label: 'CRM' },
  { value: 'exam', label: 'Exam Department' },
  { value: 'clinical', label: 'Clinical' },
  { value: 'marketing', label: 'Public Contact Marketing' },
  { value: 'administration', label: 'Administration' },
];

export const UserPermissionsTab: React.FC = () => {
  const [filters, setFilters] = useState({ search: '', role: '', department: '', status: '', custom: '' });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UserPage | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search.trim()), 250);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await securityApi.users({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        role: filters.role,
        department: filters.department,
        status: filters.status,
        custom: filters.custom,
      });
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the user directory.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filters.role, filters.department, filters.status, filters.custom]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    securityApi.roles()
      .then(result => setRoles(result.roles))
      .catch(() => setRoles([]));
  }, []);

  const roleOptions = useMemo(
    () => [...roles].sort((a, b) => a.label.localeCompare(b.label)),
    [roles],
  );

  const update = (key: keyof typeof filters, value: string) => {
    setFilters(current => ({ ...current, [key]: value }));
    setPage(1);
  };

  const items = data?.items || [];

  return (
    <div className="space-y-3">
      {notice && (
        <div className="flex items-start justify-between gap-2">
          <Notice tone="emerald"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />{notice}</span></Notice>
          <button type="button" onClick={() => setNotice(null)} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Dismiss</button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={filters.search}
            onChange={event => update('search', event.target.value)}
            placeholder="Search by name or email"
            aria-label="Search staff"
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <select value={filters.role} onChange={event => update('role', event.target.value)} aria-label="Filter by role" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            <option value="">All roles</option>
            {roleOptions.map(role => <option key={role.role} value={role.role}>{role.label}</option>)}
          </select>
          <select value={filters.department} onChange={event => update('department', event.target.value)} aria-label="Filter by department" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            {DEPARTMENT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={filters.status} onChange={event => update('status', event.target.value)} aria-label="Filter by account status" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={filters.custom} onChange={event => update('custom', event.target.value)} aria-label="Filter by custom permissions" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            {CUSTOM_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" />Only accounts with an effective role or personal override appear here.</span>
          <span className="inline-flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" />Allow is limited to delegatable exam draft capabilities.</span>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                <th className="px-4 py-3 font-bold">User</th>
                <th className="px-4 py-3 font-bold">Role · department</th>
                <th className="px-4 py-3 font-bold">Scope</th>
                <th className="px-4 py-3 font-bold">Overrides</th>
                <th className="px-4 py-3 font-bold">Account</th>
                <th className="px-4 py-3 text-right font-bold">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && (
                <tr><td colSpan={6} className="p-4"><SkeletonBlock rows={6} /></td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={6} className="p-4"><EmptyState title="No matching staff accounts" description="Adjust the search or filters to find an account." /></td></tr>
              )}
              {items.map(user => {
                return (
                  <tr key={user.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 dark:border-slate-800/70 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                          {user.fullName.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-900 dark:text-slate-100">{user.fullName}</span>
                          <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{user.email}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-slate-800 dark:text-slate-100">{user.roleLabel}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">{user.departmentLabel}{user.company ? ` · ${user.company}` : ''}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ScopePill scope={user.scope} />
                    </td>
                    <td className="px-4 py-3">
                      {user.customPermissions
                        ? <Badge tone="amber">{user.overrideCount || 0} stored</Badge>
                        : <Badge tone="slate">Role defaults</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      {user.active
                        ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />Active</span>
                        : <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400"><XCircle className="h-3.5 w-3.5" />Disabled</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(user.id)}
                        className={cx(
                          'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-semibold motion-safe:transition-colors',
                          'border-slate-300 text-slate-700 hover:border-indigo-400 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300',
                        )}
                      >
                        <UserCog className="h-3.5 w-3.5" />Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <Pagination page={data?.page || page} pages={data?.pages || 1} total={data?.total || 0} busy={loading} onChange={setPage} />
        </div>
      </div>

      {selectedUserId && (
        <UserPermissionDrawer
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onSaved={() => {
            const name = items.find(item => item.id === selectedUserId)?.fullName || 'User';
            setSelectedUserId(null);
            setNotice(`${name} permissions updated. The audit trail records who changed what.`);
            void load();
          }}
        />
      )}
    </div>
  );
};
