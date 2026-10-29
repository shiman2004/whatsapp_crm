import React from 'react';
import { useCrm } from '../../context/CrmContext';
import { Lead } from '../../types';

interface KpiCardsProps {
  leads?: Lead[];
}

export const KpiCards: React.FC<KpiCardsProps> = ({ leads: propLeads }) => {
  const { leads: ctxLeads, followups } = useCrm();
  const leads = propLeads || ctxLeads;
  const leadIds = new Set(leads.map(l => l.id));

  const totalLeads = leads.length;
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const newLeads = leads.filter(l => new Date(l.createdAt) >= startOfToday).length;
  const convertedLeads = leads.filter(l => l.stage === 'converted').length;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0.0';
  const pendingFollowups = followups.filter(f => f.status === 'pending' && leadIds.has(f.leadId)).length;

  const kpis = [
    {
      label: 'New Leads Today',
      value: newLeads,
      subtext: 'Created since midnight',
      color: 'from-teal-500 to-emerald-600',
      textColor: 'text-teal-400',
      badge: 'Live lead data',
      badgeColor: 'bg-teal-500/10 text-teal-300 border-teal-500/30'
    },
    {
      label: 'Active WhatsApp Threads',
      value: leads.filter(l => l.lastCustomerMessageAt && Date.now() - new Date(l.lastCustomerMessageAt).getTime() <= 24 * 60 * 60 * 1000).length,
      subtext: 'Customer activity in last 24 hours',
      color: 'from-sky-500 to-blue-600',
      textColor: 'text-sky-400',
      badge: '24h activity window',
      badgeColor: 'bg-sky-500/10 text-sky-300 border-sky-500/30'
    },
    {
      label: 'Overall Conversion Rate',
      value: `${conversionRate}%`,
      subtext: `${convertedLeads} consultations confirmed`,
      color: 'from-amber-500 to-gold-600',
      textColor: 'text-gold-400',
      badge: 'Converted / all leads',
      badgeColor: 'bg-amber-500/10 text-amber-300 border-amber-500/30'
    },
    {
      label: 'Pending Follow-Ups',
      value: pendingFollowups,
      subtext: 'Open follow-up tasks',
      color: 'from-purple-500 to-indigo-600',
      textColor: 'text-purple-400',
      badge: 'Needs attention',
      badgeColor: 'bg-purple-500/10 text-purple-300 border-purple-500/30'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, idx) => {
        return (
          <div
            key={idx}
            className="border-b border-slate-200 bg-white px-4 py-4 last:border-b-0 dark:border-slate-800 dark:bg-slate-900/80"
          >
            <div>
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{kpi.label}</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1 font-sans">{kpi.value}</h3>
              </div>
            </div>

            <div className="mt-3 text-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{kpi.subtext}</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{kpi.badge}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
