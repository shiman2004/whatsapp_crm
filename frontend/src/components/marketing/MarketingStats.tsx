import React from 'react';
import { Database, Upload, CheckCircle2, LockKeyhole } from 'lucide-react';

interface MarketingStatsProps {
  contactsCount: number;
  batchesCount: number;
}

export const MarketingStats: React.FC<MarketingStatsProps> = ({ contactsCount, batchesCount }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Contacts Loaded */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-3 flex items-center gap-3 shadow-xs">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-teal-500/10 text-teal-400 shrink-0 border border-teal-500/20">
          <Database className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Contacts loaded</p>
          <p className="text-base font-extrabold text-white mt-0.5 truncate">{contactsCount.toLocaleString()}</p>
        </div>
      </div>

      {/* 2. My Batches */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-3 flex items-center gap-3 shadow-xs">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-cyan-500/10 text-cyan-400 shrink-0 border border-cyan-500/20">
          <Upload className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">My batches</p>
          <p className="text-base font-extrabold text-white mt-0.5 truncate">{batchesCount.toLocaleString()}</p>
        </div>
      </div>

      {/* 3. Consent Rule */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-3 flex items-center gap-3 shadow-xs">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400 shrink-0 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Consent rule</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm font-extrabold text-emerald-400">Enforced</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          </div>
        </div>
      </div>

      {/* 4. Live Actions */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-3 flex items-center gap-3 shadow-xs">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-400 shrink-0 border border-amber-500/20">
          <LockKeyhole className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Live actions</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm font-extrabold text-amber-400">Protected</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          </div>
        </div>
      </div>
    </div>
  );
};
