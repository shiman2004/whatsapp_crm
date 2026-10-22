import React from 'react';
import { Plus, ArrowRight, ShieldCheck, Database, FileSpreadsheet, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { MarketingContact, MarketingImportBatch } from './types';
import { LifecycleBadge } from './MarketingBadges';

interface MarketingDashboardProps {
  contacts: MarketingContact[];
  uploads: MarketingImportBatch[];
  loading: boolean;
  onNavigate: (page: string) => void;
}

export const MarketingDashboard: React.FC<MarketingDashboardProps> = ({
  contacts,
  uploads,
  loading,
  onNavigate,
}) => {
  const convertedCount = contacts.filter(c => c.lifecycleStatus === 'converted' || !!c.convertedLeadId).length;
  const verifiedCount = contacts.filter(c => c.consentStatus === 'verified').length;
  const assignedCount = contacts.filter(c => !!c.currentOwnerId).length;
  const recentBatch = uploads[0];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* 2-Column Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contact Database Stats */}
        <div className="rounded-xl border border-slate-800 bg-[#0D1526]/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Total Contact Pool</span>
              <Database className="w-4 h-4 text-teal-400" />
            </div>
            <p className="text-3xl font-black text-white mt-2">{contacts.length.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">
              Public contacts captured under marketing boundaries.
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Assigned: <strong className="text-slate-200">{assignedCount}</strong></span>
            <button
              type="button"
              onClick={() => onNavigate('contacts')}
              className="text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-1"
            >
              Browse contacts <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Lead Conversion Health */}
        <div className="rounded-xl border border-slate-800 bg-[#0D1526]/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Qualified CRM Leads</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-black text-emerald-400 mt-2">{convertedCount.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">
              Contacts converted and routed into the CRM sales pipeline.
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Verified opt-in: <strong className="text-emerald-300">{verifiedCount}</strong></span>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1"
            >
              View funnel <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Latest Import Batch */}
        <div className="rounded-xl border border-slate-800 bg-[#0D1526]/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Latest Import Batch</span>
              <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-base font-bold text-white mt-2 truncate">
              {recentBatch ? recentBatch.batchNumber : 'No batches yet'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {recentBatch ? (
                <>
                  <span className="text-cyan-300 font-bold">{recentBatch.savedCount}</span> saved,{' '}
                  <span className="text-amber-300 font-bold">{recentBatch.duplicateCount}</span> dupes skipped
                </>
              ) : (
                'Start by capturing public contacts.'
              )}
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              {recentBatch?.source ? `Source: ${recentBatch.source}` : 'Ready for ingestion'}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('uploads')}
              className="text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1"
            >
              All uploads <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Ingestion Banner */}
      <div className="rounded-xl border border-teal-500/30 bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-900/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-teal-950/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <p className="font-bold text-white text-sm">Ready to capture a new source?</p>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Ingest numbers via single entry, bulk raw paste, or CSV file. All numbers are normalized to E.164 and deduplicated against marketing contacts and active CRM leads.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('add')}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-teal-300 transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" /> Add numbers
        </button>
      </div>

      {/* Recent Contacts Preview Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526]/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Recent Contacts</h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('contacts')}
            className="text-xs text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-1"
          >
            View all ({contacts.length}) <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No contacts recorded yet. Click &quot;Add numbers&quot; to begin.
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
                {contacts.slice(0, 5).map(c => (
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

      {/* Compliance Guidelines Footer Card */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 flex items-start gap-3 text-xs text-slate-400">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-200">Marketing Quarantine Boundary</p>
          <p className="leading-relaxed">
            Public contacts remain strictly isolated inside the marketing data store. Only contacts with logged consent and verified interest can be converted into the active CRM leads pipeline.
          </p>
        </div>
      </div>
    </div>
  );
};
