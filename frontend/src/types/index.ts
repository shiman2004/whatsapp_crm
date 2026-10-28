export type UserRole = 'super_admin' | 'leads_officer' | 'coordinator' | 'sales_coordinator' | 'exam_department_manager' | 'exam_coordinator' | 'exam_providing_officer' | 'marketing_officer' | 'marketing_admin' | 'clinical_nurse' | 'clinical_doctor' | 'report_analyst';

export type MarketingCapability =
  | 'dashboard'
  | 'collect'
  | 'view_own_uploads'
  | 'view_assigned_tasks'
  | 'update_assigned_tasks'
  | 'manage_campaign_drafts'
  | 'view_reports'
  | 'assign'
  | 'reassign'
  | 'export'
  | 'approve_campaigns'
  | 'audit';

export type LeadStage = 
  | 'new' 
  | 'assigned' 
  | 'contacted' 
  | 'potential' 
  | 'under_discussion' 
  | 'forwarded_to_exam_department'
  | 'forwarded_to_processing_department'
  | 'not_relevant' 
  | 'not_eligible'
  | 'converted' 
  | 'lost'
  | 'interested'
  | 'follow_up';

export type LanguageCode = 'en' | 'si' | 'ta';

export interface User {
  id: string;
  fullName: string;
  email: string;
  password?: string;
  pin?: string;
  phone?: string;
  branch?: string;
  company?: CompanyCode;
  role: UserRole;
  roleTitle?: string; // Display title, e.g. 'Super Admin', 'Sales Officer', 'Clinic Manager'
  treatmentCategoryId?: string;
  language?: LanguageCode;
  avatar?: string;
  active: boolean;
  /** Explicit marketing module grant; role permissions remain server-enforced. */
  marketingAccess?: boolean;
  /** Whether a security PIN exists. The PIN or its hash must never be sent in staff listings. */
  pinConfigured?: boolean;
  createdAt: string;
  activeLeadsCount?: number;
}

export interface Customer {
  id: string;
  whatsappNumber: string; // E.164 canonical phone number e.g. +94771234567
  whatsappId?: string;    // Meta / WA ID e.g. 94771234567
  phoneNumber?: string;   // Normalized display phone e.g. +94 77 123 4567
  displayName: string;
  preferredLanguage: LanguageCode;
  createdAt: string;
  avatarUrl?: string;
}

export type CompanyCode = 'RWC' | 'CRAS' | 'AHC';

export interface Lead {
  id: string;
  customerId: string;
  customer?: Customer;
  categoryId?: string;
  treatmentId?: string;
  serialNumber?: string;
  assignedTo?: string; // User ID
  assignedCoordinator?: User;
  assignedById?: string;
  assignedByName?: string;
  assignedAt?: string;
  acceptedAt?: string;
  assignmentHistories?: LeadAssignmentHistory[];
  stage: LeadStage;
  source: string; // 'whatsapp' | 'RWC' | 'CRAS' | 'AHC'
  company?: CompanyCode;
  companyTag?: string;
  companyColor?: string;
  companyPhoneNumberId?: string;
  companyPhoneNumber?: string;
  language: LanguageCode;
  createdAt: string;
  updatedAt: string;
  lastCustomerMessageAt: string;
  notesCount?: number;
  unreadCount?: number;
}

export interface LeadAssignmentHistory {
  id: string;
  leadId: string;
  assignedToId?: string;
  assignedToName?: string;
  assignedById?: string;
  assignedByName?: string;
  assignedAt: string;
}

export type MessageDirection = 'inbound' | 'outbound';
export type SenderType = 'customer' | 'coordinator' | 'system' | 'ai';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  leadId: string;
  customerId: string;
  direction: MessageDirection;
  senderType: SenderType;
  content: string;
  translatedContent?: {
    en?: string;
    si?: string;
    ta?: string;
  };
  media?: {
    type: 'image' | 'document' | 'audio' | 'video';
    url: string;
    caption?: string;
    fileName?: string;
  };
  waMessageId?: string;
  status: MessageStatus;
  errorCode?: number;
  errorMessage?: string;
  createdAt: string;
  suggestedByAi?: boolean;
  starred?: boolean;
  pinned?: boolean;
  edited?: boolean;
  reported?: boolean;
  reactions?: string[];
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  };
  // Internal Sender Audit Trail (Super Admin Visibility)
  senderId?: string;
  senderName?: string;
  senderRole?: string;
  messageSource?: 'CRM User' | 'Automation' | 'API' | 'System';
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  timestamp?: string;
}

export interface MessageAudit {
  id: string;
  messageId: string;
  leadId: string;
  customerId?: string;
  company?: string;
  whatsappNumber?: string;
  senderId?: string;
  senderName: string;
  senderRole: string;
  messageSource: 'CRM User' | 'Automation' | 'API' | 'System';
  deliveryStatus: string;
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}

