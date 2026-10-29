import React, { useCallback, useEffect, useState } from 'react';
import { Activity, KeyRound, LogOut, RefreshCw, ShieldCheck, ShieldOff, UserCheck, UserX } from 'lucide-react';
import { ConfirmDialog, FormDrawer, InlineFeedback } from '../../ui';
import { userManagementApi, ROLE_OPTIONS, COMPANY_OPTIONS, type UserDetail, type UserInput } from './api';
import { ErrorNote, Field, GhostButton, PrimaryButton, RoleBadge, UserStatusBadge, formatWhen, inputClass, timeAgo } from './bits';
import type { Department } from './api';

export const UserDetailDrawer: React.FC<{
  userId: string | null;
  departments: Department[];
  onClose: () => void;
  onChanged: () => void;
  onNotify: (title: string, message: string, tone?: 'success' | 'warning' | 'info') => void;
}> = ({ userId, departments, onClose, onChanged, onNotify }) => {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UserInput>({});
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; destructive?: boolean; run: () => Promise<void> }>(null);

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
      setError(cause instanceof Error ? cause.message : 'Unable to load this user.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setDetail(null);
    setEditing(false);
    setPassword('');
    setPin('');
    void load();
  }, [load]);

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

  const user = detail?.user;

  return (
    <FormDrawer
      open={Boolean(userId)}
      title={user ? user.fullName : 'Account detail'}
      description={user ? `${user.email} · ${user.roleLabel}` : 'Loading account…'}
      onClose={onClose}
      widthClass="max-w-2xl"
      footer={
        user ? (
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {user.active ? (
                <>
                  <GhostButton
                    disabled={busy !== null}
                    onClick={() => setConfirm({
                      title: 'Suspend this account?',
                      description: 'The account keeps its records, but every session is revoked and sign-in is blocked until an administrator reactivates it.',
                      destructive: true,
                      run: async () => act('suspend', async () => {
                        await userManagementApi.setStatus(user.id, 'suspend', 'Suspended from user management');
                        onNotify('Account suspended', `${user.fullName} can no longer sign in.`, 'warning');
                      }),
                    })}
                  >
                    <ShieldOff className="h-3.5 w-3.5" /> Suspend
                  </GhostButton>
                  <GhostButton
                    disabled={busy !== null}
                    onClick={() => setConfirm({
                      title: 'Deactivate this account?',
                      description: 'Sign-in is blocked immediately and all sessions are revoked. Assigned records remain untouched and can be reassigned.',
                      destructive: true,
                      run: async () => act('deactivate', async () => {
                        await userManagementApi.setStatus(user.id, 'deactivate', 'Deactivated from user management');
                        onNotify('Account deactivated', `${user.fullName} was deactivated.`, 'warning');
                      }),
                    })}
                  >
                    <UserX className="h-3.5 w-3.5" /> Deactivate
                  </GhostButton>
                </>
              ) : (
                <PrimaryButton
                  disabled={busy !== null}
                  onClick={() => act('activate', async () => {
                    await userManagementApi.setStatus(user.id, 'activate');
                    onNotify('Account activated', `${user.fullName} can sign in again.`, 'success');
                  })}
                >
                  <UserCheck className="h-3.5 w-3.5" /> Activate
                </PrimaryButton>
              )}
              {user.locked && (
                <GhostButton
                  disabled={busy !== null}
                  onClick={() => act('unlock', async () => {
                    await userManagementApi.setStatus(user.id, 'unlock');
                    onNotify('Account unlocked', `${user.fullName} may sign in again.`, 'success');
                  })}
                >
                  <KeyRound className="h-3.5 w-3.5" /> Unlock
                </GhostButton>
              )}
            </div>
            <GhostButton
              disabled={busy !== null || user.activeSessions === 0}
              onClick={() => setConfirm({
                title: 'Revoke every session?',
                description: `All ${user.activeSessions} active device session${user.activeSessions === 1 ? '' : 's'} stop working immediately. The user must sign in again.`,
                destructive: true,
                run: async () => act('revoke', async () => {
                  await userManagementApi.revokeSessions(user.id);
                  onNotify('Sessions revoked', `All sessions for ${user.fullName} were revoked.`, 'success');
                }),
              })}
            >
              <LogOut className="h-3.5 w-3.5" /> Revoke sessions
            </GhostButton>
          </div>
        ) : undefined
      }
    >
      {error && <ErrorNote message={error} />}
      {loading && !detail && <p className="text-xs text-slate-500 dark:text-slate-400">Loading account…</p>}
      {user && detail && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <UserStatusBadge status={user.status} />
            <RoleBadge role={user.role} label={user.roleLabel} />
            {user.marketingAccess && <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">Marketing access</span>}
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{user.company || '—'} · {user.branch || 'No branch'}</span>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div><dt className="text-slate-500 dark:text-slate-400">Employee ID</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{user.employeeId || '—'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Department</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{user.departmentName || 'Unassigned'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Last sign-in</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{user.lastLoginAt ? `${formatWhen(user.lastLoginAt)} (${timeAgo(user.lastLoginAt)})` : 'Never'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Created</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{formatWhen(user.createdAt)}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Assigned leads</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{user.leadCount}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Marketing contacts</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{user.marketingCount}</dd></div>
          </dl>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Profile & scope</h3>
              <GhostButton onClick={() => setEditing((value) => !value)}>{editing ? 'Cancel' : 'Edit'}</GhostButton>
            </div>
            {editing ? (
              <form
                className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void act('save', async () => {
                    await userManagementApi.updateUser(user.id, form);
                    setEditing(false);
                    onNotify('Account updated', `${form.fullName || user.fullName}'s profile was saved.`, 'success');
                  });
                }}
              >
                <Field label="Full name" required>
                  <input className={inputClass} value={form.fullName || ''} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
                </Field>
                <Field label="Email" required>
                  <input type="email" className={inputClass} value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </Field>
                <Field label="Phone">
                  <input className={inputClass} value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
                <Field label="Employee ID">
                  <input className={inputClass} value={form.employeeId || ''} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
                </Field>
                <Field label="Role">
                  <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>)}
                  </select>
                </Field>
                <Field label="Company">
                  <select className={inputClass} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
                    {COMPANY_OPTIONS.map((company) => <option key={company} value={company}>{company}</option>)}
                  </select>
                </Field>
                <Field label="Branch">
                  <input className={inputClass} value={form.branch || ''} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
                </Field>
                <Field label="Department">
                  <select
                    className={inputClass}
                    value={form.departmentId || ''}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {departments.filter((department) => department.active).map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    checked={Boolean(form.marketingAccess)}
                    onChange={(e) => setForm({ ...form, marketingAccess: e.target.checked })}
                  />
                  Public contact marketing access
                </label>
                <div className="sm:col-span-2">
                  <PrimaryButton type="submit" disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save profile'}</PrimaryButton>
                </div>
              </form>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.teams.length === 0 && <span className="text-xs text-slate-500 dark:text-slate-400">No team membership.</span>}
                {detail.teams.map((team) => (
                  <span key={team.id} className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">
                    {team.name}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Reset credentials</h3>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">A credential reset revokes every existing session for this account.</p>
            <form
              className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!password && !pin) return;
                void act('credentials', async () => {
                  await userManagementApi.resetCredentials(user.id, { ...(password ? { password } : {}), ...(pin ? { pin } : {}) });
                  setPassword('');
                  setPin('');
                  onNotify('Credentials reset', `New credentials saved for ${user.fullName}. Existing sessions were revoked.`, 'success');
                });
              }}
            >
              <Field label="New password" hint="At least 12 characters. Leave blank to keep.">
                <input
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={12}
                />
              </Field>
              <Field label="New PIN" hint="4–10 characters. Leave blank to keep.">
                <input
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  minLength={4}
                  maxLength={10}
                />
              </Field>
              <div className="sm:col-span-2">
                <GhostButton type="submit" disabled={busy === 'credentials' || (!password && !pin)}>
                  <KeyRound className="h-3.5 w-3.5" /> {busy === 'credentials' ? 'Applying…' : 'Reset credentials'}
                </GhostButton>
              </div>
            </form>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Activity className="h-3.5 w-3.5" /> Sessions
            </h3>
            <ul className="mt-2 space-y-2">
              {detail.sessions.length === 0 && <li className="text-xs text-slate-500 dark:text-slate-400">No recorded sessions.</li>}
              {detail.sessions.map((session) => (
                <li key={session.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{session.device}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {session.ip || 'unknown IP'} · started {formatWhen(session.createdAt)}
                      {session.revokedAt ? ` · revoked ${formatWhen(session.revokedAt)}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0">
                    {session.revokedAt
                      ? <span className="text-[10px] font-semibold uppercase text-slate-400">Revoked</span>
                      : (
                        <GhostButton
                          disabled={busy !== null}
                          onClick={() => act(`session-${session.id}`, async () => {
                            await userManagementApi.revokeSession(session.id);
                            onNotify('Session revoked', 'That device must sign in again.', 'success');
                          })}
                        >
                          <RefreshCw className="h-3 w-3" /> Revoke
                        </GhostButton>
                      )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recent security activity</h3>
              <a
                href="#/security/policies"
                onClick={onClose}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#128C7E] dark:text-[#25D366] hover:underline"
                title="Manage granular permissions & policies in Security & Access"
              >
                <ShieldCheck className="h-3 w-3" /> Security & Access
              </a>
            </div>
            <ul className="mt-2 space-y-1.5">
              {detail.activity.length === 0 && <li className="text-xs text-slate-500 dark:text-slate-400">No recorded activity.</li>}
              {detail.activity.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">{event.action}</span> · {event.outcome}
                  </span>
                  <time className="shrink-0 text-slate-400 dark:text-slate-500">{formatWhen(event.createdAt)}</time>
                </li>
              ))}
            </ul>
          </section>

          {busy && <InlineFeedback tone="info">Applying change…</InlineFeedback>}
        </div>
      )}

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
    </FormDrawer>
  );
};
