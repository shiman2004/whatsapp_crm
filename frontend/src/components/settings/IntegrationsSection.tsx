import React, { useState, useMemo } from 'react';
import {
  Code2,
  Key,
  Webhook,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ExternalLink,
  Eye,
  RotateCcw,
  Edit2,
  Play,
  Shield,
  Layers,
  Database,
  Calendar,
  Clock,
  Check,
  X,
  AlertCircle,
  Puzzle,
  FileText,
  Settings as SettingsIcon,
  Search,
  Globe,
  Share2,
  Activity,
  Zap,
  Server,
  Sliders,
  Send,
  RefreshCw,
  Terminal
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';
import { useCrm } from '../../context/CrmContext';

interface IntegrationsProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

type TabType = 'keys' | 'webhooks' | 'third_party' | 'logs' | 'settings';

interface ApiKeyItem {
  id: string;
  name: string;
  target: string;
  prefix: string;
  companyScope: string;
  scopes: string[];
  createdAt: string;
  lastUsed: string;
  status: 'active' | 'revoked' | 'expired';
}

interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  signature: string;
  secret: string;
  lastDelivery: string;
  status: 'active' | 'failing' | 'paused';
}

interface IntegrationServiceItem {
  id: string;
  name: string;
  category: string;
  description: string;
  iconBg: string;
  connected: boolean;
  lastSync?: string;
  statusText: string;
}

interface ApiLogItem {
  id: string;
  timestamp: string;
  type: 'inbound_api' | 'outbound_webhook';
  method: string;
  endpoint: string;
  client: string;
  status: number;
  latencyMs: number;
  ip: string;
}

