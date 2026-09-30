import React from 'react';
import { Clock, ShieldCheck, AlertCircle } from 'lucide-react';

interface SessionWindowBadgeProps {
  lastCustomerMessageAt?: string;
}

export const SessionWindowBadge: React.FC<SessionWindowBadgeProps> = ({ lastCustomerMessageAt }) => {
  if (!lastCustomerMessageAt) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-semibold shrink-0 whitespace-nowrap">
        <AlertCircle className="w-2.5 h-2.5 text-amber-400 shrink-0" />
        <span>Template Req.</span>
      </span>
    );
  }

  const lastMsgTime = new Date(lastCustomerMessageAt).getTime();
  const now = Date.now();
  const diffHours = (now - lastMsgTime) / (1000 * 60 * 60);
  const remainingHours = Math.max(0, 24 - diffHours);
  const isOpen = remainingHours > 0;

  return (
    <span 
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 border whitespace-nowrap ${
        isOpen
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
      }`}
      title={isOpen ? 'Meta 24h Session Window open' : 'Session window closed (>24h)'}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
      <span>{isOpen ? `24h Active (${remainingHours.toFixed(0)}h)` : 'Window Closed'}</span>
    </span>
  );
};
