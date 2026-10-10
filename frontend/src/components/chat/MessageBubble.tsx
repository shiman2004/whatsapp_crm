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
  Flag
} from 'lucide-react';
import { Message, Lead } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { API_BASE_URL } from '../../config/api';
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
    reportMessage
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

  return (
    <>
      <div 
        ref={bubbleRef}
        className={`flex items-center gap-1.5 my-1 group relative z-10 ${
          isOutbound ? 'justify-end' : 'justify-start'
        } ${menuOpen || showReactionPicker ? 'z-40' : ''}`}
        onContextMenu={(e) => {
          e.preventDefault();
          handleOpenMenu(e);
        }}
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
                  ? 'bg-slate-700 text-whatsapp shadow-md' 
                  : 'bg-black/30 hover:bg-[#202c33] text-slate-400 hover:text-slate-200'
              }`}
              title="React"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Message Bubble Box */}
        <div
          className={`relative max-w-[85%] md:max-w-[65%] rounded-lg px-2.5 pt-1.5 pb-1.5 shadow-sm text-xs leading-relaxed transition-all ${
            isOutbound
              ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none wa-bubble-out'
              : 'bg-[#202c33] text-[#e9edef] rounded-tl-none wa-bubble-in'
          } ${message.pinned ? 'border border-amber-500/50 shadow-amber-500/10' : ''}`}
        >
          {/* Top-Right Hover Chevron (WhatsApp Web standard) */}
          <div className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleOpenMenu}
              className="w-5 h-5 rounded-full bg-black/40 hover:bg-black/70 text-slate-300 hover:text-white flex items-center justify-center shadow transition-all"
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
              <div className="bg-[#202c33] border border-slate-700 rounded-full px-2 py-1 shadow-2xl flex items-center gap-1 backdrop-blur-md">
                {(showFullPicker ? EXTENDED_EMOJIS : QUICK_EMOJIS).map((emoji) => {
                  const isActive = message.reactions?.[0] === emoji;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleToggleReaction(emoji)}
                      className={`w-7 h-7 flex items-center justify-center text-sm hover:scale-125 transition-transform rounded-full ${
                        isActive 
                          ? 'bg-emerald-950/80 ring-1 ring-emerald-500 scale-110 shadow-sm' 
                          : 'hover:bg-slate-700/70'
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
                  className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white rounded-full hover:bg-slate-700/60 transition-all"
                  title="More reactions"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Quoted Reply Preview (if replyTo exists) */}
          {message.replyTo && (
            <div className="mb-1.5 p-2 rounded-lg bg-black/25 border-l-4 border-whatsapp text-slate-200 text-[11px]">
              <span className="font-bold text-teal-300 block text-[10px]">
                {message.replyTo.senderName}
              </span>
              <p className="line-clamp-1 italic text-slate-300">
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
                ) : (message.media.type === 'audio' || mediaUrl.match(/\.(ogg|mp3|wav|m4a|aac)($|\?)/i)) ? (
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
              <div className="text-[13.5px] leading-[19px] text-[#e9edef] break-words select-text">
                <span className="whitespace-pre-wrap">{renderFormattedText(message.content)}</span>
                
                {/* Inline float-right timestamp container */}
                <span className="inline-flex items-center gap-1 float-right ml-2.5 mt-1 -mb-0.5 select-none align-bottom text-[11px] text-[#8696a0] font-normal">
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
                      <span title="Delivery failed. Please check Meta API Token or WhatsApp connection."><AlertCircle className="w-3.5 h-3.5 text-rose-400" /></span>
                    ) : message.status === 'read' ? (
                      <span title="Read"><CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" /></span>
                    ) : message.status === 'delivered' ? (
                      <span title="Delivered"><CheckCheck className="w-3.5 h-3.5 text-[#8696a0]" /></span>
                    ) : (
                      <span title="Sent"><Check className="w-3.5 h-3.5 text-[#8696a0]" /></span>
                    )
                  )}
                </span>
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
                  ? 'bg-slate-700 text-whatsapp shadow-md' 
                  : 'bg-black/30 hover:bg-[#202c33] text-slate-400 hover:text-slate-200'
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
              className="bg-[#1f2c34] hover:bg-[#2a3942] border border-slate-700/80 px-1.5 py-0.5 rounded-full shadow-lg flex items-center justify-center cursor-pointer text-xs backdrop-blur-md hover:scale-115 transition-all select-none"
              title="Click to remove reaction"
            >
              <span>{message.reactions[0]}</span>
            </div>
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
          className="z-[100] w-52 bg-[#233138] border border-slate-700/90 rounded-2xl shadow-2xl py-1.5 text-slate-200 text-xs animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md select-none custom-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Message info */}
          <button
            onClick={() => {
              setInfoModalOpen(true);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors"
          >
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Message info</span>
          </button>

          {/* 2. Reply */}
          <button
            onClick={handleReply}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors"
          >
            <CornerUpLeft className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Reply</span>
          </button>

          {/* 3. Copy */}
          <button
            onClick={handleCopy}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors"
          >
            <Copy className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Copy</span>
          </button>

          {/* 4. Edit (WhatsApp Web: Available for outbound text messages) */}
          {isOutbound && !message.media && (
            <button
              onClick={() => {
                setIsEditing(true);
                setEditContent(message.content || '');
                setMenuOpen(false);
              }}
              className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors text-emerald-400 font-medium"
            >
              <Pencil className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Edit</span>
            </button>
          )}

          {/* 5. React */}
          <button
            onClick={() => {
              if (bubbleRef.current) {
                const rect = bubbleRef.current.getBoundingClientRect();
                setReactionPosAbove(rect.top >= 110);
              }
              setShowReactionPicker(true);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors"
          >
            <Smile className="w-4 h-4 text-slate-400 shrink-0" />
            <span>React</span>
          </button>

          {/* 6. Forward */}
          <button
            onClick={() => {
              setForwardModalOpen(true);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors"
          >
            <Forward className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Forward</span>
          </button>

          {/* 7. Pin / Unpin */}
          <button
            onClick={() => {
              pinMessage(message.id);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors"
          >
            <Pin className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{message.pinned ? 'Unpin' : 'Pin'}</span>
          </button>

          {/* 8. Ask Meta AI */}
          <button
            onClick={() => {
              setMetaAiModalOpen(true);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors text-teal-300 font-medium"
          >
            <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
            <span>Ask Meta AI</span>
          </button>

          {/* 9. Star / Unstar */}
          <button
            onClick={() => {
              starMessage(message.id);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors"
          >
            <Star className={`w-4 h-4 shrink-0 ${message.starred ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
            <span>{message.starred ? 'Unstar' : 'Star'}</span>
          </button>

          {/* 10. Report (Inbound messages) */}
          {!isOutbound && (
            <button
              onClick={() => {
                reportMessage(message.id);
                setMenuOpen(false);
              }}
              className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors text-amber-300"
            >
              <Flag className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Report</span>
            </button>
          )}

          <div className="h-px bg-slate-700/60 my-1" />

          {/* 11. Delete */}
          <button
            onClick={() => {
              deleteMessage(message.id);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-red-950/40 text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
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
