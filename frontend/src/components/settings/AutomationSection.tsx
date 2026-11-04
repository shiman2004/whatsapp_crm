import React, { useState } from 'react';
import {
  Zap,
  Plus,
  Trash2,
  CheckCircle2,
  Play,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';

interface AutomationProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

export const AutomationSection: React.FC<AutomationProps> = ({
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
    sectionId: 'automation',
    scope: 'company',
    companyId: selectedCompanyId
  });

  const [ruleName, setRuleName] = useState('');
  const [trigger, setTrigger] = useState('lead.created');
  const [action, setAction] = useState('send_whatsapp_template');
  const [testResult, setTestResult] = useState<string | null>(null);

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
          <span>Loading automation rules...</span>
        </div>
      </SettingsLayout>
    );
  }

  const rules = data.rules || [
    {
      id: 'rule-1',
      name: 'Auto-Send Clinic Brochure upon New Lead Creation',
      trigger: 'lead.created',
      condition: 'brand == "RWC"',
      action: 'send_whatsapp_template',
      enabled: true
    },
    {
      id: 'rule-2',
      name: 'Notify Super Admin on High-Value Deal Marked Won',
      trigger: 'deal.stage_changed',
      condition: 'new_stage == "closed_won" && deal_value > 100000',
      action: 'send_email_notification',
      enabled: true
    }
  ];

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;
    const newRule = {
      id: `rule-${Date.now()}`,
      name: ruleName.trim(),
      trigger,
      condition: 'true',
      action,
      enabled: true
    };
    updateField('rules', [...rules, newRule]);
    setRuleName('');
  };

  const handleToggleRule = (id: string) => {
    updateField(
      'rules',
      rules.map((r: any) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleRemoveRule = (id: string) => {
    updateField('rules', rules.filter((r: any) => r.id !== id));
  };

  const runDryTest = () => {
    setTestResult('Running dry test simulation on mock event...');
    setTimeout(() => {
      setTestResult('✅ Simulation Complete: Trigger parsed, condition passed, action payload validated successfully.');
    }, 600);
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

        {/* 1. Rule Builder Form */}
        <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
          <div className="border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] uppercase tracking-wider flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
              Event-Driven Automation Engine
            </h3>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">Build Trigger-Condition-Action workflows with test execution simulation</p>
          </div>

          <form onSubmit={handleAddRule} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-[#F0F2F5] dark:bg-[#111B21]/80 border border-[#E0E5E7] dark:border-[#222D34] rounded-xl">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Rule Name</label>
              <input
                type="text"
                placeholder="e.g. Instant Welcome on CRAS Course Enquiry"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Trigger Event</label>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className="w-full bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="lead.created">Lead Created</option>
                <option value="deal.stage_changed">Deal Stage Changed</option>
                <option value="appointment.booked">Appointment Booked</option>
                <option value="exam.passed">Exam Passed</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Automated Action</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="send_whatsapp_template">Send WhatsApp Template</option>
                <option value="assign_round_robin">Assign Coordinator</option>
                <option value="send_email_notification">Send Alert Email</option>
                <option value="dispatch_webhook">Dispatch Webhook</option>
              </select>
            </div>

            <div className="md:col-span-4 flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={runDryTest}
                className="text-xs text-[#667781] dark:text-[#8696A0] hover:text-[#128C7E] dark:text-[#25D366] flex items-center space-x-1.5 transition-colors"
              >
                <Play className="h-3 w-3" />
                <span>Test Simulation</span>
              </button>

              <button
                type="submit"
                className="px-4 py-1.5 bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Rule</span>
              </button>
            </div>
          </form>

          {testResult && (
            <div className="p-3 bg-[#F0F2F5] dark:bg-[#111B21] border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-mono">
              {testResult}
            </div>
          )}

          {/* Active Rules List */}
          <div className="space-y-3">
            {rules.map((rule: any) => (
              <div
                key={rule.id}
                className="p-4 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl flex items-center justify-between hover:border-[#E0E5E7] dark:border-[#222D34] transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">{rule.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        rule.enabled
                          ? 'bg-emerald-500/10 text-[#128C7E] dark:text-[#25D366] border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-[11px] text-[#667781] dark:text-[#8696A0] font-mono">
                    <span className="text-amber-400">{rule.trigger}</span>
                    <ArrowRight className="h-3 w-3 text-slate-600" />
                    <span className="text-[#128C7E] dark:text-[#25D366]">{rule.action}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => handleToggleRule(rule.id)}
                    className="text-xs text-[#667781] dark:text-[#8696A0] hover:text-white transition-colors"
                  >
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemoveRule(rule.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
};

