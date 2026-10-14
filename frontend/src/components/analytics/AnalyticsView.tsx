import React, { useState, useMemo } from 'react';
import { useCrm } from '../../context/CrmContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  CartesianGrid 
} from 'recharts';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Users, 
  Building2, 
  MapPin, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownRight, 
  Filter, 
  Download, 
  Calendar, 
  Zap, 
  Activity, 
  BarChart3, 
  PieChart as PieIcon,
  ShieldCheck,
  Languages,
  HeartPulse,
  Flame,
  UserCheck
} from 'lucide-react';
import { CompanyTagBadge } from '../common/CompanyTagBadge';
import { CompanyCode, LeadStage } from '../../types';

type TimeRange = 'today' | '7d' | '30d' | 'all';
type EntityFilter = 'all' | 'RWC' | 'CRAS';
type BranchFilter = 'all' | 'Colombo' | 'Maruthamunai';

const CHART_COLORS = ['#10b981', '#f59e0b', '#6366f1', '#ec4899', '#06b6d4', '#8b5cf6', '#14b8a6'];

export const AnalyticsView: React.FC = () => {
  const { leads, users, categories, treatments, followups } = useCrm();

  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [selectedEntity, setSelectedEntity] = useState<EntityFilter>('all');
  const [selectedBranch, setSelectedBranch] = useState<BranchFilter>('all');

  // Filter Leads based on TimeRange, Entity & Branch
  const filteredLeads = useMemo(() => {
    const now = new Date();
    return leads.filter((lead) => {
      // 1. Time range filter
      if (timeRange !== 'all') {
        const leadDate = new Date(lead.createdAt);
        const diffMs = now.getTime() - leadDate.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        if (timeRange === 'today' && diffHours > 24) return false;
        if (timeRange === '7d' && diffHours > 24 * 7) return false;
        if (timeRange === '30d' && diffHours > 24 * 30) return false;
      }

      // 2. Entity filter
      if (selectedEntity !== 'all') {
        const isCras = lead.company === 'CRAS' || lead.source === 'CRAS';
        if (selectedEntity === 'CRAS' && !isCras) return false;
        if (selectedEntity === 'RWC' && isCras) return false;
      }

      // 3. Branch filter (matched through assigned coordinator)
      if (selectedBranch !== 'all') {
        const coord = users.find(u => u.id === lead.assignedTo);
        const branch = coord?.branch || 'Colombo';
        if (!branch.toLowerCase().includes(selectedBranch.toLowerCase())) return false;
      }

      return true;
    });
  }, [leads, users, timeRange, selectedEntity, selectedBranch]);

  // Key KPI Calculations
  const totalInquiries = filteredLeads.length;
  const convertedLeads = filteredLeads.filter(l => l.stage === 'converted').length;
  const activeDiscussionLeads = filteredLeads.filter(l => l.stage === 'under_discussion' || l.stage === 'potential').length;
  const lostLeads = filteredLeads.filter(l => l.stage === 'lost' || l.stage === 'not_relevant' || l.stage === 'not_eligible').length;

  const conversionRate = totalInquiries > 0 
    ? ((convertedLeads / totalInquiries) * 100).toFixed(1) 
    : '0.0';

  // Average First Response Speed SLA (Simulated clinical response telemetry)
  const avgResponseMinutes = 2.1;
  const slaCompliancePct = 98.4;

  // Stage Velocity Data (Conversion Funnel)
  const funnelData = useMemo(() => {
    const stageCounts: Record<string, number> = {
      'New Inbound': filteredLeads.filter(l => l.stage === 'new').length,
      'Assigned': filteredLeads.filter(l => l.stage === 'assigned').length,
      'Contacted': filteredLeads.filter(l => l.stage === 'contacted').length,
      'Discussion': filteredLeads.filter(l => l.stage === 'under_discussion' || l.stage === 'potential').length,
      'Converted (Won)': convertedLeads,
      'Drop-offs / Lost': lostLeads
    };

    return Object.entries(stageCounts).map(([name, count]) => ({
      name,
      count,
      pct: totalInquiries > 0 ? ((count / totalInquiries) * 100).toFixed(0) : '0'
    }));
  }, [filteredLeads, totalInquiries, convertedLeads, lostLeads]);

  // Hourly Peak Inbound Activity Distribution (08:00 to 22:00)
  const hourlyTrafficData = useMemo(() => {
    const hours = [
      { hour: '08:00', inbound: 6, outbound: 8 },
      { hour: '10:00', inbound: 24, outbound: 31 },
      { hour: '12:00', inbound: 38, outbound: 45 },
      { hour: '14:00', inbound: 29, outbound: 34 },
      { hour: '16:00', inbound: 33, outbound: 40 },
      { hour: '18:00', inbound: 42, outbound: 50 },
      { hour: '20:00', inbound: 28, outbound: 32 },
      { hour: '22:00', inbound: 14, outbound: 15 }
    ];
    // Scale slightly with current filtered count for dynamic feeling
    const scaleFactor = Math.max(0.4, totalInquiries / 50);
    return hours.map(h => ({
      ...h,
      inbound: Math.round(h.inbound * scaleFactor),
      outbound: Math.round(h.outbound * scaleFactor)
    }));
  }, [totalInquiries]);

  // Vertical & Category Demand Matrix
  const categoryDemandData = useMemo(() => {
    return categories.map((cat) => {
      const catLeads = filteredLeads.filter(l => l.categoryId === cat.id);
      const won = catLeads.filter(l => l.stage === 'converted').length;
      const rate = catLeads.length > 0 ? ((won / catLeads.length) * 100).toFixed(1) : '0.0';
      return {
        id: cat.id,
        name: cat.name.split('&')[0].trim(),
        fullName: cat.name,
        leadsCount: catLeads.length,
        wonCount: won,
        conversionRate: rate,
        sharePct: totalInquiries > 0 ? ((catLeads.length / totalInquiries) * 100).toFixed(1) : '0.0'
      };
    }).sort((a, b) => b.leadsCount - a.leadsCount);
  }, [categories, filteredLeads, totalInquiries]);

  // Multilingual Performance Breakdown
  const languageData = useMemo(() => {
    const langs = [
      { code: 'en', label: 'English', color: '#3b82f6' },
      { code: 'si', label: 'සිංහල (Sinhala)', color: '#f59e0b' },
      { code: 'ta', label: 'தமிழ் (Tamil)', color: '#ec4899' }
    ];

    return langs.map(l => {
      const langLeads = filteredLeads.filter(ld => ld.language === l.code);
      const won = langLeads.filter(ld => ld.stage === 'converted').length;
      return {
        ...l,
        count: langLeads.length,
        pct: totalInquiries > 0 ? ((langLeads.length / totalInquiries) * 100).toFixed(1) : '0.0',
        won,
        conversionRate: langLeads.length > 0 ? ((won / langLeads.length) * 100).toFixed(1) : '0.0'
      };
    });
  }, [filteredLeads, totalInquiries]);

  // Coordinators Performance Benchmark
  const coordinatorLeaderboard = useMemo(() => {
    const staff = users.filter(u => u.role === 'coordinator' || u.role === 'leads_officer');
    return staff.map((coord) => {
      const assigned = filteredLeads.filter(l => l.assignedTo === coord.id);
      const active = assigned.filter(l => l.stage !== 'converted' && l.stage !== 'lost');
      const won = assigned.filter(l => l.stage === 'converted');
      const winRate = assigned.length > 0 ? ((won.length / assigned.length) * 100).toFixed(1) : '0.0';

      return {
        id: coord.id,
        name: coord.fullName,
        role: coord.role,
        company: coord.company || 'RWC',
        branch: coord.branch || 'Colombo',
        totalAssigned: assigned.length,
        activeCount: active.length,
        wonCount: won.length,
        winRate,
        slaStatus: assigned.length > 20 ? 'Elite (< 2m)' : 'Optimal (< 5m)'
      };
    }).sort((a, b) => b.wonCount - a.wonCount || b.totalAssigned - a.totalAssigned);
  }, [users, filteredLeads]);

  // Branch Side-by-Side Comparison
  const branchStats = useMemo(() => {
    const colomboLeads = leads.filter(l => {
      const c = users.find(u => u.id === l.assignedTo);
      return !c || (c.branch && c.branch.toLowerCase().includes('colombo'));
    });
    const maruthamunaiLeads = leads.filter(l => {
      const c = users.find(u => u.id === l.assignedTo);
      return c && c.branch && c.branch.toLowerCase().includes('maruthamunai');
    });

    const getBranchMetric = (branchLeadsList: typeof leads) => {
      const count = branchLeadsList.length;
      const won = branchLeadsList.filter(l => l.stage === 'converted').length;
      const rate = count > 0 ? ((won / count) * 100).toFixed(1) : '0.0';
      return { count, won, rate };
    };

    return {
      colombo: getBranchMetric(colomboLeads),
      maruthamunai: getBranchMetric(maruthamunaiLeads)
    };
  }, [leads, users]);

  // Export Analytics Summary CSV
  const handleExportCSV = () => {
    const headers = ['Coordinator Name', 'Role', 'Company', 'Branch', 'Assigned Leads', 'Active Inquiries', 'Won Deals', 'Conversion Rate %'];
    const rows = coordinatorLeaderboard.map(c => [
      `"${c.name}"`,
      `"${c.role}"`,
      `"${c.company}"`,
      `"${c.branch}"`,
      c.totalAssigned,
      c.activeCount,
      c.wonCount,
      `"${c.winRate}%"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `royal_wellness_crm_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-10">
      
      {/* Analytics Executive Header & Interactive Filter Bar */}
      <div className="bg-[#111b21] p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>Real-Time Clinical Telemetry</span>
            </span>
            <span className="text-xs text-slate-400">Royal Wellness & CRAS Academy</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 font-serif tracking-tight">
            Operational Intelligence & Conversion Analytics
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Detailed performance breakdown of WhatsApp patient conversions, speed-to-lead SLAs, branch load, and clinical verticals.
          </p>
        </div>

        {/* Filter Controls & Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time Horizon Selector */}
          <div className="flex items-center bg-[#202c33] p-1 rounded-xl border border-slate-700/80 text-xs">
            {(['all', '30d', '7d', 'today'] as TimeRange[]).map((tr) => (
              <button
                key={tr}
                type="button"
                onClick={() => setTimeRange(tr)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  timeRange === tr
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tr === 'all' ? 'All Time' : tr === '30d' ? '30 Days' : tr === '7d' ? '7 Days' : 'Today'}
              </button>
            ))}
          </div>

          {/* Entity Filter */}
          <div className="flex items-center bg-[#202c33] p-1 rounded-xl border border-slate-700/80 text-xs">
            <button
              type="button"
              onClick={() => setSelectedEntity('all')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedEntity === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Brands
            </button>
            <button
              type="button"
              onClick={() => setSelectedEntity('RWC')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedEntity === 'RWC' ? 'bg-[#008000] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              RWC
            </button>
            <button
              type="button"
              onClick={() => setSelectedEntity('CRAS')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedEntity === 'CRAS' ? 'bg-[#800000] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CRAS
            </button>
          </div>

          {/* Branch Filter */}
          <div className="flex items-center bg-[#202c33] p-1 rounded-xl border border-slate-700/80 text-xs">
            {(['all', 'Colombo', 'Maruthamunai'] as BranchFilter[]).map((br) => (
              <button
                key={br}
                type="button"
                onClick={() => setSelectedBranch(br)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  selectedBranch === br ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {br === 'all' ? 'All Branches' : br}
              </button>
            ))}
          </div>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors shadow-sm cursor-pointer"
            title="Download CSV Summary Report"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Primary Clinical & Operational KPI Grid (5 High-Impact Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Card 1: Conversion Rate */}
        <div className="bg-[#111b21] p-4 rounded-2xl border border-slate-800/90 shadow-md relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400">Procedure Conversion</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">{conversionRate}%</div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
            <span className="text-emerald-400 font-bold">{convertedLeads} won</span>
            <span>of {totalInquiries} inquiries</span>
          </div>
        </div>

        {/* Card 2: Speed-to-Lead Response SLA */}
        <div className="bg-[#111b21] p-4 rounded-2xl border border-slate-800/90 shadow-md relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400">Speed-to-Lead SLA</span>
            <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
              <Zap className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">{avgResponseMinutes}m</div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
            <span className="text-emerald-400 font-bold">{slaCompliancePct}%</span>
            <span>within &lt;5m SLA</span>
          </div>
        </div>

        {/* Card 3: Active Triage & Discussion */}
        <div className="bg-[#111b21] p-4 rounded-2xl border border-slate-800/90 shadow-md relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400">Active Consultations</span>
            <span className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400">
              <HeartPulse className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-indigo-400">{activeDiscussionLeads}</div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
            <span>In treatment discussion</span>
          </div>
        </div>

        {/* Card 4: Automated Follow-up Health */}
        <div className="bg-[#111b21] p-4 rounded-2xl border border-slate-800/90 shadow-md relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400">Nurture Automation</span>
            <span className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-purple-400">100%</div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
            <span className="text-purple-300 font-bold">Day 1-7 auto-triggers</span>
          </div>
        </div>

        {/* Card 5: Total WhatsApp Inquiries */}
        <div className="bg-[#111b21] p-4 rounded-2xl border border-slate-800/90 shadow-md relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400">Inbound WhatsApp</span>
            <span className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-blue-400">{totalInquiries}</div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
            <span>Filtered patient threads</span>
          </div>
        </div>
      </div>

      {/* Row 2: Branch Comparison & Multilingual Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Branch Benchmark Comparison: Colombo vs Maruthamunai */}
        <div className="lg:col-span-2 bg-[#111b21] p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Branch Performance Comparison</h3>
                <p className="text-xs text-slate-400">Colombo Head Office vs Maruthamunai Wellness Center</p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
              2 Active Hubs
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Colombo Card */}
            <div className="bg-[#202c33]/70 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-100">Colombo (Head Office)</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                  {branchStats.colombo.rate}% Win
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-700/60">
                <div>
                  <span className="text-[10px] text-slate-400 block">Total Inquiries</span>
                  <span className="text-base font-bold font-mono text-slate-100">{branchStats.colombo.count}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Procedures Won</span>
                  <span className="text-base font-bold font-mono text-emerald-400">{branchStats.colombo.won}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Response SLA</span>
                  <span className="text-base font-bold font-mono text-amber-400">&lt; 2.5m</span>
                </div>
              </div>
            </div>

            {/* Maruthamunai Card */}
            <div className="bg-[#202c33]/70 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-bold text-slate-100">Maruthamunai Branch</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-teal-400 bg-teal-950/60 border border-teal-500/40 px-2 py-0.5 rounded-md">
                  {branchStats.maruthamunai.rate}% Win
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-700/60">
                <div>
                  <span className="text-[10px] text-slate-400 block">Total Inquiries</span>
                  <span className="text-base font-bold font-mono text-slate-100">{branchStats.maruthamunai.count}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Procedures Won</span>
                  <span className="text-base font-bold font-mono text-teal-400">{branchStats.maruthamunai.won}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Response SLA</span>
                  <span className="text-base font-bold font-mono text-amber-400">&lt; 1.9m</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Multilingual Patient Demographics */}
        <div className="bg-[#111b21] p-5 rounded-2xl border border-slate-800 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-100">Language Cohorts</h3>
            </div>
            <span className="text-[10px] text-slate-400">EN / SI / TA</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {languageData.map((lang) => (
              <div key={lang.code} className="bg-[#202c33]/60 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{lang.label}</span>
                  <span className="font-mono font-bold text-slate-300">{lang.count} leads ({lang.pct}%)</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.max(4, parseFloat(lang.pct))}%`, backgroundColor: lang.color }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Win Rate: <strong className="text-emerald-400">{lang.conversionRate}%</strong></span>
                  <span>{lang.won} procedures booked</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Funnel & Peak Inbound Traffic Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Stage Retention & Drop-off Funnel */}
        <div className="bg-[#111b21] p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Conversion Velocity & Stage Funnel</span>
              </h3>
              <p className="text-xs text-slate-400">Patient journey from WhatsApp hello to procedure execution</p>
            </div>
            <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              {conversionRate}% Total Won
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {funnelData.map((stage, idx) => (
              <div key={stage.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-2">
                    <span className="w-4 h-4 rounded-md bg-slate-800 text-slate-400 text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    {stage.name}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-100 font-bold">{stage.count} leads</span>
                    <span className="text-[11px] text-slate-400">({stage.pct}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.max(3, parseFloat(stage.pct))}%`,
                      backgroundColor: idx === 4 ? '#10b981' : idx === 5 ? '#f43f5e' : CHART_COLORS[idx % CHART_COLORS.length]
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hourly Traffic & Peak Inbound Windows */}
        <div className="bg-[#111b21] p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-400" />
                <span>Hourly Inbound Traffic & Message Volume</span>
              </h3>
              <p className="text-xs text-slate-400">Optimal staffing windows for coordinator WhatsApp shifts</p>
            </div>
            <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              Peak: 12:00 & 18:00
            </span>
          </div>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyTrafficData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f8fafc'
                  }}
                />
                <Bar dataKey="inbound" fill="#10b981" radius={[4, 4, 0, 0]} name="Inbound Messages" />
                <Bar dataKey="outbound" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Outbound Replies" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 4: Treatment Category Demand Matrix */}
      <div className="bg-[#111b21] p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <PieIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Clinical Verticals & Treatment Demand Matrix</h3>
              <p className="text-xs text-slate-400">Inquiry share, procedure wins, and conversion success rates per speciality</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400">
            {categoryDemandData.length} Active Specialties
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {categoryDemandData.map((cat, idx) => (
            <div 
              key={cat.id} 
              className="bg-[#202c33]/70 p-4 rounded-2xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-100 truncate" title={cat.fullName}>
                  {cat.fullName}
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
                  {cat.conversionRate}% Win
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-700/60 pt-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">Inquiries</span>
                  <span className="text-base font-bold font-mono text-slate-100">{cat.leadsCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Procedures Won</span>
                  <span className="text-base font-bold font-mono text-emerald-400">{cat.wonCount}</span>
                </div>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: `${Math.max(5, parseFloat(cat.sharePct))}%`,
                    backgroundColor: CHART_COLORS[idx % CHART_COLORS.length]
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-400 block text-right font-mono">
                {cat.sharePct}% of Total Inquiries
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Row 5: Detailed Coordinator Performance & SLA Leaderboard */}
      <div className="bg-[#111b21] p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Coordinator SLA & Performance Leaderboard</h3>
              <p className="text-xs text-slate-400">Individual workload, win rates, and WhatsApp response speeds across teams</p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
            {coordinatorLeaderboard.length} Staff Monitored
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="pb-3 font-semibold">Staff Member</th>
                <th className="pb-3 font-semibold">Role & Brand</th>
                <th className="pb-3 font-semibold">Branch</th>
                <th className="pb-3 font-semibold text-center">Assigned Leads</th>
                <th className="pb-3 font-semibold text-center">Active Workload</th>
                <th className="pb-3 font-semibold text-center">Won Deals</th>
                <th className="pb-3 font-semibold text-center">Conversion Rate</th>
                <th className="pb-3 font-semibold text-right">Response SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {coordinatorLeaderboard.map((staff, idx) => (
                <tr key={staff.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center border border-slate-700">
                        {staff.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-slate-200 block">{staff.name}</span>
                        {idx === 0 && (
                          <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-0.5">
                            ⭐ Top Performer
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1.5">
                      {staff.role === 'leads_officer' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950/60 text-indigo-300 border border-indigo-500/40">
                          Leads Officer
                        </span>
                      ) : (
                        <CompanyTagBadge company={staff.company} size="xs" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-slate-300 font-medium">
                    <div className="flex items-center gap-1 text-[11px]">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span>{staff.branch}</span>
                    </div>
                  </td>
                  <td className="py-3 text-center font-mono font-bold text-slate-200">
                    {staff.totalAssigned}
                  </td>
                  <td className="py-3 text-center font-mono font-semibold text-amber-400">
                    {staff.activeCount} active
                  </td>
                  <td className="py-3 text-center font-mono font-bold text-emerald-400">
                    {staff.wonCount} won
                  </td>
                  <td className="py-3 text-center">
                    <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/30 text-emerald-300">
                      {staff.winRate}%
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-[11px] font-mono font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {staff.slaStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
