import React from 'react';
import { BarChart3, TrendingUp, Users, CheckCircle2, ShieldCheck, Database, ArrowUpRight, Loader2, ArrowRight } from 'lucide-react';
import { MarketingReportData } from './types';

interface MarketingReportsProps {
  loading: boolean;
  onRequestApi: (path: string, init?: RequestInit) => Promise<any>;
}

export const MarketingReports: React.FC<MarketingReportsProps> = ({ loading, onRequestApi }) => {
  const [report, setReport] = React.useState<MarketingReportData | null>(null);
  const [fetching, setFetching] = React.useState(true);

  const loadReports = React.useCallback(async () => {
    setFetching(true);
    try {
      const response = await onRequestApi('/api/marketing/reports');
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
    void loadReports();
  }, [loadReports]);

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

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-teal-400" />
          Marketing Funnel & Conversion Analytics
        </h3>
        <p className="text-xs text-slate-400">
          Measure lead acquisition productivity, opt-in consent compliance, and CRM lead conversion ROI.
        </p>
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
          <span className="text-[11px] text-slate-400 font-medium">{unassigned} in unassigned pool</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1526]/80 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Converted to CRM Leads</span>
          <p className="text-2xl font-black text-teal-400">{converted.toLocaleString()}</p>
          <span className="text-[11px] text-teal-300 font-medium">{conversionRate}% conversion yield</span>
        </div>
      </div>

      {/* Conversion Funnel Visualization */}
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
              <span className="text-slate-300 font-semibold">2. Allocated to Marketing Officers</span>
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

      {/* Ingestion Data Quality & Deduplication Hygiene */}
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

        {/* Task Execution Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-[#0D1526]/80 p-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-400" />
            Marketing Officer Workload Status
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Real-time breakdown of allocated officer tasks across different stages.
          </p>

          <div className="space-y-2 pt-2">
            {report?.tasks && report.tasks.length > 0 ? (
              report.tasks.map(t => (
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

