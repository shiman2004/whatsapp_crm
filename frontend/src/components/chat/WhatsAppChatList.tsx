import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { WhatsAppAvatar } from './WhatsAppAvatar';
import { 
  Search, 
  CheckCheck, 
  Sparkles, 
  AlertCircle, 
  UserCheck, 
  MessageSquare
} from 'lucide-react';

interface WhatsAppChatListProps {
  onSelectLead: (leadId: string) => void;
}

export const WhatsAppChatList: React.FC<WhatsAppChatListProps> = ({ onSelectLead }) => {
  const { 
    leads, 
    messages, 
    currentUser, 
    isSuperAdmin, 
    selectedLeadId, 
    categories, 
    users,
    markChatAsRead
  } = useCrm();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unassigned' | 'unread'>('all');

  // Filter leads based on role & search & category filters
  const visibleLeads = leads.filter((lead) => {
    // Role filter: If coordinator, only see assigned leads (unless super admin)
    if (!isSuperAdmin && lead.assignedTo !== currentUser.id) {
      return false;
    }

    // Tab filter
    if (activeFilter === 'unassigned' && lead.assignedTo) return false;
    if (activeFilter === 'unread' && (!lead.unreadCount || lead.unreadCount === 0)) return false;

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = lead.customer?.displayName.toLowerCase().includes(q);
      const matchPhone = lead.customer?.whatsappNumber.includes(q);
      const matchCategory = categories.find(c => c.id === lead.categoryId)?.name.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchCategory) return false;
    }

    return true;
  }).sort((a, b) => {
    const timeA = new Date(a.lastCustomerMessageAt || a.updatedAt).getTime();
    const timeB = new Date(b.lastCustomerMessageAt || b.updatedAt).getTime();
    return timeB - timeA;
  });

  const unassignedCount = leads.filter(l => l.stage === 'new' || !l.assignedTo).length;
  const unreadCount = leads.filter(l => (l.unreadCount || 0) > 0).length;

  return (
    <div className="w-80 shrink-0 border-r border-slate-800/80 bg-[#111b21] flex flex-col h-full select-none">
      {/* Top Header */}
      <div className="h-14 px-3.5 bg-[#202c33] border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-whatsapp text-slate-950 flex items-center justify-center font-bold text-xs shadow">
            RW
          </div>
          <div>
            <h3 className="font-bold text-xs text-slate-100">WhatsApp Chats</h3>
            <p className="text-[10px] text-slate-400">
              {isSuperAdmin ? 'Super Admin (All Inbound)' : 'Assigned Inbox'}
            </p>
          </div>
        </div>

        {isSuperAdmin && unassignedCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
            {unassignedCount} New
          </span>
        )}
      </div>

      {/* Search & Filter Pills */}
      <div className="p-2.5 bg-[#111b21] border-b border-slate-800/80 space-y-2 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or start a new chat..."
            className="w-full bg-[#202c33] border border-slate-700/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-whatsapp transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors shrink-0 ${
              activeFilter === 'all'
                ? 'bg-whatsapp text-slate-950'
                : 'bg-[#202c33] text-slate-400 hover:text-slate-200 border border-slate-700/50'
            }`}
          >
            All ({leads.length})
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setActiveFilter('unassigned')}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1 ${
                activeFilter === 'unassigned'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-[#202c33] text-amber-400 hover:text-amber-300 border border-amber-500/30'
              }`}
            >
              <span>Needs Assign</span>
              {unassignedCount > 0 && (
                <span className="w-3.5 h-3.5 rounded-full bg-amber-950 text-amber-300 text-[9px] flex items-center justify-center font-bold">
                  {unassignedCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveFilter('unread')}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors shrink-0 ${
              activeFilter === 'unread'
                ? 'bg-whatsapp text-slate-950'
                : 'bg-[#202c33] text-slate-400 hover:text-slate-200 border border-slate-700/50'
            }`}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>
      </div>

      {/* Chat List Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
        {visibleLeads.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-700 mb-2" />
            <p>No conversations found</p>
          </div>
        ) : (
          visibleLeads.map((lead) => {
            const isSelected = selectedLeadId === lead.id;
            const leadMsgs = messages.filter(m => m.leadId === lead.id);
            const lastMsg = leadMsgs[leadMsgs.length - 1];
            const category = categories.find(c => c.id === lead.categoryId);
            const coordinator = users.find(u => u.id === lead.assignedTo);

            const timeStr = lastMsg 
              ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={lead.id}
                onClick={() => {
                  onSelectLead(lead.id);
                  markChatAsRead(lead.id);
                }}
                className={`px-3 py-2.5 flex items-start gap-2.5 cursor-pointer transition-colors relative ${
                  isSelected
                    ? 'bg-[#2a3942] border-l-4 border-whatsapp'
                    : 'hover:bg-[#202c33]/70'
                }`}
              >
                {/* Contact Avatar */}
                <WhatsAppAvatar
                  name={lead.customer?.displayName || lead.customer?.whatsappNumber}
                  avatarUrl={lead.customer?.avatarUrl}
                  size="md"
                  isOnline={false}
                />

                {/* Details */}
                <div className="min-w-0 flex-1">
                  {/* Row 1: Name + Time */}
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-bold text-slate-100 truncate">
                      {lead.customer?.displayName || lead.customer?.whatsappNumber || 'New Contact'}
                    </h4>
                    <span className={`text-[10px] font-mono shrink-0 ${
                      (lead.unreadCount || 0) > 0 ? 'text-whatsapp font-bold' : 'text-slate-400'
                    }`}>
                      {timeStr}
                    </span>
                  </div>

                  {/* Row 2: Message Snippet + Unread badge */}
                  <div className="flex items-center justify-between gap-1.5 mt-0.5">
                    <p className="text-[11px] text-slate-400 truncate flex-1 font-sans">
                      {lastMsg ? (
                        lastMsg.direction === 'outbound' ? (
                          <span className="inline-flex items-center gap-1">
                            <CheckCheck className="w-3 h-3 text-sky-400 shrink-0" />
                            <span className="truncate">{lastMsg.content}</span>
                          </span>
                        ) : (
                          lastMsg.content
                        )
                      ) : (
                        `Enquiry for ${category?.name || 'Treatment'}`
                      )}
                    </p>

                    {(lead.unreadCount || 0) > 0 && (
                      <span className="w-4 h-4 rounded-full bg-whatsapp text-slate-950 text-[10px] font-black flex items-center justify-center shrink-0">
                        {lead.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Row 3: Category Badge + Coordinator info */}
                  <div className="flex items-center justify-between gap-1.5 mt-1 pt-0.5 text-[9px]">
                    <span className="font-semibold text-teal-400 bg-teal-500/10 px-1.5 py-0.2 rounded border border-teal-500/20 truncate max-w-[110px]">
                      {category?.name.split('&')[0]}
                    </span>

                    {coordinator ? (
                      <span className="text-slate-400 flex items-center gap-0.5 truncate max-w-[110px]">
                        <UserCheck className="w-2.5 h-2.5 text-teal-400 shrink-0" />
                        <span className="truncate">{coordinator.fullName.split(' ')[0]}</span>
                      </span>
                    ) : (
                      <span className="font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.2 rounded border border-amber-500/30 flex items-center gap-0.5">
                        <AlertCircle className="w-2.5 h-2.5 shrink-0" /> Needs Assign
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
