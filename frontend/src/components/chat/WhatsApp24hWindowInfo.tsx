import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';
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
  messages,
  compact = false 
}) => {
  const [now, setNow] = useState<number>(Date.now());

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
  const lastMessageText = hasCustomerMessage ? formatWindowTimestamp(lastCustomerMessageTime) : 'No message received yet';
  const expiresAtText = hasCustomerMessage ? formatWindowTimestamp(expiresAt) : 'Window Closed';

  return (
    <div className="w-full bg-[#0a1f1b] border border-[#163f35] rounded-xl p-3 sm:p-3.5 text-white select-none shadow-sm transition-all">
      {/* Header matching screenshot */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-full border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <h4 className="font-semibold text-xs sm:text-[13px] text-[#e9edef] tracking-tight truncate">
            WhatsApp 24-Hour Window Information
          </h4>
        </div>

        {/* Status Pill Badge */}
        <span 
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${statusInfo.badgeBg} ${statusInfo.badgeBorder} ${statusInfo.textColor}`}
          title={`Status: ${statusInfo.label}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
          <span>{statusInfo.label}</span>
        </span>
      </div>

      {/* 3 Information Cards matching screenshot layout */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Card 1: Last Customer Message Time */}
        <div className="bg-[#0e2420]/90 border border-[#1a4439] rounded-lg p-2.5 flex flex-col justify-between min-w-0">
          <span className="text-[10px] sm:text-[11px] text-[#8696a0] font-medium leading-tight mb-1 truncate block">
            Last Customer Message Time
          </span>
          <div className="flex items-center gap-1.5 text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-[#e9edef] truncate font-mono">
              {lastMessageText}
            </span>
          </div>
        </div>

        {/* Card 2: 24H Window Expires At */}
        <div className="bg-[#0e2420]/90 border border-[#1a4439] rounded-lg p-2.5 flex flex-col justify-between min-w-0">
          <span className="text-[10px] sm:text-[11px] text-[#8696a0] font-medium leading-tight mb-1 truncate block">
            24H Window Expires At
          </span>
          <div className="flex items-center gap-1.5 text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-[#e9edef] truncate font-mono">
              {expiresAtText}
            </span>
          </div>
        </div>

        {/* Card 3: Time Remaining */}
        <div className="bg-[#0e2420]/90 border border-[#1a4439] rounded-lg p-2.5 flex flex-col justify-between min-w-0">
          <span className="text-[10px] sm:text-[11px] text-[#8696a0] font-medium leading-tight mb-1 truncate block">
            Time Remaining
          </span>
          <div className="flex items-center gap-1.5">
            <Clock className={`w-4 h-4 shrink-0 ${statusInfo.iconColor}`} />
            <span className={`text-xs sm:text-sm font-bold font-mono tracking-tight ${statusInfo.countdownColor}`}>
              {countdownText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
