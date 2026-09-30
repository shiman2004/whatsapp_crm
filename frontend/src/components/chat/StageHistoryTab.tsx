import React from 'react';
import { Lead } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { StageBadge } from '../leads/StageBadge';
import { History, ArrowRight, User, Clock } from 'lucide-react';

interface StageHistoryTabProps {
  lead: Lead;
}

export const StageHistoryTab: React.FC<StageHistoryTabProps> = ({ lead }) => {
  const { stageHistories } = useCrm();

  const history = stageHistories.filter(h => h.leadId === lead.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
        <History className="w-3.5 h-3.5 text-teal-400" />
        <span>Lead Lifecycle & Audit History</span>
      </div>

      <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {history.length === 0 ? (
          <div className="text-slate-500 text-xs py-4">
            <p>Initial stage: <StageBadge stage={lead.stage} /></p>
          </div>
        ) : (
          history.map((item) => (
            <div key={item.id} className="relative text-xs space-y-1">
              {/* Dot marker */}
              <span className="w-3 h-3 rounded-full bg-teal-500/20 border-2 border-teal-400 absolute -left-[19px] top-1"></span>

              <div className="flex items-center gap-1.5 flex-wrap">
                <StageBadge stage={item.fromStage} />
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <StageBadge stage={item.toStage} />
              </div>

              {item.reason && (
                <p className="text-slate-300 text-xs bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  {item.reason}
                </p>
              )}

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span className="flex items-center gap-1 text-slate-300">
                  <User className="w-2.5 h-2.5 text-teal-400" /> {item.changedByName}
                </span>
                <span className="font-mono flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
