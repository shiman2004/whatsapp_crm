import React, { useState, useRef, useEffect } from 'react';
import {
  Megaphone,
  Pin,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Mic,
  Square,
  Play,
  Pause,
  Download,
  Filter,
  Search,
  Building2,
  Sparkles,
  X,
  Send,
  Volume2,
  Lock,
  Calendar,
  Clock,
  Maximize2,
  User
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { TeamBroadcast } from '../../types';
import { WhatsAppVoiceRecorder, AudioRecordingResult } from '../../utils/audioRecorder';
import { API_BASE_URL } from '../../config/api';

export const TeamBroadcastView: React.FC = () => {
  const { currentUser, users, broadcasts, sendBroadcast, deleteBroadcast, markAllBroadcastsAsRead } = useCrm();

  // Automatically mark all current broadcasts as read when staff member views this screen
  useEffect(() => {
    markAllBroadcastsAsRead();
  }, [markAllBroadcastsAsRead, broadcasts.length]);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isLeadsOfficer = currentUser?.role === 'leads_officer';
  const canBroadcast = isSuperAdmin || isLeadsOfficer;

  // Filter & Search states
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Composer states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [companyTarget, setCompanyTarget] = useState<'ALL' | 'RWC' | 'CRAS'>('ALL');
  const [targetType, setTargetType] = useState<'ALL' | 'RWC' | 'CRAS' | 'STAFF'>('ALL');
  const [targetStaffId, setTargetStaffId] = useState<string>('');
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Attached media states
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document' | 'audio' | undefined>(undefined);
  const [mediaDataUrl, setMediaDataUrl] = useState<string | undefined>(undefined);
  const [mediaFileName, setMediaFileName] = useState<string | undefined>(undefined);
  const [mediaFileSize, setMediaFileSize] = useState<number | undefined>(undefined);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const voiceRecorderRef = useRef<WhatsAppVoiceRecorder | null>(null);
  const recordTimerRef = useRef<any>(null);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Hidden file inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // File size formatter
  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Resolve media URLs
  const resolveMediaUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/') && !url.startsWith('//')) return `${API_BASE_URL}${url}`;
    return url;
  };

  // Handle local file selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('Selected file is too large. Please select a file smaller than 25MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setMediaType(type);
      setMediaDataUrl(reader.result as string);
      setMediaFileName(file.name);
      setMediaFileSize(file.size);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Start voice recording
  const startVoiceRecording = async () => {
    try {
      if (!voiceRecorderRef.current) {
        voiceRecorderRef.current = new WhatsAppVoiceRecorder();
      }
      await voiceRecorderRef.current.start();
      setIsRecording(true);
      setRecordDuration(0);

      recordTimerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start voice recording:', err);
      alert('Microphone access denied or not supported by browser.');
    }
  };

  // Stop voice recording
  const stopVoiceRecording = async (save: boolean = true) => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    if (voiceRecorderRef.current) {
      const result: AudioRecordingResult | null = await voiceRecorderRef.current.stop();
      setIsRecording(false);

      if (save && result && result.dataUrl) {
        setMediaType('audio');
        setMediaDataUrl(result.dataUrl);
        setMediaFileName(`Voice_Note_${new Date().toISOString().slice(0, 10)}.${result.extension}`);
        setMediaFileSize(result.blob.size);
      }
    } else {
      setIsRecording(false);
    }
  };

  // Reset attachment
  const clearAttachment = () => {
    setMediaType(undefined);
    setMediaDataUrl(undefined);
    setMediaFileName(undefined);
    setMediaFileSize(undefined);
  };

  // Submit broadcast
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !mediaDataUrl) return;

    setIsSubmitting(true);
    try {
      let uploadedUrl = mediaDataUrl;

      // If attached media is base64, optionally upload via /api/upload
      if (mediaDataUrl && mediaDataUrl.startsWith('data:')) {
        try {
          const token = localStorage.getItem('rw_crm_auth_token') || '';
          const uploadRes = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({
              dataUrl: mediaDataUrl,
              type: mediaType,
              fileName: mediaFileName
            })
          });
          if (uploadRes.ok) {
            const uploadJson = await uploadRes.json();
            if (uploadJson.url || uploadJson.mediaUrl) {
              uploadedUrl = uploadJson.url || uploadJson.mediaUrl;
            }
          }
        } catch (uploadErr) {
          console.warn('Could not upload file to server disk, saving base64 directly:', uploadErr);
        }
      }

      let staffName: string | undefined = undefined;
      if (targetType === 'STAFF') {
        if (!targetStaffId) {
          alert('Please select an individual staff member to send this message to.');
          setIsSubmitting(false);
          return;
        }
        const found = (users || []).find(u => u.id === targetStaffId);
        staffName = found?.fullName || 'Staff Member';
      }

      const success = await sendBroadcast({
        title: title.trim() || undefined,
        content: content.trim(),
        company: targetType === 'STAFF' ? 'ALL' : targetType,
        targetStaffId: targetType === 'STAFF' ? targetStaffId : undefined,
        targetStaffName: staffName,
        isPinned,
        mediaType,
        mediaUrl: uploadedUrl,
        fileName: mediaFileName,
        fileSize: mediaFileSize
      });

      if (success) {
        setTitle('');
        setContent('');
        setIsPinned(false);
        setTargetStaffId('');
        clearAttachment();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter broadcasts according to user company & selected filters
  const filteredBroadcasts = (broadcasts || []).filter(item => {
    // 1. Role & individual staff visibility rule:
    if (item.targetStaffId) {
      if (!canBroadcast && item.targetStaffId !== currentUser?.id) {
        return false;
      }
    } else {
      if (!canBroadcast && currentUser?.company) {
        if (item.company && item.company !== 'ALL' && item.company !== currentUser.company) {
          return false;
        }
      }
    }

    // 2. Tab filter
    if (selectedCompanyFilter === 'STAFF') {
      if (!item.targetStaffId) return false;
    } else if (selectedCompanyFilter !== 'ALL') {
      if (item.targetStaffId) return false;
      if (item.company && item.company !== 'ALL' && item.company !== selectedCompanyFilter) {
        return false;
      }
    }

    // 3. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchContent = item.content?.toLowerCase().includes(q);
      const matchSender = item.senderName?.toLowerCase().includes(q);
      const matchTarget = item.targetStaffName?.toLowerCase().includes(q);
      const matchFile = item.fileName?.toLowerCase().includes(q);
      if (!matchTitle && !matchContent && !matchSender && !matchTarget && !matchFile) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        className="hidden"
        onChange={e => handleFileUpload(e, 'image')}
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={e => handleFileUpload(e, 'video')}
      />
      <input
        type="file"
        ref={docInputRef}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        className="hidden"
        onChange={e => handleFileUpload(e, 'document')}
      />

      {/* Header Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#111b21] via-[#1a2730] to-[#111b21] p-6 border border-slate-800 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                <Megaphone className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  Team Broadcast Channel 📢
                  <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Live Supabase
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Official announcements, operational updates, and multimedia broadcasts for Royal Wellness & CRAS teams.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Counter Stats */}
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-medium block">Total Broadcasts</span>
              <span className="text-sm font-black text-amber-400">{broadcasts.length}</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-medium block">Your Access</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                {canBroadcast ? 'Management (Post & View)' : 'Staff (Read Only)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast Message Composer (Super Admin & Leads Officer only) */}
      {canBroadcast ? (
        <div className="bg-[#111b21] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Create New Broadcast Announcement</h2>
            </div>
            <span className="text-[11px] text-slate-400">
              Posting as: <strong className="text-slate-200">{currentUser?.fullName}</strong> ({currentUser?.role === 'super_admin' ? 'Super Admin' : 'Leads Officer'})
            </span>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Top controls: Target Company & Pin to top */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  Target Audience:
                </span>
                <div className="inline-flex rounded-xl bg-slate-900/80 p-1 border border-slate-800 text-xs flex-wrap gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('ALL');
                      setCompanyTarget('ALL');
                      setTargetStaffId('');
                    }}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      targetType === 'ALL'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Staff (Both)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('RWC');
                      setCompanyTarget('RWC');
                      setTargetStaffId('');
                    }}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      targetType === 'RWC'
                        ? 'bg-emerald-600 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Royal Wellness Only
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('CRAS');
                      setCompanyTarget('CRAS');
                      setTargetStaffId('');
                    }}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      targetType === 'CRAS'
                        ? 'bg-[#800000] text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    CRAS College Only
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('STAFF');
                    }}
                    className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                      targetType === 'STAFF'
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    Individual Staff
                  </button>
                </div>
              </div>

              {/* Individual Staff Selector Dropdown (Shown when Individual Staff target is selected) */}
              {targetType === 'STAFF' && (
                <div className="w-full sm:w-auto flex items-center gap-2 bg-slate-900/90 border border-indigo-500/50 rounded-xl px-3 py-1.5 text-xs text-slate-200 shadow-sm animate-in fade-in duration-150">
                  <User className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="font-semibold text-slate-400 whitespace-nowrap">Send to:</span>
                  <select
                    value={targetStaffId}
                    onChange={(e) => setTargetStaffId(e.target.value)}
                    required
                    className="bg-slate-950 text-white text-xs rounded-lg px-2.5 py-1 border border-slate-700 focus:border-indigo-400 focus:outline-hidden cursor-pointer"
                  >
                    <option value="" disabled>-- Select Staff Member --</option>
                    {(users || [])
                      .filter(u => u.active !== false && u.id !== currentUser?.id)
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.roleTitle || u.role} - {u.company || 'All'})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Pin Toggle */}
              <button
                type="button"
                onClick={() => setIsPinned(!isPinned)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  isPinned
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-400 text-amber-400' : ''}`} />
                {isPinned ? 'Pinned to Top' : 'Pin Announcement'}
              </button>
            </div>

            {/* Optional Title */}
            <div>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Announcement Title (optional, e.g. Important: Holiday Working Hours)"
                className="w-full bg-[#1a2730] text-white text-sm rounded-xl px-4 py-2.5 border border-slate-700/80 focus:border-amber-500 focus:outline-hidden placeholder-slate-500 transition-colors"
              />
            </div>

            {/* Message Content */}
            <div>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={3}
                placeholder="Type your broadcast announcement to all staff members here..."
                className="w-full bg-[#1a2730] text-white text-sm rounded-xl p-4 border border-slate-700/80 focus:border-amber-500 focus:outline-hidden placeholder-slate-500 transition-colors resize-y min-h-[90px]"
              />
            </div>

            {/* Attached Media Preview (if any) */}
            {mediaDataUrl && (
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  {mediaType === 'image' && (
                    <img
                      src={mediaDataUrl}
                      alt="Attachment Preview"
                      className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0"
                    />
                  )}
                  {mediaType === 'video' && (
                    <div className="w-12 h-12 rounded-lg bg-sky-950/60 border border-sky-800 flex items-center justify-center text-sky-400 shrink-0">
                      <VideoIcon className="w-6 h-6" />
                    </div>
                  )}
                  {mediaType === 'audio' && (
                    <div className="w-12 h-12 rounded-lg bg-emerald-950/60 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0">
                      <Volume2 className="w-6 h-6" />
                    </div>
                  )}
                  {mediaType === 'document' && (
                    <div className="w-12 h-12 rounded-lg bg-purple-950/60 border border-purple-800 flex items-center justify-center text-purple-400 shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{mediaFileName || 'Media Attachment'}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {mediaType} {mediaFileSize ? `• ${formatBytes(mediaFileSize)}` : ''}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearAttachment}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Remove attachment"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Audio Recording Live State */}
            {isRecording && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs font-bold text-rose-400">Recording Voice Note...</span>
                  <span className="text-xs font-mono text-white bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                    {Math.floor(recordDuration / 60).toString().padStart(2, '0')}:
                    {(recordDuration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => stopVoiceRecording(false)}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => stopVoiceRecording(true)}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-500 transition-colors"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    Finish & Attach
                  </button>
                </div>
              </div>
            )}

            {/* Actions Bar: Attach buttons & Submit */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              {/* Attachment Trays */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-[#1a2730] hover:bg-[#202c33] border border-slate-800 transition-colors"
                  title="Attach Photo"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                  Photo
                </button>

                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-[#1a2730] hover:bg-[#202c33] border border-slate-800 transition-colors"
                  title="Attach Video"
                >
                  <VideoIcon className="w-3.5 h-3.5 text-sky-400" />
                  Video
                </button>

                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-[#1a2730] hover:bg-[#202c33] border border-slate-800 transition-colors"
                  title="Attach Document"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                  Doc
                </button>

                <button
                  type="button"
                  onClick={startVoiceRecording}
                  disabled={isRecording}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    isRecording
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'text-slate-300 hover:text-white bg-[#1a2730] hover:bg-[#202c33] border-slate-800'
                  }`}
                  title="Record Voice Note"
                >
                  <Mic className="w-3.5 h-3.5 text-rose-400" />
                  Voice Note
                </button>
              </div>

              {/* Submit Post Button */}
              <button
                type="submit"
                disabled={isSubmitting || (!content.trim() && !mediaDataUrl)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Post Broadcast 📢
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Read-Only Notice for Coordinators */
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-[#111b21] to-slate-900 border border-slate-800 p-4 flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              Broadcast Channel — Read-Only Mode
            </h3>
            <p className="text-[11px] text-slate-400">
              Only Super Admin and Leads Officers can publish broadcasts. You receive real-time notifications here whenever a team announcement is posted.
            </p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#111b21] p-3 rounded-2xl border border-slate-800">
        {/* Company Filter Tabs */}
        <div className="inline-flex rounded-xl bg-slate-900/80 p-1 border border-slate-800 text-xs w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSelectedCompanyFilter('ALL')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              selectedCompanyFilter === 'ALL'
                ? 'bg-[#202c33] text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Broadcasts
          </button>
          <button
            type="button"
            onClick={() => setSelectedCompanyFilter('RWC')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              selectedCompanyFilter === 'RWC'
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Royal Wellness RWC
          </button>
          <button
            type="button"
            onClick={() => setSelectedCompanyFilter('CRAS')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              selectedCompanyFilter === 'CRAS'
                ? 'bg-[#800000]/40 text-rose-300 border border-rose-500/30 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            CRAS College
          </button>
          <button
            type="button"
            onClick={() => setSelectedCompanyFilter('STAFF')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
              selectedCompanyFilter === 'STAFF'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Direct Messages
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search announcements..."
            className="w-full bg-[#1a2730] text-xs text-white rounded-xl pl-9 pr-3 py-2 border border-slate-800 focus:border-amber-500 focus:outline-hidden placeholder-slate-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Broadcast Feed */}
      <div className="space-y-4">
        {filteredBroadcasts.length === 0 ? (
          <div className="bg-[#111b21] rounded-2xl border border-slate-800 p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 mx-auto flex items-center justify-center">
              <Megaphone className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-white">No broadcast messages found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? 'No announcements matched your search query. Try different keywords.'
                : 'There are currently no team broadcasts posted. Super Admin and Leads Officers can post updates above.'}
            </p>
          </div>
        ) : (
          filteredBroadcasts.map((item: TeamBroadcast) => (
            <BroadcastCard
              key={item.id}
              broadcast={item}
              canDelete={canBroadcast || item.senderId === currentUser?.id}
              onDelete={() => deleteBroadcast(item.id)}
              onOpenLightbox={url => setLightboxUrl(url)}
            />
          ))
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900/80 text-white hover:bg-slate-800 border border-slate-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={resolveMediaUrl(lightboxUrl)}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

// Sub-component: Individual Broadcast Card
interface BroadcastCardProps {
  broadcast: TeamBroadcast;
  canDelete: boolean;
  onDelete: () => void;
  onOpenLightbox: (url: string) => void;
}

const BroadcastCard: React.FC<BroadcastCardProps> = ({
  broadcast,
  canDelete,
  onDelete,
  onOpenLightbox
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const resolveMediaUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/') && !url.startsWith('//')) return `${API_BASE_URL}${url}`;
    return url;
  };

  const formattedDate = () => {
    try {
      const d = new Date(broadcast.createdAt);
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ' at ' + d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return broadcast.createdAt;
    }
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const isManagement = broadcast.senderRole === 'super_admin' || broadcast.senderRole === 'leads_officer';

  return (
    <div className={`rounded-2xl bg-[#111b21] border transition-all shadow-md overflow-hidden ${
      broadcast.isPinned
        ? 'border-amber-500/40 ring-1 ring-amber-500/20 bg-gradient-to-b from-[#142028] to-[#111b21]'
        : 'border-slate-800 hover:border-slate-700/80'
    }`}>
      {/* Pinned banner if true */}
      {broadcast.isPinned && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
            <Pin className="w-3.5 h-3.5 fill-current" />
            <span>Pinned Announcement</span>
          </div>
          <span className="text-[10px] uppercase font-bold text-amber-400/80 tracking-wider">High Priority</span>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Card Header: Author info, Role, Company target & Timestamp */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Author Avatar */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
              broadcast.senderRole === 'super_admin'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
            }`}>
              {broadcast.senderName ? broadcast.senderName.charAt(0).toUpperCase() : 'M'}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white">{broadcast.senderName}</span>
                {/* Role Badge */}
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
                  broadcast.senderRole === 'super_admin'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                }`}>
                  {broadcast.senderRole === 'super_admin' ? 'Super Admin' : 'Leads Officer'}
                </span>

                {/* Company Scope Badge */}
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
                  broadcast.company === 'RWC'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : broadcast.company === 'CRAS'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                }`}>
                  {broadcast.company === 'RWC'
                    ? 'Royal Wellness'
                    : broadcast.company === 'CRAS'
                    ? 'CRAS College'
                    : 'All Staff'}
                </span>

                {/* Direct Staff Badge */}
                {broadcast.targetStaffId && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1">
                    <User className="w-2.5 h-2.5" />
                    Direct: {broadcast.targetStaffName || 'Staff Member'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>{formattedDate()}</span>
              </div>
            </div>
          </div>

          {/* Delete Action (if allowed) */}
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Are you sure you want to delete this broadcast announcement?')) {
                  onDelete();
                }
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
              title="Delete announcement"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Title if present */}
        {broadcast.title && (
          <h3 className="text-base font-bold text-white tracking-tight">
            {broadcast.title}
          </h3>
        )}

        {/* Content body */}
        {broadcast.content && (
          <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-normal">
            {broadcast.content}
          </div>
        )}

        {/* Media Attachments */}
        {broadcast.mediaUrl && (
          <div className="pt-2">
            {/* 1. Image */}
            {broadcast.mediaType === 'image' && (
              <div
                className="relative rounded-xl overflow-hidden bg-black/40 border border-slate-800 max-w-lg cursor-pointer group"
                onClick={() => onOpenLightbox(broadcast.mediaUrl!)}
              >
                <img
                  src={resolveMediaUrl(broadcast.mediaUrl)}
                  alt={broadcast.fileName || 'Broadcast Attachment'}
                  className="w-full max-h-96 object-cover hover:scale-[1.01] transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                </div>
              </div>
            )}

            {/* 2. Video */}
            {broadcast.mediaType === 'video' && (
              <div className="rounded-xl overflow-hidden bg-black/50 border border-slate-800 max-w-lg">
                <video
                  src={resolveMediaUrl(broadcast.mediaUrl)}
                  controls
                  playsInline
                  className="w-full max-h-96 object-contain"
                />
              </div>
            )}

            {/* 3. Audio / Voice Recording */}
            {broadcast.mediaType === 'audio' && (
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 max-w-md flex items-center gap-3">
                <audio
                  ref={audioRef}
                  src={resolveMediaUrl(broadcast.mediaUrl)}
                  onEnded={() => setIsPlayingAudio(false)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={toggleAudio}
                  className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shrink-0 shadow-md transition-all active:scale-95"
                >
                  {isPlayingAudio ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs font-semibold text-white mb-1">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Mic className="w-3.5 h-3.5" />
                      Voice Note
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {broadcast.fileName || 'Audio Message'}
                    </span>
                  </div>
                  {/* Visualizer simulation bars */}
                  <div className="flex items-center gap-0.5 h-4">
                    {[12, 18, 8, 22, 14, 26, 16, 20, 10, 18, 24, 14, 20, 28, 16, 22, 10, 18].map((h, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all ${
                          isPlayingAudio ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                        }`}
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Document */}
            {broadcast.mediaType === 'document' && (
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 max-w-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {broadcast.fileName || 'Document File'}
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {broadcast.fileSize ? `${(broadcast.fileSize / 1024).toFixed(1)} KB` : 'Attached File'}
                    </p>
                  </div>
                </div>
                <a
                  href={resolveMediaUrl(broadcast.mediaUrl)}
                  download={broadcast.fileName || 'download'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#202c33] hover:bg-slate-800 text-xs font-bold text-slate-200 hover:text-white border border-slate-700 transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  Download
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
