import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, BriefcaseBusiness, Building2, MailPlus, PlusCircle, ShieldCheck, UserRoundCheck, UserRoundX, UsersRound,
} from 'lucide-react';
import { useCrm } from '../../../context/CrmContext';
import { ErrorState, LoadingSkeleton, PageHeader, SectionCard, StatCard, cn } from '../../ui';
import { setUserManagementTokenReader, userManagementApi, type Department, type ManagedUser, type Team, type TeamMember, type UserOverview } from './api';
import { AssignmentsTab } from './AssignmentsTab';
import { CreateUserTab } from './CreateUserTab';
import { DirectoryTab } from './DirectoryTab';
import { InvitationsTab } from './InvitationsTab';
import { TeamsTab } from './TeamsTab';

type UserTab = 'directory' | 'create' | 'teams' | 'assignments' | 'invitations' | 'deactivated';

const TABS: { id: UserTab; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'directory', label: 'User Directory', hint: 'Search and lifecycle', icon: UsersRound },
  { id: 'create', label: 'Create User', hint: 'New staff account', icon: PlusCircle },
  { id: 'teams', label: 'Teams & Departments', hint: 'Org structure', icon: Building2 },
  { id: 'assignments', label: 'User Assignments', hint: 'Record ownership', icon: BriefcaseBusiness },
  { id: 'invitations', label: 'Pending Invitations', hint: 'One-time links', icon: MailPlus },
  { id: 'deactivated', label: 'Deactivated Accounts', hint: 'Restore access', icon: UserRoundX },
];

const isTab = (value: string): value is UserTab => TABS.some((tab) => tab.id === value);

