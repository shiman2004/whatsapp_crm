import React from 'react';
import { cn, StatusBadge, type StatusTone } from '../../ui';
import { STATUS_TONE } from './api';

export const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/40 dark:border-[#222D34] dark:bg-[#202C33] dark:text-slate-100 transition-colors';

export const filterSelectClass =
  'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-none dark:border-[#222D34] dark:bg-[#202C33] dark:text-slate-100 cursor-pointer transition-colors shadow-xs';

export const Field: React.FC<{ label: string; hint?: string; required?: boolean; children: React.ReactNode }> = ({ label, hint, required, children }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
      {label}{required && <span className="text-rose-500"> *</span>}
    </span>
    {children}
    {hint && <span className="mt-1 block text-[10px] text-slate-400 dark:text-slate-500">{hint}</span>}
  </label>
);

export const RoleBadge: React.FC<{ role: string; label?: string }> = ({ role, label }) => {
  const isSuper = role === 'super_admin';
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition-all shadow-xs',
      isSuper
        ? 'border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20'
        : role.startsWith('exam')
          ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
          : role.startsWith('clinical') || role === 'report_analyst'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : role.startsWith('marketing')
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : role === 'finance_officer'
                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
    )}>
      {isSuper && <span className="mr-1 text-[9px]">👑</span>}
      {label || role.replace(/_/g, ' ')}
    </span>
  );
};

export const CompanyBadge: React.FC<{ company: string | null }> = ({ company }) => {
  if (!company) return <span className="text-slate-400 text-xs">—</span>;
  const c = company.toUpperCase();
  if (c === 'ALL') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-extrabold text-purple-700 dark:text-purple-300 shadow-xs" title="Executive Access: All Companies (RWC, CRAS, AHC)">
        <span>✨</span>
        <span>ALL Companies</span>
      </span>
    );
  }
  if (c === 'RWC') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
        <span>🌿</span>
        <span>RWC</span>
      </span>
    );
  }
  if (c === 'CRAS') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
        <span>🎓</span>
        <span>CRAS</span>
      </span>
    );
  }
  if (c === 'AHC') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
        <span>✦</span>
        <span>AHC</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      {company}
    </span>
  );
};

export const BranchBadge: React.FC<{ branch: string | null }> = ({ branch }) => {
  if (!branch) return <span className="text-slate-400 text-xs">—</span>;
  const isAll = branch.toUpperCase() === 'ALL' || branch.includes('All Branches');
  if (isAll) {
    return (
      <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 text-xs">
        <span>🌐</span>
        <span>All Branches</span>
      </span>
    );
  }
  return <span className="text-slate-700 dark:text-slate-300 text-xs font-medium">{branch}</span>;
};

export const UserStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const isAct = status === 'active';
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
      isAct
        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
        : status === 'locked'
        ? 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300'
        : status === 'suspended'
        ? 'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300'
        : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-400'
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', isAct ? 'bg-emerald-500 animate-pulse' : 'bg-current')} />
      {status}
    </span>
  );
};

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
      'inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-teal-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 dark:ring-offset-[#111B21] shadow-xs cursor-pointer',
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
      'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#222D34] dark:bg-[#202C33] dark:text-slate-200 dark:hover:bg-[#2A3942] shadow-xs cursor-pointer',
      className,
    )}
  >
    {children}
  </button>
);
