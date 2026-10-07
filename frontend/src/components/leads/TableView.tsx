import React from 'react';
import { Lead } from '../../types';
import { StageBadge } from './StageBadge';
import { useCrm } from '../../context/CrmContext';
import { 
  ChevronRight, 
  Sparkles, 
  Clock, 
  MessageSquare, 
  UserCheck, 
  AlertTriangle 
} from 'lucide-react';

interface TableViewProps {
  leads: Lead[];
  onSelectLead: (leadId: string) => void;
}

export const TableView: React.FC<TableViewProps> = ({ leads, onSelectLead }) => {
  const { categories, treatments, users, selectedLeadId, isSuperAdmin, canAssignLeads, assignLead } = useCrm();

  const coordinators = users.filter(u => u.role === 'coordinator');

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden shadow-lg mt-3">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[10px]">
              <th className="py-3 px-4">Patient / Contact</th>
              <th className="py-3 px-4">Language</th>
              <th className="py-3 px-4">Treatment Required</th>
              <th className="py-3 px-4">Stage</th>
              <th className="py-3 px-4">Assigned Coordinator</th>
              <th className="py-3 px-4">Inquiry Time</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  No leads found matching your filters.
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const category = categories.find(c => c.id === lead.categoryId);
                const treatment = treatments.find(t => t.id === lead.treatmentId);
                const coordinator = users.find(u => u.id === lead.assignedTo);
                const isSelected = selectedLeadId === lead.id;

                return (
                  <tr
                    key={lead.id}
                    onClick={() => onSelectLead(lead.id)}
                    className={`hover:bg-slate-800/60 cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-950/30' : ''
                    }`}
                  >
                    {/* Customer */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={lead.customer?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                          alt={lead.customer?.displayName}
                          className="w-8 h-8 rounded-full object-cover border border-slate-700"
                        />
                        <div>
                          <p className="font-bold text-slate-100">{lead.customer?.displayName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{lead.customer?.whatsappNumber}</p>
                        </div>
                      </div>
                    </td>

                    {/* Language */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-mono font-bold uppercase text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        {lead.language}
                      </span>
                    </td>

                    {/* Treatment */}
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-semibold text-teal-400">{treatment?.name || category?.name}</p>
                        <p className="text-[10px] text-slate-400">{category?.name}</p>
                      </div>
                    </td>

                    {/* Stage */}
                    <td className="py-3 px-4">
                      <StageBadge stage={lead.stage} />
                    </td>

                    {/* Coordinator */}
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      {canAssignLeads ? (
                        <select
                          value={lead.assignedTo || ''}
                          onChange={(e) => assignLead(lead.id, e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-teal-500"
                        >
                          <option value="" disabled>-- Assign Coordinator --</option>
                          {coordinators.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.fullName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-300">
                          {coordinator ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-teal-400" />
                              <span>{coordinator.fullName}</span>
                            </>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Unassigned
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Time */}
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(lead.createdAt).toLocaleDateString()} {new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onSelectLead(lead.id)}
                        className="px-2.5 py-1 rounded bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <span>Chat</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
