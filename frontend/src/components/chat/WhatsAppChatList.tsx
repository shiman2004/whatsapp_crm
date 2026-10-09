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
  Camera,
  Mic,
  User
} from 'lucide-react';
import { Lead } from '../../types';
import { formatWhatsAppDisplay } from '../../utils/phoneUtils';

interface WhatsAppChatListProps {
  onSelectLead: (leadId: string) => void;
}

export const WhatsAppChatList: React.FC<WhatsAppChatListProps> = ({ onSelectLead }) => {
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
    deleteChat,
    clearChat
  } = useCrm();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  
  // Context Menu State
  const [contextMenuLeadId, setContextMenuLeadId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [pinnedLeadIds, setPinnedLeadIds] = useState<Set<string>>(new Set());
  const [favouriteLeadIds, setFavouriteLeadIds] = useState<Set<string>>(new Set());
  
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuLeadId(null);
        setContextMenuPos(null);
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

  // Filter leads based on role & search & category/stage filters
  const filteredLeads = accessibleLeads.filter((lead) => {
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
      if (!matchName && !matchPhone && !matchCategory) return false;
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
    setContextMenuPos({ x: Math.min(e.clientX, 280), y: Math.min(e.clientY, window.innerHeight - 320) });
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

  return (
    <div className="w-80 sm:w-96 md:w-[380px] bg-[#111b21] border-r border-[#222e35] flex flex-col h-full select-none shrink-0">
      
      {/* 1. Header (Exact WhatsApp Web Title Bar) */}
      <div className="h-14 px-4 bg-[#202c33] flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-[#e9edef] tracking-tight flex items-center gap-2">
          <span>WhatsApp</span>
        </h1>
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
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === 'favourites'
                ? 'bg-[#00a884]/20 text-[#00a884] font-semibold'
                : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
            }`}
          >
            Favourites
          </button>
        </div>
      </div>

      {/* 3. Archived Row */}
      <div className="px-4 py-2 hover:bg-[#202c33] cursor-pointer flex items-center justify-between border-b border-[#222e35]/60 transition-colors shrink-0">
        <div className="flex items-center gap-3 text-[#8696a0]">
          <Archive className="w-3.5 h-3.5 text-[#00a884]" />
          <span className="text-xs font-medium text-[#d1d7db]">Archived</span>
        </div>
      </div>

      {/* 4. Chat Items Stream with Aesthetic & Compact Tags */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#222e35]/40">
        {visibleLeads.length === 0 ? (
          <div className="p-8 text-center text-[#8696a0] text-xs">
            <p>No chats found</p>
          </div>
        ) : (
          visibleLeads.map((lead) => {
            const isSelected = selectedLeadId === lead.id;
            const leadMsgs = messages.filter(m => m.leadId === lead.id || (lead.customerId && m.customerId === lead.customerId));
            leadMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            const lastMsg = leadMsgs[leadMsgs.length - 1];
            const isPinned = pinnedLeadIds.has(lead.id);

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
                {/* Contact Avatar on the far-left (Clean & Aligned) */}
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
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-semibold text-[#e9edef] truncate">
                        {displayName}
                      </span>
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

      {/* 5. WhatsApp Web Context Menu */}
      {contextMenuLeadId && contextMenuPos && (
        <div
          ref={menuRef}
          style={{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }}
          className="fixed wa-context-menu rounded-xl py-1.5 w-48 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 select-none"
        >
          <div className="wa-context-item" onClick={() => setContextMenuLeadId(null)}>
            <Archive className="w-4 h-4 text-[#8696a0]" />
            <span>Archive chat</span>
          </div>

          <div className="wa-context-item" onClick={() => setContextMenuLeadId(null)}>
            <Lock className="w-4 h-4 text-[#8696a0]" />
            <span>Lock chat</span>
          </div>

          <div className="wa-context-item" onClick={() => togglePin(contextMenuLeadId)}>
            <Pin className="w-4 h-4 text-[#8696a0]" />
            <span>{pinnedLeadIds.has(contextMenuLeadId) ? 'Unpin chat' : 'Pin chat'}</span>
          </div>

          <div className="wa-context-item" onClick={() => setContextMenuLeadId(null)}>
            <Mail className="w-4 h-4 text-[#8696a0]" />
            <span>Mark as unread</span>
          </div>

          <div className="wa-context-item" onClick={() => toggleFavourite(contextMenuLeadId)}>
            <Heart className={`w-4 h-4 ${favouriteLeadIds.has(contextMenuLeadId) ? 'text-rose-400 fill-current' : 'text-[#8696a0]'}`} />
            <span>{favouriteLeadIds.has(contextMenuLeadId) ? 'Remove from favourites' : 'Add to favourites'}</span>
          </div>

          <div className="wa-context-item" onClick={() => setContextMenuLeadId(null)}>
            <ListPlus className="w-4 h-4 text-[#8696a0]" />
            <span>Add to list ›</span>
          </div>

          <div className="h-px bg-slate-700/60 my-1" />

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

          <div 
            className="wa-context-item danger" 
            onClick={() => {
              if (contextMenuLeadId) deleteChat(contextMenuLeadId);
              setContextMenuLeadId(null);
            }}
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span className="text-rose-400">Delete chat</span>
          </div>
        </div>
      )}
    </div>
  );
};
