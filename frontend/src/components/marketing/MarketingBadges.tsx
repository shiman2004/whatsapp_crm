import React from 'react';
import { ConsentStatus, LifecycleStatus } from './types';
import { ShieldCheck, ShieldAlert, CheckCircle, Clock, AlertTriangle, XCircle, ArrowUpRight } from 'lucide-react';

interface LifecycleBadgeProps {
  status: LifecycleStatus | string;
  size?: 'sm' | 'md';
}

export const LifecycleBadge: React.FC<LifecycleBadgeProps> = ({ status, size = 'sm' }) => {
  const normalized = (status || '').toLowerCase().replace(/\s+/g, '_');
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  switch (normalized) {
    case 'new':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700/80 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          New
        </span>
      );
    case 'assigned':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-indigo-950/70 text-indigo-300 border border-indigo-800/80 ${sizeClasses}`}>
          <Clock className="w-2.5 h-2.5" />
          Assigned
        </span>
      );
    case 'follow_up_pending':
    case 'follow_up':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-amber-950/70 text-amber-300 border border-amber-800/80 ${sizeClasses}`}>
          <AlertTriangle className="w-2.5 h-2.5" />
          Follow-up Pending
        </span>
      );
    case 'contacted':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-blue-950/70 text-blue-300 border border-blue-800/80 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Contacted
        </span>
      );
    case 'interested':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/90 ${sizeClasses}`}>
          <CheckCircle className="w-2.5 h-2.5" />
          Interested
        </span>
      );
    case 'not_interested':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-zinc-800/90 text-zinc-400 border border-zinc-700 ${sizeClasses}`}>
          <XCircle className="w-2.5 h-2.5" />
          Not Interested
        </span>
      );
    case 'no_response':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-yellow-950/60 text-yellow-300 border border-yellow-800/80 ${sizeClasses}`}>
          <Clock className="w-2.5 h-2.5" />
          No Response
        </span>
      );
    case 'converted':
    case 'converted_to_lead':
      return (
        <span className={`inline-flex items-center gap-1 font-bold rounded-full bg-teal-950 text-teal-300 border border-teal-500/60 shadow-xs shadow-teal-500/30 ${sizeClasses}`}>
          <ArrowUpRight className="w-2.5 h-2.5 text-teal-400" />
          Converted to Lead
        </span>
      );
    case 'do_not_contact':
    case 'dnd':
    case 'suppressed':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/80 ${sizeClasses}`}>
          <ShieldAlert className="w-2.5 h-2.5" />
          Do Not Contact
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
};

interface ConsentBadgeProps {
  status: ConsentStatus | string;
  size?: 'sm' | 'md';
}

export const ConsentBadge: React.FC<ConsentBadgeProps> = ({ status, size = 'sm' }) => {
  const normalized = (status || '').toLowerCase();
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  switch (normalized) {
    case 'verified':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/70 ${sizeClasses}`}>
          <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
          Verified Opt-in
        </span>
      );
    case 'opted_out':
    case 'denied':
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-rose-950/60 text-rose-300 border border-rose-800/70 ${sizeClasses}`}>
          <ShieldAlert className="w-2.5 h-2.5 text-rose-400" />
          Suppressed
        </span>
      );
    case 'unknown':
    default:
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/70 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Pending Consent
        </span>
      );
  }
};
