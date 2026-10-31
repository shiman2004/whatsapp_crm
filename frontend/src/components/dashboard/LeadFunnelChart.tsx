import React from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell 
} from 'recharts';
import { useCrm } from '../../context/CrmContext';
import { STAGE_CONFIG } from '../leads/StageBadge';
import { LeadStage, Lead } from '../../types';

interface LeadFunnelChartProps {
  leads?: Lead[];
}

export const LeadFunnelChart: React.FC<LeadFunnelChartProps> = ({ leads: propLeads }) => {
  const { leads: ctxLeads, resolvedTheme } = useCrm();
  const leads = propLeads || ctxLeads;
  const isDark = resolvedTheme === 'dark';

  const stages: LeadStage[] = [
    'new',
    'assigned',
    'contacted',
    'potential',
    'under_discussion',
    'forwarded_to_exam_department',
    'forwarded_to_processing_department',
    'not_relevant',
    'not_eligible',
    'converted',
    'lost'
  ];

  const data = stages.map((st) => ({
    stage: STAGE_CONFIG[st]?.label || st,
    count: leads.filter(l => l.stage === st).length,
    color: st === 'converted' ? '#25D366' : st === 'new' ? '#F59E0B' : st === 'potential' ? '#128C7E' : st === 'forwarded_to_exam_department' ? '#087EA4' : st === 'forwarded_to_processing_department' ? '#F97316' : st === 'not_eligible' ? '#8696A0' : '#34B7F1'
  }));

  return (
    <div className="bg-white dark:bg-[#202C33] p-5 rounded-2xl border border-[#E0E5E7] dark:border-[#222D34] shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">WhatsApp Lead Lifecycle Funnel</h3>
          <p className="text-xs text-[#667781] dark:text-[#8696A0]">Progression from initial WhatsApp greeting to booked procedure</p>
        </div>
        <span className="text-[11px] font-mono font-bold text-[#075E54] dark:text-[#25D366] bg-[#DDF5EC] dark:bg-[#005C4B]/60 px-2.5 py-1 rounded-full border border-[#128C7E]/30 dark:border-[#25D366]/30">
          {stages.length} Stages Monitored
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <XAxis 
              dataKey="stage" 
              stroke={isDark ? '#8696A0' : '#667781'} 
              fontSize={10} 
              tickLine={false}
              interval={0}
              angle={-20}
              textAnchor="end"
            />
            <YAxis stroke={isDark ? '#8696A0' : '#667781'} fontSize={11} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#202C33' : '#FFFFFF',
                borderColor: isDark ? '#222D34' : '#E0E5E7',
                borderRadius: '8px',
                fontSize: '12px',
                color: isDark ? '#E9EDEF' : '#111B21',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
              }}
              itemStyle={{
                color: isDark ? '#E9EDEF' : '#111B21'
              }}
              formatter={(val: any) => [`${val} Leads`, 'Count']}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
