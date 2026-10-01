import React, { useRef, useEffect, useState } from 'react';
import { Lead } from '../../types';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { WhatsAppAvatar } from './WhatsAppAvatar';
import { useCrm } from '../../context/CrmContext';
import { 
  Shield, 
  Video, 
  Phone, 
  Search, 
  MoreVertical, 
  SlidersHorizontal,
  Lock,
  ChevronDown
} from 'lucide-react';
import { formatWhatsAppDisplay } from '../../utils/phoneUtils';

interface WhatsAppChatThreadProps {
  lead: Lead;
  crmPanelOpen: boolean;
  setCrmPanelOpen: (open: boolean) => void;
}

export const WhatsAppChatThread: React.FC<WhatsAppChatThreadProps> = ({ 
  lead, 
  crmPanelOpen, 
  setCrmPanelOpen 
}) => {
  const { messages, deleteChat, clearChat } = useCrm();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [searchInChat, setSearchInChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const rawLeadMessages = messages.filter(m => 
    m.leadId === lead.id || (lead.customerId && m.customerId === lead.customerId)
  );

  // Deduplicate messages
  const seenMsgKeys = new Set<string>();
  const leadMessages = rawLeadMessages.filter(m => {
    // Filter out empty messages
    if ((!m.content || m.content.trim().length === 0) && !m.media) return false;
    const timeBucket = Math.floor(new Date(m.createdAt).getTime() / 2000);
    const key = m.waMessageId || m.id || `${m.direction}-${m.content}-${timeBucket}`;
    if (seenMsgKeys.has(key)) return false;
    seenMsgKeys.add(key);
    return true;
  });

  const displayName = lead.customer?.displayName || 'WhatsApp Contact';
  const rawPhone = lead.customer?.whatsappNumber || '';
  const displayPhone = lead.customer?.phoneNumber || formatWhatsAppDisplay(rawPhone);

  const filteredMessages = searchQuery.trim()
    ? leadMessages.filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : leadMessages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [leadMessages]);

  return (
    <div className="flex-1 flex flex-col bg-[#0b141a] relative min-w-0 h-full overflow-hidden">
      {/* 1. WhatsApp Top Chat Header (Exact 1:1 Match of Screenshot 1 & 2) */}
      <div className="h-14 px-4 bg-[#202c33] border-b border-[#222e35] flex items-center justify-between gap-3 shrink-0 select-none z-10">
        {/* Left: Contact Info */}
        <div className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-90 transition-opacity">
          <WhatsAppAvatar
            name={displayName}
            avatarUrl={lead.customer?.avatarUrl}
            size="md"
            isOnline={true}
          />

          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-[#e9edef] truncate leading-tight">
              {displayName}
            </h3>
            <p className="text-[11px] text-[#8696a0] font-sans truncate flex items-center gap-1.5 mt-0.5">
              {displayPhone ? (
                <>
                  <span className="font-mono text-[#00a884] font-medium">{displayPhone}</span>
                  <span className="text-slate-600">•</span>
                  <span>WhatsApp Direct Contact</span>
                </>
              ) : (
                <span>online</span>
              )}
            </p>
          </div>
        </div>

        {/* Right Action Icons: Video, Call, Search, Menu, CRM Toggle */}
        <div className="flex items-center gap-1.5 shrink-0 text-[#aebac1]">
          {/* Video Call */}
          <button 
            className="w-9 h-9 rounded-full hover:bg-[#374248] flex items-center justify-center transition-colors"
            title="Video call"
          >
            <Video className="w-5 h-5" />
          </button>

          {/* Voice Call */}
          <button 
            className="w-9 h-9 rounded-full hover:bg-[#374248] flex items-center justify-center transition-colors"
            title="Voice call"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Search in chat */}
          <button 
            onClick={() => setSearchInChat(!searchInChat)}
            className={`w-9 h-9 rounded-full hover:bg-[#374248] flex items-center justify-center transition-colors ${
              searchInChat ? 'text-[#00a884]' : ''
            }`}
            title="Search in chat"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* 3 Dots Menu */}
          <div className="relative">
            <button 
              onClick={() => setThreadMenuOpen(!threadMenuOpen)}
              className="w-9 h-9 rounded-full hover:bg-[#374248] flex items-center justify-center transition-colors"
              title="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {threadMenuOpen && (
              <div className="absolute right-0 top-10 w-48 bg-[#233138] border border-slate-700/60 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs text-[#d1d7db]">
                <button onClick={() => setThreadMenuOpen(false)} className="w-full text-left px-4 py-2 hover:bg-[#182229]">
                  Contact info
                </button>
                <button onClick={() => setThreadMenuOpen(false)} className="w-full text-left px-4 py-2 hover:bg-[#182229]">
                  Select messages
                </button>
                <button onClick={() => setThreadMenuOpen(false)} className="w-full text-left px-4 py-2 hover:bg-[#182229]">
                  Close chat
                </button>
                <button onClick={() => setThreadMenuOpen(false)} className="w-full text-left px-4 py-2 hover:bg-[#182229]">
                  Mute notifications
                </button>
                <button 
                  onClick={() => {
                    clearChat(lead.id);
                    setThreadMenuOpen(false);
                  }} 
                  className="w-full text-left px-4 py-2 hover:bg-[#182229]"
                >
                  Clear chat
                </button>
                <button 
                  onClick={() => {
                    deleteChat(lead.id);
                    setThreadMenuOpen(false);
                  }} 
                  className="w-full text-left px-4 py-2 hover:bg-[#182229] text-rose-400 font-medium"
                >
                  Delete chat
                </button>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-slate-700/60 mx-1" />

          {/* CRM Panel Toggle */}
          <button
            onClick={() => setCrmPanelOpen(!crmPanelOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border shrink-0 ${
              crmPanelOpen
                ? 'bg-[#00a884]/20 text-[#00a884] border-[#00a884]/40 shadow-sm'
                : 'bg-[#202c33] text-[#d1d7db] border-slate-700 hover:bg-[#2a3942]'
            }`}
            title="Toggle Clinical Lead CRM Profile"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{crmPanelOpen ? 'Hide CRM' : 'CRM Details'}</span>
          </button>
        </div>
      </div>

      {/* In-Chat Search Bar (When triggered) */}
      {searchInChat && (
        <div className="px-4 py-2 bg-[#202c33] border-b border-[#222e35] flex items-center gap-2 text-xs">
          <Search className="w-4 h-4 text-[#8696a0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-[#d1d7db] placeholder-[#8696a0] outline-none"
            autoFocus
          />
          <button onClick={() => { setSearchInChat(false); setSearchQuery(''); }} className="text-[#8696a0] hover:text-white">
            Cancel
          </button>
        </div>
      )}

      {/* 2. WhatsApp Message Stream with Doodle Pattern */}
      <div className="flex-1 wa-chat-bg p-4 pb-6 overflow-y-auto space-y-3 relative">
        {/* End-to-End Encryption Notice (Exact WhatsApp Web style) */}
        <div className="max-w-md mx-auto my-2 text-[#8696a0] text-center text-[11px] flex items-center justify-center gap-1.5 bg-[#182229]/90 border border-slate-800 rounded-lg px-4 py-1.5 shadow-sm">
          <Lock className="w-3 h-3 text-[#00a884] shrink-0" />
          <span>Messages are end-to-end encrypted. No one outside of this chat can read or listen to them.</span>
        </div>

        {/* Date Divider: Today */}
        <div className="flex justify-center my-3">
          <span className="bg-[#182229] border border-slate-800/80 text-[#8696a0] text-[10px] font-semibold tracking-wider px-3 py-1 rounded-lg uppercase shadow-sm">
            Today
          </span>
        </div>

        {/* Message Bubbles */}
        {filteredMessages.length === 0 ? (
          <div className="text-center text-[#8696a0] text-xs py-8">
            <p>No messages in this chat yet</p>
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              lead={lead}
            />
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Bottom Composer */}
      <MessageComposer lead={lead} />
    </div>
  );
};
