import React, { useEffect, useId, useRef } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  X,
  CheckCircle2,
  Info,
  ShieldAlert,
} from 'lucide-react';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/* Page header                                                         */
/* ------------------------------------------------------------------ */

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, eyebrow, actions, className }) => (
  <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div className="min-w-0">
      {eyebrow && (
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#128C7E] dark:text-[#25D366]">{eyebrow}</p>
      )}
      <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight text-[#111B21] sm:text-2xl dark:text-[#E9EDEF]">{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-xs text-[#667781] sm:text-sm dark:text-[#8696A0]">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/* ------------------------------------------------------------------ */
/* Stat card                                                           */
/* ------------------------------------------------------------------ */

type StatTone = 'teal' | 'blue' | 'amber' | 'rose' | 'violet' | 'slate';

const statTones: Record<StatTone, { icon: string; accent: string }> = {
  teal: {
    icon: 'bg-[#DDF5EC] text-[#075E54] dark:bg-[#005C4B]/60 dark:text-[#25D366]',
    accent: 'bg-[#25D366]',
  },
  blue: {
    icon: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    accent: 'bg-[#34B7F1]',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    accent: 'bg-amber-500',
  },
  rose: {
    icon: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    accent: 'bg-rose-500',
  },
  violet: {
    icon: 'bg-emerald-50 text-emerald-800 dark:bg-[#005C4B]/40 dark:text-[#25D366]',
    accent: 'bg-[#128C7E]',
  },
  slate: {
    icon: 'bg-[#F0F2F5] text-[#667781] dark:bg-[#2A3942] dark:text-[#8696A0]',
    accent: 'bg-[#667781]',
  },
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: StatTone;
  trend?: { value: string; positive?: boolean };
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, hint, icon: Icon, tone = 'teal', trend }) => {
  const t = statTones[tone];
  return (
    <div className="group relative overflow-hidden rounded-xl border border-[#E0E5E7] bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-[#222D34] dark:bg-[#202C33]">
      <span className={cn('absolute inset-x-0 top-0 h-1 opacity-80', t.accent)} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[#667781] dark:text-[#8696A0]">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-[#111B21] dark:text-[#E9EDEF]">{value}</p>
        </div>
        {Icon && (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', t.icon)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      {(hint || trend) && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#E0E5E7]/70 pt-2.5 text-[11px] dark:border-[#222D34]">
          <span className="truncate text-[#667781] dark:text-[#8696A0]">{hint}</span>
          {trend && (
            <span className={cn('shrink-0 font-semibold', trend.positive === false ? 'text-rose-600 dark:text-rose-400' : 'text-[#128C7E] dark:text-[#25D366]')}>
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Status badge                                                        */
/* ------------------------------------------------------------------ */

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'teal';

const statusTones: Record<StatusTone, string> = {
  success: 'bg-[#DDF5EC] text-[#075E54] ring-[#128C7E]/30 dark:bg-[#005C4B]/50 dark:text-[#25D366] dark:ring-[#25D366]/30',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30',
  danger: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/30',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/30',
  neutral: 'bg-[#F0F2F5] text-[#667781] ring-[#E0E5E7] dark:bg-[#2A3942] dark:text-[#8696A0] dark:ring-[#222D34]',
  teal: 'bg-[#DDF5EC] text-[#075E54] ring-[#128C7E]/30 dark:bg-[#005C4B]/50 dark:text-[#25D366] dark:ring-[#25D366]/30',
};

export const StatusBadge: React.FC<{ tone?: StatusTone; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral',
  children,
  className,
}) => (
  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset', statusTones[tone], className)}>
    {children}
  </span>
);

/* ------------------------------------------------------------------ */
/* Feedback states                                                     */
/* ------------------------------------------------------------------ */

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon: Icon = Inbox, action, compact }) => (
  <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E0E5E7] bg-white/60 text-center dark:border-[#222D34] dark:bg-[#202C33]/40', compact ? 'gap-2 p-6' : 'gap-3 p-10')}>
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0F2F5] text-[#667781] dark:bg-[#2A3942] dark:text-[#8696A0]">
      <Icon className="h-5 w-5" />
    </span>
    <div>
      <p className="text-sm font-semibold text-[#111B21] dark:text-[#E9EDEF]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-[#667781] dark:text-[#8696A0]">{description}</p>}
    </div>
    {action}
  </div>
);

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ title = 'Something went wrong', message, onRetry }) => (
  <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-8 text-center dark:border-rose-500/20 dark:bg-rose-500/10">
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
      <AlertTriangle className="h-5 w-5" />
    </span>
    <div>
      <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">{title}</p>
      {message && <p className="mt-1 max-w-md text-xs text-rose-700/80 dark:text-rose-300/80">{message}</p>}
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 dark:ring-offset-[#111B21]"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Try again
      </button>
    )}
  </div>
);

export const LoadingSkeleton: React.FC<{ rows?: number; className?: string }> = ({ rows = 4, className }) => (
  <div className={cn('space-y-3', className)} aria-busy="true" aria-live="polite">
    <span className="sr-only">Loading</span>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="animate-pulse rounded-xl border border-[#E0E5E7] bg-white p-4 dark:border-[#222D34] dark:bg-[#202C33]">
        <div className="h-3 w-1/3 rounded bg-[#E0E5E7] dark:bg-[#2A3942]" />
        <div className="mt-3 h-2.5 w-2/3 rounded bg-[#F0F2F5] dark:bg-[#2A3942]/70" />
        <div className="mt-2 h-2.5 w-1/2 rounded bg-[#F0F2F5] dark:bg-[#2A3942]/70" />
      </div>
    ))}
  </div>
);

