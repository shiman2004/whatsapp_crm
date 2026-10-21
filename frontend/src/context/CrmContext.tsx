import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  User,
  UserRole,
  Customer,
  Lead,
  Message,
  TreatmentCategory,
  Treatment,
  WhatsAppTemplate,
  FollowupSequence,
  Followup,
  LeadNote,
  LeadStageHistory,
  LeadAssignmentHistory,
  AuditLog,
  LeadStage,
  LeadStageConfig,
  LanguageCode,
  OnboardingSession,
  WhatsAppConnectionStatus,
  CompanyCode,
  TeamBroadcast
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_CATEGORIES,
  INITIAL_TREATMENTS,
  INITIAL_TEMPLATES,
  INITIAL_SEQUENCES,
  INITIAL_CUSTOMERS,
  INITIAL_LEADS,
  INITIAL_MESSAGES,
  INITIAL_FOLLOWUPS,
  INITIAL_NOTES,
  INITIAL_STAGE_HISTORY,
  INITIAL_AUDIT_LOGS
} from '../mockData/initialData';
import { 
  normalizeWhatsAppNumber, 
  getCleanWhatsAppDigits, 
  isHardwareLid, 
  formatWhatsAppDisplay 
} from '../utils/phoneUtils';
import { COMPANIES, getLeadCompany } from '../utils/companyUtils';
import { API_BASE_URL } from '../config/api';
import { aiService } from '../services/aiService';
import { NotificationSettings, DesktopNotificationItem } from '../types/notifications';
import { playWhatsAppChime } from '../utils/soundUtils';
import { registerNotificationServiceWorker, showDesktopNativeNotification } from '../utils/nativeNotificationUtils';
import { isLeadAccessibleForUser } from '../utils/permissionUtils';
import { NavTab } from '../components/layout/Sidebar';

interface NotificationToast {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'lead';
  timestamp: string;
}

export const DEFAULT_STAGES: LeadStageConfig[] = [
  { id: 'stage-new', key: 'new', label: 'New Inquiry', orderIndex: 0, isActive: true, isSystem: true, color: '#f43f5e' },
  { id: 'stage-assigned', key: 'assigned', label: 'Accepted', orderIndex: 1, isActive: true, isSystem: false, color: '#22c55e' },
  { id: 'stage-contacted', key: 'contacted', label: 'Contacted', orderIndex: 2, isActive: true, isSystem: false, color: '#10b981' },
  { id: 'stage-potential', key: 'potential', label: 'Potential', orderIndex: 3, isActive: true, isSystem: false, color: '#a855f7' },
  { id: 'stage-under-discussion', key: 'under_discussion', label: 'Under Discussion', orderIndex: 4, isActive: true, isSystem: false, color: '#0ea5e9' },
  { id: 'stage-not-relevant', key: 'not_relevant', label: 'Not Relevant Inquiry', orderIndex: 5, isActive: true, isSystem: false, color: '#64748b' },
  { id: 'stage-not-eligible', key: 'not_eligible', label: 'Not Eligible', orderIndex: 6, isActive: true, isSystem: false, color: '#71717a' },
  { id: 'stage-converted', key: 'converted', label: 'Converted', orderIndex: 7, isActive: true, isSystem: true, color: '#14b8a6' },
  { id: 'stage-lost', key: 'lost', label: 'Lost', orderIndex: 8, isActive: true, isSystem: true, color: '#ef4444' }
];

interface CrmContextType {
  // Authentication & RBAC
  isAuthenticated: boolean;
  login: (identifier: string, secret?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUserCredentials: (userId: string, updates: { password?: string; pin?: string }) => void;
  currentUser: User;
  users: User[];
  setCurrentUser: (user: User) => void;
  isSuperAdmin: boolean;
  isLeadsOfficer: boolean;
  isCoordinator: boolean;
  canAssignLeads: boolean;
  canReassignLead: (lead?: Lead) => boolean;
  canModifyAssignment: (lead?: Lead) => boolean;

  // Data collections
  leads: Lead[];
  customers: Customer[];
  messages: Message[];
  // Loads the next older page of conversation history; resolves true when more remain.
  loadOlderMessages: () => Promise<boolean>;
  hasOlderMessages: boolean;
  categories: TreatmentCategory[];
  treatments: Treatment[];
  templates: WhatsAppTemplate[];
  sequences: FollowupSequence[];
  followups: Followup[];
  notes: LeadNote[];
  stageHistories: LeadStageHistory[];
  auditLogs: AuditLog[];
  notifications: NotificationToast[];

  // Selected Lead in view
  selectedLeadId: string | null;
  setSelectedLeadId: (id: string | null) => void;
  selectedLead: Lead | undefined;

  // Lead actions
  assignLead: (leadId: string, coordinatorId: string) => Promise<boolean>;
  updateLeadStage: (leadId: string, newStage: LeadStage, reason?: string) => void;
  updateLeadTreatment: (leadId: string, treatmentId: string, customSerial?: string) => void;
  updateLeadLanguage: (leadId: string, language: 'en' | 'si' | 'ta') => void;
  updateLeadCompany: (leadId: string, company: CompanyCode) => void;
  updateLeadSource: (leadId: string, source: string) => Promise<boolean>;
  addLeadNote: (leadId: string, note: string) => void;
  updateLeadNote: (noteId: string, note: string) => void;
  
  // Messaging actions
  replyingMessage: Message | null;
  setReplyingMessage: (msg: Message | null) => void;
  sendMessage: (leadId: string, content: string, senderType?: 'coordinator' | 'system' | 'ai', media?: any, replyTo?: { id: string; content: string; senderName: string }) => void;
  sendWhatsAppTemplate: (leadId: string, templateId: string, params?: string[], retryMessageId?: string) => Promise<void>;
  retryFailedMessage: (messageId: string) => Promise<void>;
  markChatAsRead: (leadId: string) => void;
  markChatAsUnread: (leadId: string) => void;
  reactToMessage: (messageId: string, emoji: string) => void;
  starMessage: (messageId: string) => void;
  pinMessage: (messageId: string) => void;
  deleteMessage: (messageId: string) => void;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  reportMessage: (messageId: string) => void;
  forwardMessage: (messageId: string, targetLeadId: string | string[]) => void;
  deleteChat: (leadId: string) => Promise<void>;
  clearChat: (leadId: string) => Promise<void>;
  
  // Followup controls
  cancelFollowup: (followupId: string) => void;
  pauseFollowup: (followupId: string) => void;
  resumeFollowup: (followupId: string) => void;
  triggerFollowupNow: (followupId: string) => void;

  // Admin CRUD & Data Management
  clearAllData: () => void;
  addCategory: (category: Omit<TreatmentCategory, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<TreatmentCategory>) => void;
  addTreatment: (treatment: any) => Promise<{ success: boolean; error?: string }>;
  updateTreatment: (id: string, updates: Partial<Treatment>) => Promise<{ success: boolean; error?: string }>;
  toggleTreatmentStatus: (id: string, active: boolean) => Promise<{ success: boolean; error?: string }>;
  addTemplate: (template: Omit<WhatsAppTemplate, 'id'>) => void;
  updateTemplate: (id: string, updates: Partial<WhatsAppTemplate>) => void;
  updateSequence: (id: string, updates: Partial<FollowupSequence>) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  addCoordinator: (data: { fullName: string; branch?: string; company?: CompanyCode; email?: string; password?: string; pin?: string; phone?: string; role?: UserRole; treatmentCategoryId?: string; language?: LanguageCode }) => Promise<void>;
  updateCoordinator: (id: string, data: { fullName: string; branch: string; pin?: string; password?: string }) => Promise<void>;
  deleteCoordinator: (id: string) => void;

  // Super Admin Management & Dynamic Configuration
  stages: LeadStageConfig[];
  courses: Treatment[];
  superAdmins: User[];
  fetchStages: () => Promise<void>;
  addStage: (stage: { key: string; label: string; description?: string; color?: string; orderIndex?: number; company?: 'ALL' | 'RWC' | 'CRAS' | string }) => Promise<{ success: boolean; error?: string; stage?: LeadStageConfig }>;
  updateStage: (id: string, updates: Partial<LeadStageConfig>) => Promise<{ success: boolean; error?: string }>;
  reorderStages: (order: { id: string; orderIndex: number }[]) => Promise<{ success: boolean; error?: string }>;
  toggleStageStatus: (id: string, isActive: boolean) => Promise<{ success: boolean; error?: string }>;
  deleteStage: (id: string) => Promise<{ success: boolean; error?: string }>;

  fetchCourses: () => Promise<void>;
  addCourse: (course: Partial<Treatment>) => Promise<{ success: boolean; error?: string }>;
  updateCourse: (id: string, updates: Partial<Treatment>) => Promise<{ success: boolean; error?: string }>;
  toggleCourseStatus: (id: string, active: boolean) => Promise<{ success: boolean; error?: string }>;

  fetchTreatments: () => Promise<void>;
  fetchSuperAdmins: () => Promise<void>;
  createSuperAdmin: (data: { fullName: string; email: string; password?: string; pin?: string }) => Promise<{ success: boolean; error?: string }>;
  updateSuperAdmin: (id: string, data: { fullName?: string; active?: boolean }) => Promise<{ success: boolean; error?: string }>;
  deleteSuperAdmin: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Team Broadcast Channel
  broadcasts: TeamBroadcast[];
  unreadBroadcastsCount: number;
  markAllBroadcastsAsRead: () => void;
  sendBroadcast: (data: {
    title?: string;
    content: string;
    mediaType?: 'image' | 'video' | 'document' | 'audio';
    mediaUrl?: string;
    fileName?: string;
    fileSize?: number;
    isPinned?: boolean;
    company?: string;
    targetStaffId?: string;
    targetStaffName?: string;
  }) => Promise<boolean>;
  deleteBroadcast: (id: string) => Promise<boolean>;

  // Simulator State & Actions
  simulatorOpen: boolean;
  setSimulatorOpen: (open: boolean) => void;
  simulatorSession: OnboardingSession;
  resetSimulator: () => void;
  sendSimulatorMessage: (text: string) => void;
  selectSimulatorLanguage: (lang: LanguageCode) => void;
  selectSimulatorCategory: (catId: string) => void;
  selectSimulatorTreatment: (trtId: string) => void;

  // WhatsApp Connection & QR Modal
  whatsappStatus: WhatsAppConnectionStatus;
  setWhatsappStatus: (status: WhatsAppConnectionStatus) => void;
  qrModalOpen: boolean;
  setQrModalOpen: (open: boolean) => void;
  hasMetaConfig: boolean;
  setHasMetaConfig: (val: boolean) => void;

  // Add Contact
  addNewContact: (data: {
    name: string;
    phone: string;
    company?: CompanyCode;
    categoryId?: string;
    treatmentId?: string;
    language?: 'en' | 'si' | 'ta';
    assignedTo?: string;
    initialMessage?: string;
    templateName?: string;
    templateParams?: string[];
  }) => Promise<{ success: boolean; leadId?: string; error?: string; messageSent?: boolean; messageError?: string }>;

  // Toasts
  dismissNotification: (id: string) => void;

  // Desktop Notifications
  desktopNotifications: DesktopNotificationItem[];
  notificationSettings: NotificationSettings;
  dismissDesktopNotification: (id: string) => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  dispatchTestNotification: () => void;
  notificationSettingsOpen: boolean;
  setNotificationSettingsOpen: (open: boolean) => void;

  // Blinking Bell Notification & Unread Tracking
  totalUnreadCountForUser: number;
  userReadTimestamps: Record<string, number>;
  chatListFilter: string;
  setChatListFilter: (filter: string) => void;
  openUnreadChats: () => void;
  activeNavTab: NavTab;
  setActiveNavTab: (tab: NavTab) => void;

  // Theme Support
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

// Safe storage helper
const getStored = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
};

// Maps a raw API/SSE message row into the client Message shape.
// Shared by the initial load and by older-history pagination.
const toClientMessage = (m: any): Message => ({
  id: m.id,
  leadId: m.leadId,
  customerId: m.customerId,
  direction: m.direction,
  senderType: m.senderType || (m.direction === 'outbound' ? 'coordinator' : 'customer'),
  senderId: m.senderId || m.audit?.senderId,
  senderName: m.senderName || m.audit?.senderName,
  senderRole: m.senderRole || m.audit?.senderRole,
  messageSource: m.messageSource || m.audit?.messageSource,
  sentAt: m.sentAt || m.audit?.sentAt,
  content: m.content || '',
  status: (m.status === 'read' && !(m.readAt || m.read_at)) ? 'delivered' : (m.status || 'delivered'),
  deliveredAt: m.deliveredAt || m.delivered_at,
  readAt: m.readAt || m.read_at,
  createdAt: m.timestamp || m.createdAt || new Date().toISOString(),
  media: m.mediaUrl ? {
    type: m.mediaType || 'image',
    url: m.mediaUrl
  } : undefined,
  reactions: m.reaction ? [m.reaction] : [],
  starred: m.starred || false,
  pinned: m.pinned || false,
  replyTo: m.replyToId ? {
    id: m.replyToId,
    content: m.replyToContent || '',
    senderName: m.replyToSender || ''
  } : undefined,
  waMessageId: m.id,
});

export const CrmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load state with localStorage persistence across refreshes
  const [users, setUsers] = useState<User[]>(() => {
    const deletedUserIds = getStored<string[]>('rw_crm_deleted_users', []);
    const stored = getStored<User[]>('rw_crm_users', INITIAL_USERS);
    const filteredStored = stored.filter(u => !deletedUserIds.includes(u.id));
    const merged = [...filteredStored];
    for (const initU of INITIAL_USERS) {
      if (deletedUserIds.includes(initU.id)) continue;
      const existingIdx = merged.findIndex(u => u.id === initU.id);
      if (existingIdx === -1) {
        merged.push(initU);
      } else {
        // preserve password and pin defaults if missing
        merged[existingIdx] = {
          ...initU,
          ...merged[existingIdx],
          password: merged[existingIdx].password || initU.password,
          pin: merged[existingIdx].pin || initU.pin,
        };
      }
    }
    const filteredUsers = merged.filter(u => 
      !['6186a081-c8be-40c2-ad05-fc8faba514fe', 'f84ff967-3c72-4d1f-888f-6c1c998e0f40', '5dab2d42-2041-4e58-9b9f-28f73f58b8b4'].includes(u.id) &&
      !u.email.startsWith('admin_test_')
    );
    try {
      localStorage.setItem('rw_crm_users', JSON.stringify(filteredUsers));
    } catch (e) {}
    return filteredUsers.map(u => ({
      ...u,
      branch: u.branch || 'Colombo',
      company: u.role === 'leads_officer' ? undefined : (u.company || 'RWC'),
      roleTitle: u.role === 'super_admin' ? 'Super Admin' : (u.role === 'leads_officer' ? 'Leads Officer' : (u.company === 'CRAS' ? 'Education Counsellor' : 'Patient Coordinator')),
    }));
  });

