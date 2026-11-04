import React, { useState, useMemo } from 'react';
import {
  Megaphone,
  CopyCheck,
  ShieldCheck,
  UsersRound,
  FileCheck2,
  Database,
  Layers,
  Phone,
  RotateCcw,
  RefreshCw,
  Calendar,
  Sliders,
  Check,
  AlertCircle,
  Users,
  User,
  Send,
  Upload,
  Lock,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Clock,
  Plus,
  Trash2,
  ArrowUpDown,
  Search,
  Filter
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';
import { useCrm } from '../../context/CrmContext';

interface MarketingSettingsProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

type TabType = 'rules' | 'allocation' | 'consent' | 'campaigns' | 'import';

interface CompanyMarketingPreset {
  totalContacts: string;
  duplicateCount: string;
  duplicatePercent: string;
  activeCoordinators: number;
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  scopeLabel: string;
  dedupeKey: string;
  duplicateAction: string;
  dailyCap: number;
  staleThresholdDays: number;
  autoReassignInactive: boolean;
  consentEnforced: boolean;
  suppressionKeywords: string[];
  maxHourlyBroadcast: number;
}

const MARKETING_PRESETS: Record<string, CompanyMarketingPreset> = {
  RWC: {
    totalContacts: '12,480',
    duplicateCount: '142',
    duplicatePercent: '1.1% of total contacts',
    activeCoordinators: 7,
    totalCampaigns: 5,
    activeCampaigns: 2,
    completedCampaigns: 3,
    scopeLabel: 'Across all companies',
    dedupeKey: 'phone_e164',
    duplicateAction: 'update_existing',
    dailyCap: 50,
    staleThresholdDays: 7,
    autoReassignInactive: true,
    consentEnforced: true,
    suppressionKeywords: ['STOP', 'UNSUBSCRIBE', 'DND', 'CANCEL'],
    maxHourlyBroadcast: 250
  },
  CRAS: {
    totalContacts: '8,920',
    duplicateCount: '86',
    duplicatePercent: '0.9% of total contacts',
    activeCoordinators: 5,
    totalCampaigns: 4,
    activeCampaigns: 2,
    completedCampaigns: 2,
    scopeLabel: 'CRAS Academic Scope',
    dedupeKey: 'phone_e164',
    duplicateAction: 'update_existing',
    dailyCap: 40,
    staleThresholdDays: 14,
    autoReassignInactive: true,
    consentEnforced: true,
    suppressionKeywords: ['STOP', 'OPT OUT', 'UNSUBSCRIBE'],
    maxHourlyBroadcast: 150
  },
  AHC: {
    totalContacts: '3,150',
    duplicateCount: '18',
    duplicatePercent: '0.5% of total contacts',
    activeCoordinators: 3,
    totalCampaigns: 2,
    activeCampaigns: 1,
    completedCampaigns: 1,
    scopeLabel: 'Alpha Health Scope',
    dedupeKey: 'phone_or_email',
    duplicateAction: 'update_existing',
    dailyCap: 25,
    staleThresholdDays: 21,
    autoReassignInactive: false,
    consentEnforced: true,
    suppressionKeywords: ['STOP', 'REMOVE'],
    maxHourlyBroadcast: 100
  },
  ALL: {
    totalContacts: '24,550',
    duplicateCount: '246',
    duplicatePercent: '1.0% of total contacts',
    activeCoordinators: 15,
    totalCampaigns: 11,
    activeCampaigns: 5,
    completedCampaigns: 6,
    scopeLabel: 'Holding-Wide Scope',
    dedupeKey: 'phone_e164',
    duplicateAction: 'update_existing',
    dailyCap: 50,
    staleThresholdDays: 7,
    autoReassignInactive: true,
    consentEnforced: true,
    suppressionKeywords: ['STOP', 'UNSUBSCRIBE', 'DND'],
    maxHourlyBroadcast: 500
  }
};

export const MarketingSettingsSection: React.FC<MarketingSettingsProps> = ({
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
    sectionId: 'marketing',
    scope: 'company',
    companyId: selectedCompanyId
  });

  const [activeTab, setActiveTab] = useState<TabType>('rules');

  // Active Company Preset
  const activePreset = useMemo(() => {
    return MARKETING_PRESETS[selectedCompanyId] || MARKETING_PRESETS.RWC;
  }, [selectedCompanyId]);

  // Form States & Resolvers
  const dedupeKey = data?.dedupeKey || activePreset.dedupeKey;
  const duplicateAction = data?.duplicateAction || activePreset.duplicateAction;
  const dailyCap = data?.dailyCap !== undefined ? data.dailyCap : activePreset.dailyCap;
  const staleThresholdDays = data?.staleThresholdDays !== undefined ? data.staleThresholdDays : activePreset.staleThresholdDays;
  const autoReassignInactive = data?.autoReassignInactive !== undefined ? data.autoReassignInactive : activePreset.autoReassignInactive;
  const consentEnforced = data?.consentEnforced !== undefined ? data.consentEnforced : activePreset.consentEnforced;
  const maxHourlyBroadcast = data?.maxHourlyBroadcast !== undefined ? data.maxHourlyBroadcast : activePreset.maxHourlyBroadcast;

  // New Keyword input for Consent tab
  const [newKeyword, setNewKeyword] = useState('');
  const suppressionKeywords: string[] = useMemo(() => {
    if (data && Array.isArray(data.suppressionKeywords) && data.suppressionKeywords.length > 0) {
      return data.suppressionKeywords;
    }
    return activePreset.suppressionKeywords;
  }, [data, activePreset]);

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    const clean = newKeyword.trim().toUpperCase();
    if (!suppressionKeywords.includes(clean)) {
      const updated = [...suppressionKeywords, clean];
      updateField('suppressionKeywords', updated);
      toast('Keyword Added', `Added "${clean}" to suppression keywords.`);
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kw: string) => {
    const updated = suppressionKeywords.filter((k) => k !== kw);
    updateField('suppressionKeywords', updated);
    toast('Keyword Removed', `Removed "${kw}" from suppression list.`);
  };

  const handleManualSave = async () => {
    try {
      await saveSettings();
      toast('Marketing Settings Saved', 'Deduplication, workload quotas, and compliance rules synchronized.');
    } catch (err: any) {
      toast('Save Failed', err.message || 'Unable to persist changes.', 'warning');
    }
  };

  const handleManualReset = () => {
    updateField('dedupeKey', activePreset.dedupeKey);
    updateField('duplicateAction', activePreset.duplicateAction);
    updateField('dailyCap', activePreset.dailyCap);
    updateField('staleThresholdDays', activePreset.staleThresholdDays);
    updateField('autoReassignInactive', activePreset.autoReassignInactive);
    updateField('consentEnforced', activePreset.consentEnforced);
    updateField('suppressionKeywords', activePreset.suppressionKeywords);
    updateField('maxHourlyBroadcast', activePreset.maxHourlyBroadcast);
    toast('Defaults Restored', `Settings reset to default for ${selectedCompanyId}.`, 'info');
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
          <span>Loading marketing configuration...</span>
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

        {/* ========================================================================= */}
        {/* TOP NAVIGATION TABS */}
        {/* ========================================================================= */}
        <div className="flex items-center space-x-1 border-b border-[#E0E5E7] dark:border-[#222D34] pb-px overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'rules'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Database className="h-4 w-4" />
            <span>Contact Rules</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('allocation')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'allocation'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <UsersRound className="h-4 w-4" />
            <span>Allocation & Workload</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('consent')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'consent'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Consent & Compliance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('campaigns')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'campaigns'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Campaign Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'import'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>Import & Data</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* EXECUTIVE BANNER: Contact Deduplication & Marketing Governance */}
        {/* ========================================================================= */}
        <div className="relative rounded-2xl overflow-hidden border border-[#E0E5E7] dark:border-[#222D34] bg-white dark:bg-[#202C33] p-5 shadow-sm transition-colors">
          {/* Subtle curved emerald gradient accent on right */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#128C7E]/10 dark:from-[#25D366]/10 to-transparent pointer-events-none" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                  Contact Deduplication & Marketing Governance
                </h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                  Define how to identify duplicate contacts, manage allocation quotas, and maintain compliant marketing outreach.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#DDF5EC] dark:bg-[#005C4B]/30 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20">
                <span className="h-1.5 w-1.5 rounded-full bg-[#128C7E] dark:bg-[#25D366] animate-pulse" />
                <span>Configured</span>
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4 TOP STAT CARDS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CARD 1: Total Contacts */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center space-x-3.5 transition-colors">
            <div className="h-11 w-11 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#667781] dark:text-[#8696A0]">Total Contacts</p>
              <h4 className="text-xl sm:text-2xl font-bold text-[#111B21] dark:text-[#E9EDEF] tracking-tight">
                {activePreset.totalContacts}
              </h4>
              <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">
                {activePreset.scopeLabel}
              </p>
            </div>
          </div>

          {/* CARD 2: Duplicate Records */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center space-x-3.5 transition-colors">
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <CopyCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#667781] dark:text-[#8696A0]">Duplicate Records</p>
              <h4 className="text-xl sm:text-2xl font-bold text-[#111B21] dark:text-[#E9EDEF] tracking-tight">
                {activePreset.duplicateCount}
              </h4>
              <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">
                {activePreset.duplicatePercent}
              </p>
            </div>
          </div>

          {/* CARD 3: Active Coordinators */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center space-x-3.5 transition-colors">
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#667781] dark:text-[#8696A0]">Active Coordinators</p>
              <h4 className="text-xl sm:text-2xl font-bold text-[#111B21] dark:text-[#E9EDEF] tracking-tight">
                {activePreset.activeCoordinators}
              </h4>
              <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">
                Assigned for outreach
              </p>
            </div>
          </div>

          {/* CARD 4: Marketing Campaigns */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center space-x-3.5 transition-colors">
            <div className="h-11 w-11 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#667781] dark:text-[#8696A0]">Marketing Campaigns</p>
              <h4 className="text-xl sm:text-2xl font-bold text-[#111B21] dark:text-[#E9EDEF] tracking-tight">
                {activePreset.totalCampaigns}
              </h4>
              <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">
                {activePreset.activeCampaigns} active • {activePreset.completedCampaigns} completed
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: CONTACT RULES (Default / Main View Matching Mockup) */}
        {/* ========================================================================= */}
        {activeTab === 'rules' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT CARD: Contact Deduplication & Ingestion Governance */}
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
              <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                <div className="h-8 w-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                    Contact Deduplication & Ingestion Governance
                  </h3>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                    Rules applied during CSV imports and public marketing contact entry.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Field 1: Duplicate Match Criterion */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                  <div className="flex items-start space-x-3">
                    <div className="h-7 w-7 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Phone className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">
                        Duplicate Match Criterion
                      </h4>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                        How to identify the same contact
                      </p>
                    </div>
                  </div>

                  <select
                    value={dedupeKey}
                    onChange={(e) => updateField('dedupeKey', e.target.value)}
                    className="w-full sm:w-64 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-medium focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer shrink-0"
                  >
                    <option value="phone_e164">Strict Normalized Phone (E.164 +94...)</option>
                    <option value="phone_or_email">Normalized Phone OR Email Address</option>
                    <option value="phone_and_company">Phone Number within Same Brand</option>
                  </select>
                </div>

                {/* Field 2: Duplicate Resolution Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                  <div className="flex items-start space-x-3">
                    <div className="h-7 w-7 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0 mt-0.5">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">
                        Duplicate Resolution Action
                      </h4>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                        What to do when a duplicate is found
                      </p>
                    </div>
                  </div>

                  <select
                    value={duplicateAction}
                    onChange={(e) => updateField('duplicateAction', e.target.value)}
                    className="w-full sm:w-64 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-medium focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer shrink-0"
                  >
                    <option value="update_existing">Update Existing Record (Keep Original Owner)</option>
                    <option value="skip">Skip / Reject Duplicate (Preserve Existing)</option>
                    <option value="flag_review">Create Flagged Review Task</option>
                  </select>
                </div>
              </div>
            </div>

            {/* RIGHT CARD: Marketing Allocation Limits & Workload */}
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
              <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                  <UsersRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                    Marketing Allocation Limits & Workload
                  </h3>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                    Prevent coordinator burnout during high-volume outreach campaigns.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Field 1: Daily Allocation Cap per Staff */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                  <div className="flex items-start space-x-3">
                    <div className="h-7 w-7 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
                      <Layers className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">
                        Daily Allocation Cap per Staff
                      </h4>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                        Maximum new contacts per day
                      </p>
                    </div>
                  </div>

                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={dailyCap}
                    onChange={(e) => updateField('dailyCap', parseInt(e.target.value) || 50)}
                    className="w-24 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                </div>

                {/* Field 2: Stale Lead Threshold (Days) */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                  <div className="flex items-start space-x-3">
                    <div className="h-7 w-7 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Calendar className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">
                        Stale Lead Threshold (Days)
                      </h4>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                        When a lead is considered inactive
                      </p>
                    </div>
                  </div>

                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={staleThresholdDays}
                    onChange={(e) => updateField('staleThresholdDays', parseInt(e.target.value) || 7)}
                    className="w-24 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                </div>

                {/* Field 3: Reassignment on Inactivity */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                  <div className="flex items-start space-x-3">
                    <div className="h-7 w-7 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">
                        Reassignment on Inactivity
                      </h4>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                        Automatically reassign stale contacts
                      </p>
                    </div>
                  </div>

                  <select
                    value={String(autoReassignInactive)}
                    onChange={(e) => updateField('autoReassignInactive', e.target.value === 'true')}
                    className="w-full sm:w-64 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-medium focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer shrink-0"
                  >
                    <option value="true">Enabled (Recirculate stale contacts)</option>
                    <option value="false">Disabled (Retain initial coordinator)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ALLOCATION & WORKLOAD (Detailed View) */}
        {/* ========================================================================= */}
        {activeTab === 'allocation' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-5">
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
                <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                      <UsersRound className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                        Coordinator Workload & Round-Robin Policies
                      </h3>
                      <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                        Manage active batch allocation quotas, queue overflow, and fair distribution algorithms.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#DDF5EC] dark:bg-[#005C4B]/30 text-[#128C7E] dark:text-[#25D366]">
                    {activePreset.activeCoordinators} Coordinators Active
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 space-y-2">
                      <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Daily Cap per Coordinator</h4>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">Limits new inbound lead intake per 24 hour rolling window.</p>
                      <input
                        type="number"
                        min="10"
                        max="500"
                        value={dailyCap}
                        onChange={(e) => updateField('dailyCap', parseInt(e.target.value) || 50)}
                        className="w-full bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-bold focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 space-y-2">
                      <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Inactivity Reassignment Window</h4>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">Recirculates leads if no first response is logged within X days.</p>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={staleThresholdDays}
                        onChange={(e) => updateField('staleThresholdDays', parseInt(e.target.value) || 7)}
                        className="w-full bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-bold focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div>
                      <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Automatic Queue Recirculation</h4>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                        Automatically strip dormant leads from offline coordinators and reassign to available staff.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('autoReassignInactive', !autoReassignInactive)}
                      className="cursor-pointer"
                    >
                      <div className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${autoReassignInactive ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoReassignInactive ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-5">
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                  <ShieldCheck className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                  <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Fair Allocation Guard</h4>
                </div>
                <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                  Ensures all {activePreset.activeCoordinators} coordinators receive a balanced distribution of high-intent WhatsApp and web leads.
                </p>
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
                  Coordinators reaching their daily quota ({dailyCap} leads) are paused until 00:00 UTC+05:30.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CONSENT & COMPLIANCE */}
        {/* ========================================================================= */}
        {activeTab === 'consent' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-5">
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
                <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                        WhatsApp Consent & Opt-Out Suppression
                      </h3>
                      <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                        Ensure compliance with WhatsApp Cloud API policies, Meta marketing guidelines, and patient data privacy.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Compliant Mode
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div>
                      <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Enforce Marketing Opt-In Consent</h4>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                        Block broadcast campaigns to contacts who have not explicitly provided opt-in permission.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('consentEnforced', !consentEnforced)}
                      className="cursor-pointer"
                    >
                      <div className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${consentEnforced ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${consentEnforced ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>

                  {/* Suppression Keywords Management */}
                  <div className="p-4 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 space-y-3">
                    <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Opt-Out Trigger Keywords</h4>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                      Incoming WhatsApp messages matching these keywords immediately unsubscribe the contact and halt automated broadcasts.
                    </p>

                    <form onSubmit={handleAddKeyword} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add keyword (e.g. STOP, CANCEL)"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        className="flex-1 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] uppercase focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        Add
                      </button>
                    </form>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {suppressionKeywords.map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        >
                          <span>{kw}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveKeyword(kw)}
                            className="hover:text-rose-800 dark:hover:text-rose-200 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-5">
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                  <Lock className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                  <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">WhatsApp Business Protection</h4>
                </div>
                <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                  Honoring opt-out keywords prevents your WhatsApp Official Business Account from receiving spam reports, keeping your phone number quality rating in High (Green) status.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: CAMPAIGN SETTINGS */}
        {/* ========================================================================= */}
        {activeTab === 'campaigns' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-5">
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
                <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                      Broadcast Pacing & Outreach Throttle
                    </h3>
                    <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                      Configure message dispatch speeds and rate limiters to comply with Meta Cloud API Tier boundaries.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 space-y-2">
                    <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Maximum Hourly Broadcast Messages</h4>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                      Caps mass marketing messages sent per hour to avoid triggering Meta anti-spam throttles.
                    </p>
                    <div className="flex items-center space-x-3 pt-1">
                      <input
                        type="number"
                        min="50"
                        max="2000"
                        step="50"
                        value={maxHourlyBroadcast}
                        onChange={(e) => updateField('maxHourlyBroadcast', parseInt(e.target.value) || 250)}
                        className="w-32 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                      />
                      <span className="text-xs text-[#667781] dark:text-[#8696A0]">messages / hour</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-5">
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                  <Send className="h-4 w-4 text-purple-500" />
                  <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Active Campaigns Overview</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <span className="text-[#667781] dark:text-[#8696A0]">Active Campaigns</span>
                    <span className="font-bold text-[#111B21] dark:text-[#E9EDEF]">{activePreset.activeCampaigns} Running</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <span className="text-[#667781] dark:text-[#8696A0]">Completed Campaigns</span>
                    <span className="font-bold text-[#111B21] dark:text-[#E9EDEF]">{activePreset.completedCampaigns} Archived</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#667781] dark:text-[#8696A0]">Current Dispatch Pacing</span>
                    <span className="font-bold text-emerald-500">Normal (Safe)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: IMPORT & DATA */}
        {/* ========================================================================= */}
        {activeTab === 'import' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-5">
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
                <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="h-8 w-8 rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <Upload className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                      CSV Ingestion & Field Mapping Guidelines
                    </h3>
                    <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                      Configure standard headers for automated contact import into {selectedCompanyId}.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-4 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 space-y-2">
                    <h4 className="font-bold text-[#111B21] dark:text-[#E9EDEF]">Standard Recognized CSV Columns</h4>
                    <ul className="list-disc list-inside space-y-1 text-[#667781] dark:text-[#8696A0] text-[11px]">
                      <li><code className="text-[#128C7E] dark:text-[#25D366]">phone</code> or <code className="text-[#128C7E] dark:text-[#25D366]">mobile</code> — Normalized to E.164 (+94...)</li>
                      <li><code className="text-[#128C7E] dark:text-[#25D366]">full_name</code> or <code className="text-[#128C7E] dark:text-[#25D366]">name</code> — Contact legal display name</li>
                      <li><code className="text-[#128C7E] dark:text-[#25D366]">email</code> — Primary email address</li>
                      <li><code className="text-[#128C7E] dark:text-[#25D366]">source</code> — Lead origin tag (e.g. Meta Ads, Expo)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-5">
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                  <FileCheck2 className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                  <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Deduplication on Import</h4>
                </div>
                <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                  Any incoming record matching an existing contact based on <strong>{dedupeKey}</strong> will automatically execute: <strong>{duplicateAction}</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BOTTOM ACTION BAR */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#E0E5E7] dark:border-[#222D34]">
          <button
            type="button"
            onClick={handleManualReset}
            className="px-4 py-2 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] text-xs font-semibold flex items-center space-x-1.5 hover:bg-[#E0E5E7] dark:hover:bg-[#2A3942] transition-colors cursor-pointer"
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
    </SettingsLayout>
  );
};

export default MarketingSettingsSection;