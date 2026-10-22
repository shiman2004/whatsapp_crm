import React from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

export const MarketingHeader: React.FC = () => {
  const { currentUser } = useCrm();

  const companyName = currentUser?.company === 'CRAS' 
    ? 'CRAS INSTITUTE' 
    : (currentUser?.company === 'RWC' || !currentUser?.company ? 'ALPHA HEALTH GROUP' : currentUser.company);

  const roleLabel = currentUser?.role === 'super_admin'
    ? 'Super Admin'
    : currentUser?.role === 'leads_officer'
    ? 'Leads Officer'
    : currentUser?.role === 'marketing_officer'
    ? 'Marketing Officer'
    : currentUser?.role === 'marketing_admin'
    ? 'Marketing Admin'
    : 'Team Member';

  return (
    <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 pb-1 border-b border-slate-800/80">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-400">
            {companyName} / OPERATIONS
          </p>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
            <Sparkles className="w-2.5 h-2.5" />
            V2
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white mt-1">
          Public Contact Marketing
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Permission-aware contact collection for the marketing team.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {/* Company Scope Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Company scoped</span>
          <span className="text-slate-600">•</span>
          <span className="font-bold text-white">{currentUser?.company || 'RWC'}</span>
        </div>

        {/* Live Meta API Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-900/50 bg-emerald-950/40 text-xs font-semibold text-emerald-300 shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>((•)) Meta API</span>
        </div>

        {/* User Identity Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-xs">
          <div className="w-5 h-5 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center justify-center font-bold text-[10px]">
            {currentUser?.fullName?.charAt(0) || 'U'}
          </div>
          <span className="font-medium text-slate-200">{currentUser?.fullName || 'User'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {roleLabel}
          </span>
        </div>
      </div>
    </header>
  );
};
