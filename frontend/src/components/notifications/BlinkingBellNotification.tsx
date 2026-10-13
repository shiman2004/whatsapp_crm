import React from 'react';
import { Bell } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

interface BlinkingBellNotificationProps {
  variant?: 'rail' | 'chat-header' | 'top-header';
  className?: string;
}

export const BlinkingBellNotification: React.FC<BlinkingBellNotificationProps> = ({
  variant = 'rail',
  className = '',
}) => {
  const { totalUnreadCountForUser, openUnreadChats } = useCrm();
  const unreadCount = totalUnreadCountForUser || 0;
  const hasUnread = unreadCount > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openUnreadChats();
  };

  // Top header compact variant (for Header across other CRM pages)
  if (variant === 'top-header') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={hasUnread ? `${unreadCount} unread WhatsApp message${unreadCount > 1 ? 's' : ''} — Click to view` : 'WhatsApp Notifications — No unread messages'}
        className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
          hasUnread
            ? 'bg-red-950/60 border border-red-500/80 text-red-400 bell-glowing-active'
            : 'bg-[#202c33] border border-slate-700/60 text-[#8696a0] hover:text-[#d1d7db] hover:bg-[#374248]/60'
        } ${className}`}
      >
        <div className="relative flex items-center justify-center">
          <Bell className={`w-4 h-4 ${hasUnread ? 'text-white bell-icon-wiggle' : 'text-[#8696a0]'}`} />
          {hasUnread && (
            <span className="absolute -top-1.5 -right-2 bg-red-600 text-white font-extrabold text-[10px] min-w-[16px] h-[16px] px-0.5 rounded-full flex items-center justify-center shadow-md ring-1 ring-[#111b21] leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <span className={`text-xs font-bold ${hasUnread ? 'text-red-400' : 'text-[#8696a0]'}`}>
          {hasUnread ? 'NEW' : 'Alerts'}
        </span>
      </button>
    );
  }

  // Mobile chat header variant (rendered beside "WhatsApp" heading on mobile)
  if (variant === 'chat-header') {
    return (
      <div className={`relative flex flex-col items-center select-none ${className}`}>
        <button
          type="button"
          onClick={handleClick}
          title={hasUnread ? `${unreadCount} unread messages — Click to view` : 'WhatsApp Notifications'}
          className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
            hasUnread
              ? 'bg-[#202c33] border-2 border-red-500 bell-glowing-active'
              : 'bg-[#202c33] border border-[#2a3942] text-[#8696a0] hover:text-[#d1d7db]'
          }`}
        >
          {/* Pulsating Ping Wave Ring */}
          {hasUnread && (
            <span className="absolute -inset-1 rounded-full border border-red-500/70 animate-ping opacity-60 pointer-events-none" />
          )}

          {/* Bell Icon */}
          <Bell className={`w-4 h-4 ${hasUnread ? 'text-white bell-icon-wiggle' : 'text-[#8696a0]'}`} />

          {/* Counter Badge */}
          {hasUnread && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white font-extrabold text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-md ring-1 ring-[#111b21] leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* NEW Label Underneath */}
        {hasUnread && (
          <span className="text-[9px] font-black text-red-500 tracking-wider text-center uppercase leading-none mt-0.5 animate-pulse select-none">
            NEW
          </span>
        )}
      </div>
    );
  }

  // Primary Left Rail Variant — Pixel-perfect to reference screenshot
  return (
    <div className={`relative flex flex-col items-center justify-center select-none py-1 ${className}`}>
      {/* Outer wrapper with sonar arcs when active */}
      <div className="relative flex items-center justify-center">
        {/* Glowing Radar Sonar Curved Arcs (Flanking Left & Right) */}
        {hasUnread && (
          <>
            <span 
              className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-2 h-7 border-l-2 border-y-2 border-red-500/90 rounded-l-full animate-pulse pointer-events-none drop-shadow-[0_0_6px_rgba(239,68,68,0.95)]" 
              aria-hidden="true"
            />
            <span 
              className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-2 h-7 border-r-2 border-y-2 border-red-500/90 rounded-r-full animate-pulse pointer-events-none drop-shadow-[0_0_6px_rgba(239,68,68,0.95)]" 
              aria-hidden="true"
            />
            {/* Outer expanding ping aura ring */}
            <span 
              className="absolute -inset-1.5 rounded-full border border-red-500/60 animate-ping opacity-60 pointer-events-none" 
              aria-hidden="true"
            />
          </>
        )}

        {/* Circular Bell Button */}
        <button
          type="button"
          onClick={handleClick}
          title={
            hasUnread
              ? `${unreadCount} unread WhatsApp message${unreadCount > 1 ? 's' : ''} — Click to filter unread conversations`
              : 'WhatsApp Notifications — All messages read'
          }
          className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer select-none active:scale-95 shadow-md ${
            hasUnread
              ? 'bg-[#202c33] border-2 border-red-500 bell-glowing-active'
              : 'bg-[#202c33] border border-[#2a3942]/70 text-[#8696a0] hover:text-[#d1d7db] hover:bg-[#374248]/60'
          }`}
        >
          {/* Bell Icon: Solid white and subtly wiggling when unread messages exist */}
          <Bell 
            className={`w-5 h-5 transition-colors ${
              hasUnread 
                ? 'text-white fill-white bell-icon-wiggle drop-shadow-[0_0_4px_rgba(255,255,255,0.7)]' 
                : 'text-[#8696a0]'
            }`} 
          />

          {/* Small Red Unread Counter Badge at top-right */}
          {hasUnread && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white font-black text-[11px] min-w-[20px] h-[20px] px-1 rounded-full flex items-center justify-center shadow-lg border-2 border-[#111b21] leading-none z-10 animate-bounce">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Bold Red "NEW" text directly underneath the bell */}
      {hasUnread ? (
        <span className="text-[10px] font-black text-red-500 tracking-wider text-center uppercase leading-none mt-1 animate-pulse select-none drop-shadow-[0_0_4px_rgba(239,68,68,0.8)]">
          NEW
        </span>
      ) : (
        /* Invisible placeholder to prevent layout shift if needed, or null */
        <span className="h-[10px] mt-1" />
      )}
    </div>
  );
};
