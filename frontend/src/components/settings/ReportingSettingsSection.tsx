import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Target,
  DollarSign,
  Percent
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';

interface ReportingSettingsProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

export const ReportingSettingsSection: React.FC<ReportingSettingsProps> = ({
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
    sectionId: 'reporting',
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
          <span>Loading reporting settings...</span>
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

        {/* 1. Target KPI & Goals */}
        <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
          <div className="border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] uppercase tracking-wider flex items-center gap-2">
              <Target className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
              Monthly Commercial & Clinical Conversion Targets
            </h3>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">Set company-specific benchmarks for executive progress indicators</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Monthly Revenue Target ({selectedCompanyId})</label>
              <input
                type="number"
                value={data.monthlyRevenueTarget || 5000000}
                onChange={(e) => updateField('monthlyRevenueTarget', parseInt(e.target.value, 10))}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Target Conversion Rate (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={data.targetConversionRate || 25}
                onChange={(e) => updateField('targetConversionRate', parseInt(e.target.value, 10))}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Target Response Time (Mins)</label>
              <input
                type="number"
                min={1}
                max={120}
                value={data.targetResponseTimeMins || 15}
                onChange={(e) => updateField('targetResponseTimeMins', parseInt(e.target.value, 10))}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
};

