import React, { useState, useMemo, useEffect } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Award, Calendar, CheckCircle2, Building2, PieChart, BarChart3, Clock } from 'lucide-react';
import { CompanyCode, Lead, LeadStageConfig } from '../../types';
import { getDayKey } from '../../utils/dateUtils';
import { getLeadCompany } from '../../utils/companyUtils';

interface CoordinatorLeaderboardProps {
  leads?: Lead[];
  companyFilter?: CompanyCode | 'all';
}

type ViewMode = 'overview' | 'stage_distribution';
type TimePeriod = 'today' | 'yesterday' | 'this_month' | 'all';

function isLeadInTimeframe(lead: Lead, coordId: string, timeframe: TimePeriod): boolean {
  if (timeframe === 'all') return true;

  // Find most relevant timestamp for this coordinator
  const hist = Array.isArray(lead.assignmentHistories)
    ? lead.assignmentHistories.find(h => h.assignedToId === coordId)
    : undefined;
  const rawDateStr = hist?.assignedAt || lead.assignedAt || lead.updatedAt || lead.createdAt;
  if (!rawDateStr) return false;

  const leadDate = new Date(rawDateStr);
  if (isNaN(leadDate.getTime())) return false;

  const now = new Date();

  if (timeframe === 'today') {
    return getDayKey(leadDate) === getDayKey(now);
  }

  if (timeframe === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return getDayKey(leadDate) === getDayKey(yesterday);
  }

  if (timeframe === 'this_month') {
    return leadDate.getFullYear() === now.getFullYear() && leadDate.getMonth() === now.getMonth();
  }

  return true;
}

const STAGE_COLOR_MAP: Record<string, string> = {
  rose: '#f43f5e',
  amber: '#f59e0b',
  emerald: '#10b981',
  purple: '#8b5cf6',
  sky: '#0ea5e9',
  slate: '#64748b',
  zinc: '#71717a',
  teal: '#0d9488',
  red: '#ef4444',
  orange: '#f97316',
  indigo: '#6366f1',
  pink: '#ec4899',
  cyan: '#06b6d4',
  lime: '#84cc16',
  fuchsia: '#d946ef'
};

const getStageHexColor = (color?: string, fallback = '#6366f1'): string => {
  if (!color) return fallback;
  if (color.startsWith('#')) return color;
  return STAGE_COLOR_MAP[color.toLowerCase()] || fallback;
};

