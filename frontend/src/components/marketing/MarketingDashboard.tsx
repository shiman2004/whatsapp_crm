import React from 'react';
import {
  Plus,
  ArrowRight,
  ShieldCheck,
  Database,
  ArrowUpRight,
  CheckCircle2,
  Users,
  Clock,
  Sparkles,
  Loader2,
  Activity,
  UserPlus,
  Target,
  ChevronRight,
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

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-[#0B1323] shadow-[0_18px_48px_rgba(0,0,0,0.18)] overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-teal-400" />
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">Marketing operations</p>
              {fetching && <Loader2 className="h-3 w-3 animate-spin text-slate-500" aria-label="Refreshing dashboard" />}
            </div>
            <h2 className="mt-1 text-lg font-black tracking-tight text-white">Today&apos;s contact queue</h2>
          </div>
          <button type="button" onClick={() => onNavigate('add')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition-colors hover:bg-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:ring-offset-2 focus:ring-offset-[#0B1323]">
            <Plus className="h-4 w-4" /> Add contact
          </button>
        </div>
        <div className="grid divide-y divide-slate-800 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <div className="flex items-center justify-between text-slate-400"><span className="text-[10px] font-bold uppercase tracking-wider">Contact pool</span><Database className="h-4 w-4 text-teal-400" /></div>
            <p className="mt-2 text-3xl font-black tracking-tight text-white">{metrics.totalContacts.toLocaleString()}</p>
            <p className="mt-1 text-xs text-slate-500">Contacts available to work</p>
          </div>
          <button type="button" onClick={() => onNavigate('assignment')} className="group p-5 text-left transition-colors hover:bg-indigo-400/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400">
            <div className="flex items-center justify-between text-slate-400"><span className="text-[10px] font-bold uppercase tracking-wider">Needs assignment</span><Users className="h-4 w-4 text-indigo-400" /></div>
            <p className="mt-2 text-3xl font-black tracking-tight text-indigo-300">{metrics.unassignedContacts.toLocaleString()}</p>
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-300">Open assignment queue <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
          </button>
          <button type="button" onClick={() => onNavigate('tasks')} className="group p-5 text-left transition-colors hover:bg-amber-400/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-400">
            <div className="flex items-center justify-between text-slate-400"><span className="text-[10px] font-bold uppercase tracking-wider">Next action</span><Clock className="h-4 w-4 text-amber-400" /></div>
            <p className="mt-2 text-3xl font-black tracking-tight text-amber-300">{metrics.followUpsDue.toLocaleString()}</p>
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-300">Review follow-ups <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-[#0D1526]/80 p-4 sm:p-5">
        <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Lifecycle</p><h3 className="mt-1 text-sm font-bold text-white">Pipeline at a glance</h3></div><span className="hidden text-xs text-slate-500 sm:block">From active queue to CRM lead</span></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Assigned', metrics.assignedContacts, 'Active in queues', CheckCircle2, 'text-blue-300', 'border-blue-500/20'],
            ['Follow-ups due', metrics.followUpsDue, 'Needs review', Clock, 'text-amber-300', 'border-amber-500/20'],
            ['Interested', metrics.interestedContacts, 'Ready to convert', Sparkles, 'text-emerald-300', 'border-emerald-500/20'],
            ['Converted', metrics.convertedLeads, 'Promoted to CRM', ArrowUpRight, 'text-teal-300', 'border-teal-500/30'],
          ].map(([label, value, note, Icon, color, border], index) => {
            const StepIcon = Icon as React.ElementType;
            return <div key={label as string} className={`relative border-l-2 ${border} bg-slate-950/25 px-4 py-3.5`}>
              {index > 0 && <ChevronRight className="absolute -left-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 bg-[#0D1526] text-slate-600 lg:block" />}
              <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label as string}</span><StepIcon className={`h-4 w-4 ${color}`} /></div>
              <p className={`mt-2 text-2xl font-black ${color}`}>{(value as number).toLocaleString()}</p><p className="mt-1 text-[11px] text-slate-500">{note as string}</p>
            </div>;
          })}
        </div>
      </section>

      <section className="grid border border-slate-800 bg-[#0B1323] sm:grid-cols-3 sm:divide-x sm:divide-slate-800">
        {[
          ['Contact rate', metrics.rates?.contactRate || 0, 'Contacted / assigned', 'text-white'],
          ['Qualification rate', metrics.rates?.qualificationRate || 0, 'Interested / contacted', 'text-emerald-300'],
          ['Lead conversion', metrics.rates?.leadConversionRate || 0, 'Converted / total', 'text-teal-300'],
        ].map(([label, value, detail, color]) => <div key={label as string} className="flex items-center justify-between px-5 py-3.5"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label as string}</p><p className={`mt-1 text-xl font-black ${color}`}>{value as number}%</p></div><span className="max-w-[125px] text-right text-[11px] text-slate-500">{detail as string}</span></div>)}
      </section>

      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-teal-500/25 bg-teal-500/[0.05] px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-500/30 bg-teal-500/10"><ShieldCheck className="h-4 w-4 text-teal-300" /></span><div><h3 className="text-sm font-bold text-white">Add a new contact safely</h3><p className="mt-1 text-xs leading-relaxed text-slate-400">Each number is normalized to E.164 and checked against marketing contacts and active CRM patient files.</p></div></div>
        <button type="button" onClick={() => onNavigate('add')} className="inline-flex shrink-0 items-center justify-center gap-2 text-xs font-bold text-teal-300 hover:text-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:ring-offset-2 focus:ring-offset-[#0D1526]"><UserPlus className="h-4 w-4" /> Add contact <ArrowRight className="h-3.5 w-3.5" /></button>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0D1526]/60 shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><Target className="h-4 w-4 text-teal-400" /><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Latest activity</p></div><h3 className="mt-1 text-sm font-bold text-white">Recent contacts</h3></div>
          <button
            type="button"
            onClick={() => onNavigate('contacts')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-400 hover:text-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-300 rounded"
          >
            View all contacts ({contacts.length}) <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No contacts recorded yet. Click &quot;Add contact&quot; to begin.
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
      </section>
    </div>
  );
};
