import React from 'react';
import { ChevronRight, Home, ShieldCheck, Sparkles } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

interface MarketingHeaderProps {
  pageLabel: string;
  onNavigate: (page: 'dashboard') => void;
}

export const MarketingHeader: React.FC<MarketingHeaderProps> = ({ pageLabel, onNavigate }) => {
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
    <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 pb-2 border-b border-[#E0E5E7] dark:border-[#222D34]">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#128C7E] dark:text-[#25D366]">
            {companyName} / OPERATIONS
          </p>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#DDF5EC] text-[#075E54] dark:bg-[#005C4B]/60 dark:text-[#25D366] border border-[#128C7E]/30 dark:border-[#25D366]/30">
            <Sparkles className="w-2.5 h-2.5" />
            V2
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-[#111B21] dark:text-[#E9EDEF] mt-1">
          Public Contact Marketing
        </h1>
        <nav aria-label="Breadcrumb" className="mt-2 flex flex-wrap items-center gap-1 text-xs text-[#667781] dark:text-[#8696A0]">
          <button type="button" onClick={() => { window.location.hash = ''; }} className="inline-flex items-center gap-1 hover:text-[#128C7E] dark:hover:text-[#25D366] transition-colors"><Home className="w-3 h-3" />Home</button>
          <ChevronRight className="w-3 h-3 text-[#667781] dark:text-[#8696A0]" />
          <button type="button" onClick={() => onNavigate('dashboard')} className="hover:text-[#128C7E] dark:hover:text-[#25D366] transition-colors">Public Contact Marketing</button>
          {pageLabel !== 'Marketing Dashboard' && <><ChevronRight className="w-3 h-3 text-[#667781] dark:text-[#8696A0]" /><span className="font-medium text-[#111B21] dark:text-[#E9EDEF]">{pageLabel}</span></>}
        </nav>
        <p className="text-xs sm:text-sm text-[#667781] dark:text-[#8696A0] mt-0.5">
          Permission-aware contact collection for the marketing team.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {/* Company Scope Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E0E5E7] bg-white text-xs text-[#111B21] dark:border-[#222D34] dark:bg-[#202C33] dark:text-[#E9EDEF]">
          <ShieldCheck className="w-4 h-4 text-[#128C7E] dark:text-[#25D366] shrink-0" />
          <span>Company scoped</span>
          <span className="text-[#667781] dark:text-[#8696A0]">•</span>
          <span className="font-bold text-[#111B21] dark:text-[#E9EDEF]">{currentUser?.company || 'RWC'}</span>
        </div>

        {/* Live Meta API Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>((•)) Meta API</span>
        </div>

        {/* User Identity Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E0E5E7] bg-white text-xs dark:border-[#222D34] dark:bg-[#202C33]">
          <div className="w-5 h-5 rounded-full bg-[#DDF5EC] text-[#075E54] dark:bg-[#005C4B] dark:text-[#25D366] border border-[#128C7E]/30 dark:border-[#25D366]/40 flex items-center justify-center font-bold text-[10px]">
            {currentUser?.fullName?.charAt(0) || 'U'}
          </div>
          <span className="font-medium text-[#111B21] dark:text-[#E9EDEF]">{currentUser?.fullName || 'User'}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F0F2F5] text-[#667781] dark:bg-[#2A3942] dark:text-[#8696A0]">
            {roleLabel}
          </span>
        </div>
      </div>
    </header>
  );
};
