import React, { useState, useEffect } from 'react';
import { Clock, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Lead, Message } from '../../types';
import { 
  formatWindowTimestamp, 
  formatWindowCountdown, 
  getWindowStatus, 
  getLatestCustomerMessageTime 
} from '../../utils/window24hUtils';

interface WhatsApp24hWindowInfoProps {
  lead: Lead;
  messages?: Message[];
  compact?: boolean;
}

export const WhatsApp24hWindowInfo: React.FC<WhatsApp24hWindowInfoProps> = ({ 
  lead, 
  messages
}) => {
  const [now, setNow] = useState<number>(Date.now());
  const [showDetails, setShowDetails] = useState(false);

  // Update every second automatically
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate latest incoming customer message timestamp (staff replies never reset this)
  const lastCustomerMessageTime = getLatestCustomerMessageTime(lead, messages);
  const hasCustomerMessage = lastCustomerMessageTime > 0;

  // Window expires strictly at latest customer message time + 24 hours
  const expiresAt = hasCustomerMessage ? lastCustomerMessageTime + (24 * 60 * 60 * 1000) : 0;
  const remainingMs = expiresAt > 0 ? Math.max(0, expiresAt - now) : 0;

  const statusInfo = getWindowStatus(remainingMs, hasCustomerMessage);
  const countdownText = formatWindowCountdown(remainingMs);
  const lastMessageText = hasCustomerMessage ? formatWindowTimestamp(lastCustomerMessageTime) : 'No message yet';
  const expiresAtText = hasCustomerMessage ? formatWindowTimestamp(expiresAt) : 'Window Closed';

  return (
    <div className="w-full bg-[#0a1f1b] border border-[#163f35] rounded-xl p-2 sm:p-2.5 text-white select-none shadow-sm transition-all">
      {/* Top Main Row: Icon, Title, Countdown, Badge & Details Toggle */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-full border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
            <Clock className="w-3 h-3" />
          </div>
          <span className="font-bold text-[11px] text-[#e9edef] tracking-tight truncate">
            24h Window:
          </span>
          <span className={`text-xs font-extrabold font-mono tracking-tight ${statusInfo.countdownColor}`}>
            {countdownText}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Status Pill Badge */}
          <span 
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.badgeBg} ${statusInfo.badgeBorder} ${statusInfo.textColor}`}
            title={`Status: ${statusInfo.label}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
            <span>{statusInfo.label}</span>
          </span>

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-slate-400 hover:text-slate-200 p-0.5 rounded hover:bg-[#163f35]/50 transition-colors"
            title={showDetails ? "Hide Window Timestamps" : "View Full Window Timestamps"}
          >
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Sleek Subtext / Details */}
      {showDetails ? (
        <div className="mt-2 pt-2 border-t border-[#163f35] grid grid-cols-2 gap-1.5 text-[10px] text-slate-300 font-mono animate-in fade-in duration-150">
          <div className="bg-[#0e2420]/90 p-1.5 rounded border border-[#1a4439]">
            <span className="text-[#8696a0] block text-[9px] font-sans font-medium">Last Client Message</span>
            <span className="truncate block font-semibold text-slate-200">{lastMessageText}</span>
          </div>
          <div className="bg-[#0e2420]/90 p-1.5 rounded border border-[#1a4439]">
            <span className="text-[#8696a0] block text-[9px] font-sans font-medium">Window Expires At</span>
            <span className="truncate block font-semibold text-slate-200">{expiresAtText}</span>
          </div>
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-between text-[9.5px] text-[#8696a0] font-mono px-0.5">
          <span className="truncate">Expires: {expiresAtText}</span>
        </div>
      )}
    </div>
  );
};
