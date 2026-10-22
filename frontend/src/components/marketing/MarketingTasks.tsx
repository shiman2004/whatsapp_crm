import React from 'react';
import { MarketingTask, MarketingContact } from './types';
import { ClipboardList, Phone, CheckCircle, Clock, AlertTriangle, ChevronRight, Loader2, Calendar } from 'lucide-react';
import { LifecycleBadge } from './MarketingBadges';

interface MarketingTasksProps {
  tasks: MarketingTask[];
  loading: boolean;
  onRequestApi: (path: string, init?: RequestInit) => Promise<any>;
  onSelectContact: (contact: MarketingContact) => void;
  onRefresh: () => void;
}

type TaskTab = 'all' | 'pending' | 'follow_up' | 'contacted' | 'interested' | 'completed';

export const MarketingTasks: React.FC<MarketingTasksProps> = ({
  tasks,
  loading,
  onRequestApi,
  onSelectContact,
  onRefresh,
}) => {
  const [tab, setTab] = React.useState<TaskTab>('all');
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const filteredTasks = tasks.filter(t => {
    if (tab === 'all') return true;
    if (tab === 'completed') return t.status === 'completed' || t.status === 'not_interested';
    return t.status === tab;
  });

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    setUpdatingId(taskId);
    try {
      await onRequestApi(`/api/marketing/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      onRefresh();
    } catch (e) {
      console.error('Failed to update task status', e);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-teal-400" />
            Marketing Officer Tasks
          </h3>
          <p className="text-xs text-slate-400">
            Work allocated public contacts, record contact attempts, and qualify prospects.
          </p>
        </div>
        <span className="text-xs font-mono text-teal-300 font-bold bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
          {tasks.length} Assigned Task{tasks.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap border-b border-slate-800 gap-2">
        {[
          { id: 'all', label: 'All Tasks', count: tasks.length },
          { id: 'pending', label: 'To Contact', count: tasks.filter(t => t.status === 'pending').length },
          { id: 'follow_up', label: 'Follow-up Pending', count: tasks.filter(t => t.status === 'follow_up').length },
          { id: 'contacted', label: 'Contacted', count: tasks.filter(t => t.status === 'contacted').length },
          { id: 'interested', label: 'Interested', count: tasks.filter(t => t.status === 'interested').length },
          { id: 'completed', label: 'Completed / Closed', count: tasks.filter(t => t.status === 'completed' || t.status === 'not_interested').length },
        ].map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as TaskTab)}
            className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              tab === item.id
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{item.label}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
          <span>Loading marketing officer tasks...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
          <ClipboardList className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-slate-300 mt-2">No Tasks in this Tab</h4>
          <p className="text-xs text-slate-500 mt-1">
            Contacts assigned to you by administrators will appear here for execution.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTasks.map(task => {
            const contact = task.contact;
            const phone = contact?.normalizedPhone || 'Contact details attached';
            const source = contact?.originalSource || 'Marketing Ingest';
            const isUpdating = updatingId === task.id;

            return (
              <div
                key={task.id}
                className="rounded-xl border border-slate-800 bg-[#0D1526]/80 p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      Task #{task.id.slice(0, 8)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        task.status === 'interested'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : task.status === 'pending'
                          ? 'bg-slate-800 text-slate-300'
                          : task.status === 'follow_up'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-blue-950 text-blue-300 border border-blue-800'
                      }`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="font-mono font-bold text-sm text-teal-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-teal-400" />
                    {phone}
                  </p>

                  <p className="text-xs text-slate-300 mt-1">Source: {source}</p>

                  {task.notes && (
                    <p className="text-xs text-slate-400 mt-2 p-2 rounded bg-slate-900/80 border border-slate-800 line-clamp-2">
                      &quot;{task.notes}&quot;
                    </p>
                  )}

                  {task.followUpAt && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-300 mt-2">
                      <Calendar className="w-3 h-3" />
                      <span>Follow-up: {new Date(task.followUpAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <select
                    disabled={isUpdating}
                    value={task.status}
                    onChange={e => handleUpdateStatus(task.id, e.target.value)}
                    className="rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-300 py-1 px-2 outline-none focus:border-teal-400 cursor-pointer"
                  >
                    <option value="pending">To Contact</option>
                    <option value="contacted">Contacted</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="interested">Interested</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="completed">Completed</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      if (contact) onSelectContact(contact);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-teal-400 hover:text-teal-300"
                  >
                    <span>Follow-up</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
