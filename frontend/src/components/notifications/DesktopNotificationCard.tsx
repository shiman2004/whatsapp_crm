import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Mail, 
  MoreHorizontal, 
  Image as ImageIcon,
  Mic,
  FileText
} from 'lucide-react';
import { DesktopNotificationItem } from '../../types/notifications';
import { WhatsAppAvatar } from '../chat/WhatsAppAvatar';
import { useCrm } from '../../context/CrmContext';

interface DesktopNotificationCardProps {
  notification: DesktopNotificationItem;
  onDismiss: (id: string) => void;
  onClick: (leadId: string) => void;
}

export const DesktopNotificationCard: React.FC<DesktopNotificationCardProps> = ({
  notification,
  onDismiss,
  onClick,
}) => {
  const { sendMessage } = useCrm();
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuOpen) setMenuOpen(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [menuOpen]);

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking on quick reply input or buttons, don't trigger navigation
    const target = e.target as HTMLElement;
    if (target.closest('input') || target.closest('button')) {
      return;
    }
    onClick(notification.leadId);
  };

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = replyText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    try {
      sendMessage(notification.leadId, text);
      setReplyText('');
      onDismiss(notification.id);
    } catch (err) {
      console.error('[Notification Quick Reply] Failed to send:', err);
    } finally {
      setIsSending(false);
    }
  };

  const renderMediaIcon = () => {
    if (!notification.mediaType) return null;
    if (notification.mediaType === 'image') return <ImageIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0 inline mr-1" />;
    if (notification.mediaType === 'audio') return <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0 inline mr-1" />;
    return <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0 inline mr-1" />;
  };

  return (
    <div 
      onClick={handleCardClick}
      className="w-[340px] sm:w-[360px] bg-[#202c33] border border-[#2a3942] rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 hover:border-[#00a884]/40 hover:shadow-[#00a884]/5 pointer-events-auto select-none animate-in slide-in-from-bottom-5 fade-in duration-200"
      style={{
        backdropFilter: 'blur(16px)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05)'
      }}
    >
      {/* 1. Header Bar: WhatsApp Logo + Label + Actions (Matches Reference Screenshot) */}
      <div className="px-3.5 pt-2.5 pb-1.5 flex items-center justify-between text-[#8696a0] border-b border-[#2a3942]/40 bg-[#182229]/60">
        <div className="flex items-center gap-1.5">
          {/* Authentic WhatsApp Green Icon */}
          <div className="w-4 h-4 rounded-full bg-[#25D366] flex items-center justify-center text-slate-950 font-bold">
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.97.531 1.93.82 2.796.82 3.181 0 5.767-2.586 5.768-5.766 0-3.18-2.587-5.766-5.768-5.766zm3.364 8.167c-.14.394-.711.722-.98.769-.25.044-.576.064-1.802-.443-1.468-.607-2.42-2.107-2.493-2.204-.073-.098-.598-.795-.598-1.515 0-.72.378-1.074.512-1.222.134-.147.294-.184.392-.184.098 0 .196.002.281.006.09.005.21-.034.329.252.122.294.417 1.018.454 1.092.037.074.061.16.012.258-.049.098-.073.16-.147.245-.073.086-.155.192-.221.258-.074.073-.151.153-.065.3.086.147.382.63.818 1.018.562.5 1.036.655 1.183.728.147.073.233.061.32-.037.086-.098.368-.429.466-.576.098-.147.196-.123.331-.074.135.049.858.405 1.005.478.147.074.245.11.282.172.037.061.037.356-.103.75z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-[#d1d7db] tracking-wide">WhatsApp</span>
          {notification.company && (
            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-teal-300 border border-slate-700/60 ml-0.5">
              {notification.company}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Options Menu Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="p-1 rounded-md text-[#8696a0] hover:text-white hover:bg-[#374248] transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 w-36 bg-[#233138] border border-[#2a3942] rounded-xl shadow-xl py-1 text-xs text-[#d1d7db] z-50 animate-in fade-in zoom-in-95"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onClick(notification.leadId);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#182229] transition-colors flex items-center gap-2"
                >
                  Open Chat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDismiss(notification.id);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#182229] transition-colors text-slate-400 hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Dismiss (×) Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(notification.id);
            }}
            className="p-1 rounded-md text-[#8696a0] hover:text-white hover:bg-[#374248] transition-colors cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Body: Avatar + Contact Name + Preview + Unread Count + Timestamp */}
      <div className="p-3.5 flex items-start gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors">
        {/* Contact Profile Picture / Avatar */}
        <div className="shrink-0 mt-0.5">
          <WhatsAppAvatar
            name={notification.contactName}
            avatarUrl={notification.avatarUrl}
            size="md"
            isOnline={true}
          />
        </div>

        {/* Info Column */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5 mb-0.5">
            <h4 className="text-[13px] font-semibold text-[#e9edef] truncate leading-snug">
              {notification.contactName}
            </h4>
            <span className="text-[10px] text-[#8696a0] shrink-0 font-medium">
              {notification.timeDisplay}
            </span>
          </div>

          {/* Message Preview */}
          <p className="text-xs text-[#8696a0] line-clamp-2 leading-relaxed break-words">
            {renderMediaIcon()}
            <span>{notification.messageText}</span>
          </p>

          {/* Unread Counter Badge (Matches Reference Screenshot) */}
          {(notification.unreadCount && notification.unreadCount > 1) ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#00a884] font-medium">
              <Mail className="w-3 h-3 text-[#00a884]" />
              <span>{notification.unreadCount} unread messages</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* 3. Bottom Quick Reply Input Bar (Matches Reference Screenshot) */}
      <form 
        onSubmit={handleSendReply}
        className="px-3 pb-3 pt-0 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 bg-[#111b21] border border-[#2a3942] rounded-lg px-2.5 py-1.5 flex items-center focus-within:border-[#00a884]/60 transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type a reply"
            disabled={isSending}
            className="w-full bg-transparent text-xs text-[#d1d7db] placeholder-[#8696a0] outline-none font-sans"
          />
        </div>
        <button
          type="submit"
          disabled={!replyText.trim() || isSending}
          className="px-3 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#008f6f] disabled:bg-[#202c33] disabled:text-[#8696a0] text-slate-950 font-bold text-xs flex items-center gap-1 transition-all shrink-0 cursor-pointer shadow-sm active:scale-95"
          title="Send reply"
        >
          {isSending ? (
            <span className="animate-pulse text-[11px]">Sending...</span>
          ) : (
            <>
              <span>Send</span>
              <Send className="w-3 h-3 ml-0.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