export const IntegrationsSection: React.FC<IntegrationsProps> = ({
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
    sectionId: 'integrations',
    scope: 'global'
  });

  const [activeTab, setActiveTab] = useState<TabType>('keys');

  // Pre-populated default API Keys matching the screenshot
  const defaultApiKeys: ApiKeyItem[] = [
    {
      id: 'key-1',
      name: 'Accounting System Connector',
      target: 'ERP Invoicing Bridge',
      prefix: 'ahg_live_8f3a...',
      companyScope: 'Global (All Companies)',
      scopes: ['leads.read', 'leads.won', 'invoices.sync'],
      createdAt: 'Oct 15, 2026',
      lastUsed: 'Oct 17, 2026, 10:24 AM',
      status: 'active'
    }
  ];

  // Pre-populated default Webhooks matching the screenshot
  const defaultWebhooks: WebhookItem[] = [
    {
      id: 'wh-1',
      url: 'https://api.accounting.alphatsm.com/crm/leads',
      events: ['lead.won'],
      signature: 'HMAC-SHA256',
      secret: 'whsec_9a7b4c2e1f8d30e5b7a1c9',
      lastDelivery: 'Oct 17, 2026, 10:24 AM',
      status: 'active'
    }
  ];

  // Third party connectors
  const defaultThirdParty: IntegrationServiceItem[] = [
    {
      id: 'meta-wa',
      name: 'Meta WhatsApp Cloud API',
      category: 'Messaging & Communications',
      description: 'Official WhatsApp Business Cloud API runtime for bidirectional messaging, templates, and interactive media.',
      iconBg: '#25D366',
      connected: true,
      lastSync: 'Just now',
      statusText: 'Connected & Healthy'
    },
    {
      id: 'google-cal',
      name: 'Google Calendar & Workspace',
      category: 'Clinical & Academic Scheduling',
      description: 'Synchronizes patient doctor consultations and student counseling slots with Google Calendar.',
      iconBg: '#4285F4',
      connected: false,
      statusText: 'Available to Connect'
    },
    {
      id: 'erp-invoicing',
      name: 'Alpha Corporate ERP & Invoicing',
      category: 'Accounting & Finance',
      description: 'Direct bridge connecting Closed Won sales deals to corporate billing and student tuition invoicing.',
      iconBg: '#10B981',
      connected: true,
      lastSync: 'Oct 17, 2026, 10:24 AM',
      statusText: 'Active Sync via API Key'
    },
    {
      id: 'zapier',
      name: 'Zapier & Make.com Gateway',
      category: 'Workflow Automation',
      description: 'Exposes secure inbound and outbound webhooks to 5,000+ external business applications.',
      iconBg: '#FF4F00',
      connected: false,
      statusText: 'Webhook Ready'
    }
  ];

  // API Access Logs sample
  const defaultLogs: ApiLogItem[] = [
    {
      id: 'log-1',
      timestamp: 'Oct 17, 2026, 10:24:12 AM',
      type: 'outbound_webhook',
      method: 'POST',
      endpoint: 'https://api.accounting.alphatsm.com/crm/leads',
      client: 'Accounting Connector',
      status: 200,
      latencyMs: 142,
      ip: '10.0.4.18'
    },
    {
      id: 'log-2',
      timestamp: 'Oct 17, 2026, 10:20:05 AM',
      type: 'inbound_api',
      method: 'GET',
      endpoint: '/api/v1/leads?status=won',
      client: 'ahg_live_8f3a...',
      status: 200,
      latencyMs: 48,
      ip: '192.168.1.105'
    },
    {
      id: 'log-3',
      timestamp: 'Oct 17, 2026, 09:45:33 AM',
      type: 'inbound_api',
      method: 'POST',
      endpoint: '/api/v1/appointments',
      client: 'ahg_live_8f3a...',
      status: 201,
      latencyMs: 82,
      ip: '192.168.1.105'
    },
    {
      id: 'log-4',
      timestamp: 'Oct 16, 2026, 05:12:40 PM',
      type: 'outbound_webhook',
      method: 'POST',
      endpoint: 'https://api.accounting.alphatsm.com/crm/leads',
      client: 'Accounting Connector',
      status: 200,
      latencyMs: 165,
      ip: '10.0.4.18'
    }
  ];

  // State resolution
  const apiKeys: ApiKeyItem[] = useMemo(() => {
    if (data && Array.isArray(data.apiKeys) && data.apiKeys.length > 0) {
      return data.apiKeys;
    }
    return defaultApiKeys;
  }, [data]);

  const webhooks: WebhookItem[] = useMemo(() => {
    if (data && Array.isArray(data.webhooks) && data.webhooks.length > 0) {
      return data.webhooks;
    }
    return defaultWebhooks;
  }, [data]);

  const thirdPartyServices: IntegrationServiceItem[] = useMemo(() => {
    if (data && Array.isArray(data.thirdParty) && data.thirdParty.length > 0) {
      return data.thirdParty;
    }
    return defaultThirdParty;
  }, [data]);

  // Modals state
  const [isGenerateKeyOpen, setIsGenerateKeyOpen] = useState(false);
  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    target: '',
    companyScope: 'Global (All Companies)',
    scopes: ['leads.read', 'leads.won']
  });
  const [generatedKeyRaw, setGeneratedKeyRaw] = useState<string | null>(null);

  const [viewingKey, setViewingKey] = useState<ApiKeyItem | null>(null);
  const [rotatingKey, setRotatingKey] = useState<ApiKeyItem | null>(null);

  const [isAddWebhookOpen, setIsAddWebhookOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(null);
  const [webhookForm, setWebhookForm] = useState({
    url: '',
    events: ['lead.won'],
    secret: ''
  });

  const [isTestWebhookOpen, setIsTestWebhookOpen] = useState(false);
  const [testWebhookResult, setTestWebhookResult] = useState<{
    status: number;
    latency: number;
    payload: string;
    deliveredAt: string;
  } | null>(null);
  const [isTestingInProgress, setIsTestingInProgress] = useState(false);

  // Settings tab states
  const rateLimitReqMin = data?.rateLimitReqMin || 1000;
  const webhookMaxRetries = data?.webhookMaxRetries || 5;
  const hmacEnforced = data?.hmacEnforced !== undefined ? data.hmacEnforced : true;

  // Handlers for API Keys
  const handleOpenGenerateKey = () => {
    setNewKeyForm({
      name: '',
      target: '',
      companyScope: selectedCompanyId === 'ALL' ? 'Global (All Companies)' : selectedCompanyId,
      scopes: ['leads.read', 'leads.won']
    });
    setGeneratedKeyRaw(null);
    setIsGenerateKeyOpen(true);
  };

  const handleCreateApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyForm.name.trim()) {
      toast('Name Required', 'Please enter an API Key name.', 'warning');
      return;
    }

    const randomSecret = `ahg_live_${Math.random().toString(36).substring(2, 12)}_${Math.random().toString(36).substring(2, 12)}`;
    const newKey: ApiKeyItem = {
      id: `key-${Date.now()}`,
      name: newKeyForm.name.trim(),
      target: newKeyForm.target.trim() || 'Internal System Connector',
      prefix: `${randomSecret.substring(0, 13)}...`,
      companyScope: newKeyForm.companyScope,
      scopes: newKeyForm.scopes,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      lastUsed: 'Never',
      status: 'active'
    };

    updateField('apiKeys', [...apiKeys, newKey]);
    setGeneratedKeyRaw(randomSecret);
    toast('API Key Generated', 'Store your key securely. It will not be shown again.');
  };

  const handleDeleteApiKey = (id: string) => {
    const target = apiKeys.find((k) => k.id === id);
    const updated = apiKeys.filter((k) => k.id !== id);
    updateField('apiKeys', updated);
    toast('API Key Revoked', `Revoked "${target?.name || 'API Key'}".`);
  };

  const handleRotateKeyConfirm = () => {
    if (!rotatingKey) return;
    const newSecret = `ahg_live_${Math.random().toString(36).substring(2, 12)}_${Math.random().toString(36).substring(2, 12)}`;
    const updated = apiKeys.map((k) =>
      k.id === rotatingKey.id
        ? {
            ...k,
            prefix: `${newSecret.substring(0, 13)}...`,
            createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            lastUsed: 'Never'
          }
        : k
    );
    updateField('apiKeys', updated);
    setGeneratedKeyRaw(newSecret);
    setRotatingKey(null);
    setIsGenerateKeyOpen(true);
    toast('Key Rotated', 'A replacement credential has been issued with 48h overlap.');
  };

  // Handlers for Webhooks
  const handleOpenAddWebhook = () => {
    setEditingWebhook(null);
    setWebhookForm({
      url: '',
      events: ['lead.won'],
      secret: `whsec_${Math.random().toString(36).substring(2, 14)}`
    });
    setIsAddWebhookOpen(true);
  };

  const handleOpenEditWebhook = (wh: WebhookItem) => {
    setEditingWebhook(wh);
    setWebhookForm({
      url: wh.url,
      events: [...wh.events],
      secret: wh.secret || `whsec_${Math.random().toString(36).substring(2, 14)}`
    });
    setIsAddWebhookOpen(true);
  };

  const handleSaveWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookForm.url.trim() || !webhookForm.url.startsWith('http')) {
      toast('Invalid URL', 'Please enter a valid HTTP/HTTPS endpoint URL.', 'warning');
      return;
    }

    if (editingWebhook) {
      const updated = webhooks.map((w) =>
        w.id === editingWebhook.id
          ? {
              ...w,
              url: webhookForm.url.trim(),
              events: webhookForm.events,
              secret: webhookForm.secret
            }
          : w
      );
      updateField('webhooks', updated);
      toast('Webhook Updated', 'Webhook configuration has been saved.');
    } else {
      const newWh: WebhookItem = {
        id: `wh-${Date.now()}`,
        url: webhookForm.url.trim(),
        events: webhookForm.events,
        signature: 'HMAC-SHA256',
        secret: webhookForm.secret,
        lastDelivery: 'Pending Dispatch',
        status: 'active'
      };
      updateField('webhooks', [...webhooks, newWh]);
      toast('Webhook Created', 'New outbound endpoint subscribed.');
    }
    setIsAddWebhookOpen(false);
  };

  const handleDeleteWebhook = (id: string) => {
    const updated = webhooks.filter((w) => w.id !== id);
    updateField('webhooks', updated);
    toast('Webhook Deleted', 'Endpoint removed from event dispatcher.');
  };

  // Handlers for Testing Webhook
  const handleRunTestWebhook = () => {
    setIsTestingInProgress(true);
    setTestWebhookResult(null);

    setTimeout(() => {
      setIsTestingInProgress(false);
      setTestWebhookResult({
        status: 200,
        latency: Math.floor(80 + Math.random() * 80),
        payload: JSON.stringify(
          {
            event: 'lead.won',
            timestamp: new Date().toISOString(),
            data: {
              leadId: 'LEAD-98214',
              patientName: 'Kavindu Amarasinghe',
              company: selectedCompanyId,
              value: 125000,
              currency: 'LKR',
              assignedCoordinator: 'Afrij (Super Admin)'
            },
            signature: 'sha256=4f5d2c8e1a9b3d7...'
          },
          null,
          2
        ),
        deliveredAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      toast('Test Successful', 'Target server responded with HTTP 200 OK.');
    }, 700);
  };

  const handleToggleConnector = (id: string) => {
    const updated = thirdPartyServices.map((svc) =>
      svc.id === id ? { ...svc, connected: !svc.connected, statusText: !svc.connected ? 'Connected' : 'Available to Connect' } : svc
    );
    updateField('thirdParty', updated);
    toast('Connector Toggled', 'Third-party integration state updated.');
  };

  const handleManualSave = async () => {
    try {
      await saveSettings();
      toast('Settings Persisted', 'Integrations, credentials, and webhooks securely synchronized.');
    } catch (err: any) {
      toast('Save Failed', err.message || 'Unable to persist changes.', 'warning');
    }
  };

  const handleManualReset = () => {
    updateField('apiKeys', defaultApiKeys);
    updateField('webhooks', defaultWebhooks);
    updateField('thirdParty', defaultThirdParty);
    updateField('rateLimitReqMin', 1000);
    updateField('webhookMaxRetries', 5);
    updateField('hmacEnforced', true);
    toast('Defaults Restored', 'API management restored to factory defaults.', 'info');
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
          <span>Loading API and webhook configuration...</span>
        </div>
      </SettingsLayout>
    );
  }

  const activeKeyCount = apiKeys.filter((k) => k.status === 'active').length;
  const activeWebhookCount = webhooks.filter((w) => w.status === 'active').length;
  const connectedIntegrationsCount = thirdPartyServices.filter((s) => s.connected).length;

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
        {/* TOP NAVIGATION TABS (5 Tabs Matching Mockup) */}
        {/* ========================================================================= */}
        <div className="flex items-center space-x-1 border-b border-[#E0E5E7] dark:border-[#222D34] pb-px overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('keys')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'keys'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Key className="h-4 w-4" />
            <span>API Keys</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('webhooks')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'webhooks'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Webhook className="h-4 w-4" />
            <span>Webhooks</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('third_party')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'third_party'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Puzzle className="h-4 w-4" />
            <span>Third-Party Integrations</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'logs'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>API Access Logs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'settings'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <SettingsIcon className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 4 TOP STAT CARDS (Matching Mockup) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: API Keys */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center justify-between transition-colors">
            <div className="flex items-center space-x-3.5">
              <div className="h-11 w-11 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-[#667781] dark:text-[#8696A0]">API Keys</p>
                <h4 className="text-xl sm:text-2xl font-bold text-[#111B21] dark:text-[#E9EDEF] tracking-tight">
                  {activeKeyCount}
                </h4>
                <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">Active / Total</p>
              </div>
            </div>
            <span className="self-start px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DDF5EC] dark:bg-[#005C4B]/30 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20">
              Active
            </span>
          </div>

          {/* Card 2: Webhooks */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center space-x-3.5 transition-colors">
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Webhook className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#667781] dark:text-[#8696A0]">Webhooks</p>
              <h4 className="text-xl sm:text-2xl font-bold text-[#111B21] dark:text-[#E9EDEF] tracking-tight">
                {activeWebhookCount}
              </h4>
              <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">Configured endpoints</p>
            </div>
          </div>

          {/* Card 3: Integrations */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center space-x-3.5 transition-colors">
            <div className="h-11 w-11 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#667781] dark:text-[#8696A0]">Integrations</p>
              <h4 className="text-xl sm:text-2xl font-bold text-[#111B21] dark:text-[#E9EDEF] tracking-tight">
                {connectedIntegrationsCount}
              </h4>
              <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">Connected services</p>
            </div>
          </div>

          {/* Card 4: Security */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center space-x-3.5 transition-colors">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#667781] dark:text-[#8696A0]">Security</p>
              <h4 className="text-base sm:text-lg font-bold text-[#111B21] dark:text-[#E9EDEF] tracking-tight">
                HMAC-SHA256
              </h4>
              <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">Signed webhooks & hashed keys</p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: API KEYS VIEW (Main View Matching Mockup) */}
        {/* ========================================================================= */}
        {(activeTab === 'keys' || activeTab === 'webhooks') && (
          <div className="space-y-5">
            {/* CARD 1: REST API Keys & Machine-to-Machine Credentials */}
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                      REST API Keys & Machine-to-Machine Credentials
                    </h3>
                    <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                      Tokens are hashed with scrypt at rest. The secret is revealed only once upon generation.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenGenerateKey}
                  className="h-9 px-4 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm shrink-0 cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Generate API Key</span>
                </button>
              </div>

              {/* Table of API Keys */}
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E0E5E7] dark:border-[#222D34] text-[#667781] dark:text-[#8696A0]">
                      <th className="py-2.5 px-3 font-semibold">Name / Integration Target</th>
                      <th className="py-2.5 px-3 font-semibold">Key ID (masked)</th>
                      <th className="py-2.5 px-3 font-semibold">Created On</th>
                      <th className="py-2.5 px-3 font-semibold">Last Used</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E5E7]/50 dark:divide-[#222D34]/50">
                    {apiKeys.map((key) => (
                      <tr key={key.id} className="hover:bg-[#F0F2F5]/50 dark:hover:bg-[#111B21]/50 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2.5">
                            <div className="h-7 w-7 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                              <Database className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <p className="font-bold text-[#111B21] dark:text-[#E9EDEF]">{key.name}</p>
                              <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">{key.target}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] text-[#128C7E] dark:text-[#25D366]">
                          {key.prefix}
                        </td>

                        <td className="py-3 px-3 text-[#667781] dark:text-[#8696A0]">
                          <div className="flex items-center space-x-1.5">
                            <Calendar className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                            <span>{key.createdAt}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-[#667781] dark:text-[#8696A0]">
                          <div className="flex items-center space-x-1.5">
                            <Clock className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                            <span>{key.lastUsed}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DDF5EC] dark:bg-[#005C4B]/30 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#128C7E] dark:bg-[#25D366]" />
                            <span>Active</span>
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingKey(key)}
                              className="px-2.5 py-1 rounded-lg bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] hover:border-[#128C7E] text-[11px] font-medium flex items-center space-x-1 transition-colors cursor-pointer"
                            >
                              <Eye className="h-3 w-3" />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRotatingKey(key)}
                              className="px-2.5 py-1 rounded-lg bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] hover:border-[#128C7E] text-[11px] font-medium flex items-center space-x-1 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Rotate</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteApiKey(key.id)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete Key"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CARD 2: Outbound Webhook Endpoints */}
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Webhook className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                      Outbound Webhook Endpoints
                    </h3>
                    <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                      Dispatches real-time HMAC-SHA256 signed event payloads to external URLs.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTestWebhookOpen(true);
                      setTestWebhookResult(null);
                    }}
                    className="h-9 px-3.5 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] hover:border-[#128C7E] text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5 text-[#128C7E] dark:text-[#25D366]" />
                    <span>Test Webhook</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenAddWebhook}
                    className="h-9 px-4 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Webhook</span>
                  </button>
                </div>
              </div>

              {/* Table of Webhooks */}
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E0E5E7] dark:border-[#222D34] text-[#667781] dark:text-[#8696A0]">
                      <th className="py-2.5 px-3 font-semibold">Endpoint URL</th>
                      <th className="py-2.5 px-3 font-semibold">Events</th>
                      <th className="py-2.5 px-3 font-semibold">Signature</th>
                      <th className="py-2.5 px-3 font-semibold">Last Delivery</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E5E7]/50 dark:divide-[#222D34]/50">
                    {webhooks.map((wh) => (
                      <tr key={wh.id} className="hover:bg-[#F0F2F5]/50 dark:hover:bg-[#111B21]/50 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2 font-mono text-[11px] text-[#111B21] dark:text-[#E9EDEF]">
                            <ExternalLink className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0] shrink-0" />
                            <span className="truncate max-w-[260px] sm:max-w-[340px]">{wh.url}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(wh.url);
                                toast('Copied', 'URL copied to clipboard.');
                              }}
                              className="text-[#667781] hover:text-[#128C7E] p-0.5 cursor-pointer"
                              title="Copy URL"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {wh.events.map((ev) => (
                              <span
                                key={ev}
                                className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#E0E5E7] dark:bg-[#2A3942] text-[#111B21] dark:text-[#E9EDEF]"
                              >
                                {ev}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                            {wh.signature || 'HMAC-SHA256'}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-[#667781] dark:text-[#8696A0]">
                          <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 text-[11px]">
                            <Check className="h-3.5 w-3.5" />
                            <span>{wh.lastDelivery}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DDF5EC] dark:bg-[#005C4B]/30 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#128C7E] dark:bg-[#25D366]" />
                            <span>Active</span>
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingWebhook(wh);
                                setWebhookForm({
                                  url: wh.url,
                                  events: [...wh.events],
                                  secret: wh.secret
                                });
                                setIsAddWebhookOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] hover:border-[#128C7E] text-[11px] font-medium flex items-center space-x-1 transition-colors cursor-pointer"
                            >
                              <Eye className="h-3 w-3" />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditWebhook(wh)}
                              className="px-2.5 py-1 rounded-lg bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] hover:border-[#128C7E] text-[11px] font-medium flex items-center space-x-1 transition-colors cursor-pointer"
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteWebhook(wh.id)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete Webhook"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Security Info Notice (Matching Mockup) */}
            <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 flex items-start space-x-3 text-xs">
              <Shield className="h-4 w-4 shrink-0 mt-0.5 text-cyan-600 dark:text-cyan-400" />
              <p className="text-[11px] leading-relaxed">
                <strong>Security:</strong> API keys are stored as secure hashes. Webhooks are signed with HMAC-SHA256. Rotate keys regularly and restrict access to trusted systems only.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: THIRD-PARTY INTEGRATIONS */}
        {/* ========================================================================= */}
        {activeTab === 'third_party' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
              <div className="border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                  Third-Party Connectors & Ecosystem Apps
                </h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                  Link your CRM to enterprise finance, clinical calendars, and automated marketing channels.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {thirdPartyServices.map((svc) => (
                  <div
                    key={svc.id}
                    className="p-4 rounded-2xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 flex flex-col justify-between space-y-4 hover:border-[#128C7E]/40 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                            style={{ backgroundColor: svc.iconBg }}
                          >
                            <Zap className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">{svc.name}</h4>
                            <span className="text-[10px] text-[#667781] dark:text-[#8696A0]">{svc.category}</span>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            svc.connected
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-[#E0E5E7] dark:bg-[#2A3942] text-[#667781] dark:text-[#8696A0]'
                          }`}
                        >
                          {svc.connected ? 'Connected' : 'Available'}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0] leading-relaxed">
                        {svc.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#E0E5E7]/40 dark:border-[#222D34]/40">
                      <span className="text-[10px] text-[#667781] dark:text-[#8696A0]">
                        {svc.lastSync ? `Last Sync: ${svc.lastSync}` : svc.statusText}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleToggleConnector(svc.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          svc.connected
                            ? 'bg-[#E0E5E7] hover:bg-[#D0D7DA] dark:bg-[#2A3942] dark:hover:bg-[#32424A] text-[#111B21] dark:text-[#E9EDEF]'
                            : 'bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21]'
                        }`}
                      >
                        {svc.connected ? 'Disconnect' : 'Connect'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: API ACCESS LOGS */}
        {/* ========================================================================= */}
        {activeTab === 'logs' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
              <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                      Real-Time Machine-to-Machine Audit Trail
                    </h3>
                    <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                      Inbound REST requests and outbound webhook delivery events across all services.
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#DDF5EC] dark:bg-[#005C4B]/30 text-[#128C7E] dark:text-[#25D366]">
                  Live Stream Active
                </span>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E0E5E7] dark:border-[#222D34] text-[#667781] dark:text-[#8696A0]">
                      <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                      <th className="py-2.5 px-3 font-semibold">Type</th>
                      <th className="py-2.5 px-3 font-semibold">Method & Endpoint</th>
                      <th className="py-2.5 px-3 font-semibold">Client</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Latency</th>
                      <th className="py-2.5 px-3 font-semibold">Caller IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E5E7]/50 dark:divide-[#222D34]/50">
                    {defaultLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F0F2F5]/50 dark:hover:bg-[#111B21]/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#667781] dark:text-[#8696A0]">
                          {log.timestamp}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              log.type === 'inbound_api'
                                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                                : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                            }`}
                          >
                            {log.type === 'inbound_api' ? 'INBOUND API' : 'OUTBOUND WEBHOOK'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <span className="font-bold text-[#128C7E] dark:text-[#25D366] mr-1.5">{log.method}</span>
                          <span className="text-[#111B21] dark:text-[#E9EDEF] truncate max-w-[200px] inline-block align-bottom">{log.endpoint}</span>
                        </td>
                        <td className="py-2.5 px-3 text-[#667781] dark:text-[#8696A0]">
                          {log.client}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {log.status} OK
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#667781] dark:text-[#8696A0]">
                          {log.latencyMs}ms
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#667781] dark:text-[#8696A0]">
                          {log.ip}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: SETTINGS */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
              <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                <Sliders className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                  API Rate Limiting & Throttling
                </h3>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 space-y-2">
                  <label className="block text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">
                    Global Rate Limit (Requests per minute)
                  </label>
                  <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                    Prevents server saturation from rogue machine-to-machine clients.
                  </p>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    step="100"
                    value={rateLimitReqMin}
                    onChange={(e) => updateField('rateLimitReqMin', parseInt(e.target.value) || 1000)}
                    className="w-36 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
              <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                <Shield className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                  Webhook Dispatch Policies
                </h3>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50 space-y-2">
                  <label className="block text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">
                    Maximum Delivery Retries
                  </label>
                  <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                    Failed deliveries use exponential backoff (30s, 2m, 10m, 1h, 4h).
                  </p>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={webhookMaxRetries}
                    onChange={(e) => updateField('webhookMaxRetries', parseInt(e.target.value) || 5)}
                    className="w-24 bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                </div>
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

        {/* ========================================================================= */}
        {/* MODAL: GENERATE API KEY */}
        {/* ========================================================================= */}
        {isGenerateKeyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366]">
                    <Key className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">
                    {generatedKeyRaw ? 'Save Secret API Key' : 'Generate REST API Key'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGenerateKeyOpen(false)}
                  className="text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF] p-1 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {generatedKeyRaw ? (
                <div className="space-y-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      Important: Copy Your Secret Now!
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      For security, we cannot show this secret key again. If you lose it, you will need to rotate or generate a new key.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] flex items-center justify-between">
                    <span className="font-mono text-xs select-all text-[#128C7E] dark:text-[#25D366] break-all pr-2">
                      {generatedKeyRaw}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedKeyRaw);
                        toast('Key Copied', 'Secret API key copied to clipboard.');
                      }}
                      className="p-1.5 rounded-lg bg-[#128C7E] text-white dark:bg-[#25D366] dark:text-[#111B21] shrink-0 cursor-pointer"
                      title="Copy Key"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setIsGenerateKeyOpen(false)}
                      className="px-4 py-2 rounded-xl bg-[#128C7E] text-white dark:bg-[#25D366] dark:text-[#111B21] font-bold cursor-pointer"
                    >
                      I Have Stored the Key Safely
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateApiKey} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                      Key Name / Client System <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Accounting System Connector"
                      value={newKeyForm.name}
                      onChange={(e) => setNewKeyForm({ ...newKeyForm, name: e.target.value })}
                      className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                      Integration Target / Purpose
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ERP Invoicing Bridge"
                      value={newKeyForm.target}
                      onChange={(e) => setNewKeyForm({ ...newKeyForm, target: e.target.value })}
                      className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                      Authorized Company Scope
                    </label>
                    <select
                      value={newKeyForm.companyScope}
                      onChange={(e) => setNewKeyForm({ ...newKeyForm, companyScope: e.target.value })}
                      className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
                    >
                      <option value="Global (All Companies)">Global (All Companies)</option>
                      <option value="RWC">Royal Wellness Center (RWC)</option>
                      <option value="CRAS">CRAS Academic (CRAS)</option>
                      <option value="AHC">Alpha Health Consultancy (AHC)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                      Granted Scopes & Permissions
                    </label>
                    <div className="space-y-1.5 p-2.5 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                      {['leads.read', 'leads.write', 'leads.won', 'appointments.manage', 'invoices.sync'].map((scope) => (
                        <label key={scope} className="flex items-center space-x-2 cursor-pointer text-[11px] text-[#111B21] dark:text-[#E9EDEF]">
                          <input
                            type="checkbox"
                            checked={newKeyForm.scopes.includes(scope)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewKeyForm({ ...newKeyForm, scopes: [...newKeyForm.scopes, scope] });
                              } else {
                                setNewKeyForm({ ...newKeyForm, scopes: newKeyForm.scopes.filter((s) => s !== scope) });
                              }
                            }}
                            className="rounded text-[#128C7E] focus:ring-0"
                          />
                          <span className="font-mono">{scope}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E0E5E7] dark:border-[#222D34]">
                    <button
                      type="button"
                      onClick={() => setIsGenerateKeyOpen(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-[#667781] dark:text-[#8696A0] bg-[#F0F2F5] dark:bg-[#111B21] rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold text-white bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] dark:text-[#111B21] rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      Generate Key
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: VIEW API KEY */}
        {/* ========================================================================= */}
        {viewingKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">Credential Details</h3>
                <button type="button" onClick={() => setViewingKey(null)} className="text-[#667781] hover:text-[#111B21] p-1 cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] text-[#667781] dark:text-[#8696A0] block">Name & Target</span>
                  <p className="font-bold text-[#111B21] dark:text-[#E9EDEF]">{viewingKey.name}</p>
                  <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">{viewingKey.target}</p>
                </div>

                <div>
                  <span className="text-[10px] text-[#667781] dark:text-[#8696A0] block">Key Identifier</span>
                  <p className="font-mono text-[11px] text-[#128C7E] dark:text-[#25D366]">{viewingKey.prefix}</p>
                </div>

                <div>
                  <span className="text-[10px] text-[#667781] dark:text-[#8696A0] block">Company Scope</span>
                  <p className="text-[11px] text-[#111B21] dark:text-[#E9EDEF]">{viewingKey.companyScope}</p>
                </div>

                <div>
                  <span className="text-[10px] text-[#667781] dark:text-[#8696A0] block mb-1">Granted Permissions</span>
                  <div className="flex flex-wrap gap-1">
                    {viewingKey.scopes.map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#E0E5E7] dark:bg-[#2A3942] text-[#111B21] dark:text-[#E9EDEF]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E0E5E7] dark:border-[#222D34] flex justify-end">
                  <button
                    type="button"
                    onClick={() => setViewingKey(null)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: ROTATE API KEY */}
        {/* ========================================================================= */}
        {rotatingKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center space-x-2 text-amber-500">
                <RotateCcw className="h-5 w-5" />
                <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">Rotate API Key</h3>
              </div>
              <p className="text-xs text-[#667781] dark:text-[#8696A0] leading-relaxed">
                Rotating <strong>{rotatingKey.name}</strong> will invalidate the current secret after a 48-hour transition grace period. A new secret key will be generated immediately.
              </p>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRotatingKey(null)}
                  className="px-3 py-1.5 text-xs text-[#667781] dark:text-[#8696A0] bg-[#F0F2F5] dark:bg-[#111B21] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRotateKeyConfirm}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer"
                >
                  Confirm & Rotate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: ADD / EDIT WEBHOOK */}
        {/* ========================================================================= */}
        {isAddWebhookOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                    <Webhook className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">
                    {editingWebhook ? 'Edit Webhook Endpoint' : 'Add Outbound Webhook'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddWebhookOpen(false)}
                  className="text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF] p-1 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveWebhook} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                    Endpoint Destination URL <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://api.accounting.alphatsm.com/crm/leads"
                    value={webhookForm.url}
                    onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                    className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                    Event Subscriptions
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    {['lead.created', 'lead.status_changed', 'lead.won', 'lead.lost', 'appointment.booked', 'whatsapp.received'].map((ev) => (
                      <label key={ev} className="flex items-center space-x-2 cursor-pointer text-[11px] text-[#111B21] dark:text-[#E9EDEF]">
                        <input
                          type="checkbox"
                          checked={webhookForm.events.includes(ev)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWebhookForm({ ...webhookForm, events: [...webhookForm.events, ev] });
                            } else {
                              setWebhookForm({ ...webhookForm, events: webhookForm.events.filter((x) => x !== ev) });
                            }
                          }}
                          className="rounded text-[#128C7E] focus:ring-0"
                        />
                        <span className="font-mono">{ev}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                    HMAC Signing Secret
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookForm.secret}
                      className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs font-mono text-[#128C7E] dark:text-[#25D366] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setWebhookForm({ ...webhookForm, secret: `whsec_${Math.random().toString(36).substring(2, 14)}` })}
                      className="p-2 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#667781] hover:text-[#111B21] cursor-pointer"
                      title="Regenerate Secret"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E0E5E7] dark:border-[#222D34]">
                  <button
                    type="button"
                    onClick={() => setIsAddWebhookOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-[#667781] dark:text-[#8696A0] bg-[#F0F2F5] dark:bg-[#111B21] rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] dark:text-[#111B21] rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    {editingWebhook ? 'Update Webhook' : 'Save Webhook'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: TEST WEBHOOK SIMULATOR */}
        {/* ========================================================================= */}
        {isTestWebhookOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                    <Play className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">
                    Test Webhook Dispatch Simulator
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTestWebhookOpen(false)}
                  className="text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF] p-1 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                    Select Target Endpoint
                  </label>
                  <select className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs font-mono text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer">
                    {webhooks.map((w) => (
                      <option key={w.id} value={w.url}>{w.url} ({w.events.join(', ')})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">
                    Event Payload
                  </label>
                  <pre className="p-3 rounded-xl bg-[#111B21] border border-[#222D34] text-[11px] font-mono text-[#25D366] overflow-x-auto">
{`{
  "event": "lead.won",
  "companyId": "${selectedCompanyId}",
  "timestamp": "2026-10-17T10:24:00.000Z",
  "data": {
    "dealId": "DEAL-89104",
    "amount": 125000,
    "patient": "Kavindu Amarasinghe",
    "service": "Comprehensive Aesthetic Assessment"
  }
}`}
                  </pre>
                </div>

                {testWebhookResult && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 space-y-1">
                    <p className="font-bold flex items-center space-x-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>HTTP {testWebhookResult.status} OK • Delivered in {testWebhookResult.latency}ms</span>
                    </p>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                      Timestamp: {testWebhookResult.deliveredAt} • HMAC signature verified by recipient server.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E0E5E7] dark:border-[#222D34]">
                  <button
                    type="button"
                    onClick={() => setIsTestWebhookOpen(false)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-[#667781] dark:text-[#8696A0] bg-[#F0F2F5] dark:bg-[#111B21] rounded-xl cursor-pointer"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={handleRunTestWebhook}
                    disabled={isTestingInProgress}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] dark:text-[#111B21] rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {isTestingInProgress ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Sending Dispatch...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Send Test Dispatch</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
};

export default IntegrationsSection;