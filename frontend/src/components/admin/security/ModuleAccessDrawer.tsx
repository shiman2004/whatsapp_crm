import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Ban, CheckCheck, Lock, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { securityApi, SecurityApiError } from './api';
import {
  Badge, ChangeList, ConfirmDialog, Drawer, EmptyState, ErrorState, Notice, SCOPE_LABEL,
  ScopePill, SkeletonBlock, Spinner, SourceBadge, cx,
} from './bits';
import type { CapabilityMeta, ModuleInfo, Overrides, PolicyCapability, Preview, RoleDetail, RoleSummary } from './types';

type DraftEffect = 'inherit' | 'allow' | 'deny';
type Draft = Record<string, DraftEffect>;

const EFFECT_OPTIONS: { value: DraftEffect; label: string }[] = [
  { value: 'inherit', label: 'Default' },
  { value: 'allow', label: 'Allow' },
  { value: 'deny', label: 'Deny' },
];

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

const EffectSelector: React.FC<{ value: DraftEffect; label: string; disabled?: boolean; onChange: (value: DraftEffect) => void }> = ({ value, label, disabled, onChange }) => (
  <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-[11px] font-semibold dark:border-slate-700">
    {EFFECT_OPTIONS.map(option => (
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

const CapabilityRow: React.FC<{
  meta: CapabilityMeta;
  decision: PolicyCapability | undefined;
  value: DraftEffect;
  editable: boolean;
  locked: boolean;
  onChange: (value: DraftEffect) => void;
}> = ({ meta, decision, value, editable, locked, onChange }) => (
  <div className="grid grid-cols-1 items-center gap-2 border-t border-slate-100 px-3 py-2.5 first:border-t-0 dark:border-slate-800 md:grid-cols-[minmax(0,1fr)_auto_auto]">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{meta.label}</span>
        <Badge tone="neutral">{meta.action}</Badge>
        {meta.immutable && <Badge tone="rose"><Lock className="h-2.5 w-2.5" />Protected</Badge>}
        {meta.delegatable && <Badge tone="indigo">Delegatable</Badge>}
      </div>
      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{meta.description}</p>
    </div>
    <div className="flex items-center gap-1.5">
      {decision?.allowed ? <Badge tone="emerald">Granted</Badge> : <Badge tone="slate">Not granted</Badge>}
      {decision?.source && <SourceBadge source={decision.source} />}
      {decision?.allowed && decision.scope && <ScopePill scope={decision.scope} />}
    </div>
    <div className="flex justify-start md:justify-end">
      {editable ? (
        <EffectSelector value={value} label={`${meta.label} role override`} disabled={locked} onChange={onChange} />
      ) : (
        <span className="text-[11px] text-slate-400 dark:text-slate-500">{meta.immutable ? 'Immutable policy' : 'Module-enforced'}</span>
      )}
    </div>
  </div>
);

export const ModuleAccessDrawer: React.FC<{
  role: RoleSummary;
  module: ModuleInfo;
  onClose: () => void;
  onSaved: () => void;
}> = ({ role, module, onClose, onSaved }) => {
  const [detail, setDetail] = useState<RoleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The draft always holds the role's FULL override set. Edits touch only this
  // module's keys, so saving can never drop another module's overrides.
  const [draft, setDraft] = useState<Draft>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [discardOpen, setDiscardOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await securityApi.role(role.role);
      setDetail(data);
      setDraft(toDraft(data.overrides));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this role.');
    } finally {
      setLoading(false);
    }
  }, [role.role]);

  useEffect(() => { void load(); }, [load]);

  const editableKeys = useMemo(() => new Set(detail?.editableCapabilities || []), [detail]);
  const editableKeysInModule = useMemo(
    () => module.capabilities.filter(meta => meta.roleEditable && !meta.immutable && editableKeys.has(meta.key)).map(meta => meta.key),
    [module, editableKeys],
  );
  const moduleKeySet = useMemo(() => new Set(module.capabilities.map(meta => meta.key)), [module]);
  const storedInModule = useMemo(
    () => Object.keys(detail?.overrides || {}).filter(key => moduleKeySet.has(key)).length,
    [detail, moduleKeySet],
  );

  const overrides = fromDraft(draft);
  const locked = role.role === 'super_admin' || editableKeysInModule.length === 0;
  const dirty = detail !== null && canonical(overrides) !== canonical(detail.overrides);

  const setEffect = (key: string, value: DraftEffect) => setDraft(current => ({ ...current, [key]: value }));

  const applyToModule = (effect: DraftEffect) => setDraft(current => {
    const next = { ...current };
    for (const key of editableKeysInModule) next[key] = effect;
    return next;
  });

  const requestClose = () => {
    if (dirty) setDiscardOpen(true);
    else onClose();
  };

  const requestPreview = async () => {
    if (!detail) return;
    setPreviewBusy(true);
    setSaveError(null);
    try {
      const data = await securityApi.preview({ subjectType: 'role', subjectId: role.role, overrides });
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
      await securityApi.updateRole(role.role, {
        overrides,
        expectedRevision: preview.revision,
        reason: reason.trim() || undefined,
      });
      setPreview(null);
      onSaved();
    } catch (cause) {
      setSaveError(cause instanceof SecurityApiError && cause.status === 409
        ? `${cause.message} Preview again to load the current revision.`
        : cause instanceof Error ? cause.message : 'Unable to save module access.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Drawer
        open
        title={`${module.label} access`}
        subtitle={`${role.label} · ${role.role}`}
        onClose={requestClose}
        footer={
          <div className="flex flex-col gap-2">
            {saveError && !preview && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-200">{saveError}</div>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => applyToModule('allow')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
                >
                  <CheckCheck className="h-3.5 w-3.5" />Grant all editable
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => applyToModule('deny')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300"
                >
                  <Ban className="h-3.5 w-3.5" />Deny all editable
                </button>
                <button
                  type="button"
                  disabled={locked || !storedInModule}
                  onClick={() => applyToModule('inherit')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <RotateCcw className="h-3.5 w-3.5" />Reset module
                </button>
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
            {role.role === 'super_admin' && <Notice tone="rose"><span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Super Admin recovery access is immutable and cannot be edited here.</span></Notice>}
            {role.role !== 'super_admin' && editableKeysInModule.length === 0 && (
              <Notice tone="amber">
                <span className="inline-flex items-start gap-1.5"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />This module is enforced by server code, not by the registry. Its policy is shown read-only for review.</span>
              </Notice>
            )}

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              <Badge tone="neutral">{module.category}</Badge>
              <span>{module.capabilities.length} capabilities</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>{editableKeysInModule.length} editable</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>Maximum scope {SCOPE_LABEL[role.maxScope]}</span>
              {storedInModule > 0 && <Badge tone="amber">{storedInModule} stored override{storedInModule === 1 ? '' : 's'}</Badge>}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              {module.capabilities.map(meta => (
                <CapabilityRow
                  key={meta.key}
                  meta={meta}
                  decision={detail.policy.capabilities[meta.key]}
                  value={draft[meta.key] || 'inherit'}
                  editable={meta.roleEditable && !meta.immutable && editableKeys.has(meta.key)}
                  locked={locked}
                  onChange={value => setEffect(meta.key, value)}
                />
              ))}
              {module.capabilities.length === 0 && <div className="p-4"><EmptyState title="No capabilities in this module" /></div>}
            </div>

            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Default removes this module's override and restores the registry baseline. Deny always wins over an inherited grant.
              Changes from other modules are preserved untouched.
            </p>

            {preview && (
              <div className="space-y-2 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <Badge tone="indigo">Preview</Badge>
                  <span>{preview.summary.added} added</span>
                  <span>{preview.summary.removed} removed</span>
                  <span>{preview.summary.rescoped} rescoped</span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span>Revision {preview.revision}</span>
                </div>
                <ChangeList changes={preview.changes} />
                {preview.warnings.length > 0 && (
                  <ul className="space-y-1 text-[11px] text-amber-700 dark:text-amber-300">
                    {preview.warnings.map(warning => <li key={warning} className="flex items-start gap-1.5"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{warning}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(preview)}
        title="Apply module permissions"
        description={preview ? `Saving ${role.label} · ${module.label} at revision ${preview.revision}.` : undefined}
        confirmLabel="Apply changes"
        busy={saving}
        error={saveError}
        onCancel={() => { if (!saving) { setPreview(null); setSaveError(null); } }}
        onConfirm={confirmSave}
      >
        {preview && (
          <div className="space-y-3">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Reason
              <input
                value={reason}
                onChange={event => setReason(event.target.value)}
                placeholder="Why is this access changing?"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <ChangeList changes={preview.changes} />
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={discardOpen}
        title="Discard unsaved changes?"
        description="This module's unsaved edits will be lost."
        tone="danger"
        confirmLabel="Discard"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => { setDiscardOpen(false); onClose(); }}
      />
    </>
  );
};
