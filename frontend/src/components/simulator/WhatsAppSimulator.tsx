import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  RotateCcw, 
  Phone, 
  Video, 
  MoreVertical, 
  Smile, 
  Paperclip, 
  Mic, 
  CheckCheck, 
  Sparkles,
  ChevronRight,
  List,
  MessageCircle,
  HelpCircle,
  ShieldAlert
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { LanguageCode } from '../../types';

export const WhatsAppSimulator: React.FC = () => {
  const {
    simulatorOpen,
    setSimulatorOpen,
    simulatorSession,
    resetSimulator,
    sendSimulatorMessage,
    selectSimulatorLanguage,
    selectSimulatorCategory,
    selectSimulatorTreatment,
    categories,
    treatments,
    messages,
    leads
  } = useCrm();

  const [inputVal, setInputVal] = useState('');
  const [activeListOpen, setActiveListOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Find lead associated with current simulator customer number
  const currentLead = leads.find(l => l.customer?.whatsappNumber === simulatorSession.waId);
  const currentMessages = currentLead 
    ? messages.filter(m => m.leadId === currentLead.id)
    : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simulatorSession, currentMessages]);

  if (!simulatorOpen) return null;

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim()) return;
    sendSimulatorMessage(inputVal);
    setInputVal('');
  };

  const selectedCategoryObj = categories.find(c => c.id === simulatorSession.selectedCategory);
  const categoryTreatments = treatments.filter(t => t.categoryId === simulatorSession.selectedCategory);

  const lang = simulatorSession.selectedLanguage || 'en';

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[380px] h-[640px] bg-slate-900 border-2 border-emerald-500/40 rounded-3xl shadow-2xl shadow-emerald-950/80 flex flex-col overflow-hidden animate-slide-up">
      {/* Device Top Speaker & Camera Notch */}
      <div className="bg-slate-950 h-5 w-full flex items-center justify-center relative shrink-0">
        <div className="w-16 h-3 bg-slate-900 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-slate-800 mr-2"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-teal-900/80"></div>
        </div>
      </div>

      {/* WhatsApp Header Bar */}
      <div className="bg-whatsapp-teal px-3 py-2.5 text-white flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-white p-0.5 flex items-center justify-center shadow overflow-hidden">
              <img src="/logo.png" alt="Royal Wellness" className="w-full h-full object-contain" />
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white absolute bottom-0 right-0"></span>
          </div>
          <div>
            <h3 className="font-semibold text-xs leading-tight">Royal Wellness Center</h3>
            <p className="text-[10px] text-teal-100/90 flex items-center gap-1">
              <span>Official WhatsApp Business</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-white/90">
          <button 
            onClick={resetSimulator} 
            title="Reset Customer Onboarding Session"
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setSimulatorOpen(false)} 
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Client Profile Pill (Simulated Customer Info) */}
      <div className="bg-slate-950/90 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Simulator: <strong className="text-white">{simulatorSession.name}</strong></span>
        </div>
        <span className="font-mono text-[10px] text-emerald-400">{simulatorSession.waId}</span>
      </div>

      {/* WhatsApp Conversation Area */}
      <div className="flex-1 wa-sim-bg p-3 overflow-y-auto space-y-3 text-xs text-slate-800">
        {/* Encryption notice banner */}
        <div className="bg-[#FFEECD] text-[#6E5621] text-[10px] p-2 rounded-lg text-center shadow-sm mx-2">
          🔒 Messages and calls are end-to-end encrypted. Verified Royal Wellness Concierge.
        </div>

        {/* STEP 1: INITIAL GREETING & LANGUAGE SELECTION (Interactive Buttons) */}
        <div className="flex flex-col items-start max-w-[85%]">
          <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm space-y-2 border border-slate-200">
            <p className="font-medium text-slate-900 leading-relaxed">
              Welcome to Royal Wellness Center 👋<br />
              Please select your preferred language:<br />
              <span className="text-slate-600 font-normal">කරුණාකර ඔබගේ භාෂාව තෝරන්න / மொழியைத் தேர்ந்தெடுக்கவும்</span>
            </p>
            <div className="pt-1 text-[9px] text-slate-400 text-right">09:00 AM</div>
          </div>

          {/* Interactive Language Buttons */}
          <div className="w-full mt-1.5 space-y-1">
            <button
              onClick={() => selectSimulatorLanguage('en')}
              disabled={simulatorSession.state !== 'AwaitingLanguage'}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                simulatorSession.selectedLanguage === 'en'
                  ? 'bg-whatsapp-deep text-white shadow-md'
                  : 'bg-white/90 text-teal-800 hover:bg-white border border-teal-200 shadow-sm'
              }`}
            >
              🇬🇧 English
            </button>
            <button
              onClick={() => selectSimulatorLanguage('si')}
              disabled={simulatorSession.state !== 'AwaitingLanguage'}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                simulatorSession.selectedLanguage === 'si'
                  ? 'bg-whatsapp-deep text-white shadow-md'
                  : 'bg-white/90 text-teal-800 hover:bg-white border border-teal-200 shadow-sm'
              }`}
            >
              🇱🇰 සිංහල (Sinhala)
            </button>
            <button
              onClick={() => selectSimulatorLanguage('ta')}
              disabled={simulatorSession.state !== 'AwaitingLanguage'}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                simulatorSession.selectedLanguage === 'ta'
                  ? 'bg-whatsapp-deep text-white shadow-md'
                  : 'bg-white/90 text-teal-800 hover:bg-white border border-teal-200 shadow-sm'
              }`}
            >
              🇱🇰 தமிழ் (Tamil)
            </button>
          </div>
        </div>

        {/* STEP 2: CATEGORY SELECTION (Interactive List Message) */}
        {simulatorSession.selectedLanguage && (
          <div className="flex flex-col items-start max-w-[85%] animate-fade-in">
            <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm space-y-2 border border-slate-200 w-full">
              <p className="font-medium text-slate-900 leading-relaxed">
                {lang === 'si'
                  ? 'ස්තූතියි! කරුණාකර ඔබ උනන්දු වන ප්‍රතිකාර අංශය තෝරන්න:'
                  : lang === 'ta'
                  ? 'நன்றி! நீங்கள் விரும்பும் சிகிச்சை பிரிவை தேர்ந்தெடுக்கவும்:'
                  : 'Thank you! Please select your treatment category of interest:'}
              </p>
              
              {/* WhatsApp List Message Button */}
              <button
                onClick={() => setActiveListOpen(!activeListOpen)}
                disabled={simulatorSession.state !== 'AwaitingCategory'}
                className="w-full py-2 px-3 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 rounded-lg font-semibold flex items-center justify-between text-xs transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <List className="w-3.5 h-3.5 text-teal-700" />
                  {simulatorSession.selectedCategory 
                    ? categories.find(c => c.id === simulatorSession.selectedCategory)?.name 
                    : '📋 View Treatment Categories'}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-teal-700" />
              </button>

              {/* Collapsible Categories List */}
              {activeListOpen && simulatorSession.state === 'AwaitingCategory' && (
                <div className="bg-white border border-slate-200 rounded-lg p-1.5 space-y-1 shadow-inner max-h-48 overflow-y-auto">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        selectSimulatorCategory(cat.id);
                        setActiveListOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-teal-50 text-xs text-slate-800 flex items-center justify-between group transition-colors"
                    >
                      <div>
                        <p className="font-semibold group-hover:text-teal-900">{cat.nameI18n[lang] || cat.name}</p>
                        <p className="text-[10px] text-slate-500 line-clamp-1">{cat.description}</p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-teal-700" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: SPECIFIC SERVICE SELECTION */}
        {simulatorSession.selectedCategory && (
          <div className="flex flex-col items-start max-w-[85%] animate-fade-in">
            <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm space-y-2 border border-slate-200 w-full">
              <p className="font-medium text-slate-900 leading-relaxed">
                {lang === 'si'
                  ? `තෝරාගත් අංශය: ${selectedCategoryObj?.nameI18n.si}. කරුණාකර විශේෂිත ප්‍රතිකාරය තෝරන්න:`
                  : lang === 'ta'
                  ? `பிரிவு: ${selectedCategoryObj?.nameI18n.ta}. சிகிச்சையை தேர்ந்தெடுக்கவும்:`
                  : `Selected: ${selectedCategoryObj?.name}. Please choose your specific treatment:`}
              </p>

              <div className="space-y-1 pt-1">
                {categoryTreatments.map((trt) => (
                  <button
                    key={trt.id}
                    onClick={() => selectSimulatorTreatment(trt.id)}
                    disabled={simulatorSession.state !== 'AwaitingService'}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-all border ${
                      simulatorSession.selectedTreatment === trt.id
                        ? 'bg-whatsapp-deep text-white border-whatsapp-deep'
                        : 'bg-slate-50 hover:bg-teal-50 text-slate-800 border-slate-200 hover:border-teal-300'
                    }`}
                  >
                    <div className="font-semibold">{trt.nameI18n[lang] || trt.name}</div>
                    {trt.priceRange && (
                      <div className={`text-[10px] ${simulatorSession.selectedTreatment === trt.id ? 'text-teal-100' : 'text-slate-500'}`}>
                        {trt.priceRange} ({trt.duration})
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: POST-ONBOARDING LIVE CHAT MESSAGES */}
        {currentMessages.map((msg) => {
          const isOutbound = msg.direction === 'outbound';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isOutbound ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`max-w-[85%] p-2.5 rounded-xl text-xs shadow-sm ${
                  isOutbound
                    ? 'bg-white text-slate-900 rounded-tl-none border border-slate-200'
                    : 'bg-[#d9fdd3] text-slate-900 rounded-tr-none'
                }`}
              >
                {msg.senderType === 'system' && (
                  <div className="text-[10px] font-bold text-teal-800 mb-0.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-teal-600" /> Royal Wellness Automated System
                  </div>
                )}
                {msg.senderType === 'coordinator' && (
                  <div className="text-[10px] font-bold text-teal-800 mb-0.5">
                    Royal Wellness Coordinator
                  </div>
                )}
                <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-400">
                  <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {!isOutbound && <CheckCheck className="w-3.5 h-3.5 text-sky-500" />}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* AI Intent Hint Pill */}
      {simulatorSession.state !== 'LeadCreated' && (
        <div className="bg-slate-900/95 px-3 py-1 border-t border-slate-800 text-[10px] text-teal-300 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-gold-400" /> Free text works too (AI Intent Detection)
          </span>
          <span className="text-slate-400">Type in EN / SI / TA</span>
        </div>
      )}

      {/* WhatsApp Message Input Bar */}
      <form onSubmit={handleSend} className="bg-slate-950 p-2.5 flex items-center gap-2 shrink-0 border-t border-slate-800">
        <div className="flex-1 bg-slate-900 rounded-full px-3 py-1.5 flex items-center gap-2 border border-slate-700 focus-within:border-emerald-500">
          <Smile className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={
              simulatorSession.state === 'LeadCreated'
                ? 'Type reply as customer...'
                : 'Type message or free-text inquiry...'
            }
            className="bg-transparent text-xs text-slate-100 placeholder-slate-500 outline-none w-full"
          />
          <Paperclip className="w-4 h-4 text-slate-400 shrink-0 cursor-pointer" />
        </div>
        <button
          type="submit"
          className="w-8 h-8 rounded-full bg-whatsapp hover:bg-emerald-400 text-slate-950 flex items-center justify-center shrink-0 transition-colors shadow-md"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
