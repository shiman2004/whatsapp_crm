import React, { useMemo } from 'react';
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
import { Lead, CompanyCode } from '../../types';
import { classifyLeadStage } from '../../utils/stageMetrics';

interface LeadFunnelChartProps {
  leads?: Lead[];
  companyFilter?: CompanyCode | 'all';
}

const STAGE_HEX: Record<string, string> = {
  rose: '#f43f5e',
  amber: '#f59e0b',
  emerald: '#10b981',
  purple: '#8b5cf6',
  sky: '#0ea5e9',
  slate: '#64748b',
  zinc: '#71717a',
  teal: '#0d9488',
  red: '#ef4444',
  orange: '#f97316',
  indigo: '#6366f1',
  pink: '#ec4899',
  cyan: '#06b6d4',
  lime: '#84cc16',
  fuchsia: '#d946ef',
};

function resolveColor(color?: string, key?: string): string {
  if (color && color.startsWith('#')) return color;
  if (color && STAGE_HEX[color.toLowerCase()]) return STAGE_HEX[color.toLowerCase()];
  if (key === 'converted' || key === 'payment_received' || key === 'treatment_completed') return '#25D366';
  if (key === 'new') return '#F59E0B';
  if (key === 'lost') return '#EF4444';
  return '#34B7F1';
}

export const LeadFunnelChart: React.FC<LeadFunnelChartProps> = ({ leads: propLeads, companyFilter = 'all' }) => {
  const { leads: ctxLeads, stages: configuredStages, resolvedTheme } = useCrm();
  const leads = propLeads || ctxLeads;
  const isDark = resolvedTheme === 'dark';

  const data = useMemo(() => {
    const activeConfigured = (configuredStages || [])
      .filter((s) => s.isActive !== false)
      .filter((s) => companyFilter === 'all' || !s.company || s.company === 'ALL' || s.company === companyFilter)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

    const stageList = activeConfigured.length > 0
      ? activeConfigured.map((s) => ({
          key: s.key,
          label: s.label || STAGE_CONFIG[s.key]?.label || s.key,
          color: resolveColor(s.color, s.key),
        }))
      : [
          'new', 'assigned', 'contacted', 'potential', 'under_discussion',
          'forwarded_to_exam_department', 'forwarded_to_processing_department',
          'not_relevant', 'not_eligible', 'converted', 'lost',
        ].map((key) => ({
          key,
          label: STAGE_CONFIG[key]?.label || key,
          color: resolveColor(undefined, key),
        }));

    // Preserve historical/unconfigured stage keys if any lead still holds them
    const knownKeys = new Set(stageList.map((s) => s.key));
    leads.forEach((l) => {
      if (l.stage && !knownKeys.has(l.stage)) {
        knownKeys.add(l.stage);
        const cls = classifyLeadStage(l.stage);
        stageList.push({
          key: l.stage,
          label: STAGE_CONFIG[l.stage]?.label || l.stage.replace(/_/g, ' '),
          color: cls.isBusinessConverted ? '#25D366' : cls.isTerminalNegative ? '#EF4444' : '#6366F1',
        });
      }
    });

    return stageList.map((st) => ({
      stage: st.label,
      count: leads.filter((l) => l.stage === st.key).length,
      color: st.color,
    }));
  }, [configuredStages, leads, companyFilter]);

  return (
    <div className="bg-white dark:bg-[#202C33] p-5 rounded-2xl border border-[#E0E5E7] dark:border-[#222D34] shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">WhatsApp Lead Lifecycle Funnel</h3>
          <p className="text-xs text-[#667781] dark:text-[#8696A0]">Dynamic progression across all configured pipeline stages</p>
        </div>
        <span className="text-[11px] font-mono font-bold text-[#075E54] dark:text-[#25D366] bg-[#DDF5EC] dark:bg-[#005C4B]/60 px-2.5 py-1 rounded-full border border-[#128C7E]/30 dark:border-[#25D366]/30">
          {data.length} Stages Monitored
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
