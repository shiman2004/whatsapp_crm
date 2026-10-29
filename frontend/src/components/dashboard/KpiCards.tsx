import React from 'react';
import { AlertCircle, MessageSquare, TrendingUp, Zap } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { Lead } from '../../types';
import { StatCard } from '../ui';

interface KpiCardsProps {
  leads?: Lead[];
}

export const KpiCards: React.FC<KpiCardsProps> = ({ leads: propLeads }) => {
  const { leads: ctxLeads, followups } = useCrm();
  const leads = propLeads || ctxLeads;
  const leadIds = new Set(leads.map((l) => l.id));

  const totalLeads = leads.length;
  const unassigned = leads.filter((l) => l.stage === 'new' && !l.assignedTo).length;
  const activeThreads = leads.filter((l) => !['converted', 'lost', 'not_relevant', 'not_eligible'].includes(l.stage)).length;
  const converted = leads.filter((l) => l.stage === 'converted').length;
  const conversionRate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : '0.0';
  const pendingFollowups = followups.filter((f) => f.status === 'pending' && leadIds.has(f.leadId)).length;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Unassigned leads"
        value={unassigned}
        hint={`${totalLeads} total leads in scope`}
        icon={AlertCircle}
        tone="amber"
      />
      <StatCard
        label="Active conversations"
        value={activeThreads}
        hint="Open WhatsApp threads"
        icon={MessageSquare}
        tone="teal"
      />
      <StatCard
        label="Conversion rate"
        value={`${conversionRate}%`}
        hint={`${converted} converted leads`}
        icon={TrendingUp}
        tone="blue"
      />
      <StatCard
        label="Pending follow-ups"
        value={pendingFollowups}
        hint="Scheduled nurture steps"
        icon={Zap}
        tone="violet"
      />
    </div>
  );
};
