import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Send, 
  Forward, 
  Check, 
  CheckCheck,
  CheckCircle2, 
  UserCheck,
  Users
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
  const { leads, forwardMessage, theme } = useCrm();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Deduplicate leads by customer WhatsApp number/ID
  const uniqueLeads = useMemo(() => {
    const seen = new Set<string>();
    return leads.filter(l => {
      const key = l.customer?.whatsappNumber || l.customer?.whatsappId || l.customerId || l.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [leads]);

  if (!isOpen || !message) return null;

  const filteredLeads = uniqueLeads.filter(l => {
    const name = l.customer?.displayName?.toLowerCase() || '';
    const phone = l.customer?.whatsappNumber?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    return name.includes(q) || phone.includes(q);
  });

  const toggleSelectLead = (leadId: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id));
    }
  };

  const handleForward = () => {
    if (selectedLeadIds.length === 0 || !message) return;
    forwardMessage(message.id, selectedLeadIds);
    onClose();
    setSelectedLeadIds([]);
    setSearchQuery('');
  };

  const isLight = theme === 'light';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className={`border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh] ${
        isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#111b21] border-slate-700/80 text-slate-100'
      }`}>
        
        {/* Header */}
        <div className={`px-5 py-3.5 border-b flex items-center justify-between ${
          isLight ? 'bg-[#f0f2f5] border-slate-200' : 'bg-[#202c33] border-slate-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
              <Forward className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>Forward Message</h3>
              <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Select one or more recipients</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message preview snippet */}
        <div className={`p-3 border-b text-xs ${
          isLight ? 'bg-[#f8fafc] border-slate-200' : 'bg-[#0b141a] border-slate-800'
        }`}>
          <p className={`text-[10.5px] mb-1 font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Message to forward:
          </p>
          <div className={`p-2.5 rounded-xl border line-clamp-2 italic text-xs ${
            isLight ? 'bg-white border-slate-200 text-slate-700 shadow-xs' : 'bg-[#202c33] border-slate-700/50 text-slate-200'
          }`}>
            "{message.content}"
          </div>
        </div>

        {/* Search & Quick Select Bar */}
        <div className={`p-3 border-b space-y-2 ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#111b21] border-slate-800'
        }`}>
          <div className={`rounded-xl px-3 py-2 flex items-center gap-2 border transition-all ${
            isLight 
              ? 'bg-[#f0f2f5] border-slate-200 focus-within:border-[#00a884] focus-within:bg-white' 
              : 'bg-[#202c33] border-slate-700/50 focus-within:border-[#00a884]'
          }`}>
            <Search className={`w-4 h-4 shrink-0 ${isLight ? 'text-slate-400' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search chat or patient name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`bg-transparent text-xs outline-none w-full ${
                isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-slate-400'
              }`}
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Selection Actions */}
          <div className="flex items-center justify-between text-[11px] px-1">
            <span className={isLight ? 'text-slate-500 font-medium' : 'text-slate-400'}>
              {selectedLeadIds.length > 0 
                ? `${selectedLeadIds.length} contact${selectedLeadIds.length > 1 ? 's' : ''} selected` 
                : `${filteredLeads.length} available chats`}
            </span>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[#00a884] hover:underline font-semibold cursor-pointer"
            >
              {selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>

        {/* Selected Recipients Pill Row */}
        {selectedLeadIds.length > 0 && (
          <div className={`px-3 py-2 border-b flex items-center gap-1.5 overflow-x-auto scrollbar-thin ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#182229]/60 border-slate-800'
          }`}>
            {selectedLeadIds.map(id => {
              const l = leads.find(item => item.id === id);
              const name = l?.customer?.displayName || 'Contact';
              return (
                <span 
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/30 font-medium shrink-0 animate-in fade-in"
                >
                  <span className="truncate max-w-[90px]">{name}</span>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectLead(id);
                    }}
                    className="hover:opacity-75 cursor-pointer ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Lead List (Multi-Select) */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredLeads.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No contacts found matching "{searchQuery}"
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const isSelected = selectedLeadIds.includes(lead.id);
              return (
                <div
                  key={lead.id}
                  onClick={() => toggleSelectLead(lead.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                    isSelected 
                      ? (isLight ? 'bg-emerald-50 border-emerald-400 text-slate-900 shadow-xs' : 'bg-[#00a884]/15 border-[#00a884]/50 text-white')
                      : (isLight ? 'bg-white hover:bg-slate-50 border-transparent text-slate-700' : 'bg-[#202c33]/40 border-transparent hover:bg-[#202c33] text-slate-300')
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <WhatsAppAvatar
                      name={lead.customer?.displayName || 'Client'}
                      avatarUrl={lead.customer?.avatarUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className={`font-semibold text-xs truncate ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        {lead.customer?.displayName || 'WhatsApp Contact'}
                      </p>
                      <p className={`text-[11px] font-mono truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {lead.customer?.whatsappNumber}
                      </p>
                    </div>
                  </div>

                  {/* Multi-Select Circular Checkbox */}
                  <div className="shrink-0 ml-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                      isSelected 
                        ? 'bg-[#00a884] border-[#00a884] text-white shadow-xs scale-105' 
                        : (isLight ? 'border-slate-300 bg-white hover:border-slate-400' : 'border-slate-600 bg-transparent hover:border-slate-400')
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-3 border-t flex items-center justify-between ${
          isLight ? 'bg-[#f0f2f5] border-slate-200' : 'bg-[#202c33] border-slate-800'
        }`}>
          <span className={`text-[11px] font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {selectedLeadIds.length > 0 
              ? `${selectedLeadIds.length} contact${selectedLeadIds.length > 1 ? 's' : ''} selected` 
              : 'Select one or more recipients'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleForward}
              disabled={selectedLeadIds.length === 0}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md ${
                selectedLeadIds.length > 0
                  ? 'bg-[#00a884] hover:bg-[#00c298] text-white cursor-pointer active:scale-95'
                  : 'bg-slate-700/50 text-slate-400 cursor-not-allowed opacity-60'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Forward{selectedLeadIds.length > 1 ? ` (${selectedLeadIds.length})` : ''}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
