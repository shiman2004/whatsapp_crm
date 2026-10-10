import React, { useState, useRef, useEffect } from 'react';
import { useCrm } from '../../context/CrmContext';
import { WhatsAppAvatar } from './WhatsAppAvatar';
import { STAGE_CONFIG } from '../leads/StageBadge';
import { 
  Search, 
  CheckCheck, 
  Archive, 
  Pin, 
  Lock, 
  Mail, 
  Heart, 
  ListPlus, 
  Trash2, 
  Slash, 
  ChevronDown,
  ChevronRight,
  Camera,
  Mic,
  User,
  UserPlus,
  Check,
  Tag
} from 'lucide-react';
import { Lead } from '../../types';
import { formatWhatsAppDisplay } from '../../utils/phoneUtils';
import { AddContactModal } from './AddContactModal';

interface WhatsAppChatListProps {
  onSelectLead: (leadId: string) => void;
  className?: string;
}

export const PRESET_LABELS = [
  { id: 'vip', name: 'VIP Patient', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', dot: 'bg-amber-400' },
  { id: 'hot', name: 'Hot Lead', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30', dot: 'bg-rose-400' },
  { id: 'booked', name: 'Consultation Booked', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
  { id: 'followup', name: 'Follow-up Needed', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30', dot: 'bg-sky-400' },
  { id: 'prescription', name: 'Prescription Sent', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', dot: 'bg-purple-400' }
];

export const WhatsAppChatList: React.FC<WhatsAppChatListProps> = ({ onSelectLead, className = '' }) => {
  const { 
    leads, 
    messages, 
    users,
    currentUser, 
    isSuperAdmin, 
    isLeadsOfficer,
    selectedLeadId, 
    categories,
    markChatAsRead,
    markChatAsUnread,
    deleteChat,
    clearChat
  } = useCrm();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  
  // Context Menu State
  const [contextMenuLeadId, setContextMenuLeadId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [isLabelSubmenuOpen, setIsLabelSubmenuOpen] = useState(false);

  // Persistent States
  const [pinnedLeadIds, setPinnedLeadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('rw_crm_pinned_leads');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [favouriteLeadIds, setFavouriteLeadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('rw_crm_favourite_leads');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [archivedLeadIds, setArchivedLeadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('rw_crm_archived_leads');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [lockedLeadIds, setLockedLeadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('rw_crm_locked_leads');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [leadLabels, setLeadLabels] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('rw_crm_lead_labels');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  const menuRef = useRef<HTMLDivElement>(null);

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('rw_crm_pinned_leads', JSON.stringify(Array.from(pinnedLeadIds)));
    } catch (e) { console.warn(e); }
  }, [pinnedLeadIds]);

  useEffect(() => {
    try {
      localStorage.setItem('rw_crm_favourite_leads', JSON.stringify(Array.from(favouriteLeadIds)));
    } catch (e) { console.warn(e); }
  }, [favouriteLeadIds]);

  useEffect(() => {
    try {
      localStorage.setItem('rw_crm_archived_leads', JSON.stringify(Array.from(archivedLeadIds)));
    } catch (e) { console.warn(e); }
  }, [archivedLeadIds]);

  useEffect(() => {
    try {
      localStorage.setItem('rw_crm_locked_leads', JSON.stringify(Array.from(lockedLeadIds)));
    } catch (e) { console.warn(e); }
  }, [lockedLeadIds]);

  useEffect(() => {
    try {
      localStorage.setItem('rw_crm_lead_labels', JSON.stringify(leadLabels));
    } catch (e) { console.warn(e); }
  }, [leadLabels]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuLeadId(null);
        setContextMenuPos(null);
        setIsLabelSubmenuOpen(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Compute the absolute newest activity timestamp for a lead (including latest message from messages array)
  const getLeadLatestTime = (lead: Lead): number => {
    let latest = 0;
    
    // 1. Check all messages associated with this lead or customer
    const leadMsgs = messages.filter(m => 
      m.leadId === lead.id || 
      (lead.customerId && m.customerId === lead.customerId)
    );
    for (const m of leadMsgs) {
      if (m.createdAt) {
        const t = new Date(m.createdAt).getTime();
        if (!isNaN(t) && t > latest) latest = t;
      }
    }

    // 2. Check lead timestamps
    if (lead.lastCustomerMessageAt) {
      const t = new Date(lead.lastCustomerMessageAt).getTime();
      if (!isNaN(t) && t > latest) latest = t;
    }
    if (lead.updatedAt) {
      const t = new Date(lead.updatedAt).getTime();
      if (!isNaN(t) && t > latest) latest = t;
    }
    if (lead.createdAt) {
      const t = new Date(lead.createdAt).getTime();
      if (!isNaN(t) && t > latest) latest = t;
    }

    return latest;
  };

  // Stage counts for quick badges
  const accessibleLeads = leads.filter(l => isSuperAdmin || isLeadsOfficer || l.assignedTo === currentUser.id);
  const totalUnreadCount = accessibleLeads.filter(l => (l.unreadCount || 0) > 0).length;
  const newCount = accessibleLeads.filter(l => (l.stage || 'new') === 'new').length;
  const assignedCount = accessibleLeads.filter(l => l.stage === 'assigned').length;
  const contactedCount = accessibleLeads.filter(l => l.stage === 'contacted').length;
  const potentialCount = accessibleLeads.filter(l => l.stage === 'potential' || (l.stage as any) === 'interested').length;
  const discussionCount = accessibleLeads.filter(l => l.stage === 'under_discussion' || (l.stage as any) === 'follow_up').length;
  const convertedCount = accessibleLeads.filter(l => l.stage === 'converted').length;
  const lostCount = accessibleLeads.filter(l => l.stage === 'lost').length;
  const archivedCount = accessibleLeads.filter(l => archivedLeadIds.has(l.id)).length;

  // Filter leads based on role & search & category/stage/archive filters
  const filteredLeads = accessibleLeads.filter((lead) => {
    const isArchived = archivedLeadIds.has(lead.id);

    // If viewing archived filter
    if (activeFilter === 'archived') {
      if (!isArchived) return false;
    } else {
      // Normal views exclude archived chats
      if (isArchived) return false;
    }

    // Filter pills
    if (activeFilter === 'unread' && (!lead.unreadCount || lead.unreadCount === 0)) return false;
    if (activeFilter === 'favourites' && !favouriteLeadIds.has(lead.id)) return false;
    if (activeFilter === 'new' && (lead.stage || 'new') !== 'new') return false;
    if (activeFilter === 'assigned' && lead.stage !== 'assigned') return false;
    if (activeFilter === 'contacted' && lead.stage !== 'contacted') return false;
    if (activeFilter === 'potential' && lead.stage !== 'potential' && (lead.stage as any) !== 'interested') return false;
    if (activeFilter === 'under_discussion' && lead.stage !== 'under_discussion' && (lead.stage as any) !== 'follow_up') return false;
    if (activeFilter === 'converted' && lead.stage !== 'converted') return false;
    if (activeFilter === 'lost' && lead.stage !== 'lost') return false;

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = lead.customer?.displayName?.toLowerCase().includes(q);
      const matchPhone = lead.customer?.whatsappNumber?.includes(q);
      const matchCategory = categories.find(c => c.id === lead.categoryId)?.name.toLowerCase().includes(q);
      const activeTags = leadLabels[lead.id] || [];
      const matchTag = activeTags.some(t => {
        const found = PRESET_LABELS.find(p => p.id === t);
        return found?.name.toLowerCase().includes(q);
      });
      if (!matchName && !matchPhone && !matchCategory && !matchTag) return false;
    }

    return true;
  }).sort((a, b) => {
    const isPinnedA = pinnedLeadIds.has(a.id);
    const isPinnedB = pinnedLeadIds.has(b.id);
    if (isPinnedA && !isPinnedB) return -1;
    if (!isPinnedA && isPinnedB) return 1;

    const timeA = getLeadLatestTime(a);
    const timeB = getLeadLatestTime(b);
    return timeB - timeA;
  });

  // Deduplicate chats so each customer only ever appears once
  const seenCustMap = new Set<string>();
  const visibleLeads = filteredLeads.filter(lead => {
    const key = lead.customer?.whatsappId || lead.customer?.whatsappNumber || lead.customerId || lead.id;
    if (seenCustMap.has(key)) return false;
    seenCustMap.add(key);
    return true;
  });

  const handleContextMenu = (e: React.MouseEvent, leadId: string) => {
    e.preventDefault();
    setContextMenuLeadId(leadId);
    setIsLabelSubmenuOpen(false);
    const clientX = e.clientX || 150;
    const clientY = e.clientY || 200;
    setContextMenuPos({ 
      x: Math.min(clientX, window.innerWidth - 240), 
      y: Math.min(clientY, window.innerHeight - 340) 
    });
  };

  const togglePin = (leadId: string) => {
    setPinnedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
    setContextMenuLeadId(null);
  };

  const toggleFavourite = (leadId: string) => {
    setFavouriteLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
    setContextMenuLeadId(null);
  };

  const toggleArchive = (leadId: string) => {
    setArchivedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
    setContextMenuLeadId(null);
  };

  const toggleLock = (leadId: string) => {
    setLockedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
    setContextMenuLeadId(null);
  };

  const toggleLeadLabel = (leadId: string, labelId: string) => {
    setLeadLabels(prev => {
      const current = prev[leadId] || [];
      const updated = current.includes(labelId)
        ? current.filter(id => id !== labelId)
        : [...current, labelId];
      return { ...prev, [leadId]: updated };
    });
  };

  const activeContextMenuLead = leads.find(l => l.id === contextMenuLeadId);

  return (
    <div className={`w-full md:w-80 lg:w-[380px] bg-[#111b21] border-r border-[#222e35] flex flex-col h-full select-none shrink-0 ${className}`}>
      
      {/* 1. Header (Exact WhatsApp Web Title Bar) */}
      <div className="h-14 px-4 bg-[#202c33] flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-[#e9edef] tracking-tight flex items-center gap-2">
          <span>WhatsApp</span>
        </h1>
        <button
          onClick={() => setIsAddContactOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00a884] hover:bg-[#00c298] text-black font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          title="Add New Contact"
        >
          <UserPlus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Contact</span>
        </button>
      </div>

      {/* 2. Search Bar & Filter Chips */}
      <div className="px-3 pb-2 bg-[#111b21] space-y-2.5 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-[#8696a0] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or start a new chat"
            className="w-full bg-[#202c33] border-none rounded-lg pl-10 pr-4 py-1.5 text-xs text-[#d1d7db] placeholder-[#8696a0] outline-none focus:ring-1 focus:ring-[#00a884] transition-all"
          />
        </div>

        {/* Filter Chips row with Stages & Counts */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs pb-0.5">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all shrink-0 ${
              activeFilter === 'all'
                ? 'bg-[#00a884]/20 text-[#00a884] font-bold'
                : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
            }`}
          >
            All
          </button>

          {newCount > 0 && (
            <button
              onClick={() => setActiveFilter('new')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1 ${
                activeFilter === 'new'
                  ? 'bg-rose-500/25 text-rose-300 font-bold border border-rose-500/40'
                  : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              <span>New</span>
              <span className="text-[10px] font-mono px-1 rounded bg-rose-500/20 text-rose-300">{newCount}</span>
            </button>
          )}

          {assignedCount > 0 && (
            <button
              onClick={() => setActiveFilter('assigned')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1 ${
                activeFilter === 'assigned'
                  ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40'
                  : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              <span>Assigned</span>
              <span className="text-[10px] font-mono px-1 rounded bg-amber-500/20 text-amber-300">{assignedCount}</span>
            </button>
          )}

          {contactedCount > 0 && (
            <button
              onClick={() => setActiveFilter('contacted')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1 ${
                activeFilter === 'contacted'
                  ? 'bg-emerald-500/25 text-emerald-300 font-bold border border-emerald-500/40'
                  : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              <span>Contacted</span>
              <span className="text-[10px] font-mono px-1 rounded bg-emerald-500/20 text-emerald-300">{contactedCount}</span>
            </button>
          )}

          {potentialCount > 0 && (
            <button
              onClick={() => setActiveFilter('potential')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1 ${
                activeFilter === 'potential'
                  ? 'bg-purple-500/25 text-purple-300 font-bold border border-purple-500/40'
                  : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              <span>Potential</span>
              <span className="text-[10px] font-mono px-1 rounded bg-purple-500/20 text-purple-300">{potentialCount}</span>
            </button>
          )}

          {discussionCount > 0 && (
            <button
              onClick={() => setActiveFilter('under_discussion')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1 ${
                activeFilter === 'under_discussion'
                  ? 'bg-sky-500/25 text-sky-300 font-bold border border-sky-500/40'
                  : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              <span>Discussion</span>
              <span className="text-[10px] font-mono px-1 rounded bg-sky-500/20 text-sky-300">{discussionCount}</span>
            </button>
          )}

          {convertedCount > 0 && (
            <button
              onClick={() => setActiveFilter('converted')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1 ${
                activeFilter === 'converted'
                  ? 'bg-teal-500/25 text-teal-300 font-bold border border-teal-500/40'
                  : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              <span>Converted</span>
              <span className="text-[10px] font-mono px-1 rounded bg-teal-500/20 text-teal-300">{convertedCount}</span>
            </button>
          )}

          {lostCount > 0 && (
            <button
              onClick={() => setActiveFilter('lost')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1 ${
                activeFilter === 'lost'
                  ? 'bg-red-500/25 text-red-300 font-bold border border-red-500/40'
                  : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              <span>Lost</span>
              <span className="text-[10px] font-mono px-1 rounded bg-red-500/20 text-red-300">{lostCount}</span>
            </button>
          )}

          <button
            onClick={() => setActiveFilter('unread')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
              activeFilter === 'unread'
                ? 'bg-[#00a884]/20 text-[#00a884] font-semibold'
                : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
            }`}
          >
            <span>Unread</span>
            {totalUnreadCount > 0 && (
              <span className="text-[10px] font-bold opacity-80">{totalUnreadCount}</span>
            )}
          </button>

          <button
            onClick={() => setActiveFilter('favourites')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 flex items-center gap-1 ${
              activeFilter === 'favourites'
                ? 'bg-[#00a884]/20 text-[#00a884] font-semibold'
                : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
            }`}
          >
            <Heart className="w-3 h-3 text-rose-400 fill-current" />
            <span>Favourites</span>
          </button>
        </div>
      </div>

      {/* 3. Archived Row Banner */}
      <div 
        onClick={() => setActiveFilter(prev => prev === 'archived' ? 'all' : 'archived')}
        className={`px-4 py-2 cursor-pointer flex items-center justify-between border-b border-[#222e35]/60 transition-colors shrink-0 ${
          activeFilter === 'archived' ? 'bg-[#00a884]/15 border-[#00a884]/40' : 'hover:bg-[#202c33]'
        }`}
      >
        <div className="flex items-center gap-3 text-[#8696a0]">
          <Archive className={`w-3.5 h-3.5 ${activeFilter === 'archived' ? 'text-[#00a884]' : 'text-[#8696a0]'}`} />
          <span className={`text-xs font-medium ${activeFilter === 'archived' ? 'text-[#00a884] font-bold' : 'text-[#d1d7db]'}`}>
            Archived Chats
          </span>
        </div>
        {archivedCount > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#202c33] text-[#8696a0]">
            {archivedCount}
          </span>
        )}
      </div>

      {/* 4. Chat Items Stream with Aesthetic & Compact Tags */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#222e35]/40">
        {visibleLeads.length === 0 ? (
          <div className="p-8 text-center text-[#8696a0] text-xs">
            <p>{activeFilter === 'archived' ? 'No archived chats' : 'No chats found'}</p>
          </div>
        ) : (
          visibleLeads.map((lead) => {
            const isSelected = selectedLeadId === lead.id;
            const leadMsgs = messages.filter(m => m.leadId === lead.id || (lead.customerId && m.customerId === lead.customerId));
            leadMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            const lastMsg = leadMsgs[leadMsgs.length - 1];
            const isPinned = pinnedLeadIds.has(lead.id);
            const isFav = favouriteLeadIds.has(lead.id);
            const isLocked = lockedLeadIds.has(lead.id);
            const appliedLabels = (leadLabels[lead.id] || []).map(id => PRESET_LABELS.find(p => p.id === id)).filter(Boolean);

            // Format timestamp matching WhatsApp Web: "12:27", "Sunday", "Yesterday"
            const latestTimeMs = getLeadLatestTime(lead);
            const msgDate = latestTimeMs > 0 ? new Date(latestTimeMs) : new Date(lead.updatedAt || lead.createdAt);
            const isToday = new Date().toDateString() === msgDate.toDateString();
            const timeDisplay = isNaN(msgDate.getTime())
              ? ''
              : (isToday 
                  ? msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : msgDate.toLocaleDateString([], { weekday: 'short' }));

            const displayName = lead.customer?.displayName || formatWhatsAppDisplay(lead.customer?.whatsappNumber || '');
            
            // Stage configuration
            const stageCfg = STAGE_CONFIG[lead.stage || 'new'] || STAGE_CONFIG.new;

            // Coordinator configuration
            const coordinator = users.find(u => u.id === lead.assignedTo);
            const coordinatorName = coordinator ? coordinator.fullName : (lead.assignedTo || 'Unassigned');

            return (
              <div
                key={lead.id}
                onClick={() => {
                  onSelectLead(lead.id);
                  markChatAsRead(lead.id);
                }}
                onContextMenu={(e) => handleContextMenu(e, lead.id)}
                className={`group px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors relative border-b border-[#222e35]/30 ${
                  isSelected ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                }`}
              >
                {/* Contact Avatar on the far-left */}
                <WhatsAppAvatar
                  name={displayName}
                  avatarUrl={lead.customer?.avatarUrl}
                  size="md"
                  isOnline={true}
                />

                {/* Chat Middle Content */}
                <div className="flex-1 min-w-0 pr-1">
                  
                  {/* Top Line: Contact Name + Micro Stage Badge + Time */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="text-xs font-semibold text-[#e9edef] truncate max-w-[140px]">
                        {displayName}
                      </span>

                      {/* Locked Chat Indicator */}
                      {isLocked && (
                        <span title="Chat is locked" className="text-amber-400">
                          <Lock className="w-3 h-3" />
                        </span>
                      )}

                      {/* Favourite Chat Indicator */}
                      {isFav && (
                        <span title="Favourite chat" className="text-rose-400">
                          <Heart className="w-3 h-3 fill-current" />
                        </span>
                      )}

                      {/* Aesthetic Micro Stage Badge */}
                      <span className={`inline-block px-1.5 py-0.2 rounded text-[8.5px] font-extrabold tracking-wider border uppercase shrink-0 shadow-sm ${stageCfg.pillBg} ${stageCfg.pillText} ${stageCfg.pillBorder}`}>
                        {stageCfg.shortLabel}
                      </span>
                      {/* Language Tag */}
                      <span className="inline-block px-1.5 py-0.2 rounded text-[8px] font-extrabold tracking-wider border uppercase shrink-0 shadow-sm bg-sky-500/15 text-sky-300 border-sky-500/30">
                        {((lead.language || lead.customer?.preferredLanguage || 'en').toLowerCase() === 'si' ? 'SI' : (lead.language || lead.customer?.preferredLanguage || 'en').toLowerCase() === 'ta' ? 'TA' : 'EN')}
                      </span>
                    </div>

                    <span className={`text-[10px] font-mono shrink-0 ${
                      (lead.unreadCount || 0) > 0 ? 'text-[#00a884] font-bold' : 'text-[#8696a0]'
                    }`}>
                      {timeDisplay}
                    </span>
                  </div>

                  {/* Micro Tag Badges (VIP, Hot Lead, etc.) */}
                  {appliedLabels.length > 0 && (
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {appliedLabels.map((lbl: any) => (
                        <span key={lbl.id} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-semibold border ${lbl.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${lbl.dot}`} />
                          <span>{lbl.name}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Middle Line: Last Message Snippet + Unread Indicator */}
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className="flex items-center gap-1 min-w-0 text-[#8696a0] text-[11px] truncate">
                      {lastMsg?.direction === 'outbound' && (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />
                      )}
                      {lastMsg?.content?.includes('[Media') || lastMsg?.media?.type === 'image' ? (
                        <span className="flex items-center gap-1 text-[#8696a0]">
                          <Camera className="w-3 h-3" /> Photo
                        </span>
                      ) : lastMsg?.media?.type === 'audio' || lastMsg?.content === 'Voice note' || lastMsg?.media?.url?.match(/\.(ogg|mp3|wav|m4a)($|\?)/i) ? (
                        <span className="flex items-center gap-1 text-[#00a884]">
                          <Mic className="w-3 h-3 text-[#00a884]" /> Voice message
                        </span>
                      ) : (
                        <span className="truncate">{lastMsg?.content || 'Started WhatsApp chat'}</span>
                      )}
                    </div>

                    {/* Right Indicators: Pin / Unread Badge */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isPinned && <Pin className="w-3 h-3 text-[#8696a0] fill-current" />}
                      {(lead.unreadCount || 0) > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#00a884] text-black font-bold text-[10px] flex items-center justify-center shadow">
                          {lead.unreadCount}
                        </span>
                      )}
                      
                      {/* Hover Chevron for Context Menu */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, lead.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-white transition-opacity"
                        title="Chat options"
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-[#8696a0]" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Line: Aesthetic Coordinator Tag */}
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] font-medium">
                    <User className="w-2.5 h-2.5 text-teal-400 shrink-0" />
                    <span className={coordinator ? 'text-teal-300 font-semibold' : 'text-slate-500 italic'}>
                      Assigned to: {coordinatorName}
                    </span>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. WhatsApp Web Context Menu & Submenus */}
      {contextMenuLeadId && contextMenuPos && (
        <div
          ref={menuRef}
          style={{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }}
          className="fixed wa-context-menu rounded-xl py-1.5 w-52 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 select-none text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Archive / Unarchive */}
          <div 
            className="wa-context-item" 
            onClick={() => toggleArchive(contextMenuLeadId)}
          >
            <Archive className="w-4 h-4 text-[#8696a0]" />
            <span>{archivedLeadIds.has(contextMenuLeadId) ? 'Unarchive chat' : 'Archive chat'}</span>
          </div>

          {/* 2. Lock / Unlock */}
          <div 
            className="wa-context-item" 
            onClick={() => toggleLock(contextMenuLeadId)}
          >
            <Lock className={`w-4 h-4 ${lockedLeadIds.has(contextMenuLeadId) ? 'text-amber-400' : 'text-[#8696a0]'}`} />
            <span>{lockedLeadIds.has(contextMenuLeadId) ? 'Unlock chat' : 'Lock chat'}</span>
          </div>

          {/* 3. Pin / Unpin */}
          <div 
            className="wa-context-item" 
            onClick={() => togglePin(contextMenuLeadId)}
          >
            <Pin className={`w-4 h-4 ${pinnedLeadIds.has(contextMenuLeadId) ? 'text-[#00a884]' : 'text-[#8696a0]'}`} />
            <span>{pinnedLeadIds.has(contextMenuLeadId) ? 'Unpin chat' : 'Pin chat'}</span>
          </div>

          {/* 4. Mark as read / Mark as unread */}
          <div 
            className="wa-context-item" 
            onClick={() => {
              if (activeContextMenuLead && (activeContextMenuLead.unreadCount || 0) > 0) {
                markChatAsRead(contextMenuLeadId);
              } else {
                markChatAsUnread(contextMenuLeadId);
              }
              setContextMenuLeadId(null);
            }}
          >
            <Mail className="w-4 h-4 text-[#8696a0]" />
            <span>{(activeContextMenuLead?.unreadCount || 0) > 0 ? 'Mark as read' : 'Mark as unread'}</span>
          </div>

          {/* 5. Add to favourites / Remove from favourites */}
          <div 
            className="wa-context-item" 
            onClick={() => toggleFavourite(contextMenuLeadId)}
          >
            <Heart className={`w-4 h-4 ${favouriteLeadIds.has(contextMenuLeadId) ? 'text-rose-400 fill-current' : 'text-[#8696a0]'}`} />
            <span>{favouriteLeadIds.has(contextMenuLeadId) ? 'Remove from favourites' : 'Add to favourites'}</span>
          </div>

          {/* 6. Add to list > (Custom Labels Submenu) */}
          <div 
            className="wa-context-item relative justify-between group/list"
            onMouseEnter={() => setIsLabelSubmenuOpen(true)}
            onClick={() => setIsLabelSubmenuOpen(!isLabelSubmenuOpen)}
          >
            <div className="flex items-center gap-3">
              <ListPlus className="w-4 h-4 text-[#8696a0]" />
              <span>Add to list</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#8696a0]" />

            {/* Nested Submenu */}
            {isLabelSubmenuOpen && (
              <div 
                className="absolute left-full top-0 ml-1.5 w-56 wa-context-menu rounded-xl py-1.5 shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95 duration-75"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-[#8696a0] uppercase border-b border-[#222e35]/60 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  <span>Assign Labels</span>
                </div>
                {PRESET_LABELS.map(lbl => {
                  const isActive = (leadLabels[contextMenuLeadId] || []).includes(lbl.id);
                  return (
                    <div
                      key={lbl.id}
                      onClick={() => toggleLeadLabel(contextMenuLeadId, lbl.id)}
                      className="wa-context-item justify-between py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${lbl.dot}`} />
                        <span className={isActive ? 'text-white font-semibold' : 'text-[#d1d7db]'}>
                          {lbl.name}
                        </span>
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-[#00a884] stroke-[2.5]" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-700/60 my-1" />

          {/* 7. Clear chat */}
          <div 
            className="wa-context-item" 
            onClick={() => {
              if (contextMenuLeadId) clearChat(contextMenuLeadId);
              setContextMenuLeadId(null);
            }}
          >
            <Slash className="w-4 h-4 text-[#8696a0]" />
            <span>Clear chat</span>
          </div>

          {/* 8. Delete chat */}
          <div 
            className="wa-context-item danger" 
            onClick={() => {
              if (contextMenuLeadId) deleteChat(contextMenuLeadId);
              setContextMenuLeadId(null);
            }}
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span className="text-rose-400 font-medium">Delete chat</span>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
      />
    </div>
  );
};
