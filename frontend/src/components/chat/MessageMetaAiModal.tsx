import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Bot, 
  Send, 
  Copy, 
  Check, 
  BrainCircuit, 
  RefreshCw 
} from 'lucide-react';
import { Message, Lead } from '../../types';
import { useCrm } from '../../context/CrmContext';

interface MessageMetaAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  lead?: Lead;
}

export const MessageMetaAiModal: React.FC<MessageMetaAiModalProps> = ({
  isOpen,
  onClose,
  message,
  lead
}) => {
  const { sendMessage } = useCrm();
  const [loading, setLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !message) return;

    setLoading(true);
    setCopied(false);

    // Generate smart clinical AI response
    const timer = setTimeout(() => {
      const custName = lead?.customer?.displayName || 'valued patient';
      const text = message.content.toLowerCase();

      let draft = '';
      if (text.includes('prp') || text.includes('hair')) {
        draft = `Hello ${custName}! Thank you for your inquiry about our PRP Hair Follicle Rejuvenation therapy. Our dermatologists offer advanced micro-plasma sessions tailored to your scalp density. We have consultation slots available this week on Friday & Saturday. Would you like us to reserve a morning slot for you?`;
      } else if (text.includes('price') || text.includes('cost') || text.includes('fee')) {
        draft = `Hi ${custName}! Our treatment packages include a comprehensive doctor consultation, scalp/skin mapping, and aftercare kits. Individual sessions start from LKR 18,500 with customized multi-session plans. Would you like our clinical coordinator to share the detailed treatment brochure?`;
      } else if (text.includes('hi') || text.includes('hello') || text.includes('hey') || text.includes('ho')) {
        draft = `Hello ${custName}! Welcome to Royal Wellness Center. How can our aesthetic & wellness medical specialists assist you today? Feel free to ask about our Hair Restoration, Skin Rejuvenation, or Wellness consultations.`;
      } else {
        draft = `Hi ${custName}, thank you for reaching out to Royal Wellness Center. We've received your inquiry regarding "${message.content.slice(0, 40)}..." and our medical coordinator is ready to assist you. What day works best for your visit?`;
      }

      setAiDraft(draft);
      setLoading(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [isOpen, message, lead]);

  if (!isOpen || !message) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(aiDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendAi = () => {
    if (!lead || !aiDraft) return;
    sendMessage(lead.id, aiDraft, 'ai');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#111b21] border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-100 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-teal-950/60 to-[#202c33]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 flex items-center justify-center shadow-md font-bold">
              <Sparkles className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>Meta AI Clinical Assistant</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Llama 3 / DeepSeek
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Contextual clinical response draft for WhatsApp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Message Context */}
        <div className="p-4 bg-[#0b141a] border-b border-slate-800 text-xs">
          <p className="text-slate-400 text-[11px] mb-1 font-semibold uppercase tracking-wider">Patient Message:</p>
          <div className="p-2.5 bg-[#202c33] rounded-xl border border-slate-700/50 text-slate-200">
            "{message.content}"
          </div>
        </div>

        {/* AI Suggested Response Box */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
              <Bot className="w-4 h-4" /> Recommended Clinical WhatsApp Reply:
            </span>
            {loading && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin text-teal-400" /> Generating...
              </span>
            )}
          </div>

          <textarea
            rows={4}
            value={aiDraft}
            onChange={(e) => setAiDraft(e.target.value)}
            disabled={loading}
            className="w-full bg-[#202c33] border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500 transition-all resize-none leading-relaxed"
          />

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-[#202c33] flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Review & approve before sending</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-xl hover:bg-slate-700/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSendAi}
              disabled={loading || !aiDraft.trim()}
              className="px-4 py-1.5 bg-whatsapp hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send via WhatsApp</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
