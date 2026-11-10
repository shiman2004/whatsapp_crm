import React, { useState, useMemo, useEffect } from 'react';
import {
  MessageSquare,
  Bot,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Network,
  Calendar,
  Layers,
  Sparkles,
  ArrowRightLeft,
  RotateCcw,
  Check,
  Edit2,
  Users,
  Send,
  Zap,
  Puzzle,
  Smartphone,
  PhoneCall,
  CheckCheck,
  Key,
  RefreshCw,
  Copy
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';
import { useCrm } from '../../context/CrmContext';
import { API_BASE_URL } from '../../config/api';

interface WhatsAppMessagingProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

type TabType = 'setup' | 'channels' | 'routing' | 'replies' | 'hours' | 'templates' | 'integrations';

interface CompanyMessagingPreset {
  defaultInbox: string;
  inboxPhone: string;
  welcomeMessage: string;
  outOfOfficeMessage: string;
}

const MESSAGING_PRESETS: Record<string, CompanyMessagingPreset> = {
  RWC: {
    defaultInbox: 'RWC Center Official WhatsApp (+94 77 123 4567)',
    inboxPhone: '+94 77 123 4567',
    welcomeMessage:
      'Ayubowan! Thank you for contacting Royal Wellness Center. A healthcare coordinator will attend to you shortly.',
    outOfOfficeMessage:
      'We are currently outside of our business hours. Our team will get back to you during operating hours (8:00 AM – 7:00 PM).'
  },
  CRAS: {
    defaultInbox: 'CRAS Academic Enquiries (+94 11 456 7890)',
    inboxPhone: '+94 11 456 7890',
    welcomeMessage:
      'Ayubowan! Thank you for contacting CRAS College. An admissions coordinator will assist you shortly.',
    outOfOfficeMessage:
      'Our admissions office is currently closed. We will respond promptly during academic hours (8:30 AM – 6:00 PM).'
  },
  AHC: {
    defaultInbox: 'Alpha Health Advisory Line (+94 11 789 0123)',
    inboxPhone: '+94 11 789 0123',
    welcomeMessage:
      'Welcome to Alpha Health Consultancy. An executive healthcare consultant will connect with you shortly.',
    outOfOfficeMessage:
      'Alpha Health executive offices are closed for the day. Our advisory team will reach out at 8:00 AM.'
  },
  ALL: {
    defaultInbox: 'Alpha Health Group Multi-Brand Queue (+94 11 789 0000)',
    inboxPhone: '+94 11 789 0000',
    welcomeMessage:
      'Ayubowan! Thank you for contacting Alpha Health Group. We are routing your enquiry to the designated division.',
    outOfOfficeMessage:
      'We are currently outside of our business hours. Our team will get back to you during operating hours (8:00 AM – 7:00 PM).'
  }
};

export const WhatsAppMessagingSection: React.FC<WhatsAppMessagingProps> = ({
  currentSectionId,
  onSelectSection,
  selectedCompanyId,
  onSelectCompany
}) => {
  const { notify } = useCrm();
  const toast = (title: string, message: string, type: 'info' | 'success' | 'warning' = 'success') => {
    if (typeof notify === 'function') notify(title, message, type);
  };

  const {
    data,
    updateField,
    version,
    isLoading,
    isSaving,
    isDirty,
    error,
    saveSettings,
    discardChanges,
    conflictState
  } = useSettingsSection({
    sectionId: 'whatsapp_messaging',
    scope: 'company',
    companyId: selectedCompanyId
  });

  const [activeTab, setActiveTab] = useState<TabType>('setup');

  // Real WhatsApp Cloud API Account Management State
  const [metaHasToken, setMetaHasToken] = useState<boolean>(false);
  const [metaPhoneId, setMetaPhoneId] = useState<string>('');
  const [metaWabaId, setMetaWabaId] = useState<string>('');
  const [metaVerifyToken, setMetaVerifyToken] = useState<string>('');
  const [metaAppSecret, setMetaAppSecret] = useState<string>('');
  const [waStatus, setWaStatus] = useState<{ status: string; phone?: string; provider?: string }>({ status: 'checking' });
  const [isSavingMeta, setIsSavingMeta] = useState<boolean>(false);
  const [testWaPhone, setTestWaPhone] = useState<string>('');
  const [isSendingWaTest, setIsSendingWaTest] = useState<boolean>(false);
  const [waTestResult, setWaTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [realTemplates, setRealTemplates] = useState<any[]>([]);
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);

  const getToken = () =>
    localStorage.getItem('rw_crm_auth_token') ||
    localStorage.getItem('royal_crm_token') ||
    localStorage.getItem('auth_token') ||
    '';

  const loadWhatsAppAccountState = async () => {
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : '';
    const headers = { Authorization: `Bearer ${getToken()}` };
    try {
      const [cfgRes, statusRes, tplRes] = await Promise.all([
        fetch(`${base}/api/meta/config`, { headers }).catch(() => null),
        fetch(`${base}/api/whatsapp/status`, { headers }).catch(() => null),
        fetch(`${base}/api/templates`, { headers }).catch(() => null)
      ]);
      if (cfgRes?.ok) {
        const cfg = await cfgRes.json();
        setMetaHasToken(Boolean(cfg.hasToken));
        if (cfg.phoneNumberId) setMetaPhoneId(cfg.phoneNumberId);
        if (cfg.wabaId) setMetaWabaId(cfg.wabaId);
      }
      if (statusRes?.ok) {
        const st = await statusRes.json();
        setWaStatus({ status: st.status || 'disconnected', phone: st.phone, provider: st.provider });
      } else {
        setWaStatus({ status: 'disconnected' });
      }
      if (tplRes?.ok) {
        const tpls = await tplRes.json();
        if (Array.isArray(tpls)) setRealTemplates(tpls);
        else if (Array.isArray(tpls?.templates)) setRealTemplates(tpls.templates);
      }
    } catch {
      setWaStatus({ status: 'disconnected' });
    }
  };

  useEffect(() => {
    loadWhatsAppAccountState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveMetaAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingMeta(true);
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : '';
    try {
      const payload: Record<string, string> = {
        phoneNumberId: metaPhoneId.trim(),
        wabaId: metaWabaId.trim(),
      };
      if (metaVerifyToken.trim()) payload.verifyToken = metaVerifyToken.trim();
      if (metaAppSecret.trim()) payload.appSecret = metaAppSecret.trim();

      const res = await fetch(`${base}/api/meta/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setMetaHasToken(Boolean(json.hasToken));
        setMetaVerifyToken('');
        setMetaAppSecret('');
        toast('WhatsApp Account Updated', 'Meta Cloud API Phone ID & WABA ID persisted and synced to all connected staff.', 'success');
        await loadWhatsAppAccountState();
      } else {
        toast('Update Failed', json.error || 'Unable to save WhatsApp account identifiers.', 'warning');
      }
    } catch (err: any) {
      toast('Network Error', err?.message || 'Unable to reach backend server.', 'warning');
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleSendTestWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testWaPhone.trim()) return;
    setIsSendingWaTest(true);
    setWaTestResult(null);
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : '';
    try {
      let cleanTo = testWaPhone.replace(/[^0-9]/g, '');
      if (cleanTo.startsWith('0') && cleanTo.length === 10) cleanTo = '94' + cleanTo.slice(1);
      else if (cleanTo.length === 9 && (cleanTo.startsWith('7') || cleanTo.startsWith('1'))) cleanTo = '94' + cleanTo;

      const res = await fetch(`${base}/api/send-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          to: cleanTo,
          templateName: 'hello_world',
          language: 'en_US',
          parameters: []
        })
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success !== false) {
        setWaTestResult({ success: true, message: `Template 'hello_world' dispatched to +${cleanTo}!` });
      } else {
        setWaTestResult({ success: false, message: json.error || 'Meta API rejected test template dispatch.' });
      }
    } catch (err: any) {
      setWaTestResult({ success: false, message: err?.message || 'Network error dispatching test template.' });
    } finally {
      setIsSendingWaTest(false);
    }
  };

  // Company preset configuration
  const activePreset = useMemo(() => {
    return MESSAGING_PRESETS[selectedCompanyId] || MESSAGING_PRESETS.RWC;
  }, [selectedCompanyId]);

  // Form State / Field Resolutions
  const defaultInbox = data?.defaultInbox || activePreset.defaultInbox;
  const assignmentPolicy = data?.assignmentPolicy || 'round_robin';
  const allowStaffTransfer = data?.allowStaffTransfer !== undefined ? String(data.allowStaffTransfer) : 'true';
  const customerServiceWindow = data?.windowEnforcement || 'strict_24h';
  const enableWelcomeGreeting = data?.enableWelcomeGreeting !== undefined ? data.enableWelcomeGreeting : true;
  const welcomeMessage = data?.welcomeMessage || activePreset.welcomeMessage;
  const enableOutOfOffice = data?.enableOutOfOffice !== undefined ? data.enableOutOfOffice : false;
  const outOfOfficeMessage = data?.outOfOfficeMessage || activePreset.outOfOfficeMessage;

  const handleManualSave = async () => {
    try {
      await saveSettings();
      toast('Messaging Settings Saved', 'WhatsApp routing policies and auto-replies updated successfully.');
    } catch (err: any) {
      toast('Save Failed', err.message || 'Unable to persist changes.', 'warning');
    }
  };

  const handleResetToDefault = () => {
    updateField('defaultInbox', activePreset.defaultInbox);
    updateField('assignmentPolicy', 'round_robin');
    updateField('allowStaffTransfer', true);
    updateField('windowEnforcement', 'strict_24h');
    updateField('enableWelcomeGreeting', true);
    updateField('welcomeMessage', activePreset.welcomeMessage);
    updateField('enableOutOfOffice', false);
    updateField('outOfOfficeMessage', activePreset.outOfOfficeMessage);
    toast('Defaults Restored', `Restored default messaging settings for ${selectedCompanyId}.`, 'info');
  };

  if (isLoading) {
    return (
      <SettingsLayout
        currentSectionId={currentSectionId}
        onSelectSection={onSelectSection}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={onSelectCompany}
      >
        <div className="flex items-center justify-center h-64 text-[#667781] dark:text-[#8696A0]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#128C7E] dark:border-[#25D366] mr-3" />
          <span>Loading messaging policies...</span>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout
      currentSectionId={currentSectionId}
      onSelectSection={onSelectSection}
      selectedCompanyId={selectedCompanyId}
      onSelectCompany={onSelectCompany}
      isDirty={isDirty}
      isSaving={isSaving}
      version={version}
      conflictState={conflictState}
      onSave={handleManualSave}
      onDiscard={discardChanges}
    >
      <div className="w-full space-y-5">
        {error && (
          <div className="p-4 rounded-xl bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center space-x-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Navigation Tab Bar */}
        <div className="flex items-center space-x-1 border-b border-[#E0E5E7] dark:border-[#222D34] pb-px overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'setup'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Messaging Setup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('channels')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'channels'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>WhatsApp Account & Channels</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('routing')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'routing'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Network className="h-4 w-4" />
            <span>Routing & Assignment</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('replies')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'replies'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Bot className="h-4 w-4" />
            <span>Auto-Replies</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hours')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'hours'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Business Hours</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'templates'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Message Templates</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('integrations')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'integrations'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Puzzle className="h-4 w-4" />
            <span>Integrations</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 1. VERIFIED OPERATIONAL CHANNEL BOUNDARIES BANNER */}
        {/* ========================================================================= */}
        <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 sm:p-5 shadow-sm transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">
                  Verified Operational Channel Boundaries
                </h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                  Controls routing, auto-replies and service windows. WhatsApp Web QR, Cloud API connections and live listeners run independently in the core runtime.
                </p>
              </div>
            </div>

            <div className="self-end sm:self-auto shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Operational</span>
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. 4 STAT METRIC CARDS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Connected Channels */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center justify-between transition-colors">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Connected Channels</p>
                <h3 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">3</h3>
                <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">RWC, CRAS, Alpha Health</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
              waStatus.status === 'connected' && metaHasToken
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}>
              ● {waStatus.status === 'connected' && metaHasToken ? 'Online' : 'Checking / Config'}
            </span>
          </div>

          {/* 2. Assigned Coordinators */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center space-x-3.5 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Assigned Coordinators</p>
              <h3 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">7</h3>
              <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">Across all branches</p>
            </div>
          </div>

          {/* 3. Auto-Replies */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center space-x-3.5 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Auto-Replies</p>
              <h3 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">2</h3>
              <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">Welcome & Out-of-Office</p>
            </div>
          </div>

          {/* 4. Business Hours */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center justify-between transition-colors">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Business Hours</p>
                <h3 className="text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">Configured</h3>
                <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">Mon – Sat, 8:00 AM – 7:00 PM</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('hours')}
              className="px-2.5 py-1 rounded-lg bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] text-xs font-semibold flex items-center space-x-1 hover:border-[#128C7E] dark:hover:border-[#25D366] transition-colors cursor-pointer"
            >
              <Edit2 className="h-3 w-3 text-[#128C7E] dark:text-[#25D366]" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. TWO-COLUMN DASHBOARD (Messaging Setup View) */}
        {/* ========================================================================= */}
        {(activeTab === 'setup' || activeTab === 'routing' || activeTab === 'replies') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ------------------------------------------------------------- */}
            {/* LEFT CARD: Routing & Queue Allocation */}
            {/* ------------------------------------------------------------- */}
            {(activeTab === 'setup' || activeTab === 'routing') && (
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
                <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                    <Network className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                      Routing & Queue Allocation
                    </h3>
                    <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                      Define how incoming WhatsApp conversations are routed and assigned.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Row 1: Inbox */}
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <div className="h-6 w-6 rounded-md bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF]">Inbox</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#667781] dark:text-[#8696A0] mb-1">
                        Authorized Default Inbox
                      </label>
                      <select
                        value={defaultInbox}
                        onChange={(e) => updateField('defaultInbox', e.target.value)}
                        className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs font-medium text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
                      >
                        <option value={activePreset.defaultInbox}>{activePreset.defaultInbox}</option>
                        <option value="RWC Center Official WhatsApp (+94 77 123 4567)">RWC Center Official WhatsApp (+94 77 123 4567)</option>
                        <option value="CRAS Academic Enquiries (+94 11 456 7890)">CRAS Academic Enquiries (+94 11 456 7890)</option>
                        <option value="Alpha Health Advisory Line (+94 11 789 0123)">Alpha Health Advisory Line (+94 11 789 0123)</option>
                        <option value="Shared Multi-Brand Inbox Queue">Shared Multi-Brand Inbox Queue</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Assignment */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center space-x-2">
                      <div className="h-6 w-6 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                        <Users className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF]">Assignment</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#667781] dark:text-[#8696A0] mb-1">
                        Conversation Assignment Policy
                      </label>
                      <select
                        value={assignmentPolicy}
                        onChange={(e) => updateField('assignmentPolicy', e.target.value)}
                        className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs font-medium text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
                      >
                        <option value="round_robin">Weighted Round-Robin (Active Staff)</option>
                        <option value="least_busy">Least Busy (Lowest Active Chat Count)</option>
                        <option value="broadcast">Broadcast to All Coordinators</option>
                        <option value="manual_claim">Manual Lead Pool Claiming</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Transfer */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center space-x-2">
                      <div className="h-6 w-6 rounded-md bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF]">Transfer</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#667781] dark:text-[#8696A0] mb-1">
                        Staff Transfer Permission
                      </label>
                      <select
                        value={allowStaffTransfer}
                        onChange={(e) => updateField('allowStaffTransfer', e.target.value === 'true')}
                        className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs font-medium text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
                      >
                        <option value="true">Allowed (Staff can reassign to any branch peer)</option>
                        <option value="false">Restricted (Manager Approval Required)</option>
                        <option value="same_branch">Restricted to Same Branch Only</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 4: Service window */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center space-x-2">
                      <div className="h-6 w-6 rounded-md bg-teal-500/10 text-teal-600 dark:text-[#25D366] flex items-center justify-center shrink-0">
                        <Clock className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF]">Service window</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#667781] dark:text-[#8696A0] mb-1">
                        Customer Service Window
                      </label>
                      <select
                        value={customerServiceWindow}
                        onChange={(e) => updateField('windowEnforcement', e.target.value)}
                        className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs font-medium text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
                      >
                        <option value="strict_24h">Strict 24-Hour WhatsApp Session Policy</option>
                        <option value="extended_48h">Extended 48-Hour Clinical Follow-up Window</option>
                        <option value="unrestricted">Unrestricted (Template Messages Out of Window)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* RIGHT CARD: Automated Welcome & Business Hours Responses */}
            {/* ------------------------------------------------------------- */}
            {(activeTab === 'setup' || activeTab === 'replies') && (
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                          Automated Welcome & Business Hours Responses
                        </h3>
                        <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                          Configure instant greetings and out-of-office autoreplies.
                        </p>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                      ● Enabled
                    </span>
                  </div>

                  <div className="space-y-5 pt-4">
                    {/* Section 1: Welcome Greeting */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="h-7 w-7 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
                            <Sparkles className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">
                              Welcome Greeting for First-Time Senders
                            </h4>
                            <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                              Automatically reply when a new lead initiates a conversation.
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => updateField('enableWelcomeGreeting', !enableWelcomeGreeting)}
                          className="focus:outline-none cursor-pointer"
                        >
                          <div
                            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                              enableWelcomeGreeting ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                enableWelcomeGreeting ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </div>
                        </button>
                      </div>

                      {enableWelcomeGreeting && (
                        <div>
                          <label className="block text-[11px] font-semibold text-[#667781] dark:text-[#8696A0] mb-1">
                            Welcome Message Text
                          </label>
                          <textarea
                            rows={3}
                            value={welcomeMessage}
                            onChange={(e) => updateField('welcomeMessage', e.target.value)}
                            className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3.5 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 resize-none leading-relaxed"
                          />
                        </div>
                      )}
                    </div>

                    {/* Section 2: Out-of-Office Response */}
                    <div className="space-y-2.5 pt-2 border-t border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
                            <Calendar className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">
                              Out-of-Office Response
                            </h4>
                            <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                              Dispatch an autoreply outside business operating hours (after 7:00 PM).
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => updateField('enableOutOfOffice', !enableOutOfOffice)}
                          className="focus:outline-none cursor-pointer"
                        >
                          <div
                            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                              enableOutOfOffice ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                enableOutOfOffice ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </div>
                        </button>
                      </div>

                      {enableOutOfOffice && (
                        <div>
                          <label className="block text-[11px] font-semibold text-[#667781] dark:text-[#8696A0] mb-1">
                            Out of Office Message
                          </label>
                          <textarea
                            rows={3}
                            value={outOfOfficeMessage}
                            onChange={(e) => updateField('outOfOfficeMessage', e.target.value)}
                            className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3.5 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 resize-none leading-relaxed"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="flex items-center justify-end space-x-3 pt-5 border-t border-[#E0E5E7] dark:border-[#222D34]">
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="px-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] text-xs font-semibold flex items-center space-x-1.5 hover:bg-[#E0E5E7] dark:hover:bg-[#2A3942] transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                    <span>Reset to Default</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleManualSave}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* OTHER TABS: CHANNELS (REAL ACCOUNT MANAGEMENT), HOURS, TEMPLATES, INTEGRATIONS */}
        {/* ========================================================================= */}
        {activeTab === 'channels' && (
          <div className="space-y-6">
            {/* 1. Live Meta Cloud API Gateway Status */}
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                    Meta WhatsApp Cloud API Account Management
                  </h3>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0]">
                    Configure live WhatsApp Business Account (WABA), Phone Number ID, and test outbound connectivity
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                    waStatus.status === 'connected' && metaHasToken
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${waStatus.status === 'connected' && metaHasToken ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    {waStatus.status === 'connected' && metaHasToken ? 'Meta Gateway Connected' : 'Gateway Disconnected / Unconfigured'}
                  </span>
                  <button
                    type="button"
                    onClick={loadWhatsAppAccountState}
                    className="p-2 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#667781] dark:text-[#8696A0] hover:text-[#128C7E] dark:hover:text-[#25D366] transition-colors cursor-pointer"
                    title="Refresh WhatsApp Account Status"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] space-y-1">
                  <span className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Server Access Token (META_ACCESS_TOKEN)</span>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">
                    <Key className={`h-3.5 w-3.5 ${metaHasToken ? 'text-emerald-500' : 'text-rose-500'}`} />
                    <span>{metaHasToken ? 'Configured in Server Secret Manager' : 'Missing on Server Environment'}</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] space-y-1">
                  <span className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Master Connected Number</span>
                  <p className="text-xs font-mono font-bold text-[#111B21] dark:text-[#E9EDEF]">
                    {waStatus.phone ? `+${waStatus.phone}` : 'Not Reported'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] space-y-1">
                  <span className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Active Provider Engine</span>
                  <p className="text-xs font-bold text-[#128C7E] dark:text-[#25D366]">
                    Meta WhatsApp Cloud API v20.0
                  </p>
                </div>
              </div>

              {/* 2. Editable Meta Account Identifiers Form */}
              <form onSubmit={handleSaveMetaAccount} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Meta Phone Number ID</label>
                  <input
                    type="text"
                    value={metaPhoneId}
                    onChange={(e) => setMetaPhoneId(e.target.value)}
                    placeholder="e.g. 1358157244046701"
                    className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3.5 py-2 text-xs font-mono text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">WhatsApp Business Account (WABA) ID</label>
                  <input
                    type="text"
                    value={metaWabaId}
                    onChange={(e) => setMetaWabaId(e.target.value)}
                    placeholder="e.g. 2332922997481634"
                    className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3.5 py-2 text-xs font-mono text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Webhook Verify Token (Optional Update)</label>
                  <input
                    type="text"
                    value={metaVerifyToken}
                    onChange={(e) => setMetaVerifyToken(e.target.value)}
                    placeholder="Leave blank to keep existing server verify token"
                    className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3.5 py-2 text-xs font-mono text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Meta App Secret (Optional Update)</label>
                  <input
                    type="password"
                    value={metaAppSecret}
                    onChange={(e) => setMetaAppSecret(e.target.value)}
                    placeholder="Leave blank to keep existing app secret"
                    className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3.5 py-2 text-xs font-mono text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                </div>

                <div className="md:col-span-2 flex items-center justify-between pt-2">
                  <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                    Note: Permanent <code className="font-mono">META_ACCESS_TOKEN</code> is managed in Render Environment Variables for zero-knowledge security.
                  </p>
                  <button
                    type="submit"
                    disabled={isSavingMeta}
                    className="px-4 py-2 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{isSavingMeta ? 'Syncing...' : 'Save Account Identifiers'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* 3. Live Outbound WhatsApp Verification Tester */}
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] flex items-center gap-2">
                <Send className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                Send Live WhatsApp Connection Test
              </h3>
              <form onSubmit={handleSendTestWhatsApp} className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={testWaPhone}
                  onChange={(e) => setTestWaPhone(e.target.value)}
                  placeholder="Enter test WhatsApp number (e.g. 0771234567 or +94771234567)"
                  className="flex-1 min-w-[240px] bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3.5 py-2 text-xs font-mono text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                />
                <button
                  type="submit"
                  disabled={isSendingWaTest || !testWaPhone.trim()}
                  className="px-4 py-2 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isSendingWaTest ? 'Dispatching...' : 'Send Hello World Template'}</span>
                </button>
              </form>
              {waTestResult && (
                <div className={`p-3 rounded-xl text-xs border ${
                  waTestResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}>
                  {waTestResult.message}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'hours' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">WhatsApp Support Hours Window</h3>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">
              Messages arriving outside these hours trigger the configured Out-of-Office autoreply.
            </p>
            <div className="p-4 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-xs font-medium text-[#111B21] dark:text-[#E9EDEF]">
              Monday – Saturday: <strong>08:00 AM – 07:00 PM (GMT+05:30)</strong> • Sunday: <strong>Closed</strong>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">Meta Approved WhatsApp Templates</h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0]">
                  Live synchronized templates available for 24+ hour re-engagement outbound messages ({realTemplates.length} loaded).
                </p>
              </div>
              <button
                type="button"
                onClick={loadWhatsAppAccountState}
                className="px-3 py-1.5 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-xs font-semibold text-[#128C7E] dark:text-[#25D366] flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Sync</span>
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {realTemplates.length > 0 ? realTemplates.map((t, idx) => (
                <div key={t.id || t.name || idx} className="flex items-center justify-between p-3 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-xs">
                  <div>
                    <span className="font-mono font-bold text-[#111B21] dark:text-[#E9EDEF] block">{t.waTemplateName || t.name}</span>
                    {t.language && <span className="text-[10px] text-[#667781] dark:text-[#8696A0]">Lang: {t.language}</span>}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-[#202C33] text-[#667781] dark:text-[#8696A0]">{t.category || 'UTILITY'}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{t.status || (t.approved ? 'APPROVED' : 'PENDING')}</span>
                  </div>
                </div>
              )) : (
                <div className="p-4 text-center text-xs text-[#667781] dark:text-[#8696A0]">
                  No synced templates returned yet. Manage templates under the Templates tab in the main menu.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">WhatsApp Gateway & Webhook Connections</h3>
            <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34]">
              <div className="text-xs">
                <span className="text-[#667781] dark:text-[#8696A0] block mb-1">Active Meta Webhook Callback Path:</span>
                <code className="font-mono font-bold text-[#128C7E] dark:text-[#25D366]">
                  {(API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : window.location.origin)}/api/webhook
                </code>
              </div>
              <button
                type="button"
                onClick={() => {
                  const url = `${API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : window.location.origin}/api/webhook`;
                  navigator.clipboard.writeText(url);
                  setCopiedWebhook(true);
                  setTimeout(() => setCopiedWebhook(false), 2000);
                }}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] flex items-center gap-1.5 cursor-pointer"
              >
                {copiedWebhook ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedWebhook ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>
            <div className={`p-4 rounded-xl border text-xs ${
              waStatus.status === 'connected' && metaHasToken
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
            }`}>
              {waStatus.status === 'connected' && metaHasToken
                ? '✓ Meta Cloud API inbound and outbound webhooks are connected and verified.'
                : '⚠️ Meta Cloud API token not yet verified. Check Render environment variables.'}
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
};

export default WhatsAppMessagingSection;
