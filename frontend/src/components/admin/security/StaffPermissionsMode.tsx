import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Search,
  ShieldCheck,
  RotateCcw,
  Check,
  X,
  Info,
  RefreshCw,
  Building2,
  MapPin,
  FolderTree,
  User,
  MessageSquare,
  Activity,
  FileText,
  GraduationCap,
  Megaphone,
} from 'lucide-react';
import { securityApi, SecurityApiError } from './api';
import { userManagementApi, type ManagedUser } from '../user-management/api';
import type { UserDetail as SecurityUserDetail } from './types';

const MODULES = [
  { id: 'crm', label: 'CRM & Leads', icon: MessageSquare, description: 'Contacts, leads and patient coordinator workflows' },
  { id: 'clinical', label: 'Clinical', icon: Activity, description: 'Patient assessments, clinical notes and doctor review' },
  { id: 'reports', label: 'Reports', icon: FileText, description: 'Analytics dashboards and reporting exports' },
  { id: 'staff', label: 'User & Staff', icon: Users, description: 'Staff directory and security administration' },
  { id: 'exam', label: 'Academic Exams', icon: GraduationCap, description: 'Exam operations, study materials and mock tests' },
  { id: 'whatsapp', label: 'WhatsApp', icon: Megaphone, description: 'Direct messaging and marketing broadcasts' },
];

