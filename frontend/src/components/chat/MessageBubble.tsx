import React, { useState, useRef, useEffect } from 'react';
import { 
  Check, 
  CheckCheck, 
  FileText,
  Download,
  Maximize2,
  X,
  ChevronDown, 
  Info, 
  CornerUpLeft, 
  Copy, 
  Smile, 
  Forward, 
  Pin, 
  Sparkles, 
  Star, 
  Trash2,
  Plus,
  AlertCircle,
  Pencil,
  Flag,
  Clock,
  RefreshCw,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { Message, Lead } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { API_BASE_URL } from '../../config/api';
import { getMessageSenderAuditText } from '../../utils/auditUtils';
import { MessageInfoModal } from './MessageInfoModal';
import { ForwardMessageModal } from './ForwardMessageModal';
import { MessageMetaAiModal } from './MessageMetaAiModal';
import { WhatsAppVoiceNotePlayer } from './WhatsAppVoiceNotePlayer';

interface MessageBubbleProps {
  message: Message;
  lead?: Lead;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EXTENDED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '🎉', '💯', '✨', '🤝'];

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, lead }) => {
  const { 
    currentUser,
    setReplyingMessage, 
    reactToMessage, 
    starMessage, 
    pinMessage, 
    deleteMessage,
    editMessage,
    reportMessage,
    retryFailedMessage,
    sendWhatsAppTemplate
  } = useCrm();

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [reactionPosAbove, setReactionPosAbove] = useState(true);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [metaAiModalOpen, setMetaAiModalOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');

  const bubbleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOutbound = message.direction === 'outbound';

  // Sync editContent when message.content changes
  useEffect(() => {
    setEditContent(message.content || '');
  }, [message.content]);

  // Open context menu with viewport-clamped fixed positioning (prevents clipping behind header)
  const handleOpenMenu = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    const targetEl = (e?.currentTarget as HTMLElement) || bubbleRef.current;
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      const menuWidth = 210;
      const menuHeight = 390;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // Horizontal position
      let left = isOutbound ? (rect.right - menuWidth) : rect.left;
      if (left + menuWidth > windowWidth - 12) {
        left = windowWidth - menuWidth - 12;
      }
      if (left < 12) {
        left = 12;
      }

      // Vertical position (try downward, then upward)
      let top = rect.bottom + 4;
      if (top + menuHeight > windowHeight - 12) {
        top = rect.top - menuHeight - 4;
      }

      // CRITICAL CLAMP: Never clip above header (min 60px) and never overflow bottom
      const minTop = 60;
      const maxTop = Math.max(minTop, windowHeight - menuHeight - 12);
      top = Math.max(minTop, Math.min(top, maxTop));

      setMenuPos({ top, left });
    }
    setShowReactionPicker(false);
    setShowFullPicker(false);
    setMenuOpen(true);
  };

  // Open context menu on mouse right-click (exact WhatsApp Web behavior)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 220;
    const menuHeight = 440;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let left = e.clientX;
    if (left + menuWidth > windowWidth - 12) {
      left = windowWidth - menuWidth - 12;
    }
    if (left < 12) left = 12;

    let top = e.clientY;
    if (top + menuHeight > windowHeight - 12) {
      top = windowHeight - menuHeight - 12;
    }
    if (top < 60) top = 60;

    setMenuPos({ top, left });
    setShowReactionPicker(false);
    setShowFullPicker(false);
    setMenuOpen(true);
  };

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleDocumentClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  // Close context menu on scroll or window resize
  useEffect(() => {
    if (!menuOpen) return;
    const handleScrollOrResize = () => {
      setMenuOpen(false);
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [menuOpen]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showReactionPicker || showFullPicker) {
        setShowReactionPicker(false);
        setShowFullPicker(false);
      }
    };
    if (showReactionPicker || showFullPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showReactionPicker, showFullPicker]);

  // Actions
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setMenuOpen(false);
  };

  const handleReply = () => {
    setReplyingMessage(message);
    setMenuOpen(false);
  };

  const handleToggleReaction = (emoji: string) => {
    reactToMessage(message.id, emoji);
    setShowReactionPicker(false);
    setShowFullPicker(false);
    setMenuOpen(false);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    await editMessage(message.id, editContent.trim());
    setIsEditing(false);
  };

  // Format URLs inside text as clickable links
  const renderFormattedText = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="text-sky-300 underline hover:text-sky-200 break-all"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const auditDisplayText = isSuperAdmin && isOutbound ? getMessageSenderAuditText(message) : null;

  return (
    <>
      <div className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'} my-1`}>
        <div 
          className={`flex items-center gap-1.5 group relative z-10 ${
            isOutbound ? 'justify-end' : 'justify-start'
          } ${menuOpen || showReactionPicker ? 'z-40' : ''}`}
        >
        {/* Outbound Hover Emoji Trigger (Appears to the LEFT of outbound bubble) */}
        {isOutbound && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (bubbleRef.current) {
                  const rect = bubbleRef.current.getBoundingClientRect();
                  setReactionPosAbove(rect.top >= 110);
                }
                setShowReactionPicker(!showReactionPicker);
                setMenuOpen(false);
              }}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                showReactionPicker 
                  ? 'bg-slate-200 dark:bg-slate-700 text-[#00a884] shadow-md' 
                  : 'bg-white/90 dark:bg-black/30 hover:bg-white dark:hover:bg-[#202c33] text-[#54656f] dark:text-slate-400 hover:text-[#111b21] dark:hover:text-slate-200 shadow-sm border border-slate-200/80 dark:border-transparent'
              }`}
              title="React"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Message Bubble Box */}
        <div
          ref={bubbleRef}
          onContextMenu={handleContextMenu}
          title={auditDisplayText ? `Audit Trail: ${auditDisplayText}` : undefined}
          className={`relative max-w-[85%] md:max-w-[65%] rounded-[7.5px] px-[9px] pt-[6px] pb-[8px] wa-bubble-shadow text-xs leading-relaxed transition-all ${
            isOutbound
              ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-tr-none'
              : 'bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-tl-none'
          } ${message.pinned ? 'border border-amber-500/50 shadow-amber-500/10' : ''}`}
        >
          {/* Authentic WhatsApp Corner SVG Tail */}
          {isOutbound ? (
            <svg 
              viewBox="0 0 8 13" 
              height="13" 
              width="8" 
              preserveAspectRatio="xMidYMid meet" 
              className="absolute top-0 -right-2 text-[#d9fdd3] dark:text-[#005c4b] fill-current pointer-events-none drop-shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]"
            >
              <path opacity="0.13" fill="#000000" d="M5.188,1H0v11.193l6.467-8.625 C7.526,2.156,6.958,1,5.188,1z" />
              <path fill="currentColor" d="M5.188,0H0v11.193l6.467-8.625C7.526,1.156,6.958,0,5.188,0z" />
            </svg>
          ) : (
            <svg 
              viewBox="0 0 8 13" 
              height="13" 
              width="8" 
              preserveAspectRatio="xMidYMid meet" 
              className="absolute top-0 -left-2 text-white dark:text-[#202c33] fill-current pointer-events-none drop-shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]"
            >
              <path opacity="0.13" fill="#000000" d="M1.533,3.568L8,12.193V1H2.812 C1.042,1,0.474,2.156,1.533,3.568z" />
              <path fill="currentColor" d="M1.533,2.568L8,11.193V0L2.812,0C1.042,0,0.474,1.156,1.533,2.568z" />
            </svg>
          )}

          {/* Top-Right Hover Chevron (WhatsApp Web standard) */}
          <div className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleOpenMenu}
              className="w-5 h-5 rounded-full bg-white/90 dark:bg-black/40 hover:bg-white dark:hover:bg-black/70 text-[#54656f] dark:text-slate-300 hover:text-[#111b21] dark:hover:text-white flex items-center justify-center shadow-xs border border-slate-200/60 dark:border-transparent transition-all"
              title="Menu"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Floating Emoji Reaction Bar (When open or clicked) */}
          {showReactionPicker && (
            <div 
              className={`absolute ${
                reactionPosAbove ? 'bottom-full mb-2' : 'top-full mt-2'
              } ${isOutbound ? 'right-0' : 'left-0'} z-50 animate-in fade-in zoom-in-95 duration-150`}
            >
              <div className="bg-white dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 rounded-full px-2 py-1 shadow-xl flex items-center gap-1 backdrop-blur-md">
                {(showFullPicker ? EXTENDED_EMOJIS : QUICK_EMOJIS).map((emoji) => {
                  const isActive = message.reactions?.[0] === emoji;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleToggleReaction(emoji)}
                      className={`w-7 h-7 flex items-center justify-center text-sm hover:scale-125 transition-transform rounded-full ${
                        isActive 
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 ring-1 ring-emerald-500 scale-110 shadow-xs' 
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700/70'
                      } active:scale-95`}
                      title={isActive ? 'Remove reaction' : `React ${emoji}`}
                    >
                      {emoji}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowFullPicker(!showFullPicker)}
                  className="w-6 h-6 flex items-center justify-center text-[#54656f] dark:text-slate-400 hover:text-[#111b21] dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-all"
                  title="More reactions"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Quoted Reply Preview (if replyTo exists) */}
          {message.replyTo && (
            <div className="mb-1.5 p-2 rounded-lg bg-black/[0.05] dark:bg-black/25 border-l-4 border-[#00a884] text-[#111b21] dark:text-slate-200 text-[11px]">
              <span className="font-bold text-[#008069] dark:text-teal-300 block text-[10px]">
                {message.replyTo.senderName}
              </span>
              <p className="line-clamp-1 italic text-[#54656f] dark:text-slate-300">
                {message.replyTo.content}
              </p>
            </div>
          )}

          {/* Rich Media Attachment (Image, Video, Audio, Document) */}
          {message.media && message.media.url && (() => {
            const rawUrl = message.media.url;
            const mediaUrl = rawUrl.startsWith('/') && !rawUrl.startsWith('//') ? `${API_BASE_URL}${rawUrl}` : rawUrl;
            return (
              <div className="mb-1 rounded-lg overflow-hidden">
                {message.media.type === 'image' || mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) ? (
                  <div 
                    className="relative group/media cursor-pointer rounded-lg overflow-hidden bg-black/20"
                    onClick={() => setLightboxUrl(mediaUrl)}
                  >
                    <img 
                      src={mediaUrl} 
                      alt={message.media.fileName || 'Photo'} 
                      className="w-full max-h-80 object-cover rounded-lg hover:brightness-95 transition-all"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
                      <Maximize2 className="w-6 h-6 text-white drop-shadow-lg" />
                    </div>
                  </div>
                ) : message.media.type === 'video' || mediaUrl.match(/\.(mp4|webm|mov)($|\?)/i) ? (
                  <div className="relative rounded-lg overflow-hidden bg-black/40">
                    <video 
                      src={mediaUrl} 
                      controls 
                      playsInline 
                      className="w-full max-h-80 rounded-lg"
                    />
                  </div>
                ) : (message.media.type === 'audio' || mediaUrl.match(/\.(ogg|opus|mp3|wav|m4a|aac|webm)($|\?)/i)) ? (
                  <WhatsAppVoiceNotePlayer 
                    message={{ ...message, media: { ...message.media, url: mediaUrl } }}
                    senderName={isOutbound ? currentUser.fullName : (lead?.customer?.displayName || 'Customer')}
                    senderAvatar={isOutbound ? currentUser.avatar : lead?.customer?.avatarUrl}
                    isOutbound={isOutbound}
                  />
                ) : (
                  <a 
                    href={mediaUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    download={message.media.fileName || 'document'}
                    className="p-2.5 rounded-lg bg-black/25 border border-white/10 flex items-center gap-3 hover:bg-black/40 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate text-[#e9edef]">{message.media.fileName || 'Document'}</p>
                      <p className="text-[10px] text-[#8696a0]">Click to view / download</p>
                    </div>
                    <Download className="w-4 h-4 text-[#8696a0] hover:text-white shrink-0" />
                  </a>
                )}
              </div>
            );
          })()}

          {/* Message Content / Inline Editing & Inline Timestamp */}
          {(!message.media || message.media.type !== 'audio' || (message.content && message.content !== 'Voice note' && message.content.trim().length > 0)) && (
            isEditing ? (
              <div className="pt-0.5 pb-1 min-w-[220px]">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit();
                    } else if (e.key === 'Escape') {
                      setIsEditing(false);
                      setEditContent(message.content || '');
                    }
                  }}
                  autoFocus
                  rows={Math.min(5, Math.max(2, editContent.split('\n').length))}
                  className="w-full bg-[#111b21] text-[#e9edef] text-[13px] leading-relaxed p-2 rounded-lg border border-emerald-500/70 focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none font-sans"
                />
                <div className="flex items-center justify-between mt-1 text-[10px] text-[#8696a0]">
                  <span>Enter to save • Esc to cancel</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setEditContent(message.content || '');
                      }}
                      className="px-2 py-0.5 rounded text-slate-300 hover:bg-black/30 transition-colors flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={!editContent.trim()}
                      className="px-2.5 py-0.5 rounded bg-[#00a884] hover:bg-[#008f6f] text-white font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" />
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[14.2px] leading-[19px] text-[#111b21] dark:text-[#e9edef] break-words select-text font-normal">
                <span className="whitespace-pre-wrap">{renderFormattedText(message.content)}</span>

                {/* Location card preview if Google Maps link is present */}
                {message.content && (message.content.includes('maps.app.goo.gl') || message.content.includes('maps.google.com') || message.content.includes('goo.gl/maps')) && (() => {
                  const mapUrlMatch = message.content.match(/(https?:\/\/[^\s]+)/);
                  const mapUrl = mapUrlMatch ? mapUrlMatch[0] : '';
                  const locationName = message.content.includes(' - ') 
                    ? message.content.split(' - ')[0].trim() 
                    : message.content.includes('Colombo') ? 'Colombo' : message.content.includes('Maruthamunai') ? 'Maruthamunai' : 'Location';
                  if (!mapUrl) return null;
                  return (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 mb-1 flex items-center gap-2.5 p-2 rounded-lg bg-black/5 dark:bg-black/25 hover:bg-black/10 dark:hover:bg-black/40 border border-[#00a884]/30 hover:border-[#00a884]/60 transition-all text-left cursor-pointer select-none group/loc"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center shrink-0 group-hover/loc:scale-110 transition-transform">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[#111b21] dark:text-[#e9edef] flex items-center gap-1.5">
                          <span>{locationName}</span>
                          <ExternalLink className="w-3 h-3 text-[#667781] dark:text-[#8696a0] group-hover/loc:text-[#111b21] dark:group-hover/loc:text-white" />
                        </div>
                        <p className="text-[10px] text-[#00a884] truncate">Open Google Maps</p>
                      </div>
                    </a>
                  );
                })()}
                
                {/* Inline float-right timestamp container */}
                <span className="inline-flex items-center gap-1 float-right ml-2.5 mt-1 -mb-0.5 select-none align-bottom text-[11px] text-[#667781] dark:text-[#8696a0] font-normal">
                  {message.pinned && (
                    <Pin className="w-3 h-3 fill-[#8696a0] text-[#8696a0] -rotate-45" />
                  )}
                  {message.starred && (
                    <Star className="w-3 h-3 fill-[#8696a0] text-[#8696a0]" />
                  )}
                  {message.edited && (
                    <span className="italic text-[10px] text-[#8696a0] mr-0.5">edited</span>
                  )}
                  <span className="whitespace-nowrap">
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                  {isOutbound && (
                    message.status === 'failed' ? (
                      <span title={`Failed to Send${message.errorCode ? ` (Code ${message.errorCode})` : ''}: ${message.errorMessage || 'WhatsApp API dispatch failed'}`}><AlertCircle className="w-3.5 h-3.5 text-rose-400" /></span>
                    ) : (message.status === 'read' && Boolean(message.readAt || (message as any).read_at)) ? (
                      <span title="Read by customer"><CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" /></span>
                    ) : (message.status === 'delivered' || message.status === 'read') ? (
                      <span title="Delivered to customer"><CheckCheck className="w-3.5 h-3.5 text-[#8696a0]" /></span>
                    ) : message.status === 'sent' ? (
                      <span title="Sent to WhatsApp Cloud"><Check className="w-3.5 h-3.5 text-[#8696a0]" /></span>
                    ) : (
                      <span title="Sending to WhatsApp..."><Clock className="w-3.5 h-3.5 text-[#8696a0] animate-pulse" /></span>
                    )
                  )}
                </span>

                {/* Failed to send detailed error banner */}
                {message.status === 'failed' && isOutbound && (
                  <div className="mt-2 pt-1.5 border-t border-rose-500/30 flex flex-col gap-1 text-[11px] text-rose-300">
                    <div className="flex items-center gap-1.5 font-semibold text-rose-400">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Failed to Send {message.errorCode ? `[Code ${message.errorCode}]` : ''}</span>
                    </div>
                    <p className="text-[10.5px] leading-tight text-rose-200/90 break-words">
                      {message.errorMessage || 'Message was rejected by Meta WhatsApp Cloud API. Customer may not have replied within 24 hours.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {message.errorCode === 131047 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const isCras = lead?.source?.toUpperCase() === 'CRAS' || lead?.company === 'CRAS';
                            const tplName = isCras ? 'cras_welcome_greeting' : 'rwc_welcome_greeting';
                            const clientName = lead?.customer?.displayName || (isCras ? 'Dr. Perera' : 'Valued Client');
                            sendWhatsAppTemplate(lead?.id || message.leadId, tplName, [clientName], message.id);
                          }}
                          className="px-3 py-1 rounded bg-[#00a884] hover:bg-[#00c298] text-slate-950 font-bold transition-all flex items-center gap-1.5 text-[11px] shadow-sm cursor-pointer"
                          title="Send official Meta-approved template to re-engage contact"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Send Approved Template 🚀
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          retryFailedMessage(message.id);
                        }}
                        className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-medium transition-colors flex items-center gap-1.5 text-[10.5px] cursor-pointer"
                        title="Retry sending this message"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Inbound Hover Emoji Trigger (Appears to the RIGHT of inbound bubble) */}
        {!isOutbound && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (bubbleRef.current) {
                  const rect = bubbleRef.current.getBoundingClientRect();
                  setReactionPosAbove(rect.top >= 110);
                }
                setShowReactionPicker(!showReactionPicker);
                setMenuOpen(false);
              }}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                showReactionPicker 
                  ? 'bg-slate-200 dark:bg-slate-700 text-[#00a884] shadow-md' 
                  : 'bg-white/90 dark:bg-black/30 hover:bg-white dark:hover:bg-[#202c33] text-[#54656f] dark:text-slate-400 hover:text-[#111b21] dark:hover:text-slate-200 shadow-sm border border-slate-200/80 dark:border-transparent'
              }`}
              title="React"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Single Reaction Badge below the Bubble */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={`absolute -bottom-2.5 ${isOutbound ? 'right-2' : 'left-2'} z-20`}>
            <div 
              onClick={() => handleToggleReaction(message.reactions![0])}
              className="bg-white dark:bg-[#1f2c34] hover:bg-slate-50 dark:hover:bg-[#2a3942] border border-slate-200 dark:border-slate-700/80 px-1.5 py-0.5 rounded-full shadow-xs dark:shadow-lg flex items-center justify-center cursor-pointer text-xs text-[#111b21] dark:text-white backdrop-blur-md hover:scale-115 transition-all select-none"
              title="Click to remove reaction"
            >
              <span>{message.reactions[0]}</span>
            </div>
          </div>
        )}
        </div>

        {/* Super Admin ONLY: Message Sender Identification & Audit Trail */}
        {isSuperAdmin && isOutbound && auditDisplayText && (
          <div 
            className="text-[11px] font-medium tracking-tight text-amber-700 dark:text-yellow-400 text-right mt-1 pr-1 select-none animate-in fade-in duration-150"
            title={`Internal Audit: ${auditDisplayText}`}
          >
            {auditDisplayText}
          </div>
        )}
      </div>

      {/* Backdrop for Context Menu (Click outside to close) */}
      {menuOpen && (
        <div 
          className="fixed inset-0 z-[95] bg-transparent cursor-default"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(false);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen(false);
          }}
        />
      )}

      {/* WhatsApp Web 1:1 Context Menu (Viewport Clamped, NEVER Cut Off) */}
      {menuOpen && menuPos && (
        <div 
          ref={menuRef}
          style={{ 
            position: 'fixed', 
            top: `${menuPos.top}px`, 
            left: `${menuPos.left}px`,
            maxHeight: 'calc(100vh - 76px)',
            overflowY: 'auto'
          }}
          className="z-[100] w-52 bg-white dark:bg-[#233138] border border-slate-200 dark:border-slate-700/90 rounded-2xl shadow-2xl py-1.5 text-[#111b21] dark:text-slate-200 text-xs animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md select-none custom-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Quick Reaction Bar (WhatsApp Web style at top of context menu) */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-1 bg-slate-50/90 dark:bg-[#182229]/80 rounded-t-2xl">
            {QUICK_EMOJIS.map((emoji) => {
              const isActive = message.reactions?.[0] === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleToggleReaction(emoji)}
                  className={`w-7 h-7 flex items-center justify-center text-sm hover:scale-125 transition-transform rounded-full ${
                    isActive ? 'bg-emerald-100 dark:bg-emerald-950/80 ring-1 ring-emerald-500 scale-110 shadow-xs' : 'hover:bg-slate-200/80 dark:hover:bg-slate-700/60'
                  }`}
                  title={`React ${emoji}`}
                >
                  {emoji}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setShowFullPicker(true);
                setShowReactionPicker(true);
              }}
              className="w-6 h-6 flex items-center justify-center text-[#54656f] dark:text-slate-400 hover:text-[#111b21] dark:hover:text-white rounded-full hover:bg-slate-200/80 dark:hover:bg-slate-700/60 transition-all"
              title="More reactions"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 2. Message info */}
          <button
            onClick={() => {
              setInfoModalOpen(true);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors"
          >
            <Info className="w-4 h-4 text-[#54656f] dark:text-slate-400 shrink-0" />
            <span>Message info</span>
          </button>

          {/* 3. Reply */}
          <button
            onClick={handleReply}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors"
          >
            <CornerUpLeft className="w-4 h-4 text-[#54656f] dark:text-slate-400 shrink-0" />
            <span>Reply</span>
          </button>

          {/* 4. Copy */}
          <button
            onClick={handleCopy}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors"
          >
            <Copy className="w-4 h-4 text-[#54656f] dark:text-slate-400 shrink-0" />
            <span>Copy</span>
          </button>

          {/* 5. Edit (WhatsApp Web: Available for outbound text messages) */}
          {isOutbound && !message.media && (
            <button
              onClick={() => {
                setIsEditing(true);
                setEditContent(message.content || '');
                setMenuOpen(false);
              }}
              className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors text-emerald-600 dark:text-emerald-400 font-medium"
            >
              <Pencil className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Edit</span>
            </button>
          )}

          {/* 6. React */}
          <button
            onClick={() => {
              if (bubbleRef.current) {
                const rect = bubbleRef.current.getBoundingClientRect();
                setReactionPosAbove(rect.top >= 110);
              }
              setShowReactionPicker(true);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors"
          >
            <Smile className="w-4 h-4 text-[#54656f] dark:text-slate-400 shrink-0" />
            <span>React</span>
          </button>

          {/* 7. Download (For media messages) */}
          {message.media && message.media.url && (
            <button
              onClick={() => {
                if (!message.media?.url) return;
                const link = document.createElement('a');
                link.href = message.media.url;
                link.download = message.media.fileName || 'media';
                link.target = '_blank';
                link.click();
                setMenuOpen(false);
              }}
              className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors"
            >
              <Download className="w-4 h-4 text-[#54656f] dark:text-slate-400 shrink-0" />
              <span>Download</span>
            </button>
          )}

          {/* 8. Forward */}
          <button
            onClick={() => {
              setForwardModalOpen(true);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors"
          >
            <Forward className="w-4 h-4 text-[#54656f] dark:text-slate-400 shrink-0" />
            <span>Forward</span>
          </button>

          {/* 7. Pin / Unpin */}
          <button
            onClick={() => {
              pinMessage(message.id);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors"
          >
            <Pin className="w-4 h-4 text-[#54656f] dark:text-slate-400 shrink-0" />
            <span>{message.pinned ? 'Unpin' : 'Pin'}</span>
          </button>

          {/* 8. Ask Meta AI */}
          <button
            onClick={() => {
              setMetaAiModalOpen(true);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors text-teal-600 dark:text-teal-300 font-medium"
          >
            <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>Ask Meta AI</span>
          </button>

          {/* 9. Star / Unstar */}
          <button
            onClick={() => {
              starMessage(message.id);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors"
          >
            <Star className={`w-4 h-4 shrink-0 ${message.starred ? 'text-amber-500 fill-amber-500' : 'text-[#54656f] dark:text-slate-400'}`} />
            <span>{message.starred ? 'Unstar' : 'Star'}</span>
          </button>

          {/* 10. Report (Inbound messages) */}
          {!isOutbound && (
            <button
              onClick={() => {
                reportMessage(message.id);
                setMenuOpen(false);
              }}
              className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] transition-colors text-amber-600 dark:text-amber-300"
            >
              <Flag className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Report</span>
            </button>
          )}

          <div className="h-px bg-slate-100 dark:bg-slate-700/60 my-1" />

          {/* 11. Delete */}
          <button
            onClick={() => {
              deleteMessage(message.id);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-rose-50 dark:hover:bg-red-950/40 text-rose-600 dark:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-rose-600 dark:text-red-400 shrink-0" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Message Info Modal */}
      <MessageInfoModal
        isOpen={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        message={message}
        lead={lead}
      />

      {/* Forward Message Modal */}
      <ForwardMessageModal
        isOpen={forwardModalOpen}
        onClose={() => setForwardModalOpen(false)}
        message={message}
      />

      {/* Ask Meta AI Modal */}
      <MessageMetaAiModal
        isOpen={metaAiModalOpen}
        onClose={() => setMetaAiModalOpen(false)}
        message={message}
        lead={lead}
      />

      {/* Image Lightbox Modal */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxUrl(null)}
        >
          <button 
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all z-10"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={lightboxUrl} 
            alt="Full size preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
