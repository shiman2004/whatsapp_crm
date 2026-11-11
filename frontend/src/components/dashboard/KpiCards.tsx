import React from 'react';
import { AlertCircle, MessageSquare, TrendingUp, Zap } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { Lead } from '../../types';
import { StatCard } from '../ui';
import { summarizeStageMetrics } from '../../utils/stageMetrics';

interface KpiCardsProps {
  leads?: Lead[];
}

export const KpiCards: React.FC<KpiCardsProps> = ({ leads: propLeads }) => {
  const { leads: ctxLeads, followups, stages } = useCrm();
  const leads = propLeads || ctxLeads;
  const leadIds = new Set(leads.map((l) => l.id));

  const totalLeads = leads.length;
  const unassigned = leads.filter((l) => l.stage === 'new' && !l.assignedTo).length;
  const metrics = summarizeStageMetrics(leads, stages);
  const activeThreads = metrics.activeOpen;
  const converted = metrics.businessConverted;
  const conversionRate = metrics.conversionRateExact;
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
        hint={`${metrics.appointmentBooked} booked · ${metrics.consultationDone} consulted`}
        icon={MessageSquare}
        tone="teal"
      />
      <StatCard
        label="Conversion rate"
        value={`${conversionRate}%`}
        hint={`${converted} converted (${metrics.closedWon} won · ${metrics.paymentReceived + metrics.treatmentCompleted} paid/treated)`}
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
