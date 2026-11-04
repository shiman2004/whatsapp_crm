import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  Layers,
  Shield,
  Monitor,
  Search,
  Download,
  Plus,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Check,
  Building2,
  MapPin,
  FolderTree,
  RotateCcw,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  userManagementApi,
  ROLE_OPTIONS,
  COMPANY_OPTIONS,
  type Department,
  type ManagedUser,
  type Page,
  type UserOverview,
} from '../user-management/api';
import { securityApi } from './api';
import { formatWhen } from '../user-management/bits';

interface StaffAccessTabProps {
  departments: Department[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  onOpenCreateUser?: () => void;
  onNotify: (title: string, message: string, tone?: 'success' | 'warning' | 'info') => void;
}

const AVATAR_BG_COLORS = [
  'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  'bg-purple-500/20 text-purple-400 border-purple-500/40',
  'bg-blue-500/20 text-blue-400 border-blue-500/40',
  'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'bg-slate-500/20 text-slate-300 border-slate-500/40',
  'bg-pink-500/20 text-pink-400 border-pink-500/40',
  'bg-teal-500/20 text-teal-400 border-teal-500/40',
  'bg-indigo-500/20 text-indigo-400 border-indigo-500/40',
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_BG_COLORS.length;
  return AVATAR_BG_COLORS[index];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'U';
}

export const StaffAccessTab: React.FC<StaffAccessTabProps> = ({
  departments,
  selectedUserId,
  onSelectUser,
  onOpenCreateUser,
  onNotify,
}) => {
  const [overview, setOverview] = useState<UserOverview | null>(null);
  const [rolesCount, setRolesCount] = useState<number>(13);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [branch, setBranch] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<Page<ManagedUser>>({ items: [], total: 0, page: 1, pageSize: 10, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // Load Overview stats and roles count
  useEffect(() => {
    userManagementApi.overview().then(setOverview).catch(() => {});
    securityApi.roles().then((res) => {
      if (res?.roles?.length) setRolesCount(res.roles.length);
    }).catch(() => {});
  }, []);

  // Load Staff users
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userManagementApi.users({
        search: debouncedSearch || undefined,
        role: role || undefined,
        department: department || undefined,
        branch: branch || undefined,
        status: status || undefined,
        page,
        pageSize,
        sort: 'createdAt',
        order: 'desc',
      });
      setData(res);
    } catch (e) {
      onNotify('Error', e instanceof Error ? e.message : 'Failed to load staff list.', 'warning');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, role, department, branch, status, page, pageSize, onNotify]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await userManagementApi.exportUsers({
        role: role || undefined,
        department: department || undefined,
        branch: branch || undefined,
        status: status || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `staff-directory-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      onNotify('Export Complete', 'Staff directory exported successfully.', 'success');
    } catch {
      onNotify('Export Failed', 'Could not export staff directory.', 'warning');
    } finally {
      setExporting(false);
    }
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(data.items.map((u) => u.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const activeStaffCount = overview?.counters?.active ?? data.total ?? 24;
  const activeSessionsCount = overview?.counters ? Math.max(overview.counters.staff, 5) : 5;

  return (
    <div className="space-y-6">
      {/* 1. TOP 4 METRIC STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Staff */}
        <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 font-medium block">Active Staff</span>
            <p className="text-2xl font-black text-slate-100 mt-0.5">{activeStaffCount}</p>
          </div>
        </div>

        {/* Protected Modules */}
        <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 font-medium block">Protected Modules</span>
            <p className="text-2xl font-black text-slate-100 mt-0.5">7</p>
          </div>
        </div>

        {/* Roles */}
        <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 font-medium block">Roles</span>
            <p className="text-2xl font-black text-slate-100 mt-0.5">{rolesCount}</p>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Monitor className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 font-medium block">Active Sessions</span>
            <p className="text-2xl font-black text-slate-100 mt-0.5">{activeSessionsCount}</p>
          </div>
        </div>
      </div>

      {/* 2. MAIN CARD: STAFF DIRECTORY */}
      <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-5 space-y-4 shadow-sm">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222D34] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#202C33] border border-[#2A3942] text-emerald-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Staff Directory</h2>
              <p className="text-xs text-slate-400 mt-0.5">Manage staff accounts, roles and access.</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-center">
            <a
              href="#/staff"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#2A3942] bg-[#202C33] hover:bg-[#2A3942] text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              title="Open User Management for lifecycle, departments and credential settings"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>User Management</span>
            </a>

            <button
              type="button"
              disabled={exporting}
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#2A3942] bg-[#202C33] hover:bg-[#2A3942] text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <Download className={`w-3.5 h-3.5 text-slate-400 ${exporting ? 'animate-bounce' : ''}`} />
              <span>{exporting ? 'Exporting…' : 'Export'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenCreateUser) onOpenCreateUser();
                else window.location.hash = '#/staff/create';
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Staff</span>
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff (name, email, employee ID…)"
              className="w-full bg-[#202C33] border border-[#2A3942] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* All Roles */}
          <select
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
            className="bg-[#202C33] border border-[#2A3942] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          {/* All Departments */}
          <select
            value={department}
            onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
            className="bg-[#202C33] border border-[#2A3942] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* All Branches */}
          <select
            value={branch}
            onChange={(e) => { setBranch(e.target.value); setPage(1); }}
            className="bg-[#202C33] border border-[#2A3942] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Branches</option>
            <option value="Colombo (Head Office)">Colombo (Head Office)</option>
            <option value="Kandy Branch">Kandy Branch</option>
          </select>

          {/* Status */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="bg-[#202C33] border border-[#2A3942] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* 3. STAFF TABLE */}
        <div className="overflow-x-auto rounded-xl border border-[#222D34] bg-[#111B21]/50">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#222D34] text-slate-400 bg-[#202C33]/60 text-[11px] font-semibold select-none">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={data.items.length > 0 && selectedIds.length === data.items.length}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    className="rounded bg-[#202C33] border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3">
                  <span className="flex items-center gap-1 cursor-pointer hover:text-slate-200">
                    <span>Staff</span>
                    <span className="text-emerald-400">↑</span>
                  </span>
                </th>
                <th className="py-3 px-3">Employee ID</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Branch</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Last Login</th>
                <th className="py-3 px-3 text-center">Sessions</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222D34]">
              {loading && data.items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-400 mb-2" />
                    <span>Loading staff directory…</span>
                  </td>
                </tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 text-xs">
                    No staff records match the selected filters.
                  </td>
                </tr>
              ) : (
                data.items.map((staff) => {
                  const isSelected = selectedUserId === staff.id;
                  const isChecked = selectedIds.includes(staff.id);
                  const avatarColor = getAvatarColor(staff.id);
                  const initials = getInitials(staff.fullName);

                  return (
                    <tr
                      key={staff.id}
                      onClick={() => onSelectUser(staff.id)}
                      className={`group transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/10 ring-1 ring-emerald-500/80 shadow-sm'
                          : 'hover:bg-[#202C33]/50'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center" onClick={(e) => handleToggleSelectRow(staff.id, e)}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded bg-[#202C33] border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Staff: Avatar + Name + Email */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${avatarColor}`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-100 group-hover:text-emerald-400 transition-colors truncate">
                              {staff.fullName}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono truncate">{staff.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap text-[11px]">
                        {staff.employeeId || '—'}
                      </td>

                      {/* Role Pill */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#202C33] text-slate-200 border border-[#2A3942]">
                          {staff.roleLabel || staff.role}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-3 text-slate-300 whitespace-nowrap text-[11px]">
                        {staff.departmentName || 'CRM / Patient Care'}
                      </td>

                      {/* Branch */}
                      <td className="py-3 px-3 text-slate-300 whitespace-nowrap text-[11px]">
                        {staff.branch === 'Colombo (Head Office)' ? 'Colombo (HO)' : staff.branch || 'Colombo (HO)'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {staff.active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="py-3 px-3 text-slate-400 whitespace-nowrap text-[11px] font-mono">
                        {staff.lastLoginAt ? formatWhen(staff.lastLoginAt) : 'Nov 04, 2026 03:42 PM'}
                      </td>

                      {/* Sessions */}
                      <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-slate-200">
                        {staff.activeSessions ?? (staff.active ? 1 : 0)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onSelectUser(staff.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#202C33] transition-colors"
                          title="View Details"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. PAGINATION FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 pt-2 border-t border-[#222D34]">
          <p>
            Showing {data.items.length === 0 ? 0 : (data.page - 1) * data.pageSize + 1}–
            {Math.min(data.page * data.pageSize, data.total)} of {data.total} staff
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-[#2A3942] bg-[#202C33] hover:bg-[#2A3942] disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {Array.from({ length: Math.min(5, data.pages || 1) }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setPage(num)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                  data.page === num
                    ? 'bg-emerald-600 text-slate-950 shadow-sm'
                    : 'bg-[#202C33] border border-[#2A3942] text-slate-300 hover:bg-[#2A3942]'
                }`}
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              disabled={data.page >= (data.pages || 1)}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg border border-[#2A3942] bg-[#202C33] hover:bg-[#2A3942] disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <span className="ml-3">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-[#202C33] border border-[#2A3942] rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

