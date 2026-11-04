import React from 'react';
import {
  Palette,
  Sun,
  Moon,
  Monitor,
  Globe,
  Sliders
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';

interface AppearanceProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

export const AppearanceSection: React.FC<AppearanceProps> = ({
  currentSectionId,
  onSelectSection,
  selectedCompanyId,
  onSelectCompany
}) => {
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
    sectionId: 'appearance',
    scope: 'user'
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
          <span>Loading user preferences...</span>
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

        {/* 1. Theme & Visual Preferences */}
        <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
          <div className="border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] uppercase tracking-wider flex items-center gap-2">
              <Palette className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
              User Interface Theme & Display Density
            </h3>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">Personal preferences saved to your authenticated account</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Theme Mode</label>
              <select
                value={data.theme || 'dark'}
                onChange={(e) => updateField('theme', e.target.value)}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
              >
                <option value="dark">Enterprise Dark (Emerald / Slate)</option>
                <option value="system">Follow Operating System</option>
                <option value="light">Light Mode</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Interface Density</label>
              <select
                value={data.density || 'comfortable'}
                onChange={(e) => updateField('density', e.target.value)}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
              >
                <option value="comfortable">Comfortable (Default)</option>
                <option value="compact">Compact (High Information Density)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Preferred Language</label>
              <select
                value={data.language || 'en'}
                onChange={(e) => updateField('language', e.target.value)}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
              >
                <option value="en">English (UK/Global)</option>
                <option value="si">සිංහල (Sinhala)</option>
                <option value="ta">தமிழ் (Tamil)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
};

