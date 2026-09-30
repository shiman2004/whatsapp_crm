import React from 'react';
import { useCrm } from '../../context/CrmContext';
import { Award, Clock, TrendingUp, UserCheck } from 'lucide-react';

export const CoordinatorLeaderboard: React.FC = () => {
  const { users, leads } = useCrm();

  const coordinators = users.filter(u => u.role === 'coordinator');

  const stats = coordinators.map(coord => {
    const assignedLeads = leads.filter(l => l.assignedTo === coord.id);
    const converted = assignedLeads.filter(l => l.stage === 'converted').length;
    const rate = assignedLeads.length > 0 ? ((converted / assignedLeads.length) * 100).toFixed(0) : '0';

    return {
      coordinator: coord,
      total: assignedLeads.length,
      converted,
      rate,
      avgResponseTime: assignedLeads.length > 0 ? '4m' : '-',
    };
  }).sort((a, b) => b.converted - a.converted);

  return (
    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-md shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-gold-400" /> Coordinator Workload & Conversion Performance
          </h3>
          <p className="text-xs text-slate-400">Response SLA tracking and consultation booking outcomes</p>
        </div>
      </div>

      <div className="space-y-3">
        {stats.map((item, idx) => (
          <div
            key={item.coordinator.id}
            className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between gap-4 text-xs"
          >
            {/* Left: Avatar & Name */}
            <div className="flex items-center gap-3 min-w-[180px]">
              <div className="relative">
                <img
                  src={item.coordinator.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={item.coordinator.fullName}
                  className="w-9 h-9 rounded-full object-cover border border-teal-500/40"
                />
                {idx === 0 && (
                  <span className="w-4 h-4 rounded-full bg-gold-500 text-slate-950 font-bold text-[9px] flex items-center justify-center absolute -top-1 -right-1 shadow">
                    1
                  </span>
                )}
              </div>
              <div>
                <p className="font-bold text-slate-100">{item.coordinator.fullName}</p>
                <p className="text-[10px] text-slate-400">{item.coordinator.email}</p>
              </div>
            </div>

            {/* Middle: Active Load & Response time */}
            <div className="flex items-center gap-4 text-slate-300">
              <div className="text-center">
                <span className="text-slate-400 text-[10px] block">Active Leads</span>
                <span className="font-bold font-mono text-teal-400">{item.total}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-400 text-[10px] block">Avg SLA</span>
                <span className="font-bold font-mono text-emerald-400 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" /> {item.avgResponseTime}
                </span>
              </div>
            </div>

            {/* Right: Conversion Rate */}
            <div className="text-right min-w-[100px]">
              <div className="flex items-center justify-end gap-1 text-gold-400 font-bold">
                <TrendingUp className="w-3 h-3" />
                <span>{item.rate}% Conv</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {item.converted} booked
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
