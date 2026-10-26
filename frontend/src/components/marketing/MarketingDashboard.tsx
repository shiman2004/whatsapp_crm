import React from 'react';
import {
  Plus,
  ArrowRight,
  ShieldCheck,
  Database,
  FileSpreadsheet,
  ArrowUpRight,
  CheckCircle2,
  Users,
  Clock,
  Sparkles,
  TrendingUp,
  Loader2,
  Calendar
} from 'lucide-react';
import { MarketingContact, MarketingImportBatch } from './types';
import { LifecycleBadge } from './MarketingBadges';

interface MarketingDashboardProps {
  contacts: MarketingContact[];
  uploads: MarketingImportBatch[];
  loading: boolean;
  onNavigate: (page: string) => void;
  onRequestApi?: (path: string, init?: RequestInit) => Promise<any>;
}

export const MarketingDashboard: React.FC<MarketingDashboardProps> = ({
  contacts,
  uploads,
  loading,
  onNavigate,
  onRequestApi,
}) => {
  const [dashboardData, setDashboardData] = React.useState<any | null>(null);
  const [fetching, setFetching] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (onRequestApi) {
      setFetching(true);
      onRequestApi('/api/marketing/dashboard')
        .then(res => {
          if (active && res?.data) setDashboardData(res.data);
        })
        .catch(err => console.error('Failed to load marketing dashboard stats', err))
        .finally(() => {
          if (active) setFetching(false);
        });
    }
    return () => {
      active = false;
    };
  }, [onRequestApi]);

  // Fallback to local calculations if API has not responded yet
  const metrics = dashboardData?.metrics || {
    totalContacts: contacts.length,
    unassignedContacts: contacts.filter(c => !c.currentOwnerId).length,
    assignedContacts: contacts.filter(c => !!c.currentOwnerId).length,
    followUpsDue: contacts.filter(c => c.lifecycleStatus === 'follow_up_pending').length,
    interestedContacts: contacts.filter(c => c.lifecycleStatus === 'interested').length,
    convertedLeads: contacts.filter(c => c.lifecycleStatus === 'converted' || !!c.convertedLeadId).length,
    rates: {
      contactRate: contacts.length > 0 ? Math.round((contacts.filter(c => c.lifecycleStatus !== 'new').length / Math.max(1, contacts.filter(c => !!c.currentOwnerId).length)) * 100) : 0,
      qualificationRate: 0,
      leadConversionRate: contacts.length > 0 ? Math.round((contacts.filter(c => c.lifecycleStatus === 'converted').length / contacts.length) * 100) : 0,
    }
  };

  const recentBatch = uploads[0];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* 6 Primary KPI Cards (Section 13) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total Contacts */}
        <div className="rounded-2xl border border-slate-800 bg-[#0D1526]/80 p-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Contacts</span>
              <Database className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <p className="text-2xl font-black text-white mt-1.5">{metrics.totalContacts.toLocaleString()}</p>
          </div>
          <span className="text-[10px] text-teal-300 font-semibold mt-2">Captured pool</span>
        </div>

        {/* 2. Unassigned Contacts */}
        <div className="rounded-2xl border border-slate-800 bg-[#0D1526]/80 p-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unassigned</span>
              <Users className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <p className="text-2xl font-black text-indigo-300 mt-1.5">{metrics.unassignedContacts.toLocaleString()}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('assignment')}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold inline-flex items-center gap-1 mt-2"
          >
            Assign now <ArrowRight className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* 3. Assigned Contacts */}
        <div className="rounded-2xl border border-slate-800 bg-[#0D1526]/80 p-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p className="text-2xl font-black text-blue-300 mt-1.5">{metrics.assignedContacts.toLocaleString()}</p>
          </div>
          <span className="text-[10px] text-blue-400 font-semibold mt-2">Active in queues</span>
        </div>

        {/* 4. Follow-ups Due */}
        <div className="rounded-2xl border border-slate-800 bg-[#0D1526]/80 p-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Follow-ups Due</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-2xl font-black text-amber-300 mt-1.5">{metrics.followUpsDue.toLocaleString()}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('tasks')}
            className="text-[10px] text-amber-400 hover:text-amber-300 font-bold inline-flex items-center gap-1 mt-2"
          >
            Review tasks <ArrowRight className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* 5. Interested Contacts */}
        <div className="rounded-2xl border border-slate-800 bg-[#0D1526]/80 p-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Interested</span>
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-300 mt-1.5">{metrics.interestedContacts.toLocaleString()}</p>
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold mt-2">Ready to convert</span>
        </div>

        {/* 6. Converted Leads */}
        <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300">Converted Leads</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <p className="text-2xl font-black text-teal-300 mt-1.5">{metrics.convertedLeads.toLocaleString()}</p>
          </div>
          <span className="text-[10px] text-teal-400 font-semibold mt-2">Promoted to CRM</span>
        </div>
      </div>

      {/* Calculated Rates Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-800 bg-[#0D1526]/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Contact Rate</span>
            <p className="text-base font-extrabold text-slate-200 mt-0.5">
              {metrics.rates?.contactRate || 0}%
            </p>
          </div>
          <span className="text-[11px] text-slate-500">Contacted / Assigned</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-800 bg-[#0D1526]/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Qualification Rate</span>
            <p className="text-base font-extrabold text-emerald-400 mt-0.5">
              {metrics.rates?.qualificationRate || 0}%
            </p>
          </div>
          <span className="text-[11px] text-slate-500">Interested / Contacted</span>
        </div>

        <div className="p-3.5 rounded-xl border border-teal-500/30 bg-teal-500/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-teal-300">Lead Conversion Rate</span>
            <p className="text-base font-extrabold text-teal-300 mt-0.5">
              {metrics.rates?.leadConversionRate || 0}%
            </p>
          </div>
          <span className="text-[11px] text-teal-400/80">Converted / Total</span>
        </div>
      </div>

      {/* Quick Ingestion CTA Banner */}
      <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-900/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-teal-950/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <p className="font-bold text-white text-sm">Ready to ingest a new contact source?</p>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Add single contacts, paste unformatted numbers, or upload spreadsheets. Numbers are normalized to E.164 (+94...) and deduplicated against the marketing store and active CRM patient files.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('add')}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-teal-300 transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Contacts
        </button>
      </div>

      {/* Recent Ingestion Preview */}
      <div className="rounded-2xl border border-slate-800 bg-[#0D1526]/60 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Recent Marketing Ingests</h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('contacts')}
            className="text-xs text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-1"
          >
            Browse all contacts ({contacts.length}) <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No contacts recorded yet. Click &quot;Add Contacts&quot; to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">Serial</th>
                  <th className="px-4 py-2.5">Phone (E.164)</th>
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Added Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {contacts.slice(0, 6).map(c => (
                  <tr key={c.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-slate-300 font-semibold">{c.serialNumber}</td>
                    <td className="px-4 py-2.5 font-mono text-teal-300">{c.normalizedPhone}</td>
                    <td className="px-4 py-2.5 text-slate-300">{c.originalSource}</td>
                    <td className="px-4 py-2.5"><LifecycleBadge status={c.lifecycleStatus} /></td>
                    <td className="px-4 py-2.5 text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
