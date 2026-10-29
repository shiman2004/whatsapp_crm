import React, { useEffect, useMemo, useState } from 'react';
import { LockKeyhole, RefreshCw, ScrollText, ShieldAlert, ShieldCheck, SlidersHorizontal, Users, Boxes, LayoutDashboard, MonitorSmartphone } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { setSecurityTokenReader } from './security/api';
import { AuditLogsTab } from './security/AuditLogsTab';
import { ModuleAccessTab } from './security/ModuleAccessTab';
import { OverviewTab } from './security/OverviewTab';
import { RolePermissionsTab } from './security/RolePermissionsTab';
import { SessionsTab } from './security/SessionsTab';
import { UserPermissionsTab } from './security/UserPermissionsTab';
import { cx } from './security/bits';

type SecurityTab = 'overview' | 'roles' | 'matrix' | 'policies' | 'sessions' | 'events';

const TABS: { id: SecurityTab; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Security Overview', hint: 'Posture & activity', icon: LayoutDashboard },
  { id: 'roles', label: 'Roles & Permissions', hint: 'Registry defaults', icon: ShieldCheck },
  { id: 'matrix', label: 'Permission Matrix', hint: 'Coverage by module', icon: Boxes },
  { id: 'policies', label: 'Access Policies', hint: 'Per-user overrides', icon: Users },
  { id: 'sessions', label: 'Login & Session Activity', hint: 'Devices and revocations', icon: MonitorSmartphone },
  { id: 'events', label: 'Security Events', hint: 'Append-only trail', icon: ScrollText },
];

const isTab = (value: string): value is SecurityTab => TABS.some(tab => tab.id === value);

// Deep links: new paths are #/security/<tab>. The older #/security-access/<legacy>
// spellings keep working and map onto the same screens.
const LEGACY: Record<string, SecurityTab> = {
  users: 'policies',
  modules: 'matrix',
  audit: 'events',
};

const readTabFromHash = (): SecurityTab => {
  const match = window.location.hash.match(/^#\/(?:security|security-access)(?:\/([a-z-]+))?/);
  const raw = match?.[1];
  if (!raw) return 'overview';
  if (isTab(raw)) return raw;
  return LEGACY[raw] || 'overview';
};

export const SecurityAccessView: React.FC = () => {
  const { currentUser, getAuthToken, isSuperAdmin } = useCrm();
  const [tab, setTab] = useState<SecurityTab>(readTabFromHash);
  const [refreshKey, setRefreshKey] = useState(0);
  const tokenRef = React.useRef(getAuthToken);

  // The token reader is fixed once; the ref keeps it pointing at the latest closure.
  useEffect(() => {
    tokenRef.current = getAuthToken;
    setSecurityTokenReader(() => tokenRef.current());
  }, [getAuthToken]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTab = (next: SecurityTab) => {
    setTab(next);
    const hash = `#/security/${next}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  };

  const allow = Boolean(isSuperAdmin) && currentUser?.role === 'super_admin';

  const denied = useMemo(() => (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md rounded-3xl border border-rose-500/30 bg-white p-8 text-center shadow-xl dark:bg-slate-900">
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-rose-500" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Security area restricted</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Only an active Super Admin can view or change access permissions.</p>
      </div>
    </div>
  ), []);

  if (!allow) return denied;

  return (
    <div className="flex-1 space-y-5 overflow-y-auto pb-10 pr-1">
      <header className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-2.5 text-indigo-600 dark:text-indigo-300">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-serif">Security &amp; Access</h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Role defaults, personal overrides, module coverage, live sessions and the audit trail — exactly as the API enforces them.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <LockKeyhole className="h-3.5 w-3.5" />Server-enforced RBAC
          </span>
          <button
            type="button"
            onClick={() => setRefreshKey(key => key + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </button>
        </div>
      </header>

      <nav aria-label="Security sections" className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5 dark:border-slate-800 dark:bg-slate-900/60 md:grid-cols-3 xl:grid-cols-6">
        {TABS.map(item => {
          const Icon = item.icon;
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
                active
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200'
                  : 'border-transparent text-slate-600 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800/60',
              )}
            >
              <Icon className={cx('h-4 w-4 shrink-0', active ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400')} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{item.label}</span>
                <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{item.hint}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div key={`${tab}-${refreshKey}`}>
        {tab === 'overview' && (
          <OverviewTab onNavigate={(target) => selectTab(target === 'modules' ? 'matrix' : target === 'users' ? 'policies' : target === 'audit' ? 'events' : 'roles')} />
        )}
        {tab === 'roles' && <RolePermissionsTab />}
        {tab === 'policies' && <UserPermissionsTab />}
        {tab === 'matrix' && <ModuleAccessTab />}
        {tab === 'sessions' && <SessionsTab />}
        {tab === 'events' && <AuditLogsTab />}
      </div>
    </div>
  );
};
