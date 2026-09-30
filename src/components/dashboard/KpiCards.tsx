import React from 'react';
import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Zap,
  PhoneCall
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

export const KpiCards: React.FC = () => {
  const { leads, followups, messages } = useCrm();

  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.stage === 'new').length;
  const convertedLeads = leads.filter(l => l.stage === 'converted').length;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0.0';
  const pendingFollowups = followups.filter(f => f.status === 'pending').length;

  const kpis = [
    {
      label: 'New Leads Today',
      value: newLeads,
      subtext: 'Sub-second capture rate',
      icon: Users,
      color: 'from-teal-500 to-emerald-600',
      textColor: 'text-teal-400',
      badge: '+100% Inbound SLA',
      badgeColor: 'bg-teal-500/10 text-teal-300 border-teal-500/30'
    },
    {
      label: 'Active WhatsApp Threads',
      value: leads.filter(l => l.stage !== 'converted' && l.stage !== 'lost').length,
      subtext: 'Across EN / SI / TA languages',
      icon: MessageSquare,
      color: 'from-sky-500 to-blue-600',
      textColor: 'text-sky-400',
      badge: '24h Window Compliant',
      badgeColor: 'bg-sky-500/10 text-sky-300 border-sky-500/30'
    },
    {
      label: 'Overall Conversion Rate',
      value: `${conversionRate}%`,
      subtext: `${convertedLeads} consultations confirmed`,
      icon: TrendingUp,
      color: 'from-amber-500 to-gold-600',
      textColor: 'text-gold-400',
      badge: '+4.8% vs last month',
      badgeColor: 'bg-amber-500/10 text-amber-300 border-amber-500/30'
    },
    {
      label: 'Pending Follow-Ups',
      value: pendingFollowups,
      subtext: 'Auto-scheduled (BullMQ)',
      icon: Zap,
      color: 'from-purple-500 to-indigo-600',
      textColor: 'text-purple-400',
      badge: 'Auto-Stop Active',
      badgeColor: 'bg-purple-500/10 text-purple-300 border-purple-500/30'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon;
        return (
          <div
            key={idx}
            className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-lg flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-slate-700 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400">{kpi.label}</span>
                <h3 className="text-2xl font-black text-white tracking-tight mt-1 font-sans">{kpi.value}</h3>
              </div>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center text-white shadow-md`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400">{kpi.subtext}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${kpi.badgeColor}`}>
                {kpi.badge}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
