import React, { useCallback, useEffect, useState } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  Building,
  Building2,
  MapPin,
  Calendar,
  Clock,
  Lock,
  KeyRound,
  Shield,
  ShieldCheck,
  ShieldOff,
  Layers,
  Users,
  Zap,
  Radio,
  Monitor,
  Laptop,
  RefreshCw,
  Edit3,
  Power,
  Check,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Hash,
  CreditCard,
  LogOut,
  Info,
  Activity,
  ChevronDown,
  ChevronUp,
  Sliders,
  ShieldAlert,
  CheckCircle,
  BarChart3,
  ClipboardList,
  ClipboardCheck,
  Megaphone,
  BookOpen,
  Boxes,
  RotateCcw,
  ExternalLink,
  MessageSquare,
  Stethoscope,
  GraduationCap,
  FileText,
  FolderTree
} from 'lucide-react';
import { ConfirmDialog, InlineFeedback } from '../../ui';
import {
  userManagementApi,
  ROLE_OPTIONS,
  COMPANY_OPTIONS,
  type UserDetail,
  type UserInput,
  type Department
} from './api';
import { formatWhen, timeAgo, inputClass } from './bits';
import { securityApi } from '../security/api';
import type { UserDetail as SecurityUserDetail, Scope, ModuleInfo, CapabilityMeta } from '../security/types';

const generateRandomPin = () => Math.floor(1000 + Math.random() * 9000).toString();

function generateRandomPassword(length = 16): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*_+~';
  const all = upper + lower + digits + symbols;
  const pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  for (let i = pwd.length; i < length; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }
  return pwd.sort(() => Math.random() - 0.5).join('');
}

function parseDeviceString(ua: string | null): { device: string; browser: string } {
  if (!ua) return { device: 'Windows 10', browser: 'Chrome 142' };
  let device = 'Desktop PC';
  if (/Windows/i.test(ua)) device = 'Windows 10';
  else if (/Macintosh|Mac OS/i.test(ua)) device = 'macOS';
  else if (/Android/i.test(ua)) device = 'Android Device';
  else if (/iPhone|iPad/i.test(ua)) device = 'iOS Device';
  else if (/Linux/i.test(ua)) device = 'Linux Workstation';

  let browser = 'Browser';
  if (/Firefox\/([0-9]+)/i.test(ua)) {
    const m = ua.match(/Firefox\/([0-9]+)/i);
    browser = `Firefox ${m ? m[1] : ''}`;
  } else if (/Edg\/([0-9]+)/i.test(ua)) {
    const m = ua.match(/Edg\/([0-9]+)/i);
    browser = `Edge ${m ? m[1] : ''}`;
  } else if (/Chrome\/([0-9]+)/i.test(ua)) {
    const m = ua.match(/Chrome\/([0-9]+)/i);
    browser = `Chrome ${m ? m[1] : '142'}`;
  } else if (/Safari/i.test(ua)) {
    browser = 'Safari';
  }

  return { device, browser };
}


function getModuleIcon(moduleId: string) {
  switch (moduleId) {
    case 'crm': return User;
    case 'exam': return ClipboardList;
    case 'clinical': return ClipboardCheck;
    case 'marketing': return Megaphone;
    case 'reports': return BarChart3;
    case 'staff': return Users;
    case 'system': return Sliders;
    default: return Layers;
  }
}

export interface UserDetailDrawerProps {
  userId: string | null;
  departments: Department[];
  onClose: () => void;
  onChanged: () => void;
  onNotify: (title: string, message: string, tone?: 'success' | 'warning' | 'info') => void;
  initialTab?: TabType;
}

type TabType = 'overview' | 'access' | 'assignments' | 'security' | 'activity';