export const StaffPermissionsMode: React.FC = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [secDetail, setSecDetail] = useState<any | null>(null);
  const [draft, setDraft] = useState<Record<string, 'inherit' | 'allow' | 'deny'>>({});
  const [reason, setReason] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load staff list
  useEffect(() => {
    userManagementApi
      .users({ pageSize: 100, status: 'active', sort: 'name', order: 'asc' })
      .then((res) => {
        setUsers(res.items);
        if (res.items.length > 0 && !selectedUserId) {
          setSelectedUserId(res.items[0].id);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingUsers(false));
  }, []);

  // Load selected staff security profile
  const loadStaffSecurity = useCallback(async (uid: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const data = await securityApi.user(uid);
      setSecDetail(data);

      const d: Record<string, 'inherit' | 'allow' | 'deny'> = {};
      if (data.overrides) {
        for (const [k, v] of Object.entries(data.overrides)) {
          d[k] = (v as any).effect;
        }
      }
      setDraft(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load staff permissions.');
      setSecDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      setNotice(null);
      void loadStaffSecurity(selectedUserId);
    }
  }, [selectedUserId, loadStaffSecurity]);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const getModuleOverrideValue = (modId: string): 'inherit' | 'allow' | 'deny' => {
    const targetId = modId === 'whatsapp' ? 'crm' : modId;
    const targetMod = secDetail?.modules?.find((m: any) => m.id === targetId);
    if (!targetMod) return 'inherit';
    const caps = targetMod.capabilities.filter((c: any) => !c.immutable);
    if (caps.length === 0) return 'inherit';

    const allAllow = caps.every((c: any) => draft[c.key] === 'allow');
    const allDeny = caps.every((c: any) => draft[c.key] === 'deny');
    if (allAllow) return 'allow';
    if (allDeny) return 'deny';
    return 'inherit';
  };

  const getModuleRoleDefault = (modId: string): boolean => {
    if (!selectedUser) return false;
    if (modId === 'whatsapp') {
      const allowedRoles = ['super_admin', 'coordinator', 'sales_coordinator', 'leads_officer', 'marketing_admin', 'marketing_officer'];
      return allowedRoles.includes(selectedUser.role);
    }
    const targetMod = secDetail?.modules?.find((m: any) => m.id === modId);
    if (!targetMod) return false;
    return targetMod.capabilities.some((c: any) => secDetail?.policy?.capabilities?.[c.key]?.allowed);
  };

  const handleModuleDropdownChange = (modId: string, val: string) => {
    const targetId = modId === 'whatsapp' ? 'crm' : modId;
    const targetMod = secDetail?.modules?.find((m: any) => m.id === targetId);
    if (!targetMod) return;
    const caps = targetMod.capabilities.filter((c: any) => !c.immutable);
    const nextDraft = { ...draft };
    caps.forEach((c: any) => {
      if (val === 'inherit') {
        delete nextDraft[c.key];
      } else {
        nextDraft[c.key] = val as 'allow' | 'deny';
      }
    });
    setDraft(nextDraft);
  };

  const handleSave = async () => {
    if (!selectedUserId || !secDetail) return;
    setSaving(true);
    setError(null);
    try {
      const overrides: Record<string, { effect: 'allow' | 'deny' }> = {};
      for (const [k, v] of Object.entries(draft)) {
        if (v === 'allow' || v === 'deny') {
          overrides[k] = { effect: v };
        }
      }
      await securityApi.updateUser(selectedUserId, {
        overrides,
        expectedRevision: secDetail.revision,
        reason: reason.trim() || undefined,
      });
      setNotice(`Access permissions saved for ${selectedUser?.fullName || 'staff member'}.`);
      await loadStaffSecurity(selectedUserId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save permissions.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedUserId || !secDetail) return;
    setSaving(true);
    setError(null);
    try {
      await securityApi.resetUser(selectedUserId, secDetail.revision, reason.trim() || undefined);
      setNotice(`Permissions restored to role defaults for ${selectedUser?.fullName || 'staff member'}.`);
      await loadStaffSecurity(selectedUserId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset permissions.');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.employeeId && u.employeeId.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] gap-5">
      {/* Left Column: Staff Selector */}
      <div className="space-y-3">
        <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Select Staff Member</span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff…"
              className="w-full bg-[#202C33] border border-[#2A3942] rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="max-h-[460px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {loadingUsers ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto text-emerald-400 mb-2" />
                <span>Loading staff list…</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No staff found</p>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedUserId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                        : 'bg-[#202C33]/60 border-transparent hover:bg-[#202C33] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs truncate">{u.fullName}</span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">{u.employeeId || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-slate-400">
                      <span className="truncate">{u.roleLabel || u.role}</span>
                      <span className="text-[10px] text-emerald-400/80">{u.company || 'RWC'}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Staff Permission & Module Overrides */}
      <div className="space-y-4">
        {selectedUser && (
          <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-5 space-y-4 shadow-sm">
            {/* Header: Staff Metadata */}
            <div className="flex items-center justify-between border-b border-[#222D34] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-sm">
                  {selectedUser.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{selectedUser.fullName}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedUser.email} {selectedUser.employeeId ? `• ${selectedUser.employeeId}` : ''}
                  </p>
                </div>
              </div>

              {secDetail && (
                <span className="text-[10px] font-mono text-slate-400 bg-[#202C33] px-2.5 py-1 rounded-lg border border-[#2A3942]">
                  Policy v{secDetail.revision}
                </span>
              )}
            </div>

            {/* 4 Metadata Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#202C33] border border-[#2A3942] rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Current Role</span>
                </div>
                <p className="font-bold text-slate-100 mt-0.5 truncate">{selectedUser.roleLabel || selectedUser.role}</p>
              </div>

              <div className="bg-[#202C33] border border-[#2A3942] rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Building2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>Company</span>
                </div>
                <p className="font-bold text-teal-300 mt-0.5 truncate">{selectedUser.company || 'RWC'}</p>
              </div>

              <div className="bg-[#202C33] border border-[#2A3942] rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Branch</span>
                </div>
                <p className="font-bold text-slate-200 mt-0.5 truncate">{selectedUser.branch || 'Colombo (Head Office)'}</p>
              </div>

              <div className="bg-[#202C33] border border-[#2A3942] rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Department</span>
                </div>
                <p className="font-bold text-slate-200 mt-0.5 truncate">{selectedUser.departmentName || 'CRM / Patient Care'}</p>
              </div>
            </div>

            {/* Feedback Notifications */}
            {notice && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{notice}</span>
              </div>
            )}
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <X className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Module Permissions Matrix */}
            <div className="overflow-hidden rounded-xl border border-[#222D34] bg-[#111B21]/50">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#222D34] text-slate-400 bg-[#202C33]/60 text-[11px] font-semibold">
                    <th className="py-2.5 px-3">Module</th>
                    <th className="py-2.5 px-3 text-center">Inherited Role Permission</th>
                    <th className="py-2.5 px-3 text-center">Individual Override</th>
                    <th className="py-2.5 px-3 text-center">Effective Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222D34]">
                  {MODULES.map((mod) => {
                    const Icon = mod.icon;
                    const overrideVal = getModuleOverrideValue(mod.id);
                    const roleDefault = getModuleRoleDefault(mod.id);
                    const effectiveAccess = overrideVal === 'allow' ? true : overrideVal === 'deny' ? false : roleDefault;

                    return (
                      <tr key={mod.id} className="hover:bg-[#202C33]/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#202C33] border border-[#2A3942] text-emerald-400 flex items-center justify-center shrink-0">
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="font-bold text-slate-100 block">{mod.label}</span>
                              <span className="text-[10px] text-slate-400 line-clamp-1">{mod.description}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {roleDefault ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                              <Check className="w-3 h-3" /> Allow
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20">
                              <X className="w-3 h-3" /> Block
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <select
                            value={overrideVal}
                            onChange={(e) => handleModuleDropdownChange(mod.id, e.target.value)}
                            className={`px-3 py-1 rounded-xl text-xs font-semibold focus:outline-none transition-all cursor-pointer ${
                              overrideVal === 'allow'
                                ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300 font-bold'
                                : overrideVal === 'deny'
                                ? 'bg-rose-500/20 border border-rose-500 text-rose-300 font-bold'
                                : 'bg-[#202C33] border border-[#2A3942] text-slate-300'
                            }`}
                          >
                            <option value="inherit">Inherit Role</option>
                            <option value="allow">Allow</option>
                            <option value="deny">Block</option>
                          </select>
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {effectiveAccess ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30">
                              <Check className="w-3 h-3" /> Allow
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30">
                              <X className="w-3 h-3" /> Block
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Rationale & Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Audit rationale for overrides…"
                className="flex-1 bg-[#202C33] border border-[#2A3942] rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleReset}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-700 hover:bg-[#202C33] text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                  Reset to Role Defaults
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
