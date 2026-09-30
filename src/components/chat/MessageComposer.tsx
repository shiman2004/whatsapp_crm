import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  FileText, 
  X,
  Paperclip,
  CornerUpLeft
} from 'lucide-react';
import { Lead, WhatsAppTemplate } from '../../types';
import { useCrm } from '../../context/CrmContext';

interface MessageComposerProps {
  lead: Lead;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({ lead }) => {
  const { 
    sendMessage, 
    sendWhatsAppTemplate, 
    templates, 
    categories, 
    treatments,
    messages,
    replyingMessage,
    setReplyingMessage
  } = useCrm();

  const [inputVal, setInputVal] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const category = categories.find(c => c.id === lead.categoryId);
  const treatment = treatments.find(t => t.id === lead.treatmentId);

  // Focus input when replying to a message
  useEffect(() => {
    if (replyingMessage && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingMessage]);

  // Check 24-hour session window
  const lastCustomerMsg = lead.lastCustomerMessageAt ? new Date(lead.lastCustomerMessageAt).getTime() : 0;
  const isWindowOpen = lastCustomerMsg > 0 && (Date.now() - lastCustomerMsg) <= (24 * 60 * 60 * 1000);

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim()) return;

    sendMessage(lead.id, inputVal.trim(), 'coordinator');
    setInputVal('');
  };

  const handleSendTemplate = (tpl: WhatsAppTemplate) => {
    const custName = lead.customer?.displayName || 'Client';
    const trtName = treatment?.name || category?.name || 'Treatment';
    
    sendWhatsAppTemplate(lead.id, tpl.id, [custName, trtName]);
    setShowTemplates(false);
  };

  const approvedTemplates = templates.filter(t => t.approved && (t.language === lead.language || t.language === 'en'));

  return (
    <div className="border-t border-slate-800 bg-[#202c33] p-2.5 space-y-2 shrink-0">
      {/* Meta Template Selector Drawer */}
      {showTemplates && (
        <div className="bg-[#111b21] border border-slate-700 rounded-xl p-3 space-y-2 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-teal-400" />
              <span>WhatsApp Templates</span>
            </h4>
            <button onClick={() => setShowTemplates(false)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {approvedTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-2 rounded-lg bg-[#202c33] border border-slate-800 flex items-start justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-slate-200 block">{tpl.name}</span>
                  <p className="text-[11px] text-slate-400 line-clamp-1 italic">{tpl.body}</p>
                </div>
                <button
                  onClick={() => handleSendTemplate(tpl)}
                  className="px-2.5 py-1 bg-whatsapp text-slate-950 text-xs font-bold rounded-lg shrink-0"
                >
                  Send
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quoted Reply Banner (WhatsApp Web style) */}
      {replyingMessage && (
        <div className="bg-[#111b21] border-l-4 border-whatsapp rounded-r-xl p-2.5 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150 shadow-md">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-whatsapp">
              <CornerUpLeft className="w-3.5 h-3.5" />
              <span>
                Replying to {replyingMessage.direction === 'inbound' 
                  ? (lead.customer?.displayName || 'Customer') 
                  : 'Your Message'}
              </span>
            </div>
            <p className="text-xs text-slate-300 line-clamp-1 italic mt-0.5">
              "{replyingMessage.content}"
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyingMessage(null)}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            title="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* WhatsApp Message Input Bar */}
      <form onSubmit={handleSendText} className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-slate-400 shrink-0">
          <button
            type="button"
            onClick={() => setShowTemplates(!showTemplates)}
            className={`p-2 rounded-full transition-colors ${
              showTemplates ? 'bg-teal-500/20 text-teal-300' : 'hover:bg-slate-700/50 hover:text-teal-300'
            }`}
            title="WhatsApp Templates"
          >
            <FileText className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 bg-[#2a3942] rounded-xl px-3.5 py-2 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={
              replyingMessage 
                ? 'Type your reply...'
                : (!isWindowOpen 
                  ? 'Session window closed (>24h). Pick a Template...'
                  : 'Type a message...')
            }
            className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-400 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={!inputVal.trim()}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 ${
            inputVal.trim()
              ? 'bg-whatsapp text-slate-950 hover:bg-emerald-400 cursor-pointer shadow'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
