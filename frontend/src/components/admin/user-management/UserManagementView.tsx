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
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 dark:border-white/10 dark:bg-[#0f1b26] dark:text-slate-200 dark:hover:bg-white/5"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      {error && <ErrorState message={error} onRetry={refresh} />}

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

      <nav aria-label="User management sections" className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-white/10 dark:bg-[#0f1b26] md:grid-cols-3 xl:grid-cols-6">
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