  // Stored browser data is only a restoration hint. Authentication becomes true
  // after /api/auth/session verifies the bearer token and resolves the user server-side.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const authId = localStorage.getItem('rw_crm_auth_user_id');
    const storedUsers = getStored<User[]>('rw_crm_users', INITIAL_USERS);
    if (authId) {
      const match = storedUsers.find(u => u.id === authId);
      if (match) return match;
    }
    return storedUsers[0] || INITIAL_USERS[0];
  });
  const [categories, setCategories] = useState<TreatmentCategory[]>(INITIAL_CATEGORIES);
  const [treatments, setTreatments] = useState<Treatment[]>(INITIAL_TREATMENTS);
  const [courses, setCourses] = useState<Treatment[]>(() => {
    const stored = getStored<Treatment[]>('rw_crm_courses', []);
    return stored.length > 0 ? stored : INITIAL_TREATMENTS.filter(t => t.company === 'CRAS');
  });
  const [stages, setStages] = useState<LeadStageConfig[]>(() => getStored('rw_crm_stages', DEFAULT_STAGES));
  const [superAdmins, setSuperAdmins] = useState<User[]>(() => {
    const storedUsers = getStored<User[]>('rw_crm_users', INITIAL_USERS);
    return storedUsers.filter(u => 
      u.role === 'super_admin' && 
      !['6186a081-c8be-40c2-ad05-fc8faba514fe', 'f84ff967-3c72-4d1f-888f-6c1c998e0f40', '5dab2d42-2041-4e58-9b9f-28f73f58b8b4'].includes(u.id) &&
      !u.email.startsWith('admin_test_')
    );
  });
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(INITIAL_TEMPLATES);
  const [sequences, setSequences] = useState<FollowupSequence[]>(INITIAL_SEQUENCES);
  
  const [customers, setCustomers] = useState<Customer[]>(() => getStored('rw_crm_customers', []));
  const [leads, setLeads] = useState<Lead[]>(() => getStored('rw_crm_leads', []));
  // Starts empty: messages are loaded from the paginated API rather than a cached
  // localStorage copy, which is removed below so existing bloat is reclaimed.
  const [messages, setMessages] = useState<Message[]>([]);
  // Cursor for walking backwards through older conversation history.
  const [messagesCursor, setMessagesCursor] = useState<string | null>(null);
  // Reclaim quota from previous versions that mirrored the full message history.
  useEffect(() => {
    try { localStorage.removeItem('rw_crm_messages'); } catch { /* ignore */ }
  }, []);

  const [followups, setFollowups] = useState<Followup[]>(() => getStored('rw_crm_followups', INITIAL_FOLLOWUPS));
  const [notes, setNotes] = useState<LeadNote[]>(() => getStored('rw_crm_notes', INITIAL_NOTES));
  const [stageHistories, setStageHistories] = useState<LeadStageHistory[]>(() => getStored('rw_crm_stage_histories', INITIAL_STAGE_HISTORY));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => getStored('rw_crm_audit_logs', INITIAL_AUDIT_LOGS));
  const [broadcasts, setBroadcasts] = useState<TeamBroadcast[]>(() => getStored('rw_crm_broadcasts', []));
  const [readBroadcastIds, setReadBroadcastIds] = useState<string[]>(() => {
    const authId = localStorage.getItem('rw_crm_auth_user_id') || 'user-admin-1';
    return getStored<string[]>(`rw_crm_read_broadcasts_${authId}`, []);
  });

  // Navigation & Chat list filter state
  const [activeNavTab, setActiveNavTab] = useState<NavTab>('dashboard');
  const [chatListFilter, setChatListFilter] = useState<string>('all');

  // Light / Dark Theme state (default to light theme as requested, persist in localStorage)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('rw_crm_theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return 'light';
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    localStorage.setItem('rw_crm_theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
    }
  }, [theme]);

  // Track per-user conversation read timestamps
  const [userReadTimestamps, setUserReadTimestamps] = useState<Record<string, number>>(() => {
    const authId = currentUser?.id || localStorage.getItem('rw_crm_auth_user_id') || 'user-admin-1';
    return getStored<Record<string, number>>(`rw_crm_read_leads_${authId}`, {});
  });

  // Re-sync read timestamps when switching user accounts
  useEffect(() => {
    if (currentUser?.id) {
      const stored = getStored<Record<string, number>>(`rw_crm_read_leads_${currentUser.id}`, {});
      setUserReadTimestamps(stored);
    }
  }, [currentUser?.id]);
  
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(() => {
    const cachedLeads = getStored<Lead[]>('rw_crm_leads', []);
    const cachedUser = getStored<User | null>('rw_crm_user', null);
    if (cachedUser && cachedUser.role === 'coordinator') {
      const myLeads = cachedLeads.filter(l => l.assignedTo === cachedUser.id);
      return myLeads.length > 0 ? myLeads[0].id : null;
    }
    return cachedLeads.length > 0 ? cachedLeads[0].id : null;
  });
  const [notifications, setNotifications] = useState<NotificationToast[]>([]);
  const [simulatorOpen, setSimulatorOpen] = useState<boolean>(false);
  const [replyingMessage, setReplyingMessage] = useState<Message | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppConnectionStatus>('connecting');
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [hasMetaConfig, setHasMetaConfig] = useState<boolean>(() => 
    Boolean(localStorage.getItem('rw_has_meta_config') === 'true')
  );
  const initialLeadLoadedRef = useRef<boolean>(false);

  const [authToken, setAuthToken] = useState<string>(() => {
    return localStorage.getItem('rw_crm_auth_token') || '';
  });

  const getAuthToken = (): string => {
    return authToken || localStorage.getItem('rw_crm_auth_token') || '';
  };

  const ensureValidAuthToken = async (): Promise<string> => {
    let token = localStorage.getItem('rw_crm_auth_token') || authToken || '';
    let isExpired = false;
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 2) {
          const payloadStr = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
          const payload = JSON.parse(payloadStr);
          if (payload.exp && Date.now() > payload.exp - 60000) {
            isExpired = true;
          }
        } else {
          isExpired = true;
        }
      } catch (e) {
        isExpired = true;
      }
    }

    // Never renew with cached credentials or a default administrator account.
    // An expired session must be re-authenticated interactively.
    return !token || isExpired ? '' : token;
  };

  const clearAuthenticatedSession = useCallback(() => {
    setIsAuthenticated(false);
    setAuthToken('');
    localStorage.removeItem('rw_crm_auth_user_id');
    localStorage.removeItem('rw_crm_auth_token');
    localStorage.removeItem('royal_crm_token');
    localStorage.removeItem('rw_crm_auth_user');
    localStorage.removeItem('rw_crm_current_user');
    setSelectedLeadId(null);
    setMessages([]);
    setMessagesCursor(null);
    setLeads([]);
    setCustomers([]);
    setFollowups([]);
    setNotes([]);
    setStageHistories([]);
    setReadBroadcastIds([]);
  }, []);

  const verifyServerSession = useCallback(async (token: string): Promise<User | null> => {
    if (!token) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/session`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return null;
      const payload = await response.json();
      const user = payload?.user;
      if (!user?.id || !user?.email || !user?.fullName || !user?.role) return null;
      return {
        ...user,
        active: true,
        branch: user.branch || 'Colombo',
        company: user.role === 'leads_officer' ? undefined : (user.company || 'RWC'),
        roleTitle: user.role === 'super_admin' ? 'Super Admin' : (user.role === 'leads_officer' ? 'Leads Officer' : (user.company === 'CRAS' ? 'Education Counsellor' : 'Patient Coordinator'))
      } as User;
    } catch {
      return null;
    }
  }, []);

  // Restore only a server-verified session. A stale or inaccessible token leaves
  // the CRM on the sign-in screen instead of rendering cached staff data.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const token = localStorage.getItem('rw_crm_auth_token') || '';
      const user = await verifyServerSession(token);
      if (cancelled) return;
      if (!user) {
        clearAuthenticatedSession();
        return;
      }
      setAuthToken(token);
      setCurrentUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('rw_crm_auth_user_id', user.id);
    };
    restore();
    return () => { cancelled = true; };
  }, [clearAuthenticatedSession, verifyServerSession]);

  // Desktop Notification Settings & Active Popups
  const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    enabled: true,
    sound: true,
    nativeBrowser: true, // Enabled by default so Windows desktop alerts fire when browser allows
    showPreview: true,
    autoDismissSeconds: 8,
  };

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    return getStored<NotificationSettings>('rw_crm_notification_settings', DEFAULT_NOTIFICATION_SETTINGS);
  });
  const notificationSettingsRef = useRef<NotificationSettings>(notificationSettings);
  useEffect(() => {
    notificationSettingsRef.current = notificationSettings;
    try {
      localStorage.setItem('rw_crm_notification_settings', JSON.stringify(notificationSettings));
    } catch (e) {}
  }, [notificationSettings]);

  // Register Service Worker for reliable Windows Action Center notifications in background tabs
  useEffect(() => {
    registerNotificationServiceWorker();

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE_TO_LEAD' && event.data?.leadId) {
        setSelectedLeadId(event.data.leadId);
      }
    };

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }
    return () => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  const [desktopNotifications, setDesktopNotifications] = useState<DesktopNotificationItem[]>([]);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState<boolean>(false);

  const dismissDesktopNotification = useCallback((id: string) => {
    setDesktopNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const updateNotificationSettings = useCallback((updates: Partial<NotificationSettings>) => {
    setNotificationSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const dispatchDesktopNotification = useCallback((item: DesktopNotificationItem) => {
    setDesktopNotifications(prev => {
      const filtered = prev.filter(n => n.leadId !== item.leadId);
      return [item, ...filtered].slice(0, 3);
    });

    if (notificationSettingsRef.current.autoDismissSeconds > 0) {
      setTimeout(() => {
        setDesktopNotifications(prev => prev.filter(n => n.id !== item.id));
      }, notificationSettingsRef.current.autoDismissSeconds * 1000);
    }
  }, []);

  const dispatchTestNotification = useCallback(() => {
    if (notificationSettingsRef.current.sound) {
      playWhatsAppChime();
    }
    const testItem: DesktopNotificationItem = {
      id: 'test-notif-' + Date.now(),
      leadId: selectedLeadIdRef.current || 'lead-demo-test',
      customerId: 'cust-demo-test',
      contactName: 'Ameera Jasmine',
      contactPhone: '+94 77 123 4567',
      avatarUrl: undefined,
      messageText: notificationSettingsRef.current.showPreview 
        ? 'Hello! I would like to book a consultation for tomorrow morning please. 🌿' 
        : 'New WhatsApp message',
      timestamp: new Date().toISOString(),
      timeDisplay: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unreadCount: 1,
      company: 'RWC',
    };
    dispatchDesktopNotification(testItem);

    if (notificationSettingsRef.current.nativeBrowser && 'Notification' in window && Notification.permission === 'granted') {
      showDesktopNativeNotification('Ameera Jasmine (WhatsApp)', {
        body: testItem.messageText,
        icon: testItem.avatarUrl || '/logo.png',
        badge: '/favicon.png',
        leadId: testItem.leadId,
        tag: 'test-notification',
        onClick: () => {
          window.focus();
          if (selectedLeadIdRef.current) setSelectedLeadId(selectedLeadIdRef.current);
        }
      });
    }
  }, [dispatchDesktopNotification]);

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('rw_crm_customers', JSON.stringify(customers));
    } catch (e) {}
  }, [customers]);

  useEffect(() => {
    try {
      localStorage.setItem('rw_crm_leads', JSON.stringify(leads));
    } catch (e) {}
  }, [leads]);

  // Conversation history is intentionally NOT mirrored to localStorage: it grows
  // without bound and reliably blows the ~5 MB quota on long-lived accounts.
  // Messages are re-fetched from the paginated API on load instead.

  // Sync users to localStorage
  useEffect(() => {
    localStorage.setItem('rw_crm_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('rw_crm_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('rw_crm_stage_histories', JSON.stringify(stageHistories));
  }, [stageHistories]);

  // Simulator state. Lazy initializer: `Math.random()` during render is impure (the
  // session id would differ between renders under the React Compiler), so it runs once
  // on first mount instead.
  const [simulatorSession, setSimulatorSession] = useState<OnboardingSession>(() => ({
    waId: '+9470' + Math.floor(1000000 + Math.random() * 9000000),
    name: 'WhatsApp Tester',
    state: 'AwaitingLanguage',
    updatedAt: new Date().toISOString(),
  }));

  // Automatically remove any legacy mock/fake leads on initial load
  useEffect(() => {
    const isMockLead = (l: Lead) => {
      const name = l.customer?.displayName?.toLowerCase() || '';
      const phone = l.customer?.whatsappNumber || '';
      return (
        l.id === 'lead-1' ||
        l.id === 'lead-2' ||
        l.id === 'lead-3' ||
        name.includes('kasun bandara') ||
        phone === '+94770001122' ||
        phone === '+94771234567'
      );
    };

    const hasMock = leads.some(isMockLead);
    if (hasMock) {
      const cleanLeads = leads.filter(l => !isMockLead(l));
      const cleanLeadIds = new Set(cleanLeads.map(l => l.id));
      setLeads(cleanLeads);
      setMessages(prev => prev.filter(m => cleanLeadIds.has(m.leadId)));
      setFollowups(prev => prev.filter(f => cleanLeadIds.has(f.leadId)));
      setNotes(prev => prev.filter(n => cleanLeadIds.has(n.leadId)));
      setStageHistories(prev => prev.filter(sh => cleanLeadIds.has(sh.leadId)));
      if (selectedLeadId && !cleanLeadIds.has(selectedLeadId)) {
        setSelectedLeadId(cleanLeads[0]?.id || null);
      }
    }

    // Auto-normalize any multi-reaction messages to strictly single reaction
    setMessages(prev => {
      let changed = false;
      const normalized = prev.map(m => {
        if (m.reactions && m.reactions.length > 1) {
          changed = true;
          return { ...m, reactions: [m.reactions[m.reactions.length - 1]] };
        }
        return m;
      });
      return changed ? normalized : prev;
    });
  }, []);

  // Automatically load persistent conversation history, leads, coordinators, and Meta configuration
  const fetchInitialData = async () => {
    try {
      const token = await ensureValidAuthToken();
      const authHeaders = {
        'Authorization': token ? `Bearer ${token}` : '',
      };

      // Paginated fetch: lead summaries + the most recent message page only.
      // Older history is loaded on demand (see loadOlderMessages).
      const [leadsRes, msgsRes, metaRes, coordsRes, broadcastsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/leads?paginate=1&pageSize=200`, { headers: authHeaders }).catch(() => null),
        fetch(`${API_BASE_URL}/api/messages?paginate=1&limit=200`, { headers: authHeaders }).catch(() => null),
        fetch(`${API_BASE_URL}/api/meta/config`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/coordinators`, { headers: authHeaders }).catch(() => null),
        fetch(`${API_BASE_URL}/api/broadcasts`, { headers: authHeaders }).catch(() => null)
      ]);

      // Dynamic Catalogs & Stage Config Fetch
      fetchStages().catch(() => null);
      fetchCourses().catch(() => null);
      fetchTreatments().catch(() => null);
      if (currentUser?.role === 'super_admin') {
        fetchSuperAdmins().catch(() => null);
      }

      if (broadcastsRes && broadcastsRes.ok) {
        const bData = await broadcastsRes.json().catch(() => null);
        if (bData && Array.isArray(bData.broadcasts)) {
          setBroadcasts(bData.broadcasts);
          localStorage.setItem('rw_crm_broadcasts', JSON.stringify(bData.broadcasts));
        }
      }

      if (metaRes && metaRes.ok) {
        const metaData = await metaRes.json().catch(() => null);
        if (metaData && (metaData.hasToken || metaData.accessToken)) {
          setHasMetaConfig(true);
          localStorage.setItem('rw_has_meta_config', 'true');
        } else {
          setHasMetaConfig(false);
          localStorage.setItem('rw_has_meta_config', 'false');
        }
      }

      if (coordsRes && coordsRes.ok) {
        const dbCoords: any[] = await coordsRes.json().catch(() => []);
        if (Array.isArray(dbCoords)) {
          const deletedUserIds = getStored<string[]>('rw_crm_deleted_users', []);
          const userMap = new Map<string, User>();
          
          // Ensure Super Admin is always present
          const superAdmin = INITIAL_USERS.find(u => u.role === 'super_admin') || INITIAL_USERS[0];
          userMap.set(superAdmin.id, superAdmin);

          // Add initial users only if they have not been deleted
          INITIAL_USERS.forEach(u => {
            if (!deletedUserIds.includes(u.id)) {
              userMap.set(u.id, u);
            }
          });

          // PRESERVE locally stored staff members across refresh
          const storedLocalUsers = getStored<User[]>('rw_crm_users', []);
          storedLocalUsers.forEach(u => {
            if (!deletedUserIds.includes(u.id) && u.active !== false) {
              userMap.set(u.id, u);
            }
          });

          // Add backend coordinators from Supabase (authoritative cloud sync)
          dbCoords.forEach(u => {
            if (deletedUserIds.includes(u.id) || u.active === false) return;
            const isSuper = u.role === 'super_admin' || u.id === 'user-admin-1';
            const existingLocal = userMap.get(u.id);
            userMap.set(u.id, {
              ...existingLocal,
              ...u,
              branch: u.branch || existingLocal?.branch || 'Colombo',
              company: u.role === 'leads_officer' ? undefined : (u.company || existingLocal?.company || 'RWC'),
              roleTitle: u.role === 'super_admin' ? 'Super Admin' : (u.role === 'leads_officer' ? 'Leads Officer' : (u.company === 'CRAS' ? 'Education Counsellor' : 'Patient Coordinator')),
              password: u.password || existingLocal?.password || (isSuper ? 'admin' : 'staff'),
              pin: u.pin || existingLocal?.pin || (isSuper ? '1234' : '2026'),
              active: u.active ?? true,
              activeLeadsCount: u.activeLeadsCount || existingLocal?.activeLeadsCount || 0
            });
          });

          const updatedUsers = Array.from(userMap.values()).filter(u => !deletedUserIds.includes(u.id));
          setUsers(updatedUsers);
          localStorage.setItem('rw_crm_users', JSON.stringify(updatedUsers));
        }
      }

      let fetchedDbLeads: any[] = [];
      if (leadsRes && leadsRes.ok) {
        const leadsPayload = await leadsRes.json().catch(() => []);
        fetchedDbLeads = Array.isArray(leadsPayload) ? leadsPayload : (leadsPayload?.leads || []);
        if (Array.isArray(fetchedDbLeads)) {
          const dbCustomers: Customer[] = [];
          const hydratedLeads: Lead[] = [];

          fetchedDbLeads.forEach(l => {
            let finalCust: Customer | undefined = undefined;
            if (l.customer) {
              const rawCust = l.customer;
              const cleanDigits = getCleanWhatsAppDigits(rawCust.whatsappNumber);
              const canonicalPhone = normalizeWhatsAppNumber(rawCust.whatsappNumber);
              const displayPhone = formatWhatsAppDisplay(canonicalPhone || rawCust.whatsappNumber);
              finalCust = {
                id: rawCust.id,
                whatsappNumber: canonicalPhone || rawCust.whatsappNumber,
                phoneNumber: displayPhone,
                whatsappId: rawCust.whatsappId || cleanDigits,
                displayName: rawCust.displayName || 'WhatsApp Contact',
                avatarUrl: rawCust.avatarUrl,
                preferredLanguage: rawCust.preferredLanguage || 'en',
                createdAt: rawCust.createdAt || new Date().toISOString(),
              };
              dbCustomers.push(finalCust);
            }

            const comp = getLeadCompany(l);
            hydratedLeads.push({
              ...l,
              serialNumber: l.serialNumber || undefined,
              assignedTo: l.assignedTo || undefined,
              assignedById: l.assignedById || undefined,
              assignedByName: l.assignedByName || undefined,
              assignedAt: l.assignedAt || undefined,
              assignmentHistories: l.assignmentHistories || undefined,
              stage: l.stage || 'new',
              customer: finalCust,
              company: comp.code,
              companyTag: comp.tag,
              companyColor: comp.color,
              companyPhoneNumberId: l.companyPhoneNumberId || comp.phoneId,
              companyPhoneNumber: l.companyPhoneNumber || comp.phone
            });
          });

          // Single Source of Truth from Supabase: Replace local arrays directly
          setCustomers(dbCustomers);
          localStorage.setItem('rw_crm_customers', JSON.stringify(dbCustomers));

          setLeads(hydratedLeads);
          localStorage.setItem('rw_crm_leads', JSON.stringify(hydratedLeads));

          setSelectedLeadId(prevId => {
            const isOfficerOrAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'leads_officer';
            const allowedLeads = isOfficerOrAdmin
              ? hydratedLeads
              : hydratedLeads.filter(l => l.assignedTo === currentUser?.id);

            if (prevId && allowedLeads.some(l => l.id === prevId)) return prevId;
            // Only auto-select first lead on initial boot, preserve closed chat if user closed it
            if (!initialLeadLoadedRef.current) {
              initialLeadLoadedRef.current = true;
              return allowedLeads[0]?.id || null;
            }
            return null;
          });
        }
      }

      // Leads no longer embed their message history; the conversation comes from the
      // paginated message endpoint.
      const collectedRawMessages: any[] = [];

      if (msgsRes && msgsRes.ok) {
        const msgsPayload = await msgsRes.json().catch(() => []);
        const dbMessages: any[] = Array.isArray(msgsPayload) ? msgsPayload : (msgsPayload?.messages || []);
        if (Array.isArray(dbMessages)) {
          dbMessages.forEach((m: any) => collectedRawMessages.push(m));
        }
        if (!Array.isArray(msgsPayload) && msgsPayload?.nextCursor) {
          setMessagesCursor(msgsPayload.nextCursor);
        }
      }

      const msgMap = new Map<string, Message>();
      collectedRawMessages
        .filter(m => (m.content && m.content.trim().length > 0) || Boolean(m.mediaUrl))
        .forEach(m => {
          const formatted = toClientMessage(m);
          msgMap.set(formatted.id, formatted);
        });

      if (collectedRawMessages.length > 0) {
        const finalMessages = Array.from(msgMap.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setMessages(finalMessages);
      } else {
        console.warn('⚠️ No messages collected from backend; preserving in-memory conversation state');
      }
    } catch (e) {
      console.warn('Could not fetch persistent database state:', e);
    }
  };

  // Loads one older page of conversation history using the server cursor.
  // Messages are merged by id so nothing is duplicated or dropped when new
  // messages arrive over SSE while a page is in flight.
  const loadOlderMessages = async () => {
    if (!messagesCursor) return false;
    try {
      const token = await ensureValidAuthToken();
      const res = await fetch(
        `${API_BASE_URL}/api/messages?paginate=1&limit=200&before=${encodeURIComponent(messagesCursor)}`,
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
      if (!res.ok) return false;
      const payload = await res.json().catch(() => null);
      const older: any[] = payload?.messages || [];
      setMessagesCursor(payload?.nextCursor || null);
      if (older.length === 0) return false;

      setMessages(prev => {
        const byId = new Map(prev.map(m => [m.id, m]));
        older.forEach(m => {
          if (!byId.has(m.id)) byId.set(m.id, toClientMessage(m));
        });
        return Array.from(byId.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
      return Boolean(payload?.hasMore);
    } catch (e) {
      console.warn('Could not load older messages:', e);
      return false;
    }
  };

  // Hydrate only after a server-verified session exists. This prevents unauthenticated
  // requests and stops one user's cached records being displayed to another user.
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchInitialData();

    // Fetch this coordinator's specific WhatsApp line status
    const fetchMyStatus = async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_BASE_URL}/api/status?coordinatorId=${currentUser.id}`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status) {
            setWhatsappStatus(data.status);
          }
        }
      } catch (e) {}
    };

    fetchMyStatus();

    // Sync Meta API status from backend
    fetch(`${API_BASE_URL}/api/meta/config`)
      .then(res => res.json())
      .then(data => {
        if (data.hasToken || data.accessToken) {
          setHasMetaConfig(true);
          localStorage.setItem('rw_has_meta_config', 'true');
        } else {
          setHasMetaConfig(false);
          localStorage.setItem('rw_has_meta_config', 'false');
        }
        if (currentUser?.role !== 'super_admin') {
          localStorage.removeItem('meta_access_token');
        }
      })
      .catch(() => {});
  }, [currentUser?.id, isAuthenticated]);

  const isSuperAdmin = currentUser.role === 'super_admin';
  const isLeadsOfficer = currentUser.role === 'leads_officer';
  const isCoordinator = currentUser.role === 'coordinator';
  const canAssignLeads = isSuperAdmin || isLeadsOfficer;

  // Role-based reassignment & assignment locking permissions
  const canReassignLead = (_lead?: Lead): boolean => {
    return isSuperAdmin;
  };

  const canModifyAssignment = (lead?: Lead): boolean => {
    if (isSuperAdmin) return true;
    if (isLeadsOfficer) {
      // Leads Officers can ONLY assign if the lead is not currently assigned
      return !lead || !lead.assignedTo;
    }
    return false;
  };

  // Strict isolation: if a coordinator has an unassigned lead or someone else's lead selected, reset it
  useEffect(() => {
    if (isCoordinator && selectedLeadId) {
      const target = leads.find(l => l.id === selectedLeadId);
      if (!target || target.assignedTo !== currentUser.id) {
        const myLeads = leads.filter(l => l.assignedTo === currentUser.id);
        setSelectedLeadId(myLeads.length > 0 ? myLeads[0].id : null);
      }
    }
  }, [currentUser.id, currentUser.role, leads, selectedLeadId, isCoordinator]);

  const selectedLeadIdRef = useRef<string | null>(selectedLeadId);
  useEffect(() => {
    selectedLeadIdRef.current = selectedLeadId;
  }, [selectedLeadId]);

  const leadsRef = useRef<Lead[]>(leads);
  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  const customersRef = useRef<Customer[]>(customers);
  useEffect(() => {
    customersRef.current = customers;
  }, [customers]);

  // Listen to real-time inbound & phone outbound WhatsApp messages from Webhook / Baileys server scoped to current user
  useEffect(() => {
    let eventSource: EventSource | null = null;
    const handledMsgIds = new Set<string>();

    try {
      const token = getAuthToken();
      if (!token) {
        return;
      }
      const connectSse = async () => {
        const ticketResponse = await fetch(`${API_BASE_URL}/api/events/ticket`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        const ticketData = await ticketResponse.json();
        if (!ticketResponse.ok || !ticketData?.ticket) return;
        eventSource = new EventSource(`${API_BASE_URL}/api/events?ticket=${encodeURIComponent(ticketData.ticket)}`);
      
      eventSource!.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'CONNECTION_STATUS') {
            if (data.status) {
              setWhatsappStatus(data.status);
            }
            return;
          }

          if (data.type === 'STAGE_CONFIG_UPDATED') {
            fetchStages();
            return;
          }

          if (data.type === 'COURSE_CONFIG_UPDATED') {
            fetchCourses();
            fetchTreatments();
            return;
          }

          if (data.type === 'TREATMENT_CONFIG_UPDATED') {
            fetchTreatments();
            return;
          }

          if (data.type === 'SUPER_ADMIN_CONFIG_UPDATED') {
            fetchSuperAdmins();
            return;
          }

          if (data.type === 'META_CONFIG_UPDATED') {
            const hasToken = Boolean(data.hasToken);
            setHasMetaConfig(hasToken);
            localStorage.setItem('rw_has_meta_config', String(hasToken));
            if (currentUser?.role !== 'super_admin') {
              localStorage.removeItem('meta_access_token');
            }
            return;
          }

          if (data.type === 'MESSAGE_STATUS_UPDATE') {
            const { messageId, status, errorCode, errorMessage, deliveredAt, readAt, sentAt } = data;
            console.log('🔄 [SSE Message Status Update]:', messageId, status, errorCode, errorMessage);
            setMessages(prev => prev.map(m => {
              const isMatch = m.id === messageId || m.waMessageId === messageId ||
                (m.id.startsWith('msg-') && m.direction === 'outbound' && data.leadId && m.leadId === data.leadId);
              if (isMatch) {
                // Out-of-order & duplicate guard (pending: 0 < sent: 1 < delivered: 2 < read: 3)
                const STATUS_RANK = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 0 };
                const currentRank = STATUS_RANK[m.status as keyof typeof STATUS_RANK] || 0;
                const newRank = STATUS_RANK[status as keyof typeof STATUS_RANK] || 0;

                // Do not allow older state or late failure to overwrite confirmed delivery/reading
                const shouldUpdateStatus = status === 'failed' ? currentRank < 2 : newRank >= currentRank;

                return {
                  ...m,
                  id: (m.id.startsWith('msg-') && messageId) ? messageId : m.id,
                  waMessageId: messageId || m.waMessageId,
                  status: shouldUpdateStatus ? (status as any) : m.status,
                  errorCode: errorCode !== undefined ? errorCode : m.errorCode,
                  errorMessage: errorMessage !== undefined ? errorMessage : m.errorMessage,
                  sentAt: sentAt || m.sentAt,
                  deliveredAt: deliveredAt || m.deliveredAt,
                  readAt: readAt || m.readAt
                };
              }
              return m;
            }));

            // Also synchronize with l.messages if lead holds messages array
            setLeads(prevLeads => prevLeads.map(l => {
              if (l.id === data.leadId || (Array.isArray((l as any).messages) && (l as any).messages.some((m: any) => m.id === messageId || m.waMessageId === messageId))) {
                return {
                  ...l,
                  messages: Array.isArray((l as any).messages) ? (l as any).messages.map((m: any) => {
                    if (m.id === messageId || m.waMessageId === messageId) {
                      return {
                        ...m,
                        status,
                        deliveredAt: deliveredAt || m.deliveredAt,
                        readAt: readAt || m.readAt
                      };
                    }
                    return m;
                  }) : undefined
                };
              }
              return l;
            }));

            if (status === 'failed' && errorMessage) {
              notify('Delivery Failed', errorMessage, 'warning');
            }
            return;
          }

          if (data.type === 'LEAD_ASSIGNED') {
            const { leadId: incomingLeadId, clientLeadId, coordinatorId: assignedCoordId, lead: incomingLead } = data;
            setLeads(prevLeads => {
              const matchIdx = prevLeads.findIndex(l => 
                l.id === incomingLeadId || 
                (clientLeadId && l.id === clientLeadId) || 
                (incomingLead && l.id === incomingLead.id) ||
                (incomingLead?.customerId && l.customerId === incomingLead.customerId)
              );
              if (matchIdx !== -1) {
                // If current user is coordinator and lead reassigned to someone else, remove it immediately
                if (currentUser?.role === 'coordinator' && assignedCoordId !== currentUser?.id) {
                  return prevLeads.filter((_, idx) => idx !== matchIdx);
                }
                const nextLeads = [...prevLeads];
                nextLeads[matchIdx] = {
                  ...nextLeads[matchIdx],
                  id: incomingLead?.id || nextLeads[matchIdx].id,
                  assignedTo: assignedCoordId || undefined,
                  assignedById: incomingLead?.assignedById || nextLeads[matchIdx].assignedById,
                  assignedByName: incomingLead?.assignedByName || nextLeads[matchIdx].assignedByName,
                  assignedAt: incomingLead?.assignedAt || nextLeads[matchIdx].assignedAt,
                  assignmentHistories: incomingLead?.assignmentHistories || nextLeads[matchIdx].assignmentHistories,
                  stage: assignedCoordId ? (nextLeads[matchIdx].stage === 'new' ? 'assigned' : nextLeads[matchIdx].stage) : 'new',
                  updatedAt: new Date().toISOString(),
                };
                return nextLeads;
              } else if (incomingLead && (currentUser?.role === 'super_admin' || currentUser?.role === 'leads_officer' || assignedCoordId === currentUser?.id)) {
                return [incomingLead, ...prevLeads];
              }
              return prevLeads;
            });
            return;
          }

          if (data.type === 'LEAD_UNASSIGNED') {
            const { leadId: unassignedLeadId, previousCoordinatorId, reassignedTo } = data;
            if (currentUser?.role === 'coordinator' && previousCoordinatorId === currentUser?.id && reassignedTo !== currentUser?.id) {
              setLeads(prevLeads => prevLeads.filter(l => l.id !== unassignedLeadId));
              if (selectedLeadIdRef.current === unassignedLeadId) {
                setSelectedLeadId(null);
              }
            }
            return;
          }

          if (data.type === 'LEAD_UPDATED') {
            const { leadId: incomingLeadId, lead: incomingLead } = data;
            setLeads(prevLeads => {
              return prevLeads.map(l => {
                if (l.id === incomingLeadId || (incomingLead && l.id === incomingLead.id)) {
                  return {
                    ...l,
                    treatmentId: incomingLead?.treatmentId !== undefined ? (incomingLead.treatmentId || undefined) : l.treatmentId,
                    categoryId: incomingLead?.categoryId !== undefined ? (incomingLead.categoryId || undefined) : l.categoryId,
                    serialNumber: incomingLead?.serialNumber !== undefined ? (incomingLead.serialNumber || undefined) : l.serialNumber,
                    stage: incomingLead?.stage !== undefined ? incomingLead.stage : l.stage,
                    assignedTo: incomingLead?.assignedTo !== undefined ? (incomingLead.assignedTo || undefined) : l.assignedTo,
                    assignedById: incomingLead?.assignedById !== undefined ? (incomingLead.assignedById || undefined) : l.assignedById,
                    assignedByName: incomingLead?.assignedByName !== undefined ? (incomingLead.assignedByName || undefined) : l.assignedByName,
                    assignedAt: incomingLead?.assignedAt !== undefined ? (incomingLead.assignedAt || undefined) : l.assignedAt,
                    assignmentHistories: incomingLead?.assignmentHistories !== undefined ? incomingLead.assignmentHistories : l.assignmentHistories,
                    company: incomingLead?.company !== undefined ? incomingLead.company : l.company,
                    companyTag: incomingLead?.companyTag !== undefined ? incomingLead.companyTag : l.companyTag,
                    companyColor: incomingLead?.companyColor !== undefined ? incomingLead.companyColor : l.companyColor,
                    companyPhoneNumberId: incomingLead?.companyPhoneNumberId !== undefined ? incomingLead.companyPhoneNumberId : l.companyPhoneNumberId,
                    companyPhoneNumber: incomingLead?.companyPhoneNumber !== undefined ? incomingLead.companyPhoneNumber : l.companyPhoneNumber,
                    updatedAt: new Date().toISOString()
                  };
                }
                return l;
              });
            });
            return;
          }

          if (data.type === 'COORDINATOR_DELETED') {
            const { coordinatorId: deletedCoordId } = data;
            if (deletedCoordId) {
              const deletedIds = getStored<string[]>('rw_crm_deleted_users', []);
              if (!deletedIds.includes(deletedCoordId)) {
                localStorage.setItem('rw_crm_deleted_users', JSON.stringify([...deletedIds, deletedCoordId]));
              }
              setUsers(prev => {
                const filtered = prev.filter(u => u.id !== deletedCoordId);
                localStorage.setItem('rw_crm_users', JSON.stringify(filtered));
                return filtered;
              });
              setLeads(prev => prev.map(l => {
                if (l.assignedTo === deletedCoordId) {
                  return {
                    ...l,
                    assignedTo: undefined,
                    stage: 'new',
                    updatedAt: new Date().toISOString()
                  };
                }
                return l;
              }));
            }
            return;
          }

          if (data.type === 'STAFF_CREATED' || data.type === 'COORDINATOR_CREATED') {
            const incomingUser = data.user;
            if (incomingUser && incomingUser.id) {
              const deletedIds = getStored<string[]>('rw_crm_deleted_users', []);
              if (!deletedIds.includes(incomingUser.id)) {
                setUsers(prev => {
                  const existingIdx = prev.findIndex(u => u.id === incomingUser.id);
                  const isSuper = incomingUser.role === 'super_admin' || incomingUser.id === 'user-admin-1';
                  const roleTitle = incomingUser.role === 'super_admin' ? 'Super Admin' : (incomingUser.role === 'leads_officer' ? 'Leads Officer' : (incomingUser.company === 'CRAS' ? 'Education Counsellor' : 'Patient Coordinator'));
                  const safeUserItem: User = {
                    ...incomingUser,
                    branch: incomingUser.branch || 'Colombo',
                    company: incomingUser.role === 'leads_officer' ? undefined : (incomingUser.company || 'RWC'),
                    roleTitle,
                    password: incomingUser.password || (isSuper ? 'admin' : 'staff'),
                    pin: incomingUser.pin || (isSuper ? '1234' : '2026'),
                    active: incomingUser.active ?? true,
                    activeLeadsCount: incomingUser.activeLeadsCount || 0
                  };
                  let updatedList: User[];
                  if (existingIdx !== -1) {
                    updatedList = [...prev];
                    updatedList[existingIdx] = { ...prev[existingIdx], ...safeUserItem };
                  } else {
                    updatedList = [...prev, safeUserItem];
                  }
                  localStorage.setItem('rw_crm_users', JSON.stringify(updatedList));
                  return updatedList;
                });
              }
            }
            return;
          }

          if (data.type === 'MESSAGE_EDITED') {
            const { messageId, content } = data;
            if (messageId && content) {
              setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, edited: true } : m));
            }
            return;
          }

          if (data.type === 'INBOUND_WHATSAPP_MESSAGE' || data.type === 'OUTBOUND_WHATSAPP_MESSAGE') {
            // Skip empty protocol messages without text or media
            if ((!data.text || data.text.trim().length === 0) && !data.media) {
              return;
            }

            console.log('[CRM SSE DEBUG] event received:', data.type, 'message ID:', data.messageId, 'conversation ID:', data.leadId);
            const { phone, whatsappId, realPhone, name, avatarUrl, text, messageId, timestamp, direction, senderType, company, companyTag, companyColor, companyPhoneNumberId, companyPhoneNumber } = data;
            const isOutbound = direction === 'outbound' || data.type === 'OUTBOUND_WHATSAPP_MESSAGE';
            
            // Deduplicate at client level
            if (messageId && handledMsgIds.has(messageId)) return;
            if (messageId) handledMsgIds.add(messageId);

            // Normalize incoming customer phone & WhatsApp ID
            const rawNumber = realPhone || phone || '';
            const canonicalPhone = normalizeWhatsAppNumber(rawNumber);
            const cleanDigits = getCleanWhatsAppDigits(rawNumber || whatsappId || '');
            const displayPhone = formatWhatsAppDisplay(canonicalPhone || rawNumber);
            const rawWaId = whatsappId || cleanDigits;
            
            const cleanDisplayName = (!isOutbound && name && name.trim().length > 0 && !isHardwareLid(name) && !name.includes('You (Staff)') && !name.includes('Shiman Nafaas'))
              ? name 
              : (displayPhone || 'WhatsApp Contact');

            // Find matching customer and lead from current memory
            let resolvedCustomerId = data.customerId || '';
            let resolvedLeadId = data.leadId || '';

            const currentLeads = leadsRef.current || [];
            const currentCusts = customersRef.current || [];

            let matchedLead = currentLeads.find(l => {
              const lCustDigits = getCleanWhatsAppDigits(l.customer?.whatsappNumber);
              const lIdDigits = getCleanWhatsAppDigits(l.customer?.whatsappId);
              return (
                (resolvedLeadId && l.id === resolvedLeadId) ||
                (resolvedCustomerId && l.customerId === resolvedCustomerId) ||
                (cleanDigits && lCustDigits && (cleanDigits === lCustDigits || cleanDigits.includes(lCustDigits) || lCustDigits.includes(cleanDigits))) ||
                (rawWaId && l.customer?.whatsappId && (l.customer.whatsappId === rawWaId || lIdDigits === rawWaId)) ||
                (canonicalPhone && l.customer?.whatsappNumber && (l.customer.whatsappNumber === canonicalPhone || l.customer.whatsappNumber.includes(canonicalPhone))) ||
                (!isOutbound && cleanDisplayName && l.customer?.displayName && l.customer.displayName === cleanDisplayName)
              );
            });

            let matchedCust = currentCusts.find(c => {
              const cDigits = getCleanWhatsAppDigits(c.whatsappNumber);
              const cIdDigits = getCleanWhatsAppDigits(c.whatsappId);
              return (
                (resolvedCustomerId && c.id === resolvedCustomerId) ||
                (cleanDigits && cDigits && (cleanDigits === cDigits || cleanDigits.includes(cDigits) || cDigits.includes(cleanDigits))) ||
                (rawWaId && c.whatsappId && (c.whatsappId === rawWaId || cIdDigits === rawWaId)) ||
                (canonicalPhone && c.whatsappNumber && (c.whatsappNumber === canonicalPhone || c.whatsappNumber.includes(canonicalPhone))) ||
                (!isOutbound && cleanDisplayName && c.displayName && c.displayName === cleanDisplayName)
              );
            });

            if (matchedLead) {
              resolvedLeadId = matchedLead.id;
              resolvedCustomerId = matchedLead.customerId || resolvedCustomerId;
            } else if (matchedCust) {
              resolvedCustomerId = matchedCust.id;
            }

            if (!resolvedCustomerId) resolvedCustomerId = 'cust-' + Date.now();
            if (!resolvedLeadId) resolvedLeadId = 'lead-' + Date.now();

            // 1. Update/Create Customer
            setCustomers(prevCusts => {
              const exists = prevCusts.some(c => c.id === resolvedCustomerId);
              if (!exists) {
                const newCust: Customer = {
                  id: resolvedCustomerId,
                  whatsappNumber: canonicalPhone || rawNumber,
                  whatsappId: rawWaId,
                  phoneNumber: displayPhone,
                  displayName: cleanDisplayName,
                  avatarUrl: avatarUrl || undefined,
                  preferredLanguage: 'en',
                  createdAt: new Date().toISOString(),
                };
                return [newCust, ...prevCusts];
              } else {
                return prevCusts.map(c => {
                  if (c.id === resolvedCustomerId) {
                    const shouldUpdatePhone = canonicalPhone && (!c.whatsappNumber || isHardwareLid(c.whatsappNumber));
                    const shouldUpdateName = !isOutbound && name && name.trim().length > 0 && !isHardwareLid(name) && !name.includes('You (Staff)') && !name.includes('Shiman Nafaas');
                    return {
                      ...c,
                      whatsappNumber: shouldUpdatePhone ? canonicalPhone : (c.whatsappNumber || canonicalPhone),
                      whatsappId: rawWaId || c.whatsappId,
                      phoneNumber: shouldUpdatePhone ? displayPhone : (c.phoneNumber || displayPhone),
                      displayName: shouldUpdateName ? name : (c.displayName && !isHardwareLid(c.displayName) ? c.displayName : cleanDisplayName),
                      avatarUrl: avatarUrl || c.avatarUrl
                    };
                  }
                  return c;
                });
              }
            });

            // 2. Update/Create Lead
            setLeads(prevLeads => {
              const exists = prevLeads.some(l => l.id === resolvedLeadId || (l.customerId && l.customerId === resolvedCustomerId));
              const isCurrentlyActive = selectedLeadIdRef.current === resolvedLeadId;

              if (!exists) {
                const leadCompCode = (company as CompanyCode) || 'RWC';
                const compConfig = COMPANIES[leadCompCode] || COMPANIES.RWC;
                const newLead: Lead = {
                  id: resolvedLeadId,
                  customerId: resolvedCustomerId,
                  company: leadCompCode,
                  companyTag: companyTag || compConfig.tag,
                  companyColor: companyColor || compConfig.color,
                  companyPhoneNumberId: companyPhoneNumberId || compConfig.phoneId,
                  companyPhoneNumber: companyPhoneNumber || compConfig.phone,
                  customer: {
                    id: resolvedCustomerId,
                    whatsappNumber: canonicalPhone || rawNumber,
                    whatsappId: rawWaId,
                    phoneNumber: displayPhone,
                    displayName: cleanDisplayName,
                    avatarUrl: avatarUrl || undefined,
                    preferredLanguage: 'en',
                    createdAt: new Date().toISOString(),
                  },
                  categoryId: undefined as any,
                  treatmentId: undefined as any,
                  serialNumber: undefined,
                  stage: isOutbound ? 'contacted' : 'new',
                  assignedTo: undefined,
                  source: leadCompCode,
                  language: 'en',
                  notesCount: 0,
                  unreadCount: isOutbound ? 0 : 1,
                  lastCustomerMessageAt: isOutbound ? (undefined as any) : (timestamp || new Date().toISOString()),
                  createdAt: timestamp || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };

                return [newLead, ...prevLeads];
              } else {
                return prevLeads.map(l => {
                  if (l.id === resolvedLeadId || (l.customerId && l.customerId === resolvedCustomerId)) {
                    const shouldUpdatePhone = canonicalPhone && (!l.customer?.whatsappNumber || isHardwareLid(l.customer?.whatsappNumber));
                    const updatedCustomer = l.customer ? {
                      ...l.customer,
                      whatsappNumber: shouldUpdatePhone ? canonicalPhone : (l.customer.whatsappNumber || canonicalPhone),
                      whatsappId: rawWaId || l.customer.whatsappId,
                      phoneNumber: shouldUpdatePhone ? displayPhone : (l.customer.phoneNumber || displayPhone),
                      displayName: l.customer.displayName && !isHardwareLid(l.customer.displayName) ? l.customer.displayName : cleanDisplayName,
                      avatarUrl: avatarUrl || l.customer.avatarUrl
                    } : undefined;

                    const currentCompCode = (company as CompanyCode) || l.company || (l.source?.toUpperCase() === 'CRAS' ? 'CRAS' : 'RWC');
                    const compConfig = COMPANIES[currentCompCode] || COMPANIES.RWC;

                    return { 
                      ...l, 
                      customer: updatedCustomer,
                      company: currentCompCode,
                      companyTag: companyTag || l.companyTag || compConfig.tag,
                      companyColor: companyColor || l.companyColor || compConfig.color,
                      companyPhoneNumberId: companyPhoneNumberId || l.companyPhoneNumberId || compConfig.phoneId,
                      companyPhoneNumber: companyPhoneNumber || l.companyPhoneNumber || compConfig.phone,
                      unreadCount: isOutbound ? 0 : (isCurrentlyActive ? 0 : (l.unreadCount || 0) + 1),
                      lastCustomerMessageAt: isOutbound ? l.lastCustomerMessageAt : (timestamp || new Date().toISOString()),
                      updatedAt: new Date().toISOString() 
                    };
                  }
                  return l;
                });
              }
            });

            // If an outbound message arrived for this lead, mark chat as read immediately
            if (isOutbound && resolvedLeadId) {
              const now = Date.now();
              setUserReadTimestamps(prev => {
                const next = { ...prev, [resolvedLeadId]: now };
                if (currentUser?.id) {
                  try {
                    localStorage.setItem(`rw_crm_read_leads_${currentUser.id}`, JSON.stringify(next));
                  } catch (e) {}
                }
                return next;
              });
            }

            // Trigger WhatsApp Web desktop notification & chime for incoming messages
            if (!isOutbound) {
              const targetLeadObj = matchedLead || {
                id: resolvedLeadId,
                company: (company as CompanyCode) || 'RWC',
                assignedTo: data.coordinatorId,
                stage: 'new',
                unreadCount: 1
              } as Lead;

              // Check role-based accessibility for current user
              const isLeadAccessible = isLeadAccessibleForUser(targetLeadObj, currentUser);

              if (isLeadAccessible) {
                // Invalidate any read timestamp for this lead so it immediately registers as unread
                setUserReadTimestamps(prev => {
                  const next = { ...prev };
                  delete next[resolvedLeadId];
                  if (currentUser?.id) {
                    try {
                      localStorage.setItem(`rw_crm_read_leads_${currentUser.id}`, JSON.stringify(next));
                    } catch (e) {}
                  }
                  return next;
                });

                const isChatActiveAndFocused = selectedLeadIdRef.current === resolvedLeadId && typeof document !== 'undefined' && document.hasFocus();

                if (!isChatActiveAndFocused) {
                  // 1. Play authentic WhatsApp Web audio chime
                  if (notificationSettingsRef.current.sound) {
                    playWhatsAppChime();
                  }

                  // 2. Dispatch in-app desktop notification popup card
                  if (notificationSettingsRef.current.enabled) {
                    let preview = text || '';
                    if (!preview && data.media) {
                      preview = data.media.caption || (data.media.type === 'image' ? '📷 Photo' : data.media.type === 'audio' ? '🎵 Voice note' : '📄 Document');
                    }
                    if (!notificationSettingsRef.current.showPreview) {
                      preview = 'New WhatsApp message';
                    }

                    const targetLead = currentLeads.find(l => l.id === resolvedLeadId);
                    const notifItem: DesktopNotificationItem = {
                      id: messageId || 'notif-' + Date.now(),
                      leadId: resolvedLeadId,
                      customerId: resolvedCustomerId,
                      contactName: cleanDisplayName,
                      contactPhone: canonicalPhone || rawNumber,
                      avatarUrl: avatarUrl || targetLead?.customer?.avatarUrl,
                      messageText: preview,
                      timestamp: timestamp || new Date().toISOString(),
                      timeDisplay: new Date(timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      unreadCount: (targetLead?.unreadCount || 0) + 1,
                      company: (company as string) || targetLead?.company || 'RWC',
                      mediaType: data.media?.type
                    };
                    dispatchDesktopNotification(notifItem);
                  }

                  // 3. Trigger native Windows / macOS desktop notification (Runs over other websites & background tabs)
                  if (notificationSettingsRef.current.nativeBrowser && 'Notification' in window && Notification.permission === 'granted') {
                    let nativeBody = text || (data.media ? (data.media.type === 'image' ? '📷 Photo' : '📁 Media') : 'New WhatsApp message');
                    if (!notificationSettingsRef.current.showPreview) {
                      nativeBody = 'New WhatsApp message';
                    }
                    showDesktopNativeNotification(`${cleanDisplayName} (WhatsApp)`, {
                      body: nativeBody,
                      icon: avatarUrl || '/logo.png',
                      badge: '/favicon.png',
                      leadId: resolvedLeadId,
                      tag: resolvedLeadId,
                      onClick: () => {
                        window.focus();
                        setSelectedLeadId(resolvedLeadId);
                      }
                    });
                  }
                }
              }
            }

            // 3. Add message with deduplication check
            setMessages(prevMsgs => {
              // 1. Exact ID check
              if (messageId && prevMsgs.some(m => m.waMessageId === messageId || m.id === messageId)) {
                return prevMsgs;
              }

              const cleanContent = text || (data.media ? (data.media.caption || '') : '');

              // 2. Outbound optimistic placeholder replacement
              if (isOutbound) {
                const optIndex = prevMsgs.findIndex(m => 
                  m.direction === 'outbound' &&
                  (m.id.startsWith('msg-') || m.waMessageId?.startsWith('wamid.HBg')) &&
                  m.content === cleanContent &&
                  Math.abs(new Date(m.createdAt).getTime() - new Date(timestamp || Date.now()).getTime()) < 20000
                );

                if (optIndex !== -1) {
                  const updated = [...prevMsgs];
                  updated[optIndex] = {
                    ...updated[optIndex],
                    id: messageId || updated[optIndex].id,
                    waMessageId: messageId || updated[optIndex].waMessageId,
                    status: 'sent',
                    leadId: resolvedLeadId || updated[optIndex].leadId,
                    customerId: resolvedCustomerId || updated[optIndex].customerId,
                    senderId: data.senderId || updated[optIndex].senderId,
                    senderName: data.senderName || updated[optIndex].senderName,
                    senderRole: data.senderRole || updated[optIndex].senderRole,
                    messageSource: data.messageSource || updated[optIndex].messageSource,
                    sentAt: data.sentAt || updated[optIndex].sentAt,
                    media: data.media ? {
                      type: data.media.type || 'image',
                      url: data.media.url,
                      caption: cleanContent,
                      fileName: data.media.fileName
                    } : updated[optIndex].media
                  };
                  return updated;
                }
              }

              // 3. Duplicate content within 3-second window check
              const isDuplicate = prevMsgs.some(m =>
                m.direction === (isOutbound ? 'outbound' : 'inbound') &&
                m.content === cleanContent &&
                Math.abs(new Date(m.createdAt).getTime() - new Date(timestamp || Date.now()).getTime()) < 3000
              );
              if (isDuplicate) {
                return prevMsgs;
              }

              const newMsg: Message = {
                id: messageId || 'msg-' + Date.now(),
                leadId: resolvedLeadId,
                customerId: resolvedCustomerId,
                direction: isOutbound ? 'outbound' : 'inbound',
                senderType: senderType || (isOutbound ? 'coordinator' : 'customer'),
                senderId: data.senderId,
                senderName: data.senderName,
                senderRole: data.senderRole,
                messageSource: data.messageSource,
                sentAt: data.sentAt || (isOutbound ? (timestamp || new Date().toISOString()) : undefined),
                content: cleanContent,
                media: data.media ? {
                  type: data.media.type || 'image',
                  url: data.media.url,
                  caption: cleanContent,
                  fileName: data.media.fileName
                } : undefined,
                waMessageId: messageId || 'wamid.' + Date.now(),
                status: isOutbound ? 'sent' : 'delivered',
                createdAt: timestamp || new Date().toISOString(),
              };
              return [...prevMsgs, newMsg].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            });
          } else if (data.type === 'INBOUND_REACTION') {
            const { targetMessageId, emoji } = data;
            setMessages(prevMsgs => {
              const hasExact = prevMsgs.some(m => m.waMessageId === targetMessageId || m.id === targetMessageId);
              if (hasExact) {
                return prevMsgs.map(m => {
                  if (m.waMessageId === targetMessageId || m.id === targetMessageId) {
                    return {
                      ...m,
                      reactions: emoji ? [emoji] : []
                    };
                  }
                  return m;
                });
              }
              return prevMsgs;
            });
          } else if (data.type === 'CHAT_DELETED') {
            const { leadId, customerId, phone, whatsappId } = data;
            console.log('🗑️ [CRM SSE] Chat deleted event received for:', leadId || customerId || phone);
            
            const cleanDigits = getCleanWhatsAppDigits(phone || whatsappId || '');

            setLeads(prev => {
              const remaining = prev.filter(l => {
                if (leadId && l.id === leadId) return false;
                if (customerId && l.customerId === customerId) return false;
                const lDigits = getCleanWhatsAppDigits(l.customer?.whatsappNumber || l.customer?.whatsappId || '');
                if (cleanDigits && lDigits && (cleanDigits === lDigits || cleanDigits.includes(lDigits) || lDigits.includes(cleanDigits))) return false;
                return true;
              });

              // If active lead was deleted, switch to next available lead
              setSelectedLeadId(currentSelectedId => {
                const wasDeleted = !remaining.some(l => l.id === currentSelectedId);
                if (wasDeleted) {
                  return remaining.length > 0 ? remaining[0].id : null;
                }
                return currentSelectedId;
              });

              return remaining;
            });

            setCustomers(prev => prev.filter(c => {
              if (customerId && c.id === customerId) return false;
              const cDigits = getCleanWhatsAppDigits(c.whatsappNumber || c.whatsappId || '');
              if (cleanDigits && cDigits && (cleanDigits === cDigits || cleanDigits.includes(cDigits) || cDigits.includes(cleanDigits))) return false;
              return true;
            }));

            setMessages(prev => prev.filter(m => {
              if (leadId && m.leadId === leadId) return false;
              if (customerId && m.customerId === customerId) return false;
              return true;
            }));
          } else if (data.type === 'CHAT_CLEARED') {
            const { leadId, customerId } = data;
            setMessages(prev => prev.filter(m => {
              if (leadId && m.leadId === leadId) return false;
              if (customerId && m.customerId === customerId) return false;
              return true;
            }));
          } else if (data.type === 'MESSAGE_DELETED') {
            const { messageId } = data;
            if (messageId) {
              setMessages(prev => prev.filter(m => m.id !== messageId && m.waMessageId !== messageId));
            }
          } else if (data.type === 'TEAM_BROADCAST_CREATED') {
            const { broadcast } = data;
            if (broadcast) {
              setBroadcasts(prev => {
                const filtered = prev.filter(b => b.id !== broadcast.id);
                const next = [broadcast, ...filtered];
                localStorage.setItem('rw_crm_broadcasts', JSON.stringify(next));
                return next;
              });
              notify('Team Broadcast 📢', `${broadcast.senderName}: ${broadcast.title || broadcast.content.slice(0, 40)}`, 'info');
            }
          } else if (data.type === 'TEAM_BROADCAST_DELETED') {
            const { broadcastId } = data;
            if (broadcastId) {
              setBroadcasts(prev => {
                const next = prev.filter(b => b.id !== broadcastId);
                localStorage.setItem('rw_crm_broadcasts', JSON.stringify(next));
                return next;
              });
            }
          } else if (data.type === 'INIT') {
            if (data.status) setWhatsappStatus(data.status);
          } else if (data.type === 'CONNECTION_STATUS') {
            setWhatsappStatus(data.status);
            if (data.status === 'connected') {
              console.log('🟢 WhatsApp connected. Refreshing latest conversation state.');
              fetchInitialData();
            }
          } else if (data.type === 'HISTORY_SYNC_COMPLETED') {
            console.log(`🔄 History sync completed. Restoring ${data.count} messages into CRM.`);
            setWhatsappStatus('connected');
            fetchInitialData();
            notify('WhatsApp History Synced', `${data.count} conversation messages restored from WhatsApp.`, 'success');
          } else if (data.type === 'QR_CODE') {
            setWhatsappStatus('qr_ready');
          }
        } catch (err) {
          console.error('Error handling SSE message:', err);
        }
      };
      };
      connectSse().catch(error => console.warn('Webhook SSE connection unavailable:', error));
    } catch (e) {
      console.warn('Webhook SSE connection unavailable:', e);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [currentUser?.id, authToken]);

  // Mark chat as read and clear unread badge for the current user
  const markChatAsRead = (leadId: string) => {
    const now = Date.now();
    setUserReadTimestamps(prev => {
      const next = { ...prev, [leadId]: now };
      if (currentUser?.id) {
        try {
          localStorage.setItem(`rw_crm_read_leads_${currentUser.id}`, JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, unreadCount: 0 } : l));
  };

  // Mark chat as unread (sets unread indicator for current user)
  const markChatAsUnread = (leadId: string) => {
    setUserReadTimestamps(prev => {
      const next = { ...prev };
      delete next[leadId];
      if (currentUser?.id) {
        try {
          localStorage.setItem(`rw_crm_read_leads_${currentUser.id}`, JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, unreadCount: Math.max(1, (l.unreadCount && l.unreadCount > 0) ? l.unreadCount : 1) } : l));
  };

  // Compute total unread messages for current user across accessible conversations
  // STRICT RULE: Only messages sent by CUSTOMERS (inbound) can ever be unread!
  // Any conversation where the latest message is Outbound / Staff reply is by definition READ.
  const totalUnreadCountForUser = useMemo(() => {
    if (!currentUser) return 0;
    const accessibleLeads = leads.filter(l => isLeadAccessibleForUser(l, currentUser));

    let total = 0;
    for (const lead of accessibleLeads) {
      // 1. If currently selected/active in chat, user is viewing it -> 0 unread
      if (selectedLeadId === lead.id) {
        continue;
      }

      // 2. Check all messages for this lead
      const leadMsgs = messages.filter(m => 
        m.leadId === lead.id || 
        (lead.customerId && m.customerId === lead.customerId)
      );

      let latestMsg: Message | null = null;
      if (leadMsgs.length > 0) {
        latestMsg = leadMsgs.reduce((latest, current) => {
          const tCur = new Date(current.createdAt || current.timestamp || current.sentAt || 0).getTime();
          const tLat = new Date(latest.createdAt || latest.timestamp || latest.sentAt || 0).getTime();
          return tCur > tLat ? current : latest;
        }, leadMsgs[0]);
      }

      // If the latest message in this chat was sent by staff (outbound / coordinator / system / ai),
      // then staff has already responded or initiated! It CANNOT be unread!
      if (latestMsg && (latestMsg.direction === 'outbound' || latestMsg.senderType !== 'customer')) {
        continue;
      }

      // 3. A lead without unread count cannot be unread!
      const count = lead.unreadCount || 0;
      if (count <= 0) {
        continue;
      }

      const readTime = userReadTimestamps[lead.id] || 0;
      if (readTime > 0 && lead.lastCustomerMessageAt) {
        const customerMsgTime = new Date(lead.lastCustomerMessageAt).getTime();
        if (customerMsgTime > 0 && readTime >= customerMsgTime) {
          continue;
        }
      }

      total += count;
    }
    return total;
  }, [leads, currentUser, userReadTimestamps, selectedLeadId, messages]);

  // Open unread WhatsApp chats list (bell click function)
  const openUnreadChats = useCallback(() => {
    setActiveNavTab('chat');
    setChatListFilter('unread');
    setSelectedLeadId(null);
  }, []);

  // Auto-mark active chat as read on load or change
  useEffect(() => {
    if (selectedLeadId) {
      markChatAsRead(selectedLeadId);
    }
  }, [selectedLeadId]);

  // Helper for toast notifications
  const notify = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'lead' = 'info') => {
    const newToast: NotificationToast = {
      id: 'toast-' + Date.now() + Math.random(),
      title,
      message,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setNotifications(prev => [newToast, ...prev].slice(0, 5));
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Helper to add audit logs
  const logAudit = (action: string, entityType: AuditLog['entityType'], entityId: string, before?: any, after?: any) => {
    const log: AuditLog = {
      id: 'audit-' + Date.now(),
      userId: currentUser.id,
      userName: currentUser.fullName,
      action,
      entityType,
      entityId,
      before,
      after,
      createdAt: new Date().toISOString(),
    };
    setAuditLogs(prev => [log, ...prev]);
  };

  // Enriched selected lead
  const selectedLead = leads.find(l => l.id === selectedLeadId);

  // Assign or reassign lead with strict role validation and assignment locking
  const assignLead = async (leadId: string, coordinatorId: string): Promise<boolean> => {
    const targetLead = leads.find(l => l.id === leadId);
    if (!targetLead) return false;

    // 1. Role validation
    if (isCoordinator) {
      notify('Action Forbidden', 'Coordinators are not permitted to assign or reassign leads.', 'warning');
      return false;
    }

    if (isLeadsOfficer) {
      if (targetLead.assignedTo) {
        notify('Assignment Locked', 'This lead is already assigned. Once assigned, only Super Admin can change or reassign coordinators.', 'warning');
        return false;
      }
      if (!coordinatorId) {
        notify('Action Forbidden', 'Leads Officers cannot unassign leads. Only Super Admin can modify or remove existing assignments.', 'warning');
        return false;
      }
    }

    const prevAssignedTo = targetLead.assignedTo;
    const prevStage = targetLead.stage;
    const nowIso = new Date().toISOString();
    const coord = users.find(u => u.id === coordinatorId);

    try {
      const res = await fetch(`${API_BASE_URL}/api/leads/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          leadId,
          coordinatorId: coordinatorId || '',
          coordinatorName: coord?.fullName || '',
          assignedById: currentUser?.id,
          assignedByName: currentUser?.fullName,
          assignedAt: nowIso,
          unassign: !coordinatorId,
          customerId: targetLead.customerId,
          phone: targetLead.customer?.whatsappNumber,
          whatsappId: targetLead.customer?.whatsappId
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        notify('Assignment Forbidden', data.error || 'Server rejected assignment update.', 'warning');
        return false;
      }

      // Update state upon verified server confirmation
      setLeads(prev => prev.map(l => {
        if (l.id === leadId) {
          if (!coordinatorId) {
            logAudit('LEAD_UNASSIGNED', 'Assignment', leadId, { assignedTo: prevAssignedTo }, { assignedTo: undefined, stage: 'new' });
            return {
              ...l,
              assignedTo: undefined,
              assignedById: currentUser.id,
              assignedByName: currentUser.fullName,
              assignedAt: nowIso,
              stage: 'new' as LeadStage,
              updatedAt: nowIso
            };
          }

          const newStage: LeadStage = prevStage === 'new' ? 'assigned' : prevStage;
          logAudit('LEAD_ASSIGNED', 'Assignment', leadId, { assignedTo: prevAssignedTo, stage: prevStage }, { assignedTo: coordinatorId, stage: newStage });

          const newHist: LeadAssignmentHistory = {
            id: 'asgn-' + Date.now(),
            leadId,
            assignedToId: coordinatorId,
            assignedToName: coord?.fullName || 'Staff',
            assignedById: currentUser.id,
            assignedByName: currentUser.fullName,
            assignedAt: nowIso
          };

          return {
            ...l,
            assignedTo: coordinatorId,
            assignedById: currentUser.id,
            assignedByName: currentUser.fullName,
            assignedAt: nowIso,
            assignmentHistories: [newHist, ...(l.assignmentHistories || [])],
            stage: newStage,
            updatedAt: nowIso
          };
        }
        return l;
      }));

      if (!coordinatorId) {
        notify('Lead Unassigned', 'Lead marked as Unassigned by Super Admin', 'info');
      } else {
        notify('Lead Assigned', `Lead successfully assigned to ${coord?.fullName || 'Coordinator'}`, 'success');
      }
      return true;
    } catch (err: any) {
      notify('Assignment Error', err.message || 'Failed to communicate with server', 'warning');
      return false;
    }
  };

  // Update lead stage
  const updateLeadStage = (leadId: string, newStage: LeadStage, reason?: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    if (lead.stage === newStage) return;

    const prevStage = lead.stage;

    // Trigger celebration confetti on conversion!
    if (newStage === 'converted') {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2dd4be', '#d4a438', '#14b8a6', '#f5eecc']
      });
      notify('🎉 Lead Converted!', `${lead.customer?.displayName || 'Client'} has been successfully converted!`, 'success');
    } else {
      notify('Stage Updated', `Lead moved to ${newStage.toUpperCase().replace('_', ' ')}`, 'info');
    }

    const updatedLeads = leads.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          stage: newStage,
          updatedAt: new Date().toISOString(),
        };
      }
      return l;
    });

    setLeads(updatedLeads);
    localStorage.setItem('rw_crm_leads', JSON.stringify(updatedLeads));

    // Sync to Supabase PostgreSQL backend in real-time
    fetch(`${API_BASE_URL}/api/leads/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({
        leadId,
        customerId: lead.customerId,
        phone: lead.customer?.whatsappNumber,
        whatsappId: lead.customer?.whatsappId,
        stage: newStage,
        reason: reason || `Stage changed from ${prevStage} to ${newStage}`
      })
    }).catch(err => console.warn('Could not sync lead stage update to backend:', err));

    // Record stage history
    const hist: LeadStageHistory = {
      id: 'hist-' + Date.now(),
      leadId,
      fromStage: prevStage,
      toStage: newStage,
      changedBy: currentUser.id,
      changedByName: currentUser.fullName,
      reason: reason || `Stage changed from ${prevStage} to ${newStage}`,
      createdAt: new Date().toISOString(),
    };
    setStageHistories(prev => [hist, ...prev]);

    // Audit log
    logAudit('STAGE_CHANGED', 'Lead', leadId, { stage: prevStage }, { stage: newStage, reason });
  };

  // Update lead treatment & generate/save serial number
  const updateLeadTreatment = (leadId: string, treatmentId: string, customSerial?: string) => {
    const targetLead = leads.find(l => l.id === leadId);
    if (!targetLead) return;

    if (!treatmentId) {
      setLeads(prev => prev.map(l => {
        if (l.id === leadId) {
          return {
            ...l,
            treatmentId: undefined,
            categoryId: undefined,
            serialNumber: undefined,
            updatedAt: new Date().toISOString()
          };
        }
        return l;
      }));

      fetch(`${API_BASE_URL}/api/leads/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          leadId,
          treatmentId: null,
          categoryId: null,
          serialNumber: null
        })
      }).catch(err => console.warn('Could not sync lead treatment reset to backend:', err));

      notify('Treatment Cleared', 'Treatment reset to Select Treatment', 'info');
      return;
    }

    const targetTreatment = treatments.find(t => t.id === treatmentId);
    const categoryId = targetTreatment?.categoryId || targetLead.categoryId;

    let finalSerialNumber = customSerial;
    if (finalSerialNumber === undefined) {
      if (targetTreatment?.code) {
        const prefix = `${targetTreatment.code}-`;
        let maxNum = 0;
        leads.forEach(l => {
          if (l.serialNumber && l.serialNumber.startsWith(prefix)) {
            const numPart = parseInt(l.serialNumber.substring(prefix.length), 10);
            if (!isNaN(numPart) && numPart > maxNum) {
              maxNum = numPart;
            }
          }
        });
        const nextNum = String(maxNum + 1).padStart(3, '0');
        finalSerialNumber = `${targetTreatment.code}-${nextNum}`;
      } else {
        finalSerialNumber = targetLead.serialNumber;
      }
    }

    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          treatmentId,
          categoryId,
          serialNumber: finalSerialNumber,
          updatedAt: new Date().toISOString()
        };
      }
      return l;
    }));

    // Sync to Supabase PostgreSQL backend in real-time
    fetch(`${API_BASE_URL}/api/leads/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({
        leadId,
        treatmentId,
        categoryId,
        serialNumber: finalSerialNumber
      })
    }).catch(err => console.warn('Could not sync lead treatment update to backend:', err));

    const isCras = targetTreatment?.company === 'CRAS' || targetLead.company === 'CRAS';
    notify(
      isCras ? 'Course Enrolled' : 'Treatment Updated',
      `${isCras ? 'Course' : 'Treatment'} set to ${targetTreatment?.name || 'Selected'} (${finalSerialNumber || 'No Serial'})`,
      'success'
    );
  };

  // Update lead language & customer preferred language
  const updateLeadLanguage = (leadId: string, language: 'en' | 'si' | 'ta') => {
    const targetLead = leads.find(l => l.id === leadId);
    if (!targetLead) return;

    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          language,
          customer: l.customer ? { ...l.customer, preferredLanguage: language } : l.customer,
          updatedAt: new Date().toISOString()
        };
      }
      return l;
    }));

    if (targetLead.customerId) {
      setCustomers(prev => prev.map(c => c.id === targetLead.customerId ? { ...c, preferredLanguage: language } : c));
    }

    // Sync to Supabase PostgreSQL backend in real-time
    fetch(`${API_BASE_URL}/api/leads/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({
        leadId,
        language
      })
    }).catch(err => console.warn('Could not sync lead language update to backend:', err));

    const langName = language === 'si' ? 'Sinhala (සිංහල)' : language === 'ta' ? 'Tamil (தமிழ்)' : 'English';
    notify('Language Updated', `Preferred language set to ${langName}`, 'success');
  };

  // Update lead company
  const updateLeadCompany = (leadId: string, company: CompanyCode) => {
    const targetLead = leads.find(l => l.id === leadId);
    if (!targetLead) return;

    const compConfig = COMPANIES[company] || COMPANIES.RWC;
    const isChangingCompany = targetLead.company !== company;

    // When switching company, if lead currently has a treatment/course assigned, reset so coordinator picks from the new catalog
    const shouldResetTreatment = isChangingCompany && Boolean(targetLead.treatmentId);
    const assignedCoord = users.find(u => u.id === targetLead.assignedTo);
    const isCrossCompanyCoord = isChangingCompany && Boolean(assignedCoord && assignedCoord.company && assignedCoord.company !== company);

    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          company,
          companyTag: compConfig.tag,
          companyColor: compConfig.color,
          companyPhoneNumberId: compConfig.phoneId,
          companyPhoneNumber: compConfig.phone,
          source: company,
          ...(shouldResetTreatment ? {
            treatmentId: undefined,
            categoryId: undefined,
            serialNumber: undefined
          } : {}),
          ...(isCrossCompanyCoord ? {
            assignedTo: undefined,
            assignedCoordinator: undefined,
            assignedById: undefined,
            assignedByName: undefined,
            assignedAt: undefined,
            stage: 'new' as LeadStage
          } : {}),
          updatedAt: new Date().toISOString()
        };
      }
      return l;
    }));

    fetch(`${API_BASE_URL}/api/leads/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({
        leadId,
        company,
        source: company,
        ...(shouldResetTreatment ? {
          treatmentId: null,
          categoryId: null,
          serialNumber: null
        } : {}),
        ...(isCrossCompanyCoord ? {
          assignedTo: null,
          assignedById: null,
          assignedByName: null,
          assignedAt: null,
          stage: 'new'
        } : {})
      })
    }).catch(err => console.error('Failed to sync company update:', err));

    notify('Company Updated', `Inquiry assigned to ${compConfig.name} (${compConfig.tag})`, 'success');
  };

  // Update lead acquisition source channel (e.g. 'whatsapp', 'facebook', 'instagram', 'website')
  const updateLeadSource = async (leadId: string, newSource: string): Promise<boolean> => {
    const targetLead = leads.find(l => l.id === leadId);
    if (!targetLead) return false;

    const normalizedSource = newSource.trim().toLowerCase();
    const nowIso = new Date().toISOString();

    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          source: normalizedSource,
          updatedAt: nowIso
        };
      }
      return l;
    }));

    try {
      const res = await fetch(`${API_BASE_URL}/api/leads/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          leadId,
          source: normalizedSource
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        notify('Source Update Failed', data.error || 'Failed to update lead source.', 'warning');
        return false;
      }
      const label = normalizedSource === 'facebook' ? 'Facebook' : normalizedSource === 'instagram' ? 'Instagram' : normalizedSource === 'whatsapp' ? 'WhatsApp' : normalizedSource;
      notify('Lead Source Updated', `Source set to ${label}`, 'success');
      return true;
    } catch (err) {
      console.warn('Could not sync lead source update to backend:', err);
      return false;
    }
  };

  // Add internal note
  const addLeadNote = (leadId: string, noteText: string) => {
    if (!noteText.trim()) return;

    const newNote: LeadNote = {
      id: 'note-' + Date.now(),
      leadId,
      authorId: currentUser.id,
      authorName: currentUser.fullName,
      note: noteText.trim(),
      createdAt: new Date().toISOString(),
    };

    setNotes(prev => [newNote, ...prev]);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notesCount: (l.notesCount || 0) + 1, updatedAt: new Date().toISOString() } : l));
    notify('Note Saved', 'Internal note added to lead record', 'info');
  };

  const updateLeadNote = (noteId: string, noteText: string) => {
    if (!noteText.trim()) return;
    setNotes(prev => prev.map(note => note.id === noteId ? {
      ...note,
      note: noteText.trim(),
      updatedAt: new Date().toISOString()
    } : note));
    notify('Note Updated', 'Internal note updated on lead record', 'info');
  };

  // Send WhatsApp message from CRM
  const sendMessage = (
    leadId: string, 
    content: string, 
    senderType: 'coordinator' | 'system' | 'ai' = 'coordinator', 
    media?: any,
    replyTo?: { id: string; content: string; senderName: string }
  ) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    // Enforce WhatsApp connection requirement for CRM sending (Supports Linked Device OR Meta Cloud API)
    const hasMetaToken = hasMetaConfig;
    if (!leadId.startsWith('lead-sim') && whatsappStatus !== 'connected' && !hasMetaToken) {
      notify('WhatsApp Disconnected', 'Please link your WhatsApp or configure Meta API first to send messages.', 'warning');
      setQrModalOpen(true);
      return;
    }

    const tempMsgId = 'msg-' + Date.now();
    const nowUtc = new Date().toISOString();
    const isSystemOrAi = senderType === 'system' || senderType === 'ai';
    const auditSenderId = currentUser?.id;
    const auditSenderName = isSystemOrAi ? 'System / Automation' : currentUser?.fullName;
    const auditSenderRole = isSystemOrAi ? 'System' : (currentUser?.roleTitle || currentUser?.role);
    const auditSource = isSystemOrAi ? 'Automation' : 'CRM User';

    const newMsg: Message = {
      id: tempMsgId,
      leadId,
      customerId: lead.customerId,
      direction: 'outbound',
      senderType,
      senderId: auditSenderId,
      senderName: auditSenderName,
      senderRole: auditSenderRole,
      messageSource: auditSource,
      sentAt: nowUtc,
      content,
      media,
      replyTo: replyTo || (replyingMessage ? {
        id: replyingMessage.id,
        content: replyingMessage.content,
        senderName: replyingMessage.direction === 'inbound' 
          ? (lead.customer?.displayName || 'Customer')
          : currentUser.fullName
      } : undefined),
      waMessageId: undefined,
      status: 'pending',
      createdAt: nowUtc,
    };

    setMessages(prev => [...prev, newMsg]);
    setReplyingMessage(null); // Clear replying state after sending
    markChatAsRead(leadId); // Immediately mark read so outgoing messages never trigger unread bell state

    // Auto-advance stage if New or Assigned -> Contacted
    if (lead.stage === 'new' || lead.stage === 'assigned') {
      updateLeadStage(leadId, 'contacted', 'First WhatsApp message sent');
    }

    // Dispatch to WhatsApp bridge (Supports both linked QR session & Meta API)
    const recipientPhone = lead.customer?.whatsappNumber;
    const recipientWaId = lead.customer?.whatsappId;
    
    if ((recipientPhone || recipientWaId) && !leadId.startsWith('lead-sim')) {
      fetch(`${API_BASE_URL}/api/send-message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          to: recipientPhone,
          whatsappId: recipientWaId,
          text: content,
          message: content,
          media: media || undefined,
          leadId: lead.id,
          customerId: lead.customerId,
          senderId: auditSenderId,
          senderName: auditSenderName,
          senderRole: auditSenderRole,
          messageSource: auditSource,
          sentAt: nowUtc,
          company: lead.company || (lead.source?.toUpperCase() === 'CRAS' ? 'CRAS' : 'RWC'),
          phoneNumberId: lead.companyPhoneNumberId || (lead.company === 'CRAS' ? '1378201582041705' : '1358157244046701')
        })
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Failed to send message via WhatsApp' }));
          console.warn('❌ WhatsApp send error:', err);
          setMessages(prev => prev.map(m => m.id === tempMsgId ? {
            ...m,
            status: 'failed',
            errorCode: err.errorCode,
            errorMessage: err.error
          } : m));
          notify('Failed to Send', err.error || 'Could not deliver message to customer.', 'warning');
        } else {
          const data = await res.json().catch(() => ({}));
          console.log('✅ Outbound WhatsApp message accepted! ID:', data.messageId);
          if (data.messageId) {
            setMessages(prev => prev.map(m => m.id === tempMsgId ? {
              ...m,
              id: data.messageId,
              waMessageId: data.messageId,
              status: (m.status === 'delivered' || m.status === 'read') ? m.status : 'sent',
              errorCode: undefined,
              errorMessage: undefined
            } : m));
          }
          notify('Message Sent', `Message accepted by Meta WhatsApp API`, 'success');
        }
      }).catch(err => {
        console.warn('WhatsApp bridge offline:', err);
        setMessages(prev => prev.map(m => m.id === tempMsgId ? {
          ...m,
          status: 'failed',
          errorMessage: err.message || 'Network error reaching WhatsApp server'
        } : m));
        notify('Send Failed', 'Could not reach WhatsApp server.', 'warning');
      });
    }

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, updatedAt: new Date().toISOString() } : l));
  };

  // React with Emoji (Single reaction rule)
  const reactToMessage = (messageId: string, emoji: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const existingReactions = m.reactions || [];
        const isSameEmoji = existingReactions.includes(emoji);
        // Toggle off if same emoji clicked again, otherwise replace with new emoji
        const newReactions = isSameEmoji ? [] : [emoji];
        return { ...m, reactions: newReactions };
      }
      return m;
    }));
  };

  // Star message
  const starMessage = (messageId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const nextStarred = !m.starred;
        notify(nextStarred ? 'Message Starred ⭐' : 'Message Unstarred', nextStarred ? 'Added to starred messages' : 'Removed from starred messages', 'info');
        return { ...m, starred: nextStarred };
      }
      return m;
    }));
  };

  // Pin message
  const pinMessage = (messageId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const nextPinned = !m.pinned;
        notify(nextPinned ? 'Message Pinned 📌' : 'Message Unpinned', nextPinned ? 'Message pinned to top' : 'Message unpinned', 'info');
        return { ...m, pinned: nextPinned };
      }
      return m;
    }));
  };

  // Delete message
  const deleteMessage = (messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    notify('Message Deleted 🗑️', 'Message removed from chat', 'warning');
  };

  // Edit message
  const editMessage = async (messageId: string, newContent: string) => {
    if (!newContent.trim()) return;
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent.trim(), edited: true } : m));
    notify('Message Edited ✏️', 'Message updated successfully', 'success');

    try {
      await fetch(`${API_BASE_URL}/api/messages/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ messageId, content: newContent.trim() })
      });
    } catch (e) {
      console.warn('Error syncing message edit to backend:', e);
    }
  };

  // Report message
  const reportMessage = (messageId: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reported: true } : m));
    notify('Message Reported 🚩', 'Message flagged for review', 'info');
  };

  // Delete entire chat from CRM & physical WhatsApp phone
  const deleteChat = async (leadId: string) => {
    const targetLead = leads.find(l => l.id === leadId);
    if (!targetLead) return;

    // Optimistically remove from state
    setLeads(prev => prev.filter(l => l.id !== leadId));
    setCustomers(prev => prev.filter(c => c.id !== targetLead.customerId));
    setMessages(prev => prev.filter(m => m.leadId !== leadId && m.customerId !== targetLead.customerId));

    if (selectedLeadId === leadId) {
      const remaining = leads.filter(l => l.id !== leadId);
      setSelectedLeadId(remaining.length > 0 ? remaining[0].id : null);
    }

    notify('Chat Deleted 🗑️', `Chat with ${targetLead.customer?.displayName || 'contact'} deleted from CRM & WhatsApp.`, 'info');

    try {
      await fetch(`${API_BASE_URL}/api/chats/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          leadId: targetLead.id,
          customerId: targetLead.customerId,
          phone: targetLead.customer?.whatsappNumber,
          whatsappId: targetLead.customer?.whatsappId
        })
      });
    } catch (e) {
      console.warn('Error syncing chat delete to backend:', e);
    }
  };

  // Clear all messages in a chat while preserving the lead/customer
  const clearChat = async (leadId: string) => {
    const targetLead = leads.find(l => l.id === leadId);
    if (!targetLead) return;

    setMessages(prev => prev.filter(m => m.leadId !== leadId && m.customerId !== targetLead.customerId));
    notify('Chat Cleared 🧹', `Messages cleared for ${targetLead.customer?.displayName || 'contact'}.`, 'info');

    try {
      await fetch(`${API_BASE_URL}/api/chats/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          leadId: targetLead.id,
          customerId: targetLead.customerId,
          phone: targetLead.customer?.whatsappNumber,
          whatsappId: targetLead.customer?.whatsappId
        })
      });
    } catch (e) {
      console.warn('Error syncing chat clear to backend:', e);
    }
  };

  // Forward message to one or multiple leads
  const forwardMessage = (messageId: string, targetLeadId: string | string[]) => {
    const sourceMsg = messages.find(m => m.id === messageId);
    if (!sourceMsg) return;

    const targetLeadIds = Array.isArray(targetLeadId) ? targetLeadId : [targetLeadId];
    if (targetLeadIds.length === 0) return;

    let successCount = 0;
    targetLeadIds.forEach(tId => {
      const targetLead = leads.find(l => l.id === tId);
      if (targetLead) {
        sendMessage(tId, sourceMsg.content, 'coordinator', sourceMsg.media);
        successCount++;
      }
    });

    if (successCount === 1) {
      const targetLead = leads.find(l => l.id === targetLeadIds[0]);
      notify('Message Forwarded ➡️', `Message forwarded to ${targetLead?.customer?.displayName || 'contact'}`, 'success');
    } else if (successCount > 1) {
      notify('Message Forwarded ➡️', `Message forwarded to ${successCount} contacts`, 'success');
    }
  };

  // Send approved WhatsApp template via Meta Cloud API
  const sendWhatsAppTemplate = async (leadId: string, templateId: string, params?: string[], retryMessageId?: string) => {
    const template = templates.find(t => t.id === templateId || t.name === templateId || t.waTemplateName === templateId);
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const templateName = template?.waTemplateName || template?.name || templateId;
    const hasVariables = (template?.variables && template.variables.length > 0) || (template?.body && template.body.includes('{{1}}'));
    const defaultParam = lead.customer?.displayName || (templateName.startsWith('cras_') ? 'Dr. Perera' : 'Valued Client');
    const effectiveParams = hasVariables ? ((params && params.length > 0) ? params : [defaultParam]) : [];

    let body = template?.body || `[WhatsApp Template: ${templateName}]`;
    if (hasVariables) {
      effectiveParams.forEach((param, idx) => {
        body = body.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), param);
      });
    }

    const tempId = 'tpl-' + Date.now();
    const nowUtc = new Date().toISOString();
    const auditSenderId = currentUser?.id;
    const auditSenderName = currentUser?.fullName;
    const auditSenderRole = currentUser?.roleTitle || currentUser?.role;
    const auditSource = 'CRM User';

    const newMsg: Message = {
      id: tempId,
      leadId,
      customerId: lead.customerId,
      direction: 'outbound',
      senderType: 'coordinator',
      senderId: auditSenderId,
      senderName: auditSenderName,
      senderRole: auditSenderRole,
      messageSource: auditSource,
      sentAt: nowUtc,
      content: body,
      status: 'pending',
      createdAt: nowUtc
    };
    
    // If retrying a failed message, replace or remove the old failed message
    if (retryMessageId) {
      setMessages(prev => [...prev.filter(m => m.id !== retryMessageId), newMsg]);
    } else {
      setMessages(prev => [...prev, newMsg]);
    }
    markChatAsRead(leadId); // Immediately mark read so outgoing templates never trigger unread bell state

    const recipientPhone = lead.customer?.whatsappNumber;
    const recipientWaId = lead.customer?.whatsappId;

    try {
      const res = await fetch(`${API_BASE_URL}/api/send-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          to: recipientPhone,
          phone: recipientPhone,
          whatsappId: recipientWaId,
          templateName,
          templateBody: template?.body,
          language: template?.language === 'en' ? 'en_US' : (template?.language || 'en_US'),
          parameters: effectiveParams,
          leadId: lead.id,
          customerId: lead.customerId,
          senderId: auditSenderId,
          senderName: auditSenderName,
          senderRole: auditSenderRole,
          messageSource: auditSource,
          sentAt: nowUtc,
          company: lead.company || (lead.source?.toUpperCase() === 'CRAS' ? 'CRAS' : 'RWC'),
          phoneNumberId: lead.companyPhoneNumberId || (lead.company === 'CRAS' ? '1378201582041705' : '1358157244046701'),
          retryMessageId: retryMessageId || undefined
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages(prev => prev.map(m => m.id === tempId ? {
          ...m,
          status: 'failed',
          errorCode: data.errorCode,
          errorMessage: data.error
        } : m));
        notify('Template Failed', data.error || 'Failed to dispatch template', 'warning');
      } else {
        if (data.messageId) {
          setMessages(prev => prev.map(m => m.id === tempId ? {
            ...m,
            id: data.messageId,
            waMessageId: data.messageId,
            status: 'sent',
            errorCode: undefined,
            errorMessage: undefined
          } : m));
        }
        notify('Template Sent', `WhatsApp template dispatched to customer`, 'success');
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === tempId ? {
        ...m,
        status: 'failed',
        errorMessage: err.message
      } : m));
      notify('Template Error', err.message || 'Server error', 'warning');
    }
  };

  // Retry sending a previously failed message (Prevents duplicates by passing retryMessageId)
  const retryFailedMessage = async (failedMessageId: string) => {
    const msg = messages.find(m => m.id === failedMessageId);
    if (!msg) return;

    const lead = leads.find(l => l.id === msg.leadId);
    if (!lead) return;

    // Set status to pending immediately
    setMessages(prev => prev.map(m => m.id === failedMessageId ? { ...m, status: 'pending', errorMessage: undefined } : m));
    markChatAsRead(msg.leadId);

    const recipientPhone = lead.customer?.whatsappNumber;
    const recipientWaId = lead.customer?.whatsappId;
    const isSuperAdmin = currentUser?.role === 'super_admin';

    try {
      const res = await fetch(`${API_BASE_URL}/api/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          to: recipientPhone,
          whatsappId: recipientWaId,
          text: msg.content,
          message: msg.content,
          media: msg.media || undefined,
          leadId: lead.id,
          customerId: lead.customerId,
          company: lead.company || (lead.source?.toUpperCase() === 'CRAS' ? 'CRAS' : 'RWC'),
          phoneNumberId: lead.companyPhoneNumberId || (lead.company === 'CRAS' ? '1378201582041705' : '1358157244046701'),
          retryMessageId: failedMessageId
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages(prev => prev.map(m => m.id === failedMessageId ? {
          ...m,
          status: 'failed',
          errorCode: data.errorCode,
          errorMessage: data.error
        } : m));
        notify('Retry Failed', data.error || 'Message still could not be sent.', 'warning');
      } else {
        if (data.messageId) {
          setMessages(prev => prev.map(m => m.id === failedMessageId ? {
            ...m,
            id: data.messageId,
            waMessageId: data.messageId,
            status: 'sent',
            errorCode: undefined,
            errorMessage: undefined
          } : m));
        }
        notify('Message Resent', `Message successfully dispatched to WhatsApp`, 'success');
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === failedMessageId ? {
        ...m,
        status: 'failed',
        errorMessage: err.message
      } : m));
      notify('Retry Error', err.message || 'Failed to connect to server', 'warning');
    }
  };

  // Followup controls
  const cancelFollowup = (followupId: string) => {
    setFollowups(prev => prev.map(f => f.id === followupId ? { ...f, status: 'cancelled' } : f));
    notify('Follow-up Cancelled', 'Scheduled message was cancelled', 'warning');
  };

  const pauseFollowup = (followupId: string) => {
    setFollowups(prev => prev.map(f => f.id === followupId ? { ...f, status: 'skipped' } : f));
    notify('Follow-up Paused', 'Scheduled message paused', 'info');
  };

  const resumeFollowup = (followupId: string) => {
    setFollowups(prev => prev.map(f => f.id === followupId ? { ...f, status: 'pending' } : f));
    notify('Follow-up Resumed', 'Scheduled message resumed', 'success');
  };

  const triggerFollowupNow = (followupId: string) => {
    const fol = followups.find(f => f.id === followupId);
    if (!fol) return;
    const template = templates.find(t => t.id === fol.templateId);
    const lead = leads.find(l => l.id === fol.leadId);

    if (template && lead) {
      const custName = lead.customer?.displayName || 'Client';
      const trt = treatments.find(t => t.id === lead.treatmentId)?.name || 'Treatment';
      sendWhatsAppTemplate(lead.id, template.id, [custName, trt]);
      
      setFollowups(prev => prev.map(f => f.id === followupId ? { ...f, status: 'sent', sentAt: new Date().toISOString() } : f));
      notify('Follow-up Triggered', `Follow-up #${fol.stepNumber} sent via WhatsApp Cloud API`, 'success');
    }
  };

  // Admin CRUD implementations
  const addCategory = (cat: Omit<TreatmentCategory, 'id'>) => {
    const newCat: TreatmentCategory = {
      ...cat,
      id: 'cat-' + Date.now(),
    };
    setCategories(prev => [...prev, newCat]);
    logAudit('CREATE_CATEGORY', 'Treatment', newCat.id, null, newCat);
    notify('Category Created', `${newCat.name} added to treatments catalogue`, 'success');
  };

  const updateCategory = (id: string, updates: Partial<TreatmentCategory>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    logAudit('UPDATE_CATEGORY', 'Treatment', id, null, updates);
    notify('Category Updated', 'Changes saved to catalogue', 'info');
  };

  // Dynamic Configuration & Super Admin Methods
  const fetchStages = useCallback(async () => {
    try {
      const isSuper = currentUser?.role === 'super_admin';
      const token = await ensureValidAuthToken();
      const endpoint = isSuper ? `${API_BASE_URL}/api/admin/stages` : `${API_BASE_URL}/api/stages`;
      const res = await fetch(endpoint, {
        headers: isSuper && token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        const stageList = Array.isArray(data) ? data : (data?.stages || []);
        if (Array.isArray(stageList) && stageList.length > 0) {
          setStages(stageList);
          localStorage.setItem('rw_crm_stages', JSON.stringify(stageList));
        }
      }
    } catch (e) {
      console.warn('Failed to fetch stages:', e);
    }
  }, [currentUser?.role]);

  const addStage = async (stageData: { key: string; label: string; description?: string; color?: string; orderIndex?: number; company?: 'ALL' | 'RWC' | 'CRAS' | string }) => {
    try {
      const token = await ensureValidAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/stages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(stageData)
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to add stage' };
      }
      if (data.stage) {
        setStages(prev => {
          const exists = prev.some(s => s.id === data.stage.id || s.key === data.stage.key);
          if (exists) return prev.map(s => (s.id === data.stage.id || s.key === data.stage.key) ? data.stage : s);
          const next = [...prev, data.stage];
          localStorage.setItem('rw_crm_stages', JSON.stringify(next));
          return next;
        });
      }
      await fetchStages();
      notify('Stage Created', `Stage "${stageData.label}" created successfully.`, 'success');
      return { success: true, stage: data.stage };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error adding stage' };
    }
  };

  const updateStage = async (id: string, updates: Partial<LeadStageConfig>) => {
    try {
      const token = await ensureValidAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/stages/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update stage' };
      }
      setStages(prev => {
        const next = prev.map(s => (s.id === id || s.key === id) ? { ...s, ...updates } : s);
        localStorage.setItem('rw_crm_stages', JSON.stringify(next));
        return next;
      });
      await fetchStages();
      notify('Stage Updated', 'Stage updated successfully.', 'success');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error updating stage' };
    }
  };

  const reorderStages = async (order: { id: string; orderIndex: number }[]) => {
    try {
      const stageIdOrder = order.map(o => o.id);
      // Optimistic local update so UI moves immediately
      setStages(prev => {
        const reordered = [...prev].sort((a, b) => {
          const idxA = stageIdOrder.indexOf(a.id);
          const idxB = stageIdOrder.indexOf(b.id);
          return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
        }).map((s, idx) => ({ ...s, orderIndex: idx }));
        localStorage.setItem('rw_crm_stages', JSON.stringify(reordered));
        return reordered;
      });

      const token = await ensureValidAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/stages/reorder`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stageIds: stageIdOrder, order })
      });
      const data = await res.json();
      if (!res.ok) {
        await fetchStages();
        return { success: false, error: data.error || 'Failed to reorder stages' };
      }
      await fetchStages();
      notify('Stages Reordered', 'Pipeline sequence updated successfully.', 'success');
      return { success: true };
    } catch (e: any) {
      await fetchStages();
      return { success: false, error: e.message || 'Network error reordering stages' };
    }
  };

  const deleteStage = async (id: string) => {
    try {
      const token = await ensureValidAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/stages/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to delete stage' };
      }
      setStages(prev => {
        const next = prev.filter(s => s.id !== id && s.key !== id);
        localStorage.setItem('rw_crm_stages', JSON.stringify(next));
        return next;
      });
      await fetchStages();
      notify('Stage Removed', 'Stage permanently removed from database.', 'success');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error deleting stage' };
    }
  };

  const toggleStageStatus = async (id: string, isActive: boolean) => {
    try {
      const token = await ensureValidAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/stages/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || data.reason || 'Failed to toggle stage status' };
      }
      await fetchStages();
      notify('Stage Status Updated', `Stage is now ${isActive ? 'active' : 'deactivated'}.`, 'success');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error toggling stage status' };
    }
  };

  const fetchCourses = useCallback(async () => {
    try {
      const isSuper = currentUser?.role === 'super_admin';
      const token = await ensureValidAuthToken();
      const endpoint = isSuper ? `${API_BASE_URL}/api/admin/courses` : `${API_BASE_URL}/api/courses`;
      const res = await fetch(endpoint, {
        headers: isSuper && token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCourses(data);
          localStorage.setItem('rw_crm_courses', JSON.stringify(data));
          setTreatments(prev => {
            const rwcOnly = prev.filter(t => t.company !== 'CRAS');
            return [...rwcOnly, ...data];
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch courses:', e);
    }
  }, [currentUser?.role]);

  const addCourse = async (courseData: Partial<Treatment>) => {
    try {
      const token = await ensureValidAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(courseData)
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to create course' };
      }
      await fetchCourses();
      notify('Course Created', `Course "${courseData.name}" created successfully.`, 'success');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error creating course' };
    }
  };

  const updateCourse = async (id: string, updates: Partial<Treatment>) => {
    try {
      const token = await ensureValidAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/courses/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update course' };
      }
      await fetchCourses();
      notify('Course Updated', 'Course updated successfully.', 'success');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error updating course' };
    }
  };

  const toggleCourseStatus = async (id: string, active: boolean) => {
    try {
      const token = await ensureValidAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/courses/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to toggle course status' };
      }
      await fetchCourses();
      notify('Course Status', `Course is now ${active ? 'active' : 'deactivated'}.`, 'success');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error toggling course status' };
    }
  };

  const fetchTreatments = useCallback(async () => {
    try {
      const isSuper = currentUser?.role === 'super_admin';
      const token = await ensureValidAuthToken();
      const endpoint = isSuper ? `${API_BASE_URL}/api/admin/treatments` : `${API_BASE_URL}/api/treatments`;
      const res = await fetch(endpoint, {
        headers: isSuper && token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTreatments(prev => {
            const crasCourses = prev.filter(t => t.company === 'CRAS');
            return [...data, ...crasCourses];
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch treatments:', e);
    }
  }, [currentUser?.role]);

  const addTreatment = async (trt: any): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = await ensureValidAuthToken();
      const isSuper = currentUser?.role === 'super_admin';
      if (isSuper && token) {
        const res = await fetch(`${API_BASE_URL}/api/admin/treatments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(trt)
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error || 'Failed to create treatment' };
        }
        await fetchTreatments();
        notify('Treatment Added', `${trt.name} added to service menu`, 'success');
        return { success: true };
      } else {
        const newTrt: Treatment = {
          ...trt,
          id: 'trt-' + Date.now(),
        };
        setTreatments(prev => [...prev, newTrt]);
        logAudit('CREATE_TREATMENT', 'Treatment', newTrt.id, null, newTrt);
        notify('Treatment Added', `${newTrt.name} added to service menu`, 'success');
        return { success: true };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error adding treatment' };
    }
  };

  const updateTreatment = async (id: string, updates: Partial<Treatment>): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = await ensureValidAuthToken();
      const isSuper = currentUser?.role === 'super_admin';
      if (isSuper && token) {
        const res = await fetch(`${API_BASE_URL}/api/admin/treatments/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updates)
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error || 'Failed to update treatment' };
        }
        await fetchTreatments();
        notify('Treatment Updated', 'Service details updated', 'info');
        return { success: true };
      } else {
        setTreatments(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        logAudit('UPDATE_TREATMENT', 'Treatment', id, null, updates);
        notify('Treatment Updated', 'Service details updated', 'info');
        return { success: true };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error updating treatment' };
    }
  };

  const toggleTreatmentStatus = async (id: string, active: boolean) => {
    try {
      const token = await ensureValidAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/treatments/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to toggle treatment status' };
      }
      await fetchTreatments();
      notify('Treatment Status', `Treatment is now ${active ? 'active' : 'deactivated'}.`, 'success');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error toggling treatment status' };
    }
  };

  const fetchSuperAdmins = useCallback(async () => {
    try {
      if (currentUser?.role !== 'super_admin') return;
      const token = await ensureValidAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/super-admins`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.superAdmins || data?.users || []);
        if (Array.isArray(list)) {
          setSuperAdmins(list);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch super admins:', e);
    }
  }, [currentUser?.role]);

  const createSuperAdmin = async (data: { fullName: string; email: string; password?: string; pin?: string }) => {
    const tempAdmin: User = {
      id: `user-admin-${Date.now()}`,
      fullName: data.fullName.trim(),
      email: data.email.trim().toLowerCase(),
      branch: 'Colombo (Head Office)',
      role: 'super_admin',
      active: true,
      createdAt: new Date().toISOString()
    };

    setSuperAdmins(prev => [...prev, tempAdmin]);
    setUsers(prev => {
      const updated = [...prev, tempAdmin];
      try {
        localStorage.setItem('rw_crm_users', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    try {
      const token = await ensureValidAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/super-admins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      const resData = await res.json().catch(() => ({}));
      const createdAdmin = resData.superAdmin || resData.user;
      if (res.ok && createdAdmin) {
        setSuperAdmins(prev => prev.map(u => u.id === tempAdmin.id ? createdAdmin : u));
        setUsers(prev => prev.map(u => u.id === tempAdmin.id ? createdAdmin : u));
      }
    } catch (e: any) {
      console.warn('Backend createSuperAdmin network sync warning:', e.message);
    }

    notify('Super Admin Created', `Account for ${data.fullName} created successfully.`, 'success');
    return { success: true };
  };

  const updateSuperAdmin = async (id: string, data: { fullName?: string; active?: boolean }) => {
    // 1. Optimistically update local superAdmins list
    setSuperAdmins(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    
    // 2. Optimistically update users list and localStorage
    setUsers(prev => {
      const updated = prev.map(u => u.id === id ? { ...u, ...data } : u);
      try {
        localStorage.setItem('rw_crm_users', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // 3. If currently logged in as this user, update active user state
    if (currentUser?.id === id) {
      setCurrentUser(prev => prev ? { ...prev, ...data } : prev);
      try {
        const storedAuth = localStorage.getItem('rw_crm_auth_user');
        if (storedAuth) {
          const parsed = JSON.parse(storedAuth);
          localStorage.setItem('rw_crm_auth_user', JSON.stringify({ ...parsed, ...data }));
        }
      } catch (e) {}
    }

    try {
      const token = await ensureValidAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/super-admins/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      const resData = await res.json().catch(() => ({}));
      if (res.ok) {
        await fetchSuperAdmins();
      }
    } catch (e: any) {
      console.warn('Backend updateSuperAdmin network sync warning:', e.message);
    }

    notify('Account Updated', 'Account name saved successfully.', 'success');
    return { success: true };
  };

  const deleteSuperAdmin = async (id: string) => {
    // 1. Optimistic removal
    setSuperAdmins(prev => prev.filter(u => u.id !== id));
    setUsers(prev => {
      const updated = prev.filter(u => u.id !== id);
      try {
        localStorage.setItem('rw_crm_users', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    try {
      const token = await ensureValidAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/super-admins/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: resData.error || 'Failed to delete Super Admin' };
      }
      await fetchSuperAdmins();
    } catch (e: any) {
      console.warn('Backend deleteSuperAdmin warning:', e.message);
    }

    notify('Account Deleted', 'Super Admin account removed successfully.', 'info');
    return { success: true };
  };

  const addTemplate = (tpl: Omit<WhatsAppTemplate, 'id'>) => {
    const newTpl: WhatsAppTemplate = {
      ...tpl,
      id: 'tpl-' + Date.now(),
    };
    setTemplates(prev => [...prev, newTpl]);
    logAudit('CREATE_TEMPLATE', 'Template', newTpl.id, null, newTpl);
    notify('Template Created', `Submitted "${newTpl.name}" to Meta for approval`, 'success');
  };

  const updateTemplate = (id: string, updates: Partial<WhatsAppTemplate>) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    logAudit('UPDATE_TEMPLATE', 'Template', id, null, updates);
    notify('Template Updated', 'Template details updated', 'info');
  };

  const updateSequence = (id: string, updates: Partial<FollowupSequence>) => {
    setSequences(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    logAudit('UPDATE_SEQUENCE', 'Followup', id, null, updates);
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    const normalizedUpdates = { ...updates };
    if (updates.whatsappNumber) {
      normalizedUpdates.whatsappNumber = normalizeWhatsAppNumber(updates.whatsappNumber);
      normalizedUpdates.phoneNumber = formatWhatsAppDisplay(updates.whatsappNumber);
      normalizedUpdates.whatsappId = updates.whatsappId || getCleanWhatsAppDigits(updates.whatsappNumber);
    }
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...normalizedUpdates } : c));
    setLeads(prev => prev.map(l => (l.customerId === id || l.customer?.id === id) ? {
      ...l,
      customer: l.customer ? { ...l.customer, ...normalizedUpdates } : undefined
    } : l));
    logAudit('UPDATE_CUSTOMER', 'Lead', id, null, normalizedUpdates);
    notify('Customer Updated', 'Contact details saved', 'success');

    // Sync to Supabase PostgreSQL backend in real-time
    fetch(`${API_BASE_URL}/api/customer/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({
        customerId: id,
        ...normalizedUpdates
      })
    }).catch(err => console.warn('Could not sync customer update to backend:', err));
  };

  const addCoordinator = async (data: { fullName: string; branch?: string; company?: CompanyCode; email?: string; password?: string; pin?: string; phone?: string; role?: UserRole; treatmentCategoryId?: string; language?: LanguageCode }) => {
    const role: UserRole = data.role === 'leads_officer' ? 'leads_officer' : 'coordinator';
    const cleanCompany: CompanyCode | undefined = role === 'leads_officer' ? undefined : (data.company || 'RWC');
    const newCoordId = (role === 'leads_officer' ? 'officer-' : 'coord-') + Date.now();
    const cleanBranch = data.branch || 'Colombo';
    const cleanPin = String(data.pin || '2026').trim().slice(0, 10);
    const autoEmail = data.email || `${data.fullName.toLowerCase().replace(/[^a-z0-9]/g, '') || (role === 'leads_officer' ? 'officer' : 'coord') + Date.now()}@royalwellness.lk`;

    const newCoord: User = {
      id: newCoordId,
      fullName: data.fullName,
      branch: cleanBranch,
      company: cleanCompany,
      email: autoEmail,
      password: data.password || 'staff',
      pin: cleanPin,
      phone: data.phone,
      role: role,
      treatmentCategoryId: data.treatmentCategoryId,
      language: data.language || 'en',
      active: true,
      createdAt: new Date().toISOString(),
      activeLeadsCount: 0,
    };

    // Remove from deleted list if re-added
    const deletedUserIds = getStored<string[]>('rw_crm_deleted_users', []);
    if (deletedUserIds.includes(newCoordId)) {
      const updatedDeleted = deletedUserIds.filter(id => id !== newCoordId);
      localStorage.setItem('rw_crm_deleted_users', JSON.stringify(updatedDeleted));
    }

    // 1. Optimistically store in local state & localStorage immediately
    setUsers(prev => {
      const updated = [...prev.filter(u => u.id !== newCoordId), newCoord];
      localStorage.setItem('rw_crm_users', JSON.stringify(updated));
      return updated;
    });

    // 2. Persist to Supabase via backend REST API with authenticated token
    try {
      const token = await ensureValidAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/coordinators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          id: newCoordId,
          fullName: data.fullName,
          branch: cleanBranch,
          company: cleanCompany || null,
          email: autoEmail,
          pin: cleanPin,
          phone: data.phone,
          role: role,
          password: data.password || 'staff'
        })
      });

      if (res.ok) {
        const resData = await res.json().catch(() => ({}));
        if (resData.success && resData.user) {
          const dbUser = resData.user;
          // Reconcile client record with confirmed Supabase record
          setUsers(prev => {
            const mapped = prev.map(u => {
              if (u.id === newCoordId || (dbUser.id && u.id === dbUser.id)) {
                return {
                  ...u,
                  id: dbUser.id || u.id,
                  email: dbUser.email || u.email,
                  pin: dbUser.pin || cleanPin,
                  fullName: dbUser.fullName || u.fullName,
                  branch: dbUser.branch || u.branch,
                  company: dbUser.company !== undefined ? (dbUser.company || undefined) : u.company,
                };
              }
              return u;
            });
            localStorage.setItem('rw_crm_users', JSON.stringify(mapped));
            return mapped;
          });
          console.log(`✅ [CRM Staff Saved in Supabase] ID: ${dbUser.id || newCoordId}`);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn('Backend staff creation status:', res.status, errJson.error);
      }
    } catch (err: any) {
      console.warn('Could not sync new staff member to Supabase backend:', err?.message || err);
    }

    logAudit('CREATE_USER', 'User', newCoord.id, null, newCoord);
    const roleLabel = role === 'leads_officer' 
      ? 'Leads Officer' 
      : `Coordinator (${cleanCompany})`;
    notify('Staff Added', `${roleLabel} ${newCoord.fullName} (${cleanBranch}) registered and saved successfully`, 'success');
  };

  const deleteCoordinator = async (id: string) => {
    // 0. Super Admin protection
    if (id === 'user-admin-1') {
      notify('Action Forbidden', 'Super Admin cannot be deleted.', 'warning');
      return;
    }

    // 1. Record deleted coordinator ID immediately in localStorage
    const deletedUserIds = getStored<string[]>('rw_crm_deleted_users', []);
    if (!deletedUserIds.includes(id)) {
      const updatedDeleted = [...deletedUserIds, id];
      localStorage.setItem('rw_crm_deleted_users', JSON.stringify(updatedDeleted));
    }

    // 2. Remove coordinator from state & localStorage immediately
    setUsers(prev => {
      const updated = prev.filter(u => u.id !== id);
      localStorage.setItem('rw_crm_users', JSON.stringify(updated));
      return updated;
    });

    // 3. Revert any leads assigned to this deleted coordinator back to Unassigned / 'new'
    setLeads(prev => {
      return prev.map(lead => {
        if (lead.assignedTo === id) {
          return {
            ...lead,
            assignedTo: undefined,
            stage: 'new' as LeadStage,
            updatedAt: new Date().toISOString()
          };
        }
        return lead;
      });
    });

    // 4. Deleting the active account ends its session. Never fall back to an
    // administrator identity without a fresh server-verified authentication.
    if (currentUser.id === id) {
      clearAuthenticatedSession();
    }

    // 5. Notify backend to permanently remove coordinator & unassign database records
    try {
      await fetch(`${API_BASE_URL}/api/coordinators/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        }
      });
    } catch (err) {
      console.warn('Could not sync coordinator deletion to backend:', err);
    }

    logAudit('DELETE_USER', 'User', id, null, null);
    notify('Staff Removed', 'Team member removed and assigned leads reverted to Unassigned.', 'info');
  };

  const updateCoordinator = async (id: string, data: { fullName: string; branch: string; pin?: string; password?: string }) => {
    const cleanName = data.fullName.trim();
    const cleanBranch = data.branch.trim() || 'Colombo';
    const cleanPin = data.pin ? data.pin.trim() : undefined;
    const cleanPassword = data.password ? data.password.trim() : undefined;

    const oldUser = users.find(u => u.id === id);

    // 1. Update state & localStorage
    setUsers(prev => {
      const updated = prev.map(u => u.id === id ? { 
        ...u, 
        fullName: cleanName, 
        branch: cleanBranch,
        pin: cleanPin || u.pin,
        password: cleanPassword || u.password
      } : u);
      localStorage.setItem('rw_crm_users', JSON.stringify(updated));
      return updated;
    });

    if (currentUser?.id === id) {
      setCurrentUser(prev => {
        const updated = { 
          ...prev, 
          fullName: cleanName, 
          branch: cleanBranch,
          pin: cleanPin || prev.pin,
          password: cleanPassword || prev.password
        };
        localStorage.setItem('rw_crm_current_user', JSON.stringify(updated));
        return updated;
      });
    }

    // 2. Sync to Supabase via backend REST endpoint
    try {
      const res = await fetch(`${API_BASE_URL}/api/coordinators/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          fullName: cleanName,
          branch: cleanBranch,
          pin: cleanPin,
          password: cleanPassword
        })
      });
      if (!res.ok) {
        console.warn('Backend update returned non-OK status:', res.status);
      }
    } catch (err) {
      console.warn('Could not sync staff update to backend/Supabase:', err);
    }

    logAudit('UPDATE_USER', 'User', id, { fullName: oldUser?.fullName, branch: oldUser?.branch }, { fullName: cleanName, branch: cleanBranch, pin: cleanPin ? '***' : undefined });
    notify('Staff Updated', `${cleanName} (${cleanBranch}) updated in Supabase successfully`, 'success');
  };

  // Re-read readBroadcastIds whenever currentUser changes
  useEffect(() => {
    const authId = currentUser?.id || 'user-admin-1';
    setReadBroadcastIds(getStored<string[]>(`rw_crm_read_broadcasts_${authId}`, []));
  }, [currentUser?.id]);

  // Compute unread broadcast count for current user
  const unreadBroadcastsCount = useMemo(() => {
    const isOfficerOrAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'leads_officer';
    return broadcasts.filter(b => {
      // Company targeting filter
      if (!isOfficerOrAdmin && currentUser?.company) {
        if (b.company && b.company !== 'ALL' && b.company !== currentUser.company) {
          return false;
        }
      }
      return !readBroadcastIds.includes(b.id);
    }).length;
  }, [broadcasts, readBroadcastIds, currentUser?.role, currentUser?.company]);

  const markAllBroadcastsAsRead = useCallback(() => {
    const authId = currentUser?.id || 'user-admin-1';
    const allIds = broadcasts.map(b => b.id);
    setReadBroadcastIds(prev => {
      const merged = Array.from(new Set([...prev, ...allIds]));
      try {
        localStorage.setItem(`rw_crm_read_broadcasts_${authId}`, JSON.stringify(merged));
      } catch (e) {}
      return merged;
    });
  }, [broadcasts, currentUser?.id]);

  const sendBroadcast = async (data: {
    title?: string;
    content: string;
    mediaType?: 'image' | 'video' | 'document' | 'audio';
    mediaUrl?: string;
    fileName?: string;
    fileSize?: number;
    isPinned?: boolean;
    company?: string;
    targetStaffId?: string;
    targetStaffName?: string;
  }): Promise<boolean> => {
    try {
      const token = localStorage.getItem('rw_crm_auth_token') || currentUser?.id || 'user-admin-1';
      const res = await fetch(`${API_BASE_URL}/api/broadcasts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...data,
          senderName: currentUser?.fullName || 'Super Admin',
          senderRole: currentUser?.role || 'super_admin'
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to post broadcast message');
      }

      const result = await res.json();
      if (result.success && result.broadcast) {
        setBroadcasts(prev => {
          const filtered = prev.filter(b => b.id !== result.broadcast.id);
          const next = [result.broadcast, ...filtered];
          localStorage.setItem('rw_crm_broadcasts', JSON.stringify(next));
          return next;
        });

        // Automatically mark author's newly published broadcast as read
        const authId = currentUser?.id || 'user-admin-1';
        setReadBroadcastIds(prev => {
          const merged = Array.from(new Set([...prev, result.broadcast.id]));
          try {
            localStorage.setItem(`rw_crm_read_broadcasts_${authId}`, JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });

        notify('Broadcast Published', 'Team broadcast posted to all staff successfully.', 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Error posting broadcast:', err);
      notify('Broadcast Failed', err.message || 'Could not send broadcast message.', 'warning');
      return false;
    }
  };

  const deleteBroadcast = async (id: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem('rw_crm_auth_token') || currentUser?.id || 'user-admin-1';
      const res = await fetch(`${API_BASE_URL}/api/broadcasts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (res.ok) {
        setBroadcasts(prev => {
          const next = prev.filter(b => b.id !== id);
          localStorage.setItem('rw_crm_broadcasts', JSON.stringify(next));
          return next;
        });

        const authId = currentUser?.id || 'user-admin-1';
        setReadBroadcastIds(prev => {
          const filtered = prev.filter(readId => readId !== id);
          try {
            localStorage.setItem(`rw_crm_read_broadcasts_${authId}`, JSON.stringify(filtered));
          } catch (e) {}
          return filtered;
        });

        notify('Broadcast Removed', 'Broadcast announcement has been deleted.', 'info');
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Error deleting broadcast:', err);
      notify('Delete Failed', err.message || 'Could not delete broadcast.', 'warning');
      return false;
    }
  };

  const login = async (identifier: string, secret?: string) => {
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanSecret = (secret || '').trim();
    if (!cleanId || !cleanSecret) return { success: false, error: 'Enter your email or staff ID and password/PIN.' };

    // Account changes deliberately discard the previous bearer before credentials
    // are submitted. A server response is the only source of the new identity.
    clearAuthenticatedSession();
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanId, pin: cleanSecret, password: cleanSecret })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.token) {
        return { success: false, error: payload?.error || (response.status === 401 ? 'Invalid credentials.' : 'Unable to sign in.') };
      }
      const verifiedUser = await verifyServerSession(payload.token);
      if (!verifiedUser || (payload.user?.id && payload.user.id !== verifiedUser.id)) {
        return { success: false, error: 'Unable to verify this account session. Please try again.' };
      }
      setAuthToken(payload.token);
      localStorage.setItem('rw_crm_auth_token', payload.token);
      localStorage.setItem('rw_crm_auth_user_id', verifiedUser.id);
      setCurrentUser(verifiedUser);
      setIsAuthenticated(true);
      logAudit('USER_LOGIN', 'User', verifiedUser.id, null, { email: verifiedUser.email, role: verifiedUser.role });
      notify('Welcome Back', `Signed in as ${verifiedUser.fullName}`, 'success');
      return { success: true };
    } catch {
      return { success: false, error: 'Login service is unavailable. Check your connection and try again.' };
    }
  };

  const logout = () => {
    clearAuthenticatedSession();
    logAudit('USER_LOGOUT', 'User', currentUser.id, null, null);
    notify('Signed Out', 'You have securely signed out of the CRM session.', 'info');
  };

  const updateUserCredentials = (userId: string, updates: { password?: string; pin?: string }) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
    if (currentUser.id === userId) {
      setCurrentUser(prev => ({ ...prev, ...updates }));
    }
    logAudit('UPDATE_CREDENTIALS', 'User', userId, null, { hasPassword: !!updates.password, hasPin: !!updates.pin });
    notify('Security Updated', 'User credentials saved successfully.', 'success');
  };

  // Clear all fake, demo and test CRM records completely
  const clearAllData = () => {
    setCustomers([]);
    setLeads([]);
    setMessages([]);
    setFollowups([]);
    setNotes([]);
    setStageHistories([]);
    setAuditLogs([]);
    setSelectedLeadId(null);

    try {
      localStorage.removeItem('rw_crm_customers');
      localStorage.removeItem('rw_crm_leads');
      localStorage.removeItem('rw_crm_messages');
      localStorage.removeItem('rw_crm_followups');
      localStorage.removeItem('rw_crm_notes');
      localStorage.removeItem('rw_crm_stage_histories');
      localStorage.removeItem('rw_crm_audit_logs');
    } catch (e) {
      console.error('Error clearing localStorage:', e);
    }

    // Also purge MySQL backend storage
    fetch(`${API_BASE_URL}/api/clear-db`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    }).catch(() => {});

    setNotifications(prev => [
      {
        id: 'toast-' + Date.now(),
        type: 'info',
        title: 'CRM Reset Complete',
        message: 'All mock and demo data removed. Ready for live WhatsApp conversations.',
        timestamp: new Date().toISOString()
      },
      ...prev
    ]);
  };

  // Simulator actions (WhatsApp Customer Mobile)
  const resetSimulator = () => {
    setSimulatorSession({
      waId: '+9470' + Math.floor(1000000 + Math.random() * 9000000),
      name: 'WhatsApp Tester',
      state: 'AwaitingLanguage',
      updatedAt: new Date().toISOString(),
    });
  };

  const selectSimulatorLanguage = (lang: LanguageCode) => {
    setSimulatorSession(prev => ({
      ...prev,
      selectedLanguage: lang,
      state: 'AwaitingCategory',
      updatedAt: new Date().toISOString(),
    }));
  };

  const selectSimulatorCategory = (catId: string) => {
    setSimulatorSession(prev => ({
      ...prev,
      selectedCategory: catId,
      state: 'AwaitingService',
      updatedAt: new Date().toISOString(),
    }));
  };

  const completeOnboardingAndCreateLead = (lang: LanguageCode, catId: string, trtId: string, customerName: string, phone: string) => {
    // 1. Create or Find Customer
    const newCustId = 'cust-' + Date.now();
    const newCustomer: Customer = {
      id: newCustId,
      whatsappNumber: phone,
      displayName: customerName,
      preferredLanguage: lang,
      createdAt: new Date().toISOString(),
      avatarUrl: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?w=150&auto=format&fit=crop&q=80`
    };

    // 2. Create Lead
    const newLeadId = 'lead-' + Date.now();
    const newLead: Lead = {
      id: newLeadId,
      customerId: newCustId,
      customer: newCustomer,
      categoryId: catId,
      treatmentId: trtId,
      assignedTo: undefined, // New unassigned lead for Super Admin queue
      stage: 'new',
      source: 'whatsapp',
      language: lang,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastCustomerMessageAt: new Date().toISOString(),
      notesCount: 0,
      unreadCount: 1,
    };

    // 3. Create initial conversation messages
    const trtObj = treatments.find(t => t.id === trtId);
    const catObj = categories.find(c => c.id === catId);
    const trtLabel = trtObj?.nameI18n?.[lang] || trtObj?.name || 'Treatment';

    const custMsg: Message = {
      id: 'msg-sim-' + Date.now(),
      leadId: newLeadId,
      customerId: newCustId,
      direction: 'inbound',
      senderType: 'customer',
      content: `I would like to inquire about ${trtLabel}.`,
      waMessageId: 'wamid.sim' + Date.now(),
      status: 'delivered',
      createdAt: new Date().toISOString(),
    };

    const confirmText = lang === 'si' 
      ? `ස්තූතියි ${customerName}! අපගේ ${catObj?.nameI18n.si || 'වෛද්‍ය'} කණ්ඩායම කෙටි වේලාවකින් ඔබව සම්බන්ධ කර ගනු ඇත.`
      : lang === 'ta'
      ? `நன்றி ${customerName}! எங்கள் ${catObj?.nameI18n.ta || 'மருத்துவ'} குழு விரைவில் உங்களை தொடர்பு கொள்ளும்.`
      : `Thank you ${customerName}! Our ${catObj?.name || 'Clinical'} team will contact you shortly.`;

    const sysMsg: Message = {
      id: 'msg-sim-sys-' + (Date.now() + 1),
      leadId: newLeadId,
      customerId: newCustId,
      direction: 'outbound',
      senderType: 'system',
      content: confirmText,
      waMessageId: 'wamid.simsys' + Date.now(),
      status: 'read',
      createdAt: new Date(Date.now() + 500).toISOString(),
    };

    // 4. Schedule Follow-up sequence (Day 1/3/5/7)
    const matchingSeq = sequences.find(s => s.categoryId === catId && s.active) || sequences[0];
    const newFollowups: Followup[] = matchingSeq.steps.map((st, idx) => ({
      id: `fol-sim-${Date.now()}-${idx}`,
      leadId: newLeadId,
      sequenceId: matchingSeq.id,
      templateId: st.templateId,
      stepNumber: idx + 1,
      scheduledAt: new Date(Date.now() + st.dayOffset * 86400000).toISOString(),
      status: 'pending',
      retryCount: 0,
      dayOffset: st.dayOffset,
    }));

    // Update state
    setCustomers(prev => [newCustomer, ...prev]);
    setLeads(prev => [newLead, ...prev]);
    setMessages(prev => [...prev, custMsg, sysMsg]);
    setFollowups(prev => [...prev, ...newFollowups]);
    setSelectedLeadId(newLeadId);

    // Audit log
    const audit: AuditLog = {
      id: 'audit-sim-' + Date.now(),
      userId: 'system',
      userName: 'WhatsApp Webhook Engine',
      action: 'LEAD_CREATED_FROM_WEBHOOK',
      entityType: 'Lead',
      entityId: newLeadId,
      after: { source: 'whatsapp', language: lang, categoryId: catId, treatmentId: trtId },
      createdAt: new Date().toISOString(),
    };
    setAuditLogs(prev => [audit, ...prev]);

    notify('🚨 New WhatsApp Lead!', `${customerName} enquired for ${trtLabel} (${lang.toUpperCase()})`, 'lead');
  };

  const selectSimulatorTreatment = (trtId: string) => {
    const lang = simulatorSession.selectedLanguage || 'en';
    const catId = simulatorSession.selectedCategory || 'cat-hair-care';
    
    setSimulatorSession(prev => ({
      ...prev,
      selectedTreatment: trtId,
      state: 'LeadCreated',
      updatedAt: new Date().toISOString(),
    }));

    completeOnboardingAndCreateLead(lang, catId, trtId, simulatorSession.name, simulatorSession.waId);
  };

  const sendSimulatorMessage = (text: string) => {
    if (!text.trim()) return;

    if (simulatorSession.state !== 'LeadCreated') {
      // Free text intent detection fallback
      const detected = aiService.detectIntent(text, categories, treatments);
      const catId = detected.categoryId;
      const trtId = detected.treatmentId || treatments.find(t => t.categoryId === catId)?.id || treatments[0].id;
      const lang = detected.detectedLanguage;

      setSimulatorSession(prev => ({
        ...prev,
        selectedLanguage: lang,
        selectedCategory: catId,
        selectedTreatment: trtId,
        state: 'LeadCreated',
        updatedAt: new Date().toISOString(),
      }));

      completeOnboardingAndCreateLead(lang, catId, trtId, simulatorSession.name, simulatorSession.waId);
      notify('AI Intent Detected', `Classified "${text.slice(0, 30)}..." into ${categories.find(c => c.id === catId)?.name}`, 'info');
      return;
    }

    // If lead already created, send as inbound message to current lead
    const currentLead = leads.find(l => l.customer?.whatsappNumber === simulatorSession.waId);
    if (!currentLead) return;

    const newInbound: Message = {
      id: 'msg-sim-' + Date.now(),
      leadId: currentLead.id,
      customerId: currentLead.customerId,
      direction: 'inbound',
      senderType: 'customer',
      content: text,
      waMessageId: 'wamid.sim' + Date.now(),
      status: 'delivered',
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newInbound]);

    // AUTO-CANCEL RULE (PRD §FR-6.3 & Integration Guide §8):
    // "On any inbound message from that customer, the ingestion service cancels all pending followups rows for that lead"
    setFollowups(prev => prev.map(f => f.leadId === currentLead.id && f.status === 'pending' ? { ...f, status: 'cancelled' } : f));
    
    setLeads(prev => prev.map(l => l.id === currentLead.id ? { 
      ...l, 
      lastCustomerMessageAt: new Date().toISOString(),
      unreadCount: (l.unreadCount || 0) + 1,
      updatedAt: new Date().toISOString()
    } : l));

    notify('Customer Replied', `Inbound message from ${currentLead.customer?.displayName}. Pending follow-ups auto-cancelled.`, 'info');
  };

  const addNewContact = async (data: {
    name: string;
    phone: string;
    company?: CompanyCode;
    categoryId?: string;
    treatmentId?: string;
    language?: 'en' | 'si' | 'ta';
    assignedTo?: string;
    initialMessage?: string;
    templateName?: string;
    templateParams?: string[];
  }): Promise<{ success: boolean; leadId?: string; error?: string; messageSent?: boolean; messageError?: string }> => {
    try {
      const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      };

      const res = await fetch(`${API_BASE_URL}/api/contacts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          company: data.company || 'RWC',
          categoryId: data.categoryId,
          treatmentId: data.treatmentId,
          language: data.language || 'en',
          assignedTo: data.assignedTo || (isCoordinator && (!currentUser.company || currentUser.company === (data.company || 'RWC')) ? currentUser.id : undefined),
          initialMessage: data.initialMessage,
          templateName: data.templateName,
          templateParams: data.templateParams
        })
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        notify('Contact Error', resData.error || 'Failed to create contact', 'warning');
        return { success: false, error: resData.error };
      }

      const { customer: dbCust, lead: dbLead, message: dbMsg, leadId, messageSent, messageError } = resData;

      if (dbCust) {
        setCustomers(prev => {
          const exists = prev.some(c => c.id === dbCust.id);
          if (!exists) return [dbCust, ...prev];
          return prev.map(c => c.id === dbCust.id ? { ...c, ...dbCust } : c);
        });
      }

      if (dbLead) {
        setLeads(prev => {
          const exists = prev.some(l => l.id === dbLead.id);
          if (!exists) return [dbLead, ...prev];
          return prev.map(l => l.id === dbLead.id ? { ...l, ...dbLead } : l);
        });
      }

      if (dbMsg) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === dbMsg.id);
          if (!exists) return [...prev, dbMsg];
          return prev.map(m => m.id === dbMsg.id ? { ...m, ...dbMsg } : m);
        });
      }

      const targetLeadId = leadId || dbLead?.id;
      if (targetLeadId) {
        setSelectedLeadId(targetLeadId);
      }

      if (messageSent === false && messageError) {
        notify('Contact Saved (Message Delivery Failed)', messageError, 'warning');
      } else if (messageSent === true) {
        notify('Contact Added & Message Sent', `${data.name || data.phone} saved and WhatsApp message delivered!`, 'success');
      } else {
        notify('Contact Added', `${data.name || data.phone} saved to Supabase!`, 'success');
      }

      return {
        success: true,
        leadId: targetLeadId,
        messageSent: messageSent,
        messageError: messageError
      };
    } catch (err: any) {
      notify('Contact Error', err.message || 'Failed to add contact', 'warning');
      return { success: false, error: err.message };
    }
  };

  // Join leads with customer & coordinator objects
  const hydratedLeads: Lead[] = leads.map(lead => {
    const cust = customers.find(c => c.id === lead.customerId);
    const rawCust = cust || lead.customer;
    const finalCust: Customer | undefined = rawCust ? {
      ...rawCust,
      whatsappNumber: rawCust.whatsappNumber || '',
      phoneNumber: rawCust.phoneNumber || formatWhatsAppDisplay(rawCust.whatsappNumber),
      whatsappId: rawCust.whatsappId || getCleanWhatsAppDigits(rawCust.whatsappNumber)
    } : undefined;

    return {
      ...lead,
      customer: finalCust,
      assignedCoordinator: users.find(u => u.id === lead.assignedTo),
    };
  });

  // Strict Role-Based Lead Isolation:
  // Coordinators can ONLY view leads assigned to their account.
  const resolvedSelectedLead = useMemo(() => {
    if (!selectedLeadId) return undefined;
    const target = hydratedLeads.find(l => l.id === selectedLeadId);
    if (!target) return undefined;
    if (!isSuperAdmin && !isLeadsOfficer && target.assignedTo !== currentUser.id) {
      return undefined;
    }
    return target;
  }, [hydratedLeads, selectedLeadId, isSuperAdmin, isLeadsOfficer, currentUser.id]);

  const value: CrmContextType = {
    isAuthenticated,
    login,
    logout,
    updateUserCredentials,
    currentUser,
    users,
    setCurrentUser,
    isSuperAdmin,
    isLeadsOfficer,
    isCoordinator,
    canAssignLeads,
    canReassignLead,
    canModifyAssignment,
    leads: hydratedLeads,
    customers,
    messages,
    categories,
    treatments,
    templates,
    sequences,
    followups,
    notes,
    stageHistories,
    auditLogs,
    notifications,
    selectedLeadId,
    setSelectedLeadId,
    selectedLead: resolvedSelectedLead,
    assignLead,
    updateLeadStage,
    updateLeadTreatment,
    updateLeadLanguage,
    updateLeadCompany,
    updateLeadSource,
    addLeadNote,
    updateLeadNote,
    sendMessage,
    replyingMessage,
    setReplyingMessage,
    reactToMessage,
    starMessage,
    pinMessage,
    deleteMessage,
    editMessage,
    reportMessage,
    forwardMessage,
    deleteChat,
    clearChat,
    sendWhatsAppTemplate,
    retryFailedMessage,
    loadOlderMessages,
    hasOlderMessages: messagesCursor !== null,
    markChatAsRead,
    markChatAsUnread,
    cancelFollowup,
    pauseFollowup,
    resumeFollowup,
    triggerFollowupNow,
    addCategory,
    updateCategory,
    addTreatment,
    updateTreatment,
    toggleTreatmentStatus,
    stages,
    courses,
    superAdmins,
    fetchStages,
    addStage,
    updateStage,
    reorderStages,
    toggleStageStatus,
    deleteStage,
    fetchCourses,
    addCourse,
    updateCourse,
    toggleCourseStatus,
    fetchTreatments,
    fetchSuperAdmins,
    createSuperAdmin,
    updateSuperAdmin,
    deleteSuperAdmin,
    addTemplate,
    updateTemplate,
    updateSequence,
    updateCustomer,
    addCoordinator,
    updateCoordinator,
    deleteCoordinator,
    broadcasts,
    unreadBroadcastsCount,
    markAllBroadcastsAsRead,
    sendBroadcast,
    deleteBroadcast,
    clearAllData,
    addNewContact,
    simulatorOpen,
    setSimulatorOpen,
    simulatorSession,
    resetSimulator,
    sendSimulatorMessage,
    selectSimulatorLanguage,
    selectSimulatorCategory,
    selectSimulatorTreatment,
    dismissNotification,
    whatsappStatus,
    setWhatsappStatus,
    qrModalOpen,
    setQrModalOpen,
    hasMetaConfig,
    setHasMetaConfig,
    desktopNotifications,
    notificationSettings,
    dismissDesktopNotification,
    updateNotificationSettings,
    dispatchTestNotification,
    notificationSettingsOpen,
    setNotificationSettingsOpen,
    totalUnreadCountForUser,
    userReadTimestamps,
    chatListFilter,
    setChatListFilter,
    openUnreadChats,
    activeNavTab,
    setActiveNavTab,
    theme,
    setTheme,
    toggleTheme,
  };

  return (
    <CrmContext.Provider value={value}>
      {children}
    </CrmContext.Provider>
  );
};

export const useCrm = () => {
  const context = useContext(CrmContext);
  if (!context) {
    throw new Error('useCrm must be used within a CrmProvider');
  }
  return context;
};
