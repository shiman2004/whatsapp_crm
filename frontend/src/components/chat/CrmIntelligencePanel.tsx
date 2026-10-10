import React, { useState, useRef, useEffect } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Lead, LeadStage, Treatment } from '../../types';
import { NotesTab } from './NotesTab';
import { FollowupsTab } from './FollowupsTab';
import { StageHistoryTab } from './StageHistoryTab';
import { 
  FileText, 
  Calendar, 
  History, 
  UserCheck, 
  ChevronDown, 
  Phone, 
  ExternalLink,
  X,
  User,
  Edit2,
  Check,
  Copy,
  Search,
  RotateCw,
  Globe,
  Building2
} from 'lucide-react';
import { CompanyTagBadge } from '../common/CompanyTagBadge';

import { 
  formatWhatsAppDisplay, 
  normalizeWhatsAppNumber, 
  getCleanWhatsAppDigits,
  isHardwareLid 
} from '../../utils/phoneUtils';

interface CrmIntelligencePanelProps {
  lead: Lead;
  onClose?: () => void;
}

export const CrmIntelligencePanel: React.FC<CrmIntelligencePanelProps> = ({ lead, onClose }) => {
  const { 
    users, 
    leads,
    treatments,
    canAssignLeads, 
    assignLead, 
    updateLeadStage,
    updateLeadTreatment,
    updateLeadLanguage,
    updateLeadCompany,
    updateCustomer
  } = useCrm();

  const [activeTab, setActiveTab] = useState<'notes' | 'followups' | 'history'>('notes');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phoneInput, setPhoneInput] = useState(lead.customer?.whatsappNumber || '');
  const [nameInput, setNameInput] = useState(lead.customer?.displayName || '');

  // Current lead language
  const currentLang = lead.language || lead.customer?.preferredLanguage || 'en';

  // Keep local inputs in sync with lead changes when not actively editing
  useEffect(() => {
    if (!isEditingPhone) {
      setPhoneInput(lead.customer?.whatsappNumber || '');
    }
  }, [lead.customer?.whatsappNumber, isEditingPhone]);

  useEffect(() => {
    if (!isEditingName) {
      setNameInput(lead.customer?.displayName || '');
    }
  }, [lead.customer?.displayName, isEditingName]);

  // Treatment & Serial state
  const [treatmentDropdownOpen, setTreatmentDropdownOpen] = useState(false);
  const [treatmentSearchQuery, setTreatmentSearchQuery] = useState('');
  const [isRegeneratingSerial, setIsRegeneratingSerial] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const coordinator = users.find(u => u.id === lead.assignedTo);
  const coordinators = users.filter(u => u.role === 'coordinator');

  const rawPhone = lead.customer?.whatsappNumber || '';
  const displayPhone = lead.customer?.phoneNumber || formatWhatsAppDisplay(rawPhone);
  const waId = lead.customer?.whatsappId || getCleanWhatsAppDigits(rawPhone);
  const displayName = lead.customer?.displayName || 'WhatsApp Contact';

  // Current selected treatment (null if unassigned / default)
  const currentTreatment = treatments.find(t => t.id === lead.treatmentId) || null;
  const currentSerial = lead.serialNumber || (currentTreatment?.code ? `${currentTreatment.code}-001` : '---');

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTreatmentDropdownOpen(false);
      }
    };
    if (treatmentDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [treatmentDropdownOpen]);

  const handleCopy = () => {
    if (rawPhone) {
      navigator.clipboard.writeText(rawPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSavePhone = () => {
    if (lead.customer?.id && phoneInput.trim()) {
      updateCustomer(lead.customer.id, { 
        whatsappNumber: normalizeWhatsAppNumber(phoneInput.trim()),
        phoneNumber: formatWhatsAppDisplay(phoneInput.trim()),
        whatsappId: getCleanWhatsAppDigits(phoneInput.trim())
      });
    }
    setIsEditingPhone(false);
  };

  const handleSaveName = () => {
    if (lead.customer?.id && nameInput.trim()) {
      updateCustomer(lead.customer.id, { 
        displayName: nameInput.trim()
      });
    }
    setIsEditingName(false);
  };

  const isCras = lead.company === 'CRAS';

  const handleSelectTreatment = (trt: Treatment | null) => {
    if (!trt) {
      // Unset treatment and clear serial
      updateLeadTreatment(lead.id, '', '');
      setTreatmentDropdownOpen(false);
      setTreatmentSearchQuery('');
      return;
    }

    const defaultPrefix = isCras ? 'CRS' : 'TRT';
    const prefix = `${trt.code || defaultPrefix}-`;
    let maxNum = 0;
    leads.forEach(l => {
      if (l.id !== lead.id && l.serialNumber && l.serialNumber.startsWith(prefix)) {
        const numPart = parseInt(l.serialNumber.substring(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });
    const nextNum = String(maxNum + 1).padStart(3, '0');
    const nextSerial = `${trt.code || defaultPrefix}-${nextNum}`;
    updateLeadTreatment(lead.id, trt.id, nextSerial);
    setTreatmentDropdownOpen(false);
    setTreatmentSearchQuery('');
  };

  const handleRegenerateSerial = () => {
    if (!currentTreatment) return;
    setIsRegeneratingSerial(true);
    const defaultPrefix = isCras ? 'CRS' : 'TRT';
    const prefix = `${currentTreatment.code || defaultPrefix}-`;
    let maxNum = 0;
    leads.forEach(l => {
      if (l.id !== lead.id && l.serialNumber && l.serialNumber.startsWith(prefix)) {
        const numPart = parseInt(l.serialNumber.substring(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });
    const nextNum = String(maxNum + 1).padStart(3, '0');
    const nextSerial = `${currentTreatment.code || defaultPrefix}-${nextNum}`;
    updateLeadTreatment(lead.id, currentTreatment.id, nextSerial);
    setTimeout(() => setIsRegeneratingSerial(false), 500);
  };

  const availableItems = treatments.filter(t => isCras ? t.company === 'CRAS' : t.company !== 'CRAS');

  const filteredTreatments = availableItems.filter(t => {
    const q = treatmentSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      (t.code && t.code.toLowerCase().includes(q))
    );
  });

  return (
    <div className="w-full sm:w-85 md:w-80 shrink-0 border-l border-slate-800 bg-[#111b21] flex flex-col h-full overflow-hidden select-none fixed md:static inset-y-0 right-0 z-40 md:z-auto shadow-2xl md:shadow-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-14 px-4 bg-[#202c33] border-b border-slate-800 flex items-center justify-between shrink-0">
        <h3 className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-whatsapp" />
          <span>Patient Details & Routing</span>
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Top Routing & Stage Controls */}
      <div className="p-3 bg-[#202c33]/40 border-b border-slate-800 space-y-2.5">
        
        {/* Contact WhatsApp Card with Phone and Editable Name */}
        <div className="bg-[#111b21] p-3 rounded-xl border border-slate-800 space-y-2.5 shadow-sm">
          
          {/* WhatsApp Number Row */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Phone className="w-3 h-3 text-whatsapp" /> WhatsApp Number
              </span>
              <div className="flex items-center gap-1">
                {rawPhone && (
                  <button
                    onClick={handleCopy}
                    className="text-[10px] text-slate-400 hover:text-teal-300 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#202c33] border border-slate-700"
                    title="Copy Phone Number"
                  >
                    {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
                {!isEditingPhone ? (
                  <button
                    onClick={() => {
                      setPhoneInput(rawPhone);
                      setIsEditingPhone(true);
                    }}
                    className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded bg-[#202c33] border border-slate-700"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                    <span>{rawPhone ? 'Edit' : 'Add'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSavePhone}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded bg-[#202c33] border border-emerald-500/40"
                  >
                    <Check className="w-2.5 h-2.5" />
                    <span>Save</span>
                  </button>
                )}
                {rawPhone && (
                  <a
                    href={`https://wa.me/${rawPhone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-slate-400 hover:text-emerald-300 flex items-center p-1 rounded bg-[#202c33] border border-slate-700"
                    title="Open WhatsApp Web"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>

            {isEditingPhone ? (
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="e.g. +94771234567"
                  className="flex-1 bg-[#202c33] border border-teal-500 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none font-mono"
                  autoFocus
                />
                <button
                  onClick={handleSavePhone}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="space-y-0.5">
                <p className="text-xs font-mono font-bold text-white tracking-wide">
                  {displayPhone || (rawPhone && !isHardwareLid(rawPhone) ? (rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`) : 'WhatsApp Direct (Linked Device)')}
                </p>
                {waId && waId !== getCleanWhatsAppDigits(rawPhone) && (
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/80">
                    <span className="text-slate-500">Linked Device ID:</span>
                    <span className="font-mono text-slate-300 text-[10px]">{waId}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider between Phone and Name */}
          <div className="border-t border-slate-800/80" />

          {/* Patient Name Row with Edit Name Option */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3 text-teal-400" /> Patient Name
              </span>
              {!isEditingName ? (
                <button
                  onClick={() => {
                    setNameInput(displayName);
                    setIsEditingName(true);
                  }}
                  className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded bg-[#202c33] border border-slate-700"
                >
                  <Edit2 className="w-2.5 h-2.5" />
                  <span>Edit Name</span>
                </button>
              ) : (
                <button
                  onClick={handleSaveName}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded bg-[#202c33] border border-emerald-500/40"
                >
                  <Check className="w-2.5 h-2.5" />
                  <span>Save</span>
                </button>
              )}
            </div>

            {isEditingName ? (
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter patient full name..."
                  className="flex-1 bg-[#202c33] border border-teal-500 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none font-semibold"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            ) : (
              <p className="text-xs font-semibold text-teal-100 tracking-wide truncate">
                {displayName}
              </p>
            )}
          </div>

        </div>

        {/* Patient Preferred Language (Showcases customer language selection right above Assigned Coordinator) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Globe className="w-3 h-3 text-sky-400" /> Patient Preferred Language
            </label>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 uppercase tracking-wider">
              {currentLang.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { code: 'en', label: 'English', short: 'EN' },
              { code: 'si', label: 'සිංහල', short: 'SI' },
              { code: 'ta', label: 'தமிழ்', short: 'TA' }
            ].map((l) => {
              const isSelected = currentLang === l.code;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => updateLeadLanguage(lead.id, l.code as 'en' | 'si' | 'ta')}
                  className={`py-1.5 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 border ${
                    isSelected
                      ? 'bg-sky-500/25 border-sky-400 text-sky-200 shadow-sm ring-1 ring-sky-500/40'
                      : 'bg-[#111b21] border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <span>{l.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Company / Institution Affiliation */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Building2 className="w-3 h-3 text-emerald-400" /> Center / Company
            </label>
            <CompanyTagBadge lead={lead} size="sm" showFullName={false} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => updateLeadCompany(lead.id, 'RWC')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                (lead.company || 'RWC') === 'RWC'
                  ? 'bg-[#008000]/25 border-[#008000] text-emerald-300 shadow-sm ring-1 ring-[#008000]/40'
                  : 'bg-[#111b21] border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#008000]" />
              <span>(RWC) Royal Wellness</span>
            </button>
            <button
              type="button"
              onClick={() => updateLeadCompany(lead.id, 'CRAS')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                lead.company === 'CRAS'
                  ? 'bg-[#800000]/30 border-[#800000] text-rose-300 shadow-sm ring-1 ring-[#800000]/40'
                  : 'bg-[#111b21] border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#800000]" />
              <span>(CRAS) Royal Aesthetic</span>
            </button>
          </div>
        </div>

        {/* Coordinator Assignment */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Assigned Coordinator
          </label>

          {canAssignLeads ? (
            <div className="relative">
              <select
                value={coordinators.some(c => c.id === lead.assignedTo) ? (lead.assignedTo || '') : ''}
                onChange={(e) => assignLead(lead.id, e.target.value)}
                className="w-full bg-[#111b21] border border-slate-700/80 hover:border-teal-500 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-teal-300 outline-none transition-colors cursor-pointer appearance-none"
              >
                <option value="">
                  {coordinators.length > 0 ? '-- Assign to Coordinator --' : '-- No Coordinators Added (Add in Coordinators Tab) --'}
                </option>
                {coordinators.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900">
                    {c.fullName}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#111b21] border border-slate-800 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-slate-200 font-medium">
                {coordinator ? coordinator.fullName : 'Unassigned'}
              </span>
            </div>
          )}
        </div>

        {/* Treatment / Course Type & Serial Number Widget (Placed between Assigned Coordinator & Lead Stage) */}
        <div className={`grid grid-cols-12 gap-2 bg-[#111b21] p-2.5 rounded-xl border shadow-sm relative ${
          isCras ? 'border-rose-500/30' : 'border-teal-500/30'
        }`}>
          
          {/* Treatment / Course Type Column (7 cols) */}
          <div className="col-span-7 space-y-1 relative" ref={dropdownRef}>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {isCras ? 'Course Type' : 'Treatment Type'} <span className="text-amber-400">*</span>
            </label>
            
            {/* Treatment Selector Dropdown Button */}
            <button
              type="button"
              onClick={() => setTreatmentDropdownOpen(!treatmentDropdownOpen)}
              className={`w-full bg-[#202c33] border rounded-lg px-2 py-1.5 text-[11px] font-bold text-left flex items-center justify-between gap-1 transition-colors shadow-inner ${
                isCras 
                  ? 'border-rose-500/50 hover:border-rose-400 text-rose-200' 
                  : 'border-teal-500/50 hover:border-teal-400 text-teal-200'
              }`}
            >
              <span className="truncate">
                {currentTreatment 
                  ? `${currentTreatment.code || (isCras ? 'CRS' : 'TRT')} - ${currentTreatment.name}` 
                  : (isCras ? 'Select Course' : 'Select Treatment')}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                isCras ? 'text-rose-400' : 'text-teal-400'
              } ${treatmentDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Searchable Dropdown Popup */}
            {treatmentDropdownOpen && (
              <div className={`absolute left-0 top-full mt-1 w-72 bg-[#182229] border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-64 animate-in fade-in zoom-in-95 duration-100 ${
                isCras ? 'border-rose-500/50' : 'border-teal-500/50'
              }`}>
                {/* Search Input Bar */}
                <div className="p-2 border-b border-slate-700/80 bg-[#111b21] flex items-center gap-1.5 shrink-0">
                  <Search className={`w-3.5 h-3.5 shrink-0 ${isCras ? 'text-rose-400' : 'text-teal-400'}`} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={treatmentSearchQuery}
                    onChange={(e) => setTreatmentSearchQuery(e.target.value)}
                    placeholder={isCras ? "Search 15 courses..." : "Search 24 treatments..."}
                    className="w-full bg-transparent text-xs text-white placeholder-slate-400 outline-none font-medium"
                  />
                  {treatmentSearchQuery && (
                    <button onClick={() => setTreatmentSearchQuery('')} className="text-slate-400 hover:text-white text-[10px] px-1">
                      ✕
                    </button>
                  )}
                </div>

                {/* Treatments / Courses List */}
                <div className="overflow-y-auto flex-1 p-1 space-y-0.5 custom-scrollbar">
                  {/* Default Unselect Option */}
                  <button
                    type="button"
                    onClick={() => handleSelectTreatment(null)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      !lead.treatmentId 
                        ? (isCras ? 'bg-rose-600/30 text-rose-300 font-bold border border-rose-500/40' : 'bg-teal-600/30 text-teal-300 font-bold border border-teal-500/40') 
                        : 'text-slate-400 hover:bg-[#202c33] hover:text-slate-200'
                    }`}
                  >
                    <span>{isCras ? '-- Select Course --' : '-- Select Treatment --'}</span>
                    {!lead.treatmentId && <Check className={`w-3.5 h-3.5 shrink-0 ml-1 ${isCras ? 'text-rose-400' : 'text-teal-400'}`} />}
                  </button>

                  {filteredTreatments.length === 0 ? (
                    <div className="px-3 py-3 text-center text-xs text-slate-400">
                      {isCras ? `No courses match "${treatmentSearchQuery}"` : `No treatments match "${treatmentSearchQuery}"`}
                    </div>
                  ) : (
                    filteredTreatments.map((t) => {
                      const isSelected = t.id === lead.treatmentId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleSelectTreatment(t)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                            isSelected 
                              ? (isCras ? 'bg-rose-600/30 text-rose-300 font-bold border border-rose-500/40' : 'bg-teal-600/30 text-teal-300 font-bold border border-teal-500/40') 
                              : 'text-slate-200 hover:bg-[#202c33] hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                              isCras ? 'bg-rose-950/60 text-rose-300 border-rose-800/60' : 'bg-slate-800 text-teal-300 border-slate-700'
                            }`}>
                              {t.code || (isCras ? 'CRS' : 'TRT')}
                            </span>
                            <span className="truncate">{t.name}</span>
                          </div>
                          {isSelected && <Check className={`w-3.5 h-3.5 shrink-0 ml-1 ${isCras ? 'text-rose-400' : 'text-teal-400'}`} />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Serial Number Column (5 cols) */}
          <div className="col-span-5 space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Serial Number <span className="text-amber-400">*</span>
            </label>
            <div className="flex items-center gap-1">
              <div 
                className={`flex-1 bg-[#202c33] border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono font-bold tracking-wider text-center select-all truncate shadow-inner ${
                  currentTreatment 
                    ? (isCras ? 'text-rose-300' : 'text-teal-300')
                    : 'text-slate-500'
                }`}
                title={currentTreatment ? `Auto-generated unique ${isCras ? 'course ' : ''}serial number` : `Please select a ${isCras ? 'course' : 'treatment'} first`}
              >
                {currentTreatment ? currentSerial : '---'}
              </div>
              <button
                type="button"
                onClick={handleRegenerateSerial}
                disabled={!currentTreatment || isRegeneratingSerial}
                className={`p-1.5 rounded-lg transition-all border ${
                  currentTreatment 
                    ? (isCras 
                        ? 'bg-rose-600/20 hover:bg-rose-600/40 active:bg-rose-600/60 border-rose-500/40 text-rose-300' 
                        : 'bg-teal-600/20 hover:bg-teal-600/40 active:bg-teal-600/60 border-teal-500/40 text-teal-300') 
                    : 'bg-slate-800/50 border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
                title={currentTreatment ? "Regenerate next serial number" : `Select a ${isCras ? 'course' : 'treatment'} first`}
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRegeneratingSerial ? (isCras ? 'animate-spin text-rose-200' : 'animate-spin text-teal-200') : ''}`} />
              </button>
            </div>
          </div>

        </div>

        {/* Lead Stage Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Lead Stage
          </label>
          <div className="relative">
            <select
              value={lead.stage}
              onChange={(e) => updateLeadStage(lead.id, e.target.value as LeadStage)}
              className="w-full bg-[#111b21] border border-slate-700/80 hover:border-teal-500 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-100 outline-none transition-colors cursor-pointer appearance-none"
            >
              <option value="new">🟡 New Inquiry</option>
              <option value="assigned">🔵 Assigned</option>
              <option value="contacted">🟢 Contacted</option>
              <option value="potential">🟣 Potential</option>
              <option value="under_discussion">💬 Under Discussion</option>
              <option value="not_relevant">⚪ Not Relevant Inquiry</option>
              <option value="converted">🎉 Converted (Closed Won)</option>
              <option value="lost">🔴 Lost</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

      </div>

      {/* Clean Tabs Navigation */}
      <div className="p-2 border-b border-slate-800 bg-[#202c33] grid grid-cols-3 gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('notes')}
          className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'notes'
              ? 'bg-whatsapp/20 text-whatsapp border border-whatsapp/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Notes</span>
        </button>

        <button
          onClick={() => setActiveTab('followups')}
          className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'followups'
              ? 'bg-whatsapp/20 text-whatsapp border border-whatsapp/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Follow-Ups</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'history'
              ? 'bg-whatsapp/20 text-whatsapp border border-whatsapp/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Timeline</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 p-3 overflow-y-auto">
        {activeTab === 'notes' && <NotesTab lead={lead} />}
        {activeTab === 'followups' && <FollowupsTab lead={lead} />}
        {activeTab === 'history' && <StageHistoryTab lead={lead} />}
      </div>

    </div>
  );
};
