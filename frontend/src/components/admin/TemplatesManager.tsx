import React, { useState, useMemo } from 'react';
import { useCrm } from '../../context/CrmContext';
import { WhatsAppTemplate, FollowupSequence, QuickResponse } from '../../types';
import { 
  FileText, 
  Plus, 
  CheckCircle2, 
  Calendar, 
  ArrowRight, 
  Clock, 
  Globe, 
  ShieldCheck, 
  Zap,
  Layers,
  X,
  Copy,
  Check,
  Edit2,
  Trash2,
  Search,
  AlertTriangle,
  RefreshCw,
  Sparkles
} from 'lucide-react';

export const TemplatesManager: React.FC = () => {
  const { 
    templates, 
    sequences, 
    categories, 
    addTemplate,
    updateTemplate,
    deleteTemplate,
    syncTemplatesWithMeta,
    metaConnected,
    metaWabaId,
    quickResponses,
    addQuickResponse,
    updateQuickResponse,
    deleteQuickResponse
  } = useCrm();

  const [activeSubTab, setActiveSubTab] = useState<'templates' | 'quick-responses' | 'sequences'>('templates');
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedTplId, setCopiedTplId] = useState<string | null>(null);
  const [isSyncingMeta, setIsSyncingMeta] = useState(false);
  const [tplSearchQuery, setTplSearchQuery] = useState('');
  const [tplStatusFilter, setTplStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');
  const [deletingTpl, setDeletingTpl] = useState<WhatsAppTemplate | null>(null);
  const [editingTpl, setEditingTpl] = useState<WhatsAppTemplate | null>(null);

  // Quick Responses State
  const [showQrModal, setShowQrModal] = useState(false);
  const [editingQr, setEditingQr] = useState<QuickResponse | null>(null);
  const [deletingQrId, setDeletingQrId] = useState<string | null>(null);
  const [copiedQrId, setCopiedQrId] = useState<string | null>(null);
  const [qrSearchQuery, setQrSearchQuery] = useState('');
  const [qrLangFilter, setQrLangFilter] = useState<'all' | 'ta' | 'si' | 'en' | 'multi'>('all');

  // Quick Response Form Fields
  const [qrTitle, setQrTitle] = useState('');
  const [qrCategory, setQrCategory] = useState('Welcome & Greeting');
  const [qrLanguage, setQrLanguage] = useState<'ta' | 'si' | 'en' | 'multi'>('multi');
  const [qrShortcut, setQrShortcut] = useState('');
  const [qrContent, setQrContent] = useState('');

  const handleCopy = (tpl: WhatsAppTemplate) => {
    navigator.clipboard.writeText(tpl.body);
    setCopiedTplId(tpl.id);
    setTimeout(() => setCopiedTplId(null), 2500);
  };

  const handleCopyQr = (qr: QuickResponse) => {
    navigator.clipboard.writeText(qr.content);
    setCopiedQrId(qr.id);
    setTimeout(() => setCopiedQrId(null), 2500);
  };

  // Template form state
  const [tplName, setTplName] = useState('');
  const [tplSlug, setTplSlug] = useState('');
  const [tplLang, setTplLang] = useState<'en' | 'si' | 'ta'>('en');
  const [tplCategory, setTplCategory] = useState<'UTILITY' | 'MARKETING'>('UTILITY');
  const [tplBody, setTplBody] = useState('');
  const [isSubmittingTpl, setIsSubmittingTpl] = useState(false);
  const [tplSubmitError, setTplSubmitError] = useState<string | null>(null);

  const handleTplNameChange = (val: string) => {
    setTplName(val);
    const autoSlug = val.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 50);
    setTplSlug(autoSlug);
  };

  const handleOpenAddTpl = () => {
    setEditingTpl(null);
    setTplName('');
    setTplSlug('');
    setTplLang('en');
    setTplCategory('UTILITY');
    setTplBody('');
    setTplSubmitError(null);
    setShowAddModal(true);
  };

  const handleOpenEditTpl = (tpl: WhatsAppTemplate) => {
    setEditingTpl(tpl);
    setTplName(tpl.name);
    setTplSlug(tpl.waTemplateName);
    setTplLang(tpl.language);
    setTplCategory((tpl.category as any) || 'UTILITY');
    setTplBody(tpl.body);
    setTplSubmitError(null);
    setShowAddModal(true);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim() || !tplBody.trim()) return;

    setIsSubmittingTpl(true);
    setTplSubmitError(null);

    const slug = (tplSlug || tplName)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (editingTpl) {
      await updateTemplate(editingTpl.id, {
        name: tplName.trim(),
        language: tplLang,
        waTemplateName: slug || editingTpl.waTemplateName,
        body: tplBody.trim(),
        category: tplCategory,
      });
      setIsSubmittingTpl(false);
      setEditingTpl(null);
      setShowAddModal(false);
      return;
    }

    const res = await addTemplate({
      name: tplName.trim(),
      language: tplLang,
      waTemplateName: slug || 'tpl_' + Date.now().toString(36),
      body: tplBody.trim(),
      variables: ['Customer Name', 'Treatment Name'],
      approved: false,
      status: 'PENDING',
      category: tplCategory,
    });

    setIsSubmittingTpl(false);

    if (res?.success) {
      setTplName('');
      setTplSlug('');
      setTplBody('');
      setTplSubmitError(null);
      setShowAddModal(false);
    } else {
      setTplSubmitError(res?.error || 'Failed to submit template to Meta Cloud API.');
    }
  };

  const handleConfirmDeleteTpl = async () => {
    if (!deletingTpl) return;
    await deleteTemplate(deletingTpl.id);
    setDeletingTpl(null);
  };

  const handleSyncMeta = async () => {
    setIsSyncingMeta(true);
    await syncTemplatesWithMeta();
    setIsSyncingMeta(false);
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const curStatus = tpl.status || (tpl.approved ? 'APPROVED' : 'PENDING');
      const matchesStatus = 
        tplStatusFilter === 'ALL' ||
        (tplStatusFilter === 'APPROVED' && (curStatus === 'APPROVED' || tpl.approved)) ||
        (tplStatusFilter === 'PENDING' && (curStatus === 'PENDING' && !tpl.approved)) ||
        (tplStatusFilter === 'REJECTED' && curStatus === 'REJECTED');

      const q = tplSearchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        tpl.name.toLowerCase().includes(q) ||
        tpl.waTemplateName.toLowerCase().includes(q) ||
        tpl.body.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [templates, tplStatusFilter, tplSearchQuery]);

  const approvedCount = useMemo(() => templates.filter(t => t.status === 'APPROVED' || (t.approved && t.status !== 'REJECTED')).length, [templates]);
  const pendingCount = useMemo(() => templates.filter(t => t.status === 'PENDING' || (!t.approved && t.status !== 'REJECTED')).length, [templates]);
  const rejectedCount = useMemo(() => templates.filter(t => t.status === 'REJECTED').length, [templates]);

  // Open Add QR Modal
  const handleOpenAddQr = () => {
    setEditingQr(null);
    setQrTitle('');
    setQrCategory('Welcome & Greeting');
    setQrLanguage('multi');
    setQrShortcut('');
    setQrContent('');
    setShowQrModal(true);
  };

  // Open Edit QR Modal
  const handleOpenEditQr = (qr: QuickResponse) => {
    setEditingQr(qr);
    setQrTitle(qr.title);
    setQrCategory(qr.category || 'General');
    setQrLanguage((qr.language as any) || 'multi');
    setQrShortcut(qr.shortcut || '');
    setQrContent(qr.content);
    setShowQrModal(true);
  };

  // Save QR (Create or Update)
  const handleSaveQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrTitle.trim() || !qrContent.trim()) return;

    if (editingQr) {
      await updateQuickResponse(editingQr.id, {
        title: qrTitle.trim(),
        category: qrCategory.trim(),
        language: qrLanguage,
        shortcut: qrShortcut.trim(),
        content: qrContent.trim()
      });
    } else {
      await addQuickResponse({
        title: qrTitle.trim(),
        category: qrCategory.trim(),
        language: qrLanguage,
        shortcut: qrShortcut.trim(),
        content: qrContent.trim()
      });
    }

    setShowQrModal(false);
    setEditingQr(null);
  };

  // Delete QR
  const handleConfirmDeleteQr = async () => {
    if (!deletingQrId) return;
    await deleteQuickResponse(deletingQrId);
    setDeletingQrId(null);
  };

  // Filtered Quick Responses
  const filteredQuickResponses = useMemo(() => {
    return quickResponses.filter((qr) => {
      const matchesSearch = 
        !qrSearchQuery.trim() ||
        qr.title.toLowerCase().includes(qrSearchQuery.toLowerCase()) ||
        qr.content.toLowerCase().includes(qrSearchQuery.toLowerCase()) ||
        (qr.shortcut && qr.shortcut.toLowerCase().includes(qrSearchQuery.toLowerCase())) ||
        (qr.category && qr.category.toLowerCase().includes(qrSearchQuery.toLowerCase()));

      const matchesLang = 
        qrLangFilter === 'all' || 
        qr.language === qrLangFilter ||
        (qrLangFilter === 'multi' && qr.language === 'multi');

      return matchesSearch && matchesLang;
    });
  }, [quickResponses, qrSearchQuery, qrLangFilter]);

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-serif">
            Templates & Nurture
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            WhatsApp quick responses, Meta Cloud API templates, and automated follow-up sequences
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Subtab Toggle */}
          <div className="bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center">
            <button
              onClick={() => setActiveSubTab('quick-responses')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeSubTab === 'quick-responses'
                  ? 'bg-white dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-slate-200 dark:border-teal-500/30 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Quick Responses ({quickResponses.length})
            </button>
            <button
              onClick={() => setActiveSubTab('templates')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeSubTab === 'templates'
                  ? 'bg-white dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-slate-200 dark:border-teal-500/30 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Meta Templates ({templates.length})
            </button>
            <button
              onClick={() => setActiveSubTab('sequences')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeSubTab === 'sequences'
                  ? 'bg-white dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-slate-200 dark:border-teal-500/30 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Follow-Up Sequences ({sequences.length})
            </button>
          </div>

          {activeSubTab === 'quick-responses' ? (
            <button
              type="button"
              onClick={handleOpenAddQr}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Quick Response</span>
            </button>
          ) : activeSubTab === 'templates' ? (
            <button
              type="button"
              onClick={handleOpenAddTpl}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Template</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* QUICK RESPONSES SUB-TAB */}
      {activeSubTab === 'quick-responses' && (
        <div className="space-y-4">
          {/* Informational Banner */}
          <div className="p-4 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-[#008069] dark:text-[#00a884] flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-teal-900 dark:text-teal-200 flex items-center gap-2">
                  <span>Direct Client Messages (No Meta Approval Required)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-200/60 dark:bg-teal-900 text-teal-900 dark:text-teal-200">
                    Live Chat Ready
                  </span>
                </h4>
                <p className="text-xs text-teal-800/80 dark:text-teal-300/80 leading-relaxed">
                  These quick responses are readily available to coordinators inside the WhatsApp chat attachment menu (⚡ Quick Response). 
                  Coordinators can insert them into messages or send directly without waiting for Meta template verification.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenAddQr}
              className="px-3 py-1.5 bg-[#00a884] hover:bg-[#00c298] text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer hidden sm:flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Add Response</span>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-3 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={qrSearchQuery}
                onChange={(e) => setQrSearchQuery(e.target.value)}
                placeholder="Search quick responses by title, shortcut, or content..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-[#00a884]"
              />
              {qrSearchQuery && (
                <button
                  type="button"
                  onClick={() => setQrSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Language filter pills */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setQrLangFilter('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  qrLangFilter === 'all'
                    ? 'bg-[#00a884] text-slate-950'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({quickResponses.length})
              </button>
              <button
                type="button"
                onClick={() => setQrLangFilter('multi')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  qrLangFilter === 'multi'
                    ? 'bg-[#00a884] text-slate-950'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🌐 Multi-Lang
              </button>
              <button
                type="button"
                onClick={() => setQrLangFilter('ta')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  qrLangFilter === 'ta'
                    ? 'bg-[#00a884] text-slate-950'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                தமிழ் (Tamil)
              </button>
              <button
                type="button"
                onClick={() => setQrLangFilter('si')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  qrLangFilter === 'si'
                    ? 'bg-[#00a884] text-slate-950'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                සිංහල (Sinhala)
              </button>
            </div>
          </div>

          {/* Quick Responses Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredQuickResponses.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <FileText className="w-12 h-12 mx-auto text-slate-400 opacity-50" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  No quick responses matched your query
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Try another keyword or click the "Create Quick Response" button to add a new message template.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddQr}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Quick Response</span>
                </button>
              </div>
            ) : (
              filteredQuickResponses.map((qr) => {
                const isCopied = copiedQrId === qr.id;
                return (
                  <div
                    key={qr.id}
                    className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm hover:border-teal-500/50 dark:hover:border-teal-500/50 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="space-y-1 min-w-0">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                            <span>{qr.title}</span>
                          </h4>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {qr.shortcut && (
                              <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                /{qr.shortcut}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 uppercase">
                              {qr.language === 'multi' ? '🌐 Multi-Lang' : qr.language?.toUpperCase()}
                            </span>
                            {qr.category && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400">
                                {qr.category}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Top Actions: Edit & Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditQr(qr)}
                            className="p-2 rounded-xl text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit Quick Response"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingQrId(qr.id)}
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete Quick Response"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Message Content Box */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed font-sans whitespace-pre-wrap select-all max-h-72 overflow-y-auto">
                        {qr.content}
                      </div>
                    </div>

                    {/* Card Footer: Copy Message button */}
                    <div className="pt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => handleCopyQr(qr)}
                        className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98 ${
                          isCopied
                            ? 'bg-emerald-600 text-white border border-emerald-400'
                            : 'bg-[#00a884] hover:bg-[#00c298] text-slate-950'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Copied to Clipboard!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 stroke-[2.5]" />
                            <span>Copy Message</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                        <span>{qr.content.length} characters</span>
                        <span className="text-teal-700 dark:text-teal-400 font-medium">
                          Available in WhatsApp Chat
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* META TEMPLATES SUB-TAB */}
      {activeSubTab === 'templates' && (
        <div className="space-y-4">
          {/* Real-time Meta Connection & Status Banner */}
          <div className="p-4 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-[#008069] dark:text-[#00a884] flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <h4 className="text-xs font-bold text-teal-950 dark:text-teal-200">
                    Meta WhatsApp Cloud API Connected
                  </h4>
                  {metaWabaId && (
                    <span className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-teal-200/60 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200">
                      WABA ID: {metaWabaId}
                    </span>
                  )}
                </div>
                <p className="text-xs text-teal-800/80 dark:text-teal-300/80 mt-0.5">
                  Official 24-hour service window re-engagement templates synced directly with Meta Graph API.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncMeta}
                disabled={isSyncingMeta}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-teal-600 dark:text-teal-400 ${isSyncingMeta ? 'animate-spin' : ''}`} />
                <span>{isSyncingMeta ? 'Syncing with Meta...' : 'Sync with Meta'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTplSubmitError(null);
                  setShowAddModal(true);
                }}
                className="px-3.5 py-1.5 bg-[#00a884] hover:bg-[#00c298] text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Create Template</span>
              </button>
            </div>
          </div>

          {/* Search & Real-time Status Filter Bar */}
          <div className="p-3 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={tplSearchQuery}
                onChange={(e) => setTplSearchQuery(e.target.value)}
                placeholder="Search Meta templates by name, ID, or content..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-[#00a884]"
              />
              {tplSearchQuery && (
                <button
                  type="button"
                  onClick={() => setTplSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setTplStatusFilter('ALL')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  tplStatusFilter === 'ALL'
                    ? 'bg-[#00a884] text-slate-950 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({templates.length})
              </button>
              <button
                type="button"
                onClick={() => setTplStatusFilter('APPROVED')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  tplStatusFilter === 'APPROVED'
                    ? 'bg-emerald-500 text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Approved ({approvedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setTplStatusFilter('PENDING')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  tplStatusFilter === 'PENDING'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span>Pending ({pendingCount})</span>
              </button>
              {rejectedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setTplStatusFilter('REJECTED')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    tplStatusFilter === 'REJECTED'
                      ? 'bg-rose-500 text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  <span>Rejected ({rejectedCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTemplates.length === 0 ? (
              <div className="col-span-full p-12 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
                <FileText className="w-10 h-10 text-slate-400 mx-auto" />
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">No templates found</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {tplSearchQuery ? 'Try clearing your search query or status filter.' : 'Click "Create Template" to draft a new WhatsApp template and submit it to Meta for approval.'}
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddTpl}
                  className="px-4 py-2 bg-[#00a884] hover:bg-[#00c298] text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Create Template
                </button>
              </div>
            ) : (
              filteredTemplates.map((tpl) => {
                const isCopied = copiedTplId === tpl.id;
                const curStatus = tpl.status || (tpl.approved ? 'APPROVED' : 'PENDING');
                const isApproved = curStatus === 'APPROVED' || tpl.approved;
                const isPending = curStatus === 'PENDING' && !tpl.approved;
                const isRejected = curStatus === 'REJECTED';

                return (
                  <div
                    key={tpl.id}
                    className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Header: Name, Language & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight truncate" title={tpl.name}>
                            {tpl.name}
                          </h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate" title={tpl.waTemplateName}>
                            Meta ID: {tpl.waTemplateName}
                          </p>
                        </div>

                        {/* Top Actions: Badges & Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase">
                            {tpl.language.toUpperCase()}
                          </span>

                          {/* Real-time Status Badge */}
                          {isApproved ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> APPROVED
                            </span>
                          ) : isPending ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20 dark:border-amber-500/30 text-[10px] font-bold flex items-center gap-1 shadow-2xs animate-pulse">
                              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 animate-spin" /> PENDING
                            </span>
                          ) : isRejected ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/20 dark:border-rose-500/30 text-[10px] font-bold flex items-center gap-1 shadow-2xs">
                              <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" /> REJECTED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                              {curStatus}
                            </span>
                          )}

                          {/* Edit Template Option */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditTpl(tpl)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit WhatsApp Template"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Template Option */}
                          <button
                            type="button"
                            onClick={() => setDeletingTpl(tpl)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer ml-0.5"
                            title="Delete WhatsApp Template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Informational banners for pending/rejected */}
                      {isPending && (
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                          <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                          <div>
                            <span className="font-bold">Pending Meta Review:</span> Submitted to WhatsApp Cloud API. Real-time status will automatically update to Approved once verified.
                          </div>
                        </div>
                      )}

                      {isRejected && (
                        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-[11px] text-rose-800 dark:text-rose-300 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                          <div>
                            <span className="font-bold">Meta Rejected:</span> {tpl.rejectedReason || 'Template does not meet Meta WhatsApp Business messaging requirements.'}
                          </div>
                        </div>
                      )}

                      {/* Body with exact pre-wrapped emojis & line breaks */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed font-sans whitespace-pre-wrap select-all max-h-64 overflow-y-auto">
                        {tpl.body}
                      </div>
                    </div>

                    {/* Copy Button & Category Footer */}
                    <div className="pt-2 space-y-2.5">
                      <button
                        type="button"
                        onClick={() => handleCopy(tpl)}
                        className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98 ${
                          isCopied
                            ? 'bg-emerald-600 text-white border border-emerald-400'
                            : 'bg-[#00a884] hover:bg-[#00c298] text-slate-950'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Copied to Clipboard!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 stroke-[2.5]" />
                            <span>Copy Message</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                          Category: {tpl.category}
                        </span>
                        <span className="text-[10px] text-teal-700 dark:text-teal-400 font-medium">
                          {isApproved ? 'Ready for 24h WhatsApp Re-engagement' : 'Awaiting Meta Approval'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SEQUENCES SUB-TAB */}
      {activeSubTab === 'sequences' && (
        <div className="space-y-5">
          {sequences.map((seq) => {
            const category = categories.find(c => c.id === seq.categoryId);

            return (
              <div
                key={seq.id}
                className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500 dark:text-gold-400" />
                      {seq.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Target Specialty: <strong className="text-teal-700 dark:text-teal-400">{category?.name}</strong>
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30 text-[11px] font-bold">
                    BullMQ Auto-Trigger Active
                  </span>
                </div>

                {/* Steps Visual Chain */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {seq.steps.map((st, idx) => {
                    const template = templates.find(t => t.id === st.templateId);
                    return (
                      <div
                        key={idx}
                        className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 relative shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Day +{st.dayOffset}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">Step #{idx + 1}</span>
                        </div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{st.label}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                          {template?.body}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Meta Template */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-[#008069] dark:text-[#00a884] flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {editingTpl ? 'Edit WhatsApp Template' : 'Create WhatsApp Template (Meta Graph API)'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {editingTpl ? 'Update template content, language, or category in CRM.' : 'Submits directly to Meta Cloud API for automated verification & approval.'}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingTpl(null);
                  setTplSubmitError(null);
                }} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {tplSubmitError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <span className="font-bold">Submission Notice:</span> {tplSubmitError}
                </div>
              </div>
            )}

            <form onSubmit={handleCreateTemplate} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Template Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={tplName}
                    onChange={(e) => handleTplNameChange(e.target.value)}
                    placeholder="e.g. Laser Consultation Reminder"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-[#00a884]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Meta System Name (Slug) *
                  </label>
                  <input
                    type="text"
                    required
                    value={tplSlug}
                    onChange={(e) => setTplSlug(e.target.value)}
                    placeholder="e.g. laser_consultation_reminder"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-mono text-[11px] outline-none focus:border-[#00a884]"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Lowercase letters & underscores only.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Language</label>
                  <select
                    value={tplLang}
                    onChange={(e) => setTplLang(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-[#00a884]"
                  >
                    <option value="en">English (en_US)</option>
                    <option value="si">සිංහල – Sinhala (si_LK)</option>
                    <option value="ta">தமிழ் – Tamil (ta)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Meta Category</label>
                  <select
                    value={tplCategory}
                    onChange={(e) => setTplCategory(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-[#00a884]"
                  >
                    <option value="UTILITY">UTILITY (Customer Service / Account Update)</option>
                    <option value="MARKETING">MARKETING (Promotions / Offers)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Template Body (Use {'{{1}}'}, {'{{2}}'} for variables) *
                  </label>
                  <span className="text-[10px] text-slate-400">{tplBody.length} characters</span>
                </div>
                <textarea
                  rows={4}
                  required
                  value={tplBody}
                  onChange={(e) => setTplBody(e.target.value)}
                  placeholder="Hi {{1}}, we are following up on your inquiry for {{2}} at Royal Wellness Center..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 font-sans outline-none focus:border-[#00a884] leading-relaxed resize-none"
                />
              </div>

              {/* Live Preview Box */}
              {tplBody.trim() && (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>Live WhatsApp Client Preview</span>
                    <span className="text-teal-600 dark:text-teal-400">Meta Preview</span>
                  </div>
                  <div className="p-3 bg-[#DCF8C6] dark:bg-[#005C4B] rounded-xl text-xs text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed shadow-2xs max-w-sm">
                    {tplBody}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setTplSubmitError(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTpl}
                  className="px-5 py-2 bg-[#00a884] hover:bg-[#00c298] text-slate-950 rounded-xl font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingTpl ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting to Meta...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Submit for Approval</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Quick Response */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-[#008069] dark:text-[#00a884] flex items-center justify-center">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {editingQr ? 'Edit Quick Response' : 'Create Quick Response (Client Message)'}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowQrModal(false);
                  setEditingQr(null);
                }} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQr} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={qrTitle}
                    onChange={(e) => setQrTitle(e.target.value)}
                    placeholder="e.g. 🌸 Welcome & Language Selection"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-[#00a884]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Shortcut (optional)
                  </label>
                  <input
                    type="text"
                    value={qrShortcut}
                    onChange={(e) => setQrShortcut(e.target.value)}
                    placeholder="e.g. welcome or gfc"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-[#00a884]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={qrCategory}
                    onChange={(e) => setQrCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-[#00a884]"
                  >
                    <option value="Welcome & Greeting">Welcome & Greeting</option>
                    <option value="Hair Treatments">Hair Treatments</option>
                    <option value="Skin Care & Laser">Skin Care & Laser</option>
                    <option value="Consultation & Clinic">Consultation & Clinic</option>
                    <option value="Pricing & Quotation">Pricing & Quotation</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Language
                  </label>
                  <select
                    value={qrLanguage}
                    onChange={(e) => setQrLanguage(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-[#00a884]"
                  >
                    <option value="multi">🌐 Multi-Language (Sinhala / Tamil / English)</option>
                    <option value="ta">தமிழ் – Tamil</option>
                    <option value="si">සිංහල – Sinhala</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Message Content *
                  </label>
                  <span className="text-[10px] text-slate-400">{qrContent.length} characters</span>
                </div>
                <textarea
                  rows={8}
                  required
                  value={qrContent}
                  onChange={(e) => setQrContent(e.target.value)}
                  placeholder="Paste or type the client message here. Emojis and line breaks are preserved exactly..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 font-sans outline-none focus:border-[#00a884] leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowQrModal(false);
                    setEditingQr(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00a884] hover:bg-[#00c298] text-slate-950 rounded-xl font-bold shadow-sm transition-colors cursor-pointer"
                >
                  {editingQr ? 'Update Response' : 'Save Quick Response'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Quick Response Confirmation */}
      {deletingQrId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Delete Quick Response?</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Are you sure you want to delete this quick response? This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingQrId(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteQr}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Template Confirmation */}
      {deletingTpl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Delete WhatsApp Template?</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  This will remove <strong className="text-slate-700 dark:text-slate-300">"{deletingTpl.name}"</strong> ({deletingTpl.waTemplateName}) from the CRM and delete it from Meta Cloud API.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTpl(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTpl}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-sm"
              >
                Yes, Delete Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
