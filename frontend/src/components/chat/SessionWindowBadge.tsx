import React, { useState, useEffect } from 'react';
import { 
  getWindowStatus, 
  formatWindowCountdown 
} from '../../utils/window24hUtils';

interface SessionWindowBadgeProps {
  lastCustomerMessageAt?: string;
}

export const SessionWindowBadge: React.FC<SessionWindowBadgeProps> = ({ lastCustomerMessageAt }) => {
  // Lazy initializer: Date.now() during render is impure under the React Compiler.
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const lastMsgTime = lastCustomerMessageAt ? new Date(lastCustomerMessageAt).getTime() : 0;
  const hasCustomerMessage = lastMsgTime > 0 && !isNaN(lastMsgTime);
  const expiresAt = hasCustomerMessage ? lastMsgTime + (24 * 60 * 60 * 1000) : 0;
  const remainingMs = expiresAt > 0 ? Math.max(0, expiresAt - now) : 0;

  const statusInfo = getWindowStatus(remainingMs, hasCustomerMessage);
  const countdownText = formatWindowCountdown(remainingMs);

  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 border whitespace-nowrap shadow-sm ${statusInfo.badgeBg} ${statusInfo.badgeBorder} ${statusInfo.textColor}`}
      title={`WhatsApp 24-Hour Window: ${statusInfo.label} (${countdownText})`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
      <span>{statusInfo.label}</span>
      {hasCustomerMessage && remainingMs > 0 && (
        <>
          <span className="opacity-50">•</span>
          <span className="font-mono font-bold tracking-tight">{countdownText}</span>
        </>
      )}
    </span>
  );
};
