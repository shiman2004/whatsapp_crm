import React, { useState } from 'react';
import { Lead, LeadStage } from '../../types';
import { LeadCard } from './LeadCard';
import { STAGE_CONFIG } from './StageBadge';
import { useCrm } from '../../context/CrmContext';
import { Sparkles, ArrowDownCircle, CheckCircle2 } from 'lucide-react';

interface KanbanBoardProps {
  leads: Lead[];
  onSelectLead: (leadId: string) => void;
}

const STAGES: LeadStage[] = [
  'new',
  'assigned',
  'contacted',
  'potential',
  'under_discussion',
  'not_relevant',
  'converted',
  'lost'
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ leads, onSelectLead }) => {
  const { updateLeadStage } = useCrm();
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);

  const handleDragOver = (e: React.DragEvent, stage: LeadStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stage) {
      setDragOverStage(stage);
    }
  };

  const handleDragLeave = (e: React.DragEvent, stage: LeadStage) => {
    // Only clear if leaving the container itself
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverStage === stage) {
      setDragOverStage(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStage: LeadStage) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    
    if (leadId) {
      const draggedLead = leads.find(l => l.id === leadId);
      if (draggedLead && draggedLead.stage !== targetStage) {
        updateLeadStage(
          leadId, 
          targetStage, 
          `Moved from ${draggedLead.stage.toUpperCase()} to ${targetStage.toUpperCase()} via Pick & Drop Kanban`
        );
      }
    }

    setDragOverStage(null);
    setDraggedLeadId(null);
  };

  return (
    <div className="flex-1 overflow-x-auto pb-4 pt-2">
      <div className="flex gap-4 min-w-[1350px] items-start h-full">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter(l => l.stage === stage);
          const config = STAGE_CONFIG[stage];
          const isDropTarget = dragOverStage === stage;

          return (
            <div
              key={stage}
              onDragOver={(e) => handleDragOver(e, stage)}
              onDragEnter={(e) => handleDragOver(e, stage)}
              onDragLeave={(e) => handleDragLeave(e, stage)}
              onDrop={(e) => handleDrop(e, stage)}
              className={`w-72 shrink-0 rounded-2xl border flex flex-col max-h-[calc(100vh-210px)] overflow-hidden transition-all duration-200 ${
                isDropTarget
                  ? 'bg-teal-950/40 border-teal-400 ring-2 ring-teal-500/50 shadow-xl shadow-teal-950/50 scale-[1.01]'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              {/* Column Header */}
              <div className={`p-3 border-b border-slate-800 flex items-center justify-between transition-colors ${
                isDropTarget ? 'bg-teal-900/40' : 'bg-slate-900/80'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${config.bg.replace('/15', '')} border ${config.border}`}></span>
                  <h3 className="text-xs font-bold text-slate-200 tracking-wide">{config.label}</h3>
                </div>
                <span className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded-full border transition-colors ${
                  isDropTarget 
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' 
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  {stageLeads.length}
                </span>
              </div>

              {/* Column Card List */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 transition-all">
                {/* Visual Drop Placeholder Indicator */}
                {isDropTarget && draggedLeadId && (
                  <div className="p-3.5 border-2 border-dashed border-teal-400 bg-teal-500/10 rounded-xl text-center flex flex-col items-center justify-center gap-1 text-teal-300 animate-pulse text-xs font-semibold">
                    <ArrowDownCircle className="w-5 h-5 text-teal-400 animate-bounce" />
                    <span>Drop lead to move into {config.label}</span>
                  </div>
                )}

                {stageLeads.length === 0 && !isDropTarget ? (
                  <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800/80 rounded-lg text-slate-500 text-xs">
                    <p>No leads in this stage</p>
                    <span className="text-[10px] text-slate-600 mt-1">Pick and drop any lead card here</span>
                  </div>
                ) : (
                  stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onSelectLead={onSelectLead}
                      onDragStart={(id) => setDraggedLeadId(id)}
                      onDragEnd={() => {
                        setDraggedLeadId(null);
                        setDragOverStage(null);
                      }}
                      isDragging={draggedLeadId === lead.id}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
