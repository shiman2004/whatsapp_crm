import React, { useState } from 'react';
import {
  Stethoscope,
  Clock,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';
import { TreatmentManagementTab } from '../admin/SuperAdminSettings/TreatmentManagementTab';

interface ClinicalSettingsProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

export const ClinicalSettingsSection: React.FC<ClinicalSettingsProps> = ({
  currentSectionId,
  onSelectSection,
  selectedCompanyId,
  onSelectCompany
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'treatments' | 'protocols'>('treatments');
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
    sectionId: 'clinical',
    scope: 'company',
    companyId: selectedCompanyId
  });

  if (isLoading) {
    return (
      <SettingsLayout
        currentSectionId={currentSectionId}
        onSelectSection={onSelectSection}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={onSelectCompany}
      >
        <div className="flex items-center justify-center h-64 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3" />
          <span>Loading clinical settings...</span>
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
      onSave={saveSettings}
      onDiscard={discardChanges}
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Sub-tab Switcher: Treatments Catalog vs Clinical Protocols */}
        <div className="flex items-center gap-2 border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
          <button
            type="button"
            onClick={() => setActiveSubTab('treatments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'treatments'
                ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#202C33]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-teal-500" />
            <span>RWC Clinical Treatments & Menu</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('protocols')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'protocols'
                ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#202C33]'
            }`}
          >
            <Stethoscope className="w-4 h-4 text-indigo-500" />
            <span>Scheduling Protocols & Buffer Times</span>
          </button>
        </div>

        {activeSubTab === 'treatments' ? (
          <TreatmentManagementTab />
        ) : (
          <div className="space-y-6">

        {/* 1. Appointment Scheduling Buffers */}
        <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
          <div className="border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
              Slot Durations & Buffer Times
            </h3>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">Manage treatment appointment lengths and sterilization intervals</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Default Consultation (Mins)</label>
              <select
                value={data.defaultDuration || 30}
                onChange={(e) => updateField('defaultDuration', parseInt(e.target.value, 10))}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
              >
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes (Standard Clinic Session)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Sterilization Buffer (Mins)</label>
              <select
                value={data.bufferBetweenSlots || 15}
                onChange={(e) => updateField('bufferBetweenSlots', parseInt(e.target.value, 10))}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
              >
                <option value={0}>0 Minutes (Back-to-back)</option>
                <option value={10}>10 Minutes</option>
                <option value={15}>15 Minutes (Recommended)</option>
                <option value={30}>30 Minutes</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Double-Booking Guard</label>
              <select
                value={data.preventDoubleBooking !== undefined ? String(data.preventDoubleBooking) : 'true'}
                onChange={(e) => updateField('preventDoubleBooking', e.target.value === 'true')}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
              >
                <option value="true">Strict (Block overlapping bookings)</option>
                <option value="false">Allow Warning Override</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. Cancellation & No-Show Policies */}
        <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
          <div className="border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
              Patient Cancellation & Reminder Policies
            </h3>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">Automated reminder triggers and cancellation cut-off times</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Cancellation Cut-Off Window</label>
              <select
                value={data.cancellationCutoffHours || 24}
                onChange={(e) => updateField('cancellationCutoffHours', parseInt(e.target.value, 10))}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
              >
                <option value={12}>12 Hours Prior</option>
                <option value={24}>24 Hours Prior (Standard)</option>
                <option value={48}>48 Hours Prior</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Automated SMS/WhatsApp Reminder</label>
              <select
                value={data.reminderHoursBefore || 24}
                onChange={(e) => updateField('reminderHoursBefore', parseInt(e.target.value, 10))}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
              >
                <option value={2}>2 Hours Before Appointment</option>
                <option value={12}>12 Hours Before Appointment</option>
                <option value={24}>24 Hours Before Appointment</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
</SettingsLayout>
  );
};

