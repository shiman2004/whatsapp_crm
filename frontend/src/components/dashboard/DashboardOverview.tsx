import React, { useState, useMemo, useEffect } from 'react';
import { KpiCards } from './KpiCards';
import { LeadFunnelChart } from './LeadFunnelChart';
import { TreatmentDistributionChart } from './TreatmentDistributionChart';
import { CoordinatorLeaderboard } from './CoordinatorLeaderboard';
import { Building2, Sparkles, GraduationCap, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { getLeadCompany, COMPANIES } from '../../utils/companyUtils';
import { CompanyCode } from '../../types';

export const DashboardOverview: React.FC = () => {
  const { leads, users, currentUser, isSuperAdmin } = useCrm();

  // Super Admin & Leads Officer can switch between both companies and unified view.
  // Coordinators are restricted to their assigned company only.
  const canSwitchCompany = currentUser?.role === 'super_admin' || currentUser?.role === 'leads_officer';

  // Determine active company
  const [activeCompany, setActiveCompany] = useState<CompanyCode | 'all'>(() => {
    if (currentUser?.role === 'coordinator') {
      return currentUser.company === 'CRAS' ? 'CRAS' : 'RWC';
    }
    return 'all';
  });

  // Keep synced if user switches profile
  useEffect(() => {
    if (currentUser?.role === 'coordinator') {
      setActiveCompany(currentUser.company === 'CRAS' ? 'CRAS' : 'RWC');
    }
  }, [currentUser?.role, currentUser?.company]);

  // Filter leads based on active company
  const filteredLeads = useMemo(() => {
    if (activeCompany === 'all') return leads;
    return leads.filter(l => getLeadCompany(l).code === activeCompany);
  }, [leads, activeCompany]);

  // Counts for selected company
  const rwcCount = useMemo(() => leads.filter(l => getLeadCompany(l).code === 'RWC').length, [leads]);
  const crasCount = useMemo(() => leads.filter(l => getLeadCompany(l).code === 'CRAS').length, [leads]);

  // Language stats for filtered leads
  const enCount = filteredLeads.filter(l => l.language === 'en').length;
  const siCount = filteredLeads.filter(l => l.language === 'si').length;
  const taCount = filteredLeads.filter(l => l.language === 'ta').length;

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-8">
      
      {/* Top Company Switcher Banner / Company Badge */}
      {canSwitchCompany ? (
        /* Super Admin & Leads Officer: Interactive Multi-Company Switcher */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111b21] p-3 rounded-2xl border border-slate-800 shadow-md">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {/* All Overview */}
            <button
              type="button"
              onClick={() => setActiveCompany('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeCompany === 'all'
                  ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>All Brands</span>
              <span className="text-[10px] opacity-75 font-mono bg-slate-900/60 px-1.5 py-0.5 rounded">
                {leads.length}
              </span>
            </button>

            {/* RWC Brand Tab */}
            <button
              type="button"
              onClick={() => setActiveCompany('RWC')}
              style={activeCompany === 'RWC' ? { backgroundColor: '#008000', color: '#ffffff' } : {}}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeCompany === 'RWC'
                  ? 'shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-500/40'
                  : 'text-slate-300 bg-emerald-950/30 border border-emerald-900/50 hover:bg-emerald-900/40'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${activeCompany === 'RWC' ? 'bg-white' : 'bg-emerald-400'}`}></span>
              <span>(RWC) Royal Wellness</span>
              <span className="text-[10px] opacity-90 font-mono bg-black/20 px-1.5 py-0.5 rounded">
                {rwcCount}
              </span>
            </button>

            {/* CRAS Brand Tab */}
            <button
              type="button"
              onClick={() => setActiveCompany('CRAS')}
              style={activeCompany === 'CRAS' ? { backgroundColor: '#800000', color: '#ffffff' } : {}}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeCompany === 'CRAS'
                  ? 'shadow-lg shadow-rose-950/60 ring-2 ring-rose-500/40'
                  : 'text-slate-300 bg-rose-950/30 border border-rose-900/50 hover:bg-rose-900/40'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${activeCompany === 'CRAS' ? 'bg-white' : 'bg-rose-400'}`}></span>
              <span>(CRAS) CRAS Academy</span>
              <span className="text-[10px] opacity-90 font-mono bg-black/20 px-1.5 py-0.5 rounded">
                {crasCount}
              </span>
            </button>
          </div>

          {/* Active Company Subtitle Indicator */}
          <div className="flex items-center gap-2 text-xs text-slate-400 pl-1 sm:pl-0">
            {activeCompany === 'RWC' ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Royal Wellness Center &bull; Clinic & Aesthetics Operations</span>
              </span>
            ) : activeCompany === 'CRAS' ? (
              <span className="text-rose-400 font-medium flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>CRAS Academy &bull; Student Admissions & Academic Courses</span>
              </span>
            ) : (
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Alpha Health Group &bull; Unified Multi-Brand Performance</span>
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Coordinator Locked View: Clean Dedicated Company Identity Banner */
        <div className="bg-[#111b21] p-3.5 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              style={{ backgroundColor: activeCompany === 'CRAS' ? '#800000' : '#008000' }}
              className="px-3.5 py-1.5 rounded-xl font-black text-xs text-white uppercase tracking-wider shadow border border-white/10"
            >
              {activeCompany === 'CRAS' ? '(CRAS)' : '(RWC)'}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>
                  {activeCompany === 'CRAS' 
                    ? 'Ceylon Royal Aesthetic Academy — Coordinator Dashboard' 
                    : 'Royal Wellness Center — Coordinator Clinic Dashboard'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {activeCompany === 'CRAS'
                  ? 'Viewing CRAS academic leads, student enrollments, and inquiries only'
                  : 'Viewing Royal Wellness clinic leads, treatments, and patient inquiries only'}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-700">
            {filteredLeads.length} Company Leads
          </span>
        </div>
      )}

      {/* KPI Cards (Filtered by active company) */}
      <KpiCards leads={filteredLeads} />

      {/* Multilingual Share & Language Distribution Banner (Filtered by active company) */}
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
            {filteredLeads.length > 0 ? ((enCount / filteredLeads.length) * 100).toFixed(0) : 0}%
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
            {filteredLeads.length > 0 ? ((siCount / filteredLeads.length) * 100).toFixed(0) : 0}%
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
            {filteredLeads.length > 0 ? ((taCount / filteredLeads.length) * 100).toFixed(0) : 0}%
          </span>
        </div>
      </div>

      {/* Main Charts Row (Filtered by active company) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadFunnelChart leads={filteredLeads} />
        <TreatmentDistributionChart leads={filteredLeads} />
      </div>

      {/* Coordinator Leaderboard (Filtered by active company) */}
      <CoordinatorLeaderboard leads={filteredLeads} companyFilter={activeCompany} />
    </div>
  );
};
