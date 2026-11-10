import React, { useState } from 'react';
import {
  HardDrive,
  Download,
  ShieldCheck,
  FileSpreadsheet,
  RotateCw
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';
import { API_BASE_URL } from '../../config/api';

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

  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const getToken = () =>
    localStorage.getItem('rw_crm_auth_token') ||
    localStorage.getItem('royal_crm_token') ||
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    '';

  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const csvCell = (val: unknown) => {
    const str = String(val ?? '');
    return `"${str.replace(/"/g, '""')}"`;
  };

  const handleExport = async (type: 'contacts' | 'leads' | 'audit') => {
    setExportingKey(type);
    setExportStatus(null);
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : '';
    const dateStamp = new Date().toISOString().split('T')[0];

    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      if (type === 'audit') {
        const res = await fetch(`${base}/api/settings/audit-logs?limit=200`, { headers });
        const json = await res.json();
        const logs = json?.logs || json?.data || [];
        triggerDownload(`crm_audit_logs_${dateStamp}.json`, JSON.stringify(logs, null, 2), 'application/json');
        setExportStatus({ success: true, message: `Exported ${logs.length} audit log records.` });
      } else {
        const companyParam = selectedCompanyId && selectedCompanyId !== 'ALL' ? `&company=${encodeURIComponent(selectedCompanyId)}` : '';
        const res = await fetch(`${base}/api/leads?limit=500${companyParam}`, { headers });
        const json = await res.json();
        const rows: any[] = Array.isArray(json) ? json : (json?.leads || json?.data || []);

        if (type === 'contacts') {
          const header = ['LeadSerial', 'Name', 'Phone', 'Email', 'Company', 'Source', 'CreatedAt'].join(',');
          const lines = rows.map(r => [
            csvCell(r.serial || r.id),
            csvCell(r.customer?.displayName || r.name || ''),
            csvCell(r.customer?.phone || r.phone || ''),
            csvCell(r.customer?.email || ''),
            csvCell(r.company || ''),
            csvCell(r.source || ''),
            csvCell(r.createdAt || '')
          ].join(','));
          triggerDownload(`crm_contacts_${dateStamp}.csv`, [header, ...lines].join('\n'), 'text/csv;charset=utf-8;');
          setExportStatus({ success: true, message: `Exported ${rows.length} contacts to CSV.` });
        } else {
          const header = ['LeadID', 'Serial', 'PatientName', 'Phone', 'Company', 'Stage', 'Treatment', 'AssignedTo', 'CreatedAt'].join(',');
          const lines = rows.map(r => [
            csvCell(r.id),
            csvCell(r.serial || ''),
            csvCell(r.customer?.displayName || r.name || ''),
            csvCell(r.customer?.phone || r.phone || ''),
            csvCell(r.company || ''),
            csvCell(r.stage || ''),
            csvCell(r.treatmentName || r.treatment || ''),
            csvCell(r.assignedTo || ''),
            csvCell(r.createdAt || '')
          ].join(','));
          triggerDownload(`crm_pipeline_leads_${dateStamp}.csv`, [header, ...lines].join('\n'), 'text/csv;charset=utf-8;');
          setExportStatus({ success: true, message: `Exported ${rows.length} pipeline leads to CSV.` });
        }
      }
    } catch (err: any) {
      setExportStatus({ success: false, message: err?.message || 'Export failed. Check network or permissions.' });
    } finally {
      setExportingKey(null);
    }
  };

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
              { key: 'contacts' as const, name: 'Export Contacts Database', ext: 'CSV', subtitle: 'Patient & Student Contact Directory' },
              { key: 'leads' as const, name: 'Export Deals & Pipeline', ext: 'CSV', subtitle: 'Company-Scoped Pipeline Leads' },
              { key: 'audit' as const, name: 'Export Audit Log Trail', ext: 'JSON', subtitle: 'Security & Settings Audit Trail' }
            ].map((item) => {
              const isBusy = exportingKey === item.key;
              return (
                <div
                  key={item.key}
                  className="p-3.5 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF] block">{item.name}</span>
                    <span className="text-[10px] text-[#667781] dark:text-[#8696A0]">{item.subtitle} ({item.ext})</span>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleExport(item.key)}
                    title={`Download ${item.name} (${item.ext})`}
                    className="p-2 rounded-lg bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] hover:bg-[#DDF5EC] dark:hover:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isBusy ? <RotateCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </button>
                </div>
              );
            })}
          </div>

          {exportStatus && (
            <div className={`p-3 rounded-xl text-xs border ${exportStatus.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'}`}>
              {exportStatus.message}
            </div>
          )}
        </div>
      </div>
    </SettingsLayout>
  );
};

