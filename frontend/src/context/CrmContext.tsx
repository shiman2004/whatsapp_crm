import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
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
  AuditLog,
  LeadStage,
  LanguageCode,
  OnboardingSession,
  WhatsAppConnectionStatus
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
import { API_BASE_URL } from '../config/api';
import { aiService } from '../services/aiService';

interface NotificationToast {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'lead';
  timestamp: string;
}

interface CrmContextType {
  // Authentication & RBAC
  isAuthenticated: boolean;
  login: (identifier: string, secret?: string) => { success: boolean; error?: string };
  logout: () => void;
  updateUserCredentials: (userId: string, updates: { password?: string; pin?: string }) => void;
  currentUser: User;
  users: User[];
  setCurrentUser: (user: User) => void;
  isSuperAdmin: boolean;
  isLeadsOfficer: boolean;
  isCoordinator: boolean;
  canAssignLeads: boolean;

  // Data collections
  leads: Lead[];
  customers: Customer[];
  messages: Message[];
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
  assignLead: (leadId: string, coordinatorId: string) => void;
  updateLeadStage: (leadId: string, newStage: LeadStage, reason?: string) => void;
  addLeadNote: (leadId: string, note: string) => void;
  
  // Messaging actions
  replyingMessage: Message | null;
  setReplyingMessage: (msg: Message | null) => void;
  sendMessage: (leadId: string, content: string, senderType?: 'coordinator' | 'system' | 'ai', media?: any, replyTo?: { id: string; content: string; senderName: string }) => void;
  sendWhatsAppTemplate: (leadId: string, templateId: string, params: string[]) => void;
  markChatAsRead: (leadId: string) => void;
  reactToMessage: (messageId: string, emoji: string) => void;
  starMessage: (messageId: string) => void;
  pinMessage: (messageId: string) => void;
  deleteMessage: (messageId: string) => void;
  forwardMessage: (messageId: string, targetLeadId: string) => void;
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
  addTreatment: (treatment: Omit<Treatment, 'id'>) => void;
  updateTreatment: (id: string, updates: Partial<Treatment>) => void;
  addTemplate: (template: Omit<WhatsAppTemplate, 'id'>) => void;
  updateTemplate: (id: string, updates: Partial<WhatsAppTemplate>) => void;
  updateSequence: (id: string, updates: Partial<FollowupSequence>) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  addCoordinator: (data: { fullName: string; branch?: string; email?: string; password?: string; pin?: string; phone?: string; role?: UserRole; treatmentCategoryId?: string; language?: LanguageCode }) => void;
  deleteCoordinator: (id: string) => void;

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

