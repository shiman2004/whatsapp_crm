export type UserRole = 'super_admin' | 'leads_officer' | 'coordinator';

export type LeadStage = 'new' | 'assigned' | 'contacted' | 'interested' | 'follow_up' | 'converted' | 'lost';

export type LanguageCode = 'en' | 'si' | 'ta';

export interface User {
  id: string;
  fullName: string;
  email: string;
  password?: string;
  pin?: string;
  phone?: string;
  branch?: string;
  role: UserRole;
  treatmentCategoryId?: string;
  language?: LanguageCode;
  avatar?: string;
  active: boolean;
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

export interface Lead {
  id: string;
  customerId: string;
  customer?: Customer;
  categoryId?: string;
  treatmentId?: string;
  serialNumber?: string;
  assignedTo?: string; // User ID
  assignedCoordinator?: User;
  stage: LeadStage;
  source: 'whatsapp';
  language: LanguageCode;
  createdAt: string;
  updatedAt: string;
  lastCustomerMessageAt: string;
  notesCount?: number;
  unreadCount?: number;
}

export type MessageDirection = 'inbound' | 'outbound';
export type SenderType = 'customer' | 'coordinator' | 'system' | 'ai';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

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
  waMessageId: string;
  status: MessageStatus;
  createdAt: string;
  suggestedByAi?: boolean;
  starred?: boolean;
  pinned?: boolean;
  reactions?: string[];
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  };
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
  name: string;
  nameI18n: {
    en: string;
    si: string;
    ta: string;
  };
  active: boolean;
  priceRange?: string;
  duration?: string;
}

export interface LeadNote {
  id: string;
  leadId: string;
  authorId: string;
  authorName: string;
  note: string;
  createdAt: string;
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
