import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Columns3, Download, Filter, RefreshCw, ShieldOff, UserCheck, UserX } from 'lucide-react';
import { ConfirmDialog, EmptyState, ErrorState, FilterToolbar, LoadingSkeleton, SearchInput, SectionCard, cn } from '../../ui';
import { userManagementApi, ROLE_OPTIONS, COMPANY_OPTIONS, type Department, type ManagedUser, type Page } from './api';
import { ErrorNote, GhostButton, PrimaryButton, RoleBadge, UserStatusBadge, formatWhen, timeAgo, inputClass } from './bits';
import { UserDetailDrawer } from './UserDetailDrawer';

const PAGE_SIZES = [10, 20, 50, 100];
const STATUSES = ['active', 'inactive', 'suspended', 'locked', 'invited'] as const;
const COLUMNS = [
  { id: 'user', label: 'User', always: true },
  { id: 'role', label: 'Role' },
  { id: 'company', label: 'Company' },
  { id: 'branch', label: 'Branch' },
  { id: 'department', label: 'Department' },
  { id: 'status', label: 'Status' },
  { id: 'lastLogin', label: 'Last sign-in' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'records', label: 'Records' },
] as const;

type ColumnId = (typeof COLUMNS)[number]['id'];

export interface DirectoryTabProps {
  title: string;
  description: string;
  departments: Department[];
  initialStatus?: string;
  lockStatus?: boolean;
  branchOptions: string[];
  onNotify: (title: string, message: string, tone?: 'success' | 'warning' | 'info') => void;
  onDataChanged: () => void;
}

