import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  CheckCircle2,
  ShieldCheck,
  Database,
  ArrowUpRight,
  Loader2,
  Download,
  Calendar,
  Filter
} from 'lucide-react';
import { MarketingReportData } from './types';
import { API_BASE_URL } from '../../config/api';

interface MarketingReportsProps {
  loading: boolean;
  onRequestApi: (path: string, init?: RequestInit) => Promise<any>;
}

type DateRange = 'today' | 'yesterday' | 'last7days' | 'this_month' | 'last_month' | 'all';

export const MarketingReports: React.FC<MarketingReportsProps> = ({ loading, onRequestApi }) => {
  const [range, setRange] = React.useState<DateRange>('this_month');
  const [report, setReport] = React.useState<any | null>(null);
  const [fetching, setFetching] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);

  const loadReports = React.useCallback(async (selectedRange: DateRange) => {
    setFetching(true);
    try {
      const response = await onRequestApi(`/api/marketing/reports?range=${selectedRange}`);
      if (response?.data) {
        setReport(response.data);
      }
    } catch (e) {
      console.error('Failed to load reports', e);
    } finally {
      setFetching(false);
    }
  }, [onRequestApi]);

  React.useEffect(() => {
    void loadReports(range);
  }, [range, loadReports]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('rw_crm_auth_token') || '';
      const response = await fetch(`${API_BASE_URL}/api/marketing/reports?range=${range}&export=csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to download CSV');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `marketing-report-${range}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV', err);
    } finally {
      setExporting(false);
    }
  };

  if (fetching || loading) {
    return (
      <div className="p-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
        <span>Calculating marketing funnel analytics...</span>
      </div>
    );
  }

  const totalContacts = report?.contacts || 0;
  const assigned = report?.assigned || 0;
  const unassigned = report?.unassigned || 0;
  const converted = report?.converted || 0;
  const verifiedConsent = report?.verifiedConsent || 0;

  const totalSubmitted = report?.imports?.totalSubmitted || 0;
  const savedClean = report?.imports?.savedCount || 0;
  const duplicates = report?.imports?.duplicateCount || 0;
  const invalid = report?.imports?.invalidCount || 0;

  const conversionRate = totalContacts > 0 ? ((converted / totalContacts) * 100).toFixed(1) : '0.0';
  const consentRate = totalContacts > 0 ? ((verifiedConsent / totalContacts) * 100).toFixed(1) : '0.0';

  const coordinators: any[] = report?.coordinatorPerformance || [];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Top Header with Date Filter and Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-teal-400" />
            Marketing Funnel & Conversion Analytics
          </h3>
          <p className="text-xs text-slate-400">
            Measure lead acquisition productivity, opt-in consent compliance, and CRM lead conversion ROI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Selector */}
          <div className="inline-flex rounded-lg border border-slate-700/80 bg-slate-900 p-0.5 text-xs">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last7days', label: 'Last 7 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRange(item.id as DateRange)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  range === item.id
                    ? 'bg-teal-400 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Export CSV button */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs font-bold text-slate-200 hover:text-teal-300 hover:border-teal-500/50 transition-colors shadow-xs"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export CSV
          </button>
        </div>
      </div>

      {/* Top ROI KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1526]/80 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Contacts</span>
          <p className="text-2xl font-black text-white">{totalContacts.toLocaleString()}</p>
          <span className="text-[11px] text-teal-400 font-medium">Public Ingest Pool</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1526]/80 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Verified Consent</span>
          <p className="text-2xl font-black text-emerald-400">{verifiedConsent.toLocaleString()}</p>
          <span className="text-[11px] text-emerald-300 font-medium">{consentRate}% compliance rate</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1526]/80 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Assigned to Officers</span>
          <p className="text-2xl font-black text-indigo-300">{assigned.toLocaleString()}</p>
          <span className="text-[11px] text-slate-400 font-medium">{unassigned} unassigned in pool</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1526]/80 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Converted to CRM Leads</span>
          <p className="text-2xl font-black text-teal-400">{converted.toLocaleString()}</p>
          <span className="text-[11px] text-teal-300 font-medium">{conversionRate}% conversion yield</span>
        </div>
      </div>

      {/* Conversion Funnel Progression */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526]/80 p-5 space-y-4">
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-teal-400" />
          Lead Conversion Progression Funnel
        </h4>

        <div className="space-y-3">
          {/* Step 1: Ingested */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">1. Captured Public Contacts</span>
              <span className="font-mono text-white font-bold">{totalContacts} (100%)</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden">
              <div className="h-full bg-slate-600 rounded-full w-full" />
            </div>
          </div>

          {/* Step 2: Allocated */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">2. Allocated to Coordinators & Counsellors</span>
              <span className="font-mono text-indigo-300 font-bold">
                {assigned} ({totalContacts > 0 ? Math.round((assigned / totalContacts) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${totalContacts > 0 ? Math.min(100, Math.round((assigned / totalContacts) * 100)) : 0}%` }}
              />
            </div>
          </div>

          {/* Step 3: Verified Consent */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">3. Verified Opt-in Consent Logged</span>
              <span className="font-mono text-emerald-300 font-bold">
                {verifiedConsent} ({totalContacts > 0 ? Math.round((verifiedConsent / totalContacts) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${totalContacts > 0 ? Math.min(100, Math.round((verifiedConsent / totalContacts) * 100)) : 0}%` }}
              />
            </div>
          </div>

          {/* Step 4: Converted */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">4. Converted to Qualified CRM Leads</span>
              <span className="font-mono text-teal-300 font-bold">
                {converted} ({conversionRate}%)
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-teal-400 rounded-full shadow-xs shadow-teal-400 transition-all duration-500"
                style={{ width: `${Math.max(converted > 0 ? 4 : 0, totalContacts > 0 ? Math.min(100, Math.round((converted / totalContacts) * 100)) : 0)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Coordinator Outreach Productivity Table */}
      {coordinators.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-[#0D1526]/80 p-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-400" />
            Coordinator Outreach & Productivity Breakdown
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">Staff Name</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5 text-right">Assigned</th>
                  <th className="px-4 py-2.5 text-right">Contacted</th>
                  <th className="px-4 py-2.5 text-right">Interested</th>
                  <th className="px-4 py-2.5 text-right">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {coordinators.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2.5 font-bold font-sans text-white">{c.name}</td>
                    <td className="px-4 py-2.5 font-sans text-slate-400 uppercase text-[10px]">{c.role}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{c.assigned}</td>
                    <td className="px-4 py-2.5 text-right text-blue-400">{c.contacted}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-400 font-bold">{c.interested}</td>
                    <td className="px-4 py-2.5 text-right text-teal-300">{c.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ingestion Data Quality & Task Execution Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526]/80 p-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            Ingest Hygiene & Deduplication
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every submitted batch undergoes automatic E.164 normalization and cross-table deduplication against active customer leads.
          </p>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs p-2 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-300">Clean Saved Numbers:</span>
              <span className="font-mono font-bold text-emerald-400">{savedClean}</span>
            </div>
            <div className="flex items-center justify-between text-xs p-2 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-300">Duplicates Filtered:</span>
              <span className="font-mono font-bold text-amber-400">{duplicates}</span>
            </div>
            <div className="flex items-center justify-between text-xs p-2 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-300">Invalid / Malformed Quarantined:</span>
              <span className="font-mono font-bold text-rose-400">{invalid}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1526]/80 p-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-400" />
            Task Pipeline Status Distribution
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Distribution of assigned marketing tasks across lifecycle stages.
          </p>

          <div className="space-y-2 pt-2">
            {report?.tasks && report.tasks.length > 0 ? (
              report.tasks.map((t: any) => (
                <div key={t.status} className="flex items-center justify-between text-xs p-2 rounded bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-300 uppercase tracking-wider text-[11px] font-semibold">
                    {t.status.replace('_', ' ')}:
                  </span>
                  <span className="font-mono font-bold text-white">{t._count._all}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 p-4 text-center">No active task status entries recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
