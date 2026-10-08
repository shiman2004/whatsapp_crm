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
  Camera,
  User,
  BarChart2,
  Sparkles,
  QrCode,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Lead, WhatsAppTemplate } from '../../types';
import { useCrm } from '../../context/CrmContext';

interface MessageComposerProps {
  lead: Lead;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '🎉', '💯', '✨', '💐', '🙌', '😍', '😊', '👌', '⭐', '🤝', '🩺', '💉'];

export const MessageComposer: React.FC<MessageComposerProps> = ({ lead }) => {
  const { 
    sendMessage, 
    sendWhatsAppTemplate, 
    templates, 
    categories, 
    treatments,
    replyingMessage,
    setReplyingMessage,
    whatsappStatus,
    setQrModalOpen
  } = useCrm();

  const [inputVal, setInputVal] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Media Attachment State & Preview
  const [mediaPreview, setMediaPreview] = useState<{
    file: File;
    previewUrl: string;
    type: 'image' | 'video' | 'document';
    fileName: string;
    caption: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const category = categories.find(c => c.id === lead.categoryId);
  const treatment = treatments.find(t => t.id === lead.treatmentId);

  // Focus input when replying to a message
  useEffect(() => {
    if (replyingMessage && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingMessage]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachRef.current && !attachRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
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

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim()) return;

    sendMessage(lead.id, inputVal.trim(), 'coordinator');
    setInputVal('');
    setShowEmojiPicker(false);
  };

  const handleSendTemplate = (tpl: WhatsAppTemplate) => {
    const custName = lead.customer?.displayName || 'Client';
    const trtName = treatment?.name || category?.name || 'Treatment';
    
    sendWhatsAppTemplate(lead.id, tpl.id, [custName, trtName]);
    setShowTemplates(false);
    setShowAttachMenu(false);
  };

  const handleInsertEmoji = (emoji: string) => {
    if (mediaPreview) {
      setMediaPreview(prev => prev ? { ...prev, caption: prev.caption + emoji } : null);
    } else {
      setInputVal(prev => prev + emoji);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const approvedTemplates = templates.filter(t => t.approved && (t.language === lead.language || t.language === 'en'));

  return (
    <div className="bg-[#202c33] px-4 py-2 border-t border-[#222e35] select-none shrink-0 relative">
      {/* Hidden File Inputs */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*,video/*" 
        className="hidden" 
        onChange={(e) => handleFileSelect(e)}
      />
      <input 
        ref={cameraInputRef}
        type="file" 
        accept="image/*" 
        capture="environment"
        className="hidden" 
        onChange={(e) => handleFileSelect(e, 'image')}
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

      {/* 2. WhatsApp Template Selector Drawer */}
      {showTemplates && (
        <div className="mb-3 bg-[#111b21] border border-slate-700 rounded-xl p-3 space-y-2 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <h4 className="text-xs font-bold text-[#d1d7db] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#00a884]" />
              <span>Pre-Approved WhatsApp Templates</span>
            </h4>
            <button onClick={() => setShowTemplates(false)} className="text-[#8696a0] hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {approvedTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-2.5 rounded-lg bg-[#202c33] border border-slate-800 hover:border-slate-700 flex items-start justify-between gap-3 text-xs transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-[#d1d7db] block">{tpl.name}</span>
                  <p className="text-[11px] text-[#8696a0] line-clamp-1 italic">{tpl.body}</p>
                </div>
                <button
                  onClick={() => handleSendTemplate(tpl)}
                  className="px-3 py-1 bg-[#00a884] hover:bg-[#00c298] text-black text-xs font-bold rounded-lg shrink-0 transition-colors shadow"
                >
                  Send
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Attachment Menu Popup */}
      {showAttachMenu && (
        <div 
          ref={attachRef}
          className="absolute bottom-16 left-4 bg-[#233138] border border-slate-700/80 rounded-2xl shadow-2xl p-2 w-52 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs text-[#d1d7db] space-y-1 select-none"
        >
          <button 
            onClick={() => {
              setShowAttachMenu(false);
              fileInputRef.current?.click();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#182229] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Image className="w-4 h-4" />
            </div>
            <span>Photos & videos</span>
          </button>

          <button 
            onClick={() => {
              setShowAttachMenu(false);
              cameraInputRef.current?.click();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#182229] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <span>Camera</span>
          </button>

          <button 
            onClick={() => {
              setShowAttachMenu(false);
              docInputRef.current?.click();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#182229] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <span>Document</span>
          </button>

          <button 
            onClick={() => setShowAttachMenu(false)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#182229] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <span>Contact</span>
          </button>

          <button 
            onClick={() => setShowAttachMenu(false)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#182229] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <BarChart2 className="w-4 h-4" />
            </div>
            <span>Poll</span>
          </button>

          <div className="h-px bg-slate-700/60 my-1" />

          <button 
            onClick={() => {
              setShowAttachMenu(false);
              setShowTemplates(true);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#182229] transition-colors font-medium text-[#00a884]"
          >
            <div className="w-7 h-7 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>WhatsApp Templates</span>
          </button>
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

      {/* 4b. WhatsApp Connection State Status Banner */}
      {whatsappStatus === 'syncing' && (
        <div className="mb-2 px-3.5 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            <span className="font-medium">Synchronizing WhatsApp conversation history... Please wait.</span>
          </div>
        </div>
      )}

      {(!whatsappStatus || whatsappStatus === 'disconnected' || whatsappStatus === 'connecting' || whatsappStatus === 'qr_ready') && !localStorage.getItem('meta_access_token') && (
        <div className="mb-2 px-3.5 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate font-medium">Please link your WhatsApp or configure Meta API to send messages from the CRM.</span>
          </div>
          <button
            type="button"
            onClick={() => setQrModalOpen(true)}
            className="ml-3 px-3 py-1 rounded-lg bg-[#00a884] hover:bg-[#00c298] text-black font-bold text-xs flex items-center gap-1.5 shrink-0 shadow transition-all active:scale-95"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Link Device</span>
          </button>
        </div>
      )}

      {/* 5. Main Composer Row (Exact 1:1 Match of Screenshot 2) */}
      <div className="flex items-center gap-3">
        {/* Plus / Attach Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (whatsappStatus !== 'connected' && !localStorage.getItem('meta_access_token')) {
              setQrModalOpen(true);
              return;
            }
            setShowAttachMenu(!showAttachMenu);
            setShowEmojiPicker(false);
          }}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 ${
            showAttachMenu ? 'bg-[#374248] text-[#00a884]' : 'text-[#8696a0] hover:text-[#d1d7db] hover:bg-[#374248]/50'
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
          }}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 ${
            showEmojiPicker ? 'bg-[#374248] text-[#00a884]' : 'text-[#8696a0] hover:text-[#d1d7db] hover:bg-[#374248]/50'
          }`}
          title="Emojis"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Input Field / Voice Recording View */}
        {isRecording ? (
          <div className="flex-1 bg-[#2a3942] rounded-lg px-4 py-2 flex items-center justify-between text-xs text-rose-400 font-mono animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>Recording Voice Note... {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}</span>
            </div>
            <button 
              onClick={() => setIsRecording(false)} 
              className="text-xs text-[#8696a0] hover:text-white font-sans"
            >
              Cancel
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendText} className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={whatsappStatus === 'connected' || localStorage.getItem('meta_access_token') ? 'Type a message' : 'Please link your WhatsApp or configure Meta API to send messages...'}
              className="w-full bg-[#2a3942] text-[#d1d7db] placeholder-[#8696a0] text-sm rounded-lg px-4 py-2 outline-none border-none focus:ring-1 focus:ring-[#00a884] transition-all"
            />
          </form>
        )}

        {/* Right Button: Mic (when empty) OR Send Button (when typing text) */}
        {inputVal.trim() ? (
          <button
            type="button"
            onClick={handleSendText}
            className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#00c298] text-black flex items-center justify-center shadow-lg active:scale-95 transition-all shrink-0"
            title="Send"
          >
            <Send className="w-5 h-5 fill-current ml-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (whatsappStatus !== 'connected') {
                setQrModalOpen(true);
                return;
              }
              setIsRecording(!isRecording);
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${
              isRecording 
                ? 'bg-rose-500 text-white' 
                : 'text-[#8696a0] hover:text-[#d1d7db] hover:bg-[#374248]/50'
            }`}
            title={isRecording ? 'Stop recording' : 'Voice note'}
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
    </div>
  );
};