export const InlineLoader: React.FC<{ label?: string }> = ({ label = 'Loading' }) => (
  <div className="flex items-center justify-center gap-2 p-8 text-xs font-medium text-[#667781] dark:text-[#8696A0]">
    <Loader2 className="h-4 w-4 animate-spin text-[#128C7E] dark:text-[#25D366]" />
    {label}
  </div>
);

export const InlineFeedback: React.FC<{ tone: 'success' | 'error' | 'info' | 'warning'; children: React.ReactNode; onDismiss?: () => void }> = ({
  tone,
  children,
  onDismiss,
}) => {
  const map = {
    success: { icon: CheckCircle2, cls: 'border-[#128C7E]/30 bg-[#DDF5EC] text-[#075E54] dark:border-[#25D366]/30 dark:bg-[#005C4B]/40 dark:text-[#25D366]' },
    error: { icon: AlertTriangle, cls: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200' },
    warning: { icon: ShieldAlert, cls: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200' },
    info: { icon: Info, cls: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200' },
  }[tone];
  const Icon = map.icon;
  return (
    <div role="status" className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-xs', map.cls)}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss message">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Inputs & toolbars                                                   */
/* ------------------------------------------------------------------ */

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onValueChange: (value: string) => void;
  shortcutHint?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ value, onValueChange, placeholder = 'Search…', className, shortcutHint, ...rest }) => (
  <div className={cn('relative', className)}>
    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#667781] dark:text-[#8696A0]" />
    <input
      {...rest}
      type="search"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border border-[#E0E5E7] bg-white pl-9 pr-8 text-xs text-[#111B21] placeholder-[#667781] focus:border-[#128C7E] focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-[#222D34] dark:bg-[#2A3942] dark:text-[#E9EDEF] dark:placeholder-[#8696A0] dark:focus:border-[#25D366]"
    />
    {value ? (
      <button type="button" onClick={() => onValueChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF]" aria-label="Clear search">
        <X className="h-3.5 w-3.5" />
      </button>
    ) : (
      shortcutHint && <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-[#E0E5E7] bg-[#F0F2F5] px-1.5 py-0.5 text-[10px] font-semibold text-[#667781] sm:block dark:border-[#222D34] dark:bg-[#202C33] dark:text-[#8696A0]">{shortcutHint}</kbd>
    )}
  </div>
);

export const FilterToolbar: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border border-[#E0E5E7] bg-white p-2 shadow-sm dark:border-[#222D34] dark:bg-[#202C33]', className)}>
    {children}
  </div>
);

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export interface DataColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  caption?: string;
}

export function DataTable<T>({ columns, rows, getRowKey, onRowClick, empty, caption }: DataTableProps<T>) {
  if (rows.length === 0) return <>{empty ?? <EmptyState title="No records" compact />}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-[#E0E5E7] dark:border-[#222D34]">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn('whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#667781] dark:text-[#8696A0]', col.align === 'right' && 'text-right', col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('border-b border-[#E0E5E7]/60 last:border-0 dark:border-[#222D34]/70', onRowClick && 'cursor-pointer transition-colors hover:bg-[#F0F2F5] dark:hover:bg-[#2A3942]/60')}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn('px-3 py-2.5 align-middle text-[#111B21] dark:text-[#E9EDEF]', col.align === 'right' && 'text-right', col.className)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Activity timeline                                                   */
/* ------------------------------------------------------------------ */

export interface TimelineEntry {
  id: string;
  title: React.ReactNode;
  detail?: React.ReactNode;
  time?: string;
  tone?: StatusTone;
}

export const ActivityTimeline: React.FC<{ entries: TimelineEntry[]; empty?: React.ReactNode }> = ({ entries, empty }) => {
  if (entries.length === 0) return <>{empty ?? <EmptyState title="No activity yet" compact />}</>;
  return (
    <ol className="relative space-y-3 pl-4">
      <span className="absolute inset-y-1 left-1 w-px bg-[#E0E5E7] dark:bg-[#222D34]" aria-hidden />
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span
            className={cn(
              'absolute -left-3 top-1.5 h-2 w-2 rounded-full ring-2 ring-white dark:ring-[#202C33]',
              entry.tone === 'danger' ? 'bg-rose-500' : entry.tone === 'warning' ? 'bg-amber-500' : entry.tone === 'success' ? 'bg-[#25D366]' : 'bg-[#128C7E]',
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#111B21] dark:text-[#E9EDEF]">{entry.title}</p>
            {entry.detail && <p className="mt-0.5 text-[11px] text-[#667781] dark:text-[#8696A0]">{entry.detail}</p>}
          </div>
          {entry.time && <time className="mt-0.5 block text-[10px] text-[#667781] dark:text-[#8696A0]">{entry.time}</time>}
        </li>
      ))}
    </ol>
  );
};

/* ------------------------------------------------------------------ */
/* Dialogs & drawers                                                   */
/* ------------------------------------------------------------------ */

const useEscape = (active: boolean, onClose: () => void) => {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose]);
};

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  onConfirm,
  onCancel,
}) => {
  useEscape(open, onCancel);
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-[#E0E5E7] bg-white p-5 shadow-2xl dark:border-[#222D34] dark:bg-[#202C33]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">{title}</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-[#667781] dark:text-[#8696A0]">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-[#E0E5E7] px-3 py-1.5 text-xs font-semibold text-[#111B21] hover:bg-[#F0F2F5] dark:border-[#222D34] dark:text-[#E9EDEF] dark:hover:bg-[#2A3942]">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:ring-offset-[#202C33]', destructive ? 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-400' : 'bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:text-[#111B21] dark:hover:bg-[#20bd5a] focus-visible:ring-[#25D366]')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

interface FormDrawerProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  widthClass?: string;
}

export const FormDrawer: React.FC<FormDrawerProps> = ({ open, title, description, onClose, footer, children, widthClass = 'max-w-lg' }) => {
  useEscape(open, onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/60 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('flex h-full w-full flex-col border-l border-[#E0E5E7] bg-white shadow-2xl outline-none dark:border-[#222D34] dark:bg-[#202C33]', widthClass)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E0E5E7] px-5 py-4 dark:border-[#222D34]">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-[#667781] dark:text-[#8696A0]">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#667781] hover:bg-[#F0F2F5] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:bg-[#2A3942] dark:hover:text-[#E9EDEF]" aria-label="Close panel">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-[#E0E5E7] px-5 py-3 dark:border-[#222D34]">{footer}</div>}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Permission guard (visibility only — server remains the authority)   */
/* ------------------------------------------------------------------ */

interface PermissionGuardProps {
  user: { role?: string; active?: boolean } | null | undefined;
  allow: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ user, allow, fallback = null, children }) => {
  if (!user || user.active === false || !user.role || !allow.includes(user.role)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};

/* ------------------------------------------------------------------ */
/* Section card                                                        */
/* ------------------------------------------------------------------ */

export const SectionCard: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}> = ({ title, description, action, children, className, bodyClassName }) => (
  <section className={cn('overflow-hidden rounded-xl border border-[#E0E5E7] bg-white shadow-sm dark:border-[#222D34] dark:bg-[#202C33]', className)}>
    <header className="flex items-start justify-between gap-3 border-b border-[#E0E5E7]/70 px-4 py-3 dark:border-[#222D34]">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">{title}</h2>
        {description && <p className="mt-0.5 text-[11px] text-[#667781] dark:text-[#8696A0]">{description}</p>}
      </div>
      {action}
    </header>
    <div className={cn('p-4', bodyClassName)}>{children}</div>
  </section>
);

export const LinkButton: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string }> = ({ onClick, children, className }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn('inline-flex items-center gap-1 text-[11px] font-semibold text-[#128C7E] hover:text-[#075E54] hover:underline dark:text-[#25D366] dark:hover:text-[#20bd5a]', className)}
  >
    {children}
    <ChevronRight className="h-3 w-3" />
  </button>
);
