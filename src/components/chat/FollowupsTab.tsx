import React from 'react';
import { Lead, FollowupStatus } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { 
  Calendar, 
  Play, 
  Pause, 
  XCircle, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Sparkles,
  Zap
} from 'lucide-react';

interface FollowupsTabProps {
  lead: Lead;
}

const STATUS_CONFIG: Record<FollowupStatus, { label: string; bg: string; text: string; border: string }> = {
  pending: { label: 'Scheduled', bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  sent: { label: 'Sent via API', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  cancelled: { label: 'Auto-Cancelled (Reply)', bg: 'bg-slate-700/40', text: 'text-slate-400', border: 'border-slate-700' },
  skipped: { label: 'Paused', bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30' },
  failed: { label: 'Failed Delivery', bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30' }
};

export const FollowupsTab: React.FC<FollowupsTabProps> = ({ lead }) => {
  const { 
    followups, 
    templates, 
    cancelFollowup, 
    pauseFollowup, 
    resumeFollowup, 
    triggerFollowupNow 
  } = useCrm();

  const leadFollowups = followups.filter(f => f.leadId === lead.id);

  return (
    <div className="space-y-4">
      {/* Auto-stop Explanation Banner */}
      <div className="bg-slate-900 border border-teal-500/30 rounded-xl p-3 text-xs space-y-1 shadow-sm">
        <div className="flex items-center gap-1.5 font-bold text-teal-300">
          <Zap className="w-3.5 h-3.5 text-gold-400" />
          <span>BullMQ Automated Nurture Engine</span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          Pending follow-ups are automatically cancelled the instant an inbound WhatsApp reply is received from the patient (PRD §FR-6.3).
        </p>
      </div>

      {/* Follow-up sequence list */}
      <div className="space-y-2.5">
        {leadFollowups.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            <p>No active follow-up sequence assigned.</p>
          </div>
        ) : (
          leadFollowups.map((fol) => {
            const template = templates.find(t => t.id === fol.templateId);
            const statusConfig = STATUS_CONFIG[fol.status] || STATUS_CONFIG.pending;

            return (
              <div
                key={fol.id}
                className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2 text-xs"
              >
                {/* Header: Step & Status */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-400" />
                    Step #{fol.stepNumber} (Day +{fol.dayOffset})
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                    {statusConfig.label}
                  </span>
                </div>

                {/* Template info */}
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                  <p className="font-semibold text-slate-300 text-[11px] mb-0.5">{template?.name}</p>
                  <p className="text-[10px] text-slate-500 line-clamp-2 italic">{template?.body}</p>
                </div>

                {/* Timing & Controls */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                  <span className="text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {fol.sentAt ? `Sent: ${new Date(fol.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Sched: Day +${fol.dayOffset}`}
                  </span>

                  {/* Manual Controls */}
                  <div className="flex items-center gap-1.5">
                    {fol.status === 'pending' && (
                      <>
                        <button
                          onClick={() => triggerFollowupNow(fol.id)}
                          className="px-2 py-1 rounded bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 flex items-center gap-1 font-semibold"
                          title="Send this follow-up immediately"
                        >
                          <Send className="w-2.5 h-2.5" />
                          <span>Send Now</span>
                        </button>
                        <button
                          onClick={() => pauseFollowup(fol.id)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Pause"
                        >
                          <Pause className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => cancelFollowup(fol.id)}
                          className="p-1 rounded bg-slate-800 hover:bg-rose-900/50 text-rose-400"
                          title="Cancel"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    {fol.status === 'skipped' && (
                      <button
                        onClick={() => resumeFollowup(fol.id)}
                        className="px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 flex items-center gap-1 font-semibold"
                      >
                        <Play className="w-2.5 h-2.5" />
                        <span>Resume</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