export interface TreatmentCategory {
  id: string;
  name: string;
  nameI18n: {
    en: string;
    si: string;
    ta: string;
  };
  active: boolean;
  iconName: string;
  description: string;
}

export interface Treatment {
  id: string;
  code?: string;
  categoryId: string;
  company?: CompanyCode;
  name: string;
  nameI18n?: {
    en: string;
    si: string;
    ta: string;
  };
  active: boolean;
  priceRange?: string;
  duration?: string;
  durationMinutes?: number;
  startingPrice?: number;
  description?: string;
  benefits?: string;
}

export interface LeadStageConfig {
  id: string;
  key: string;
  label: string;
  description?: string;
  color?: string;
  orderIndex: number;
  isActive: boolean;
  isSystem: boolean;
  company?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadNote {
  id: string;
  leadId: string;
  authorId: string;
  authorName: string;
  note: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LeadStageHistory {
  id: string;
  leadId: string;
  fromStage: LeadStage;
  toStage: LeadStage;
  changedBy: string;
  changedByName: string;
  reason?: string;
  createdAt: string;
}

export type FollowupStatus = 'pending' | 'sent' | 'failed' | 'cancelled' | 'skipped';

export interface Followup {
  id: string;
  leadId: string;
  sequenceId: string;
  templateId: string;
  stepNumber: number;
  scheduledAt: string;
  status: FollowupStatus;
  retryCount: number;
  sentAt?: string;
  dayOffset: number;
}

export interface FollowupSequenceStep {
  dayOffset: number;
  templateId: string;
  label: string;
}

export interface FollowupSequence {
  id: string;
  categoryId: string;
  name: string;
  steps: FollowupSequenceStep[];
  active: boolean;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: LanguageCode;
  waTemplateName: string;
  body: string;
  variables: string[];
  approved: boolean;
  category: 'UTILITY' | 'MARKETING';
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: 'Lead' | 'Message' | 'Assignment' | 'Template' | 'Treatment' | 'Followup' | 'User';
  entityId: string;
  before?: any;
  after?: any;
  createdAt: string;
}

export type OnboardingState = 
  | 'AwaitingLanguage' 
  | 'AwaitingCategory' 
  | 'AwaitingService' 
  | 'LeadCreated' 
  | 'HumanHandling';

export interface OnboardingSession {
  waId: string;
  name: string;
  state: OnboardingState;
  selectedLanguage?: LanguageCode;
  selectedCategory?: string;
  selectedTreatment?: string;
  updatedAt: string;
}

export type WhatsAppConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'qr_ready' | 'syncing' | 'sync_error';

export interface TeamBroadcast {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  company?: 'ALL' | 'RWC' | 'CRAS' | string;
  title?: string;
  content: string;
  mediaType?: 'image' | 'video' | 'document' | 'audio';
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  isPinned?: boolean;
  targetStaffId?: string;
  targetStaffName?: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface Room {
  id: string;
  branchId: string;
  name: string;
  roomNumber: string;
  description?: string;
  color?: string;
  operatingStart?: string;
  operatingEnd?: string;
  isActive: boolean;
  treatmentIds?: string[];
  treatments?: Array<{ id: string; name: string }>;
  createdAt?: string;
}

export type AppointmentStatus = 
  | 'booked' 
  | 'confirmed' 
  | 'arrived' 
  | 'paid' 
  | 'rescheduled' 
  | 'cancelled' 
  | 'no_answer'
  | 'pending' 
  | 'checked_in' 
  | 'in_progress' 
  | 'completed' 
  | 'no_show';

export interface AppointmentStatusHistory {
  id: string;
  appointmentId: string;
  previousStatus?: AppointmentStatus | string;
  newStatus: AppointmentStatus | string;
  changedById?: string;
  changedByName: string;
  reason?: string;
  changedAt: string;
}

export interface Appointment {
  id: string;
  branchId: string;
  branchName?: string;
  roomId: string;
  roomName?: string;
  roomNumber?: string;
  roomColor?: string;
  patientId: string;
  patientName?: string;
  patientPhone?: string;
  patientAvatar?: string;
  doctorId: string;
  doctorName?: string;
  doctorTitle?: string;
  treatmentId: string;
  treatmentName?: string;
  treatmentDuration?: number;
  treatmentPrice?: number;
  startTime: string; // ISO String
  endTime: string;   // ISO String
  status: AppointmentStatus;
  notes?: string;
  createdById?: string;
  createdByName?: string;
  cancellationReason?: string;
  statusHistory?: AppointmentStatusHistory[];
  createdAt: string;
}

export interface AvailabilityBlock {
  id: string;
  branchId: string;
  roomId?: string;
  roomName?: string;
  doctorId?: string;
  doctorName?: string;
  startTime: string;
  endTime: string;
  reason: string;
  createdAt?: string;
}

