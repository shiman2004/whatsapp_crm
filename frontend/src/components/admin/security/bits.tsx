import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, Minus, RefreshCw, X } from 'lucide-react';
import type { ChangeRisk, Scope } from './types';

export const cx = (...values: (string | false | null | undefined)[]) => values.filter(Boolean).join(' ');

const TONES = {
  neutral: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  teal: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  indigo: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  slate: 'border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
} as const;

export type Tone = keyof typeof TONES;

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({ tone = 'neutral', children, className }) => (
  <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', TONES[tone], className)}>
    {children}
  </span>
);

export const SCOPE_LABEL: Record<Scope, string> = {
  own: 'Own records',
  assigned: 'Assigned records',
  department: 'Department',
  all: 'All records',
};

export const ScopePill: React.FC<{ scope: Scope | null | undefined }> = ({ scope }) =>
  scope ? <Badge tone="indigo">{SCOPE_LABEL[scope]}</Badge> : <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;

const SOURCE_LABEL: Record<string, { label: string; tone: Tone }> = {
  role: { label: 'Role default', tone: 'slate' },
  role_override: { label: 'Role override', tone: 'amber' },
  user_override: { label: 'User override', tone: 'indigo' },
  immutable_policy: { label: 'Protected', tone: 'rose' },
  identity: { label: 'No access', tone: 'rose' },
  unknown_capability: { label: 'Unknown', tone: 'rose' },
};

export const SourceBadge: React.FC<{ source: string }> = ({ source }) => {
  const meta = SOURCE_LABEL[source] || { label: source, tone: 'neutral' as Tone };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
};

export const RiskBadge: React.FC<{ risk: ChangeRisk }> = ({ risk }) =>
  risk === 'elevation'
    ? <Badge tone="rose">Elevation</Badge>
    : risk === 'reduction'
      ? <Badge tone="amber">Reduction</Badge>
      : <Badge tone="indigo">Scope change</Badge>;

export const Panel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <section className={cx('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60', className)}>
    {children}
  </section>
);

export const SectionTitle: React.FC<{ title: string; description?: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
    <div>
      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
    {action}
  </div>
);

export const Spinner: React.FC<{ label?: string }> = ({ label = 'Loading' }) => (
  <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{label}
  </span>
);

export const SkeletonBlock: React.FC<{ rows?: number; className?: string }> = ({ rows = 3, className }) => (
  <div className={cx('space-y-2', className)} aria-hidden="true">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/70" />
    ))}
  </div>
);

export const EmptyState: React.FC<{ title: string; description?: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
    {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between">
    <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{message}</span>
    {onRetry && (
      <button type="button" onClick={onRetry} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs font-semibold hover:bg-rose-500/10">
        <RefreshCw className="h-3.5 w-3.5" />Retry
      </button>
    )}
  </div>
);

export const Notice: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({ tone = 'indigo', children }) => (
  <div className={cx('rounded-xl border p-3 text-xs leading-relaxed', TONES[tone])}>{children}</div>
);

export const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

/** Shared dialog behaviour: Escape closes, Tab stays inside, focus returns on close. */
function useDialog(open: boolean, onClose: () => void, ref: React.RefObject<HTMLDivElement | null>) {
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusable = () => Array.from(
      node?.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])') || [],
    );
    focusable()[0]?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      previous?.focus?.();
    };
  }, [open, ref]);
}

export const drawerClass = 'fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950';

export const Drawer: React.FC<{
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}> = ({ open, title, subtitle, onClose, children, footer, width }) => {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label={title} ref={ref} className={cx(drawerClass, width)}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <footer className="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/80">{footer}</footer>}
      </div>
    </div>
  );
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  description?: string;
  tone?: 'primary' | 'danger';
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  children?: React.ReactNode;
}> = ({ open, title, description, tone = 'primary', confirmLabel = 'Confirm', busy, error, onCancel, onConfirm, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(open, () => { if (!busy) onCancel(); }, ref);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label={title} ref={ref} className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>
            {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[55vh] overflow-y-auto p-4">
          {children}
          {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-200">{error}</div>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-60',
              tone === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500',
            )}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
};

export const ChangeList: React.FC<{ changes: { label: string; risk: ChangeRisk; from: { allowed: boolean; scope: Scope | null }; to: { allowed: boolean; scope: Scope | null } }[] }> = ({ changes }) => {
  if (!changes.length) return <p className="text-xs text-slate-500 dark:text-slate-400">No capability changes. Only the stored overrides might be cleaned up.</p>;
  return (
    <ul className="space-y-2">
      {changes.map(change => (
        <li key={change.label} className="flex flex-col gap-1 rounded-xl border border-slate-200 p-2.5 text-xs dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-slate-800 dark:text-slate-100">{change.label}</span>
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
              {change.from.allowed ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Minus className="h-3.5 w-3.5 text-slate-400" />}
              {change.from.scope ? SCOPE_LABEL[change.from.scope] : 'None'}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100">
              {change.to.allowed ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Minus className="h-3.5 w-3.5 text-slate-400" />}
              {change.to.scope ? SCOPE_LABEL[change.to.scope] : 'None'}
            </span>
            <RiskBadge risk={change.risk} />
          </span>
        </li>
      ))}
    </ul>
  );
};

export const Pagination: React.FC<{ page: number; pages: number; total: number; onChange: (page: number) => void; busy?: boolean }> = ({ page, pages, total, onChange, busy }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
    <span>{total.toLocaleString()} record{total === 1 ? '' : 's'} · page {page} of {Math.max(1, pages)}</span>
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => onChange(page - 1)} disabled={busy || page <= 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200">
        <ChevronLeft className="h-3.5 w-3.5" />Prev
      </button>
      <button type="button" onClick={() => onChange(page + 1)} disabled={busy || page >= pages} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200">
        Next<ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);