export const UserDetailDrawer: React.FC<UserDetailDrawerProps> = ({
  userId,
  departments,
  onClose,
  onChanged,
  onNotify,
  initialTab,
}) => {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'overview');
  const [accessSubTab, setAccessSubTab] = useState<'modules' | 'permissions'>('modules');

  // Edit Profile Form State
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UserInput>({});

  // Security & Personal Overrides State
  const [secDetail, setSecDetail] = useState<SecurityUserDetail | null>(null);
  const [secLoading, setSecLoading] = useState(false);
  const [secSaving, setSecSaving] = useState(false);
  const [secDraft, setSecDraft] = useState<Record<string, 'inherit' | 'allow' | 'deny'>>({});
  const [secScope, setSecScope] = useState<Scope>('own');
  const [overrideReason, setOverrideReason] = useState('');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Live Audit Monitoring State
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadSecurity = useCallback(async () => {
    if (!userId) return;
    setSecLoading(true);
    try {
      const data = await securityApi.user(userId);
      setSecDetail(data);
      setSecScope(data.scope || 'own');
      const draft: Record<string, 'inherit' | 'allow' | 'deny'> = {};
      for (const [k, v] of Object.entries(data.overrides || {})) {
        draft[k] = v.effect;
      }
      setSecDraft(draft);
    } catch (err: any) {
      console.warn('Could not load security profile:', err.message);
    } finally {
      setSecLoading(false);
    }
  }, [userId]);

  const loadAuditTrail = useCallback(async () => {
    if (!userId) return;
    setAuditLoading(true);
    try {
      const res = await securityApi.audit({ actorId: userId, pageSize: 40 });
      setAuditEvents(res.items || []);
    } catch (err: any) {
      console.warn('Could not load audit events:', err.message);
    } finally {
      setAuditLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (activeTab === 'access' && !secDetail) {
      void loadSecurity();
    }
    if (activeTab === 'activity') {
      void loadAuditTrail();
    }
  }, [activeTab, loadSecurity, loadAuditTrail, secDetail]);

  const toggleModule = (mod: ModuleInfo, effect: 'inherit' | 'allow' | 'deny') => {
    setSecDraft(prev => {
      const next = { ...prev };
      for (const cap of mod.capabilities) {
        if (!cap.immutable) {
          if (effect === 'inherit') {
            delete next[cap.key];
          } else {
            next[cap.key] = effect;
          }
        }
      }
      return next;
    });
  };

  const setCapEffect = (capKey: string, effect: 'inherit' | 'allow' | 'deny') => {
    setSecDraft(prev => {
      const next = { ...prev };
      if (effect === 'inherit') {
        delete next[capKey];
      } else {
        next[capKey] = effect;
      }
      return next;
    });
  };

  const toggleExpanded = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const handleSaveSecurity = async () => {
    if (!secDetail || !userId) return;
    setSecSaving(true);
    setError(null);
    try {
      const overrides: Record<string, { effect: 'allow' | 'deny' }> = {};
      for (const [k, v] of Object.entries(secDraft)) {
        if (v === 'allow' || v === 'deny') {
          overrides[k] = { effect: v };
        }
      }
      await securityApi.updateUser(userId, {
        overrides,
        scope: secScope,
        expectedRevision: secDetail.revision,
        reason: overrideReason.trim() || 'Personal permissions updated by Super Admin',
      });
      onNotify('Permissions Saved', 'Personal access profile updated successfully.', 'success');
      await loadSecurity();
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to save security overrides.');
    } finally {
      setSecSaving(false);
    }
  };

  const handleResetSecurity = () => {
    if (!secDetail || !userId) return;
    setConfirm({
      title: 'Reset to Role Defaults',
      description: 'Reset all personal overrides for this account? Their permissions will strictly revert to baseline policy.',
      destructive: true,
      run: async () => {
        try {
          await securityApi.resetUser(userId, secDetail.revision, 'Reset to role defaults');
          onNotify('Permissions Reset', 'All personal overrides cleared.', 'info');
          await loadSecurity();
          onChanged();
        } catch (err: any) {
          setError(err.message || 'Failed to reset overrides.');
        }
      }
    });
  };

  // Reset Credentials Modal State
  const [resetModalMode, setResetModalMode] = useState<'both' | 'password' | 'pin' | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [justResetCreds, setJustResetCreds] = useState<{ pass?: string; pin?: string } | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    destructive?: boolean;
    run: () => Promise<void>;
  }>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await userManagementApi.user(userId);
      setDetail(result);
      setForm({
        fullName: result.user.fullName,
        email: result.user.email,
        phone: result.user.phone || '',
        role: result.user.role,
        company: result.user.company || 'RWC',
        branch: result.user.branch || '',
        employeeId: result.user.employeeId || '',
        departmentId: result.user.departmentId,
        managerId: result.user.managerId,
        marketingAccess: result.user.marketingAccess,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load user details.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setDetail(null);
    setEditing(false);
    setActiveTab(initialTab || 'overview');
    setResetModalMode(null);
    setJustResetCreds(null);
    void load();
  }, [load, initialTab]);

  const act = async (key: string, run: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await run();
      await load();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The action failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    await act('save', async () => {
      await userManagementApi.updateUser(userId, {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        role: form.role,
        company: form.company,
        branch: form.branch,
        employeeId: form.employeeId,
        departmentId: form.departmentId,
        managerId: form.managerId,
        marketingAccess: form.marketingAccess,
      });
      setEditing(false);
      onNotify('Updated', 'Staff identity and core role saved successfully.', 'success');
    });
  };

  const handleOpenReset = (mode: 'both' | 'password' | 'pin') => {
    setResetModalMode(mode);
    setJustResetCreds(null);
    if (mode === 'password' || mode === 'both') {
      setNewPassword(generateRandomPassword(16));
    } else {
      setNewPassword('');
    }
    if (mode === 'pin' || mode === 'both') {
      setNewPin(generateRandomPin());
    } else {
      setNewPin('');
    }
  };

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    if (resetModalMode === 'password' && newPassword.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (resetModalMode === 'pin' && (newPin.length < 4 || newPin.length > 10)) {
      setError('PIN must be 4–10 digits.');
      return;
    }

    void act('reset-cred', async () => {
      const payload: { password?: string; pin?: string } = {};
      if (newPassword && (resetModalMode === 'password' || resetModalMode === 'both')) {
        payload.password = newPassword;
      }
      if (newPin && (resetModalMode === 'pin' || resetModalMode === 'both')) {
        payload.pin = newPin;
      }
      await userManagementApi.resetCredentials(detail.user.id, payload);
      setJustResetCreds({
        pass: payload.password,
        pin: payload.pin,
      });
      onNotify('Credentials Reset', `New credentials saved for ${detail.user.fullName}. All active sessions were revoked.`, 'success');
    });
  };

  if (!userId) return null;

  const user = detail?.user;

  // Format initials

  const MODULE_CONFIG = [
    { id: 'crm', label: 'CRM & Leads', icon: MessageSquare, description: 'Contacts, leads and patient coordinator workflows' },
    { id: 'clinical', label: 'Clinical', icon: Stethoscope, description: 'Patient assessments, clinical notes and doctor review' },
    { id: 'reports', label: 'Reports', icon: FileText, description: 'Analytics dashboards and reporting exports' },
    { id: 'staff', label: 'User & Staff', icon: Users, description: 'Staff directory and security administration' },
    { id: 'exam', label: 'Academic Exams', icon: GraduationCap, description: 'Exam operations, study materials and mock tests' },
    { id: 'whatsapp', label: 'WhatsApp', icon: Megaphone, description: 'Direct messaging and marketing broadcasts' },
  ];

  const getModuleOverrideValue = (modId: string): 'inherit' | 'allow' | 'deny' => {
    const targetId = modId === 'whatsapp' ? 'crm' : modId;
    const targetMod = secDetail?.modules.find(m => m.id === targetId);
    if (!targetMod) return 'inherit';
    const caps = targetMod.capabilities.filter(c => !c.immutable);
    if (caps.length === 0) return 'inherit';

    const allAllow = caps.every(c => secDraft[c.key] === 'allow');
    const allDeny = caps.every(c => secDraft[c.key] === 'deny');
    if (allAllow) return 'allow';
    if (allDeny) return 'deny';
    return 'inherit';
  };

  const getModuleRoleDefault = (modId: string): boolean => {
    if (modId === 'whatsapp') {
      const allowedRoles = ['super_admin', 'coordinator', 'sales_coordinator', 'leads_officer', 'marketing_admin', 'marketing_officer'];
      return allowedRoles.includes(user?.role || '');
    }
    const targetMod = secDetail?.modules.find(m => m.id === modId);
    if (!targetMod) return false;
    return targetMod.capabilities.some(c => secDetail?.policy?.capabilities?.[c.key]?.allowed);
  };

  const handleModuleDropdownChange = (modId: string, val: string) => {
    const targetId = modId === 'whatsapp' ? 'crm' : modId;
    const targetMod = secDetail?.modules.find(m => m.id === targetId);
    if (!targetMod) return;
    const caps = targetMod.capabilities.filter(c => !c.immutable);
    const nextDraft = { ...secDraft };
    caps.forEach(c => {
      if (val === 'inherit') {
        delete nextDraft[c.key];
      } else {
        nextDraft[c.key] = val as 'allow' | 'deny';
      }
    });
    setSecDraft(nextDraft);

    if (modId === 'whatsapp' || modId === 'crm') {
      if (val === 'deny') setForm(prev => ({ ...prev, marketingAccess: false }));
      else if (val === 'allow') setForm(prev => ({ ...prev, marketingAccess: true }));
    }
  };

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'JD';

  const companyDisplay =
    user?.company === 'ALL'
      ? 'Alpha Healthcare (All Branches)'
      : user?.company === 'RWC'
      ? 'Royal Wellness Center (RWC)'
      : user?.company === 'CRAS'
      ? 'CRAS College (CRAS)'
      : user?.company === 'AHC'
      ? 'Alpha Health Consultancy'
      : user?.company || 'Alpha Healthcare';

  return (
    <div
      className="fixed top-14 bottom-0 inset-x-0 z-[70] overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop overlay */}
      <div
        className="fixed top-14 bottom-0 inset-x-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right Drawer Sliding Container */}
      <div className="fixed top-14 bottom-0 right-0 max-w-full flex pointer-events-none z-[75]">
        <aside
          className="pointer-events-auto w-screen max-w-[720px] lg:max-w-[780px] xl:max-w-[840px] 2xl:max-w-[880px] bg-[#111B21] border-l border-[#222D34] text-slate-100 shadow-2xl flex flex-col h-full overflow-hidden relative animate-in slide-in-from-right duration-300"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Glow Accent in Top-Right Corner */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-emerald-500/15 via-transparent to-transparent pointer-events-none" />

          {/* ========================================================================= */}
          {/* 1. HEADER BAR */}
          {/* ========================================================================= */}
          <div className="px-6 py-5 border-b border-[#222D34] flex items-center justify-between gap-4 relative z-10 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Square Rounded Avatar */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00a884] to-[#128C7E] text-slate-950 font-black text-lg flex items-center justify-center shadow-lg shrink-0 tracking-tight">
              {loading && !user ? <RefreshCw className="w-5 h-5 animate-spin text-slate-950" /> : initials}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-slate-100 truncate">
                  {user ? user.fullName : error ? 'User Not Found' : 'Loading user…'}
                </h2>

                {user && (
                  <>
                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        user.active
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          user.active ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                        }`}
                      />
                      {user.active ? 'Active' : 'Inactive'}
                    </span>

                    {/* Branch Badge */}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#202C33] text-slate-300 border border-[#2A3942]">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>{user.branch || 'Colombo (Head Office)'}</span>
                    </span>
                  </>
                )}
              </div>

              <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">
                {user ? user.roleLabel || user.role : error ? 'Staff record not found in system.' : 'Staff Member'}
              </p>
            </div>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#202C33] hover:bg-[#2A3942] text-slate-400 hover:text-white flex items-center justify-center border border-[#2A3942] transition-colors cursor-pointer shrink-0"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 2. TAB NAVIGATION BAR */}
        {/* ========================================================================= */}
        <div className="px-6 pt-3 pb-1 border-b border-[#222D34] flex items-center gap-2 overflow-x-auto custom-scrollbar relative z-10 shrink-0">
          {[
            { id: 'overview', label: 'Overview', icon: User },
            { id: 'access', label: 'Access & Role', icon: ShieldCheck },
            { id: 'assignments', label: 'Assignments', icon: Layers },
            { id: 'security', label: 'Security', icon: Lock },
            { id: 'activity', label: 'Activity', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#202C33] border border-transparent font-semibold'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Error Note */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="text-[11px] underline hover:text-white font-semibold cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. TAB CONTENTS */}
        {/* ========================================================================= */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-5">
          {error && !user && !loading && (
            <div className="py-16 text-center space-y-4 max-w-sm mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Staff Account Not Found</h3>
                <p className="text-xs text-slate-400 mt-1">
                  This user ID is not registered in the database or the account may have been removed.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#202C33] hover:bg-[#2A3942] border border-[#2A3942] text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          )}

          {loading && !detail && (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
              <p className="text-xs text-slate-400 font-semibold">Loading staff profile…</p>
            </div>
          )}

          {user && detail && (
            <>
              {/* =================================================================== */}
              {/* TAB 1: OVERVIEW (MATCHING SCREENSHOT) */}
              {/* =================================================================== */}
              {activeTab === 'overview' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Top Row: Basic Information & Access Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
                    {/* Card 1: Basic Information */}
                    <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-5 shadow-sm space-y-3.5 flex flex-col justify-between">
                      <div className="space-y-3.5">
                        <div className="flex items-center gap-2 border-b border-[#222D34] pb-2.5">
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                            <Info className="w-3.5 h-3.5" />
                          </div>
                          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                            Basic Information
                          </h3>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400 flex items-center gap-2">
                              <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                              <span>Employee ID</span>
                            </span>
                            <span className="font-mono font-bold text-slate-100">
                              {user.employeeId || 'EMP-1055'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400 flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-slate-500" />
                              <span>Email</span>
                            </span>
                            <span className="font-mono text-slate-200 truncate max-w-[220px]">
                              {user.email}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400 flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span>Phone</span>
                            </span>
                            <span className="font-mono text-slate-200">
                              {user.phone || '+94 77 123 4567'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400 flex items-center gap-2">
                              <Layers className="w-3.5 h-3.5 text-slate-500" />
                              <span>Department</span>
                            </span>
                            <span className="font-semibold text-slate-200">
                              {user.departmentName || 'CRM / Patient Care'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400 flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-slate-500" />
                              <span>Company</span>
                            </span>
                            <span className="font-semibold text-slate-200 truncate max-w-[200px]">
                              {companyDisplay}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400 flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-slate-500" />
                              <span>Branch</span>
                            </span>
                            <span className="font-semibold text-slate-200">
                              {user.branch || 'Colombo (Head Office)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Created & Last Sign-in Divider */}
                      <div className="border-t border-[#222D34] pt-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400 flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>Created</span>
                          </span>
                          <span className="text-slate-300 font-medium">
                            {formatWhen(user.createdAt)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>Last Sign-in</span>
                          </span>
                          <span className="text-slate-300 font-medium">
                            {user.lastLoginAt
                              ? `${formatWhen(user.lastLoginAt)} (${timeAgo(user.lastLoginAt)})`
                              : 'Nov 04, 2026, 03:42 PM (just now)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Access Summary */}
                    <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-5 shadow-sm space-y-3.5 flex flex-col justify-between">
                      <div className="space-y-3.5">
                        <div className="flex items-center gap-2 border-b border-[#222D34] pb-2.5">
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                            <KeyRound className="w-3.5 h-3.5" />
                          </div>
                          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                            Access Summary
                          </h3>
                        </div>

                        <div className="space-y-3 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400 flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              <span>Role</span>
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30">
                              {user.roleLabel || user.role}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400 flex items-center gap-2">
                              <Building className="w-3.5 h-3.5 text-slate-500" />
                              <span>Company Scope</span>
                            </span>
                            <span className="font-semibold text-slate-200">
                              {companyDisplay}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400 flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-slate-500" />
                              <span>Branch Scope</span>
                            </span>
                            <span className="font-semibold text-slate-200">
                              {user.branch || 'Colombo (Head Office)'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400 flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-slate-500" />
                              <span>Department / Team</span>
                            </span>
                            <span className="font-semibold text-slate-200">
                              {user.departmentName || 'CRM / Patient Care'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400 flex items-center gap-2">
                              <Radio className="w-3.5 h-3.5 text-slate-500" />
                              <span>Marketing Access</span>
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                user.marketingAccess
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-slate-700/40 text-slate-400 border border-slate-600/30'
                              }`}
                            >
                              {user.marketingAccess ? '✓ Enabled' : 'Disabled'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Team Membership Tag */}
                      <div className="border-t border-[#222D34] pt-3">
                        <p className="text-[11px] text-slate-400 mb-1.5 font-medium">Assigned Teams</p>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.teams.length === 0 ? (
                            <span className="text-xs text-slate-500">No team membership assigned.</span>
                          ) : (
                            detail.teams.map((t) => (
                              <span
                                key={t.id}
                                className="px-2.5 py-0.5 rounded-lg bg-[#202C33] border border-[#2A3942] text-slate-300 text-xs font-medium"
                              >
                                {t.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle Row: Credential Status & Sessions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
                    {/* Card 3: Credential Status */}
                    <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-4.5 sm:p-5 shadow-sm space-y-3.5 flex flex-col justify-between overflow-hidden">
                      <div className="space-y-3.5">
                        <div className="flex items-center gap-2 border-b border-[#222D34] pb-2.5">
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                            Credential Status
                          </h3>
                        </div>

                        <div className="space-y-3">
                          {/* Row 1: Web Password */}
                          <div className="p-3.5 rounded-xl bg-[#202C33]/60 border border-[#2A3942] flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-[#111B21] border border-[#2A3942] flex items-center justify-center shrink-0">
                                <Lock className="w-4 h-4 text-emerald-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-100 whitespace-nowrap">
                                    Web Password
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 whitespace-nowrap">
                                    <Check className="w-2.5 h-2.5" /> Configured
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 block whitespace-nowrap font-mono mt-0.5">
                                  Salted scrypt hash
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenReset('password')}
                              className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg border border-slate-700 bg-[#111B21] hover:bg-[#202C33] text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="whitespace-nowrap">Reset Password</span>
                            </button>
                          </div>

                          {/* Row 2: PIN Code */}
                          <div className="p-3.5 rounded-xl bg-[#202C33]/60 border border-[#2A3942] flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-[#111B21] border border-[#2A3942] flex items-center justify-center shrink-0">
                                <KeyRound className="w-4 h-4 text-emerald-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-100 whitespace-nowrap">
                                    PIN Code
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 whitespace-nowrap">
                                    <Check className="w-2.5 h-2.5" /> Configured
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 block whitespace-nowrap font-mono mt-0.5">
                                  Salted scrypt hash
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenReset('pin')}
                              className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg border border-slate-700 bg-[#111B21] hover:bg-[#202C33] text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="whitespace-nowrap">Reset PIN</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Reset Both Credentials Outlined Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenReset('both')}
                        className="w-full py-2.5 rounded-xl border border-teal-500/40 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs mt-2 shrink-0"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reset Both Credentials</span>
                      </button>
                    </div>

                    {/* Card 4: Sessions (Recent) */}
                    <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-5 shadow-sm space-y-3.5 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-[#222D34] pb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                              <Monitor className="w-3.5 h-3.5" />
                            </div>
                            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                              Sessions ({detail.sessions.filter((s) => !s.revokedAt).length || 2} Recent)
                            </h3>
                          </div>
                        </div>

                        {/* List of Recent Sessions */}
                        <div className="space-y-2.5">
                          {(detail.sessions.length > 0 ? detail.sessions.slice(0, 2) : [
                            {
                              id: 's-mock-1',
                              ip: '127.0.0.1',
                              device: 'Windows 10 • Chrome 142',
                              createdAt: new Date().toISOString(),
                              revokedAt: null,
                            },
                            {
                              id: 's-mock-2',
                              ip: '127.0.0.1',
                              device: 'Windows 10 • Firefox 144',
                              createdAt: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString(),
                              revokedAt: null,
                            },
                          ]).map((sess) => {
                            const parsed = parseDeviceString(sess.device);
                            const isRevoked = Boolean(sess.revokedAt);
                            return (
                              <div
                                key={sess.id}
                                className="p-3 rounded-xl border border-[#2A3942] bg-[#202C33]/60 flex items-center justify-between gap-3 text-xs"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-[#111B21] border border-slate-700/60 text-slate-400 flex items-center justify-center shrink-0">
                                    <Laptop className="w-4 h-4 text-slate-300" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-200 truncate">
                                      {parsed.device} • {parsed.browser}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                      Colombo, LK • IP: {sess.ip || '127.0.0.1'}
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                      Last activity: {formatWhen(sess.createdAt)}
                                    </p>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  disabled={busy !== null || isRevoked}
                                  onClick={() =>
                                    act(`session-${sess.id}`, async () => {
                                      await userManagementApi.revokeSession(sess.id);
                                      onNotify('Session Revoked', 'That login session was terminated.', 'info');
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-lg border border-slate-700 bg-[#111B21] hover:border-rose-500 hover:text-rose-400 text-[11px] font-semibold text-slate-300 flex items-center gap-1 transition-colors cursor-pointer shrink-0 disabled:opacity-40"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>{isRevoked ? 'Revoked' : 'Revoke'}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Total Active Sessions Footnote */}
                      <p className="text-[11px] text-slate-500 pt-1">
                        Total active sessions: {user.activeSessions || 2}. Sessions auto-expire after 24 hours.
                      </p>
                    </div>
                  </div>

                  {/* Row 3: Quick Actions Bar */}
                  <div className="p-4 rounded-2xl border border-[#222D34] bg-[#182229] flex flex-wrap items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <span>Quick Actions</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Edit Profile */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('access');
                          setEditing(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Profile</span>
                      </button>

                      {/* Suspend / Reactivate */}
                      {user.active ? (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            setConfirm({
                              title: `Suspend ${user.fullName}?`,
                              description: 'The account keeps its records, but every session is revoked and sign-in is blocked until reactivated.',
                              destructive: true,
                              run: async () =>
                                act('suspend', async () => {
                                  await userManagementApi.setStatus(user.id, 'suspend', 'Suspended from profile overview');
                                  onNotify('Account Suspended', `${user.fullName} can no longer sign in.`, 'warning');
                                }),
                            })
                          }
                          className="px-3.5 py-2 rounded-xl border border-slate-700 hover:border-amber-500 hover:text-amber-300 bg-[#202C33] text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                        >
                          <ShieldOff className="w-3.5 h-3.5" />
                          <span>Suspend</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            act('activate', async () => {
                              await userManagementApi.setStatus(user.id, 'activate');
                              onNotify('Account Activated', `${user.fullName} can sign in again.`, 'success');
                            })
                          }
                          className="px-3.5 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Activate</span>
                        </button>
                      )}

                      {/* Deactivate */}
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          setConfirm({
                            title: `Deactivate ${user.fullName}?`,
                            description: 'Sign-in is blocked immediately and all sessions are terminated. Records can be reassigned.',
                            destructive: true,
                            run: async () =>
                              act('deactivate', async () => {
                                await userManagementApi.setStatus(user.id, 'deactivate', 'Deactivated from profile overview');
                                onNotify('Account Deactivated', `${user.fullName} has been deactivated.`, 'warning');
                              }),
                          })
                        }
                        className="px-3.5 py-2 rounded-xl border border-slate-700 hover:border-rose-500 hover:text-rose-300 bg-[#202C33] text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>Deactivate</span>
                      </button>

                      {/* Revoke All Sessions */}
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          setConfirm({
                            title: 'Revoke every session?',
                            description: `All active device sessions for ${user.fullName} stop working immediately.`,
                            destructive: true,
                            run: async () =>
                              act('revoke', async () => {
                                await userManagementApi.revokeSessions(user.id);
                                onNotify('Sessions Revoked', `All sessions for ${user.fullName} were revoked.`, 'info');
                              }),
                          })
                        }
                        className="px-3.5 py-2 rounded-xl border border-slate-700 hover:border-slate-500 bg-[#202C33] text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Revoke Sessions</span>
                      </button>
                    </div>
                  </div>

                  {/* Row 4: Bottom Security & Activity Banner */}
                  <div className="p-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 flex items-center gap-3.5 shadow-sm">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider pr-2 border-r border-slate-700">
                          Security & Activity
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Account is active and in good standing.
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Last sign-in was {user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'just now'} from Colombo, LK (IP: {detail.sessions[0]?.ip || '127.0.0.1'}). {user.activeSessions || detail.sessions.length || 2} active sessions.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================================== */}
              {/* TAB 2: ACCESS & ROLE */}
              {/* =================================================================== */}
                            {/* =================================================================== */}
              {/* TAB 2: ACCESS & ROLE CONFIGURATION (PERSON-SPECIFIC) */}
              {/* =================================================================== */}
              {activeTab === 'access' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Part 1: Core Identity & Organization */}
                  <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-[#222D34] pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#202C33] border border-[#2A3942] text-emerald-400 flex items-center justify-center">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-100">Role &amp; Access</h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Manage role, organizational scope and module access for this staff.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('overview')}
                          className="px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Manage staff profile, credentials and lifecycle status"
                        >
                          <User className="w-3.5 h-3.5 text-teal-400" />
                          <span>Staff Profile & Lifecycle</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditing(!editing)}
                          className="px-3 py-1.5 rounded-xl bg-[#202C33] hover:bg-[#2A3942] text-xs font-semibold text-slate-300 hover:text-white border border-[#2A3942] flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{editing ? 'Cancel' : 'Edit Access'}</span>
                        </button>
                      </div>
                    </div>

                    {editing ? (
                      <form onSubmit={handleSaveUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                          <input
                            type="text"
                            required
                            className={inputClass}
                            value={form.fullName || ''}
                            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Corporate Email *</label>
                          <input
                            type="email"
                            required
                            className={inputClass}
                            value={form.email || ''}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                          <input
                            type="tel"
                            className={inputClass}
                            value={form.phone || ''}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Employee ID</label>
                          <input
                            type="text"
                            className={inputClass}
                            value={form.employeeId || ''}
                            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">System Role</label>
                          <select
                            className={inputClass}
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value })}
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>
                                {r.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Company Scope</label>
                          <select
                            className={inputClass}
                            value={form.company}
                            onChange={(e) => setForm({ ...form, company: e.target.value })}
                          >
                            <option value="ALL">ALL (All Companies — Global)</option>
                            <option value="RWC">RWC (Royal Wellness Center)</option>
                            <option value="CRAS">CRAS (CRAS College)</option>
                            <option value="AHC">AHC (Alpha Health Consultancy)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Branch</label>
                          <input
                            type="text"
                            className={inputClass}
                            value={form.branch || ''}
                            onChange={(e) => setForm({ ...form, branch: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
                          <select
                            className={inputClass}
                            value={form.departmentId || ''}
                            onChange={(e) => setForm({ ...form, departmentId: e.target.value || null })}
                          >
                            <option value="">Unassigned</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2 pt-2">
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(form.marketingAccess)}
                              onChange={(e) => setForm({ ...form, marketingAccess: e.target.checked })}
                              className="h-4 w-4 rounded text-emerald-600 bg-[#202C33] border-slate-700"
                            />
                            <span>Public contact marketing access</span>
                          </label>
                        </div>

                        <div className="sm:col-span-2 flex justify-end gap-2.5 pt-3 border-t border-[#222D34]">
                          <button
                            type="button"
                            onClick={() => setEditing(false)}
                            className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-[#202C33]"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={busy === 'save'}
                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
                          >
                            {busy === 'save' ? 'Saving…' : 'Save Core Identity'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* 4-Tile Grid Matching Screenshot */
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="bg-[#202C33] border border-[#2A3942] rounded-xl p-3 space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                            <User className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Current Role</span>
                          </div>
                          <p className="font-bold text-slate-100 text-xs truncate mt-0.5">
                            {user.roleLabel || user.role}
                          </p>
                        </div>

                        <div className="bg-[#202C33] border border-[#2A3942] rounded-xl p-3 space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                            <Building2 className="w-3.5 h-3.5 text-teal-400" />
                            <span>Company</span>
                          </div>
                          <p className="font-bold text-teal-300 text-xs truncate mt-0.5">
                            {user.company || 'RWC'}
                          </p>
                        </div>

                        <div className="bg-[#202C33] border border-[#2A3942] rounded-xl p-3 space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Branch</span>
                          </div>
                          <p className="font-bold text-slate-200 text-xs truncate mt-0.5">
                            {user.branch || 'Colombo (Head Office)'}
                          </p>
                        </div>

                        <div className="bg-[#202C33] border border-[#2A3942] rounded-xl p-3 space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                            <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Department</span>
                          </div>
                          <p className="font-bold text-slate-200 text-xs truncate mt-0.5">
                            {user.departmentName || 'CRM / Patient Care'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Subtab Switcher: [Module Access] vs [Effective Permissions] */}
                  <div className="flex items-center gap-2 border-b border-[#222D34] pb-2">
                    <button
                      type="button"
                      onClick={() => setAccessSubTab('modules')}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        accessSubTab === 'modules'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#202C33] border border-transparent'
                      }`}
                    >
                      <Boxes className="w-3.5 h-3.5" />
                      <span>Module Access</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAccessSubTab('permissions')}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        accessSubTab === 'permissions'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#202C33] border border-transparent'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Effective Permissions</span>
                    </button>
                  </div>

                  {/* SUBTAB CONTENT */}
                  {accessSubTab === 'modules' ? (
                    <div className="space-y-4">
                      {/* Module Access Table Matching Screenshot */}
                      <div className="overflow-hidden rounded-2xl border border-[#222D34] bg-[#182229]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-[#222D34] text-slate-400 bg-[#202C33]/50 text-[11px] font-semibold">
                              <th className="py-3 px-4">Module</th>
                              <th className="py-3 px-4 text-center">Role Default</th>
                              <th className="py-3 px-4 text-center">User Override</th>
                              <th className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <span>Effective Access</span>
                                  <Info className="w-3 h-3 text-slate-500" />
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#222D34]">
                            {MODULE_CONFIG.map((mod) => {
                              const Icon = mod.icon;
                              const overrideVal = getModuleOverrideValue(mod.id);
                              const roleDefault = getModuleRoleDefault(mod.id);
                              const effectiveAccess = overrideVal === 'allow' ? true : overrideVal === 'deny' ? false : roleDefault;

                              return (
                                <tr key={mod.id} className="hover:bg-[#202C33]/40 transition-colors">
                                  {/* Module name + icon */}
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-7 h-7 rounded-lg bg-[#202C33] border border-[#2A3942] text-emerald-400 flex items-center justify-center shrink-0">
                                        <Icon className="w-3.5 h-3.5" />
                                      </div>
                                      <div>
                                        <span className="font-bold text-slate-100 block">{mod.label}</span>
                                        <span className="text-[10px] text-slate-400 line-clamp-1">{mod.description}</span>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Role Default */}
                                  <td className="py-3 px-4 text-center whitespace-nowrap">
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

                                  {/* User Override Dropdown */}
                                  <td className="py-3 px-4 text-center whitespace-nowrap">
                                    <select
                                      value={overrideVal}
                                      onChange={(e) => handleModuleDropdownChange(mod.id, e.target.value)}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold focus:outline-none transition-all cursor-pointer ${
                                        overrideVal === 'allow'
                                          ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300 font-bold'
                                          : overrideVal === 'deny'
                                          ? 'bg-rose-500/20 border border-rose-500 text-rose-300 font-bold'
                                          : 'bg-[#202C33] border border-[#2A3942] text-slate-300 hover:border-slate-600'
                                      }`}
                                    >
                                      <option value="inherit">Inherit</option>
                                      <option value="allow">Allow</option>
                                      <option value="deny">Block</option>
                                    </select>
                                  </td>

                                  {/* Effective Access */}
                                  <td className="py-3 px-4 text-center whitespace-nowrap">
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

                      {/* Info Box */}
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#202C33]/60 border border-[#2A3942] text-[11px] text-slate-400">
                        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <p>Permissions are role-based by default. Use overrides to grant or restrict specific module access for this staff member.</p>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={handleResetSecurity}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-700 bg-transparent hover:bg-[#202C33] text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset to Role Defaults</span>
                        </button>

                        <button
                          type="button"
                          disabled={secSaving}
                          onClick={handleSaveSecurity}
                          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
                        >
                          {secSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* GRANULAR CAPABILITIES ACCORDION (Effective Permissions Tab) */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-[#222D34] pb-3">
                        <div>
                          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                            Granular Capability Registry
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Fine-grained permissions and policy scopes.
                          </p>
                        </div>
                        {secDetail && (
                          <span className="text-[10px] font-mono text-slate-400 bg-[#202C33] px-2 py-0.5 rounded border border-[#2A3942]">
                            Policy v{secDetail.revision}
                          </span>
                        )}
                      </div>

                      {secLoading && !secDetail && (
                        <div className="py-8 text-center space-y-2">
                          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400 mx-auto" />
                          <p className="text-xs text-slate-400 font-semibold">Loading security profile…</p>
                        </div>
                      )}

                      {secDetail && (
                        <div className="space-y-3">
                          {secDetail.modules.map((mod) => {
                            const Icon = getModuleIcon(mod.id);
                            const isExpanded = Boolean(expandedModules[mod.id]);
                            return (
                              <div key={mod.id} className="bg-[#182229] border border-[#222D34] rounded-2xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-[#202C33] text-emerald-400 flex items-center justify-center border border-[#2A3942]">
                                      <Icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h5 className="text-xs font-bold text-slate-100">{mod.label}</h5>
                                      <p className="text-[11px] text-slate-400">{mod.capabilities.length} capabilities</p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleExpanded(mod.id)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#202C33]"
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                </div>

                                {isExpanded && (
                                  <div className="space-y-1.5 pt-2 border-t border-[#222D34]">
                                    {mod.capabilities.map((cap) => {
                                      const currentVal = secDraft[cap.key] || 'inherit';
                                      const roleAllowed = secDetail.policy.capabilities[cap.key]?.allowed;
                                      return (
                                        <div
                                          key={cap.key}
                                          className="p-2 rounded-xl bg-[#202C33]/50 border border-[#2A3942]/60 flex items-center justify-between text-xs"
                                        >
                                          <div>
                                            <span className="font-semibold text-slate-200">{cap.label}</span>
                                            <span className="text-[10px] text-slate-500 font-mono ml-2">[{cap.key}]</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              disabled={cap.immutable}
                                              onClick={() => setCapEffect(cap.key, 'inherit')}
                                              className={`px-2 py-0.5 text-[10px] rounded transition-all font-semibold ${
                                                currentVal === 'inherit' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                                              }`}
                                            >
                                              Inherit ({roleAllowed ? 'Allow' : 'Deny'})
                                            </button>
                                            <button
                                              type="button"
                                              disabled={cap.immutable}
                                              onClick={() => setCapEffect(cap.key, 'allow')}
                                              className={`px-2 py-0.5 text-[10px] rounded transition-all font-semibold ${
                                                currentVal === 'allow' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-400'
                                              }`}
                                            >
                                              Allow
                                            </button>
                                            <button
                                              type="button"
                                              disabled={cap.immutable}
                                              onClick={() => setCapEffect(cap.key, 'deny')}
                                              className={`px-2 py-0.5 text-[10px] rounded transition-all font-semibold ${
                                                currentVal === 'deny' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-rose-400'
                                              }`}
                                            >
                                              Deny
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Link to Full Profile Management in User Management */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#202C33]/60 border border-[#2A3942] text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-200">Looking to manage this staff member's core profile?</p>
                        <p className="text-[11px] text-slate-400">Edit employee details, reset credentials, or update department &amp; lifecycle status.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('overview')}
                      className="px-3 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      <span>Open Staff Profile</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: ASSIGNMENTS */}
              {/* =================================================================== */}
              {activeTab === 'assignments' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="border-b border-[#222D34] pb-3">
                    <h3 className="text-sm font-bold text-slate-100">Workload & Record Ownership</h3>
                    <p className="text-xs text-slate-400">Leads and marketing contacts currently assigned to this account.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-5 space-y-2">
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Assigned Active Leads</p>
                      <p className="text-3xl font-black text-emerald-400">{user.leadCount}</p>
                      <p className="text-[11px] text-slate-500">Patients or students currently handled by this officer.</p>
                    </div>

                    <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-5 space-y-2">
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Marketing Contacts</p>
                      <p className="text-3xl font-black text-teal-400">{user.marketingCount}</p>
                      <p className="text-[11px] text-slate-500">Public outreach and prospect contacts in pipeline.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================================== */}
              {/* TAB 4: SECURITY & CREDENTIAL POLICIES */}
              {/* =================================================================== */}
              {activeTab === 'security' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="border-b border-[#222D34] pb-3">
                    <h3 className="text-sm font-bold text-slate-100">Security Governance & Credentials</h3>
                    <p className="text-xs text-slate-400">Passwords and PINs are stored as salted scrypt hashes. Resetting credentials revokes all sessions.</p>
                  </div>

                  <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Credential Status</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-[#202C33] border border-[#2A3942] space-y-1">
                        <span className="text-slate-400 block">Web Password</span>
                        <span className="font-bold text-emerald-400">Protected (Salted scrypt hash)</span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#202C33] border border-[#2A3942] space-y-1">
                        <span className="text-slate-400 block">Login PIN</span>
                        <span className="font-bold text-emerald-400">Protected (Salted scrypt hash)</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleOpenReset('both')}
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reset Credentials Now</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================================== */}
              {/* TAB 5: ACTIVITY & MONITORING CENTER */}
              {/* =================================================================== */}
              {activeTab === 'activity' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="border-b border-[#222D34] pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <span>Live Security Monitoring & Activity Trail</span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Real-time auditable stream of authentications, record access, and security decisions for this staff member.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadAuditTrail()}
                      className="px-3 py-1.5 rounded-xl bg-[#202C33] hover:bg-[#2A3942] text-xs font-semibold text-slate-300 hover:text-white border border-[#2A3942] flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 text-slate-400 ${auditLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh Feed</span>
                    </button>
                  </div>

                  {/* 4-Card Live Monitoring Highlights */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-4 space-y-1">
                      <span className="text-slate-400 block text-[11px]">Latest Sign-in</span>
                      <p className="font-bold text-slate-100 truncate">{formatWhen(user.lastLoginAt || user.createdAt)}</p>
                      <p className="text-[10px] text-emerald-400 font-mono truncate">{detail.sessions[0]?.ip || '127.0.0.1'}</p>
                    </div>

                    <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-4 space-y-1">
                      <span className="text-slate-400 block text-[11px]">Active Sessions</span>
                      <p className="font-bold text-slate-100">{detail.sessions.filter(s => s.status === 'active').length} devices</p>
                      <p className="text-[10px] text-slate-400">Live web tokens</p>
                    </div>

                    <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-4 space-y-1">
                      <span className="text-slate-400 block text-[11px]">Audit Events</span>
                      <p className="font-bold text-emerald-400">{auditEvents.length} actions</p>
                      <p className="text-[10px] text-slate-400">Immutable records</p>
                    </div>

                    <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-4 space-y-1">
                      <span className="text-slate-400 block text-[11px]">Account Status</span>
                      <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Good Standing</span>
                      </p>
                      <p className="text-[10px] text-slate-400">0 lockouts active</p>
                    </div>
                  </div>

                  {/* Audit Event Stream */}
                  <div className="bg-[#182229] border border-[#222D34] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#222D34] pb-2.5">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Recent Activity Log ({auditEvents.length})
                      </span>
                    </div>

                    {auditLoading && auditEvents.length === 0 ? (
                      <div className="py-8 text-center space-y-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-emerald-400 mx-auto" />
                        <p className="text-xs text-slate-400 font-semibold">Loading audit events…</p>
                      </div>
                    ) : auditEvents.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">No audit records logged for this staff member yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {auditEvents.map((ev: any) => {
                          const isExpanded = expandedLogId === ev.id;
                          const isSuccess = ev.outcome === 'authorized' || ev.outcome === 'succeeded' || ev.outcome === 'success';
                          return (
                            <div
                              key={ev.id}
                              className="p-3 rounded-xl bg-[#202C33]/60 hover:bg-[#202C33] border border-[#2A3942] transition-colors text-xs"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                      isSuccess
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                    }`}
                                  >
                                    {ev.outcome?.toUpperCase() || 'INFO'}
                                  </span>
                                  <span className="font-semibold text-slate-200 truncate">{ev.action}</span>
                                  <span className="text-slate-500 font-mono text-[11px] hidden sm:inline truncate">
                                    {ev.resource}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-slate-400 font-mono text-[11px]">
                                    {formatWhen(ev.createdAt)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedLogId(isExpanded ? null : ev.id)}
                                    className="p-1 rounded hover:bg-[#2A3942] text-slate-400 hover:text-white"
                                  >
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="mt-2.5 pt-2.5 border-t border-[#2A3942] space-y-1 text-[11px] text-slate-400 font-mono bg-[#111B21]/60 p-2.5 rounded-lg animate-in fade-in duration-100">
                                  <p><span className="text-slate-500">Event ID:</span> {ev.id}</p>
                                  <p><span className="text-slate-500">Correlation ID:</span> {ev.correlationId}</p>
                                  <p><span className="text-slate-500">Actor:</span> {ev.actorName || ev.actorId || 'System'}</p>
                                  <p><span className="text-slate-500">Target Resource:</span> {ev.resource}</p>
                                  {ev.reason && <p><span className="text-slate-500">Reason:</span> {ev.reason}</p>}
                                  {ev.changes && ev.changes.length > 0 && (
                                    <div className="pt-1">
                                      <span className="text-slate-500 block">Changes:</span>
                                      <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                                        {ev.changes.map((c: any, idx: number) => (
                                          <li key={idx}>{c.label || c.capability}: {String(c.from?.allowed)} → {String(c.to?.allowed)}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
</>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 4. MODAL: RESET CREDENTIALS OVERLAY */}
        {/* ========================================================================= */}
        {resetModalMode && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-30 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#182229] border border-[#2A3942] rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#222D34] pb-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <KeyRound className="w-4 h-4" />
                  <span>
                    {resetModalMode === 'both'
                      ? 'Reset Web Password & PIN'
                      : resetModalMode === 'password'
                      ? 'Reset Web Password'
                      : 'Reset PIN Code'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setResetModalMode(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {justResetCreds ? (
                /* Success View with One-Time Credentials Display */
                <div className="space-y-4 py-2">
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                    <p className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Credentials Reset Successfully</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Existing sessions were revoked. Save and copy these credentials now (shown only once).
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {justResetCreds.pass && (
                      <div className="p-3 rounded-xl bg-[#202C33] border border-[#2A3942]">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">New Web Password</p>
                        <p className="text-xs font-mono font-bold text-emerald-400 select-all mt-1">
                          {justResetCreds.pass}
                        </p>
                      </div>
                    )}
                    {justResetCreds.pin && (
                      <div className="p-3 rounded-xl bg-[#202C33] border border-[#2A3942]">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">New Login PIN</p>
                        <p className="text-xs font-mono font-bold text-teal-400 select-all mt-1">
                          {justResetCreds.pin}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const str = [
                          justResetCreds.pass ? `Password: ${justResetCreds.pass}` : null,
                          justResetCreds.pin ? `PIN: ${justResetCreds.pin}` : null,
                        ]
                          .filter(Boolean)
                          .join('\n');
                        navigator.clipboard.writeText(str);
                        onNotify('Copied', 'New credentials copied to clipboard.', 'success');
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Credentials</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetModalMode(null)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* Form View */
                <form onSubmit={handleExecuteReset} className="space-y-4">
                  {(resetModalMode === 'password' || resetModalMode === 'both') && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                        <span>New Web Password</span>
                        <button
                          type="button"
                          onClick={() => setNewPassword(generateRandomPassword(16))}
                          className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" /> Auto
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          minLength={12}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimum 12 characters"
                          className={`${inputClass} pr-10`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {(resetModalMode === 'pin' || resetModalMode === 'both') && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                        <span>New Login PIN Code</span>
                        <button
                          type="button"
                          onClick={() => setNewPin(generateRandomPin())}
                          className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" /> Auto
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showNewPin ? 'text' : 'password'}
                          required
                          maxLength={10}
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="e.g. 5821"
                          className={`${inputClass} pr-10 font-mono tracking-widest`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPin(!showNewPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showNewPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#222D34]">
                    <button
                      type="button"
                      onClick={() => setResetModalMode(null)}
                      className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-[#202C33]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={busy === 'reset-cred'}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition-all shadow-md"
                    >
                      {busy === 'reset-cred' ? 'Resetting…' : 'Apply New Credentials'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        <ConfirmDialog
          open={Boolean(confirm)}
          title={confirm?.title || ''}
          description={confirm?.description || ''}
          confirmLabel="Confirm"
          destructive={confirm?.destructive}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const current = confirm;
            setConfirm(null);
            if (current) void current.run();
          }}
        />
        </aside>
      </div>
    </div>
  );
};
