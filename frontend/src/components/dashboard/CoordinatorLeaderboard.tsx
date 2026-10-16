import React, { useState, useMemo, useEffect } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Award, Calendar, CheckCircle2, Building2, TrendingUp } from 'lucide-react';
import { CompanyCode, Lead } from '../../types';
import { getDayKey } from '../../utils/dateUtils';
import { getLeadCompany, COMPANIES } from '../../utils/companyUtils';

interface CoordinatorLeaderboardProps {
  leads?: Lead[];
  companyFilter?: CompanyCode | 'all';
}

export const CoordinatorLeaderboard: React.FC<CoordinatorLeaderboardProps> = ({ 
  leads: propLeads, 
  companyFilter: initialCompanyFilter = 'all' 
}) => {
  const { users, leads: ctxLeads, currentUser, isSuperAdmin } = useCrm();

  // 1. STRICT ACCESS CONTROL: Only show to Super Admin and Leads Officers
  const isOfficerOrAdmin = isSuperAdmin || 
    currentUser?.role === 'super_admin' || 
    currentUser?.role === 'leads_officer';

  if (!isOfficerOrAdmin) {
    return null;
  }

  // Use full leads context to allow multi-company cross-analytics
  const allLeads = ctxLeads && ctxLeads.length > 0 ? ctxLeads : (propLeads || []);

  // Internal company filter allows switching between All / RWC / CRAS
  const [selectedCompany, setSelectedCompany] = useState<CompanyCode | 'all'>(initialCompanyFilter);

  // Synchronize if prop companyFilter changes from parent switcher
  useEffect(() => {
    setSelectedCompany(initialCompanyFilter);
  }, [initialCompanyFilter]);

  const todayKey = getDayKey(new Date());

  // Filter coordinators
  const coordinators = useMemo(() => {
    return users.filter(u => {
      if (u.role !== 'coordinator') return false;
      if (selectedCompany === 'CRAS') return u.company === 'CRAS';
      if (selectedCompany === 'RWC') return u.company === 'RWC' || !u.company;
      return true;
    });
  }, [users, selectedCompany]);

  // Compute stats for each coordinator
  const stats = useMemo(() => {
    return coordinators.map(coord => {
      // All leads assigned to this coordinator
      const assignedLeads = allLeads.filter(l => l.assignedTo === coord.id);
      
      // Filter by selected company if applicable
      const relevantLeads = selectedCompany === 'all' 
        ? assignedLeads 
        : assignedLeads.filter(l => getLeadCompany(l).code === selectedCompany);

      // Assigned on current day (today)
      const assignedTodayCount = relevantLeads.filter(l => {
        if (l.assignedAt && getDayKey(l.assignedAt) === todayKey) return true;
        if (Array.isArray(l.assignmentHistories) && l.assignmentHistories.some(h => (h.assignedToId === coord.id || !h.assignedToId) && getDayKey(h.assignedAt) === todayKey)) return true;
        if (getDayKey(l.createdAt) === todayKey) return true;
        return false;
      }).length;

      // Converted leads
      const convertedCount = relevantLeads.filter(l => l.stage === 'converted').length;
      const convRate = relevantLeads.length > 0 
        ? Math.round((convertedCount / relevantLeads.length) * 100) 
        : 0;

      // Primary Company assignment
      const companyCode: CompanyCode = coord.company === 'CRAS' ? 'CRAS' : 'RWC';

      return {
        coordinator: coord,
        companyCode,
        totalAssigned: relevantLeads.length,
        assignedToday: assignedTodayCount,
        converted: convertedCount,
        convRate,
      };
    }).sort((a, b) => {
      // Sort primarily by assigned today, then by total assigned
      if (b.assignedToday !== a.assignedToday) {
        return b.assignedToday - a.assignedToday;
      }
      return b.totalAssigned - a.totalAssigned;
    });
  }, [coordinators, allLeads, selectedCompany, todayKey]);

  // Overall totals across coordinators for quick summary
  const summaryTotals = useMemo(() => {
    return stats.reduce((acc, curr) => ({
      today: acc.today + curr.assignedToday,
      total: acc.total + curr.totalAssigned,
      converted: acc.converted + curr.converted
    }), { today: 0, total: 0, converted: 0 });
  }, [stats]);

  const overallConvRate = summaryTotals.total > 0
    ? Math.round((summaryTotals.converted / summaryTotals.total) * 100)
    : 0;

  return (
    <div className="bg-white dark:bg-[#111b21] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden select-none">
      {/* Header with Title, Company Filter Tabs & Summary Chips */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-[#182229]/40">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" />
            Staff Lead Assignments & Conversions
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Workload distribution across Patient Coordinators (RWC) & Education Counsellors (CRAS)
          </p>
        </div>

        {/* Company Quick-Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-900 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setSelectedCompany('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedCompany === 'all'
                ? 'bg-white dark:bg-[#202c33] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Companies
          </button>
          <button
            type="button"
            onClick={() => setSelectedCompany('RWC')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              selectedCompany === 'RWC'
                ? 'bg-[#008000] text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            RWC
          </button>
          <button
            type="button"
            onClick={() => setSelectedCompany('CRAS')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              selectedCompany === 'CRAS'
                ? 'bg-[#800000] text-white shadow-xs'
                : 'text-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            CRAS
          </button>
        </div>
      </div>

      {/* Summary KPI Strip - Takes minimal vertical height */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800/80 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#111b21] text-xs">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-sky-500" /> Assigned Today
          </span>
          <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-sm">
            {summaryTotals.today}
          </span>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-teal-500" /> Total Assigned
          </span>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
            {summaryTotals.total}
          </span>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Converted
          </span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
            {summaryTotals.converted} <span className="text-[10px] font-normal text-slate-500">({overallConvRate}%)</span>
          </span>
        </div>
      </div>

      {/* Compact High-Density Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#182229]/60">
              <th className="py-2.5 px-4">Coordinator / Counsellor</th>
              <th className="py-2.5 px-3">Company</th>
              <th className="py-2.5 px-3 text-center">Assigned Today</th>
              <th className="py-2.5 px-3 text-center">Total Assigned</th>
              <th className="py-2.5 px-4 text-right">Converted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {stats.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                  No staff members registered for this company filter.
                </td>
              </tr>
            ) : (
              stats.map((item, idx) => (
                <tr 
                  key={item.coordinator.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-[#182229]/50 transition-colors"
                >
                  {/* Staff Info */}
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="relative shrink-0">
                        <img
                          src={item.coordinator.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                          alt={item.coordinator.fullName}
                          className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                        {idx === 0 && (
                          <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[8px] flex items-center justify-center absolute -top-1 -right-1 shadow">
                            1
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">
                          {item.coordinator.fullName}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-tight">
                          {item.coordinator.email}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Company Tag */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {item.companyCode === 'CRAS' ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
                        CRAS College
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60">
                        Royal Wellness (RWC)
                      </span>
                    )}
                  </td>

                  {/* Assigned Today */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    {item.assignedToday > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300/60 dark:border-sky-700/60">
                        +{item.assignedToday} Today
                      </span>
                    ) : (
                      <span className="font-mono text-slate-400 dark:text-slate-600 text-xs">
                        0
                      </span>
                    )}
                  </td>

                  {/* Total Assigned */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {item.totalAssigned}
                    </span>
                  </td>

                  {/* Converted */}
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {item.converted}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono ml-1">
                      ({item.convRate}%)
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
