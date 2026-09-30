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
import { LeadStage } from '../../types';

export const LeadFunnelChart: React.FC = () => {
  const { leads } = useCrm();

  const stages: LeadStage[] = ['new', 'assigned', 'contacted', 'interested', 'follow_up', 'converted', 'lost'];

  const data = stages.map((st) => ({
    stage: STAGE_CONFIG[st].label,
    count: leads.filter(l => l.stage === st).length,
    color: st === 'converted' ? '#10b981' : st === 'new' ? '#f59e0b' : st === 'interested' ? '#14b8a6' : '#6366f1'
  }));

  return (
    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-md shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100">WhatsApp Lead Lifecycle Funnel</h3>
          <p className="text-xs text-slate-400">Progression from initial WhatsApp greeting to booked procedure</p>
        </div>
        <span className="text-[11px] font-mono font-bold text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-full border border-teal-500/20">
          7 Stages Monitored
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <XAxis 
              dataKey="stage" 
              stroke="#64748b" 
              fontSize={10} 
              tickLine={false}
              interval={0}
              angle={-20}
              textAnchor="end"
            />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#f8fafc'
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
