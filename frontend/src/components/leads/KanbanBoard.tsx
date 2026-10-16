import React, { useState, useMemo } from 'react';
import { Lead, LeadStage } from '../../types';
import { LeadCard } from './LeadCard';
import { STAGE_CONFIG } from './StageBadge';
import { useCrm } from '../../context/CrmContext';
import { Sparkles, ArrowDownCircle, CheckCircle2 } from 'lucide-react';

interface KanbanBoardProps {
  leads: Lead[];
  onSelectLead: (leadId: string) => void;
  company?: 'RWC' | 'CRAS' | 'ALL';
}

const STAGE_COLOR_MAP: Record<string, string> = {
  rose: '#f43f5e',
  amber: '#f59e0b',
  emerald: '#10b981',
  purple: '#8b5cf6',
  sky: '#0ea5e9',
  slate: '#64748b',
  zinc: '#71717a',
  teal: '#0d9488',
  red: '#ef4444',
  orange: '#f97316',
  indigo: '#6366f1',
  pink: '#ec4899',
  cyan: '#06b6d4',
  lime: '#84cc16',
  fuchsia: '#d946ef'
};

const getStageHexColor = (color?: string, fallback = '#6366f1'): string => {
  if (!color) return fallback;
  if (color.startsWith('#')) return color;
  return STAGE_COLOR_MAP[color.toLowerCase()] || fallback;
};

const DEFAULT_FALLBACK_STAGES: LeadStage[] = [
  'new',
  'assigned',
  'contacted',
  'potential',
  'under_discussion',
  'not_relevant',
  'not_eligible',
  'converted',
  'lost'
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ leads, onSelectLead, company = 'RWC' }) => {
  const { updateLeadStage, stages } = useCrm();
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const isCras = company === 'CRAS';

  // Compute active pipeline stages in sequence order
  const activeColumns = useMemo(() => {
    if (stages && stages.length > 0) {
      return [...stages]
        .filter(s => s.isActive !== false)
        .filter(s => !s.company || s.company === 'ALL' || s.company === company)
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    }
    return DEFAULT_FALLBACK_STAGES.map((key, idx) => ({
      id: `stage-${key}`,
      key,
      label: STAGE_CONFIG[key]?.label || key,
      orderIndex: idx,
      isActive: true,
      isSystem: ['new', 'converted', 'lost'].includes(key),
      color: STAGE_CONFIG[key]?.pillBorder || '#6366f1'
    }));
  }, [stages, company]);

  const getStageLabel = (stageKey: string, defaultLabel: string) => {
    if (isCras) {
      if (stageKey === 'converted') return 'Enrolled (Closed Won)';
      if (stageKey === 'assigned') return 'Assigned to Counsellor';
      if (stageKey === 'potential') return 'Prospective Students';
      if (stageKey === 'under_discussion') return 'Course Discussion';
    } else {
      if (stageKey === 'converted') return 'Converted (Closed Won)';
      if (stageKey === 'assigned') return 'Assigned to Coordinator';
    }
    return defaultLabel;
  };

  const handleDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stageKey) {
      setDragOverStage(stageKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent, stageKey: string) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverStage === stageKey) {
      setDragOverStage(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStageKey: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    
    if (leadId) {
      const draggedLead = leads.find(l => l.id === leadId);
      if (draggedLead && draggedLead.stage !== targetStageKey) {
        updateLeadStage(
          leadId, 
          targetStageKey as LeadStage, 
          `Moved from ${draggedLead.stage.toUpperCase()} to ${targetStageKey.toUpperCase()} via Pick & Drop Kanban`
        );
      }
    }

    setDragOverStage(null);
    setDraggedLeadId(null);
  };

  return (
    <div className="flex-1 overflow-x-auto pb-4 pt-1">
      <div className="flex gap-4 min-w-[1350px] items-start h-full">
        {activeColumns.map((col) => {
          const stageKey = col.key;
          const stageLeads = leads.filter(l => l.stage === stageKey);
          const predefinedConfig = STAGE_CONFIG[stageKey as LeadStage];
          const config = predefinedConfig || {
            label: col.label,
            shortLabel: col.label.slice(0, 10).toUpperCase(),
            bg: 'bg-indigo-500/15',
            text: 'text-indigo-400',
            border: 'border-indigo-500/30',
            pillBg: 'bg-[#6366f1]/20',
            pillText: 'text-[#818cf8]',
            pillBorder: 'border-[#818cf8]/40'
          };

          const isDropTarget = dragOverStage === stageKey;
          const displayLabel = getStageLabel(stageKey, col.label || config.label);

          return (
            <div
              key={col.id || stageKey}
              onDragOver={(e) => handleDragOver(e, stageKey)}
              onDragEnter={(e) => handleDragOver(e, stageKey)}
              onDragLeave={(e) => handleDragLeave(e, stageKey)}
              onDrop={(e) => handleDrop(e, stageKey)}
              className={`w-72 shrink-0 rounded-2xl border flex flex-col max-h-[calc(100vh-235px)] overflow-hidden transition-all duration-200 ${
                isDropTarget
                  ? isCras
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 ring-2 ring-rose-500/50 shadow-xl scale-[1.01]'
                    : 'bg-teal-50 dark:bg-teal-950/40 border-teal-400 ring-2 ring-teal-500/50 shadow-xl scale-[1.01]'
                  : 'bg-slate-100/80 dark:bg-slate-950/60 border-slate-200/90 dark:border-slate-800 shadow-sm'
              }`}
            >
              {/* Column Header */}
              <div className={`p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors ${
                isDropTarget 
                  ? (isCras ? 'bg-rose-100/90 dark:bg-rose-900/40' : 'bg-teal-100/90 dark:bg-teal-900/40') 
                  : 'bg-white dark:bg-slate-900/80'
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 border`}
                    style={{
                      backgroundColor: getStageHexColor(col.color),
                      borderColor: `${getStageHexColor(col.color)}80`
                    }}
                  ></span>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wide truncate">{displayLabel}</h3>
                </div>
                <span className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded-full border transition-colors shrink-0 ml-1.5 ${
                  isDropTarget 
                    ? (isCras ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40' : 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/40')
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}>
                  {stageLeads.length}
                </span>
              </div>

              {/* Column Card List */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 transition-all custom-scrollbar">
                {/* Visual Drop Placeholder Indicator */}
                {isDropTarget && draggedLeadId && (
                  <div className={`p-3.5 border-2 border-dashed rounded-xl text-center flex flex-col items-center justify-center gap-1 animate-pulse text-xs font-semibold ${
                    isCras ? 'border-rose-400 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'border-teal-400 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                  }`}>
                    <ArrowDownCircle className={`w-5 h-5 animate-bounce ${isCras ? 'text-rose-500 dark:text-rose-400' : 'text-teal-600 dark:text-teal-400'}`} />
                    <span>Drop to move into {displayLabel}</span>
                  </div>
                )}

                {stageLeads.length === 0 && !isDropTarget ? (
                  <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300 dark:border-slate-800/80 rounded-lg text-slate-400 dark:text-slate-500 text-xs">
                    <p>{isCras ? 'No student inquiries in this stage' : 'No patient leads in this stage'}</p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">Pick and drop any lead card here</span>
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
