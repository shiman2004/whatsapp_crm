import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { WhatsAppLeftRail } from './WhatsAppLeftRail';
import { WhatsAppChatList } from './WhatsAppChatList';
import { WhatsAppChatThread } from './WhatsAppChatThread';
import { CrmIntelligencePanel } from './CrmIntelligencePanel';
import { MessageSquare } from 'lucide-react';

interface LeadDetailWorkspaceProps {
  onBackToKanban?: () => void;
}

export const LeadDetailWorkspace: React.FC<LeadDetailWorkspaceProps> = () => {
  const { selectedLead, setSelectedLeadId } = useCrm();
  const [crmPanelOpen, setCrmPanelOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('chats');

  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
  };

  const handleBackToChatList = () => {
    setSelectedLeadId(null);
  };

  return (
    <div className="flex-1 flex min-w-0 h-full w-full bg-[#111b21] overflow-hidden relative">
      {/* 1. Authentic WhatsApp Web Leftmost Icon Rail (Desktop only) */}
      <WhatsAppLeftRail
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        onOpenSettings={() => setCrmPanelOpen(true)}
      />

      {/* 2. WhatsApp Web Chat List (Full width on mobile when no chat is selected, hidden on mobile when chat is open) */}
      <WhatsAppChatList 
        onSelectLead={handleSelectLead} 
        className={selectedLead ? 'hidden md:flex' : 'flex'}
      />

      {/* 3. Center WhatsApp Chat Thread (Full width on mobile when chat is selected) */}
      {selectedLead ? (
        <WhatsAppChatThread
          lead={selectedLead}
          crmPanelOpen={crmPanelOpen}
          setCrmPanelOpen={setCrmPanelOpen}
          onBack={handleBackToChatList}
        />
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center p-12 text-center text-[#8696a0] bg-[#222e35]/20">
          <div className="w-16 h-16 rounded-full bg-[#202c33] border border-slate-700/60 flex items-center justify-center text-[#00a884] mb-4 shadow">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-[#d1d7db]">WhatsApp Web</h3>
          <p className="text-xs text-[#8696a0] max-w-sm mt-1.5 leading-relaxed">
            Send and receive messages without keeping your phone online. Select a chat to view live patient conversations.
          </p>
        </div>
      )}

      {/* 4. Collapsible CRM Intelligence & Routing Panel */}
      {selectedLead && crmPanelOpen && (
        <>
          {/* Mobile backdrop for CRM Intelligence Panel */}
          <div 
            onClick={() => setCrmPanelOpen(false)}
            className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-xs animate-in fade-in duration-200"
          />
          <CrmIntelligencePanel
            lead={selectedLead}
            onClose={() => setCrmPanelOpen(false)}
          />
        </>
      )}
    </div>
  );
};
