import React from 'react';
import { useCrm } from '../../context/CrmContext';
import { ScrollText, Clock, User, ShieldCheck, Tag, ArrowRight } from 'lucide-react';

export const AuditLogsViewer: React.FC = () => {
  const { auditLogs } = useCrm();

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 font-serif">System Audit Trail & Security Logs</h2>
          <p className="text-xs text-slate-400">
            Immutable log of all coordinator actions, webhook ingestion events, reassignments, and stage changes
          </p>
        </div>
        <span className="px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/30 rounded-full text-xs font-mono font-bold">
          {auditLogs.length} Events Logged
        </span>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[10px]">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Actor</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Entity</th>
              <th className="py-3 px-4">Change State (Before → After)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {auditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="py-3 px-4">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-teal-400" />
                    {log.userName}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-950 text-teal-300 border border-slate-700">
                    {log.action}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-300">
                  <span className="font-semibold">{log.entityType}</span>
                  <span className="text-[10px] text-slate-500 font-mono ml-1">#{log.entityId.slice(0, 10)}</span>
                </td>
                <td className="py-3 px-4 text-slate-300">
                  <div className="text-[11px] font-mono flex items-center gap-2">
                    {log.before && (
                      <span className="bg-rose-950/40 text-rose-300 px-2 py-0.5 rounded border border-rose-900/40">
                        {JSON.stringify(log.before)}
                      </span>
                    )}
                    {log.before && log.after && <ArrowRight className="w-3 h-3 text-slate-500" />}
                    {log.after && (
                      <span className="bg-emerald-950/40 text-emerald-300 px-2 py-0.5 rounded border border-emerald-900/40">
                        {JSON.stringify(log.after)}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