  // Toasts
  dismissNotification: (id: string) => void;
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
    return merged;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const authId = localStorage.getItem('rw_crm_auth_user_id');
    return !!authId;
  });

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
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(INITIAL_TEMPLATES);
  const [sequences, setSequences] = useState<FollowupSequence[]>(INITIAL_SEQUENCES);
  
  const [customers, setCustomers] = useState<Customer[]>(() => getStored('rw_crm_customers', []));
  const [leads, setLeads] = useState<Lead[]>(() => getStored('rw_crm_leads', []));
  const [messages, setMessages] = useState<Message[]>(() => getStored('rw_crm_messages', []));
  const [followups, setFollowups] = useState<Followup[]>(() => getStored('rw_crm_followups', INITIAL_FOLLOWUPS));
  const [notes, setNotes] = useState<LeadNote[]>(() => getStored('rw_crm_notes', INITIAL_NOTES));
  const [stageHistories, setStageHistories] = useState<LeadStageHistory[]>(() => getStored('rw_crm_stage_histories', INITIAL_STAGE_HISTORY));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => getStored('rw_crm_audit_logs', INITIAL_AUDIT_LOGS));
  
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
  const [hasMetaConfig, setHasMetaConfig] = useState<boolean>(() => Boolean(localStorage.getItem('meta_access_token')));

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

  useEffect(() => {
    try {
      localStorage.setItem('rw_crm_messages', JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

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

  // Simulator state
  const [simulatorSession, setSimulatorSession] = useState<OnboardingSession>({
    waId: '+9470' + Math.floor(1000000 + Math.random() * 9000000),
    name: 'WhatsApp Tester',
    state: 'AwaitingLanguage',
    updatedAt: new Date().toISOString(),
  });

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
      const authHeaders = {
        'Authorization': `Bearer ${currentUser?.id || 'user-admin-1'}`,
        'x-coordinator-id': currentUser?.id || 'user-admin-1'
      };

      const [leadsRes, msgsRes, metaRes, coordsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/leads`, { headers: authHeaders }).catch(() => null),
        fetch(`${API_BASE_URL}/api/messages`, { headers: authHeaders }).catch(() => null),
        fetch(`${API_BASE_URL}/api/meta/config`).catch(() => null),
        fetch(`${API_BASE_URL}/api/coordinators`, { headers: authHeaders }).catch(() => null)
      ]);

      if (metaRes && metaRes.ok) {
        const metaData = await metaRes.json().catch(() => null);
        if (metaData && metaData.accessToken) {
          localStorage.setItem('meta_access_token', metaData.accessToken);
          setHasMetaConfig(true);
        }
      }

      if (coordsRes && coordsRes.ok) {
        const dbCoords: any[] = await coordsRes.json().catch(() => []);
        if (Array.isArray(dbCoords)) {
          const userMap = new Map<string, User>();
          // Ensure Super Admin is always present
          INITIAL_USERS.forEach(u => userMap.set(u.id, u));
          dbCoords.forEach(u => {
            userMap.set(u.id, {
              ...u,
              password: u.password || 'staff',
              pin: u.pin || '2026',
              active: u.active ?? true,
              activeLeadsCount: u.activeLeadsCount || 0
            });
          });
          const updatedUsers = Array.from(userMap.values());
          setUsers(updatedUsers);
          localStorage.setItem('rw_crm_users', JSON.stringify(updatedUsers));
        }
      }

      let fetchedDbLeads: any[] = [];
      if (leadsRes && leadsRes.ok) {
        fetchedDbLeads = await leadsRes.json().catch(() => []);
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

            hydratedLeads.push({
              ...l,
              assignedTo: l.assignedTo || undefined,
              stage: l.stage || 'new',
              customer: finalCust
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
            return allowedLeads[0]?.id || null;
          });
        }
      }

      const collectedRawMessages: any[] = [];
      if (Array.isArray(fetchedDbLeads)) {
        fetchedDbLeads.forEach(l => {
          if (Array.isArray(l.messages)) {
            l.messages.forEach((m: any) => collectedRawMessages.push(m));
          }
        });
      }

      if (msgsRes && msgsRes.ok) {
        const dbMessages: any[] = await msgsRes.json().catch(() => []);
        if (Array.isArray(dbMessages)) {
          dbMessages.forEach((m: any) => collectedRawMessages.push(m));
        }
      }

      const msgMap = new Map<string, Message>();
      collectedRawMessages
        .filter(m => (m.content && m.content.trim().length > 0) || Boolean(m.mediaUrl))
        .forEach(m => {
          const formatted: Message = {
            id: m.id,
            leadId: m.leadId,
            customerId: m.customerId,
            direction: m.direction,
            senderType: m.senderType || (m.direction === 'outbound' ? 'coordinator' : 'customer'),
            content: m.content || '',
            status: m.status || 'delivered',
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
          };
          msgMap.set(formatted.id, formatted);
        });

      const finalMessages = Array.from(msgMap.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      setMessages(finalMessages);
      localStorage.setItem('rw_crm_messages', JSON.stringify(finalMessages));
    } catch (e) {
      console.warn('Could not fetch persistent MySQL database state:', e);
    }
  };

  // Hydrate on mount & whenever logged-in staff switches
  useEffect(() => {
    fetchInitialData();

    // Fetch this coordinator's specific WhatsApp line status
    const fetchMyStatus = async () => {
      try {
        const token = localStorage.getItem('rw_crm_auth_token') || currentUser?.id || 'user-admin-1';
        const res = await fetch(`${API_BASE_URL}/api/status?coordinatorId=${currentUser.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-coordinator-id': currentUser.id
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

    // Sync Meta API token from backend if not present in local storage
    if (!localStorage.getItem('meta_access_token')) {
      fetch(`${API_BASE_URL}/api/meta/config`)
        .then(res => res.json())
        .then(data => {
          if (data.accessToken) {
            localStorage.setItem('meta_access_token', data.accessToken);
          }
        })
        .catch(() => {});
    }
  }, [currentUser?.id]);

  const isSuperAdmin = currentUser.role === 'super_admin';
  const isLeadsOfficer = currentUser.role === 'leads_officer';
  const isCoordinator = currentUser.role === 'coordinator';
  const canAssignLeads = isSuperAdmin || isLeadsOfficer;

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
      const coordId = currentUser?.id || 'user-admin-1';
      eventSource = new EventSource(`${API_BASE_URL}/api/events?token=${coordId}&coordinatorId=${coordId}`);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'CONNECTION_STATUS') {
            if (data.status) {
              setWhatsappStatus(data.status);
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
                const nextLeads = [...prevLeads];
                nextLeads[matchIdx] = {
                  ...nextLeads[matchIdx],
                  id: incomingLead?.id || nextLeads[matchIdx].id,
                  assignedTo: assignedCoordId || undefined,
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

          if (data.type === 'COORDINATOR_DELETED') {
            const { coordinatorId: deletedCoordId } = data;
            if (deletedCoordId) {
              const deletedIds = getStored<string[]>('rw_crm_deleted_users', []);
              if (!deletedIds.includes(deletedCoordId)) {
                localStorage.setItem('rw_crm_deleted_users', JSON.stringify([...deletedIds, deletedCoordId]));
              }
              setUsers(prev => prev.filter(u => u.id !== deletedCoordId));
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

          if (data.type === 'INBOUND_WHATSAPP_MESSAGE' || data.type === 'OUTBOUND_WHATSAPP_MESSAGE') {
            // Skip empty protocol messages without text or media
            if ((!data.text || data.text.trim().length === 0) && !data.media) {
              return;
            }

            console.log('[CRM SSE DEBUG] event received:', data.type, 'message ID:', data.messageId, 'conversation ID:', data.leadId);
            const { phone, whatsappId, realPhone, name, avatarUrl, text, messageId, timestamp, direction, senderType } = data;
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
                const newLead: Lead = {
                  id: resolvedLeadId,
                  customerId: resolvedCustomerId,
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
                  categoryId: 'cat-hair-care',
                  treatmentId: 'trt-prp-hair',
                  stage: isOutbound ? 'contacted' : 'new',
                  assignedTo: undefined,
                  source: 'whatsapp',
                  language: 'en',
                  notesCount: 0,
                  unreadCount: isOutbound ? 0 : 1,
                  lastCustomerMessageAt: timestamp || new Date().toISOString(),
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

                    return { 
                      ...l, 
                      customer: updatedCustomer,
                      unreadCount: isOutbound ? 0 : (isCurrentlyActive ? 0 : (l.unreadCount || 0) + 1),
                      lastCustomerMessageAt: timestamp || new Date().toISOString(),
                      updatedAt: new Date().toISOString() 
                    };
                  }
                  return l;
                });
              }
            });

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
    } catch (e) {
      console.warn('Webhook SSE connection unavailable:', e);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [currentUser?.id]);

  // Mark chat as read and clear unread badge
  const markChatAsRead = (leadId: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, unreadCount: 0 } : l));
    setMessages(prev => prev.map(m => m.leadId === leadId ? { ...m, status: 'read' } : m));
  };

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

  // Assign lead
  const assignLead = (leadId: string, coordinatorId: string) => {
    const targetLead = leads.find(l => l.id === leadId);

    // If unassigning (-- Assign to Coordinator --)
    if (!coordinatorId) {
      setLeads(prev => prev.map(l => {
        if (l.id === leadId) {
          logAudit('LEAD_UNASSIGNED', 'Assignment', leadId, { assignedTo: l.assignedTo }, { assignedTo: undefined, stage: 'new' });
          return {
            ...l,
            assignedTo: undefined,
            stage: 'new' as LeadStage,
            updatedAt: new Date().toISOString()
          };
        }
        return l;
      }));

      // Sync unassignment to backend
      fetch(`${API_BASE_URL}/api/leads/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.id || 'user-admin-1'}`,
          'x-coordinator-id': currentUser?.id || 'user-admin-1'
        },
        body: JSON.stringify({
          leadId,
          coordinatorId: '',
          unassign: true,
          customerId: targetLead?.customerId,
          phone: targetLead?.customer?.whatsappNumber,
          whatsappId: targetLead?.customer?.whatsappId
        })
      }).catch(err => console.warn('Could not sync lead unassignment to backend:', err));

      notify('Lead Unassigned', 'Lead marked as Unassigned', 'info');
      return;
    }

    const coord = users.find(u => u.id === coordinatorId);
    if (!coord) return;

    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const prevStage = l.stage;
        const newStage: LeadStage = prevStage === 'new' ? 'assigned' : prevStage;
        
        // Audit log
        logAudit('LEAD_ASSIGNED', 'Assignment', leadId, { assignedTo: l.assignedTo, stage: prevStage }, { assignedTo: coordinatorId, stage: newStage });

        // Add stage history if stage moved from new -> assigned
        if (prevStage === 'new') {
          const hist: LeadStageHistory = {
            id: 'hist-' + Date.now(),
            leadId,
            fromStage: 'new',
            toStage: 'assigned',
            changedBy: currentUser.id,
            changedByName: currentUser.fullName,
            reason: `Assigned to coordinator ${coord.fullName}`,
            createdAt: new Date().toISOString(),
          };
          setStageHistories(h => [hist, ...h]);
        }

        return {
          ...l,
          assignedTo: coordinatorId,
          stage: newStage,
          updatedAt: new Date().toISOString(),
        };
      }
      return l;
    }));

    // Sync assignment to Supabase PostgreSQL backend in real-time
    fetch(`${API_BASE_URL}/api/leads/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser?.id || 'user-admin-1'}`,
        'x-coordinator-id': currentUser?.id || 'user-admin-1'
      },
      body: JSON.stringify({
        leadId,
        coordinatorId,
        coordinatorName: coord.fullName,
        customerId: targetLead?.customerId,
        phone: targetLead?.customer?.whatsappNumber,
        whatsappId: targetLead?.customer?.whatsappId
      })
    }).catch(err => console.warn('Could not sync lead assignment to backend:', err));

    notify('Lead Assigned', `Lead successfully assigned to ${coord.fullName}`, 'success');
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

    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          stage: newStage,
          updatedAt: new Date().toISOString(),
        };
      }
      return l;
    }));

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
    const hasMetaToken = !!localStorage.getItem('meta_access_token');
    if (!leadId.startsWith('lead-sim') && whatsappStatus !== 'connected' && !hasMetaToken) {
      notify('WhatsApp Disconnected', 'Please link your WhatsApp or configure Meta API first to send messages.', 'warning');
      setQrModalOpen(true);
      return;
    }

    const newMsg: Message = {
      id: 'msg-' + Date.now(),
      leadId,
      customerId: lead.customerId,
      direction: 'outbound',
      senderType,
      content,
      media,
      replyTo: replyTo || (replyingMessage ? {
        id: replyingMessage.id,
        content: replyingMessage.content,
        senderName: replyingMessage.direction === 'inbound' 
          ? (lead.customer?.displayName || 'Customer')
          : currentUser.fullName
      } : undefined),
      waMessageId: 'wamid.HBg' + Date.now(),
      status: 'delivered',
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newMsg]);
    setReplyingMessage(null); // Clear replying state after sending

    // Auto-advance stage if New or Assigned -> Contacted
    if (lead.stage === 'new' || lead.stage === 'assigned') {
      updateLeadStage(leadId, 'contacted', 'First WhatsApp message sent');
    }

    // Dispatch to WhatsApp bridge (Supports both linked QR session & Meta API)
    const recipientPhone = lead.customer?.whatsappNumber;
    const recipientWaId = lead.customer?.whatsappId;
    const savedToken = localStorage.getItem('meta_access_token');
    
    if ((recipientPhone || recipientWaId) && !leadId.startsWith('lead-sim')) {
      fetch(`${API_BASE_URL}/api/send-message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.id || 'user-admin-1'}`,
          'x-coordinator-id': currentUser?.id || 'user-admin-1'
        },
        body: JSON.stringify({
          to: recipientPhone,
          whatsappId: recipientWaId,
          text: content,
          message: content,
          media: media || undefined,
          leadId: lead.id,
          customerId: lead.customerId,
          token: savedToken || undefined,
          phoneNumberId: '1358157244046701'
        })
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Failed to send message via WhatsApp' }));
          console.warn('❌ WhatsApp send error:', err);
          setMessages(prev => prev.map(m => m.id === newMsg.id ? {
            ...m,
            status: 'failed' as any
          } : m));
          notify('Delivery Failed', err.error || 'Could not deliver message to customer.', 'warning');
        } else {
          const data = await res.json().catch(() => ({}));
          console.log('✅ Outbound WhatsApp message delivered! ID:', data.messageId);
          if (data.messageId) {
            setMessages(prev => prev.map(m => m.id === newMsg.id ? {
              ...m,
              id: data.messageId,
              waMessageId: data.messageId,
              status: 'sent'
            } : m));
          }
          notify('Message Delivered', `Outbound WhatsApp message delivered to ${lead.customer?.displayName || 'client'}`, 'success');
        }
      }).catch(err => {
        console.warn('WhatsApp bridge offline:', err);
        setMessages(prev => prev.map(m => m.id === newMsg.id ? {
          ...m,
          status: 'failed' as any
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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

  // Forward message to another lead
  const forwardMessage = (messageId: string, targetLeadId: string) => {
    const sourceMsg = messages.find(m => m.id === messageId);
    const targetLead = leads.find(l => l.id === targetLeadId);
    if (!sourceMsg || !targetLead) return;
    
    sendMessage(targetLeadId, sourceMsg.content, 'coordinator', sourceMsg.media);
    notify('Message Forwarded ➡️', `Message forwarded to ${targetLead.customer?.displayName || 'contact'}`, 'success');
  };

  // Send approved WhatsApp template
  const sendWhatsAppTemplate = (leadId: string, templateId: string, params: string[]) => {
    const template = templates.find(t => t.id === templateId);
    const lead = leads.find(l => l.id === leadId);
    if (!template || !lead) return;

    let body = template.body;
    params.forEach((param, idx) => {
      body = body.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), param);
    });

    sendMessage(leadId, body, 'coordinator');
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

  const addTreatment = (trt: Omit<Treatment, 'id'>) => {
    const newTrt: Treatment = {
      ...trt,
      id: 'trt-' + Date.now(),
    };
    setTreatments(prev => [...prev, newTrt]);
    logAudit('CREATE_TREATMENT', 'Treatment', newTrt.id, null, newTrt);
    notify('Treatment Added', `${newTrt.name} added to service menu`, 'success');
  };

  const updateTreatment = (id: string, updates: Partial<Treatment>) => {
    setTreatments(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    logAudit('UPDATE_TREATMENT', 'Treatment', id, null, updates);
    notify('Treatment Updated', 'Service details updated', 'info');
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
    notify('Customer Updated', 'WhatsApp contact details saved', 'success');
  };

  const addCoordinator = (data: { fullName: string; branch?: string; email?: string; password?: string; pin?: string; phone?: string; role?: UserRole; treatmentCategoryId?: string; language?: LanguageCode }) => {
    const role: UserRole = data.role === 'leads_officer' ? 'leads_officer' : 'coordinator';
    const newCoordId = (role === 'leads_officer' ? 'officer-' : 'coord-') + Date.now();
    const cleanBranch = data.branch || 'Colombo';
    const autoEmail = data.email || `${data.fullName.toLowerCase().replace(/[^a-z0-9]/g, '') || (role === 'leads_officer' ? 'officer' : 'coord') + Date.now()}@royalwellness.lk`;

    const newCoord: User = {
      id: newCoordId,
      fullName: data.fullName,
      branch: cleanBranch,
      email: autoEmail,
      password: data.password || 'staff',
      pin: data.pin || '2026',
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

    setUsers(prev => {
      const updated = [...prev, newCoord];
      localStorage.setItem('rw_crm_users', JSON.stringify(updated));
      return updated;
    });

    // Sync coordinator / staff creation to backend
    fetch(`${API_BASE_URL}/api/coordinators`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser?.id || 'user-admin-1'}`,
        'x-coordinator-id': currentUser?.id || 'user-admin-1'
      },
      body: JSON.stringify({
        id: newCoordId,
        fullName: data.fullName,
        branch: cleanBranch,
        email: autoEmail,
        pin: data.pin || '2026',
        phone: data.phone,
        role: role
      })
    }).catch(err => console.warn('Could not sync new staff member to backend:', err));

    logAudit('CREATE_USER', 'User', newCoord.id, null, newCoord);
    const roleLabel = role === 'leads_officer' ? 'Leads Officer' : 'Clinical Coordinator';
    notify('Staff Added', `${roleLabel} ${newCoord.fullName} (${cleanBranch}) registered with PIN ${newCoord.pin}`, 'success');
  };

  const deleteCoordinator = (id: string) => {
    // 1. Record deleted coordinator ID
    const deletedUserIds = getStored<string[]>('rw_crm_deleted_users', []);
    if (!deletedUserIds.includes(id)) {
      const updatedDeleted = [...deletedUserIds, id];
      localStorage.setItem('rw_crm_deleted_users', JSON.stringify(updatedDeleted));
    }

    // 2. Remove coordinator from state & localStorage
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

    // 4. If current logged in user was this coordinator, fallback to admin
    if (currentUser.id === id) {
      setCurrentUser(prev => {
        const storedUsers = getStored<User[]>('rw_crm_users', INITIAL_USERS).filter(u => u.id !== id);
        const fallback = storedUsers[0] || INITIAL_USERS[0];
        localStorage.setItem('rw_crm_auth_user_id', fallback.id);
        return fallback;
      });
    }

    // 5. Notify backend to permanently remove coordinator & unassign database records
    fetch(`${API_BASE_URL}/api/coordinators/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${currentUser?.id || 'user-admin-1'}`,
        'x-coordinator-id': currentUser?.id || 'user-admin-1'
      }
    }).catch(err => console.warn('Could not sync coordinator deletion to backend:', err));

    logAudit('DELETE_USER', 'User', id, null, null);
    notify('Coordinator Deleted', 'Coordinator removed and assigned leads reverted to Unassigned.', 'info');
  };

  const login = (identifier: string, secret?: string) => {
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanSecret = (secret || '').trim();

    const matchedUser = users.find(u => 
      u.email.toLowerCase() === cleanId || 
      u.id.toLowerCase() === cleanId ||
      u.fullName.toLowerCase() === cleanId ||
      (u.phone && u.phone.includes(cleanId))
    );

    if (!matchedUser) {
      return { success: false, error: 'Staff account not found. Check email or select profile.' };
    }

    if (!matchedUser.active) {
      return { success: false, error: 'This staff account has been deactivated.' };
    }

    // Verify PIN or Password
    const userPassword = matchedUser.password || (matchedUser.role === 'super_admin' ? 'admin' : 'staff');
    const userPin = matchedUser.pin || (matchedUser.role === 'super_admin' ? '1234' : '2026');

    if (cleanSecret) {
      const isPinMatch = cleanSecret === userPin;
      const isPassMatch = cleanSecret === userPassword;
      if (!isPinMatch && !isPassMatch) {
        return { success: false, error: cleanSecret.length === 4 ? 'Incorrect 4-digit PIN.' : 'Incorrect password.' };
      }
    }

    setCurrentUser(matchedUser);
    setIsAuthenticated(true);
    localStorage.setItem('rw_crm_auth_user_id', matchedUser.id);
    logAudit('USER_LOGIN', 'User', matchedUser.id, null, { email: matchedUser.email, role: matchedUser.role });
    notify('Welcome Back', `Signed in as ${matchedUser.fullName}`, 'success');
    return { success: true };
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('rw_crm_auth_user_id');
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
    fetch(`${API_BASE_URL}/api/clear-db`, { method: 'POST' }).catch(() => {});

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
    const trtLabel = trtObj?.nameI18n[lang] || trtObj?.name || 'Treatment';

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
    addLeadNote,
    sendMessage,
    replyingMessage,
    setReplyingMessage,
    reactToMessage,
    starMessage,
    pinMessage,
    deleteMessage,
    forwardMessage,
    deleteChat,
    clearChat,
    sendWhatsAppTemplate,
    markChatAsRead,
    cancelFollowup,
    pauseFollowup,
    resumeFollowup,
    triggerFollowupNow,
    addCategory,
    updateCategory,
    addTreatment,
    updateTreatment,
    addTemplate,
    updateTemplate,
    updateSequence,
    updateCustomer,
    addCoordinator,
    deleteCoordinator,
    clearAllData,
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
