import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { WhatsAppTemplate, FollowupSequence } from '../../types';
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
  Check
} from 'lucide-react';

export const TemplatesManager: React.FC = () => {
  const { templates, sequences, categories, addTemplate } = useCrm();

  const [activeSubTab, setActiveSubTab] = useState<'templates' | 'sequences'>('templates');
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedTplId, setCopiedTplId] = useState<string | null>(null);

  const handleCopy = (tpl: WhatsAppTemplate) => {
    navigator.clipboard.writeText(tpl.body);
    setCopiedTplId(tpl.id);
    setTimeout(() => setCopiedTplId(null), 2500);
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

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 font-serif">
            WhatsApp Templates & Follow-Up Sequences
          </h2>
          <p className="text-xs text-slate-400">
            Meta Cloud API template compliance, 24h window re-engagement, and BullMQ Day 1/3/5/7 sequences
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Subtab Toggle */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center">
            <button
              onClick={() => setActiveSubTab('templates')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'templates'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Templates ({templates.length})
            </button>
            <button
              onClick={() => setActiveSubTab('sequences')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'sequences'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Follow-Up Sequences ({sequences.length})
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Create Template</span>
          </button>
        </div>
      </div>

      {/* TEMPLATES SUB-TAB */}
      {activeSubTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((tpl) => {
            const isCopied = copiedTplId === tpl.id;
            return (
              <div
                key={tpl.id}
                className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Header: Name, Language & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-100 tracking-tight">{tpl.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Meta ID: {tpl.waTemplateName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        {tpl.language.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> APPROVED
                      </span>
                    </div>
                  </div>

                  {/* Body with exact pre-wrapped emojis & line breaks */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs sm:text-sm text-slate-100 leading-relaxed font-sans whitespace-pre-wrap select-all max-h-64 overflow-y-auto">
                    {tpl.body}
                  </div>
                </div>

                {/* Copy Button & Category Footer */}
                <div className="pt-2 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleCopy(tpl)}
                    className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98 ${
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

                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span className="text-[10px] font-semibold text-slate-500">
                      Category: {tpl.category}
                    </span>
                    <span className="text-[10px] text-teal-400 font-medium">
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
                className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-lg"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-gold-400" />
                      {seq.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Target Specialty: <strong className="text-teal-400">{category?.name}</strong>
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
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
                        className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-teal-300 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-teal-400" /> Day +{st.dayOffset}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">Step #{idx + 1}</span>
                        </div>
                        <p className="font-semibold text-slate-200 text-xs">{st.label}</p>
                        <p className="text-[10px] text-slate-400 line-clamp-2 italic">
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

      {/* Modal: Create Template */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">Draft WhatsApp Template (Meta Graph API)</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="e.g. Laser Consultation Reminder"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Language</label>
                  <select
                    value={tplLang}
                    onChange={(e) => setTplLang(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-teal-500"
                  >
                    <option value="en">English (en)</option>
                    <option value="si">Sinhala (si)</option>
                    <option value="ta">Tamil (ta)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Meta Category</label>
                  <select
                    value={tplCategory}
                    onChange={(e) => setTplCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-teal-500"
                  >
                    <option value="UTILITY">UTILITY (Customer Service)</option>
                    <option value="MARKETING">MARKETING (Promotions)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Template Body (Use {'{{1}}'}, {'{{2}}'} for variables)
                </label>
                <textarea
                  rows={4}
                  required
                  value={tplBody}
                  onChange={(e) => setTplBody(e.target.value)}
                  placeholder="Hi {{1}}, we are following up on your inquiry for {{2}} at Royal Wellness Center..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold shadow"
                >
                  Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
