import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Plus, 
  Smile, 
  Mic, 
  X,
  CornerUpLeft,
  Image,
  FileText,
  User,
  Sparkles,
  QrCode,
  AlertCircle,
  RefreshCw,
  Trash2,
  Check,
  Copy,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Clock
} from 'lucide-react';
import { Lead, WhatsAppTemplate } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { getLatestCustomerMessageTime } from '../../utils/window24hUtils';
import { WhatsAppVoiceRecorder } from '../../utils/audioRecorder';
import { AddContactModal } from './AddContactModal';
import { 
  TypingLanguage, 
  transliterateText, 
  transliterateActiveWord, 
  transliterateWordAtCursor 
} from '../../utils/phoneticConverter';

interface MessageComposerProps {
  lead: Lead;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '🎉', '💯', '✨', '💐', '🙌', '😍', '😊', '👌', '⭐', '🤝', '🩺', '💉'];

export const MessageComposer: React.FC<MessageComposerProps> = ({ lead }) => {
  const { 
    sendMessage, 
    sendWhatsAppTemplate, 
    messages,
    templates, 
    categories, 
    treatments,
    replyingMessage,
    setReplyingMessage,
    whatsappStatus,
    setQrModalOpen,
    hasMetaConfig
  } = useCrm();

  const [inputVal, setInputVal] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachMenuMode, setAttachMenuMode] = useState<'main' | 'location'>('main');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copiedTplId, setCopiedTplId] = useState<string | null>(null);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Tamil & Sinhala Phonetic Typing Converter State
  const [typingLang, setTypingLang] = useState<TypingLanguage>(() => {
    const stored = localStorage.getItem('rw_composer_typing_lang');
    if (stored === 'ta' || stored === 'si' || stored === 'en') return stored as TypingLanguage;
    if (lead.language === 'ta' || lead.language === 'si') return lead.language as TypingLanguage;
    return 'en';
  });

  const [activePreviewWord, setActivePreviewWord] = useState<{
    raw: string;
    converted: string;
    start: number;
    end: number;
  } | null>(null);

  const handleSelectLanguage = (lang: TypingLanguage) => {
    setTypingLang(lang);
    localStorage.setItem('rw_composer_typing_lang', lang);
    setActivePreviewWord(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleCommitPreview = () => {
    if (!activePreviewWord || !textareaRef.current) return;
    const text = inputVal;
    const newText = text.slice(0, activePreviewWord.start) + activePreviewWord.converted + ' ' + text.slice(activePreviewWord.end);
    setInputVal(newText);
    const newPos = activePreviewWord.start + activePreviewWord.converted.length + 1;
    setActivePreviewWord(null);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleConvertAllText = () => {
    if (!inputVal || typingLang === 'en') return;
    const converted = transliterateText(inputVal, typingLang);
    setInputVal(converted);
    setActivePreviewWord(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Audio Recorder Ref
  const voiceRecorderRef = useRef<WhatsAppVoiceRecorder | null>(null);

  // Media Attachment State & Preview
  const [mediaPreview, setMediaPreview] = useState<{
    file: File;
    previewUrl: string;
    type: 'image' | 'video' | 'document';
    fileName: string;
    caption: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const category = categories.find(c => c.id === lead.categoryId);
  const treatment = treatments.find(t => t.id === lead.treatmentId);

  // Focus input when replying to a message
  useEffect(() => {
    if (replyingMessage && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingMessage]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 38), 130)}px`;
    }
  }, [inputVal]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachRef.current && !attachRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
        setAttachMenuMode('main');
      }
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) {
        setShowTemplates(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Voice record timer
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Start real Audio Recording via AudioContext MP3 encoder
  const handleStartRecording = async () => {
    const isConnected = whatsappStatus === 'connected' || hasMetaConfig || Boolean(localStorage.getItem('meta_access_token'));
    if (!isConnected) {
      setQrModalOpen(true);
      return;
    }

    try {
      const recorder = new WhatsAppVoiceRecorder();
      await recorder.start();
      voiceRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
    } catch (err: any) {
      console.error('Microphone error:', err);
      alert('Microphone access was denied or is unavailable. Please allow microphone permissions in your browser.');
      setIsRecording(false);
    }
  };

  // Stop & Send Voice Note
  const handleStopAndSendRecording = async () => {
    const recorder = voiceRecorderRef.current;
    if (!recorder) {
      setIsRecording(false);
      return;
    }

    try {
      const result = await recorder.stop();
      if (result && result.dataUrl) {
        const ext = result.extension || (result.mimeType?.includes('ogg') ? 'ogg' : result.mimeType?.includes('mp4') ? 'mp4' : 'webm');
        sendMessage(
          lead.id,
          '',
          'coordinator',
          {
            type: 'audio',
            url: result.dataUrl,
            dataUrl: result.dataUrl,
            fileName: `voice_note_${Date.now()}.${ext}`,
            mimeType: result.mimeType,
            caption: ''
          }
        );
      }
    } catch (err) {
      console.error('Error stopping recorder:', err);
    } finally {
      voiceRecorderRef.current = null;
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  };

  // Cancel / Discard Voice Note
  const handleCancelRecording = () => {
    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.cancel();
      voiceRecorderRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Handle File Selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, fallbackType?: 'image' | 'video' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    let type: 'image' | 'video' | 'document' = fallbackType || 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else type = 'document';

    const previewUrl = URL.createObjectURL(file);
    setMediaPreview({
      file,
      previewUrl,
      type,
      fileName: file.name,
      caption: ''
    });

    setShowAttachMenu(false);
    e.target.value = '';
  };

  // Submit and Send Media
  const handleSendMedia = () => {
    if (!mediaPreview) return;

    const { file, type, fileName, caption } = mediaPreview;
    const reader = new FileReader();

    reader.onload = () => {
      const base64Data = reader.result as string;
      sendMessage(
        lead.id,
        caption.trim(),
        'coordinator',
        {
          type,
          url: base64Data,
          dataUrl: base64Data,
          fileName,
          caption: caption.trim()
        }
      );
      URL.revokeObjectURL(mediaPreview.previewUrl);
      setMediaPreview(null);
    };

    reader.readAsDataURL(file);
  };

  // Helper to open media preview with a File or Blob
  const openMediaPreviewWithBlob = (blob: Blob, customName?: string) => {
    const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = customName || `screenshot_${timestamp}.${ext}`;
    const previewUrl = URL.createObjectURL(blob);

    setMediaPreview({
      file: blob as File,
      previewUrl,
      type: 'image',
      fileName,
      caption: inputVal.trim()
    });
    setInputVal('');
  };

  // Process clipboard files/items for screenshot/image pasting (Ctrl+V)
  const processClipboardData = (clipboardData: DataTransfer | null): boolean => {
    if (!clipboardData) return false;

    // 1. Try files first (files copied from Explorer or file manager)
    if (clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        const file = clipboardData.files[i];
        if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name)) {
          openMediaPreviewWithBlob(file, file.name);
          return true;
        }
      }
    }

    // 2. Try items (standard for browser screenshot pasting, e.g. Win+Shift+S or PrtScn)
    if (clipboardData.items && clipboardData.items.length > 0) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.type.indexOf('image') !== -1 || item.kind === 'file') {
          const blob = item.getAsFile();
          if (blob && (blob.type.startsWith('image/') || blob.size > 0)) {
            const name = blob instanceof File && blob.name && blob.name !== 'image.png' && blob.name !== 'blob' 
              ? blob.name 
              : undefined;
            openMediaPreviewWithBlob(blob, name);
            return true;
          }
        }
      }
    }

    return false;
  };

  // Global document paste listener in capture phase (guarantees catching paste anywhere in active chat)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // If user is typing in another text input (e.g. search box), don't intercept
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'INPUT' && target.getAttribute('type') !== 'file') {
        return;
      }
      if (mediaPreview) return;

      const handled = processClipboardData(e.clipboardData);
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      } else if (!handled && navigator.clipboard && typeof navigator.clipboard.read === 'function') {
        // Fallback for secure contexts where clipboardData is restricted
        navigator.clipboard.read().then(async (clipboardItems) => {
          for (const item of clipboardItems) {
            const imgType = item.types.find(t => t.startsWith('image/'));
            if (imgType) {
              const blob = await item.getType(imgType);
              if (blob) {
                openMediaPreviewWithBlob(blob);
                break;
              }
            }
          }
        }).catch(() => {});
      }
    };

    // Use capture phase so event is caught before any bubbling element can stop it
    document.addEventListener('paste', handleGlobalPaste, true);
    return () => document.removeEventListener('paste', handleGlobalPaste, true);
  }, [inputVal, mediaPreview]);

  // Escape key cancels media preview modal
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mediaPreview) {
        URL.revokeObjectURL(mediaPreview.previewUrl);
        setMediaPreview(null);
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [mediaPreview]);

  const leadMessages = messages.filter(m => m.leadId === lead.id || (lead.customerId && m.customerId === lead.customerId));
  const lastCustomerMessageTime = getLatestCustomerMessageTime(lead, leadMessages);
  const is24hWindowOpen = lastCustomerMessageTime > 0 && (Date.now() - lastCustomerMessageTime) < (24 * 60 * 60 * 1000);

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let finalMsg = inputVal.trim();
    if (!finalMsg) return;

    // Transliterate any remaining uncommitted English words if in Tamil or Sinhala mode
    if (typingLang !== 'en') {
      finalMsg = transliterateText(finalMsg, typingLang).trim();
    }

    sendMessage(lead.id, finalMsg, 'coordinator');
    setInputVal('');
    setActivePreviewWord(null);
    setShowEmojiPicker(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = '38px';
    }
  };

  const handleSendLocation = (locationName: string, mapUrl: string) => {
    setShowAttachMenu(false);
    setAttachMenuMode('main');
    sendMessage(lead.id, `${locationName} - ${mapUrl}`, 'coordinator');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (typingLang !== 'en') {
      // Tab accepts active candidate preview
      if (e.key === 'Tab' && activePreviewWord) {
        e.preventDefault();
        handleCommitPreview();
        return;
      }

      // Escape cancels candidate preview
      if (e.key === 'Escape' && activePreviewWord) {
        e.preventDefault();
        setActivePreviewWord(null);
        return;
      }

      // Space or punctuation commits the preceding word phonetically
      if (e.key === ' ' || e.key === '.' || e.key === ',' || e.key === '?' || e.key === '!' || e.key === ':' || e.key === ';') {
        const textarea = textareaRef.current;
        if (textarea) {
          const cursorPos = textarea.selectionStart;
          const { newText, newCursorPos, convertedWord } = transliterateWordAtCursor(inputVal, cursorPos, typingLang);
          if (convertedWord) {
            e.preventDefault();
            const charToInsert = e.key;
            const textWithChar = newText.slice(0, newCursorPos) + charToInsert + newText.slice(newCursorPos);
            setInputVal(textWithChar);
            setActivePreviewWord(null);
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.selectionStart = newCursorPos + 1;
                textareaRef.current.selectionEnd = newCursorPos + 1;
              }
            }, 0);
            return;
          }
        }
      }
    }

    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift + Enter: inserts a new line in the text box
        return;
      }
      // Enter alone: sends the message immediately
      e.preventDefault();
      handleSendText();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;

    if (typingLang !== 'en') {
      const textBefore = val.slice(0, cursorPos);

      // Support mobile virtual keyboards: if a space or punctuation was just typed after Latin letters
      const mobileBoundaryMatch = textBefore.match(/([a-zA-Z]+)([ \t\n.,?!:;])$/);
      if (mobileBoundaryMatch) {
        const rawWord = mobileBoundaryMatch[1];
        const delimiter = mobileBoundaryMatch[2];
        const converted = transliterateActiveWord(rawWord, typingLang);
        if (converted && converted !== rawWord) {
          const wordStart = textBefore.length - rawWord.length - delimiter.length;
          const newText = textBefore.slice(0, wordStart) + converted + delimiter + val.slice(cursorPos);
          const newPos = wordStart + converted.length + delimiter.length;
          setInputVal(newText);
          setActivePreviewWord(null);
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = newPos;
              textareaRef.current.selectionEnd = newPos;
            }
          }, 0);
          return;
        }
      }

      // Check current in-progress word for real-time candidate preview
      const activeMatch = textBefore.match(/([a-zA-Z]+)$/);
      if (activeMatch) {
        const raw = activeMatch[1];
        const converted = transliterateActiveWord(raw, typingLang);
        if (converted && converted !== raw) {
          setActivePreviewWord({
            raw,
            converted,
            start: textBefore.length - raw.length,
            end: cursorPos
          });
          setInputVal(val);
          return;
        }
      }
    }

    setActivePreviewWord(null);
    setInputVal(val);
  };

  const handleSendTemplate = (tpl: WhatsAppTemplate) => {
    const isCras = lead.source?.toUpperCase() === 'CRAS' || lead.company === 'CRAS' || tpl.waTemplateName.startsWith('cras_');
    const custName = lead.customer?.displayName || (isCras ? 'Dr. Perera' : 'Valued Client');
    const trtName = treatment?.name || category?.name || 'Treatment';
    
    sendWhatsAppTemplate(lead.id, tpl.waTemplateName || tpl.name || tpl.id, [custName, trtName]);
    setShowTemplates(false);
    setShowAttachMenu(false);
  };

  const handleInsertEmoji = (emoji: string) => {
    if (mediaPreview) {
      setMediaPreview(prev => prev ? { ...prev, caption: prev.caption + emoji } : null);
    } else {
      setInputVal(prev => prev + emoji);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const approvedTemplates = templates.filter(t => t.approved && (t.language === lead.language || t.language === 'en'));

  return (
    <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-2 sm:px-4 py-2 border-t border-[#d1d7db] dark:border-[#222e35] select-none shrink-0 relative">
      {/* Hidden File Inputs */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*,video/*" 
        className="hidden" 
        onChange={(e) => handleFileSelect(e)}
      />
      <input 
        ref={docInputRef}
        type="file" 
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" 
        className="hidden" 
        onChange={(e) => handleFileSelect(e, 'document')}
      />

      {/* 1. Replying Preview Bar */}
      {replyingMessage && (
        <div className="mb-2 p-2 bg-[#111b21] border-l-4 border-[#00a884] rounded-r-lg flex items-center justify-between text-xs animate-in fade-in duration-100">
          <div className="min-w-0 pr-2">
            <span className="font-bold text-[#00a884] block truncate">
              {replyingMessage.direction === 'inbound' 
                ? (lead.customer?.displayName || 'Customer') 
                : 'You'}
            </span>
            <p className="text-[#8696a0] truncate text-[11px]">{replyingMessage.content}</p>
          </div>
          <button 
            onClick={() => setReplyingMessage(null)}
            className="p-1 hover:bg-[#202c33] rounded-full text-[#8696a0] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Attachment Menu Popup */}
      {showAttachMenu && (
        <div 
          ref={attachRef}
          className={`absolute bottom-16 left-4 bg-[#233138] border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs text-[#d1d7db] space-y-1 select-none ${
            attachMenuMode === 'location' ? 'w-64' : 'w-52'
          }`}
        >
          {attachMenuMode === 'main' ? (
            <>
              <button 
                onClick={() => {
                  setShowAttachMenu(false);
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#182229] transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Image className="w-4 h-4" />
                </div>
                <span>Photos & videos</span>
              </button>

              <button 
                onClick={() => {
                  setShowAttachMenu(false);
                  docInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#182229] transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <span>Document</span>
              </button>

              <button 
                onClick={() => {
                  setShowAttachMenu(false);
                  setShowAddContactModal(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#182229] transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <span>Contact</span>
              </button>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setAttachMenuMode('location');
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#182229] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-[#00a884] flex items-center justify-center">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span>Location</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#8696a0] group-hover:text-white transition-colors" />
              </button>
            </>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-1 py-1 border-b border-slate-700/60 pb-2 mb-1">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttachMenuMode('main');
                  }}
                  className="p-1 rounded-lg hover:bg-[#182229] text-[#8696a0] hover:text-white transition-colors cursor-pointer"
                  title="Back"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-xs text-white">Select Location</span>
              </div>

              <button
                type="button"
                onClick={() => handleSendLocation('Colombo', 'https://maps.app.goo.gl/u77VA9jioG22DaDWA')}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[#182229] transition-colors cursor-pointer text-left group"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-[#00a884] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white text-xs flex items-center justify-between">
                    <span>Colombo</span>
                    <Send className="w-3 h-3 text-[#00a884] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[10px] text-[#8696a0] truncate mt-0.5">https://maps.app.goo.gl/u77VA9jioG22DaDWA</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSendLocation('Maruthamunai', 'https://maps.app.goo.gl/9eBdvv4jbWv8aQ3A6')}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[#182229] transition-colors cursor-pointer text-left group"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-[#00a884] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white text-xs flex items-center justify-between">
                    <span>Maruthamunai</span>
                    <Send className="w-3 h-3 text-[#00a884] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[10px] text-[#8696a0] truncate mt-0.5">https://maps.app.goo.gl/9eBdvv4jbWv8aQ3A6</p>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. Emoji Picker Popup */}
      {showEmojiPicker && (
        <div 
          ref={emojiRef}
          className="absolute bottom-16 left-12 bg-[#202c33] border border-slate-700 rounded-2xl shadow-2xl p-3 w-72 z-50 animate-in fade-in zoom-in-95 duration-100 select-none"
        >
          <div className="text-[11px] font-bold text-[#8696a0] mb-2 uppercase tracking-wider">Frequently Used</div>
          <div className="grid grid-cols-5 gap-2 text-xl">
            {COMMON_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => handleInsertEmoji(em)}
                className="w-9 h-9 rounded-lg hover:bg-[#2a3942] flex items-center justify-center hover:scale-125 transition-transform"
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4a. Quick Templates Popover */}
      {showTemplates && (
        <div 
          ref={templateRef}
          onClick={(e) => e.stopPropagation()}
          className="mb-2 bg-white dark:bg-[#202c33] border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-80 overflow-y-auto space-y-2.5 z-30"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700/80">
            <span className="text-xs font-bold text-slate-800 dark:text-[#e9edef] flex items-center gap-1.5">
              <span>🌿 WhatsApp Meta Approved Templates</span>
            </span>
            <button
              type="button"
              onClick={() => setShowTemplates(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {templates.map((tpl) => {
              const isCopied = copiedTplId === tpl.id;
              const isCras = lead.source?.toUpperCase() === 'CRAS' || lead.company === 'CRAS' || tpl.waTemplateName.startsWith('cras_');
              const defaultName = lead.customer?.displayName || (isCras ? 'Dr. Perera' : 'Valued Client');
              const renderedBody = tpl.body.replace(/\{\{1\}\}/g, defaultName);
              return (
                <div key={tpl.id} className="bg-slate-50 dark:bg-[#111b21] p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0 pr-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        tpl.waTemplateName.startsWith('cras_')
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      }`}>
                        {tpl.waTemplateName.startsWith('cras_') ? 'CRAS' : 'RWC'}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{tpl.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(renderedBody);
                          setCopiedTplId(tpl.id);
                          setTimeout(() => setCopiedTplId(null), 2000);
                        }}
                        className={`px-2 py-1 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                          isCopied ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-[#00a884]'
                        }`}
                        title="Copy text"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInputVal(renderedBody);
                          setShowTemplates(false);
                          textareaRef.current?.focus();
                        }}
                        className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-[11px] transition-all cursor-pointer"
                        title="Insert into chat box"
                      >
                        Insert
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendTemplate(tpl)}
                        className="px-2.5 py-1 rounded-lg bg-[#00a884] hover:bg-[#00c298] text-slate-950 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                        title="Send directly via Meta Cloud API"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send (Meta API)</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-24 overflow-y-auto font-sans leading-relaxed bg-white dark:bg-slate-950/60 p-2 rounded-lg select-all border border-slate-200 dark:border-transparent">
                    {renderedBody}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4b. 24-Hour Customer Care Window Banner */}
      {!is24hWindowOpen && (
        <div className="mb-2 px-3.5 py-2 rounded-xl bg-amber-950/70 border border-amber-500/40 text-amber-200 text-xs flex flex-wrap items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium text-[11.5px]">
              24-hour WhatsApp customer window is closed. Regular text will fail. Re-engage with an approved template:
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const isCras = lead.source?.toUpperCase() === 'CRAS' || lead.company === 'CRAS';
              const tplName = isCras ? 'cras_welcome_greeting' : 'rwc_welcome_greeting';
              const clientName = lead.customer?.displayName || (isCras ? 'Dr. Perera' : 'Valued Client');
              sendWhatsAppTemplate(lead.id, tplName, [clientName]);
            }}
            className="px-3 py-1 rounded-lg bg-[#00a884] hover:bg-[#00c298] text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer shrink-0"
            title="Send official Meta-approved template to re-open 24-hour conversation window"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Send Approved Welcome Template 🚀</span>
          </button>
        </div>
      )}

      {/* 4c. WhatsApp Connection State Status Banner */}
      {whatsappStatus === 'syncing' && (
        <div className="mb-2 px-3.5 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            <span className="font-medium">Synchronizing WhatsApp conversation history... Please wait.</span>
          </div>
        </div>
      )}

      {(!whatsappStatus || whatsappStatus === 'disconnected' || whatsappStatus === 'connecting' || whatsappStatus === 'qr_ready') && !hasMetaConfig && (
        <div className="mb-2 px-3.5 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate font-medium">Please link your WhatsApp or configure Meta API to send messages from the CRM.</span>
          </div>
          <button
            type="button"
            onClick={() => setQrModalOpen(true)}
            className="ml-3 px-3 py-1 rounded-lg bg-[#00a884] hover:bg-[#00c298] text-black font-bold text-xs flex items-center gap-1.5 shrink-0 shadow transition-all active:scale-95 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Link Device</span>
          </button>
        </div>
      )}

      {/* 4d. Tamil & Sinhala Phonetic Language Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1 select-none">
        <div className="flex items-center gap-1 bg-[#182229] p-1 rounded-xl border border-slate-700/60 shadow-inner">
          <button
            type="button"
            onClick={() => handleSelectLanguage('en')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              typingLang === 'en'
                ? 'bg-[#00a884] text-slate-950 font-bold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#202c33]'
            }`}
            title="English keyboard typing (standard)"
          >
            <span className="text-[10px] font-mono font-bold px-1 py-0.5 rounded bg-black/25">EN</span>
            <span>English</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectLanguage('ta')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              typingLang === 'ta'
                ? 'bg-[#00a884] text-slate-950 font-bold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#202c33]'
            }`}
            title="Tamil phonetic typing (e.g. vanakkam -> வணக்கம், nandri -> நன்றி)"
          >
            <span className="text-[11px] font-bold px-1 py-0.5 rounded bg-black/25">அ</span>
            <span>தமிழ்</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectLanguage('si')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              typingLang === 'si'
                ? 'bg-[#00a884] text-slate-950 font-bold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#202c33]'
            }`}
            title="Sinhala phonetic typing (e.g. ayubowan -> ආයුබෝවන්, kohomada -> කොහොමද)"
          >
            <span className="text-[11px] font-bold px-1 py-0.5 rounded bg-black/25">සි</span>
            <span>සිංහල</span>
          </button>
        </div>

        {typingLang !== 'en' ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-[#8696a0] bg-[#182229]/80 px-2.5 py-1 rounded-lg border border-slate-700/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline font-medium">
                {typingLang === 'ta' ? 'Tamil Phonetic' : 'Sinhala Phonetic'} • Space converts word
              </span>
              <span className="sm:hidden font-medium">Phonetic</span>
            </div>

            {inputVal.trim() && /[a-zA-Z]/.test(inputVal) && (
              <button
                type="button"
                onClick={handleConvertAllText}
                className="text-[11px] font-bold text-emerald-300 hover:text-white bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-500/40 px-2.5 py-1 rounded-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                title="Convert all typed English words to native script immediately"
              >
                <span>Convert All</span>
                <Sparkles className="w-3 h-3 text-emerald-400" />
              </button>
            )}
          </div>
        ) : (
          <div className="text-[11px] text-[#8696a0] hidden sm:block">
            Standard Keyboard Mode
          </div>
        )}
      </div>

      {/* 4e. Live Phonetic Conversion Suggestion Chip */}
      {activePreviewWord && typingLang !== 'en' && (
        <div className="mb-2 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="bg-[#182229] border border-emerald-500/60 shadow-xl rounded-xl px-3 py-1 flex items-center gap-2 text-xs">
            <span className="text-[#8696a0] text-[11px] font-mono">{activePreviewWord.raw} →</span>
            <button
              type="button"
              onClick={handleCommitPreview}
              className="font-bold text-emerald-300 hover:text-emerald-200 hover:underline cursor-pointer flex items-center gap-1 text-sm transition-transform active:scale-95"
              title="Click or press Space / Tab to insert"
            >
              <span>{activePreviewWord.converted}</span>
              <span className="text-[10px] text-emerald-400/80 font-mono font-normal bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-500/30">Space ↵</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePreviewWord(null)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/80 cursor-pointer ml-1"
              title="Keep English (Esc)"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 5. Main Composer Row */}
      <div className="flex items-end gap-1.5 sm:gap-3">
        {/* Plus / Attach Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (whatsappStatus !== 'connected' && !hasMetaConfig) {
              setQrModalOpen(true);
              return;
            }
            if (!showAttachMenu) {
              setAttachMenuMode('main');
            }
            setShowAttachMenu(!showAttachMenu);
            setShowEmojiPicker(false);
            setShowTemplates(false);
          }}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 mb-0.5 cursor-pointer ${
            showAttachMenu 
              ? 'bg-slate-200 dark:bg-[#374248] text-[#00a884]' 
              : 'text-[#54656f] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#d1d7db] hover:bg-slate-200 dark:hover:bg-[#374248]/50'
          }`}
          title="Attach"
        >
          <Plus className={`w-5 h-5 transition-transform ${showAttachMenu ? 'rotate-45' : ''}`} />
        </button>

        {/* Emoji Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowEmojiPicker(!showEmojiPicker);
            setShowAttachMenu(false);
            setAttachMenuMode('main');
            setShowTemplates(false);
          }}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 mb-0.5 cursor-pointer ${
            showEmojiPicker 
              ? 'bg-slate-200 dark:bg-[#374248] text-[#00a884]' 
              : 'text-[#54656f] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#d1d7db] hover:bg-slate-200 dark:hover:bg-[#374248]/50'
          }`}
          title="Emojis"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Quick Templates / Replies Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowTemplates(!showTemplates);
            setShowEmojiPicker(false);
            setShowAttachMenu(false);
            setAttachMenuMode('main');
          }}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 mb-0.5 cursor-pointer ${
            showTemplates 
              ? 'bg-slate-200 dark:bg-[#374248] text-[#00a884]' 
              : 'text-[#54656f] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#d1d7db] hover:bg-slate-200 dark:hover:bg-[#374248]/50'
          }`}
          title="Quick Templates & Greetings"
        >
          <FileText className="w-5 h-5" />
        </button>

        {/* Input Field / Voice Recording View */}
        {isRecording ? (
          <div className="flex-1 bg-white dark:bg-[#2a3942] border border-slate-200 dark:border-transparent rounded-lg px-4 py-2 flex items-center justify-between text-xs font-mono animate-in fade-in duration-150 mb-0.5 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <span className="text-rose-500 dark:text-rose-400 font-semibold tracking-wider">
                {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
              </span>
              <div className="hidden sm:flex items-center gap-1">
                <div className="w-1 h-3 bg-rose-500/80 rounded animate-pulse" />
                <div className="w-1 h-5 bg-rose-500/80 rounded animate-pulse delay-75" />
                <div className="w-1 h-2 bg-rose-500/80 rounded animate-pulse delay-150" />
                <div className="w-1 h-6 bg-rose-500/80 rounded animate-pulse delay-100" />
                <div className="w-1 h-4 bg-rose-500/80 rounded animate-pulse delay-200" />
              </div>
              <span className="text-[11px] text-[#667781] dark:text-[#8696a0] font-sans">Recording WhatsApp Voice Note...</span>
            </div>
            
            <button 
              type="button"
              onClick={handleCancelRecording} 
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#374248] rounded-full text-[#667781] dark:text-[#8696a0] hover:text-rose-500 transition-colors flex items-center gap-1 font-sans cursor-pointer"
              title="Discard Voice Note"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-xs">Cancel</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center bg-white dark:bg-[#2a3942] border border-slate-200 dark:border-transparent rounded-xl px-3.5 py-1.5 focus-within:ring-1 focus-within:ring-[#00a884] transition-all min-h-[40px] shadow-xs">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputVal}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={(e) => {
                const handled = processClipboardData(e.clipboardData);
                if (handled) {
                  e.preventDefault();
                }
              }}
              placeholder={
                whatsappStatus === 'connected' || hasMetaConfig || localStorage.getItem('meta_access_token')
                  ? typingLang === 'ta'
                    ? "Type in English letters to convert to தமிழ் (e.g. 'vanakkam', 'nandri')..."
                    : typingLang === 'si'
                    ? "Type in English letters to convert to සිංහල (e.g. 'ayubowan', 'kohomada')..."
                    : "Type a message..."
                  : "Please link your WhatsApp or configure Meta API to send messages..."
              }
              className="w-full bg-transparent text-[#111b21] dark:text-[#d1d7db] placeholder-[#8696a0] text-sm outline-none border-none resize-none leading-relaxed max-h-[130px] overflow-y-auto py-0.5"
            />
          </div>
        )}

        {/* Right Button: Send Text OR Send Voice Note OR Start Voice Note */}
        {isRecording ? (
          <button
            type="button"
            onClick={handleStopAndSendRecording}
            className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#00c298] text-black flex items-center justify-center shadow-lg active:scale-95 transition-all shrink-0 animate-in zoom-in-95 mb-0.5"
            title="Send Voice Note"
          >
            <Send className="w-5 h-5 fill-current ml-0.5" />
          </button>
        ) : inputVal.trim() ? (
          <button
            type="button"
            onClick={() => handleSendText()}
            className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#00c298] text-black flex items-center justify-center shadow-lg active:scale-95 transition-all shrink-0 mb-0.5 cursor-pointer"
            title="Send (Enter to send, Shift+Enter for new line)"
          >
            <Send className="w-5 h-5 fill-current ml-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStartRecording}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 text-[#8696a0] hover:text-[#d1d7db] hover:bg-[#374248]/50 mb-0.5"
            title="Record Voice Note"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 6. WhatsApp Web Style Fullscreen Media Send Preview Modal */}
      {mediaPreview && (
        <div className="fixed inset-0 z-[100] bg-[#111b21] flex flex-col animate-in fade-in duration-150">
          {/* Header */}
          <div className="h-14 px-6 bg-[#202c33] flex items-center justify-between border-b border-[#222e35]">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  URL.revokeObjectURL(mediaPreview.previewUrl);
                  setMediaPreview(null);
                }}
                className="p-2 rounded-full hover:bg-[#374248] text-[#8696a0] hover:text-white transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="font-semibold text-sm text-[#e9edef] truncate max-w-md">
                {mediaPreview.type === 'image' ? 'Send Photo' : mediaPreview.type === 'video' ? 'Send Video' : 'Send Document'} — {mediaPreview.fileName}
              </span>
            </div>
          </div>

          {/* Center Preview Content */}
          <div className="flex-1 flex items-center justify-center p-6 overflow-hidden relative">
            {mediaPreview.type === 'image' ? (
              <img 
                src={mediaPreview.previewUrl} 
                alt="Media Preview" 
                className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-150"
              />
            ) : mediaPreview.type === 'video' ? (
              <video 
                src={mediaPreview.previewUrl} 
                controls 
                autoPlay 
                className="max-h-[65vh] max-w-full rounded-lg shadow-2xl"
              />
            ) : (
              <div className="bg-[#202c33] border border-slate-700 rounded-2xl p-8 flex flex-col items-center gap-4 text-center max-w-sm shadow-2xl">
                <div className="w-20 h-20 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <FileText className="w-10 h-10" />
                </div>
                <div>
                  <p className="font-bold text-sm text-[#e9edef] truncate max-w-xs">{mediaPreview.fileName}</p>
                  <p className="text-xs text-[#8696a0] mt-1">{(mediaPreview.file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Caption Input & Send Row */}
          <div className="bg-[#202c33] p-4 border-t border-[#222e35]">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <button 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-2.5 rounded-full transition-colors ${showEmojiPicker ? 'text-[#00a884] bg-[#374248]' : 'text-[#8696a0] hover:text-[#d1d7db]'}`}
                title="Emoji"
              >
                <Smile className="w-6 h-6" />
              </button>

              <input 
                type="text"
                value={mediaPreview.caption}
                onChange={(e) => setMediaPreview({ ...mediaPreview, caption: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendMedia();
                  }
                }}
                autoFocus
                placeholder="Add a caption..."
                className="flex-1 bg-[#2a3942] text-[#d1d7db] placeholder-[#8696a0] text-sm rounded-lg px-4 py-3 outline-none border-none focus:ring-1 focus:ring-[#00a884]"
              />

              <button 
                onClick={handleSendMedia}
                className="w-12 h-12 rounded-full bg-[#00a884] hover:bg-[#00c298] text-black flex items-center justify-center shadow-xl active:scale-95 transition-all shrink-0"
                title="Send"
              >
                <Send className="w-6 h-6 fill-current ml-0.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
      />
    </div>
  );
};
