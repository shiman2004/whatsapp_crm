import React from 'react';
import { getLeadCompany, CompanyConfig, COMPANIES } from '../../utils/companyUtils';
import { CompanyCode, Lead } from '../../types';

interface CompanyTagBadgeProps {
  company?: CompanyCode | string;
  lead?: Partial<Lead> | null;
  size?: 'xs' | 'sm' | 'md';
  showFullName?: boolean;
  className?: string;
}

export const CompanyTagBadge: React.FC<CompanyTagBadgeProps> = ({
  company,
  lead,
  size = 'xs',
  showFullName = false,
  className = ''
}) => {
  let comp: CompanyConfig;
  if (company && COMPANIES[company as CompanyCode]) {
    comp = COMPANIES[company as CompanyCode];
  } else if (company === 'AHC' || lead?.company === 'AHC' || lead?.source === 'AHC') {
    comp = COMPANIES.AHC;
  } else if (company === 'CRAS' || lead?.company === 'CRAS' || lead?.source === 'CRAS') {
    comp = COMPANIES.CRAS;
  } else {
    comp = getLeadCompany(lead);
  }

  // Brand colors requested by user:
  // Alpha Health Consultancy (AHC): Deep Teal #066e77 (from official logo)
  // College of Royal Aesthetic of Sri Lanka (CRAS): Maroon #800000
  // Royal Wellness Center (RWC): Green #008000
  const badgeStyle: React.CSSProperties = comp.code === 'AHC'
    ? {
        backgroundColor: '#066e77',
        color: '#ffffff',
        borderColor: '#045158'
      }
    : comp.code === 'CRAS'
    ? {
        backgroundColor: '#800000',
        color: '#ffffff',
        borderColor: '#5a0000'
      }
    : {
        backgroundColor: '#008000',
        color: '#ffffff',
        borderColor: '#005500'
      };

  return (
    <span
      style={badgeStyle}
      className={`inline-flex items-center gap-1 font-black tracking-wider uppercase rounded shadow-sm border select-none shrink-0 ${
        size === 'xs'
          ? 'px-1.5 py-0.2 text-[8.5px] leading-tight'
          : size === 'sm'
          ? 'px-2 py-0.5 text-[9.5px] leading-tight'
          : 'px-2.5 py-1 text-xs'
      } ${className}`}
      title={comp.name}
    >
      {showFullName ? (
        <span className="font-semibold normal-case text-[10px] opacity-90 hidden sm:inline">
          {comp.shortName || comp.name}
        </span>
      ) : (
        <span>{comp.tag}</span>
      )}
    </span>
  );
};
