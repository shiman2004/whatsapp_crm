import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Reply,
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
  const [replyOpen, setReplyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (replyOpen) {
      inputRef.current?.focus();
    }
  }, [replyOpen]);

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
      className="w-full max-w-[300px] bg-[#202c33]/95 border border-[#2a3942] rounded-xl shadow-lg overflow-hidden transition-all duration-200 hover:border-[#00a884]/50 pointer-events-auto select-none animate-in slide-in-from-bottom-3 fade-in duration-150"
      style={{
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.38)'
      }}
    >
      {/* Compact Dismissible WhatsApp Toast Row */}
      <div className="px-2.5 py-2 flex items-center gap-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors">
        <div className="relative shrink-0">
          <WhatsAppAvatar
            name={notification.contactName}
            avatarUrl={notification.avatarUrl}
            size="sm"
            isOnline={true}
          />
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#25D366] ring-2 ring-[#202c33]"
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <div className="min-w-0 flex items-center gap-1.5">
              <h4 className="text-xs font-semibold text-[#e9edef] truncate">
                {notification.contactName}
              </h4>
              {notification.company && (
                <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-teal-300 border border-slate-700/60 shrink-0">
                  {notification.company}
                </span>
              )}
              {(notification.unreadCount && notification.unreadCount > 1) ? (
                <span className="text-[9px] font-bold px-1.5 rounded-full bg-[#00a884]/20 text-[#25D366] shrink-0">
                  {notification.unreadCount}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] text-[#8696a0] shrink-0">
              {notification.timeDisplay}
            </span>
          </div>

          <p className="mt-0.5 text-[11px] text-[#8696a0] truncate">
            {renderMediaIcon()}
            <span>{notification.messageText}</span>
          </p>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setReplyOpen((v) => !v);
            }}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              replyOpen
                ? 'bg-[#00a884]/20 text-[#25D366]'
                : 'text-[#8696a0] hover:text-white hover:bg-[#374248]'
            }`}
            title="Quick reply"
            aria-label="Quick reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="p-1 rounded-md text-[#8696a0] hover:text-white hover:bg-[#374248] transition-colors"
              title="More options"
              aria-label="More options"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 bottom-full mb-1 w-32 bg-[#233138] border border-[#2a3942] rounded-lg shadow-xl py-1 text-xs text-[#d1d7db] z-50"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onClick(notification.leadId);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#182229] transition-colors"
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

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(notification.id);
            }}
            className="p-1 rounded-md text-[#8696a0] hover:text-white hover:bg-[#374248] transition-colors cursor-pointer"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* On-demand inline quick reply (keeps idle toast compact) */}
      {replyOpen && (
        <form 
          onSubmit={handleSendReply}
          className="px-2.5 pb-2 pt-1 border-t border-[#2a3942]/50 flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-1 bg-[#111b21] border border-[#2a3942] rounded-lg px-2 py-1 flex items-center focus-within:border-[#00a884]/60 transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type a reply..."
              disabled={isSending}
              className="w-full bg-transparent text-xs text-[#d1d7db] placeholder-[#8696a0] outline-none font-sans"
            />
          </div>
          <button
            type="submit"
            disabled={!replyText.trim() || isSending}
            className="px-2.5 py-1 rounded-lg bg-[#00a884] hover:bg-[#008f6f] disabled:bg-[#202c33] disabled:text-[#8696a0] text-slate-950 font-bold text-xs flex items-center gap-1 transition-all shrink-0 cursor-pointer"
            title="Send reply"
          >
            <Send className="w-3 h-3" />
          </button>
        </form>
      )}
    </div>
  );
};
