import React, { useCallback, useEffect, useState } from 'react';
import { Copy, MailPlus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { ConfirmDialog, EmptyState, ErrorState, LoadingSkeleton, SectionCard, cn } from '../../ui';
import { userManagementApi, ROLE_OPTIONS, COMPANY_OPTIONS, type Department, type Invitation, type Page } from './api';
import { ErrorNote, Field, GhostButton, PrimaryButton, RoleBadge, formatWhen, inputClass } from './bits';

const STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;

export const InvitationsTab: React.FC<{
  departments: Department[];
  initialStatus?: string;
  onNotify: (title: string, message: string, tone?: 'success' | 'warning' | 'info') => void;
  onDataChanged: () => void;
}> = ({ departments, initialStatus = 'pending', onNotify, onDataChanged }) => {
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [data, setData] = useState<Page<Invitation> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<{ email: string; url: string } | null>(null);
  const [confirm, setConfirm] = useState<Invitation | null>(null);

  const [form, setForm] = useState({ email: '', fullName: '', role: 'coordinator', company: 'RWC', branch: 'Colombo', departmentId: '' });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { setStatus(initialStatus); setPage(1); }, [initialStatus]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await userManagementApi.invitations({ status: status || undefined, page, pageSize }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load invitations.');
    } finally {
      setLoading(false);
    }
  }, [status, page, pageSize]);

  useEffect(() => { void load(); }, [load]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('create');
    setFormError(null);
    try {
      const result = await userManagementApi.invite({
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        role: form.role,
        company: form.company || undefined,
        branch: form.branch.trim() || undefined,
        departmentId: form.departmentId || null,
      });
      setInviteLink({ email: result.email, url: result.inviteUrl });
      setForm({ email: '', fullName: '', role: 'coordinator', company: 'RWC', branch: 'Colombo', departmentId: '' });
      onNotify('Invitation created', `A one-time activation link is ready for ${result.email}.`, 'success');
      setStatus('pending');
      setPage(1);
      await load();
      onDataChanged();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'The invitation could not be created.');
    } finally {
      setBusy(null);
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      onNotify('Link copied', 'Share it through a secure channel. It expires and can be used once.', 'success');
    } catch {
      onNotify('Copy failed', 'Select the link manually and copy it.', 'warning');
    }
  };

  const resend = async (invitation: Invitation) => {
    setBusy(invitation.id);
    try {
      const result = await userManagementApi.resendInvite(invitation.id);
      setInviteLink({ email: invitation.email, url: result.inviteUrl });
      onNotify('Invitation renewed', `A fresh one-time link is ready for ${invitation.email}.`, 'success');
      await load();
      onDataChanged();
    } catch (cause) {
      onNotify('Resend failed', cause instanceof Error ? cause.message : 'The invitation could not be renewed.', 'warning');
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (invitation: Invitation) => {
    setBusy(invitation.id);
    try {
      await userManagementApi.revokeInvite(invitation.id);
      onNotify('Invitation revoked', `${invitation.email} can no longer activate an account with that link.`, 'success');
      await load();
      onDataChanged();
    } catch (cause) {
      onNotify('Revoke failed', cause instanceof Error ? cause.message : 'The invitation could not be revoked.', 'warning');
    } finally {
      setBusy(null);
    }
  };

  const items = data?.items || [];

  return (
    <div className="space-y-4">
      <SectionCard title="Send an invitation" description="Creates a single-use activation link. Only the hash is stored on the server; the link is shown once.">
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" onSubmit={send}>
          {formError && <div className="sm:col-span-2 xl:col-span-4"><ErrorNote message={formError} /></div>}
          <Field label="Full name" required>
            <input className={inputClass} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required maxLength={255} />
          </Field>
          <Field label="Email" required>
            <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Role" required>
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
            <input className={inputClass} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} maxLength={100} />
          </Field>
          <Field label="Department">
            <select className={inputClass} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">Unassigned</option>
              {departments.filter((department) => department.active).map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <PrimaryButton type="submit" disabled={busy === 'create'}>
              <MailPlus className="h-3.5 w-3.5" /> {busy === 'create' ? 'Creating…' : 'Create invitation'}
            </PrimaryButton>
          </div>
        </form>
        {inviteLink && (
          <div className="mt-3 rounded-xl border border-teal-500/30 bg-teal-500/5 p-3">
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Activation link for {inviteLink.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-2 py-1.5 text-[11px] text-slate-700 dark:bg-slate-950 dark:text-slate-200">{inviteLink.url}</code>
              <GhostButton onClick={() => void copy(inviteLink.url)}><Copy className="h-3.5 w-3.5" /> Copy</GhostButton>
              <GhostButton onClick={() => setInviteLink(null)}>Dismiss</GhostButton>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Invitations"
        description="Pending links expire automatically. Accepted links are single use and cannot be replayed."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Invitation status" className={cn(inputClass, 'w-auto')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              {STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <GhostButton onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
            </GhostButton>
          </div>
        }
      >
        {error && <ErrorState message={error} onRetry={() => void load()} />}
        {loading && !data ? <LoadingSkeleton rows={5} /> : items.length === 0 ? (
          <EmptyState title="No invitations in this state" description="Create one above, or switch the status filter." />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {items.map((invitation) => {
              const pending = invitation.status === 'pending';
              return (
                <li key={invitation.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {invitation.fullName}
                      <RoleBadge role={invitation.role} />
                      <span className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        pending ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
                      )}>
                        {invitation.status || 'pending'}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {invitation.email} · {invitation.company || 'All companies'} · {invitation.departmentName || 'No department'}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {invitation.status === 'accepted'
                        ? `Accepted ${formatWhen(invitation.acceptedAt)}`
                        : invitation.status === 'revoked'
                          ? `Revoked ${formatWhen(invitation.revokedAt)}`
                          : `Expires ${formatWhen(invitation.expiresAt)}`}
                      {invitation.invitedByName ? ` · invited by ${invitation.invitedByName}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pending && (
                      <>
                        <GhostButton disabled={busy === invitation.id} onClick={() => void resend(invitation)}>
                          <Send className="h-3.5 w-3.5" /> New link
                        </GhostButton>
                        <GhostButton disabled={busy === invitation.id} onClick={() => setConfirm(invitation)}>
                          <Trash2 className="h-3.5 w-3.5" /> Revoke
                        </GhostButton>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-white/10">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {data ? `${data.total.toLocaleString()} invitation${data.total === 1 ? '' : 's'} · page ${data.page} of ${data.pages}` : 'Loading…'}
          </p>
          <div className="flex gap-2">
            <GhostButton disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</GhostButton>
            <GhostButton disabled={!data || page >= data.pages} onClick={() => setPage((value) => value + 1)}>Next</GhostButton>
          </div>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={`Revoke the invitation for ${confirm?.email || ''}?`}
        description="The activation link stops working immediately. The person would need a new invitation to join."
        confirmLabel="Revoke invitation"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => { const current = confirm; setConfirm(null); if (current) void revoke(current); }}
      />
    </div>
  );
};
