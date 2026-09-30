import React from 'react';
import { LeadStage } from '../../types';

interface StageBadgeProps {
  stage: LeadStage;
  className?: string;
}

export const STAGE_CONFIG: Record<LeadStage, { label: string; bg: string; text: string; border: string }> = {
  new: {
    label: 'New Inquiry',
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  assigned: {
    label: 'Assigned',
    bg: 'bg-sky-500/15',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
  },
  contacted: {
    label: 'Contacted',
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
  },
  interested: {
    label: 'Interested',
    bg: 'bg-teal-500/15',
    text: 'text-teal-400',
    border: 'border-teal-500/30',
  },
  follow_up: {
    label: 'Follow-Up',
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
  converted: {
    label: 'Converted',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  lost: {
    label: 'Lost / Closed',
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
  }
};

export const StageBadge: React.FC<StageBadgeProps> = ({ stage, className = '' }) => {
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.new;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${config.bg} ${config.text} ${config.border} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1"></span>
      {config.label}
    </span>
  );
};
