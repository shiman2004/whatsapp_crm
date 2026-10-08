import React, { useState, useRef, useEffect } from 'react';
import { 
  Check, 
  CheckCheck, 
  File, 
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
  AlertCircle
} from 'lucide-react';
import { Message, Lead } from '../../types';
import { useCrm } from '../../context/CrmContext';
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
    deleteMessage 
  } = useCrm();

  const [menuOpen, setMenuOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [metaAiModalOpen, setMetaAiModalOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const bubbleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOutbound = message.direction === 'outbound';

  const handleOpenMenu = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      // If bubble is close to bottom (< 350px), pop menu upward!
      if (windowHeight - rect.bottom < 350) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
    setMenuOpen(prev => !prev);
  };

  // Close context menu & emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setShowReactionPicker(false);
        setShowFullPicker(false);
      }
    };
    if (menuOpen || showReactionPicker || showFullPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen, showReactionPicker, showFullPicker]);

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
          handleOpenMenu();
        }}
      >
        {/* Outbound Hover Emoji Trigger (Appears to the LEFT of outbound bubble) */}
        {isOutbound && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
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
                openUpward ? 'bottom-full mb-2' : '-top-10'
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
                      className={`w-7 h-7 flex items-center justify-center text-sm hover:scale-130 transition-transform rounded-full ${
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
          {/* Rich Media Attachment (Image, Video, Audio, Document) */}
          {message.media && (
            <div className="mb-1 rounded-lg overflow-hidden">
              {message.media.type === 'image' || message.media.url.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) ? (
                <div 
                  className="relative group/media cursor-pointer rounded-lg overflow-hidden bg-black/20"
                  onClick={() => setLightboxUrl(message.media?.url || null)}
                >
                  <img 
                    src={message.media.url} 
                    alt={message.media.fileName || 'Photo'} 
                    className="w-full max-h-80 object-cover rounded-lg hover:brightness-95 transition-all"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
                    <Maximize2 className="w-6 h-6 text-white drop-shadow-lg" />
                  </div>
                </div>
              ) : message.media.type === 'video' || message.media.url.match(/\.(mp4|webm|mov)($|\?)/i) ? (
                <div className="relative rounded-lg overflow-hidden bg-black/40">
                  <video 
                    src={message.media.url} 
                    controls 
                    playsInline 
                    className="w-full max-h-80 rounded-lg"
                  />
                </div>
              ) : (message.media.type === 'audio' || message.media.url.match(/\.(ogg|mp3|wav|m4a|aac)($|\?)/i)) ? (
                <WhatsAppVoiceNotePlayer 
                  message={message}
                  senderName={isOutbound ? currentUser.fullName : (lead?.customer?.displayName || 'Customer')}
                  senderAvatar={isOutbound ? currentUser.avatar : lead?.customer?.avatarUrl}
                  isOutbound={isOutbound}
                />
              ) : (
                <a 
                  href={message.media.url} 
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
          )}

          {/* Message Content & Inline Timestamp (WhatsApp Web 1:1 format) - Suppress if standalone voice note */}
          {(!message.media || message.media.type !== 'audio' || (message.content && message.content !== 'Voice note' && message.content.trim().length > 0)) && (
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
          )}

          {/* Dropdown Menu (WhatsApp Web Style with Upward/Downward Float) */}
          {menuOpen && (
            <div 
              ref={menuRef}
              className={`absolute ${
                openUpward ? 'bottom-full mb-1.5' : 'top-8 mt-1'
              } ${
                isOutbound ? 'right-0' : 'left-0'
              } z-50 w-48 bg-[#233138] border border-slate-700/90 rounded-2xl shadow-2xl py-1.5 text-slate-200 text-xs animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md`}
            >
              <button
                onClick={() => {
                  setInfoModalOpen(true);
                  setMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors"
              >
                <Info className="w-4 h-4 text-slate-400" />
                <span>Message info</span>
              </button>

              <button
                onClick={handleReply}
                className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors"
              >
                <CornerUpLeft className="w-4 h-4 text-slate-400" />
                <span>Reply</span>
              </button>

              <button
                onClick={handleCopy}
                className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors"
              >
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Copy</span>
              </button>

              <button
                onClick={() => {
                  setShowReactionPicker(true);
                  setMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors"
              >
                <Smile className="w-4 h-4 text-slate-400" />
                <span>React</span>
              </button>

              <button
                onClick={() => {
                  setForwardModalOpen(true);
                  setMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors"
              >
                <Forward className="w-4 h-4 text-slate-400" />
                <span>Forward</span>
              </button>

              <button
                onClick={() => {
                  pinMessage(message.id);
                  setMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors"
              >
                <Pin className="w-4 h-4 text-slate-400" />
                <span>{message.pinned ? 'Unpin' : 'Pin'}</span>
              </button>

              <button
                onClick={() => {
                  setMetaAiModalOpen(true);
                  setMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors text-teal-300 font-medium"
              >
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span>Ask Meta AI</span>
              </button>

              <button
                onClick={() => {
                  starMessage(message.id);
                  setMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[#182229] transition-colors"
              >
                <Star className={`w-4 h-4 ${message.starred ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
                <span>{message.starred ? 'Unstar' : 'Star'}</span>
              </button>

              <div className="h-px bg-slate-700/60 my-1" />

              <button
                onClick={() => {
                  deleteMessage(message.id);
                  setMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-red-950/40 text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>

        {/* Inbound Hover Emoji Trigger (Appears to the RIGHT of inbound bubble) */}
        {!isOutbound && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
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
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
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

