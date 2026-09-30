import React from 'react';
import { 
  X, 
  CheckCheck, 
  Check, 
  Clock, 
  ShieldCheck, 
  Smartphone, 
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { Message, Lead } from '../../types';

interface MessageInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  lead?: Lead;
}

export const MessageInfoModal: React.FC<MessageInfoModalProps> = ({
  isOpen,
  onClose,
  message,
  lead
}) => {
  if (!isOpen || !message) return null;

  const isOutbound = message.direction === 'outbound';
  const createdDate = new Date(message.createdAt);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#111b21] border border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100 animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-[#202c33]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Info className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">Message Info</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Preview Bubble */}
        <div className="p-4 bg-[#0b141a]/90 border-b border-slate-800">
          <div className={`p-3 rounded-xl text-xs leading-relaxed max-w-sm ${
            isOutbound ? 'bg-[#005c4b] text-slate-100 ml-auto' : 'bg-[#202c33] text-slate-100 mr-auto'
          }`}>
            <p className="whitespace-pre-line break-words text-[13px]">{message.content}</p>
            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-300 font-mono">
              <span>{createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              {isOutbound && <CheckCheck className="w-3.5 h-3.5 text-sky-400" />}
            </div>
          </div>
        </div>

        {/* Delivery & Read Receipts */}
        <div className="p-5 space-y-4 text-xs">
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Delivery Status</h4>
            
            {/* Read Status */}
            <div className="flex items-center justify-between p-3 bg-[#202c33]/70 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <CheckCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-slate-200 block">Read</span>
                  <span className="text-[11px] text-slate-400">
                    {message.status === 'read' ? 'Seen by recipient' : 'Sent via WhatsApp'}
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Delivered Status */}
            <div className="flex items-center justify-between p-3 bg-[#202c33]/70 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-slate-200 block">Delivered</span>
                  <span className="text-[11px] text-slate-400">Received on phone hardware</span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Technical WhatsApp Metadata */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-400">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-teal-400" /> Channel</span>
              <span className="text-slate-200 font-semibold font-mono">WhatsApp Cloud / Baileys</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-teal-400" /> Date</span>
              <span className="text-slate-200 font-mono">{createdDate.toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Encryption</span>
              <span className="text-emerald-400 font-medium">Signal Protocol 256-bit</span>
            </div>
            <div className="flex items-center justify-between truncate">
              <span className="shrink-0">Message ID</span>
              <span className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">{message.waMessageId || message.id}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#202c33] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-whatsapp hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
