import React, { useState } from 'react';
import {
  Mail,
  Send,
  Lock,
  Server,
  Bell,
  CheckCircle2,
  AlertCircle,
  RotateCw
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';
import { API_BASE_URL } from '../../config/api';

interface EmailNotificationsProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

export const EmailNotificationsSection: React.FC<EmailNotificationsProps> = ({
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
    sectionId: 'email_notifications',
    scope: 'global'
  });

  const [testEmailTo, setTestEmailTo] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);

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
          <span>Loading email configuration...</span>
        </div>
      </SettingsLayout>
    );
  }

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailTo.trim()) return;

    setIsSendingTest(true);
    setTestStatus(null);
    try {
      const token =
        localStorage.getItem('rw_crm_auth_token') ||
        localStorage.getItem('royal_crm_token') ||
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token') ||
        '';
      const base = API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : '';
      const res = await fetch(`${base}/api/settings/email/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ recipient: testEmailTo.trim() })
      });
      const json = await res.json();
      if (json.success) {
        setTestStatus({ success: true, message: json.message || 'Test email dispatched successfully!' });
      } else {
        setTestStatus({ success: false, message: json.error || 'Failed to dispatch test email.' });
      }
    } catch (err: any) {
      setTestStatus({ success: false, message: err.message || 'Network error dispatching test email.' });
    } finally {
      setIsSendingTest(false);
    }
  };

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

        {/* 1. SMTP Outbound Server Configuration */}
        <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
          <div className="border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] uppercase tracking-wider flex items-center gap-2">
              <Server className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
              Corporate SMTP Outbound Mail Server
            </h3>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">Credentials are encrypted with AES-256-GCM at rest and masked in responses</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">SMTP Host</label>
              <input
                type="text"
                value={data.smtpHost || 'smtp.office365.com'}
                onChange={(e) => updateField('smtpHost', e.target.value)}
                placeholder="smtp.office365.com"
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Port</label>
              <select
                value={data.smtpPort || 587}
                onChange={(e) => updateField('smtpPort', parseInt(e.target.value, 10))}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer font-mono"
              >
                <option value={587}>587 (TLS/STARTTLS — Recommended)</option>
                <option value={465}>465 (SSL)</option>
                <option value={25}>25 (Unencrypted Standard)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">SMTP Username / Email</label>
              <input
                type="text"
                value={data.smtpUser ?? ''}
                onChange={(e) => updateField('smtpUser', e.target.value)}
                placeholder="notifications@royalwellness.lk"
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Encrypted SMTP Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="password"
                  value={data.smtpPassword ?? ''}
                  onChange={(e) => updateField('smtpPassword', e.target.value)}
                  placeholder="Enter new password to update"
                  className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-9 pr-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">Sender From Display Name</label>
              <input
                type="text"
                value={data.senderName ?? 'Alpha Health Group CRM'}
                onChange={(e) => updateField('senderName', e.target.value)}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
              />
            </div>
          </div>

          {/* Test Email Dispatcher */}
          <div className="p-4 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl space-y-3">
            <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF] block">Dispatch Real-Time Verification Email</span>
            <form onSubmit={handleSendTestEmail} className="flex gap-2">
              <input
                type="email"
                placeholder="recipient@example.com"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                className="flex-1 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-lg px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] placeholder-[#667781] dark:placeholder-[#8696A0] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={isSendingTest}
                className="px-4 py-2 bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                {isSendingTest ? (
                  <>
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Test Email</span>
                  </>
                )}
              </button>
            </form>

            {testStatus && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center space-x-2 ${
                  testStatus.success
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                    : 'bg-red-500/10 border border-red-500/20 text-red-300'
                }`}
              >
                {testStatus.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <span>{testStatus.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Notification Event Toggles */}
        <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
          <div className="border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] uppercase tracking-wider flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
              Event Notification Subscriptions
            </h3>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">Toggle automated email dispatch triggers across operational events</p>
          </div>

          <div className="space-y-3">
            {[
              { id: 'notifyNewLead', label: 'New Lead Ingestion Notification', desc: 'Alert manager when high-intent web lead arrives' },
              { id: 'notifyDealWon', label: 'Deal Won / Revenue Celebration', desc: 'Broadcast celebratory email to executive leaders' },
              { id: 'notifyDailySummary', label: 'Daily Operational Summary Digest', desc: 'Dispatch 8:00 AM summary report of active consultations and cases' },
              { id: 'notifySecurityAlert', label: 'Critical Security Event Alert', desc: 'Immediate notification on multiple failed logins or lockouts' }
            ].map(item => (
              <div
                key={item.id}
                className="p-3.5 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF] block">{item.label}</span>
                  <span className="text-[11px] text-[#667781] dark:text-[#8696A0]">{item.desc}</span>
                </div>
                <input
                  type="checkbox"
                  checked={data[item.id] !== false}
                  onChange={(e) => updateField(item.id, e.target.checked)}
                  className="h-4 w-4 text-emerald-600 rounded bg-white dark:bg-[#202C33] border-[#E0E5E7] dark:border-[#222D34] focus:ring-emerald-500"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
};

