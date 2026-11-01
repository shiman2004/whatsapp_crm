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
  AlertTriangle
} from 'lucide-react';

export const TemplatesManager: React.FC = () => {
  const { 
    templates, 
    sequences, 
    categories, 
    addTemplate,
    quickResponses,
    addQuickResponse,
    updateQuickResponse,
    deleteQuickResponse
  } = useCrm();

  const [activeSubTab, setActiveSubTab] = useState<'templates' | 'quick-responses' | 'sequences'>('quick-responses');
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedTplId, setCopiedTplId] = useState<string | null>(null);

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
  const [tplLang, setTplLang] = useState<'en' | 'si' | 'ta'>('en');
  const [tplCategory, setTplCategory] = useState<'UTILITY' | 'MARKETING'>('UTILITY');
  const [tplBody, setTplBody] = useState('');

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim() || !tplBody.trim()) return;

    addTemplate({
      name: tplName.trim(),
      language: tplLang,
      waTemplateName: tplName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_v1',
      body: tplBody.trim(),
      variables: ['Customer Name', 'Treatment Name'],
      approved: true, // auto-approved in simulation
      category: tplCategory,
    });

    setTplName('');
    setTplBody('');
    setShowAddModal(false);
  };

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
              onClick={() => setShowAddModal(true)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((tpl) => {
            const isCopied = copiedTplId === tpl.id;
            return (
              <div
                key={tpl.id}
                className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Header: Name, Language & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">{tpl.name}</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        Meta ID: {tpl.waTemplateName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {tpl.language.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> APPROVED
                      </span>
                    </div>
                  </div>

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
                      Ready to Paste into WhatsApp
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Draft WhatsApp Template (Meta Graph API)</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="e.g. Laser Consultation Reminder"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Language</label>
                  <select
                    value={tplLang}
                    onChange={(e) => setTplLang(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500"
                  >
                    <option value="en">English (en)</option>
                    <option value="si">Sinhala (si)</option>
                    <option value="ta">Tamil (ta)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Meta Category</label>
                  <select
                    value={tplCategory}
                    onChange={(e) => setTplCategory(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500"
                  >
                    <option value="UTILITY">UTILITY (Customer Service)</option>
                    <option value="MARKETING">MARKETING (Promotions)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Template Body (Use {'{{1}}'}, {'{{2}}'} for variables)
                </label>
                <textarea
                  rows={4}
                  required
                  value={tplBody}
                  onChange={(e) => setTplBody(e.target.value)}
                  placeholder="Hi {{1}}, we are following up on your inquiry for {{2}} at Royal Wellness Center..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold shadow cursor-pointer"
                >
                  Submit for Approval
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

      {/* Modal: Delete Confirmation */}
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
                  This will remove the message from all coordinators' chat lists.
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
    </div>
  );
};
