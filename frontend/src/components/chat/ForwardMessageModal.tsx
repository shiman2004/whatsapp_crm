import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Send, 
  Forward, 
  CheckCircle2, 
  UserCheck 
} from 'lucide-react';
import { Message, Lead } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { WhatsAppAvatar } from './WhatsAppAvatar';

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  isOpen,
  onClose,
  message
}) => {
  const { leads, forwardMessage } = useCrm();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  if (!isOpen || !message) return null;

  const filteredLeads = leads.filter(l => {
    const name = l.customer?.displayName?.toLowerCase() || '';
    const phone = l.customer?.whatsappNumber?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    return name.includes(q) || phone.includes(q);
  });

  const handleForward = () => {
    if (!selectedLeadId || !message) return;
    forwardMessage(message.id, selectedLeadId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#111b21] border border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100 animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-[#202c33]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-whatsapp/20 text-whatsapp flex items-center justify-center">
              <Forward className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">Forward Message</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message preview snippet */}
        <div className="p-3.5 bg-[#0b141a] border-b border-slate-800 text-xs">
          <p className="text-slate-400 text-[11px] mb-1 font-semibold uppercase tracking-wider">Message to forward:</p>
          <div className="p-2.5 bg-[#202c33] rounded-xl border border-slate-700/50 text-slate-200 line-clamp-2 italic">
            "{message.content}"
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-800 bg-[#111b21]">
          <div className="bg-[#202c33] rounded-xl px-3 py-2 flex items-center gap-2 border border-slate-700/50 focus-within:border-whatsapp">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search chat or patient name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-white placeholder-slate-400 outline-none w-full"
              autoFocus
            />
          </div>
        </div>

        {/* Lead List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredLeads.map((lead) => {
            const isSelected = selectedLeadId === lead.id;
            return (
              <div
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                  isSelected 
                    ? 'bg-whatsapp/15 border-whatsapp/50 text-white' 
                    : 'bg-[#202c33]/40 border-transparent hover:bg-[#202c33] text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <WhatsAppAvatar
                    name={lead.customer?.displayName || 'Client'}
                    avatarUrl={lead.customer?.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-slate-100 truncate">
                      {lead.customer?.displayName || 'WhatsApp Contact'}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">
                      {lead.customer?.whatsappNumber}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 ml-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                    isSelected ? 'bg-whatsapp border-whatsapp text-slate-950' : 'border-slate-600'
                  }`}>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#202c33] flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {selectedLeadId ? '1 contact selected' : 'Select a recipient'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-xl hover:bg-slate-700/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleForward}
              disabled={!selectedLeadId}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all ${
                selectedLeadId
                  ? 'bg-whatsapp hover:bg-emerald-500 text-slate-950 shadow-md cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Forward</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
