import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Lock, RotateCcw, Save, ShieldCheck, UserCog } from 'lucide-react';
import { securityApi, SecurityApiError } from './api';
import {
  Badge, ChangeList, ConfirmDialog, Drawer, ErrorState, Notice, SCOPE_LABEL, ScopePill,
  SkeletonBlock, Spinner, SourceBadge, cx,
} from './bits';
import type { CapabilityMeta, ModuleInfo, Overrides, PolicyCapability, Preview, Scope, UserDetail } from './types';

type DraftEffect = 'inherit' | 'allow' | 'deny';
type Draft = Record<string, DraftEffect>;

const toDraft = (overrides: Overrides): Draft => {
  const draft: Draft = {};
  for (const [key, value] of Object.entries(overrides || {})) draft[key] = value.effect;
  return draft;
};

const fromDraft = (draft: Draft): Overrides => {
  const overrides: Overrides = {};
  for (const [key, value] of Object.entries(draft)) if (value !== 'inherit') overrides[key] = { effect: value };
  return overrides;
};

const canonical = (overrides: Overrides) => JSON.stringify(Object.keys(overrides).sort().map(key => [key, overrides[key].effect]));

const EFFECT_OPTIONS: { value: DraftEffect; label: string }[] = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'allow', label: 'Allow' },
  { value: 'deny', label: 'Deny' },
];

