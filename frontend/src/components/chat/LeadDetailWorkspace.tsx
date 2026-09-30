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
  const [crmPanelOpen, setCrmPanelOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('chats');

  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
  };

  return (
    <div className="flex-1 flex min-w-0 h-full w-full bg-[#111b21] overflow-hidden">
      {/* 1. Authentic WhatsApp Web Leftmost Icon Rail */}
      <WhatsAppLeftRail
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        onOpenSettings={() => setCrmPanelOpen(true)}
      />

      {/* 2. WhatsApp Web Chat List */}
      <WhatsAppChatList onSelectLead={handleSelectLead} />

      {/* 3. Center WhatsApp Chat Thread */}
      {selectedLead ? (
        <WhatsAppChatThread
          lead={selectedLead}
          crmPanelOpen={crmPanelOpen}
          setCrmPanelOpen={setCrmPanelOpen}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-[#8696a0] bg-[#222e35]/20">
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
        <CrmIntelligencePanel
          lead={selectedLead}
          onClose={() => setCrmPanelOpen(false)}
        />
      )}
    </div>
  );
};
