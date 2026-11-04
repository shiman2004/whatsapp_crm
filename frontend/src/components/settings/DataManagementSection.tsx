import React from 'react';
import {
  HardDrive,
  Download,
  Upload,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';

interface DataManagementProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

export const DataManagementSection: React.FC<DataManagementProps> = ({
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
    sectionId: 'data_management',
    scope: 'global'
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
          <span>Loading data management parameters...</span>
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

        {/* 1. Automated Backups & Cloud Snapshots */}
        <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
          <div className="border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] uppercase tracking-wider flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
              Automated Supabase PostgreSQL Backups & Retention
            </h3>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">Continuous Point-in-Time Recovery (PITR) and daily automated snapshots</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Backup Frequency</label>
              <select
                value={data.backupFrequency || 'daily_midnight'}
                onChange={(e) => updateField('backupFrequency', e.target.value)}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
              >
                <option value="daily_midnight">Daily at 00:00 (Midnight IST)</option>
                <option value="every_6h">Every 6 Hours</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Snapshot Retention Period</label>
              <select
                value={data.snapshotRetentionDays || 30}
                onChange={(e) => updateField('snapshotRetentionDays', parseInt(e.target.value, 10))}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
              >
                <option value={7}>7 Days</option>
                <option value={30}>30 Days (Standard Enterprise)</option>
                <option value={90}>90 Days</option>
                <option value={365}>1 Year (Statutory Compliance)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Storage Tier</label>
              <div className="p-2.5 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34]/80 rounded-xl text-xs text-[#128C7E] dark:text-[#25D366] flex items-center space-x-2 font-mono">
                <ShieldCheck className="h-4 w-4" />
                <span>Supabase Cloud (Encrypted)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Bulk Data Export Utilities */}
        <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
          <div className="border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
              Enterprise Data Export & Portability
            </h3>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">Download company-scoped data files in standard CSV / JSON format</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { name: 'Export Contacts Database', ext: 'CSV', count: '10,400+ Records' },
              { name: 'Export Deals & Pipeline', ext: 'CSV', count: '4,200+ Leads' },
              { name: 'Export Audit Log Trail', ext: 'JSON', count: 'Full Cryptographic Trail' }
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF] block">{item.name}</span>
                  <span className="text-[10px] text-slate-400">{item.count}</span>
                </div>
                <button
                  type="button"
                  onClick={() => alert(`Initiating secure encrypted ${item.ext} export download...`)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[#111B21] dark:text-[#E9EDEF] hover:text-white transition-colors"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
};

