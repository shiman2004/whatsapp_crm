import React from 'react';
import { 
  MessageSquare, 
  Clock, 
  FileText, 
  Globe, 
  Sparkles, 
  ChevronRight, 
  UserCheck, 
  AlertTriangle,
  GripVertical 
} from 'lucide-react';
import { Lead } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { CompanyTagBadge } from '../common/CompanyTagBadge';

interface LeadCardProps {
  lead: Lead;
  onSelectLead: (leadId: string) => void;
  onDragStart?: (leadId: string) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}

const LANGUAGE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  en: { label: 'EN', bg: 'bg-blue-500/15', text: 'text-blue-300' },
  si: { label: 'SI', bg: 'bg-amber-500/15', text: 'text-amber-300' },
  ta: { label: 'TA', bg: 'bg-rose-500/15', text: 'text-rose-300' }
};

export const LeadCard: React.FC<LeadCardProps> = ({ 
  lead, 
  onSelectLead,
  onDragStart,
  onDragEnd,
  isDragging
}) => {
  const { categories, treatments, users, selectedLeadId } = useCrm();

  const category = categories.find(c => c.id === lead.categoryId);
  const treatment = treatments.find(t => t.id === lead.treatmentId);
  const coordinator = users.find(u => u.id === lead.assignedTo);
  const isSelected = selectedLeadId === lead.id;

  const langBadge = LANGUAGE_LABELS[lead.language] || LANGUAGE_LABELS.en;

  // Format time elapsed since creation
  const createdDate = new Date(lead.createdAt);
  const timeString = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', lead.id);
    e.dataTransfer.setData('application/json', JSON.stringify({ id: lead.id, stage: lead.stage }));
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(lead.id);
  };

  const handleDragEnd = () => {
    if (onDragEnd) onDragEnd();
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onSelectLead(lead.id)}
      className={`p-3.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing group select-none relative ${
        isDragging 
          ? 'opacity-40 scale-95 border-dashed border-teal-500 bg-slate-900/40 shadow-none' 
          : isSelected
          ? 'bg-slate-800/90 border-teal-500/60 shadow-lg shadow-teal-950/40 ring-1 ring-teal-500/40'
          : 'bg-slate-900/70 hover:bg-slate-850 border-slate-800 hover:border-slate-700 shadow-sm hover:shadow-md'
      }`}
    >
      {/* Top row: Grip Handle + Patient Name + Language Badge + Time */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-slate-600 group-hover:text-slate-400 transition-colors shrink-0 -ml-1">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <div className="relative shrink-0">
            <img
              src={lead.customer?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={lead.customer?.displayName}
              className="w-7 h-7 rounded-full object-cover border border-slate-700"
            />
            {(lead.unreadCount || 0) > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900 absolute -top-0.5 -right-0.5"></span>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-100 truncate group-hover:text-teal-300 transition-colors">
              {lead.customer?.displayName || 'WhatsApp Customer'}
            </h4>
            <p className="text-[10px] text-slate-400 font-mono truncate">{lead.customer?.whatsappNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <CompanyTagBadge lead={lead} size="xs" />
          <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${langBadge.bg} ${langBadge.text}`}>
            {langBadge.label}
          </span>
          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {timeString}
          </span>
        </div>
      </div>

      {/* Middle row: Treatment Category & Specific Service / Course */}
      <div className="mt-2.5 pt-2 border-t border-slate-800/70">
        <div className="flex items-center justify-between gap-1 text-[11px] font-medium">
          <div className="flex items-center gap-1 min-w-0">
            <Sparkles className={`w-3 h-3 shrink-0 ${lead.company === 'CRAS' ? 'text-rose-400' : 'text-teal-500'}`} />
            <span className={`truncate ${lead.company === 'CRAS' ? 'text-rose-300' : 'text-teal-400'}`}>
              {treatment?.name || category?.name || (lead.company === 'CRAS' ? 'General Course Inquiry' : 'General Inquiry')}
            </span>
          </div>
          {lead.serialNumber && (
            <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded border shrink-0 font-bold ${
              lead.company === 'CRAS' 
                ? 'bg-rose-950/60 text-rose-300 border-rose-800/60' 
                : 'bg-slate-800 text-teal-300 border-slate-700'
            }`}>
              {lead.serialNumber}
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-400 truncate mt-0.5">
          {category?.name || (lead.company === 'CRAS' ? 'CRAS Academic Programs' : '')}
        </p>
      </div>

      {/* Bottom row: Coordinator Assignment & Stats */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/70 text-[10px]">
        {coordinator ? (
          <div className="flex items-center gap-1.5 text-slate-300">
            <img
              src={coordinator.avatar || 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150'}
              alt={coordinator.fullName}
              className="w-4 h-4 rounded-full object-cover border border-slate-700"
            />
            <span className="truncate max-w-[90px] text-slate-300 font-medium">{coordinator.fullName.split(' ')[0]}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-amber-400 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            <span>Unassigned</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-slate-400">
          {(lead.notesCount || 0) > 0 && (
            <span className="flex items-center gap-0.5" title="Internal Notes">
              <FileText className="w-3 h-3 text-slate-500" />
              <span>{lead.notesCount}</span>
            </span>
          )}
          <span className="text-teal-400 group-hover:translate-x-0.5 transition-transform flex items-center font-medium">
            Open <ChevronRight className="w-3 h-3 ml-0.5" />
          </span>
        </div>
      </div>
    </div>
  );
};
