import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { WhatsAppChatList } from './WhatsAppChatList';
import { WhatsAppChatThread } from './WhatsAppChatThread';
import { CrmIntelligencePanel } from './CrmIntelligencePanel';
import { MessageSquare, Smartphone } from 'lucide-react';

interface LeadDetailWorkspaceProps {
  onBackToKanban?: () => void;
}

export const LeadDetailWorkspace: React.FC<LeadDetailWorkspaceProps> = () => {
  const { selectedLead, setSelectedLeadId, leads } = useCrm();
  const [crmPanelOpen, setCrmPanelOpen] = useState(true);

  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
  };

  return (
    <div className="flex-1 flex min-w-0 h-full w-full bg-[#111b21] overflow-hidden">
      {/* 1. Left Panel: Authentic WhatsApp Web Chat List */}
      <WhatsAppChatList onSelectLead={handleSelectLead} />

      {/* 2. Center Panel: Active WhatsApp Chat Thread */}
      {selectedLead ? (
        <WhatsAppChatThread
          lead={selectedLead}
          crmPanelOpen={crmPanelOpen}
          setCrmPanelOpen={setCrmPanelOpen}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500 bg-slate-950/40">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-teal-400 mb-4 shadow">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-200">Royal Wellness WhatsApp Web</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
            Select a patient conversation from the left to view incoming messages, assign coordinators, and trigger automated follow-ups.
          </p>
        </div>
      )}

      {/* 3. Right Panel: CRM Intelligence & Routing (Collapsible) */}
      {selectedLead && crmPanelOpen && (
        <CrmIntelligencePanel
          lead={selectedLead}
          onClose={() => setCrmPanelOpen(false)}
        />
      )}
    </div>
  );
};