const readTabFromPath = (): UserTab => {
  const match = window.location.hash.match(/^#\/(?:staff|user-management|coordinators)(?:\/([a-z-]+))?/);
  return match && match[1] && isTab(match[1]) ? match[1] : 'directory';
};

export const UserManagementView: React.FC = () => {
  const { currentUser, getAuthToken, notify } = useCrm();
  const [tab, setTab] = useState<UserTab>(readTabFromPath);
  const [overview, setOverview] = useState<UserOverview | null>(null);
  const [org, setOrg] = useState<{ departments: Department[]; teams: Team[]; members: TeamMember[] }>({ departments: [], teams: [], members: [] });
  const [managers, setManagers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(getAuthToken);

  useEffect(() => {
    tokenRef.current = getAuthToken;
    setUserManagementTokenReader(() => tokenRef.current());
  }, [getAuthToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewResult, orgResult, people] = await Promise.all([
        userManagementApi.overview(),
        userManagementApi.org(),
        userManagementApi.users({ status: 'active', pageSize: 100, sort: 'name', order: 'asc' }),
      ]);
      setOverview(overviewResult);
      setOrg(orgResult);
      setManagers(people.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load user management.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const syncFromHash = () => setTab(readTabFromPath());
    const onIntent = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      if (value && isTab(value)) select(value);
    };
    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('user-mgmt-tab-change', onIntent);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
      window.removeEventListener('user-mgmt-tab-change', onIntent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (next: UserTab) => {
    setTab(next);
    const hash = `#/staff/${next}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  };

  const branchOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of overview?.distribution.branches || []) if (row.branch) set.add(row.branch);
    return [...set].sort();
  }, [overview]);

  const refresh = () => { void load(); };

  if (currentUser?.role !== 'super_admin') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-3xl border border-rose-500/30 bg-white p-8 text-center shadow-xl dark:bg-slate-900">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-rose-500" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">User management restricted</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Only an active Super Admin can view or manage staff accounts. The server enforces this independently of the sidebar.</p>
        </div>
      </div>
    );
  }

  const counters = overview?.counters;

  return (
    <div className="flex-1 space-y-5 overflow-y-auto pb-10 pr-1">
      <PageHeader
        eyebrow="System & security"
        title="User Management"
        description="Every account, role, department and assignment in one place. Actions call the server, which re-checks permission, tenant and branch scope."
        actions={
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 dark:border-[#222D34] dark:bg-[#202C33] dark:text-slate-200 dark:hover:bg-[#2A3942]"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      {error && <ErrorState message={error} onRetry={refresh} />}

      {/* Super Admin Executive Scope & Credentials Reference Banner */}
      <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-purple-500/10 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Super Admin Credentials & Executive Scope</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                  ALL Companies · ALL Branches
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Executive administrators have unrestricted operational scope across <strong className="text-emerald-700 dark:text-emerald-400">RWC Center</strong>, <strong className="text-rose-700 dark:text-rose-400">CRAS College</strong>, and <strong className="text-teal-700 dark:text-teal-400">Alpha Health Consultancy</strong> across all branches.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => select('create')}
              className="h-8.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <UserRoundCheck className="w-3.5 h-3.5" />
              <span>Create Super Admin</span>
            </button>
            <a
              href="#/security/policies"
              className="h-8.5 px-3 rounded-lg border border-slate-300 dark:border-[#222D34] bg-white dark:bg-[#202C33] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#2A3942] text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
              <span>Security Policies</span>
            </a>
          </div>
        </div>

        {/* Quick Credentials Summary Chips */}
        <div className="mt-3.5 pt-3 border-t border-slate-200/70 dark:border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="bg-white/80 dark:bg-[#202C33]/80 border border-slate-200 dark:border-[#222D34] p-2.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">Super Admin (Jahan)</span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">PIN: 1234</span>
            </div>
            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">admin@royalwellness.lk</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Password: <code className="text-slate-700 dark:text-slate-300">admin</code></p>
          </div>

          <div className="bg-white/80 dark:bg-[#202C33]/80 border border-slate-200 dark:border-[#222D34] p-2.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">Shiman</span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">PIN: 7777</span>
            </div>
            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">mnmshiman@gmail.com</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Password: <code className="text-slate-700 dark:text-slate-300">admin</code></p>
          </div>

          <div className="bg-white/80 dark:bg-[#202C33]/80 border border-slate-200 dark:border-[#222D34] p-2.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">Afrij</span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">PIN: 1234</span>
            </div>
            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">afrij@royalwellness.lk</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Password: <code className="text-slate-700 dark:text-slate-300">admin</code></p>
          </div>
        </div>
      </div>


      {loading && !overview ? (
        <LoadingSkeleton rows={4} />
      ) : counters ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total accounts" value={counters.total} hint={`${counters.administrators} administrator${counters.administrators === 1 ? '' : 's'}`} icon={UsersRound} tone="teal" />
          <StatCard label="Active" value={counters.active} hint={`${counters.staff} included in staff scope · ${counters.coordinators} coordinators`} icon={UserRoundCheck} tone="violet" />
          <StatCard label="Pending invitations" value={counters.pendingInvitations} hint="Single-use activation links" icon={MailPlus} tone="blue" />
          <StatCard label="Needs attention" value={counters.locked + counters.suspended + counters.inactive} hint={`${counters.locked} locked · ${counters.suspended} suspended · ${counters.inactive} inactive`} icon={AlertTriangle} tone="amber" />
        </div>
      ) : null}

      <nav aria-label="User management sections" className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-[#222D34] dark:bg-[#202C33] md:grid-cols-3 xl:grid-cols-6">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => select(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
                active
                  ? 'border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-200'
                  : 'border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5',
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-teal-600 dark:text-teal-300' : 'text-slate-400')} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{item.label}</span>
                <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{item.hint}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {tab === 'directory' && (
        <DirectoryTab
          title="User directory"
          description="Server-side filtering, sorting and pagination. Select accounts for an authorized bulk lifecycle action."
          departments={org.departments}
          branchOptions={branchOptions}
          onNotify={notify}
          onDataChanged={refresh}
        />
      )}

      {tab === 'create' && (
        <CreateUserTab
          departments={org.departments}
          managers={managers.map((manager) => ({ id: manager.id, fullName: manager.fullName, role: manager.role }))}
          onCreated={refresh}
          onNotify={notify}
        />
      )}

      {tab === 'teams' && (
        <TeamsTab
          departments={org.departments}
          teams={org.teams}
          members={org.members}
          loading={loading}
          error={error}
          onReload={refresh}
          onNotify={notify}
        />
      )}

      {tab === 'assignments' && <AssignmentsTab onNotify={notify} />}

      {tab === 'invitations' && (
        <InvitationsTab departments={org.departments} onNotify={notify} onDataChanged={refresh} />
      )}

      {tab === 'deactivated' && (
        <DirectoryTab
          title="Deactivated accounts"
          description="Accounts that can no longer sign in. Reactivate one, or review its preserved records before reassigning them."
          departments={org.departments}
          branchOptions={branchOptions}
          initialStatus="inactive"
          lockStatus
          onNotify={notify}
          onDataChanged={refresh}
        />
      )}

      <SectionCard title="How access is decided" description="Visibility in the sidebar is never authorization.">
        <ul className="grid grid-cols-1 gap-2 text-[11px] text-slate-600 dark:text-slate-300 sm:grid-cols-2">
          <li>Every request re-reads the account, its status and session version from the database.</li>
          <li>Role, company, branch and assignment scope are checked on the server for each record.</li>
          <li>Bulk actions and CSV export use the same permission checks as single-record actions.</li>
          <li>Deactivation revokes sessions immediately and never deletes historical records.</li>
        </ul>
      </SectionCard>
    </div>
  );
};
