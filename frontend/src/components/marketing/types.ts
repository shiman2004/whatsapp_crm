export type MarketingPage =
  | 'dashboard'
  | 'add'
  | 'uploads'
  | 'contacts'
  | 'assignment'
  | 'tasks'
  | 'content'
  | 'reports';

export type LifecycleStatus =
  | 'new'
  | 'assigned'
  | 'follow_up_pending'
  | 'contacted'
  | 'interested'
  | 'not_interested'
  | 'no_response'
  | 'converted'
  | 'do_not_contact';

export type ConsentStatus = 'unknown' | 'verified' | 'denied' | 'opted_out';

export interface MarketingContact {
  id: string;
  serialNumber: string;
  normalizedPhone: string;
  name?: string | null;
  tags?: string[] | null;
  company: string;
  originalSource: string;
  sourceGroupName?: string | null;
  firstAddedById: string;
  firstAddedAt: string;
  consentStatus: ConsentStatus;
  lifecycleStatus: LifecycleStatus;
  convertedLeadId?: string | null;
  lastActivityAt?: string | null;
  qualificationNote?: string | null;
  currentOwnerId?: string | null;
  assignedOwner?: {
    id: string;
    fullName: string;
    roleTitle?: string;
  } | null;
  assignedById?: string | null;
  assignedAt?: string | null;
  isSuppressed?: boolean;
  suppressionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingImportBatch {
  id: string;
  batchNumber: string;
  company: string;
  uploadedById: string;
  source: string;
  sourceGroupName?: string | null;
  fileName?: string | null;
  totalSubmitted: number;
  validNewCount: number;
  duplicateCount: number;
  invalidCount: number;
  savedCount: number;
  status: 'queued' | 'processing' | 'completed' | 'partially_completed' | 'failed';
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface MarketingImportRow {
  id: string;
  batchId: string;
  rowNumber: number;
  rawPhone?: string | null;
  normalizedPhone?: string | null;
  status: 'pending' | 'saved' | 'duplicate' | 'invalid' | 'failed';
  errorCode?: string | null;
  errorMessage?: string | null;
  processedAt?: string | null;
}

export interface MarketingTask {
  id: string;
  contactId: string;
  ownerId: string;
  status: 'pending' | 'contacted' | 'interested' | 'not_interested' | 'follow_up' | 'completed';
  notes?: string | null;
  followUpAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  contact?: MarketingContact | null;
}

export interface MarketingActivity {
  id: string;
  contactId: string;
  actorId: string;
  type: string;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface MarketingConsentEvent {
  id: string;
  contactId: string;
  status: ConsentStatus;
  purpose?: string | null;
  channel?: string | null;
  evidence?: string | null;
  evidenceType?: string | null;
  evidenceReference?: string | null;
  recordedById: string;
  recordedByName?: string | null;
  recordedAt: string;
}

export interface ConversionEligibility {
  eligible: boolean;
  reasons: string[];
}

export interface MarketingAssignmentHistory {
  id: string;
  contactId: string;
  previousOwnerId?: string | null;
  newOwnerId?: string | null;
  assignedById: string;
  reason?: string | null;
  createdAt: string;
}

export interface MarketingLeadConversion {
  id: string;
  contactId: string;
  leadId?: string | null;
  company: string;
  status: 'pending' | 'approved' | 'rejected' | 'linked_existing';
  requestedById: string;
  requestedAt: string;
  reviewedById?: string | null;
  duplicateLeadId?: string | null;
  officerNote?: string | null;
}

export interface MarketingOfficer {
  id: string;
  fullName: string;
  email: string;
  role?: string;
  company?: string | null;
  active?: boolean;
}

export interface MarketingReportData {
  contacts: number;
  assigned: number;
  unassigned: number;
  converted: number;
  verifiedConsent: number;
  imports?: {
    totalSubmitted?: number;
    duplicateCount?: number;
    invalidCount?: number;
    savedCount?: number;
  };
  tasks?: Array<{
    status: string;
    _count: { _all: number };
  }>;
}

export interface MarketingCampaign {
  id: string;
  company: string;
  title: string;
  description?: string | null;
  targetAudience?: string | null;
  instructions?: string | null;
  approvedText?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
}