const EffectSelector: React.FC<{ value: DraftEffect; allow: boolean; label: string; disabled?: boolean; onChange: (value: DraftEffect) => void }> = ({ value, allow, label, disabled, onChange }) => (
  <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-[11px] font-semibold dark:border-slate-700">
    {EFFECT_OPTIONS.filter(option => allow || option.value !== 'allow').map(option => (
      <button
        key={option.value}
        type="button"
        aria-pressed={value === option.value}
        disabled={disabled}
        onClick={() => onChange(option.value)}
        className={cx(
          'px-2.5 py-1.5 motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          value === option.value
            ? option.value === 'allow'
              ? 'bg-emerald-600 text-white'
              : option.value === 'deny'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900'
            : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

// Allow is only offered inside modules the role already works in: the API rejects
// a delegated capability from any other module with OUTSIDE_ROLE.
function roleModules(detail: UserDetail): Set<string> {
  return new Set(detail.modules
    .filter(module => module.capabilities.some(meta => detail.roleCapabilities.includes(meta.key)))
    .map(module => module.id));
}

function relevantModules(detail: UserDetail, owned: Set<string>): ModuleInfo[] {
  return detail.modules.filter(module =>
    owned.has(module.id) || module.capabilities.some(meta => detail.overrides[meta.key]));
}

const Section: React.FC<{ letter: string; title: string; hint?: string; children: React.ReactNode }> = ({ letter, title, hint, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-[11px] font-bold text-indigo-600 dark:text-indigo-300">{letter}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        {hint && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{hint}</p>}
        <div className="mt-3">{children}</div>
      </div>
    </div>
  </section>
);

const CapabilityRow: React.FC<{
  meta: CapabilityMeta;
  decision: PolicyCapability | undefined;
  value: DraftEffect;
  allow: boolean;
  disabled?: boolean;
  onChange: (value: DraftEffect) => void;
}> = ({ meta, decision, value, allow, disabled, onChange }) => (
  <div className="grid grid-cols-1 items-center gap-2 border-t border-slate-100 px-3 py-2.5 first:border-t-0 dark:border-slate-800 sm:grid-cols-[minmax(0,1fr)_auto]">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{meta.label}</span>
        {meta.immutable && <Badge tone="rose"><Lock className="h-2.5 w-2.5" />Protected</Badge>}
        {allow && <Badge tone="indigo">Delegatable</Badge>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {decision?.allowed ? <Badge tone="emerald">Effective: granted</Badge> : <Badge tone="slate">Effective: not granted</Badge>}
        {decision?.source && <SourceBadge source={decision.source} />}
        {decision?.allowed && decision.scope && <ScopePill scope={decision.scope} />}
      </div>
    </div>
    <div className="flex justify-start sm:justify-end">
      {meta.immutable ? (
        <span className="text-[11px] text-slate-400 dark:text-slate-500">Immutable policy</span>
      ) : (
        <EffectSelector value={value} allow={allow} label={`${meta.label} user override`} disabled={disabled} onChange={onChange} />
      )}
    </div>
  </div>
);

export const UserPermissionDrawer: React.FC<{
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ userId, onClose, onSaved }) => {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [scopeDraft, setScopeDraft] = useState<Scope>('own');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await securityApi.user(userId);
      setDetail(data);
      setDraft(toDraft(data.overrides));
      setScopeDraft(data.scope);
      setExpanded(Object.fromEntries(data.modules.map(module => [module.id, module.id === 'exam'])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this user.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const owned = useMemo(() => (detail ? roleModules(detail) : new Set<string>()), [detail]);
  const modules = useMemo(() => (detail ? relevantModules(detail, owned) : []), [detail, owned]);
  const overrides = fromDraft(draft);
  const dirty = detail !== null && !detail.self
    && (canonical(overrides) !== canonical(detail.overrides) || scopeDraft !== detail.scope);
  const locked = Boolean(detail?.self) || detail?.user.role === 'super_admin' || detail?.user.active === false;

  const setEffect = (key: string, value: DraftEffect) => setDraft(current => ({ ...current, [key]: value }));

  const requestClose = () => {
    if (dirty) setDiscardOpen(true);
    else onClose();
  };

  const requestPreview = async () => {
    if (!detail) return;
    setPreviewBusy(true);
    setSaveError(null);
    try {
      const data = await securityApi.preview({ subjectType: 'user', subjectId: userId, overrides, scope: scopeDraft });
      setReason('');
      setPreview(data);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to preview this change.');
    } finally {
      setPreviewBusy(false);
    }
  };

  const confirmSave = async () => {
    if (!detail || !preview) return;
    setSaving(true);
    setSaveError(null);
    try {
      await securityApi.updateUser(userId, {
        overrides,
        scope: scopeDraft,
        expectedRevision: preview.revision,
        reason: reason.trim() || undefined,
      });
      setPreview(null);
      onSaved();
    } catch (cause) {
      setSaveError(cause instanceof SecurityApiError && cause.status === 409
        ? `${cause.message} Preview again to load the current revision.`
        : cause instanceof Error ? cause.message : 'Unable to save permissions.');
    } finally {
      setSaving(false);
    }
  };

  const confirmReset = async () => {
    if (!detail) return;
    setSaving(true);
    setSaveError(null);
    try {
      await securityApi.resetUser(userId, detail.revision, reason.trim() || undefined);
      setResetOpen(false);
      onSaved();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to reset permissions.');
    } finally {
      setSaving(false);
    }
  };

  const grantedCount = detail ? Object.values(detail.policy.capabilities).filter(item => item.allowed).length : 0;
  const overrideCount = Object.keys(detail?.overrides || {}).length;

  return (
    <>
      <Drawer
        open
        title={detail?.user.fullName || 'User permissions'}
        subtitle={detail ? `${detail.user.email} · ${detail.roleLabel}` : 'Loading effective policy'}
        onClose={requestClose}
        footer={
          <div className="flex flex-col gap-2">
            {saveError && !preview && !resetOpen && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-200">{saveError}</div>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                {detail && detail.revision > 0 && !locked && (
                  <button
                    type="button"
                    onClick={() => { setReason(''); setSaveError(null); setResetOpen(true); }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />Reset to role defaults
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={requestClose} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
                <button
                  type="button"
                  onClick={requestPreview}
                  disabled={!dirty || previewBusy || locked}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {previewBusy ? <Spinner label="Previewing" /> : <><Save className="h-3.5 w-3.5" />Review &amp; save</>}
                </button>
              </div>
            </div>
          </div>
        }
      >
        {loading && !detail && <SkeletonBlock rows={10} />}
        {error && !detail && <ErrorState message={error} onRetry={load} />}

        {detail && (
          <div className="space-y-3">
            {detail.self && <Notice tone="rose">You are viewing your own profile. Self-elevation is blocked; permissions here cannot be changed by you.</Notice>}
            {detail.user.role === 'super_admin' && !detail.self && <Notice tone="rose"><span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Super Admin accounts are governed by immutable policy and cannot receive user overrides.</span></Notice>}
            {!detail.user.active && <Notice tone="amber">This account is disabled. Re-enable it before changing permissions.</Notice>}

            <Section letter="A" title="Identity & effective state" hint="Verified account data and the revision guard used for optimistic concurrency.">
              <dl className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                <div><dt className="text-slate-500 dark:text-slate-400">Role</dt><dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{detail.roleLabel}</dd></div>
                <div><dt className="text-slate-500 dark:text-slate-400">Department</dt><dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{detail.user.departmentLabel}</dd></div>
                <div><dt className="text-slate-500 dark:text-slate-400">Company</dt><dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{detail.user.company || '—'}</dd></div>
                <div><dt className="text-slate-500 dark:text-slate-400">Account</dt><dd className="mt-0.5">{detail.user.active ? <Badge tone="emerald">Active</Badge> : <Badge tone="rose">Disabled</Badge>}</dd></div>
                <div><dt className="text-slate-500 dark:text-slate-400">Permission revision</dt><dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{detail.revision}</dd></div>
                <div><dt className="text-slate-500 dark:text-slate-400">Stored overrides</dt><dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{overrideCount}</dd></div>
              </dl>
            </Section>

            <Section letter="B" title="Role baseline" hint="The registry defaults this account would have with no personal overrides.">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <Badge tone="indigo">{detail.role}</Badge>
                <span>{grantedCount} of {Object.keys(detail.policy.capabilities).length} capabilities currently granted</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span>Maximum scope {SCOPE_LABEL[detail.maxScope]}</span>
                {detail.maxScope === 'all' && <Badge tone="rose">Company-wide</Badge>}
              </div>
            </Section>

            <Section
              letter="C"
              title="Personal overrides"
              hint="Inherit leaves the role decision untouched. Deny always wins. Allow is only offered for the four delegatable exam draft capabilities."
            >
              <div className="space-y-2">
                {modules.map(module => {
                  const open = expanded[module.id] !== false;
                  const moduleOverrides = module.capabilities.filter(meta => overrides[meta.key]).length;
                  const allowModule = owned.has(module.id);
                  return (
                    <div key={module.id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setExpanded(current => ({ ...current, [module.id]: !open }))}
                        className="flex w-full items-center justify-between gap-2 bg-slate-50 px-3 py-2 text-left dark:bg-slate-950/40"
                      >
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{module.label}</span>
                          <Badge tone="neutral">{module.capabilities.length}</Badge>
                          {moduleOverrides > 0 && <Badge tone="amber">{moduleOverrides} override{moduleOverrides === 1 ? '' : 's'}</Badge>}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{open ? 'Hide' : 'Show'}</span>
                      </button>
                      {open && (
                        <div>
                          {module.capabilities.map(meta => (
                            <CapabilityRow
                              key={meta.key}
                              meta={meta}
                              decision={detail.policy.capabilities[meta.key]}
                              value={draft[meta.key] || 'inherit'}
                              allow={allowModule && meta.delegatable}
                              disabled={locked}
                              onChange={value => setEffect(meta.key, value)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {modules.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">No editable modules for this account.</p>}
              </div>
            </Section>

            <Section letter="D" title="Record scope" hint="Scope can only narrow what the role already allows. It never widens access on its own.">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
                <select
                  value={scopeDraft}
                  aria-label="Effective record scope"
                  disabled={locked}
                  onChange={event => setScopeDraft(event.target.value as Scope)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {detail.eligibleScopes.map(scope => <option key={scope} value={scope}>{SCOPE_LABEL[scope]}</option>)}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Role maximum: <strong>{SCOPE_LABEL[detail.maxScope]}</strong>. Existing decisions are clamped to this value on every request.
                </p>
              </div>
            </Section>

            <Section letter="E" title="Review & save" hint="Nothing is written until you preview and confirm. The server re-validates the whole proposal.">
              <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="flex flex-wrap items-center gap-2">
                  <UserCog className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{Object.keys(overrides).length} override{Object.keys(overrides).length === 1 ? '' : 's'} staged</span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <ScopePill scope={scopeDraft} />
                  {dirty && <Badge tone="amber">Unsaved changes</Badge>}
                  {!dirty && <Badge tone="emerald">In sync with stored policy</Badge>}
                </div>
                <div className="flex items-start gap-1.5 text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Your role, the target account and immutable boundaries are re-checked server-side. A stale revision returns a conflict instead of overwriting newer changes.</span>
                </div>
                <label className="block pt-1 font-semibold text-slate-700 dark:text-slate-200">
                  Reason for this change (optional)
                  <textarea
                    value={reason}
                    onChange={event => setReason(event.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Recorded in the security audit trail."
                    className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
              </div>
            </Section>

            {error && <ErrorState message={error} onRetry={load} />}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(preview)}
        title="Confirm user permission change"
        description={preview ? `${preview.label} · revision ${preview.revision}` : undefined}
        confirmLabel="Save permissions"
        busy={saving}
        error={saveError}
        onCancel={() => { if (!saving) { setPreview(null); setSaveError(null); } }}
        onConfirm={confirmSave}
      >
        {preview && (
          <div className="space-y-3">
            {preview.scope && <p className="text-xs text-slate-500 dark:text-slate-400">Effective scope: <strong>{SCOPE_LABEL[preview.scope]}</strong></p>}
            <ChangeList changes={preview.changes} />
            {preview.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-200">
                <p className="mb-1 inline-flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" />Elevated access</p>
                <ul className="list-inside list-disc space-y-1">{preview.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={resetOpen}
        title="Reset user permissions"
        description="Personal overrides and scope are removed. The account returns to its role defaults."
        tone="danger"
        confirmLabel="Reset permissions"
        busy={saving}
        error={saveError}
        onCancel={() => { if (!saving) { setResetOpen(false); setSaveError(null); } }}
        onConfirm={confirmReset}
      >
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
          Reason (optional)
          <textarea
            value={reason}
            onChange={event => setReason(event.target.value)}
            rows={2}
            maxLength={500}
            className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={discardOpen}
        title="Discard unsaved changes?"
        description="Your staged permission overrides will be lost."
        tone="danger"
        confirmLabel="Discard"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={onClose}
      />
    </>
  );
};
