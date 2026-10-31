import React from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend 
} from 'recharts';
import { useCrm } from '../../context/CrmContext';
import { Lead } from '../../types';

const COLORS = ['#25D366', '#128C7E', '#087EA4', '#34B7F1', '#F59E0B', '#075E54', '#8696A0'];

interface TreatmentDistributionChartProps {
  leads?: Lead[];
}

export const TreatmentDistributionChart: React.FC<TreatmentDistributionChartProps> = ({ leads: propLeads }) => {
  const { leads: ctxLeads, categories, resolvedTheme } = useCrm();
  const leads = propLeads || ctxLeads;
  const isDark = resolvedTheme === 'dark';

  const data = categories.map((cat) => ({
    name: cat.name.split('&')[0].trim(),
    value: leads.filter(l => l.categoryId === cat.id).length
  })).filter(d => d.value > 0);

  return (
    <div className="bg-white dark:bg-[#202C33] p-5 rounded-2xl border border-[#E0E5E7] dark:border-[#222D34] shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">Enquiries by Treatment Category</h3>
          <p className="text-xs text-[#667781] dark:text-[#8696A0]">Demand distribution across wellness verticals</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-64 w-full flex flex-col items-center justify-center text-[#667781] dark:text-[#8696A0] text-xs border border-dashed border-[#E0E5E7] dark:border-[#222D34] rounded-xl">
          <p className="font-semibold text-[#111B21] dark:text-[#E9EDEF]">No Treatment Inquiries Yet</p>
          <p className="text-[11px] text-[#667781] dark:text-[#8696A0] mt-0.5">Live incoming WhatsApp chats will populate category analytics</p>
        </div>
      ) : (
        <div className="h-64 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
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
                formatter={(val: any) => [`${val} Inquiries`, 'Count']}
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px', color: isDark ? '#8696A0' : '#667781' }}
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
