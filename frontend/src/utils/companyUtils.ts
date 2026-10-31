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
    tag: 'RWC',
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
    tag: 'CRAS',
    name: 'College of Royal Aesthetic of Sri Lanka',
    shortName: 'CRAS College',
    colorHex: '#800000', // User requested maroon: #800000
    color: '#800000',
    phoneId: '1378201582041705',
    phoneNumber: '+94 70 637 3353',
    phone: '+94 70 637 3353',
    displayPhone: '+94 70 637 3353'
  },
  AHC: {
    code: 'AHC',
    tag: 'AHC',
    name: 'Alpha Health Consultancy',
    shortName: 'Alpha Health',
    colorHex: '#066e77', // User logo color: Deep Teal sampled directly from official logo
    color: '#066e77',
    phoneId: '1408148915714830',
    phoneNumber: '+971 54 372 3912',
    phone: '+971 54 372 3912',
    displayPhone: '+971 54 372 3912'
  }
};

/**
 * Resolves the company configuration for a lead
 */
export const getLeadCompany = (lead?: Partial<Lead> | { company?: string; source?: string; whatsappSessionId?: string } | null): CompanyConfig => {
  if (!lead) return COMPANIES.RWC;
  
  if (
    lead.company === 'AHC' ||
    lead.source === 'AHC' ||
    (lead as any).whatsappSessionId === 'AHC' ||
    (lead as any).treatment?.company === 'AHC' ||
    (lead as any).assignedCoordinator?.company === 'AHC' ||
    (lead as any).companyPhoneNumberId === '1408148915714830' ||
    String((lead as any).companyPhoneNumber || '').includes('971543723912') ||
    String((lead as any).customer?.whatsappNumber || '').includes('971543723912') ||
    String((lead as any).customer?.whatsappNumber || '').includes('3723912')
  ) {
    return COMPANIES.AHC;
  }

  if (
    lead.company === 'CRAS' || 
    lead.source === 'CRAS' || 
    (lead as any).whatsappSessionId === 'CRAS' ||
    (lead as any).categoryId === 'cat-cras-courses' ||
    (lead as any).treatment?.company === 'CRAS' ||
    (lead as any).assignedCoordinator?.company === 'CRAS' ||
    (lead as any).companyPhoneNumberId === '1378201582041705' ||
    String((lead as any).companyPhoneNumber || '').includes('6373353')
  ) {
    return COMPANIES.CRAS;
  }
  
  return COMPANIES.RWC;
};

/**
 * Returns the official title for staff coordinators based on their company:
 * - RWC -> "Patient Coordinator"
 * - CRAS -> "Education Counsellor"
 * - AHC -> "Consultancy Advisor"
 */
export const getCoordinatorRoleLabel = (company?: string | null): string => {
  if (company === 'CRAS') {
    return 'Education Counsellor';
  }
  if (company === 'AHC') {
    return 'Consultancy Advisor';
  }
  return 'Patient Coordinator';
};

/**
 * Returns the assignment header label based on company
 */
export const getAssignedStaffLabel = (company?: string | null): string => {
  if (company === 'CRAS') {
    return 'Assigned Education Counsellor';
  }
  if (company === 'AHC') {
    return 'Assigned Advisor';
  }
  return 'Assigned Patient Coordinator';
};
