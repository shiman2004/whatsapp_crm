import React, { useState, useMemo } from 'react';
import { 
  Zap, 
  Search, 
  X, 
  Send, 
  Copy, 
  Check, 
  Plus, 
  Sparkles, 
  FileText, 
  ArrowUpRight, 
  Globe 
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { QuickResponse } from '../../types';

interface QuickResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (content: string, sendDirectly?: boolean) => void;
  leadId?: string;
  leadName?: string;
}

export const QuickResponseModal: React.FC<QuickResponseModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  leadName
}) => {
  const { quickResponses, addQuickResponse } = useCrm();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLang, setSelectedLang] = useState<'all' | 'ta' | 'si' | 'en' | 'multi'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Quick form for inline creation
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Welcome & Greeting');
  const [newLanguage, setNewLanguage] = useState<'ta' | 'si' | 'en' | 'multi'>('ta');
  const [newShortcut, setNewShortcut] = useState('');
  const [newContent, setNewContent] = useState('');

  const filteredResponses = useMemo(() => {
    return quickResponses.filter((qr) => {
      const matchesSearch = 
        !searchQuery.trim() ||
        qr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        qr.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (qr.shortcut && qr.shortcut.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (qr.category && qr.category.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesLang = 
        selectedLang === 'all' || 
        qr.language === selectedLang ||
        (selectedLang === 'multi' && qr.language === 'multi');

      return matchesSearch && matchesLang;
    });
  }, [quickResponses, searchQuery, selectedLang]);

  const handleCopy = (qr: QuickResponse) => {
    navigator.clipboard.writeText(qr.content);
    setCopiedId(qr.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    await addQuickResponse({
      title: newTitle.trim(),
      category: newCategory.trim(),
      language: newLanguage,
      shortcut: newShortcut.trim(),
      content: newContent.trim()
    });

    setNewTitle('');
    setNewShortcut('');
    setNewContent('');
    setShowAddForm(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-[#008069] dark:text-[#00a884] flex items-center justify-center">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#e9edef]">
                  Quick Responses
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                  Direct Client Messages
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#8696a0] mt-0.5">
                Ready-to-send messages {leadName ? `for ${leadName}` : 'to send clients'} without requiring Meta template approval
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'View List' : 'Add New'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#2a3942] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {showAddForm ? (
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Create New Quick Response
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Saved messages will be available to all coordinators in chat and in Templates & Nurture.
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. 🌸 Welcome & Language Selection"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-[#00a884]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Shortcut (optional)</label>
                  <input
                    type="text"
                    value={newShortcut}
                    onChange={(e) => setNewShortcut(e.target.value)}
                    placeholder="e.g. welcome or gfc"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-[#00a884]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-[#00a884]"
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
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Language</label>
                  <select
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-[#00a884]"
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
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Message Content *</label>
                  <span className="text-[10px] text-slate-400">{newContent.length} characters</span>
                </div>
                <textarea
                  required
                  rows={6}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Paste or type the client message here. Emojis and line breaks are preserved exactly..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-sans text-xs focus:outline-hidden focus:border-[#00a884] leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-[#202c33] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#00c298] text-slate-950 font-bold text-xs transition-colors cursor-pointer shadow-sm"
                >
                  Save Quick Response
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Search and Filters Bar */}
            <div className="px-5 py-3 bg-slate-50/60 dark:bg-[#182229] border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Search input */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search quick responses by keyword, title, or shortcut..."
                  className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-[#00a884]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Language Filter Pills */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#202c33] p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedLang('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    selectedLang === 'all'
                      ? 'bg-[#00a884] text-slate-950'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All ({quickResponses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLang('multi')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    selectedLang === 'multi'
                      ? 'bg-[#00a884] text-slate-950'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  🌐 Multi-Lang
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLang('ta')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    selectedLang === 'ta'
                      ? 'bg-[#00a884] text-slate-950'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  தமிழ் (Tamil)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLang('si')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    selectedLang === 'si'
                      ? 'bg-[#00a884] text-slate-950'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  සිංහල (Sinhala)
                </button>
              </div>
            </div>

            {/* List of Quick Responses */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
              {filteredResponses.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <FileText className="w-10 h-10 mx-auto text-slate-400 opacity-60" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No quick responses found
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Try adjusting your search terms or click "Add New" to create a response.
                  </p>
                </div>
              ) : (
                filteredResponses.map((qr) => {
                  const isCopied = copiedId === qr.id;
                  return (
                    <div
                      key={qr.id}
                      className="bg-slate-50 dark:bg-[#182229] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 hover:border-teal-500/40 dark:hover:border-teal-500/40 transition-all shadow-xs"
                    >
                      {/* Top Row: Title, Badges, and Action Buttons */}
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2.5">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight truncate">
                              {qr.title}
                            </h4>
                            {qr.shortcut && (
                              <span className="px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                /{qr.shortcut}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {qr.category && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800/80 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                                {qr.category}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-400 text-[10px] font-bold uppercase">
                              {qr.language === 'multi' ? '🌐 Multi-Lang' : qr.language?.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Copy button */}
                          <button
                            type="button"
                            onClick={() => handleCopy(qr)}
                            className={`px-2.5 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-slate-200 dark:bg-[#202c33] hover:bg-slate-300 dark:hover:bg-[#2a3942] text-slate-700 dark:text-[#d1d7db]'
                            }`}
                            title="Copy to clipboard"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                          </button>

                          {/* Insert button */}
                          <button
                            type="button"
                            onClick={() => {
                              onSelect(qr.content, false);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-[#202c33] hover:bg-slate-300 dark:hover:bg-[#2a3942] text-slate-800 dark:text-[#e9edef] font-semibold text-xs transition-colors cursor-pointer"
                            title="Insert text into message box"
                          >
                            Insert
                          </button>

                          {/* Send directly button */}
                          <button
                            type="button"
                            onClick={() => {
                              onSelect(qr.content, true);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#00a884] hover:bg-[#00c298] text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
                            title="Send immediately to client"
                          >
                            <Send className="w-3 h-3 fill-current" />
                            <span>Send Now</span>
                          </button>
                        </div>
                      </div>

                      {/* Message Content Preview with exact line breaks & emojis */}
                      <div className="bg-white dark:bg-[#111b21] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs text-slate-800 dark:text-[#d1d7db] leading-relaxed font-sans whitespace-pre-wrap select-all max-h-48 overflow-y-auto">
                        {qr.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-[#202c33] border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs text-slate-500 dark:text-[#8696a0] shrink-0">
          <span>
            {quickResponses.length} total quick response{quickResponses.length !== 1 ? 's' : ''} available
          </span>
          <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
            💡 Full add, edit, and delete options available under <strong>Templates & Nurture</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
