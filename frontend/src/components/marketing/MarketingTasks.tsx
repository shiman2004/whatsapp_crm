import React from 'react';
import { MarketingTask, MarketingContact } from './types';
import {
  ClipboardList,
  Phone,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Calendar,
  Sparkles,
  Search,
  Filter,
  FileText
} from 'lucide-react';
import { LifecycleBadge } from './MarketingBadges';

interface MarketingTasksProps {
  tasks: MarketingTask[];
  loading: boolean;
  onRequestApi: (path: string, init?: RequestInit) => Promise<any>;
  onSelectContact: (contact: MarketingContact) => void;
  onRefresh: () => void;
}

type TaskTab = 'all' | 'due_today' | 'overdue' | 'interested' | 'completed';

export const MarketingTasks: React.FC<MarketingTasksProps> = ({
  tasks,
  loading,
  onRequestApi,
  onSelectContact,
  onRefresh,
}) => {
  const [tab, setTab] = React.useState<TaskTab>('all');
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  // Categorize tasks for tab counts
  const dueTodayTasks = tasks.filter(t => {
    if (t.status === 'completed' || !t.followUpAt) return false;
    const time = new Date(t.followUpAt).getTime();
    return time >= startOfDay && time <= endOfDay;
  });

  const overdueTasks = tasks.filter(t => {
    if (t.status === 'completed' || !t.followUpAt) return false;
    const time = new Date(t.followUpAt).getTime();
    return time < startOfDay;
  });

  const interestedTasks = tasks.filter(t => t.status === 'interested' || t.contact?.lifecycleStatus === 'interested');
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'not_interested');

  const filteredTasks = tasks.filter(t => {
    // 1. Tab filter
    if (tab === 'due_today') {
      if (!t.followUpAt || t.status === 'completed') return false;
      const time = new Date(t.followUpAt).getTime();
      if (time < startOfDay || time > endOfDay) return false;
    } else if (tab === 'overdue') {
      if (!t.followUpAt || t.status === 'completed') return false;
      const time = new Date(t.followUpAt).getTime();
      if (time >= startOfDay) return false;
    } else if (tab === 'interested') {
      if (t.status !== 'interested' && t.contact?.lifecycleStatus !== 'interested') return false;
    } else if (tab === 'completed') {
      if (t.status !== 'completed' && t.status !== 'not_interested') return false;
    }

    // 2. Search query filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const phone = t.contact?.normalizedPhone?.toLowerCase() || '';
      const notes = t.notes?.toLowerCase() || '';
      const source = t.contact?.originalSource?.toLowerCase() || '';
      return phone.includes(q) || notes.includes(q) || source.includes(q);
    }

    return true;
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
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-teal-400" />
            Coordinator Outreach Workspace
          </h3>
          <p className="text-xs text-slate-400">
            Work assigned public numbers, record calls, schedule follow-ups, and qualify CRM prospects.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search phone, note..."
              className="rounded-lg bg-slate-900 border border-slate-700/80 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
            />
          </div>

          <span className="text-xs font-mono text-teal-300 font-bold bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg shrink-0">
            {tasks.length} Assigned
          </span>
        </div>
      </div>

      {/* Primary Queue Tabs (Section 10) */}
      <div className="flex flex-wrap border-b border-slate-800 gap-2">
        {[
          { id: 'all', label: 'Assigned Contacts', count: tasks.length },
          { id: 'due_today', label: 'Due Today', count: dueTodayTasks.length, alert: dueTodayTasks.length > 0 },
          { id: 'overdue', label: 'Overdue Follow-ups', count: overdueTasks.length, warning: overdueTasks.length > 0 },
          { id: 'interested', label: 'Interested Contacts', count: interestedTasks.length, highlight: true },
          { id: 'completed', label: 'Completed', count: completedTasks.length },
        ].map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as TaskTab)}
            className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              tab === item.id
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{item.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                item.warning
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                  : item.alert
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                  : item.highlight && item.count > 0
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
          <span>Loading coordinator queue...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-16 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 space-y-2">
          <ClipboardList className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-slate-300">No Tasks in this Queue</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {tab === 'due_today'
              ? 'No follow-ups due today. You are caught up!'
              : tab === 'overdue'
              ? 'Zero overdue tasks. Excellent compliance!'
              : 'Contacts allocated to you by administrators will appear here for outreach.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredTasks.map(task => {
            const contact = task.contact;
            const phone = contact?.normalizedPhone || 'No phone attached';
            const source = contact?.originalSource || 'Marketing Ingest';
            const isUpdating = updatingId === task.id;

            // Check if overdue
            const isOverdue =
              task.followUpAt &&
              new Date(task.followUpAt).getTime() < startOfDay &&
              task.status !== 'completed';

            const isDueToday =
              task.followUpAt &&
              new Date(task.followUpAt).getTime() >= startOfDay &&
              new Date(task.followUpAt).getTime() <= endOfDay &&
              task.status !== 'completed';

            return (
              <div
                key={task.id}
                className={`rounded-2xl border bg-[#0D1526]/90 p-4 flex flex-col justify-between transition-all shadow-md hover:border-slate-700 ${
                  isOverdue
                    ? 'border-rose-500/40 bg-gradient-to-br from-rose-950/20 to-[#0D1526]'
                    : isDueToday
                    ? 'border-amber-500/40 bg-gradient-to-br from-amber-950/20 to-[#0D1526]'
                    : task.status === 'interested'
                    ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 to-[#0D1526]'
                    : 'border-slate-800/90'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">
                      {contact?.serialNumber || `TASK #${task.id.slice(0, 6)}`}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        task.status === 'interested'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : task.status === 'pending'
                          ? 'bg-slate-800 text-slate-300'
                          : task.status === 'follow_up'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : task.status === 'completed'
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-blue-950 text-blue-300 border border-blue-800'
                      }`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Phone & Direct Outreach Links */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => { if (contact) onSelectContact(contact); }}
                      className="font-mono font-bold text-sm text-teal-300 hover:text-teal-200 flex items-center gap-1.5 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-teal-400" />
                      {phone}
                    </button>

                    <div className="flex items-center gap-1">
                      <a
                        href={`tel:${phone}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                        title="Direct Phone Call"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      </a>
                      <a
                        href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                        title="Open WhatsApp Chat"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                      </a>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Source: <span className="text-slate-200">{source}</span>
                  </p>

                  {task.notes && (
                    <p className="text-xs text-slate-300 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 line-clamp-2 italic">
                      &quot;{task.notes}&quot;
                    </p>
                  )}

                  {/* Due/Overdue Follow-up Tag */}
                  {task.followUpAt && (
                    <div
                      className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg ${
                        isOverdue
                          ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                          : isDueToday
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                          : 'bg-slate-900 text-slate-300'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>Follow-up: {new Date(task.followUpAt).toLocaleDateString()}</span>
                      {isOverdue && <span className="text-[10px] uppercase font-bold text-rose-400">(Overdue)</span>}
                      {isDueToday && <span className="text-[10px] uppercase font-bold text-amber-400">(Today)</span>}
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <select
                    disabled={isUpdating}
                    value={task.status}
                    onChange={e => handleUpdateStatus(task.id, e.target.value)}
                    className="rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 py-1.5 px-2 outline-none focus:border-teal-400 cursor-pointer"
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
                    className="inline-flex items-center gap-1 text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    <span>Manage Details</span>
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
