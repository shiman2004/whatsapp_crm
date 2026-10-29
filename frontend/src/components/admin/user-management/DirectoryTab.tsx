import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Columns3, Download, RefreshCw, ShieldOff, UserCheck, UserX, Search, Shield, Building2, MapPin, FolderTree, Activity, ExternalLink, X } from 'lucide-react';
import { ConfirmDialog, EmptyState, ErrorState, LoadingSkeleton, SectionCard, cn } from '../../ui';
import { userManagementApi, ROLE_OPTIONS, COMPANY_OPTIONS, type Department, type ManagedUser, type Page } from './api';
import { GhostButton, RoleBadge, CompanyBadge, BranchBadge, UserStatusBadge, formatWhen, timeAgo } from './bits';
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

const TH = 'sticky top-0 z-10 bg-slate-50 dark:bg-[#111B21]';

const FilterSelect: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (value: string) => void;
  width?: string;
  children: React.ReactNode;
}> = ({ icon: Icon, label, value, onChange, width = 'w-32', children }) => (
  <div className={cn(
    'flex h-9 shrink-0 items-center gap-1.5 rounded-lg border bg-white pl-2 pr-1 transition-colors dark:bg-[#202C33]',
    width,
    value ? 'border-teal-500/50 dark:border-teal-500/40' : 'border-slate-200 dark:border-[#222D34]',
  )}>
    <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-400" />
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-full w-full min-w-0 cursor-pointer truncate bg-transparent pr-1 text-xs text-slate-700 outline-none dark:text-slate-300"
    >
      {children}
    </select>
  </div>
);

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

  useEffect(() => {
    if (!showColumns) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setShowColumns(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [showColumns]);

  const activeFiltersCount = Number(Boolean(role)) + Number(Boolean(company)) + Number(Boolean(branch)) + Number(Boolean(department)) + Number(Boolean(!lockStatus && status)) + Number(Boolean(debounced));

  const clearFilters = () => {
    setSearch('');
    setRole('');
    setCompany('');
    setBranch('');
    setDepartment('');
    if (!lockStatus) setStatus('');
  };

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
    <th key={id} scope="col" className={cn(TH, 'whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400')}>
      {sortKey ? (
        <button type="button" onClick={() => toggleSort(sortKey)} className="inline-flex items-center gap-1 transition-colors hover:text-slate-800 dark:hover:text-slate-100">
          <span>{label}</span>
          <span aria-hidden className={cn('text-[9px]', sort === sortKey ? 'font-bold text-teal-600 dark:text-teal-400' : 'text-slate-300 dark:text-slate-600')}>
            {sort === sortKey ? (order === 'asc' ? '▲' : '▼') : '▲▼'}
          </span>
        </button>
      ) : label}
    </th>
  );

  return (
    <div className="space-y-4">
      <SectionCard
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <GhostButton onClick={() => setShowColumns((value) => !value)} aria-expanded={showColumns} aria-haspopup="true">
                <Columns3 className="h-3.5 w-3.5" /> Columns
              </GhostButton>
              {showColumns && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowColumns(false)} aria-hidden />
                  <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-[#222D34] dark:bg-[#202C33]">
                    {COLUMNS.map((column) => (
                      <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#2A3942]">
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
                </>
              )}
            </div>
            <GhostButton onClick={() => void exportCsv()}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </GhostButton>
            <GhostButton onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
            </GhostButton>
          </div>
        }
      >
        {/* Toolbar: search + filters on one line, clear chip pushed right */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-[#222D34]/70">
          <div className="relative w-full sm:w-48 xl:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, phone or ID…"
              aria-label="Search staff"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none dark:border-[#222D34] dark:bg-[#202C33] dark:text-slate-100"
            />
          </div>

          <FilterSelect icon={Shield} label="Filter by role" value={role} onChange={setRole} width="w-40">
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>
            ))}
          </FilterSelect>

          <FilterSelect icon={Building2} label="Filter by company" value={company} onChange={setCompany}>
            <option value="">All companies</option>
            {COMPANY_OPTIONS.filter((option) => option !== 'ALL').map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </FilterSelect>

          <FilterSelect icon={MapPin} label="Filter by branch" value={branch} onChange={setBranch}>
            <option value="">All branches</option>
            {branchOptions.filter((option) => option.toUpperCase() !== 'ALL').map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </FilterSelect>

          <FilterSelect icon={FolderTree} label="Filter by department" value={department} onChange={setDepartment}>
            <option value="">All departments</option>
            {departments.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </FilterSelect>

          {!lockStatus && (
            <FilterSelect icon={Activity} label="Filter by status" value={status} onChange={setStatus}>
              <option value="">All statuses</option>
              {STATUSES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </FilterSelect>
          )}

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-500/10 dark:text-teal-300"
            >
              <X className="h-3.5 w-3.5" />
              Clear {activeFiltersCount} filter{activeFiltersCount === 1 ? '' : 's'}
            </button>
          )}
        </div>

        {error && <div className="mt-3"><ErrorState message={error} onRetry={() => void load()} /></div>}

        {selected.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-2.5 shadow-sm animate-in fade-in duration-150">
            <span className="text-xs font-bold text-teal-800 dark:text-teal-200">{selected.length} account{selected.length === 1 ? '' : 's'} selected</span>
            <div className="h-4 w-px bg-teal-500/30" />
            <GhostButton onClick={() => setBulk({ action: 'activate', label: 'Activate' })} className="border-teal-500/40 text-teal-700 dark:text-teal-300">
              <UserCheck className="h-3.5 w-3.5" /> Activate
            </GhostButton>
            <GhostButton onClick={() => setBulk({ action: 'suspend', label: 'Suspend' })} className="border-amber-500/40 text-amber-700 dark:text-amber-300">
              <ShieldOff className="h-3.5 w-3.5" /> Suspend
            </GhostButton>
            <GhostButton onClick={() => setBulk({ action: 'deactivate', label: 'Deactivate' })} className="border-rose-500/40 text-rose-700 dark:text-rose-300">
              <UserX className="h-3.5 w-3.5" /> Deactivate
            </GhostButton>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
            >
              Deselect all
            </button>
          </div>
        )}

        {loading && !data ? (
          <div className="mt-4"><LoadingSkeleton rows={6} /></div>
        ) : rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No staff accounts match these filters"
              description="Adjust the search query, company or role filters to display accounts."
              action={<GhostButton onClick={clearFilters}>Reset all filters</GhostButton>}
            />
          </div>
        ) : (
          <div className="mt-3 max-h-[70vh] overflow-auto rounded-xl border border-slate-200 shadow-sm dark:border-[#222D34]">
            <table className="w-full border-collapse bg-white text-left text-xs dark:bg-[#202C33]">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr>
                  <th scope="col" className={cn(TH, 'w-10 border-b border-slate-200 px-3 py-2.5 text-center dark:border-[#222D34]')}>
                    <input
                      type="checkbox"
                      aria-label="Select every row on this page"
                      className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      checked={allSelected}
                      onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])}
                    />
                  </th>
                  {header('user', 'Staff Member', 'name')}
                  {visible.includes('role') && header('role', 'Role', 'role')}
                  {visible.includes('company') && header('company', 'Company Scope')}
                  {visible.includes('branch') && header('branch', 'Branch', 'branch')}
                  {visible.includes('department') && header('department', 'Department')}
                  {visible.includes('status') && header('status', 'Account Status')}
                  {visible.includes('lastLogin') && header('lastLogin', 'Last Sign-in', 'lastLogin')}
                  {visible.includes('sessions') && header('sessions', 'Active Devices')}
                  {visible.includes('records') && header('records', 'Records Owned')}
                  <th scope="col" className={cn(TH, 'w-16 border-b border-slate-200 px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-slate-400 dark:border-[#222D34]')}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#222D34]/80">
                {rows.map((row) => {
                  const checked = selected.includes(row.id);
                  const isSuper = row.role === 'super_admin';
                  const initials = row.fullName.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'U';

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setDetailId(row.id)}
                      className={cn(
                        'group transition-colors cursor-pointer',
                        checked
                          ? 'bg-teal-500/10'
                          : isSuper
                          ? 'bg-rose-500/[0.02] hover:bg-slate-50 dark:hover:bg-[#2A3942]/70'
                          : 'hover:bg-slate-50 dark:hover:bg-[#2A3942]/60'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.fullName}`}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          checked={checked}
                          onChange={(event) => setSelected((current) => (event.target.checked
                            ? [...current, row.id]
                            : current.filter((id) => id !== row.id)))}
                        />
                      </td>

                      {/* User Info with Avatar & Employee ID */}
                      <td className="px-4 py-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn(
                            'size-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border',
                            isSuper
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                              : 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30'
                          )}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate text-xs font-bold text-slate-900 group-hover:text-teal-700 dark:text-slate-100 dark:group-hover:text-teal-300">
                              {row.fullName}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                              <span>{row.email}</span>
                              {row.employeeId && (
                                <>
                                  <span>•</span>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500">ID: {row.employeeId}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      {visible.includes('role') && (
                        <td className="px-4 py-1.5 whitespace-nowrap">
                          <RoleBadge role={row.role} label={row.roleLabel} />
                        </td>
                      )}

                      {/* Company Badge */}
                      {visible.includes('company') && (
                        <td className="px-4 py-1.5 whitespace-nowrap">
                          <CompanyBadge company={row.company} />
                        </td>
                      )}

                      {/* Branch Badge */}
                      {visible.includes('branch') && (
                        <td className="px-4 py-1.5 whitespace-nowrap">
                          <BranchBadge branch={row.branch} />
                        </td>
                      )}

                      {/* Department */}
                      {visible.includes('department') && (
                        <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {row.departmentName || <span className="text-slate-400">—</span>}
                        </td>
                      )}

                      {/* Status */}
                      {visible.includes('status') && (
                        <td className="px-4 py-1.5 whitespace-nowrap">
                          <UserStatusBadge status={row.status} />
                        </td>
                      )}

                      {/* Last Login */}
                      {visible.includes('lastLogin') && (
                        <td className="px-4 py-1.5 text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono text-[11px] tabular-nums" title={formatWhen(row.lastLoginAt)}>
                          {timeAgo(row.lastLoginAt)}
                        </td>
                      )}

                      {/* Active Sessions */}
                      {visible.includes('sessions') && (
                        <td className="px-4 py-1.5 whitespace-nowrap">
                          {row.activeSessions > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              {row.activeSessions} device{row.activeSessions === 1 ? '' : 's'}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">0</span>
                          )}
                        </td>
                      )}

                      {/* Records */}
                      {visible.includes('records') && (
                        <td className="px-4 py-1.5 whitespace-nowrap font-mono text-[11px] text-slate-700 dark:text-slate-300 tabular-nums">
                          {row.leadCount + row.marketingCount > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-[#111B21] border border-slate-200 dark:border-[#222D34] font-bold text-slate-800 dark:text-slate-200">
                              {row.leadCount + row.marketingCount}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                      )}

                      {/* Quick Action Button */}
                      <td className="px-3 py-1.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          aria-label={`View user details for ${row.fullName}`}
                          onClick={() => setDetailId(row.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-teal-600 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-[#2A3942] transition-colors"
                          title="View user details & permissions"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Polished Pagination Footer */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-[#222D34]">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
            {data ? `Showing ${((data.page - 1) * data.pageSize) + (data.items.length ? 1 : 0)} – ${Math.min(data.page * data.pageSize, data.total)} of ${data.total.toLocaleString()} account${data.total === 1 ? '' : 's'}` : 'Loading…'}
          </p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>Per page:</span>
              <select
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none dark:border-[#222D34] dark:bg-[#202C33] dark:text-slate-100 cursor-pointer"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <GhostButton disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Previous
            </GhostButton>
            <GhostButton disabled={loading || !data || page >= data.pages} onClick={() => setPage((value) => value + 1)}>
              Next
            </GhostButton>
          </div>
        </div>
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
      {busy && <p className="text-xs text-slate-500 dark:text-slate-400">Applying bulk action…</p>}
    </div>
  );
};
