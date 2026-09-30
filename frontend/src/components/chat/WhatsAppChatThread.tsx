import React, { useRef, useEffect } from 'react';
import { Lead } from '../../types';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { SessionWindowBadge } from './SessionWindowBadge';
import { WhatsAppAvatar } from './WhatsAppAvatar';
import { useCrm } from '../../context/CrmContext';
import { 
  Shield, 
  SlidersHorizontal
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
  const { messages } = useCrm();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const leadMessages = messages.filter(m => m.leadId === lead.id);
  const displayName = lead.customer?.displayName || 'WhatsApp Patient';
  const rawPhone = lead.customer?.whatsappNumber || '';
  const displayPhone = lead.customer?.phoneNumber || formatWhatsAppDisplay(rawPhone);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [leadMessages]);

  return (
    <div className="flex-1 flex flex-col bg-[#0b141a] relative min-w-0 h-full overflow-hidden">
      {/* WhatsApp Chat Header */}
      <div className="h-14 px-4 bg-[#202c33] border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 select-none z-10">
        {/* Left: Contact Info */}
        <div className="flex items-center gap-3 min-w-0">
          <WhatsAppAvatar
            name={displayName}
            avatarUrl={lead.customer?.avatarUrl}
            size="md"
            isOnline={true}
          />

          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-100 truncate">
              {displayName}
            </h3>
            <p className="text-[11px] text-slate-400 font-sans truncate flex items-center gap-1.5">
              {displayPhone ? (
                <>
                  <span className="font-mono text-emerald-400/90 font-medium">{displayPhone}</span>
                  <span className="text-slate-600">•</span>
                  <span>WhatsApp Direct Contact</span>
                </>
              ) : (
                <span>WhatsApp Direct Contact</span>
              )}
            </p>
          </div>
        </div>

        {/* Right: Window Badge + CRM Info Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <SessionWindowBadge lastCustomerMessageAt={lead.lastCustomerMessageAt} />

          <button
            onClick={() => setCrmPanelOpen(!crmPanelOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border shrink-0 ${
              crmPanelOpen
                ? 'bg-whatsapp/15 text-whatsapp border-whatsapp/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle Lead Management & Routing"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{crmPanelOpen ? 'Hide CRM' : 'CRM Details'}</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Message Stream */}
      <div className="flex-1 wa-chat-bg p-4 pb-6 overflow-y-auto space-y-2">
        {/* Minimal Encryption Notice */}
        <div className="max-w-xs mx-auto mb-2 text-slate-400 text-center text-[11px] flex items-center justify-center gap-1 bg-[#182229]/80 border border-slate-800/80 rounded-lg px-3 py-1 shadow-sm">
          <Shield className="w-3 h-3 text-whatsapp shrink-0" />
          <span>Messages are end-to-end encrypted</span>
        </div>

        {/* WhatsApp Date Divider */}
        <div className="flex justify-center my-3">
          <span className="bg-[#182229] border border-slate-800 text-slate-400 text-[10px] font-semibold tracking-wider px-3 py-0.5 rounded-lg uppercase shadow-sm">
            Today
          </span>
        </div>

        {leadMessages.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs">
            <p>No messages in this chat yet</p>
          </div>
        ) : (
          leadMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} lead={lead} />
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* WhatsApp Message Composer */}
      <MessageComposer lead={lead} />
    </div>
  );
};
