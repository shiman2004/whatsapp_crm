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
  const comp: CompanyConfig = (company === 'CRAS' || lead?.company === 'CRAS' || lead?.source === 'CRAS')
    ? COMPANIES.CRAS
    : getLeadCompany(lead);

  const isCras = comp.code === 'CRAS';

  // User requested exact hex codes:
  // Royal Wellness Center (RWC): Green #008000
  // College of Royal Aesthetic of Sri Lanka (CRAS): Maroon #800000
  const badgeStyle: React.CSSProperties = isCras
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
      <span>{comp.tag}</span>
      {showFullName && (
        <span className="font-semibold normal-case text-[10px] opacity-90 hidden sm:inline">
          {comp.shortName}
        </span>
      )}
    </span>
  );
};
