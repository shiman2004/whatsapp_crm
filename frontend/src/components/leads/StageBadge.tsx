import React from 'react';
import { LeadStage } from '../../types';

interface StageBadgeProps {
  stage: LeadStage;
  className?: string;
  short?: boolean;
}

export const STAGE_CONFIG: Record<LeadStage, { label: string; shortLabel: string; bg: string; text: string; border: string; pillBg: string; pillText: string; pillBorder: string }> = {
  new: {
    label: 'New Inquiry',
    shortLabel: 'NEW',
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    pillBg: 'bg-[#e11d48]/20',
    pillText: 'text-[#fb7185]',
    pillBorder: 'border-[#fb7185]/40'
  },
  assigned: {
    label: 'Accepted',
    shortLabel: 'ACCEPTED',
    bg: 'bg-green-500/15',
    text: 'text-green-400',
    border: 'border-green-500/30',
    pillBg: 'bg-[#16a34a]/20',
    pillText: 'text-[#4ade80]',
    pillBorder: 'border-[#4ade80]/40'
  },
  contacted: {
    label: 'Contacted',
    shortLabel: 'CONTACTED',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    pillBg: 'bg-[#059669]/20',
    pillText: 'text-[#34d399]',
    pillBorder: 'border-[#34d399]/40'
  },
  potential: {
    label: 'Potential',
    shortLabel: 'POTENTIAL',
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    pillBg: 'bg-[#7c3aed]/20',
    pillText: 'text-[#c084fc]',
    pillBorder: 'border-[#c084fc]/40'
  },
  under_discussion: {
    label: 'Under Discussion',
    shortLabel: 'UNDER DISCUSSION',
    bg: 'bg-sky-500/15',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    pillBg: 'bg-[#0284c7]/20',
    pillText: 'text-[#38bdf8]',
    pillBorder: 'border-[#38bdf8]/40'
  },
  not_relevant: {
    label: 'Not Relevant Inquiry',
    shortLabel: 'NOT RELEVANT',
    bg: 'bg-slate-500/15',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    pillBg: 'bg-[#475569]/30',
    pillText: 'text-[#94a3b8]',
    pillBorder: 'border-[#64748b]/40'
  },
  not_eligible: {
    label: 'Not Eligible',
    shortLabel: 'NOT ELIGIBLE',
    bg: 'bg-zinc-500/15',
    text: 'text-zinc-400',
    border: 'border-zinc-500/30',
    pillBg: 'bg-[#52525b]/30',
    pillText: 'text-[#a1a1aa]',
    pillBorder: 'border-[#71717a]/40'
  },
  converted: {
    label: 'Converted',
    shortLabel: 'CONVERTED',
    bg: 'bg-teal-500/15',
    text: 'text-teal-400',
    border: 'border-teal-500/30',
    pillBg: 'bg-[#0d9488]/20',
    pillText: 'text-[#2dd4be]',
    pillBorder: 'border-[#2dd4be]/40'
  },
  lost: {
    label: 'Lost',
    shortLabel: 'LOST',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
    pillBg: 'bg-[#dc2626]/20',
    pillText: 'text-[#f87171]',
    pillBorder: 'border-[#f87171]/40'
  },
  interested: {
    label: 'Potential',
    shortLabel: 'POTENTIAL',
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    pillBg: 'bg-[#7c3aed]/20',
    pillText: 'text-[#c084fc]',
    pillBorder: 'border-[#c084fc]/40'
  },
  follow_up: {
    label: 'Under Discussion',
    shortLabel: 'UNDER DISCUSSION',
    bg: 'bg-sky-500/15',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    pillBg: 'bg-[#0284c7]/20',
    pillText: 'text-[#38bdf8]',
    pillBorder: 'border-[#38bdf8]/40'
  }
};

export const StageBadge: React.FC<StageBadgeProps> = ({ stage, className = '', short = false }) => {
  const config = STAGE_CONFIG[stage] || {
    label: (stage || 'Stage').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    shortLabel: (stage || 'STAGE').slice(0, 10).toUpperCase(),
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    pillBg: 'bg-[#6366f1]/20',
    pillText: 'text-[#818cf8]',
    pillBorder: 'border-[#818cf8]/40'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${config.bg} ${config.text} ${config.border} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1"></span>
      {short ? config.shortLabel : config.label}
    </span>
  );
};
