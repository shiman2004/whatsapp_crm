import React from 'react';
import { KpiCards } from './KpiCards';
import { LeadFunnelChart } from './LeadFunnelChart';
import { TreatmentDistributionChart } from './TreatmentDistributionChart';
import { CoordinatorLeaderboard } from './CoordinatorLeaderboard';
import { Globe, Shield, Sparkles, MessageCircle } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

export const DashboardOverview: React.FC = () => {
  const { leads, isSuperAdmin } = useCrm();

  const enCount = leads.filter(l => l.language === 'en').length;
  const siCount = leads.filter(l => l.language === 'si').length;
  const taCount = leads.filter(l => l.language === 'ta').length;

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-8">
      {/* KPI Cards */}
      <KpiCards />

      {/* Multilingual Share & Language Distribution Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-500/30">
              EN
            </span>
            <div>
              <p className="text-xs font-bold text-slate-200">English Inquiries</p>
              <p className="text-[10px] text-slate-400">{enCount} Active conversations</p>
            </div>
          </div>
          <span className="text-base font-bold font-mono text-blue-400">
            {leads.length > 0 ? ((enCount / leads.length) * 100).toFixed(0) : 0}%
          </span>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 font-bold flex items-center justify-center text-sm border border-amber-500/30">
              SI
            </span>
            <div>
              <p className="text-xs font-bold text-slate-200">සිංහල (Sinhala)</p>
              <p className="text-[10px] text-slate-400">{siCount} Active conversations</p>
            </div>
          </div>
          <span className="text-base font-bold font-mono text-amber-400">
            {leads.length > 0 ? ((siCount / leads.length) * 100).toFixed(0) : 0}%
          </span>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 font-bold flex items-center justify-center text-sm border border-rose-500/30">
              TA
            </span>
            <div>
              <p className="text-xs font-bold text-slate-200">தமிழ் (Tamil)</p>
              <p className="text-[10px] text-slate-400">{taCount} Active conversations</p>
            </div>
          </div>
          <span className="text-base font-bold font-mono text-rose-400">
            {leads.length > 0 ? ((taCount / leads.length) * 100).toFixed(0) : 0}%
          </span>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadFunnelChart />
        <TreatmentDistributionChart />
      </div>

      {/* Coordinator Leaderboard */}
      <CoordinatorLeaderboard />
    </div>
  );
};
