import React, { useCallback, useEffect, useState } from 'react';
import { Activity, KeyRound, LogOut, RefreshCw, ShieldCheck, ShieldOff, UserCheck, UserX, Eye, EyeOff, Copy, Check, Sparkles } from 'lucide-react';
import { ConfirmDialog, FormDrawer, InlineFeedback } from '../../ui';
import { userManagementApi, ROLE_OPTIONS, COMPANY_OPTIONS, type UserDetail, type UserInput } from './api';
import { ErrorNote, Field, GhostButton, PrimaryButton, RoleBadge, CompanyBadge, BranchBadge, UserStatusBadge, formatWhen, inputClass, timeAgo } from './bits';
import type { Department } from './api';

const generateRandomPin = () => Math.floor(1000 + Math.random() * 9000).toString();

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
  const [showDrawerPin, setShowDrawerPin] = useState(false);
  const [showDrawerPassword, setShowDrawerPassword] = useState(false);
  const [showResetPin, setShowResetPin] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<'pin' | 'password' | null>(null);
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
            <CompanyBadge company={user.company} />
            <BranchBadge branch={user.branch} />
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
                    <option value="ALL">✨ ALL (All Companies — Alpha Health Group)</option>
                    <option value="RWC">🌿 RWC (Royal Wellness Center)</option>
                    <option value="CRAS">🎓 CRAS (College of Royal Aesthetic Studies)</option>
                    <option value="AHC">✦ AHC (Alpha Health Consultancy)</option>
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

          {/* Super Admin Only: User Credentials Details Area */}
          {detail.credentials && (
            <section className="rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-50/80 to-amber-100/40 p-4 dark:border-amber-500/30 dark:from-amber-950/30 dark:to-[#171f24] space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                  <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Account Credentials <span className="text-[10px] lowercase font-normal opacity-75">(Super Admin View)</span>
                </h3>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Visible exclusively to Super Administrators. You can view, copy, or reset login credentials.
              </p>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {/* PIN Code Box */}
                <div className="rounded-xl border border-amber-200/80 bg-white p-3 dark:border-slate-800 dark:bg-[#111b21] space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold flex items-center gap-1">
                      <KeyRound className="h-3 w-3 text-amber-500" /> PIN Code
                    </span>
                    {detail.credentials.pin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowDrawerPin(!showDrawerPin)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
                          title={showDrawerPin ? 'Hide PIN' : 'Reveal PIN'}
                        >
                          {showDrawerPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(detail.credentials!.pin!);
                            setCopiedField('pin');
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded cursor-pointer"
                          title="Copy PIN"
                        >
                          {copiedField === 'pin' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-base font-mono font-bold text-slate-900 dark:text-slate-100 tracking-wider">
                    {detail.credentials.pin ? (
                      showDrawerPin ? detail.credentials.pin : '••••'
                    ) : detail.credentials.pinIsHashed ? (
                      <span className="text-xs font-sans font-medium text-amber-700 dark:text-amber-400">
                        Configured (Hashed — Reset below to reveal)
                      </span>
                    ) : (
                      <span className="text-xs font-sans font-normal text-slate-400">Not configured</span>
                    )}
                  </div>
                </div>

                {/* Web Password Box */}
                <div className="rounded-xl border border-teal-200/80 bg-white p-3 dark:border-slate-800 dark:bg-[#111b21] space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold flex items-center gap-1">
                      <KeyRound className="h-3 w-3 text-teal-500" /> Web Password
                    </span>
                    {detail.credentials.password && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowDrawerPassword(!showDrawerPassword)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
                          title={showDrawerPassword ? 'Hide password' : 'Reveal password'}
                        >
                          {showDrawerPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(detail.credentials!.password!);
                            setCopiedField('password');
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded cursor-pointer"
                          title="Copy Password"
                        >
                          {copiedField === 'password' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-base font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
                    {detail.credentials.password ? (
                      showDrawerPassword ? detail.credentials.password : '••••••••'
                    ) : detail.credentials.passwordIsHashed ? (
                      <span className="text-xs font-sans font-medium text-teal-700 dark:text-teal-400">
                        Configured (Hashed — Reset below to reveal)
                      </span>
                    ) : (
                      <span className="text-xs font-sans font-normal text-slate-400">Not configured</span>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

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
                  await load();
                  onNotify('Credentials reset', `New credentials saved for ${user.fullName}. Existing sessions were revoked.`, 'success');
                });
              }}
            >
              <Field label="New password" hint="At least 12 characters. Leave blank to keep.">
                <div className="relative flex items-center">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`${inputClass} pr-9`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={12}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                    title={showResetPassword ? 'Hide password' : 'Show password'}
                  >
                    {showResetPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </Field>
              <Field label="New PIN" hint="4–10 characters. Click auto to generate.">
                <div className="relative flex items-center">
                  <input
                    type={showResetPin ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`${inputClass} pr-16 font-mono tracking-wider`}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    minLength={4}
                    maxLength={10}
                    placeholder="e.g. 5821"
                  />
                  <div className="absolute right-2 flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setPin(generateRandomPin())}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer flex items-center gap-0.5"
                      title="Auto-generate 4-digit PIN"
                    >
                      <Sparkles className="h-3 w-3" /> Auto
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetPin(!showResetPin)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                      title={showResetPin ? 'Hide PIN' : 'Show PIN'}
                    >
                      {showResetPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
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
