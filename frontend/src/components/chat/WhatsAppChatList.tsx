import React, { useState, useRef, useEffect } from 'react';
import { useCrm } from '../../context/CrmContext';
import { WhatsAppAvatar } from './WhatsAppAvatar';
import { 
  Search, 
  CheckCheck, 
  Plus, 
  MoreVertical, 
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
  PhoneCall,
  VolumeX,
  Sparkles,
  Mic
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
    currentUser, 
    isSuperAdmin, 
    isLeadsOfficer,
    selectedLeadId, 
    categories,
    markChatAsRead,
    updateLeadStage,
    deleteMessage,
    deleteChat,
    clearChat
  } = useCrm();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'favourites' | 'groups'>('all');
  
  // Context Menu State
  const [contextMenuLeadId, setContextMenuLeadId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [pinnedLeadIds, setPinnedLeadIds] = useState<Set<string>>(new Set());
  const [favouriteLeadIds, setFavouriteLeadIds] = useState<Set<string>>(new Set());
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuLeadId(null);
        setContextMenuPos(null);
        setHeaderMenuOpen(false);
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

  // Filter leads based on role & search & category filters
  const filteredLeads = leads.filter((lead) => {
    // Role filter: Super Admin and Leads Officers can view ALL chats and messages
    if (!isSuperAdmin && !isLeadsOfficer && lead.assignedTo !== currentUser.id) {
      return false;
    }

    // Filter pills
    if (activeFilter === 'unread' && (!lead.unreadCount || lead.unreadCount === 0)) return false;
    if (activeFilter === 'favourites' && !favouriteLeadIds.has(lead.id)) return false;

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

  const totalUnreadCount = leads.filter(l => (l.unreadCount || 0) > 0).length;

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
    <div className="w-[380px] shrink-0 border-r border-[#222e35] bg-[#111b21] flex flex-col h-full select-none relative">
      {/* 1. WhatsApp Top Header */}
      <div className="h-14 px-4 bg-[#111b21] flex items-center justify-between shrink-0">
        <h2 className="text-xl font-bold text-[#00a884] font-sans tracking-tight">
          WhatsApp
        </h2>

        <div className="flex items-center gap-1">
          {/* New Chat Button (Green + circle from screenshot) */}
          <button
            onClick={() => {}}
            className="w-8 h-8 rounded-full bg-[#00a884] hover:bg-[#00c298] text-black flex items-center justify-center shadow-md active:scale-95 transition-all"
            title="New Chat"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* 3 Dots Menu Button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setHeaderMenuOpen(!headerMenuOpen);
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#aebac1] hover:bg-[#202c33] transition-colors"
              title="Menu"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {headerMenuOpen && (
              <div 
                ref={menuRef}
                className="absolute right-0 top-10 w-48 bg-[#233138] border border-slate-700/60 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs text-[#d1d7db]"
              >
                <button className="w-full text-left px-4 py-2 hover:bg-[#182229] flex items-center gap-2.5">
                  <span>New group</span>
                </button>
                <button className="w-full text-left px-4 py-2 hover:bg-[#182229] flex items-center gap-2.5">
                  <span>New community</span>
                </button>
                <button className="w-full text-left px-4 py-2 hover:bg-[#182229] flex items-center gap-2.5">
                  <span>Starred messages</span>
                </button>
                <button className="w-full text-left px-4 py-2 hover:bg-[#182229] flex items-center gap-2.5">
                  <span>Select chats</span>
                </button>
                <button className="w-full text-left px-4 py-2 hover:bg-[#182229] flex items-center gap-2.5">
                  <span>Settings</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Pill Search Bar & Filter Chips (Exact WhatsApp Web style) */}
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

        {/* Filter Chips row: All, Unread, Favourites, Groups */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === 'all'
                ? 'bg-[#00a884]/20 text-[#00a884] font-semibold'
                : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
            }`}
          >
            All
          </button>

          <button
            onClick={() => setActiveFilter('unread')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
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
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
              activeFilter === 'favourites'
                ? 'bg-[#00a884]/20 text-[#00a884] font-semibold'
                : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
            }`}
          >
            Favourites
          </button>

          <button
            onClick={() => setActiveFilter('groups')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
              activeFilter === 'groups'
                ? 'bg-[#00a884]/20 text-[#00a884] font-semibold'
                : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
            }`}
          >
            <span>Groups</span>
          </button>
        </div>
      </div>

      {/* 3. Archived Row */}
      <div className="px-4 py-2.5 hover:bg-[#202c33] cursor-pointer flex items-center justify-between border-b border-[#222e35]/60 transition-colors shrink-0">
        <div className="flex items-center gap-4 text-[#8696a0]">
          <Archive className="w-4 h-4 text-[#00a884]" />
          <span className="text-xs font-medium text-[#d1d7db]">Archived</span>
        </div>
      </div>

      {/* 4. Chat Items Stream */}
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
            const isFav = favouriteLeadIds.has(lead.id);

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

            return (
              <div
                key={lead.id}
                onClick={() => {
                  onSelectLead(lead.id);
                  markChatAsRead(lead.id);
                }}
                onContextMenu={(e) => handleContextMenu(e, lead.id)}
                className={`group px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors relative ${
                  isSelected ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                }`}
              >
                {/* Contact Avatar */}
                <WhatsAppAvatar
                  name={displayName}
                  avatarUrl={lead.customer?.avatarUrl}
                  size="md"
                  isOnline={true}
                />

                {/* Chat Middle Content */}
                <div className="flex-1 min-w-0 pr-1">
                  {/* Top Line: Contact Name & Time */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-[#e9edef] truncate">
                      {displayName}
                    </span>
                    <span className={`text-[10px] font-mono shrink-0 ${
                      (lead.unreadCount || 0) > 0 ? 'text-[#00a884] font-bold' : 'text-[#8696a0]'
                    }`}>
                      {timeDisplay}
                    </span>
                  </div>

                  {/* Bottom Line: Last Message Snippet + Status Indicators */}
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
                        <span className="flex items-center gap-1 text-[#8696a0]">
                          <Mic className="w-3 h-3 text-[#00a884]" /> Voice message
                        </span>
                      ) : (
                        <span className="truncate">{lastMsg?.content || 'Started WhatsApp chat'}</span>
                      )}
                    </div>

                    {/* Right Indicators: Pin / Mute / Unread Badge */}
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
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. WhatsApp Web Context Menu (Exact 1:1 Match of Screenshot 1) */}
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
