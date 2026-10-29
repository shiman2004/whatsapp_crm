import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, UsersRound } from 'lucide-react';
import { ConfirmDialog, EmptyState, ErrorState, LoadingSkeleton, SearchInput, SectionCard, cn } from '../../ui';
import {
  userManagementApi, COMPANY_OPTIONS,
  type Department, type ManagedUser, type Team, type TeamMember,
} from './api';
import { ErrorNote, Field, GhostButton, PrimaryButton, formatWhen, inputClass } from './bits';

export const TeamsTab: React.FC<{
  departments: Department[];
  teams: Team[];
  members: TeamMember[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onNotify: (title: string, message: string, tone?: 'success' | 'warning' | 'info') => void;
}> = ({ departments, teams, members, loading, error, onReload, onNotify }) => {
  const [departmentForm, setDepartmentForm] = useState({ name: '', company: '', branch: '', description: '' });
  const [teamForm, setTeamForm] = useState({ name: '', departmentId: '', company: '', branch: '', leadUserId: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [candidates, setCandidates] = useState<ManagedUser[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; run: () => Promise<void> }>(null);

  const teamMembers = useMemo(() => {
    const map = new Map<string, TeamMember[]>();
    for (const member of members) {
      const list = map.get(member.teamId) || [];
      list.push(member);
      map.set(member.teamId, list);
    }
    return map;
  }, [members]);

  useEffect(() => {
    if (!editingTeam) return;
    setSelectedMembers((teamMembers.get(editingTeam.id) || []).map((member) => member.userId));
  }, [editingTeam, teamMembers]);

  useEffect(() => {
    if (!editingTeam) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const result = await userManagementApi.users({ search: memberSearch.trim() || undefined, status: 'active', pageSize: 20, sort: 'name', order: 'asc' });
        if (active) setCandidates(result.items);
      } catch {
        if (active) setCandidates([]);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [editingTeam, memberSearch]);

  const createDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('department');
    setFormError(null);
    try {
      await userManagementApi.createDepartment({
        name: departmentForm.name.trim(),
        company: departmentForm.company || undefined,
        branch: departmentForm.branch.trim() || undefined,
        description: departmentForm.description.trim() || undefined,
      });
      setDepartmentForm({ name: '', company: '', branch: '', description: '' });
      onNotify('Department created', 'It is available for user assignment now.', 'success');
      onReload();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'The department could not be created.');
    } finally {
      setBusy(null);
    }
  };

  const createTeam = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('team');
    setFormError(null);
    try {
      await userManagementApi.createTeam({
        name: teamForm.name.trim(),
        departmentId: teamForm.departmentId,
        company: teamForm.company || undefined,
        branch: teamForm.branch.trim() || undefined,
        leadUserId: teamForm.leadUserId || undefined,
      });
      setTeamForm({ name: '', departmentId: '', company: '', branch: '', leadUserId: '' });
      onNotify('Team created', 'Add members to make the team operational.', 'success');
      onReload();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'The team could not be created.');
    } finally {
      setBusy(null);
    }
  };

  const saveMembers = async () => {
    if (!editingTeam) return;
    setBusy('members');
    setFormError(null);
    try {
      const result = await userManagementApi.setTeamMembers(editingTeam.id, selectedMembers);
      onNotify('Team updated', `${result.members} member${result.members === 1 ? '' : 's'} saved.`, 'success');
      setEditingTeam(null);
      setMemberSearch('');
      onReload();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Team members could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  const toggleDepartment = (department: Department) => {
    if (department.active) {
      setConfirm({
        title: `Deactivate ${department.name}?`,
        description: 'Existing users keep their history. The department is no longer offered for new assignments.',
        run: async () => {
          try {
            await userManagementApi.updateDepartment(department.id, { active: false });
            onNotify('Department deactivated', `${department.name} is now inactive.`, 'warning');
            onReload();
          } catch (cause) {
            onNotify('Update failed', cause instanceof Error ? cause.message : 'The department could not be updated.', 'warning');
          }
        },
      });
    } else {
      void userManagementApi.updateDepartment(department.id, { active: true })
        .then(() => { onNotify('Department reactivated', `${department.name} can be assigned again.`, 'success'); onReload(); })
        .catch((cause) => onNotify('Update failed', cause instanceof Error ? cause.message : 'The department could not be updated.', 'warning'));
    }
  };

  const candidateRows = useMemo(() => {
    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    // Keep already selected members visible even when the search filters them out.
    for (const member of editingTeam ? teamMembers.get(editingTeam.id) || [] : []) {
      if (!byId.has(member.userId)) {
        byId.set(member.userId, {
          id: member.userId, fullName: member.fullName, email: member.email, role: member.role,
        } as ManagedUser);
      }
    }
    return [...byId.values()];
  }, [candidates, editingTeam, teamMembers]);

  return (
    <div className="space-y-4">
      {formError && <ErrorNote message={formError} />}
      {error && <ErrorState message={error} onRetry={onReload} />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Departments" description="Company-scoped groups used for assignment and permission scope.">
          {loading && departments.length === 0 ? <LoadingSkeleton rows={4} /> : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {departments.length === 0 && <li className="py-3 text-xs text-slate-500 dark:text-slate-400">No departments yet.</li>}
              {departments.map((department) => (
                <li key={department.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {department.name}
                      {!department.active && <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-300">Inactive</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {department.company || 'All companies'} · {department.branch || 'All branches'} · {department.userCount} member{department.userCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <GhostButton onClick={() => toggleDepartment(department)}>{department.active ? 'Deactivate' : 'Reactivate'}</GhostButton>
                </li>
              ))}
            </ul>
          )}
          <form className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 dark:border-white/10" onSubmit={createDepartment}>
            <div className="sm:col-span-2"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">New department</p></div>
            <Field label="Name" required>
              <input className={inputClass} value={departmentForm.name} onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })} required maxLength={120} />
            </Field>
            <Field label="Company">
              <select className={inputClass} value={departmentForm.company} onChange={(e) => setDepartmentForm({ ...departmentForm, company: e.target.value })}>
                <option value="">All companies</option>
                {COMPANY_OPTIONS.map((company) => <option key={company} value={company}>{company}</option>)}
              </select>
            </Field>
            <Field label="Branch">
              <input className={inputClass} value={departmentForm.branch} onChange={(e) => setDepartmentForm({ ...departmentForm, branch: e.target.value })} maxLength={100} />
            </Field>
            <Field label="Description">
              <input className={inputClass} value={departmentForm.description} onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })} maxLength={1000} />
            </Field>
            <div className="sm:col-span-2">
              <PrimaryButton type="submit" disabled={busy === 'department'}>
                <Plus className="h-3.5 w-3.5" /> {busy === 'department' ? 'Creating…' : 'Create department'}
              </PrimaryButton>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Teams" description="Optional sub-groups inside a department, with a lead and explicit members.">
          {loading && teams.length === 0 ? <LoadingSkeleton rows={4} /> : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {teams.length === 0 && <li className="py-3 text-xs text-slate-500 dark:text-slate-400">No teams yet.</li>}
              {teams.map((team) => {
                const list = teamMembers.get(team.id) || [];
                return (
                  <li key={team.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                          <UsersRound className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {team.name}
                          {!team.active && <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-300">Inactive</span>}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {departments.find((department) => department.id === team.departmentId)?.name || 'No department'}
                          {team.leadName ? ` · lead ${team.leadName}` : ''} · {team.memberCount} member{team.memberCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <GhostButton onClick={() => { setEditingTeam(team); setFormError(null); }}>Members</GhostButton>
                    </div>
                    {editingTeam?.id === team.id && (
                      <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                        <SearchInput value={memberSearch} onValueChange={setMemberSearch} placeholder="Search active users…" />
                        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                          {candidateRows.map((candidate) => (
                            <li key={candidate.id}>
                              <label className="flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5">
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                  checked={selectedMembers.includes(candidate.id)}
                                  onChange={(event) => setSelectedMembers((current) => (event.target.checked
                                    ? [...current, candidate.id]
                                    : current.filter((id) => id !== candidate.id)))}
                                />
                                <span className="min-w-0 truncate">{candidate.fullName} · {candidate.email}</span>
                              </label>
                            </li>
                          ))}
                          {candidateRows.length === 0 && <li className="px-2 py-2 text-[11px] text-slate-500 dark:text-slate-400">No matching active users.</li>}
                        </ul>
                        <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">Only active members of the same company can be added; the server rejects cross-company members.</p>
                        <div className="mt-2 flex gap-2">
                          <PrimaryButton onClick={() => void saveMembers()} disabled={busy === 'members'}>
                            {busy === 'members' ? 'Saving…' : `Save ${selectedMembers.length} member${selectedMembers.length === 1 ? '' : 's'}`}
                          </PrimaryButton>
                          <GhostButton onClick={() => { setEditingTeam(null); setMemberSearch(''); }}>Cancel</GhostButton>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {departments.length === 0 ? (
            <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">Create a department before adding teams.</p>
          ) : (
            <form className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 dark:border-white/10" onSubmit={createTeam}>
              <div className="sm:col-span-2"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">New team</p></div>
              <Field label="Name" required>
                <input className={inputClass} value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} required maxLength={120} />
              </Field>
              <Field label="Department" required>
                <select
                  className={inputClass}
                  value={teamForm.departmentId}
                  onChange={(e) => {
                    const department = departments.find((item) => item.id === e.target.value);
                    setTeamForm({
                      ...teamForm,
                      departmentId: e.target.value,
                      company: department?.company || teamForm.company,
                      branch: department?.branch || teamForm.branch,
                    });
                  }}
                  required
                >
                  <option value="">Select a department</option>
                  {departments.filter((department) => department.active).map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Branch">
                <input className={inputClass} value={teamForm.branch} onChange={(e) => setTeamForm({ ...teamForm, branch: e.target.value })} maxLength={100} />
              </Field>
              <Field label="Team lead">
                <select className={inputClass} value={teamForm.leadUserId} onChange={(e) => setTeamForm({ ...teamForm, leadUserId: e.target.value })}>
                  <option value="">No lead</option>
                  {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.fullName}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <PrimaryButton type="submit" disabled={busy === 'team'}>
                  <Plus className="h-3.5 w-3.5" /> {busy === 'team' ? 'Creating…' : 'Create team'}
                </PrimaryButton>
              </div>
            </form>
          )}
        </SectionCard>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        Teams changed here are read by the assignment screens; permission scope remains enforced by the server policy.
      </p>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title || ''}
        description={confirm?.description || ''}
        confirmLabel="Confirm"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { const current = confirm; setConfirm(null); if (current) void current.run(); }}
      />
    </div>
  );
};