export const DirectoryTab: React.FC<DirectoryTabProps> = ({
  title, description, departments, initialStatus, lockStatus, branchOptions, onNotify, onDataChanged,
}) => {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [branch, setBranch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState(initialStatus || '');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<Page<ManagedUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [visible, setVisible] = useState<ColumnId[]>(COLUMNS.filter((c) => c.id !== 'department').map((c) => c.id));
  const [showColumns, setShowColumns] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [bulk, setBulk] = useState<null | { action: 'activate' | 'deactivate' | 'suspend'; label: string }>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setStatus(initialStatus || ''); }, [initialStatus]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => { setPage(1); setSelected([]); }, [debounced, role, company, branch, department, status, pageSize, sort, order]);

  const params = useMemo(() => ({
    search: debounced || undefined,
    role: role || undefined,
    company: company || undefined,
    branch: branch || undefined,
    department: department || undefined,
    status: status || undefined,
    sort, order, page, pageSize,
  }), [debounced, role, company, branch, department, status, sort, order, page, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await userManagementApi.users(params));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the user directory.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { void load(); }, [load]);

  const rows = data?.items || [];
  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id));

  const runBulk = async () => {
    if (!bulk) return;
    setBusy(true);
    try {
      const results = await Promise.allSettled(selected.map((id) => userManagementApi.setStatus(id, bulk.action)));
      const failed = results.filter((result) => result.status === 'rejected').length;
      onNotify(
        failed ? 'Bulk action partly failed' : 'Bulk action complete',
        failed ? `${selected.length - failed} account(s) updated, ${failed} rejected by the server.` : `${selected.length} account(s) updated.`,
        failed ? 'warning' : 'success',
      );
      setSelected([]);
      await load();
      onDataChanged();
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    try {
      const blob = await userManagementApi.exportUsers(params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `user-directory-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onNotify('Export ready', 'The filtered directory was downloaded as CSV.', 'success');
    } catch (cause) {
      onNotify('Export failed', cause instanceof Error ? cause.message : 'The export could not be created.', 'warning');
    }
  };

  const toggleSort = (column: string) => {
    if (sort === column) setOrder((value) => (value === 'asc' ? 'desc' : 'asc'));
    else { setSort(column); setOrder('asc'); }
  };

  const header = (id: ColumnId, label: string, sortKey?: string) => (
    <th key={id} scope="col" className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {sortKey ? (
        <button type="button" onClick={() => toggleSort(sortKey)} className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200">
          {label}
          <span aria-hidden className={cn('text-[8px]', sort === sortKey ? 'text-teal-600 dark:text-teal-300' : 'text-slate-300 dark:text-slate-600')}>
            {sort === sortKey ? (order === 'asc' ? '▲' : '▼') : '▲▼'}
          </span>
        </button>
      ) : label}
    </th>
  );

  return (
    <div className="space-y-3">
      <SectionCard
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <GhostButton onClick={() => setShowColumns((value) => !value)} aria-expanded={showColumns}>
              <Columns3 className="h-3.5 w-3.5" /> Columns
            </GhostButton>
            <GhostButton onClick={() => void exportCsv()}><Download className="h-3.5 w-3.5" /> Export CSV</GhostButton>
            <GhostButton onClick={() => void load()} disabled={loading}><RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh</GhostButton>
          </div>
        }
      >
        {showColumns && (
          <div className="mt-3 flex flex-wrap gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
            {COLUMNS.map((column) => (
              <label key={column.id} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  checked={visible.includes(column.id)}
                  disabled={'always' in column && column.always}
                  onChange={(event) => {
                    setVisible((current) => (event.target.checked
                      ? [...current, column.id]
                      : current.filter((id) => id !== column.id)));
                  }}
                />
                {column.label}
              </label>
            ))}
          </div>
        )}

        <FilterToolbar className="mt-3">
          <div className="min-w-[200px] flex-1">
            <SearchInput value={search} onValueChange={setSearch} placeholder="Search name, email, phone or employee ID…" />
          </div>
          <select aria-label="Filter by role" className={cn(inputClass, 'w-auto')} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>)}
          </select>
          <select aria-label="Filter by company" className={cn(inputClass, 'w-auto')} value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">All companies</option>
            {COMPANY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select aria-label="Filter by branch" className={cn(inputClass, 'w-auto')} value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">All branches</option>
            {branchOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select aria-label="Filter by department" className={cn(inputClass, 'w-auto')} value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
          {!lockStatus && (
            <select aria-label="Filter by status" className={cn(inputClass, 'w-auto')} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          )}
          {(role || company || branch || department || status || debounced) && (
            <GhostButton onClick={() => { setSearch(''); setRole(''); setCompany(''); setBranch(''); setDepartment(''); if (!lockStatus) setStatus(''); }}>
              <Filter className="h-3.5 w-3.5" /> Clear
            </GhostButton>
          )}
        </FilterToolbar>

        {error && <div className="mt-3"><ErrorState message={error} onRetry={() => void load()} /></div>}

        {selected.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-500/5 px-3 py-2">
            <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">{selected.length} selected</span>
            <GhostButton onClick={() => setBulk({ action: 'activate', label: 'Activate' })}><UserCheck className="h-3.5 w-3.5" /> Activate</GhostButton>
            <GhostButton onClick={() => setBulk({ action: 'suspend', label: 'Suspend' })}><ShieldOff className="h-3.5 w-3.5" /> Suspend</GhostButton>
            <GhostButton onClick={() => setBulk({ action: 'deactivate', label: 'Deactivate' })}><UserX className="h-3.5 w-3.5" /> Deactivate</GhostButton>
            <GhostButton onClick={() => setSelected([])}>Clear selection</GhostButton>
          </div>
        )}

        {loading && !data ? (
          <div className="mt-3"><LoadingSkeleton rows={6} /></div>
        ) : rows.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No users match these filters"
              description="Adjust or clear the filters to see more accounts."
              action={<GhostButton onClick={() => { setSearch(''); setRole(''); setCompany(''); setBranch(''); setDepartment(''); setStatus(initialStatus || ''); }}>Clear filters</GhostButton>}
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10">
                  <th scope="col" className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Select every row on this page"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      checked={allSelected}
                      onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])}
                    />
                  </th>
                  {header('user', 'User', 'name')}
                  {visible.includes('role') && header('role', 'Role', 'role')}
                  {visible.includes('company') && header('company', 'Company')}
                  {visible.includes('branch') && header('branch', 'Branch', 'branch')}
                  {visible.includes('department') && header('department', 'Department')}
                  {visible.includes('status') && header('status', 'Status')}
                  {visible.includes('lastLogin') && header('lastLogin', 'Last sign-in', 'lastLogin')}
                  {visible.includes('sessions') && header('sessions', 'Sessions')}
                  {visible.includes('records') && header('records', 'Records')}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const checked = selected.includes(row.id);
                  return (
                    <tr key={row.id} className={cn('border-b border-slate-100 last:border-0 dark:border-white/5', checked && 'bg-teal-500/5')}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.fullName}`}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          checked={checked}
                          onChange={(event) => setSelected((current) => (event.target.checked
                            ? [...current, row.id]
                            : current.filter((id) => id !== row.id)))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => setDetailId(row.id)} className="group text-left">
                          <span className="block max-w-[220px] truncate text-xs font-semibold text-slate-900 group-hover:text-teal-700 dark:text-slate-100 dark:group-hover:text-teal-300">
                            {row.fullName}
                          </span>
                          <span className="block max-w-[220px] truncate text-[11px] text-slate-500 dark:text-slate-400">{row.email}</span>
                        </button>
                      </td>
                      {visible.includes('role') && <td className="px-3 py-2"><RoleBadge role={row.role} label={row.roleLabel} /></td>}
                      {visible.includes('company') && <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.company || '—'}</td>}
                      {visible.includes('branch') && <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.branch || '—'}</td>}
                      {visible.includes('department') && <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.departmentName || '—'}</td>}
                      {visible.includes('status') && <td className="px-3 py-2"><UserStatusBadge status={row.status} /></td>}
                      {visible.includes('lastLogin') && (
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300" title={formatWhen(row.lastLoginAt)}>{timeAgo(row.lastLoginAt)}</td>
                      )}
                      {visible.includes('sessions') && <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.activeSessions}</td>}
                      {visible.includes('records') && (
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.leadCount + row.marketingCount}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-white/10">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {data ? `${data.total.toLocaleString()} account${data.total === 1 ? '' : 's'} · page ${data.page} of ${data.pages}` : 'Loading…'}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500 dark:text-slate-400">
              Rows
              <select className={cn(inputClass, 'ml-1 w-auto')} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <GhostButton disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</GhostButton>
            <GhostButton disabled={loading || !data || page >= data.pages} onClick={() => setPage((value) => value + 1)}>Next</GhostButton>
          </div>
        </div>
        {error && <ErrorNote message={null} />}
      </SectionCard>

      <UserDetailDrawer
        userId={detailId}
        departments={departments}
        onClose={() => setDetailId(null)}
        onChanged={() => { void load(); onDataChanged(); }}
        onNotify={onNotify}
      />

      <ConfirmDialog
        open={Boolean(bulk)}
        title={`${bulk?.label || ''} ${selected.length} account${selected.length === 1 ? '' : 's'}?`}
        description={
          bulk?.action === 'activate'
            ? 'The selected accounts become able to sign in again.'
            : 'Sign-in is blocked and every active session is revoked. Assigned records are preserved and can be reassigned.'
        }
        confirmLabel={bulk?.label || 'Confirm'}
        destructive={bulk?.action !== 'activate'}
        onCancel={() => setBulk(null)}
        onConfirm={() => { const current = bulk; setBulk(null); if (current) void runBulk(); }}
      />
      {busy && <p className="text-[11px] text-slate-500 dark:text-slate-400">Applying bulk action…</p>}
    </div>
  );
};
