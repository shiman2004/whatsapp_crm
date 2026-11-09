import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Lead, Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { WhatsAppAvatar } from './WhatsAppAvatar';
import { useCrm } from '../../context/CrmContext';
import { 
  Shield, 
  Video, 
  Phone, 
  Search, 
  MoreVertical, 
  SlidersHorizontal,
  Lock,
  ChevronDown,
  ArrowLeft,
  AlertCircle,
  XCircle,
  User,
  UserPlus,
  CheckSquare,
  BellOff,
  Trash2,
  Trash,
  Heart,
  ListPlus,
  Link,
  PhoneCall,
  Flag,
  Ban,
  Download,
  FileDown
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { formatWhatsAppDisplay } from '../../utils/phoneUtils';
import { CompanyTagBadge } from '../common/CompanyTagBadge';
import { getDayKey, formatChatDateDivider } from '../../utils/dateUtils';
import { 
  getWindowStatus, 
  formatWindowCountdown, 
  getLatestCustomerMessageTime 
} from '../../utils/window24hUtils';

interface WhatsAppChatThreadProps {
  lead: Lead;
  crmPanelOpen: boolean;
  setCrmPanelOpen: (open: boolean) => void;
  onBack?: () => void;
}

export const WhatsAppChatThread: React.FC<WhatsAppChatThreadProps> = ({ 
  lead, 
  crmPanelOpen, 
  setCrmPanelOpen,
  onBack
}) => {
  const { messages, deleteChat, clearChat, setSelectedLeadId, loadOlderMessages, hasOlderMessages } = useCrm();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);
  // True while an older-history page is being prepended, so the arrival effect below
  // does not mistake that growth for an incoming message.
  const prependingHistoryRef = useRef(false);
  const lastScrollTopRef = useRef<number>(0);
  const isAutoScrollingRef = useRef<boolean>(false);
  const isInitialScrollDoneRef = useRef<boolean>(false);
  const leadHistoryExhaustedRef = useRef<Record<string, boolean>>({});
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const prevLeadIdRef = useRef(lead.id);
  const prevMsgLengthRef = useRef(0);
  const threadMenuRef = useRef<HTMLDivElement>(null);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [searchInChat, setSearchInChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Background Wallpaper Right-Click Menu State
  const [bgMenuOpen, setBgMenuOpen] = useState(false);
  const [bgMenuPos, setBgMenuPos] = useState<{ top: number; left: number } | null>(null);
  const bgMenuRef = useRef<HTMLDivElement>(null);

  // Close 3-dots thread menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (threadMenuRef.current && !threadMenuRef.current.contains(e.target as Node)) {
        setThreadMenuOpen(false);
      }
    };
    if (threadMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [threadMenuOpen]);

  // Close background context menu on outside click or Escape
  useEffect(() => {
    if (!bgMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (bgMenuRef.current && !bgMenuRef.current.contains(e.target as Node)) {
        setBgMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBgMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [bgMenuOpen]);

  // Handle right-click on the "black area" (chat wallpaper background)
  const handleBackgroundContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't trigger background menu if right-clicking a message bubble, button, input, or link
    if (
      target.closest('.wa-bubble-out') || 
      target.closest('.wa-bubble-in') || 
      target.closest('button') || 
      target.closest('input') || 
      target.closest('textarea') ||
      target.closest('a')
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 224;
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

    setBgMenuPos({ top, left });
    setBgMenuOpen(true);
  };

  // Close chat handler (exact behavior of WhatsApp Web 'Close chat')
  const handleCloseChat = () => {
    setThreadMenuOpen(false);
    setBgMenuOpen(false);
    if (onBack) {
      onBack();
    }
    setSelectedLeadId(null);
  };

  // Memoize lead messages so re-renders (e.g. 1-second 24h window tick) do not recreate array reference
  const leadMessages = useMemo(() => {
    const matched = messages.filter(m => {
      if (m.leadId) {
        return m.leadId === lead.id;
      }
      return (
        (lead.customerId && m.customerId === lead.customerId) ||
        (lead.customer?.whatsappNumber && ((m as any).to === lead.customer.whatsappNumber || (m as any).from === lead.customer.whatsappNumber)) ||
        (lead.customer?.whatsappId && (m as any).whatsappId === lead.customer.whatsappId)
      );
    });
    let raw: Message[] = [];
    if (matched.length > 0) {
      raw = matched;
    } else if (Array.isArray((lead as any).messages) && (lead as any).messages.length > 0) {
      raw = (lead as any).messages.map((m: any) => ({
        id: m.id,
        leadId: m.leadId || lead.id,
        customerId: m.customerId || lead.customerId || '',
        direction: m.direction || 'outbound',
        senderType: m.senderType || (m.direction === 'outbound' ? 'coordinator' : 'customer'),
        senderId: m.senderId,
        senderName: m.senderName,
        senderRole: m.senderRole,
        messageSource: m.messageSource,
        sentAt: m.sentAt,
        content: m.content || '',
        status: m.status || 'delivered',
        createdAt: m.createdAt || m.timestamp || new Date().toISOString(),
        media: (m.media?.url || m.mediaUrl || m.media) ? {
          ...(m.media || {}),
          type: m.media?.type || m.mediaType || 'image',
          url: m.media?.url || m.mediaUrl || null,
          caption: m.media?.caption || m.mediaCaption || undefined,
          fileName: m.media?.fileName || m.mediaFileName || undefined,
          mimeType: m.media?.mimeType || m.mediaMimeType || undefined,
          sizeBytes: m.media?.sizeBytes ?? m.mediaSizeBytes ?? null,
          status: m.media?.status || m.mediaStatus
        } : m.media,
        reactions: m.reaction ? [m.reaction] : (m.reactions || []),
        starred: m.starred || false,
        pinned: m.pinned || false,
        replyTo: m.replyToId ? { id: m.replyToId, content: m.replyToContent || '', senderName: m.replyToSender || '' } : m.replyTo,
        waMessageId: m.id
      })) as Message[];
    }

    // Deduplicate and sort messages chronologically (oldest at top, newest at bottom)
    const seenMsgKeys = new Set<string>();
    return raw
      .filter(m => {
        // Filter out empty messages
        if ((!m.content || m.content.trim().length === 0) && !m.media) return false;
        const timeBucket = Math.floor(new Date(m.createdAt).getTime() / 2000);
        const key = m.waMessageId || m.id || `${m.direction}-${m.content}-${timeBucket}`;
        if (seenMsgKeys.has(key)) return false;
        seenMsgKeys.add(key);
        return true;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, lead.id, lead.customerId, lead.customer?.whatsappNumber, lead.customer?.whatsappId, (lead as any).messages]);

  const displayName = lead.customer?.displayName || 'WhatsApp Contact';
  const rawPhone = lead.customer?.whatsappNumber || '';
  const displayPhone = lead.customer?.phoneNumber || formatWhatsAppDisplay(rawPhone);

  const inboundMessages = leadMessages.filter(m => m.direction === 'inbound');
  const latestInboundMsg = inboundMessages.length > 0
    ? inboundMessages.reduce((latest, m) => new Date(m.createdAt).getTime() > new Date(latest.createdAt).getTime() ? m : latest)
    : null;

  // Realtime WhatsApp 24-Hour window ticking every 1 second automatically
  const [windowNow, setWindowNow] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setWindowNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Export full chat conversation as a clean text file (.txt)
  const handleExportChat = () => {
    setThreadMenuOpen(false);
    setBgMenuOpen(false);

    if (!leadMessages || leadMessages.length === 0) {
      alert('No messages to export for this chat.');
      return;
    }

    const contactName = lead.customer?.displayName || lead.customer?.whatsappNumber || 'Customer';
    const safeContactName = contactName.replace(/[/\\?%*:|"<>]/g, '-').trim();
    const chatDate = new Date().toISOString().slice(0, 10);
    const fileName = `WhatsApp Chat - ${safeContactName} - ${chatDate}.txt`;

    let transcript = `=====================================================\n`;
    transcript += ` WHATSAPP CHAT EXPORT\n`;
    transcript += ` Contact: ${contactName}\n`;
    transcript += ` Phone: ${lead.customer?.whatsappNumber || lead.customer?.phoneNumber || 'N/A'}\n`;
    transcript += ` Brand: ${lead.companyTag || lead.company || 'Royal Wellness Center'}\n`;
    transcript += ` Exported: ${new Date().toLocaleString()}\n`;
    transcript += ` Total Messages: ${leadMessages.length}\n`;
    transcript += `=====================================================\n\n`;

    leadMessages.forEach((msg) => {
      const dt = msg.createdAt ? new Date(msg.createdAt) : new Date();
      const timeStr = dt.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      const sender = msg.direction === 'outbound'
        ? (msg.senderName || 'Staff (CRM)')
        : (lead.customer?.displayName || lead.customer?.whatsappNumber || 'Client');

      let body = msg.content || '';
      if (msg.media) {
        const mediaType = (msg.media.type || 'file').toUpperCase();
        const mediaName = msg.media.fileName || `${mediaType.toLowerCase()}_media`;
        const mediaUrl = msg.media.url || (msg.media.id ? `${API_BASE_URL}/api/media/${msg.media.id}` : '');
        const mediaAnnotation = `[Attachment: ${mediaType} - ${mediaName}${mediaUrl ? ` (${mediaUrl})` : ''}]`;
        body = body ? `${body}\n${mediaAnnotation}` : mediaAnnotation;
      }

      transcript += `[${timeStr}] ${sender}: ${body}\n\n`;
    });

    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download all media in this chat (photos, voice notes, documents, videos)
  const handleDownloadAllMedia = () => {
    setThreadMenuOpen(false);
    setBgMenuOpen(false);

    const mediaList = leadMessages.filter(m => m.media && (m.media.url || m.media.id));
    if (mediaList.length === 0) {
      alert('No media files (photos, voice notes, documents) found in this chat.');
      return;
    }

    const token = localStorage.getItem('token') || '';

    mediaList.forEach((m, idx) => {
      setTimeout(async () => {
        let mediaUrl = m.media?.id
          ? `${API_BASE_URL}/api/media/${m.media.id}`
          : (m.media?.url || '');

        if (!mediaUrl) return;

        if (mediaUrl.startsWith('/') && !mediaUrl.startsWith('//')) {
          mediaUrl = `${API_BASE_URL}${mediaUrl}`;
        }
        if (mediaUrl.includes('/api/media/') && !mediaUrl.includes('token=') && token) {
          mediaUrl = `${mediaUrl}${mediaUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
        }
        const downloadUrl = `${mediaUrl}${mediaUrl.includes('?') ? '&' : '?'}download=1`;
        const fileName = m.media?.fileName || `whatsapp_${m.media?.type || 'media'}_${m.id || idx}`;

        try {
          const res = await fetch(downloadUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          if (res.ok) {
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            return;
          }
        } catch (err) {
          // fallback
        }

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, idx * 400);
    });
  };

  // The 24h customer window strictly opens ONLY when an inbound message from the customer exists (staff replies never reset this)
  const lastCustomerMessageTime = getLatestCustomerMessageTime(lead, leadMessages);
  const hasCustomerMessage = lastCustomerMessageTime > 0;
  const windowExpiresAt = hasCustomerMessage ? lastCustomerMessageTime + (24 * 60 * 60 * 1000) : 0;
  const windowRemainingMs = windowExpiresAt > 0 ? Math.max(0, windowExpiresAt - windowNow) : 0;
  const windowStatusInfo = getWindowStatus(windowRemainingMs, hasCustomerMessage);
  const windowCountdownText = formatWindowCountdown(windowRemainingMs);
  const is24hWindowOpen = windowRemainingMs > 0;

  const filteredMessages = searchQuery.trim()
    ? leadMessages.filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : leadMessages;

  // Unread messages divider index matching WhatsApp Web (Screenshot 1)
  const unreadThresholdIndex = (() => {
    if (!lead.unreadCount || lead.unreadCount <= 0) return -1;
    let count = lead.unreadCount;
    for (let i = filteredMessages.length - 1; i >= 0; i--) {
      if (filteredMessages[i].direction === 'inbound') {
        count--;
        if (count === 0) return i;
      }
    }
    return -1;
  })();

  // Scroll to bottom helper with lock protection to prevent concurrent top-snapping
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) {
      messagesEndRef.current?.scrollIntoView({ behavior });
      return;
    }
    isAutoScrollingRef.current = true;
    container.scrollTo({
      top: container.scrollHeight,
      behavior
    });
    isAtBottomRef.current = true;
    setShowScrollBottomBtn(false);

    // Release auto-scrolling flag after scroll transition completes
    setTimeout(() => {
      isAutoScrollingRef.current = false;
      if (messagesContainerRef.current) {
        lastScrollTopRef.current = messagesContainerRef.current.scrollTop;
      }
    }, behavior === 'smooth' ? 350 : 50);
  };

  // Handle user scroll detection
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;

    // Detect direction of scroll
    const prevScrollTop = lastScrollTopRef.current;
    const isScrollingUp = scrollTop < prevScrollTop;
    lastScrollTopRef.current = scrollTop;

    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // Consider user at bottom if within 100px from the bottom
    const nearBottom = distanceFromBottom < 100;
    isAtBottomRef.current = nearBottom;
    setShowScrollBottomBtn(distanceFromBottom > 160);

    // CRITICAL: NEVER trigger loadOlderHistory when:
    // 1) An auto-scroll operation is running
    // 2) Initial scroll to bottom hasn't completed
    // 3) The user is scrolling DOWN (or not scrolling up)
    // 4) History for this lead has already been exhausted
    // 5) The content doesn't even overflow the container
    if (
      isAutoScrollingRef.current ||
      !isInitialScrollDoneRef.current ||
      !isScrollingUp ||
      scrollHeight <= clientHeight + 40 ||
      leadHistoryExhaustedRef.current[lead.id]
    ) {
      return;
    }

    // Only load older history when user deliberately scrolls UP to the very top (scrollTop < 30)
    if (scrollTop < 30) {
      void loadOlderHistory();
    }
  };

  // Loads older history while holding the scroll position steady, so the view
  // does not jump when the new page is prepended.
  const loadOlderHistory = async () => {
    const container = messagesContainerRef.current;
    if (
      !container || 
      loadingOlderRef.current || 
      !hasOlderMessages || 
      leadHistoryExhaustedRef.current[lead.id] || 
      isAutoScrollingRef.current
    ) {
      return;
    }

    loadingOlderRef.current = true;
    prependingHistoryRef.current = true;
    const previousHeight = container.scrollHeight;
    const previousTop = container.scrollTop;

    const clearPrependFlag = () => {
      requestAnimationFrame(() => {
        prependingHistoryRef.current = false;
        loadingOlderRef.current = false;
      });
    };

    try {
      const more = await loadOlderMessages();

      // Give React an animation frame to commit prepended messages
      requestAnimationFrame(() => {
        if (!messagesContainerRef.current) {
          clearPrependFlag();
          return;
        }

        const newHeight = messagesContainerRef.current.scrollHeight;
        const heightDelta = newHeight - previousHeight;

        // If new messages were prepended to this lead's thread, compensate scroll position.
        // If NO new messages were added to this lead (heightDelta === 0), DO NOT touch scrollTop!
        if (heightDelta > 0) {
          messagesContainerRef.current.scrollTop = previousTop + heightDelta;
          lastScrollTopRef.current = messagesContainerRef.current.scrollTop;
        } else {
          // If the global database returned no more or no messages for this lead
          if (!more) {
            leadHistoryExhaustedRef.current[lead.id] = true;
          }
        }
        clearPrependFlag();
      });
    } catch (e) {
      clearPrependFlag();
      console.warn('Failed to load older history:', e);
    }
  };

  // 1. Initial mount & lead switch: reliably position chat at the bottom
  useEffect(() => {
    isInitialScrollDoneRef.current = false;
    isAtBottomRef.current = true;
    setShowScrollBottomBtn(false);

    const performInitialScroll = () => {
      const container = messagesContainerRef.current;
      if (!container) return;
      isAutoScrollingRef.current = true;
      container.scrollTop = container.scrollHeight;
      lastScrollTopRef.current = container.scrollTop;
    };

    // Frame 1: Immediate scroll
    performInitialScroll();

    // Frame 2: Next animation frame after DOM paint
    const rafId = requestAnimationFrame(() => {
      performInitialScroll();
    });

    // Frame 3: 80ms timeout after fonts and bubble styles apply
    const timer1 = setTimeout(() => {
      performInitialScroll();
      isInitialScrollDoneRef.current = true;
      isAutoScrollingRef.current = false;
    }, 80);

    // Frame 4: 250ms fallback for images / media load
    const timer2 = setTimeout(() => {
      if (isAtBottomRef.current) {
        performInitialScroll();
      }
      isAutoScrollingRef.current = false;
    }, 250);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [lead.id]);

  // 2. New message arrival: Only scroll down if user is ALREADY near the bottom OR if user sent the message
  useEffect(() => {
    const isNewMessageAdded = leadMessages.length > prevMsgLengthRef.current;
    const lastMsg = leadMessages[leadMessages.length - 1];
    const isOwnOutbound = lastMsg && lastMsg.direction === 'outbound';

    prevMsgLengthRef.current = leadMessages.length;

    // If initial scroll is not yet done, scroll to bottom immediately
    if (!isInitialScrollDoneRef.current && leadMessages.length > 0) {
      scrollToBottom('auto');
      return;
    }

    if (isNewMessageAdded && !prependingHistoryRef.current && !isAutoScrollingRef.current) {
      if (isOwnOutbound || isAtBottomRef.current) {
        scrollToBottom('smooth');
      }
    }
  }, [leadMessages]);

  return (
    <div className="flex-1 flex flex-col bg-whatsapp-bg dark:bg-whatsapp-canvas relative min-w-0 h-full overflow-hidden">
      {/* 1. WhatsApp Top Chat Header (Exact 1:1 Match of Real WhatsApp Web) */}
      <div className="h-14 px-4 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#E0E5E7] dark:border-[#222D34] flex items-center justify-between gap-3 shrink-0 select-none z-10">
        {/* Left: Mobile Back Button + Contact Info */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onBack && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBack();
              }}
              className="md:hidden p-1.5 -ml-1 text-[#54656f] dark:text-[#aebac1] hover:text-[#111b21] dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#374248] rounded-full transition-colors shrink-0"
              title="Back to chat list"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div 
            onClick={() => setCrmPanelOpen(!crmPanelOpen)}
            className="flex items-center gap-2 sm:gap-3 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
            title="View Patient Details"
          >
            <WhatsAppAvatar
              name={displayName}
              avatarUrl={lead.customer?.avatarUrl}
              size="md"
              isOnline={true}
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-[#111b21] dark:text-[#e9edef] truncate leading-tight">
                  {displayName}
                </h3>
                <CompanyTagBadge lead={lead} size="sm" showFullName={true} />
              </div>
              <p className="text-[11px] text-[#667781] dark:text-[#8696a0] font-sans truncate flex items-center gap-1.5 mt-0.5">
                {displayPhone ? (
                  <>
                    <span className="font-mono text-[#00a884] font-medium">{displayPhone}</span>
                    <span className="text-slate-600 hidden sm:inline">•</span>
                    <span className="hidden sm:inline">WhatsApp Direct</span>
                    <span className="text-slate-600 hidden sm:inline">•</span>
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCrmPanelOpen(true);
                      }}
                      className={`hidden sm:inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded border font-medium cursor-pointer transition-opacity hover:opacity-90 ${windowStatusInfo.badgeBg} ${windowStatusInfo.badgeBorder} ${windowStatusInfo.textColor}`}
                      title={`WhatsApp 24-Hour Window: ${windowStatusInfo.label} (${windowCountdownText}) - Click to view in right panel`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${windowStatusInfo.dotColor}`} />
                      <span>{windowStatusInfo.label}</span>
                      {hasCustomerMessage && windowRemainingMs > 0 && (
                        <>
                          <span className="opacity-50">•</span>
                          <span className="font-mono font-bold tracking-tight">{windowCountdownText}</span>
                        </>
                      )}
                    </span>
                  </>
                ) : (
                  <span>online</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Right Action Icons: Search, Menu, CRM Toggle */}
        <div className="flex items-center gap-1.5 shrink-0 text-[#54656f] dark:text-[#aebac1]">
          {/* Search in chat */}
          <button 
            onClick={() => setSearchInChat(!searchInChat)}
            className={`w-9 h-9 rounded-full hover:bg-slate-200 dark:hover:bg-[#374248] flex items-center justify-center transition-colors cursor-pointer ${
              searchInChat ? 'text-[#008069] dark:text-[#00a884] bg-slate-200/80 dark:bg-[#374248]' : ''
            }`}
            title="Search in chat"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* 3 Dots Menu */}
          <div className="relative">
            <button 
              onClick={() => setThreadMenuOpen(!threadMenuOpen)}
              className="w-9 h-9 rounded-full hover:bg-slate-200 dark:hover:bg-[#374248] flex items-center justify-center transition-colors cursor-pointer"
              title="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {threadMenuOpen && (
              <div 
                ref={threadMenuRef}
                className="absolute right-0 top-10 w-56 max-h-[calc(100vh-80px)] overflow-y-auto bg-white dark:bg-[#233138] border border-slate-200 dark:border-[#2a3942] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs text-[#111b21] dark:text-[#d1d7db] custom-scrollbar"
              >
                <button 
                  onClick={() => {
                    setThreadMenuOpen(false);
                    setCrmPanelOpen(true);
                  }} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
                  <span>Add to contacts</span>
                </button>
                <button 
                  onClick={() => {
                    setThreadMenuOpen(false);
                    setCrmPanelOpen(true);
                  }} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <User className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
                  <span>Contact info</span>
                </button>
                <button 
                  onClick={() => {
                    setThreadMenuOpen(false);
                    setSearchInChat(true);
                  }} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <Search className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
                  <span>Search</span>
                </button>
                <button 
                  onClick={() => setThreadMenuOpen(false)} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
                  <span>Select messages</span>
                </button>
                <button 
                  onClick={() => setThreadMenuOpen(false)} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <BellOff className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
                    <span>Mute notifications</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 -rotate-90 text-[#54656f] dark:text-[#8696a0]" />
                </button>
                <button 
                  onClick={() => setThreadMenuOpen(false)} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <Heart className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
                  <span>Add to favourites</span>
                </button>
                <button 
                  onClick={() => {
                    setThreadMenuOpen(false);
                    setCrmPanelOpen(true);
                  }} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <ListPlus className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
                  <span>Add to list (Assign Labels)</span>
                </button>
                <button 
                  onClick={handleCloseChat} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 text-[#111b21] dark:text-[#e9edef] font-medium transition-colors cursor-pointer"
                >
                  <XCircle className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
                  <span>Close chat</span>
                </button>

                <div className="h-px bg-slate-200 dark:bg-[#2a3942] my-1" />

                {/* Download and Save Options */}
                <button 
                  onClick={handleExportChat} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 text-[#008069] dark:text-[#00a884] font-medium transition-colors cursor-pointer"
                  title="Export full chat transcript and save as a .txt file"
                >
                  <FileDown className="w-4 h-4 text-[#008069] dark:text-[#00a884]" />
                  <span>Export chat (Save file)</span>
                </button>
                <button 
                  onClick={handleDownloadAllMedia} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 text-[#008069] dark:text-[#00a884] font-medium transition-colors cursor-pointer"
                  title="Download all photos, voice notes, and documents in this chat"
                >
                  <Download className="w-4 h-4 text-[#008069] dark:text-[#00a884]" />
                  <span>Download chat media</span>
                </button>

                <div className="h-px bg-slate-200 dark:bg-[#2a3942] my-1" />

                <button 
                  onClick={() => setThreadMenuOpen(false)} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <Link className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
                  <span>Send call link</span>
                </button>
                <button 
                  onClick={() => setThreadMenuOpen(false)} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <PhoneCall className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
                  <span>New group call</span>
                </button>
                <button 
                  onClick={() => setThreadMenuOpen(false)} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <Flag className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
                  <span>Report</span>
                </button>
                <button 
                  onClick={() => setThreadMenuOpen(false)} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <Ban className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
                  <span>Block</span>
                </button>

                <div className="h-px bg-slate-200 dark:bg-[#2a3942] my-1" />

                <button 
                  onClick={() => {
                    clearChat(lead.id);
                    setThreadMenuOpen(false);
                  }} 
                  className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors text-[#111b21] dark:text-[#d1d7db] cursor-pointer"
                >
                  <Trash className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
                  <span>Clear chat</span>
                </button>
                <button 
                  onClick={() => {
                    deleteChat(lead.id);
                    setThreadMenuOpen(false);
                  }} 
                  className="w-full text-left px-4 py-2 hover:bg-rose-50 dark:hover:bg-[#182229] flex items-center gap-3 transition-colors text-rose-600 dark:text-rose-400 font-medium cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Delete chat</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-slate-300 dark:bg-slate-700/60 mx-1" />

          {/* CRM Panel Toggle */}
          <button
            onClick={() => setCrmPanelOpen(!crmPanelOpen)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border shrink-0 cursor-pointer ${
              crmPanelOpen
                ? 'bg-[#DCF8C6] dark:bg-[#00a884]/20 text-[#008069] dark:text-[#00a884] border-[#00a884]/40 shadow-xs'
                : 'bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#d1d7db] border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#2a3942]'
            }`}
            title="Toggle Clinical Lead CRM Profile"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{crmPanelOpen ? 'Hide CRM' : 'CRM Details'}</span>
          </button>
        </div>
      </div>

      {/* In-Chat Search Bar (When triggered) */}
      {searchInChat && (
        <div className="px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#e9edef] dark:border-[#222D34] flex items-center gap-2 text-xs">
          <Search className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-[#111b21] dark:text-[#d1d7db] placeholder-[#54656f] dark:placeholder-[#8696a0] outline-none"
            autoFocus
          />
          <button onClick={() => { setSearchInChat(false); setSearchQuery(''); }} className="text-[#54656f] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-white cursor-pointer font-medium">
            Cancel
          </button>
        </div>
      )}

      {/* 2. WhatsApp Message Stream with Doodle Pattern */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        onContextMenu={handleBackgroundContextMenu}
        className="flex-1 wa-chat-bg p-4 pb-6 overflow-y-auto space-y-3 relative select-none"
      >
        {/* End-to-End Encryption Notice (Exact WhatsApp Web style) */}
        <div className="max-w-md mx-auto my-2 text-[#54656f] dark:text-[#8696a0] text-center text-[11px] flex items-center justify-center gap-1.5 bg-[#ffeecd]/85 dark:bg-[#182229]/90 border border-amber-200/60 dark:border-slate-800 rounded-lg px-4 py-1.5 shadow-xs">
          <Lock className="w-3 h-3 text-[#00a884] shrink-0" />
          <span>Messages are end-to-end encrypted. No one outside of this chat can read or listen to them.</span>
        </div>

        {/* Older-history affordance: shows whether more pages exist above */}
        {leadMessages.length > 0 && (
          <div className="text-center text-[#667781] dark:text-[#8696a0] text-[11px] py-1">
            {hasOlderMessages && !leadHistoryExhaustedRef.current[lead.id]
              ? 'Scroll up to load earlier messages'
              : 'Beginning of conversation'}
          </div>
        )}

        {/* Message Bubbles with Dynamic WhatsApp Date Dividers ("Today", "Yesterday", etc.) */}
        {filteredMessages.length === 0 ? (
          <div className="text-center text-[#667781] dark:text-[#8696a0] text-xs py-8">
            <p>No messages in this chat yet</p>
          </div>
        ) : (
          filteredMessages.map((msg, index) => {
            const dayKey = getDayKey(msg.createdAt);
            const prevDayKey = index > 0 ? getDayKey(filteredMessages[index - 1].createdAt) : null;
            const isNewDay = dayKey !== 'invalid' && dayKey !== prevDayKey;
            const dateDividerLabel = isNewDay ? formatChatDateDivider(msg.createdAt) : null;
            const showUnreadDivider = unreadThresholdIndex === index;

            return (
              <React.Fragment key={msg.id || `${msg.createdAt}-${index}`}>
                {dateDividerLabel && (
                  <div className="flex justify-center my-3 select-none">
                    <span className="bg-white dark:bg-[#182229] border border-slate-200 dark:border-slate-800/80 text-[#54656f] dark:text-[#8696a0] text-[11px] font-medium px-3.5 py-1 rounded-lg wa-bubble-shadow">
                      {dateDividerLabel}
                    </span>
                  </div>
                )}
                {showUnreadDivider && (
                  <div className="flex justify-center my-3 select-none">
                    <span className="bg-white dark:bg-[#182229] border border-slate-200 dark:border-slate-800/80 text-[#54656f] dark:text-[#8696a0] text-[11px] font-medium px-3.5 py-1 rounded-lg wa-bubble-shadow">
                      {lead.unreadCount} unread message{(lead.unreadCount || 0) > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  lead={lead}
                />
              </React.Fragment>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* WhatsApp Web Scroll-to-bottom Floating Button */}
      {showScrollBottomBtn && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute right-6 bottom-20 z-30 w-10 h-10 rounded-full bg-white dark:bg-[#202c33] text-[#54656f] dark:text-[#aebac1] hover:text-[#111b21] dark:hover:text-white shadow-md hover:shadow-lg border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* WhatsApp Web Background Wallpaper Context Menu (Mouse Right-Click on Black Area) */}
      {bgMenuOpen && bgMenuPos && (
        <div
          ref={bgMenuRef}
          style={{
            position: 'fixed',
            top: `${bgMenuPos.top}px`,
            left: `${bgMenuPos.left}px`,
            maxHeight: 'calc(100vh - 76px)',
            overflowY: 'auto'
          }}
          className="z-[110] w-56 bg-white dark:bg-[#233138] border border-slate-200 dark:border-[#2a3942] rounded-2xl shadow-2xl py-1.5 text-xs text-[#111b21] dark:text-[#d1d7db] animate-in fade-in zoom-in-95 duration-100 select-none custom-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setBgMenuOpen(false);
              setCrmPanelOpen(true);
            }}
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
            <span>Add to contacts</span>
          </button>

          <button
            onClick={() => {
              setBgMenuOpen(false);
              setCrmPanelOpen(true);
            }}
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
          >
            <User className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
            <span>Contact info</span>
          </button>

          <button
            onClick={() => {
              setBgMenuOpen(false);
              setSearchInChat(true);
            }}
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
            <span>Search</span>
          </button>

          <button
            onClick={() => setBgMenuOpen(false)}
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
            <span>Select messages</span>
          </button>

          <button
            onClick={() => setBgMenuOpen(false)}
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <BellOff className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
              <span>Mute notifications</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 -rotate-90 text-[#54656f] dark:text-[#8696a0]" />
          </button>

          <button
            onClick={() => setBgMenuOpen(false)}
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
          >
            <Heart className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
            <span>Add to favourites</span>
          </button>

          <button
            onClick={() => {
              setBgMenuOpen(false);
              setCrmPanelOpen(true);
            }}
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
          >
            <ListPlus className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
            <span>Add to list (Assign Labels)</span>
          </button>

          <button
            onClick={handleCloseChat}
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 text-[#111b21] dark:text-[#e9edef] font-medium transition-colors cursor-pointer"
          >
            <XCircle className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
            <span>Close chat</span>
          </button>

          <div className="h-px bg-slate-200 dark:bg-[#2a3942] my-1" />

          {/* Download and Save Options */}
          <button 
            onClick={handleExportChat} 
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 text-[#008069] dark:text-[#00a884] font-medium transition-colors cursor-pointer"
            title="Export full chat transcript and save as a .txt file"
          >
            <FileDown className="w-4 h-4 text-[#008069] dark:text-[#00a884]" />
            <span>Export chat (Save file)</span>
          </button>
          <button 
            onClick={handleDownloadAllMedia} 
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 text-[#008069] dark:text-[#00a884] font-medium transition-colors cursor-pointer"
            title="Download all photos, voice notes, and documents in this chat"
          >
            <Download className="w-4 h-4 text-[#008069] dark:text-[#00a884]" />
            <span>Download chat media</span>
          </button>

          <div className="h-px bg-slate-200 dark:bg-[#2a3942] my-1" />

          <button
            onClick={() => setBgMenuOpen(false)}
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
          >
            <Link className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
            <span>Send call link</span>
          </button>

          <button
            onClick={() => setBgMenuOpen(false)}
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
          >
            <PhoneCall className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
            <span>New group call</span>
          </button>

          <button
            onClick={() => setBgMenuOpen(false)}
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
          >
            <Flag className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
            <span>Report</span>
          </button>

          <button
            onClick={() => setBgMenuOpen(false)}
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
          >
            <Ban className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
            <span>Block</span>
          </button>

          <div className="h-px bg-slate-200 dark:bg-[#2a3942] my-1" />

          <button
            onClick={() => {
              clearChat(lead.id);
              setBgMenuOpen(false);
            }}
            className="w-full text-left px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors text-[#111b21] dark:text-[#d1d7db] cursor-pointer"
          >
            <Trash className="w-4 h-4 text-[#54656f] dark:text-[#8696a0]" />
            <span>Clear chat</span>
          </button>

          <button
            onClick={() => {
              deleteChat(lead.id);
              setBgMenuOpen(false);
            }}
            className="w-full text-left px-4 py-2 hover:bg-rose-50 dark:hover:bg-[#182229] flex items-center gap-3 transition-colors text-rose-600 dark:text-rose-400 font-medium cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Delete chat</span>
          </button>
        </div>
      )}

      {/* 3. Bottom Composer */}
      <MessageComposer lead={lead} />
    </div>
  );
};
