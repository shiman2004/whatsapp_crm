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

const COLORS = ['#14b8a6', '#f59e0b', '#8b5cf6', '#3b82f6', '#ec4899', '#10b981', '#64748b'];

export const TreatmentDistributionChart: React.FC = () => {
  const { leads, categories } = useCrm();

  const data = categories.map((cat) => ({
    name: cat.name.split('&')[0].trim(),
    value: leads.filter(l => l.categoryId === cat.id).length
  })).filter(d => d.value > 0);

  return (
    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-md shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100">Enquiries by Treatment Category</h3>
          <p className="text-xs text-slate-400">Demand distribution across wellness verticals</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-64 w-full flex flex-col items-center justify-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
          <p className="font-semibold text-slate-400">No Treatment Inquiries Yet</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Live incoming WhatsApp chats will populate category analytics</p>
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
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#f8fafc'
                }}
                formatter={(val: any) => [`${val} Inquiries`, 'Count']}
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
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
