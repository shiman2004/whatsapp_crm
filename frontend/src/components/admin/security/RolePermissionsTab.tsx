import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Lock, RotateCcw, Save, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { securityApi, SecurityApiError } from './api';
import {
  Badge, ChangeList, ConfirmDialog, EmptyState, ErrorState, Notice, SCOPE_LABEL, ScopePill,
  SkeletonBlock, Spinner, SourceBadge, cx,
} from './bits';
import type {
  CapabilityMeta, ModuleInfo, Overrides, PolicyCapability, Preview, RoleDetail, RoleDirectory, RoleSummary,
} from './types';

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

/** Modules this role actually works in, plus any module it already overrides. */
function relevantModules(detail: RoleDetail, summary: RoleSummary | undefined): ModuleInfo[] {
  const roleKeys = new Set(summary?.capabilities || []);
  const overrideKeys = new Set(Object.keys(detail.overrides || {}));
  const editable = new Set(detail.editableCapabilities);
  return detail.modules.filter(module =>
    module.capabilities.some(meta => roleKeys.has(meta.key) || overrideKeys.has(meta.key) || editable.has(meta.key)),
  );
}

const EffectSelector: React.FC<{ value: DraftEffect; onChange: (value: DraftEffect) => void; allow: boolean; label: string }> = ({ value, onChange, allow, label }) => (
  <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-[11px] font-semibold dark:border-slate-700">
    {EFFECT_OPTIONS.filter(option => allow || option.value !== 'allow').map(option => (
      <button
        key={option.value}
        type="button"
        aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}
        className={cx(
          'px-2.5 py-1.5 motion-safe:transition-colors',
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
  draftValue: DraftEffect;
  editable: boolean;
  onChange: (value: DraftEffect) => void;
}> = ({ meta, decision, draftValue, editable, onChange }) => {
  const effectiveAllowed = decision?.allowed ?? false;
  return (
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
        {effectiveAllowed ? <Badge tone="emerald">Granted</Badge> : <Badge tone="slate">Not granted</Badge>}
        {decision?.source && <SourceBadge source={decision.source} />}
        {effectiveAllowed && decision?.scope && <ScopePill scope={decision.scope} />}
      </div>
      <div className="flex justify-start md:justify-end">
        {editable ? (
          <EffectSelector value={draftValue} onChange={onChange} allow label={`${meta.label} role override`} />
        ) : (
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{meta.immutable ? 'Immutable policy' : 'Module-enforced'}</span>
        )}
      </div>
    </div>
  );
};

export const RolePermissionsTab: React.FC = () => {
  const [directory, setDirectory] = useState<RoleDirectory | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<RoleDetail | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const loadDirectory = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const data = await securityApi.roles();
      setDirectory(data);
      setSelected(current => current || data.roles.find(role => role.editableCapabilities.length > 0)?.role || data.roles[0]?.role || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load roles.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadDetail = useCallback(async (role: string) => {
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const data = await securityApi.role(role);
      setDetail(data);
      setDraft(toDraft(data.overrides));
    } catch (cause) {
      setDetail(null);
      setDetailError(cause instanceof Error ? cause.message : 'Unable to load role permissions.');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => { void loadDirectory(); }, [loadDirectory]);
  useEffect(() => {
    setPreview(null);
    setNotice(null);
    setSaveError(null);
    if (selected) void loadDetail(selected);
  }, [selected, loadDetail]);

  const categories = useMemo(() => ['all', ...Array.from(new Set((directory?.roles || []).map(role => role.category)))], [directory]);

  const visibleRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (directory?.roles || []).filter(role => {
      if (category !== 'all' && role.category !== category) return false;
      if (!term) return true;
      return role.label.toLowerCase().includes(term) || role.role.toLowerCase().includes(term) || role.category.toLowerCase().includes(term);
    });
  }, [directory, search, category]);

  const summary = directory?.roles.find(role => role.role === selected);
  const modules = useMemo(() => (detail ? relevantModules(detail, summary) : []), [detail, summary]);

  const storedOverrides = detail?.overrides || {};
  const dirty = Boolean(detail) && canonical(fromDraft(draft)) !== canonical(storedOverrides);

  const setEffect = (key: string, value: DraftEffect) => setDraft(current => ({ ...current, [key]: value }));

  const requestPreview = async () => {
    if (!detail || !selected) return;
    setPreviewBusy(true);
    setSaveError(null);
    try {
      const data = await securityApi.preview({ subjectType: 'role', subjectId: selected, overrides: fromDraft(draft) });
      setReason('');
      setPreview(data);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to preview this change.');
    } finally {
      setPreviewBusy(false);
    }
  };

  const confirmSave = async () => {
    if (!detail || !selected || !preview) return;
    setSaving(true);
    setSaveError(null);
    try {
      await securityApi.updateRole(selected, {
        overrides: fromDraft(draft),
        expectedRevision: preview.revision,
        reason: reason.trim() || undefined,
      });
      setPreview(null);
      setNotice(`${summary?.label || selected} permissions saved.`);
      await Promise.all([loadDetail(selected), loadDirectory()]);
    } catch (cause) {
      setSaveError(cause instanceof SecurityApiError && cause.status === 409
        ? `${cause.message} Change preview again to pick up the new revision.`
        : cause instanceof Error ? cause.message : 'Unable to save role permissions.');
    } finally {
      setSaving(false);
    }
  };

  const confirmReset = async () => {
    if (!detail || !selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      await securityApi.resetRole(selected, detail.revision, reason.trim() || undefined);
      setResetOpen(false);
      setNotice(`${summary?.label || selected} permissions restored to role defaults.`);
      await Promise.all([loadDetail(selected), loadDirectory()]);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to reset role permissions.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingList && !directory) return <SkeletonBlock rows={6} />;
  if (error && !directory) return <ErrorState message={error} onRetry={loadDirectory} />;
  if (!directory) return null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search roles"
              aria-label="Search roles"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={category}
              onChange={event => setCategory(event.target.value)}
              aria-label="Filter by role category"
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              {categories.map(value => <option key={value} value={value}>{value === 'all' ? 'All categories' : value}</option>)}
            </select>
          </div>
        </div>

        <div className="max-h-[65vh] space-y-1.5 overflow-y-auto pr-1">
          {visibleRoles.length === 0 && <p className="px-2 py-6 text-center text-xs text-slate-500 dark:text-slate-400">No roles match this filter.</p>}
          {visibleRoles.map(role => {
            const active = role.role === selected;
            const overrideCount = Object.keys(role.overrides || {}).length;
            return (
              <button
                key={role.role}
                type="button"
                onClick={() => setSelected(role.role)}
                aria-current={active ? 'true' : undefined}
                className={cx(
                  'w-full rounded-xl border p-3 text-left motion-safe:transition-colors',
                  active
                    ? 'border-indigo-500/40 bg-indigo-500/10'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-800/50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-slate-900 dark:text-slate-100">{role.label}</span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">{role.role}</span>
                  </span>
                  {role.role === 'super_admin'
                    ? <Badge tone="rose"><Lock className="h-2.5 w-2.5" />Locked</Badge>
                    : overrideCount > 0
                      ? <Badge tone="amber">{overrideCount} override{overrideCount === 1 ? '' : 's'}</Badge>
                      : role.editableCapabilities.length > 0
                        ? <Badge tone="teal">Editable</Badge>
                        : <Badge tone="slate">Read-only</Badge>}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{role.category}</span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">max scope {SCOPE_LABEL[role.maxScope]}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="space-y-3">
        {notice && <Notice tone="emerald">{notice}</Notice>}
        {detailError && <ErrorState message={detailError} onRetry={() => selected && loadDetail(selected)} />}

        {!selected && <Notice>Select a role to inspect its enforced permissions.</Notice>}
        {selected && loadingDetail && !detail && <SkeletonBlock rows={8} />}

        {detail && !loadingDetail && detail.role !== selected && <SkeletonBlock rows={8} />}

        {detail && detail.role === selected && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{detail.policy.label || summary?.label || detail.role}</h2>
                    <Badge tone="indigo">{detail.role}</Badge>
                    <Badge tone="neutral">Revision {detail.revision}</Badge>
                    {detail.immutable && <Badge tone="rose"><Lock className="h-2.5 w-2.5" />Protected role</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Effective scope: {SCOPE_LABEL[detail.policy.maxScope]} · {detail.editableCapabilities.length} editable capabilit{detail.editableCapabilities.length === 1 ? 'y' : 'ies'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {Object.keys(storedOverrides).length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setReason(''); setSaveError(null); setResetOpen(true); }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />Reset defaults
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={requestPreview}
                    disabled={!dirty || previewBusy || detail.immutable}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {previewBusy ? <Spinner label="Previewing" /> : <><Save className="h-3.5 w-3.5" />Review changes</>}
                  </button>
                </div>
              </div>

              {saveError && !preview && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-200">{saveError}</div>}

              {detail.immutable ? (
                <div className="mt-3">
                  <Notice tone="rose">
                    Super Admin recovery access is governed by immutable policy. This role cannot be reduced or rewritten, and no
                    user override applies to it.
                  </Notice>
                </div>
              ) : (
                <div className="mt-3">
                  <Notice tone="indigo">
                    Only capabilities enforced by the central registry can be edited here. Module-owned checks (CRM, Clinical, Marketing)
                    are shown as enforced and stay read-only. You can grant the four exam draft capabilities to individual users from
                    User Permissions. A deny always wins for that user.
                  </Notice>
                </div>
              )}
            </div>

            {modules.length === 0 && <EmptyState title="No capabilities in this role's modules" />}

            {modules.map(module => {
              const editableCount = module.capabilities.filter(meta => detail.editableCapabilities.includes(meta.key)).length;
              return (
                <details key={module.id} open={module.id === 'exam' || module.capabilities.length <= 4} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 marker:hidden">
                    <span className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{module.label}</span>
                      <Badge tone="neutral">{module.capabilities.length} capabilities</Badge>
                      {editableCount > 0 && <Badge tone="teal">{editableCount} editable</Badge>}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{module.description}</span>
                  </summary>
                  <div>
                    {module.capabilities.map(meta => (
                      <CapabilityRow
                        key={meta.key}
                        meta={meta}
                        decision={detail.policy.capabilities[meta.key]}
                        draftValue={draft[meta.key] || 'inherit'}
                        editable={!detail.immutable && detail.editableCapabilities.includes(meta.key)}
                        onChange={value => setEffect(meta.key, value)}
                      />
                    ))}
                  </div>
                </details>
              );
            })}

            {dirty && (
              <Notice tone="amber">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Unsaved role changes.</span> Review changes to see a server-computed before/after summary.
              </Notice>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(preview)}
        title="Confirm role permission change"
        description={preview ? `${preview.label} · revision ${preview.revision}` : undefined}
        confirmLabel="Save permissions"
        busy={saving}
        error={saveError}
        onCancel={() => { if (!saving) { setPreview(null); setSaveError(null); } }}
        onConfirm={confirmSave}
      >
        {preview && (
          <div className="space-y-3">
            {preview.scope && <p className="text-xs text-slate-500 dark:text-slate-400">Effective scope stays <strong>{SCOPE_LABEL[preview.scope]}</strong>.</p>}
            <ChangeList changes={preview.changes} />
            {preview.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-200">
                <ul className="list-inside list-disc space-y-1">{preview.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
              </div>
            )}
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Reason (optional)
              <textarea
                value={reason}
                onChange={event => setReason(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Why is this role policy changing?"
                className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={resetOpen}
        title="Restore role defaults"
        description="All stored overrides for this role will be removed and the registry defaults re-applied."
        tone="danger"
        confirmLabel="Restore defaults"
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
    </div>
  );
};