export const CoordinatorLeaderboard: React.FC<CoordinatorLeaderboardProps> = ({ 
  leads: propLeads, 
  companyFilter: initialCompanyFilter = 'all' 
}) => {
  const { users, leads: ctxLeads, currentUser, isSuperAdmin, stages } = useCrm();

  // 1. STRICT ACCESS CONTROL: Only show to Super Admin and Leads Officers
  const isOfficerOrAdmin = isSuperAdmin || 
    currentUser?.role === 'super_admin' || 
    currentUser?.role === 'leads_officer';

  // 2. Lead stage percentage breakdown is strictly Admin only
  const isAdmin = isSuperAdmin || currentUser?.role === 'super_admin';

  // View state & Time Period state
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('today');

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

  // Compute stats for each coordinator (Overview mode)
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

  // Dynamic stages from DB / Context with company filtering
  const dynamicStages: LeadStageConfig[] = useMemo(() => {
    if (stages && stages.length > 0) {
      return [...stages]
        .filter(s => s.isActive !== false)
        .filter(s => {
          if (selectedCompany === 'all') return true;
          return !s.company || s.company === 'ALL' || s.company === selectedCompany;
        })
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    }
    const defaultKeys = [
      { key: 'new', label: 'New Inquiry', color: '#f43f5e' },
      { key: 'assigned', label: 'Assigned', color: '#f59e0b' },
      { key: 'contacted', label: 'Contacted', color: '#10b981' },
      { key: 'potential', label: 'Potential', color: '#a855f7' },
      { key: 'under_discussion', label: 'Under Discussion', color: '#0ea5e9' },
      { key: 'not_relevant', label: 'Not Relevant', color: '#64748b' },
      { key: 'not_eligible', label: 'Not Eligible', color: '#71717a' },
      { key: 'converted', label: 'Converted', color: '#14b8a6' },
      { key: 'lost', label: 'Lost', color: '#ef4444' }
    ];
    return defaultKeys.map((item, idx) => ({
      id: `default-${item.key}`,
      key: item.key,
      label: item.label,
      orderIndex: idx,
      isActive: true,
      isSystem: true,
      color: item.color
    }));
  }, [stages, selectedCompany]);

  // Compute Stage Distribution for each staff in the selected time period
  const stageStats = useMemo(() => {
    return coordinators.map(coord => {
      // All leads assigned to this coordinator
      const assignedLeads = allLeads.filter(l => l.assignedTo === coord.id);

      // Filter by selected company if applicable
      const companyLeads = selectedCompany === 'all'
        ? assignedLeads
        : assignedLeads.filter(l => getLeadCompany(l).code === selectedCompany);

      // Filter by selected time period
      const timeframeLeads = companyLeads.filter(l => isLeadInTimeframe(l, coord.id, timePeriod));
      const totalPeriodLeads = timeframeLeads.length;

      // Distribution per dynamic stage
      const distribution: Record<string, { count: number; percentage: number }> = {};
      dynamicStages.forEach(st => {
        const stageCount = timeframeLeads.filter(l => l.stage === st.key).length;
        const pct = totalPeriodLeads > 0 ? Math.round((stageCount / totalPeriodLeads) * 100) : 0;
        distribution[st.key] = {
          count: stageCount,
          percentage: pct
        };
      });

      const companyCode: CompanyCode = coord.company === 'CRAS' ? 'CRAS' : 'RWC';

      return {
        coordinator: coord,
        companyCode,
        totalPeriodLeads,
        distribution
      };
    }).sort((a, b) => b.totalPeriodLeads - a.totalPeriodLeads);
  }, [coordinators, allLeads, selectedCompany, timePeriod, dynamicStages]);

  // Period totals across all staff
  const periodTotals = useMemo(() => {
    const totalLeads = stageStats.reduce((acc, s) => acc + s.totalPeriodLeads, 0);
    const stageCounts: Record<string, number> = {};
    dynamicStages.forEach(st => {
      stageCounts[st.key] = stageStats.reduce((acc, s) => acc + (s.distribution[st.key]?.count || 0), 0);
    });
    return { totalLeads, stageCounts };
  }, [stageStats, dynamicStages]);

  if (!isOfficerOrAdmin) {
    return null;
  }

  const getTimePeriodLabel = (tp: TimePeriod) => {
    switch (tp) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case 'this_month': return 'This Month';
      case 'all': return 'All Time';
    }
  };

  return (
    <div className="bg-white dark:bg-[#111b21] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden select-none">
      {/* Top Header: Title, Admin View Toggle & Filters */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50 dark:bg-[#182229]/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              Staff Performance & Pipeline Breakdown
              {isAdmin && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                  Admin Analytics
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Workload distribution across Patient Coordinators (RWC) & Education Counsellors (CRAS)
            </p>
          </div>
        </div>

        {/* View Mode Switcher (Admin Only) & Company Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Admin View Mode Switcher */}
          {isAdmin && (
            <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'overview'
                    ? 'bg-white dark:bg-[#202c33] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-sky-500" />
                Assignments Overview
              </button>
              <button
                type="button"
                onClick={() => setViewMode('stage_distribution')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'stage_distribution'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <PieChart className="w-3.5 h-3.5" />
                Stage Distribution (%)
              </button>
            </div>
          )}

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
      </div>

      {/* VIEW 1: STAGE DISTRIBUTION (%) - ADMIN ONLY */}
      {viewMode === 'stage_distribution' && isAdmin ? (
        <div>
          {/* Timeframe Filter Bar & Summary */}
          <div className="p-3 bg-purple-950/10 dark:bg-purple-950/20 border-b border-purple-900/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-500" />
                Time Period:
              </span>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                {(['today', 'yesterday', 'this_month', 'all'] as TimePeriod[]).map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setTimePeriod(tp)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      timePeriod === tp
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {getTimePeriodLabel(tp)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-slate-600 dark:text-slate-400">
                Staff Members: <strong className="text-slate-900 dark:text-white">{coordinators.length}</strong>
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                Total Leads ({getTimePeriodLabel(timePeriod)}): <strong className="text-purple-600 dark:text-purple-400">{periodTotals.totalLeads}</strong>
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                Active Stages: <strong className="text-slate-900 dark:text-white">{dynamicStages.length}</strong>
              </span>
            </div>
          </div>

          {/* Dynamic Stage Percentage Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#182229]/60">
                  <th className="py-3 px-4 min-w-[200px] sticky left-0 z-10 bg-slate-50 dark:bg-[#182229]">
                    Staff Member
                  </th>
                  <th className="py-3 px-3 text-center min-w-[80px]">Company</th>
                  <th className="py-3 px-3 text-center min-w-[90px] font-mono font-bold text-purple-600 dark:text-purple-400">
                    Total ({getTimePeriodLabel(timePeriod)})
                  </th>
                  {dynamicStages.map((stage) => (
                    <th
                      key={stage.id || stage.key}
                      className="py-3 px-3 text-center min-w-[110px]"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: getStageHexColor(stage.color) }}
                        />
                        <span className="truncate max-w-[100px]" title={stage.label}>
                          {stage.label}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {stageStats.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3 + dynamicStages.length}
                      className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs"
                    >
                      No coordinators found for the selected company filter.
                    </td>
                  </tr>
                ) : (
                  stageStats.map((item) => (
                    <tr
                      key={item.coordinator.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#182229]/50 transition-colors"
                    >
                      {/* Staff Member */}
                      <td className="py-2.5 px-4 sticky left-0 z-10 bg-white dark:bg-[#111b21] group-hover:bg-slate-50">
                        <div className="flex items-center gap-2.5">
                          {item.coordinator.avatar && !item.coordinator.avatar.includes('photo-1534528741775-53994a69daeb') ? (
                            <img
                              src={item.coordinator.avatar}
                              alt={item.coordinator.fullName}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 border border-teal-500/30">
                              {(item.coordinator.fullName || 'C').slice(0, 2).toUpperCase()}
                            </div>
                          )}
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

                      {/* Company Badge */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {item.companyCode === 'CRAS' ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
                            CRAS
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60">
                            RWC
                          </span>
                        )}
                      </td>

                      {/* Total Leads in Period */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono font-bold text-slate-800 dark:text-slate-100">
                        {item.totalPeriodLeads}
                      </td>

                      {/* Stage % and Count Columns */}
                      {dynamicStages.map((stage) => {
                        const cell = item.distribution[stage.key] || { count: 0, percentage: 0 };
                        const hasLeads = cell.count > 0;
                        const stageHex = getStageHexColor(stage.color);

                        return (
                          <td
                            key={stage.id || stage.key}
                            className="py-2.5 px-3 text-center whitespace-nowrap"
                          >
                            {hasLeads ? (
                              <div className="inline-flex flex-col items-center">
                                <span
                                  className="px-2 py-0.5 rounded-md font-mono font-bold text-xs"
                                  style={{
                                    backgroundColor: `${stageHex}25`,
                                    color: stageHex,
                                    border: `1px solid ${stageHex}50`
                                  }}
                                >
                                  {cell.percentage}%
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                  {cell.count} {cell.count === 1 ? 'lead' : 'leads'}
                                </span>
                              </div>
                            ) : (
                              <span className="font-mono text-slate-300 dark:text-slate-700 text-xs">
                                0%
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>

              {/* Table Footer: Totals across all staff */}
              {stageStats.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-bold bg-slate-100/70 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                    <td className="py-3 px-4 sticky left-0 z-10 bg-slate-100 dark:bg-slate-900">
                      Total Across Staff
                    </td>
                    <td className="py-3 px-3 text-center">-</td>
                    <td className="py-3 px-3 text-center font-mono text-purple-600 dark:text-purple-400">
                      {periodTotals.totalLeads}
                    </td>
                    {dynamicStages.map((stage) => {
                      const stageTotal = periodTotals.stageCounts[stage.key] || 0;
                      const overallPct = periodTotals.totalLeads > 0
                        ? Math.round((stageTotal / periodTotals.totalLeads) * 100)
                        : 0;

                      return (
                        <td key={stage.id || stage.key} className="py-3 px-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="font-mono text-xs text-slate-900 dark:text-white">
                              {overallPct}%
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ({stageTotal})
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        /* VIEW 2: STANDARD ASSIGNMENTS OVERVIEW */
        <div>
          {/* Summary KPI Strip */}
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
                            {item.coordinator.avatar && !item.coordinator.avatar.includes('photo-1534528741775-53994a69daeb') ? (
                              <img
                                src={item.coordinator.avatar}
                                alt={item.coordinator.fullName}
                                className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 border border-teal-500/30">
                                {(item.coordinator.fullName || 'C').slice(0, 2).toUpperCase()}
                              </div>
                            )}
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
      )}
    </div>
  );
};
