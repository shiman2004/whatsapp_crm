import React, { useState } from 'react';
import { 
  X, 
  UserPlus, 
  Phone, 
  User, 
  Sparkles, 
  Globe, 
  MessageSquare, 
  Send, 
  Check, 
  Loader2,
  Users,
  Building2,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { CompanyCode } from '../../types';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddContactModal: React.FC<AddContactModalProps> = ({ isOpen, onClose }) => {
  const { 
    addNewContact, 
    categories, 
    treatments, 
    users, 
    isSuperAdmin, 
    isLeadsOfficer,
    currentUser,
    templates
  } = useCrm();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState<CompanyCode>('RWC');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-hair-care');
  const [treatmentId, setTreatmentId] = useState(treatments[0]?.id || 'trt-hair-prp');
  const [language, setLanguage] = useState<'en' | 'si' | 'ta'>('en');
  const [assignedTo, setAssignedTo] = useState<string>(isSuperAdmin || isLeadsOfficer ? '' : currentUser.id);
  const [initialMessage, setInitialMessage] = useState('');
  const [sendInitial, setSendInitial] = useState(false);
  const [messageType, setMessageType] = useState<'template' | 'custom'>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCompanyChange = (newComp: CompanyCode) => {
    setCompany(newComp);
    if (newComp === 'CRAS') {
      const crasCat = categories.find(c => c.id === 'cat-cras-courses' || c.name.toLowerCase().includes('cras') || c.name.toLowerCase().includes('course'));
      if (crasCat) {
        setCategoryId(crasCat.id);
        const firstTrt = treatments.find(t => t.categoryId === crasCat.id);
        if (firstTrt) setTreatmentId(firstTrt.id);
      }
      if (sendInitial || initialMessage.includes('Royal Wellness')) {
        setInitialMessage('Hi, thank you for reaching out to College of Royal Aesthetic of Sri Lanka (CRAS)! How can we assist you today?');
      }
    } else {
      const rwcCat = categories.find(c => c.id !== 'cat-cras-courses' && !c.name.toLowerCase().includes('cras')) || categories[0];
      if (rwcCat) {
        setCategoryId(rwcCat.id);
        const firstTrt = treatments.find(t => t.categoryId === rwcCat.id);
        if (firstTrt) setTreatmentId(firstTrt.id);
      }
      if (sendInitial || initialMessage.includes('College of Royal Aesthetic')) {
        setInitialMessage('Hi, thank you for reaching out to Royal Wellness Center! How can we assist you today?');
      }
    }
  };

  const filteredCategories = categories.filter(c => {
    if (company === 'CRAS') {
      return c.id === 'cat-cras-courses' || c.name.toLowerCase().includes('cras') || c.name.toLowerCase().includes('course');
    }
    return c.id !== 'cat-cras-courses' && !c.name.toLowerCase().includes('cras');
  });

  const availableCategories = filteredCategories.length > 0 ? filteredCategories : categories;

  const filteredTreatments = treatments.filter(t => {
    if (categoryId) return t.categoryId === categoryId;
    if (company === 'CRAS') return (t as any).company === 'CRAS' || t.categoryId === 'cat-cras-courses';
    return (t as any).company !== 'CRAS' && t.categoryId !== 'cat-cras-courses';
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanDigits = phone.replace(/[^0-9]/g, '');
    if (!cleanDigits || cleanDigits.length < 8) {
      setError('Please enter a valid WhatsApp phone number (e.g. +94 77 123 4567 or 0771234567).');
      return;
    }

    setLoading(true);
    try {
      let tplName: string | undefined = undefined;
      let tplParams: string[] | undefined = undefined;
      let customMsg: string | undefined = undefined;

      if (sendInitial) {
        if (messageType === 'template') {
          const tpl = templates.find(t => t.id === selectedTemplateId) || templates[0];
          tplName = tpl?.waTemplateName || tpl?.name || 'royal_wellness_inquiry_reply';
          const selectedTrt = filteredTreatments.find(t => t.id === treatmentId) || treatments.find(t => t.id === treatmentId);
          const treatmentName = selectedTrt?.name || (company === 'CRAS' ? 'Course Inquiry' : 'Consultation');
          const clientName = name.trim() || 'Valued Customer';
          tplParams = [clientName, treatmentName];
        } else if (initialMessage.trim()) {
          customMsg = initialMessage.trim();
        }
      }

      const res = await addNewContact({
        name: name.trim(),
        phone: phone.trim(),
        company,
        categoryId,
        treatmentId,
        language,
        assignedTo: assignedTo || undefined,
        initialMessage: customMsg,
        templateName: tplName,
        templateParams: tplParams
      });

      if (res.success) {
        onClose();
        setName('');
        setPhone('');
        setCompany('RWC');
        setInitialMessage('');
        setSendInitial(false);
      } else {
        setError(res.error || 'Failed to save contact.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-[#1f2c34] border border-[#31424d] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#2a3942] flex items-center justify-between border-b border-[#31424d] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00a884]/20 text-[#00a884] flex items-center justify-center border border-[#00a884]/30">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#e9edef] leading-tight">Add New WhatsApp Contact</h2>
              <p className="text-xs text-[#8696a0]">Create lead in CRM and sync to Supabase</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8696a0] hover:text-[#e9edef] hover:bg-[#374248] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Contact Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#aebac1] mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#00a884]" />
                <span>Contact Name</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kasun Bandara"
                className="w-full bg-[#111b21] border border-[#31424d] rounded-xl px-3.5 py-2.5 text-xs text-[#d1d7db] placeholder-[#667781] outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#aebac1] mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#00a884]" />
                <span>WhatsApp Number <span className="text-rose-400">*</span></span>
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="077 123 4567 or +9477..."
                className="w-full bg-[#111b21] border border-[#31424d] rounded-xl px-3.5 py-2.5 text-xs text-[#d1d7db] placeholder-[#667781] outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all font-mono"
              />
            </div>
          </div>

          {/* Company Selection: CRAS and RWC */}
          <div>
            <label className="block text-xs font-semibold text-[#aebac1] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#00a884]" />
                <span>Company</span>
                <span className="text-rose-400">*</span>
              </span>
              <span className="text-[11px] font-normal text-[#8696a0]">
                {company === 'CRAS' ? 'College of Royal Aesthetic of Sri Lanka' : 'Royal Wellness Center'}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2 bg-[#111b21] p-1.5 rounded-xl border border-[#31424d]">
              <button
                type="button"
                onClick={() => handleCompanyChange('RWC')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  company === 'RWC'
                    ? 'bg-[#008000] text-white shadow-md shadow-[#008000]/30 ring-1 ring-emerald-300'
                    : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${company === 'RWC' ? 'bg-white' : 'bg-[#008000]'}`} />
                <span>RWC</span>
              </button>
              <button
                type="button"
                onClick={() => handleCompanyChange('CRAS')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  company === 'CRAS'
                    ? 'bg-[#800000] text-white shadow-md shadow-[#800000]/40 ring-1 ring-rose-400'
                    : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${company === 'CRAS' ? 'bg-white' : 'bg-[#800000]'}`} />
                <span>CRAS</span>
              </button>
            </div>
          </div>

          {/* Category & Treatment Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#aebac1] mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00a884]" />
                <span>{company === 'CRAS' ? 'Academic Program' : 'Treatment Category'}</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  const firstMatch = filteredTreatments.find(t => t.categoryId === e.target.value) || treatments.find(t => t.categoryId === e.target.value);
                  if (firstMatch) setTreatmentId(firstMatch.id);
                }}
                className="w-full bg-[#111b21] border border-[#31424d] rounded-xl px-3 py-2 text-xs text-[#d1d7db] outline-none focus:border-[#00a884] transition-all cursor-pointer"
              >
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#111b21] text-[#d1d7db]">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#aebac1] mb-1.5">
                <span>{company === 'CRAS' ? 'Specific Course' : 'Specific Treatment'}</span>
              </label>
              <select
                value={treatmentId}
                onChange={(e) => setTreatmentId(e.target.value)}
                className="w-full bg-[#111b21] border border-[#31424d] rounded-xl px-3 py-2 text-xs text-[#d1d7db] outline-none focus:border-[#00a884] transition-all cursor-pointer"
              >
                {filteredTreatments.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#111b21] text-[#d1d7db]">
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Language & Coordinator Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#aebac1] mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#00a884]" />
                <span>Preferred Language</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-[#111b21] p-1 rounded-xl border border-[#31424d]">
                {[
                  { code: 'en' as const, label: 'English' },
                  { code: 'si' as const, label: 'සිංහල' },
                  { code: 'ta' as const, label: 'தமிழ்' }
                ].map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLanguage(l.code)}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      language === l.code
                        ? 'bg-[#00a884] text-black shadow'
                        : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {(isSuperAdmin || isLeadsOfficer) && (
              <div>
                <label className="block text-xs font-semibold text-[#aebac1] mb-1.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#00a884]" />
                  <span>Assign Coordinator</span>
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#31424d] rounded-xl px-3 py-2 text-xs text-[#d1d7db] outline-none focus:border-[#00a884] transition-all cursor-pointer"
                >
                  <option value="" className="bg-[#111b21] text-[#8696a0]">
                    -- Unassigned (Pool) --
                  </option>
                  {users.filter(u => u.role === 'coordinator').map((u) => (
                    <option key={u.id} value={u.id} className="bg-[#111b21] text-[#d1d7db]">
                      {u.fullName} {u.company ? `(${u.company})` : ''} {u.branch ? `(${u.branch})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Optional Initial Message & 24h Window Compliance */}
          <div className="pt-2 border-t border-[#31424d]/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#aebac1] flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendInitial}
                  onChange={(e) => {
                    setSendInitial(e.target.checked);
                    if (e.target.checked && !selectedTemplateId && templates.length > 0) {
                      setSelectedTemplateId(templates[0].id);
                    }
                  }}
                  className="rounded border-[#31424d] text-[#00a884] focus:ring-[#00a884] w-3.5 h-3.5 accent-[#00a884]"
                />
                <MessageSquare className="w-3.5 h-3.5 text-[#00a884]" />
                <span>Send Welcome Message on WhatsApp</span>
              </label>
            </div>

            {sendInitial && (
              <div className="space-y-3 bg-[#111b21] p-3 rounded-xl border border-[#31424d]">
                {/* Method selector: Template vs Custom */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#1f2c34] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setMessageType('template')}
                    className={`py-1.5 px-2.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all ${
                      messageType === 'template'
                        ? 'bg-[#00a884] text-black shadow'
                        : 'text-[#8696a0] hover:text-[#e9edef]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Approved Template</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageType('custom')}
                    className={`py-1.5 px-2.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all ${
                      messageType === 'custom'
                        ? 'bg-[#00a884] text-black shadow'
                        : 'text-[#8696a0] hover:text-[#e9edef]'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Free-form Text</span>
                  </button>
                </div>

                {messageType === 'template' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-[#8696a0]">Select Template:</label>
                      <span className="text-[10px] text-[#00a884] flex items-center gap-1 font-semibold">
                        <ShieldCheck className="w-3 h-3" />
                        Bypasses 24h Window
                      </span>
                    </div>
                    <select
                      value={selectedTemplateId || (templates[0]?.id || '')}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full bg-[#1f2c34] border border-[#31424d] rounded-lg px-2.5 py-2 text-xs text-[#d1d7db] outline-none focus:border-[#00a884] cursor-pointer"
                    >
                      {templates.map(t => (
                        <option key={t.id} value={t.id} className="bg-[#1f2c34] text-[#d1d7db]">
                          {t.name} ({t.category || 'UTILITY'})
                        </option>
                      ))}
                    </select>

                    {/* Template preview */}
                    {(() => {
                      const curTpl = templates.find(t => t.id === selectedTemplateId) || templates[0];
                      const selectedTrt = filteredTreatments.find(t => t.id === treatmentId) || treatments.find(t => t.id === treatmentId);
                      const trtName = selectedTrt?.name || (company === 'CRAS' ? 'Course Inquiry' : 'Clinical Treatment');
                      const custName = name.trim() || 'Client';
                      let previewBody = curTpl?.body || 'Hi {{1}}, thank you for inquiring about {{2}}. Our coordinator is ready to assist you.';
                      previewBody = previewBody.replace(/\{\{1\}\}/g, custName).replace(/\{\{2\}\}/g, trtName);

                      return (
                        <div className="p-2.5 rounded-lg bg-[#1f2c34]/80 border border-[#31424d] text-xs text-[#d1d7db] font-sans leading-relaxed">
                          <p className="text-[10px] uppercase font-bold text-[#8696a0] mb-1">Preview Message:</p>
                          <p className="italic text-[#e9edef] whitespace-pre-wrap">{previewBody}</p>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      placeholder="Type your message to send immediately..."
                      className="w-full bg-[#1f2c34] border border-[#31424d] rounded-lg p-2.5 text-xs text-[#d1d7db] placeholder-[#667781] outline-none focus:border-[#00a884] transition-all resize-none"
                    />
                    <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/40 flex items-start gap-2 text-amber-300 text-[11px] leading-snug">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                      <span>
                        <strong>WhatsApp 24h Window Rule:</strong> If this customer hasn't messaged within the last 24 hours, Meta Cloud API will reject free-form messages with <strong>Code 131047</strong>. Use an Approved Template above to guarantee delivery.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#31424d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-[#00a884] hover:bg-[#00c298] text-black font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg hover:shadow-[#00a884]/20 transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving to Supabase...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Save Contact & Start Chat</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
