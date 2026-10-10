import { CompanyCode, Lead } from '../types';

export interface CompanyConfig {
  code: CompanyCode;
  tag: string;
  name: string;
  shortName: string;
  colorHex: string;
  color: string;
  phoneId: string;
  phoneNumber: string;
  phone: string;
  displayPhone: string;
}

export const COMPANIES: Record<CompanyCode, CompanyConfig> = {
  RWC: {
    code: 'RWC',
    tag: '(RWC)',
    name: 'Royal Wellness Center',
    shortName: 'Royal Wellness',
    colorHex: '#008000', // User requested green: #008000
    color: '#008000',
    phoneId: '1358157244046701',
    phoneNumber: '+94 70 639 3353',
    phone: '+94 70 639 3353',
    displayPhone: '+94 70 639 3353'
  },
  CRAS: {
    code: 'CRAS',
    tag: '(CRAS)',
    name: 'College of Royal Aesthetic of Sri Lanka',
    shortName: 'CRAS College',
    colorHex: '#800000', // User requested maroon: #800000
    color: '#800000',
    phoneId: '1378201582041705',
    phoneNumber: '+94 70 637 3353',
    phone: '+94 70 637 3353',
    displayPhone: '+94 70 637 3353'
  }
};

/**
 * Resolves the company configuration for a lead
 */
export const getLeadCompany = (lead?: Partial<Lead> | { company?: string; source?: string; whatsappSessionId?: string } | null): CompanyConfig => {
  if (!lead) return COMPANIES.RWC;
  
  if (
    lead.company === 'CRAS' || 
    lead.source === 'CRAS' || 
    (lead as any).whatsappSessionId === 'CRAS'
  ) {
    return COMPANIES.CRAS;
  }
  
  return COMPANIES.RWC;
};
