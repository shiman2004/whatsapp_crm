import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ScrollText, ShieldAlert, ShieldCheck, Users, Boxes, LayoutDashboard, MonitorSmartphone, UserCheck, Building2 } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { setSecurityTokenReader } from './security/api';
import { userManagementApi, type Department } from './user-management/api';
import { StaffAccessTab } from './security/StaffAccessTab';
import { RolePermissionsTab } from './security/RolePermissionsTab';
import { AuditLogsTab } from './security/AuditLogsTab';
import { SessionsTab } from './security/SessionsTab';
import { UserPermissionsTab } from './security/UserPermissionsTab';
import { AccessRequestsTab } from './security/AccessRequestsTab';
import { ModuleAccessTab } from './security/ModuleAccessTab';
import { UserDetailDrawer } from './user-management/UserDetailDrawer';

type SecurityTab = 'overview' | 'roles' | 'matrix' | 'policies' | 'requests' | 'sessions' | 'events';

const TABS: { id: SecurityTab; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Security Overview', hint: 'Posture & activity', icon: LayoutDashboard },
  { id: 'roles', label: 'Roles & Permissions', hint: 'Registry defaults', icon: ShieldCheck },
  { id: 'matrix', label: 'Permission Matrix', hint: 'Coverage by module', icon: Boxes },
  { id: 'policies', label: 'Access Policies', hint: 'Per-user overrides', icon: Users },
  { id: 'requests', label: 'Access Requests', hint: 'Approvals & elevations', icon: UserCheck },
  { id: 'sessions', label: 'Login & Session Activity', hint: 'Devices and revocations', icon: MonitorSmartphone },
  { id: 'events', label: 'Security Events', hint: 'Append-only trail', icon: ScrollText },
];

const isTab = (value: string): value is SecurityTab => TABS.some((tab) => tab.id === value);

const LEGACY: Record<string, SecurityTab> = {
  users: 'policies',
  activity: 'events',
  audit: 'events',
};

const readTabFromHash = (): SecurityTab => {
  const match = window.location.hash.match(/^#\/(?:security|security-access)(?:\/([a-z-]+))?/);
  const raw = match?.[1];
  if (!raw) return 'overview';
  if (isTab(raw)) return raw;
  return LEGACY[raw] || 'overview';
};

interface SecurityAccessViewProps {
  hideHeader?: boolean;
}

export const SecurityAccessView: React.FC<SecurityAccessViewProps> = ({ hideHeader = false }) => {
  const { currentUser, getAuthToken, isSuperAdmin, notify } = useCrm();
  const [tab, setTab] = useState<SecurityTab>(readTabFromHash);
  const [refreshKey, setRefreshKey] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);
  const tokenRef = React.useRef(getAuthToken);

  useEffect(() => {
    tokenRef.current = getAuthToken;
    setSecurityTokenReader(() => tokenRef.current());
  }, [getAuthToken]);

  useEffect(() => {
    userManagementApi
      .org()
      .then((res) => setDepartments(res.departments))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const syncFromHash = () => setTab(readTabFromHash());
    const onIntent = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      if (value && isTab(value)) selectTab(value);
    };
    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('security-tab-change', onIntent);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
      window.removeEventListener('security-tab-change', onIntent);
    };
  }, []);

  const selectTab = (next: SecurityTab) => {
    setTab(next);
    const hash = `#/security/${next}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  };

  const allow = Boolean(isSuperAdmin) && currentUser?.role === 'super_admin';

  const denied = useMemo(
    () => (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-3xl border border-rose-500/30 bg-[#182229] p-8 text-center shadow-xl">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-rose-500" />
          <h2 className="text-xl font-bold text-slate-100">Security area restricted</h2>
          <p className="mt-2 text-sm text-slate-400">
            Only an active Super Admin can view or change access permissions.
          </p>
        </div>
      </div>
    ),
    []
  );

  if (!allow) return denied;

  const currentCompany =
    currentUser?.company === 'RWC'
      ? 'Royal Wellness Center (RWC)'
      : currentUser?.company === 'CRAS'
      ? 'CRAS College (CRAS)'
      : currentUser?.company === 'AHC'
      ? 'Alpha Health Consultancy'
      : 'Royal Wellness Center (RWC)';

  return (
    <div className="flex-1 space-y-5 overflow-y-auto pb-10 pr-1">
      {/* 1. TOP HEADER */}
      {!hideHeader && (
        <header className="flex flex-col justify-between gap-3 border-b border-[#222D34] pb-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Role Access &amp; Monitoring</h1>
              <p className="mt-0.5 text-xs text-slate-400">
                Manage staff access, role permissions, activity and login sessions.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            {/* Scope Pill */}
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#2A3942] bg-[#202C33] px-3 py-1.5 text-xs font-semibold text-slate-300">
              <Building2 className="h-3.5 w-3.5 text-teal-400" />
              <span className="text-slate-400">Scope:</span>
              <span className="text-slate-200">{currentCompany}</span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#2A3942] bg-[#202C33] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#2A3942] transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </header>
      )}

      <nav aria-label="Security sections" className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5 dark:border-slate-800 dark:bg-slate-900/60 md:grid-cols-3 xl:grid-cols-7">
        {TABS.map(item => {
          const Icon = item.icon;
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectTab(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#202C33] border border-transparent'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 3. ACTIVE TAB CONTENT */}
      <div key={`${tab}-${refreshKey}`}>
        {tab === 'overview' && (
          <StaffAccessTab
            departments={departments}
            selectedUserId={drawerUserId}
            onSelectUser={(userId) => setDrawerUserId(userId)}
            onOpenCreateUser={() => {
              window.location.hash = '#/staff/create';
            }}
            onNotify={notify}
          />
        )}

        {tab === 'roles' && <RolePermissionsTab />}
        {tab === 'policies' && <UserPermissionsTab />}
        {tab === 'requests' && <AccessRequestsTab />}
        {tab === 'matrix' && <ModuleAccessTab />}
        {tab === 'sessions' && <SessionsTab />}
        {tab === 'events' && <AuditLogsTab />}
      </div>

      {/* 4. RIGHT-SIDE STAFF DETAIL & SECURITY DRAWER */}
      <UserDetailDrawer
        userId={drawerUserId}
        departments={departments}
        initialTab="access"
        onClose={() => setDrawerUserId(null)}
        onChanged={() => {
          setRefreshKey((k) => k + 1);
        }}
        onNotify={notify}
      />
    </div>
  );
};
