import React from 'react';
import { cn, StatusBadge, type StatusTone } from '../../ui';
import { STATUS_TONE } from './api';

export const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/40 dark:border-white/10 dark:bg-[#0b141a] dark:text-slate-100';

export const Field: React.FC<{ label: string; hint?: string; required?: boolean; children: React.ReactNode }> = ({ label, hint, required, children }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
      {label}{required && <span className="text-rose-500"> *</span>}
    </span>
    {children}
    {hint && <span className="mt-1 block text-[10px] text-slate-400 dark:text-slate-500">{hint}</span>}
  </label>
);

export const RoleBadge: React.FC<{ role: string; label?: string }> = ({ role, label }) => (
  <span className={cn(
    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
    role === 'super_admin'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
      : role.startsWith('exam')
        ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
        : role.startsWith('clinical') || role === 'report_analyst'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : role.startsWith('marketing')
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : 'border-slate-300 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
  )}>
    {label || role.replace(/_/g, ' ')}
  </span>
);

export const UserStatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <StatusBadge tone={(STATUS_TONE[status] || 'neutral') as StatusTone}>{status}</StatusBadge>
);

export const formatWhen = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export const timeAgo = (value?: string | null) => {
  if (!value) return 'never';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return 'never';
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
};

export const ErrorNote: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300">
      {message}
    </p>
  ) : null;

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...rest }) => (
  <button
    type="button"
    {...rest}
    className={cn(
      'inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 dark:ring-offset-[#0b141a]',
      className,
    )}
  >
    {children}
  </button>
);

export const GhostButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...rest }) => (
  <button
    type="button"
    {...rest}
    className={cn(
      'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5',
      className,
    )}
  >
    {children}
  </button>
);
