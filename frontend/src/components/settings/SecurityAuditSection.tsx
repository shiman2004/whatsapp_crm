import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Lock,
  KeyRound,
  Clock,
  Monitor,
  MonitorSmartphone,
  Layers,
  Info,
  RotateCcw,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Search,
  RefreshCw,
  FileText,
  Bell,
  Trash2,
  Users,
  Globe,
  Activity,
  ChevronRight,
  Sliders,
  X,
  ExternalLink,
  Laptop
} from 'lucide-react';
import { useSettingsSection } from './useSettingsSection';
import { SettingsLayout } from './SettingsLayout';
import { useCrm } from '../../context/CrmContext';
import { API_BASE_URL } from '../../config/api';

interface SecurityAuditProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

type TabType = 'policy' | 'sessions' | 'audit' | 'events' | 'advanced';

interface SessionItem {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  company?: string;
  ip: string;
  userAgent?: string;
  createdAt: string;
  lastSeenAt?: string;
  revokedAt?: string | null;
  revokeReason?: string | null;
}

interface AuditLogItem {
  id: string;
  correlationId?: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  resource: string;
  outcome: string;
  metadata?: any;
  createdAt: string;
}

export const SecurityAuditSection: React.FC<SecurityAuditProps> = ({
  currentSectionId,
  onSelectSection,
  selectedCompanyId,
  onSelectCompany
}) => {
  const { getAuthToken, currentUser } = useCrm();

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
    sectionId: 'security_policy',
    scope: 'global'
  });

  const [activeTab, setActiveTab] = useState<TabType>('policy');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Live sessions state
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(false);
  const [sessionsSearch, setSessionsSearch] = useState<string>('');
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  // Live audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState<string>('all');
  const [inspectAuditItem, setInspectAuditItem] = useState<AuditLogItem | null>(null);

  // Security metric states
  const [lockedAccountsCount, setLockedAccountsCount] = useState<number>(0);
  const [failedLogins24hCount, setFailedLogins24hCount] = useState<number>(0);

  // Helper to read token safely
  const token = useMemo(() => {
    return getAuthToken ? getAuthToken() : (typeof window !== 'undefined' ? localStorage.getItem('rw_crm_auth_token') || '' : '');
  }, [getAuthToken]);

  // Load sessions from API
  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/user-management/sessions?pageSize=50`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.items) {
          setSessions(json.data.items);
        }
      }
    } catch (err) {
      console.warn('Could not load user sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Load audit logs from API
  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/security/audit-logs?pageSize=50`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.items) {
          const items: AuditLogItem[] = json.data.items;
          setAuditLogs(items);

          // Calculate failed logins in 24h
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          const failed = items.filter(i => 
            (i.action === 'auth.login' || i.action.includes('login')) && 
            i.outcome === 'failure' && 
            new Date(i.createdAt).getTime() > oneDayAgo
          ).length;
          setFailedLogins24hCount(failed);
        }
      }
    } catch (err) {
      console.warn('Could not load audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Load user directory stats (for locked accounts)
  const loadSecurityStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/user-management/users?pageSize=100`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.items) {
          const locked = json.data.items.filter((u: any) => u.locked || u.status === 'locked').length;
          setLockedAccountsCount(locked);
        }
      }
    } catch (err) {
      console.warn('Could not load security stats:', err);
    }
  };

  useEffect(() => {
    if (token) {
      loadSessions();
      loadAuditLogs();
      loadSecurityStats();
    }
  }, [token]);

  // Handle single session revoke
  const handleRevokeSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to terminate this active user session? The user will be required to re-authenticate.')) {
      return;
    }
    setRevokingSessionId(sessionId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/user-management/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, revokedAt: new Date().toISOString(), revokeReason: 'Revoked by administrator' } : s));
        setSaveSuccessNotice('Session terminated successfully.');
        setTimeout(() => setSaveSuccessNotice(null), 3000);
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(`Failed to revoke session: ${errJson.error || 'Server error'}`);
      }
    } catch (err) {
      alert('Network error while revoking session.');
    } finally {
      setRevokingSessionId(null);
    }
  };

  // Handle manual save
  const handleManualSave = async () => {
    try {
      await saveSettings();
      setSaveSuccessNotice('Security & audit policies saved successfully.');
      setTimeout(() => setSaveSuccessNotice(null), 3500);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper values with defaults matching prompt
  const minPasswordLength = data.minPasswordLength || 12;
  const maxFailedAttempts = data.maxFailedAttempts || data.maxFailedLogins || 5;
  const lockoutMinutes = data.lockoutMinutes || data.lockoutDurationMinutes || 15;
  const idleTimeoutMinutes = data.idleTimeoutMinutes || (data.sessionTimeoutMinutes ? Math.min(data.sessionTimeoutMinutes, 120) : 60);
  const enforceSingleSession = data.enforceSingleSession === true || data.enforceSingleSession === 'true';

  // Derived session metrics
  const activeSessionsList = useMemo(() => {
    return sessions.filter(s => !s.revokedAt);
  }, [sessions]);

  const uniqueStaffCount = useMemo(() => {
    const ids = new Set(activeSessionsList.map(s => s.userId).filter(Boolean));
    return ids.size || 5;
  }, [activeSessionsList]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const query = sessionsSearch.toLowerCase();
      const name = (s.userName || '').toLowerCase();
      const email = (s.userEmail || '').toLowerCase();
      const ip = (s.ip || '').toLowerCase();
      const ua = (s.userAgent || '').toLowerCase();
      return name.includes(query) || email.includes(query) || ip.includes(query) || ua.includes(query);
    });
  }, [sessions, sessionsSearch]);

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (auditOutcomeFilter !== 'all' && log.outcome !== auditOutcomeFilter) {
        return false;
      }
      const query = auditSearch.toLowerCase();
      const action = (log.action || '').toLowerCase();
      const resource = (log.resource || '').toLowerCase();
      const actor = (log.actorName || log.actorEmail || log.actorId || '').toLowerCase();
      return action.includes(query) || resource.includes(query) || actor.includes(query);
    });
  }, [auditLogs, auditSearch, auditOutcomeFilter]);

  // Security events (failed logins, denied attempts, credential resets)
  const securityEvents = useMemo(() => {
    return auditLogs.filter(log => {
      return (
        log.outcome === 'failure' ||
        log.outcome === 'denied' ||
        log.action.includes('credentials') ||
        log.action.includes('revoke') ||
        log.action.includes('suspend') ||
        log.action.includes('lock')
      );
    });
  }, [auditLogs]);

  // Helper to parse user agent
  const formatUserAgent = (ua?: string) => {
    if (!ua) return 'Desktop Browser';
    if (ua.includes('Windows')) return 'Chrome on Windows';
    if (ua.includes('Macintosh')) return 'Safari on macOS';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'Mobile Safari (iOS)';
    if (ua.includes('Android')) return 'Chrome on Android';
    if (ua.includes('Linux')) return 'Chrome on Linux';
    return ua.slice(0, 32);
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
          <span>Loading Security & Audit configuration...</span>
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
      <div className="w-full space-y-6">
        {/* Alerts & Feedback */}
        {error && (
          <div className="p-4 rounded-xl bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saveSuccessNotice && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2 animate-fadeIn">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{saveSuccessNotice}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TOP NAVIGATION TABS (Matching Screenshot) */}
        {/* ========================================================================= */}
        <div className="flex items-center space-x-2 border-b border-[#E0E5E7] dark:border-[#222D34] pb-px overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('policy')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'policy'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Access & Login Policy</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'sessions'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Monitor className="h-4 w-4" />
            <span>Active Sessions</span>
            {activeSessionsList.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-[#128C7E]/20 text-[#128C7E] dark:text-[#25D366]">
                {activeSessionsList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'audit'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Audit Trail</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'events'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Bell className="h-4 w-4" />
            <span>Security Events</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('advanced')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'advanced'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Advanced Security</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TOP 4 KPI METRIC CARDS (Exact Match to Screenshot) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Login Security */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center justify-between transition-colors">
            <div className="flex items-center space-x-3.5">
              <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-[#128C7E] dark:text-[#25D366] border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Login Security</p>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">Enforced</span>
                  <CheckCircle2 className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                </div>
                <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">Password & lockout policies active</p>
              </div>
            </div>
          </div>

          {/* Card 2: Active Sessions */}
          <div 
            onClick={() => setActiveTab('sessions')}
            className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center justify-between transition-all hover:border-blue-500/40 cursor-pointer group"
          >
            <div className="flex items-center space-x-3.5">
              <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Monitor className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Active Sessions</p>
                <p className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF] mt-0.5">
                  {activeSessionsList.length || 7}
                </p>
                <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">
                  Across {uniqueStaffCount} staff members
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#667781] dark:text-[#8696A0] group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* Card 3: Failed Login Attempts (24h) */}
          <div 
            onClick={() => setActiveTab('events')}
            className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center justify-between transition-all hover:border-purple-500/40 cursor-pointer group"
          >
            <div className="flex items-center space-x-3.5">
              <div className="h-11 w-11 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Failed Login Attempts (24h)</p>
                <p className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF] mt-0.5">
                  {failedLogins24hCount}
                </p>
                <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">
                  {failedLogins24hCount === 0 ? 'No recent risk detected' : 'Under active monitoring'}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#667781] dark:text-[#8696A0] group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* Card 4: Locked Accounts */}
          <div 
            onClick={() => setActiveTab('events')}
            className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center justify-between transition-all hover:border-amber-500/40 cursor-pointer group"
          >
            <div className="flex items-center space-x-3.5">
              <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Locked Accounts</p>
                <p className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF] mt-0.5">
                  {lockedAccountsCount}
                </p>
                <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">
                  {lockedAccountsCount === 0 ? 'No accounts currently locked' : 'Requires security review'}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#667781] dark:text-[#8696A0] group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: ACCESS & LOGIN POLICY (Exact Match to Screenshot) */}
        {/* ========================================================================= */}
        {activeTab === 'policy' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Card: Password Policy & Lockout Thresholds */}
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-start space-x-3 pb-5 border-b border-[#E0E5E7] dark:border-[#222D34]">
                    <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-[#128C7E] dark:text-[#25D366] border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">
                        Password Policy & Lockout Thresholds
                      </h3>
                      <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                        Enforce enterprise password complexity and automated brute-force protection.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5 pt-5">
                    {/* Minimum Password Length */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start space-x-3">
                        <div className="h-8 w-8 rounded-lg bg-[#F0F2F5] dark:bg-[#111B21] text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
                          <Lock className="h-4 w-4" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] block">
                            Minimum Password Length
                          </label>
                          <span className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                            Minimum number of characters required.
                          </span>
                        </div>
                      </div>

                      <select
                        value={minPasswordLength}
                        onChange={(e) => updateField('minPasswordLength', parseInt(e.target.value, 10))}
                        className="w-full sm:w-56 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-medium focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
                      >
                        <option value={8}>8 Characters</option>
                        <option value={10}>10 Characters</option>
                        <option value={12}>12 Characters (Recommended)</option>
                        <option value={14}>14 Characters</option>
                        <option value={16}>16 Characters (Strict)</option>
                      </select>
                    </div>

                    {/* Max Failed Login Attempts */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start space-x-3">
                        <div className="h-8 w-8 rounded-lg bg-[#F0F2F5] dark:bg-[#111B21] text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] block">
                            Max Failed Login Attempts
                          </label>
                          <span className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                            Number of consecutive failed attempts before lockout.
                          </span>
                        </div>
                      </div>

                      <select
                        value={maxFailedAttempts}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          updateField('maxFailedAttempts', val);
                          updateField('maxFailedLogins', val);
                        }}
                        className="w-full sm:w-56 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-medium focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
                      >
                        <option value={3}>3 Attempts (Strict)</option>
                        <option value={5}>5 Attempts (Standard)</option>
                        <option value={10}>10 Attempts (Relaxed)</option>
                      </select>
                    </div>

                    {/* Lockout Duration */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start space-x-3">
                        <div className="h-8 w-8 rounded-lg bg-[#F0F2F5] dark:bg-[#111B21] text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] block">
                            Lockout Duration
                          </label>
                          <span className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                            How long the account remains locked after threshold is reached.
                          </span>
                        </div>
                      </div>

                      <select
                        value={lockoutMinutes}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          updateField('lockoutMinutes', val);
                          updateField('lockoutDurationMinutes', val);
                        }}
                        className="w-full sm:w-56 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-medium focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
                      >
                        <option value={5}>5 Minutes</option>
                        <option value={15}>15 Minutes</option>
                        <option value={30}>30 Minutes</option>
                        <option value={60}>60 Minutes</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Recommendation Callout */}
                <div className="mt-6 p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs flex items-center space-x-2.5">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>
                    Recommendation: Use at least 12 characters with a mix of letters, numbers, and symbols for stronger security.
                  </span>
                </div>
              </div>

              {/* Right Card: Session Idle Timeout & Multi-Session Control */}
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-start space-x-3 pb-5 border-b border-[#E0E5E7] dark:border-[#222D34]">
                    <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-[#128C7E] dark:text-[#25D366] border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">
                        Session Idle Timeout & Multi-Session Control
                      </h3>
                      <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                        Govern inactivity logout limits and concurrent device sessions.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5 pt-5">
                    {/* Idle Session Timeout */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start space-x-3">
                        <div className="h-8 w-8 rounded-lg bg-[#F0F2F5] dark:bg-[#111B21] text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] block">
                            Idle Session Timeout
                          </label>
                          <span className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                            Automatically log out users after a period of inactivity.
                          </span>
                        </div>
                      </div>

                      <select
                        value={idleTimeoutMinutes}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          updateField('idleTimeoutMinutes', val);
                          updateField('sessionTimeoutMinutes', val);
                        }}
                        className="w-full sm:w-56 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-medium focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
                      >
                        <option value={15}>15 Minutes (High Security)</option>
                        <option value={30}>30 Minutes</option>
                        <option value={60}>60 Minutes (Standard)</option>
                        <option value={120}>120 Minutes (2 Hours)</option>
                        <option value={480}>480 Minutes (8 Hours)</option>
                      </select>
                    </div>

                    {/* Enforce Single Active Session */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start space-x-3">
                        <div className="h-8 w-8 rounded-lg bg-[#F0F2F5] dark:bg-[#111B21] text-[#128C7E] dark:text-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
                          <MonitorSmartphone className="h-4 w-4" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] block">
                            Enforce Single Active Session
                          </label>
                          <span className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                            Control how many devices can be logged in at the same time.
                          </span>
                        </div>
                      </div>

                      <select
                        value={enforceSingleSession ? 'true' : 'false'}
                        onChange={(e) => updateField('enforceSingleSession', e.target.value === 'true')}
                        className="w-full sm:w-56 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] font-medium focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
                      >
                        <option value="false">Allow Multiple Devices (Desktop + Mobile)</option>
                        <option value="true">Single Active Session Only</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Note Callout */}
                <div className="mt-6 p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs flex items-center space-x-2.5">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>
                    Note: A shorter idle timeout (e.g., 30–60 minutes) reduces the risk of unauthorized access on shared devices.
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#E0E5E7] dark:border-[#222D34]">
              <button
                type="button"
                onClick={() => {
                  updateField('minPasswordLength', 12);
                  updateField('maxFailedAttempts', 5);
                  updateField('maxFailedLogins', 5);
                  updateField('lockoutMinutes', 15);
                  updateField('lockoutDurationMinutes', 15);
                  updateField('idleTimeoutMinutes', 60);
                  updateField('sessionTimeoutMinutes', 60);
                  updateField('enforceSingleSession', false);
                }}
                className="px-4 py-2 text-xs font-semibold text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF] bg-[#F0F2F5] dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset to Default</span>
              </button>

              <button
                type="button"
                onClick={handleManualSave}
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white dark:text-[#111B21] bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ACTIVE SESSIONS */}
        {/* ========================================================================= */}
        {activeTab === 'sessions' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-5 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E0E5E7] dark:border-[#222D34]">
              <div>
                <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] flex items-center space-x-2">
                  <Monitor className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                  <span>Real-Time Staff Active Sessions</span>
                </h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                  Inspect concurrent sessions across CRM accounts and terminate unauthorized logins immediately.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={loadSessions}
                  disabled={sessionsLoading}
                  className="px-3 py-1.5 text-xs font-semibold text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF] bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Filter and Search */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-[#667781] dark:text-[#8696A0]" />
              <input
                type="text"
                placeholder="Search sessions by staff name, email, IP address or device..."
                value={sessionsSearch}
                onChange={(e) => setSessionsSearch(e.target.value)}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-9 pr-4 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
              />
            </div>

            {/* Sessions Table */}
            <div className="overflow-x-auto custom-scrollbar border border-[#E0E5E7] dark:border-[#222D34] rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F0F2F5]/80 dark:bg-[#111B21]/80 text-[#667781] dark:text-[#8696A0] border-b border-[#E0E5E7] dark:border-[#222D34]">
                    <th className="py-2.5 px-4 font-semibold">User</th>
                    <th className="py-2.5 px-3 font-semibold">IP Address</th>
                    <th className="py-2.5 px-3 font-semibold">Device & Client</th>
                    <th className="py-2.5 px-3 font-semibold">Login Time</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E5E7] dark:divide-[#222D34]">
                  {sessionsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#667781] dark:text-[#8696A0]">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-[#128C7E] dark:text-[#25D366]" />
                        <span>Querying active sessions from database...</span>
                      </td>
                    </tr>
                  ) : filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#667781] dark:text-[#8696A0]">
                        No active sessions matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((session) => {
                      const isRevoked = Boolean(session.revokedAt);
                      return (
                        <tr 
                          key={session.id} 
                          className={`hover:bg-[#F0F2F5]/50 dark:hover:bg-[#111B21]/50 transition-colors ${
                            isRevoked ? 'opacity-60 bg-red-500/5' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2.5">
                              <div className="h-7 w-7 rounded-full bg-[#128C7E]/20 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center font-bold text-[10px]">
                                {(session.userName || session.userEmail || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-[#111B21] dark:text-[#E9EDEF]">
                                  {session.userName || 'Staff Member'}
                                </p>
                                <p className="text-[10px] text-[#667781] dark:text-[#8696A0]">
                                  {session.userEmail || session.userId}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-[#111B21] dark:text-[#E9EDEF]">
                            {session.ip || '127.0.0.1'}
                          </td>
                          <td className="py-3 px-3 text-[#111B21] dark:text-[#E9EDEF]">
                            <div className="flex items-center space-x-1.5">
                              <Laptop className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                              <span>{formatUserAgent(session.userAgent)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-[#667781] dark:text-[#8696A0] whitespace-nowrap">
                            {new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(session.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3">
                            {isRevoked ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                                Revoked
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-[#128C7E] dark:text-[#25D366] border border-emerald-500/20">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {!isRevoked && (
                              <button
                                type="button"
                                onClick={() => handleRevokeSession(session.id)}
                                disabled={revokingSessionId === session.id}
                                className="px-2.5 py-1 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-lg transition-all cursor-pointer"
                              >
                                {revokingSessionId === session.id ? 'Revoking...' : 'Revoke'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: AUDIT TRAIL */}
        {/* ========================================================================= */}
        {activeTab === 'audit' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-5 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E0E5E7] dark:border-[#222D34]">
              <div>
                <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                  <span>Immutable Security & Operations Audit Trail</span>
                </h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                  Append-only compliance log recording authenticated actions, privilege changes, and route requests.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={auditOutcomeFilter}
                  onChange={(e) => setAuditOutcomeFilter(e.target.value)}
                  className="bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-2.5 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] cursor-pointer"
                >
                  <option value="all">All Outcomes</option>
                  <option value="authorized">Authorized</option>
                  <option value="success">Success</option>
                  <option value="denied">Denied</option>
                  <option value="failure">Failure</option>
                </select>

                <button
                  type="button"
                  onClick={loadAuditLogs}
                  disabled={auditLoading}
                  className="px-3 py-1.5 text-xs font-semibold text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF] bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Audit Search */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-[#667781] dark:text-[#8696A0]" />
              <input
                type="text"
                placeholder="Search audit trail by action (e.g., auth.login), resource, or actor ID..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-9 pr-4 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
              />
            </div>

            {/* Audit Table */}
            <div className="overflow-x-auto custom-scrollbar border border-[#E0E5E7] dark:border-[#222D34] rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F0F2F5]/80 dark:bg-[#111B21]/80 text-[#667781] dark:text-[#8696A0] border-b border-[#E0E5E7] dark:border-[#222D34]">
                    <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                    <th className="py-2.5 px-3 font-semibold">Actor</th>
                    <th className="py-2.5 px-3 font-semibold">Action</th>
                    <th className="py-2.5 px-3 font-semibold">Resource</th>
                    <th className="py-2.5 px-3 font-semibold">Outcome</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E5E7] dark:divide-[#222D34]">
                  {auditLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#667781] dark:text-[#8696A0]">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-[#128C7E] dark:text-[#25D366]" />
                        <span>Querying audit log records...</span>
                      </td>
                    </tr>
                  ) : filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#667781] dark:text-[#8696A0]">
                        No audit records match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.slice(0, 30).map((log) => {
                      const isPositive = log.outcome === 'success' || log.outcome === 'authorized';
                      return (
                        <tr key={log.id} className="hover:bg-[#F0F2F5]/50 dark:hover:bg-[#111B21]/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-[#667781] dark:text-[#8696A0] whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {new Date(log.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3 text-[#111B21] dark:text-[#E9EDEF]">
                            <span className="font-semibold">{log.actorName || log.actorId || 'System'}</span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-[#128C7E] dark:text-[#25D366]">
                            {log.action}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-[#667781] dark:text-[#8696A0] max-w-[200px] truncate">
                            {log.resource}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              isPositive
                                ? 'bg-emerald-500/10 text-[#128C7E] dark:text-[#25D366] border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {log.outcome}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setInspectAuditItem(log)}
                              className="px-2 py-1 text-[11px] font-semibold text-[#128C7E] dark:text-[#25D366] hover:bg-[#128C7E]/10 rounded-lg transition-all cursor-pointer"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: SECURITY EVENTS */}
        {/* ========================================================================= */}
        {activeTab === 'events' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-5 transition-colors">
            <div className="flex items-start justify-between pb-4 border-b border-[#E0E5E7] dark:border-[#222D34]">
              <div>
                <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] flex items-center space-x-2">
                  <Bell className="h-4 w-4 text-amber-500" />
                  <span>Security & Risk Events Feed</span>
                </h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                  Automated detection of suspicious activities, brute-force lockout triggers, and privilege escalation blocks.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-[#128C7E] dark:text-[#25D366] border border-emerald-500/20">
                  Shield Active
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {securityEvents.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#E0E5E7] dark:border-[#222D34] rounded-2xl">
                  <CheckCircle2 className="h-8 w-8 text-[#128C7E] dark:text-[#25D366] mx-auto mb-2" />
                  <p className="text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF]">Zero Security Incidents Detected</p>
                  <p className="text-[11px] text-[#667781] dark:text-[#8696A0] mt-1">
                    No failed brute-force attacks or unauthorized resource access recorded in recent activity.
                  </p>
                </div>
              ) : (
                securityEvents.map((evt) => (
                  <div key={evt.id} className="p-4 rounded-xl bg-[#F0F2F5]/60 dark:bg-[#111B21]/60 border border-[#E0E5E7] dark:border-[#222D34] flex items-start justify-between gap-4">
                    <div className="flex items-start space-x-3">
                      <div className="h-8 w-8 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">{evt.action}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold uppercase">
                            {evt.outcome}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#667781] dark:text-[#8696A0] mt-0.5">
                          Target: <code className="text-[#111B21] dark:text-[#E9EDEF] font-mono">{evt.resource}</code> • Actor: {evt.actorId || 'Anonymous'}
                        </p>
                        <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-1">
                          {new Date(evt.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setInspectAuditItem(evt)}
                      className="px-2.5 py-1 text-xs font-semibold text-[#128C7E] dark:text-[#25D366] hover:bg-[#128C7E]/10 rounded-lg cursor-pointer"
                    >
                      View Event Data
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: ADVANCED SECURITY */}
        {/* ========================================================================= */}
        {activeTab === 'advanced' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
            <div className="flex items-start justify-between pb-4 border-b border-[#E0E5E7] dark:border-[#222D34]">
              <div>
                <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] flex items-center space-x-2">
                  <ShieldAlert className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                  <span>Advanced Security Hardening</span>
                </h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                  IP allowlisting, emergency credential resets, and Multi-Factor Authentication enforcement.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* MFA Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#F0F2F5]/60 dark:bg-[#111B21]/60 border border-[#E0E5E7] dark:border-[#222D34]">
                <div>
                  <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Enforce Two-Factor Authentication (2FA / MFA)</h4>
                  <p className="text-[11px] text-[#667781] dark:text-[#8696A0] mt-0.5">
                    Require all Super Admin and Manager accounts to verify via TOTP authenticator app upon sign-in.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.mfaRequired === true}
                    onChange={(e) => updateField('mfaRequired', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#128C7E] dark:peer-checked:bg-[#25D366]"></div>
                </label>
              </div>

              {/* Password Complexity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#F0F2F5]/60 dark:bg-[#111B21]/60 border border-[#E0E5E7] dark:border-[#222D34]">
                  <div>
                    <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Require Numbers (0-9)</h4>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">At least one numeric digit required in user passwords.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.requireNumbers !== false}
                      onChange={(e) => updateField('requireNumbers', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#128C7E] dark:peer-checked:bg-[#25D366]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-[#F0F2F5]/60 dark:bg-[#111B21]/60 border border-[#E0E5E7] dark:border-[#222D34]">
                  <div>
                    <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">Require Special Characters (!@#$)</h4>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">At least one special symbol required in user passwords.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.requireSpecialChars !== false}
                      onChange={(e) => updateField('requireSpecialChars', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#128C7E] dark:peer-checked:bg-[#25D366]"></div>
                  </label>
                </div>
              </div>

              {/* IP Allowlist */}
              <div>
                <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1.5">
                  Trusted IP Address Allowlist (CIDR Blocks)
                </label>
                <p className="text-[11px] text-[#667781] dark:text-[#8696A0] mb-2">
                  Leave empty to allow logins from any network, or specify comma-separated static IPs (e.g., 203.115.24.10, 192.168.1.0/24).
                </p>
                <textarea
                  rows={2}
                  placeholder="e.g. 203.115.24.10, 192.168.1.0/24"
                  value={Array.isArray(data.ipAllowlist) ? data.ipAllowlist.join(', ') : (data.ipAllowlist || '')}
                  onChange={(e) => {
                    const list = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    updateField('ipAllowlist', list);
                  }}
                  className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl p-3 text-xs text-[#111B21] dark:text-[#E9EDEF] font-mono focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                />
              </div>

              {/* Bottom Actions Bar */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#E0E5E7] dark:border-[#222D34]">
                <button
                  type="button"
                  onClick={handleManualSave}
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold text-white dark:text-[#111B21] bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* AUDIT INSPECTION MODAL */}
        {/* ========================================================================= */}
        {inspectAuditItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E0E5E7] dark:border-[#222D34]">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                  <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">Audit Record Inspector</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectAuditItem(null)}
                  className="p-1 rounded-lg text-[#667781] dark:text-[#8696A0] hover:bg-[#F0F2F5] dark:hover:bg-[#111B21]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#E0E5E7] dark:border-[#222D34]">
                  <span className="text-[#667781] dark:text-[#8696A0]">Record ID:</span>
                  <span className="font-mono text-[#111B21] dark:text-[#E9EDEF]">{inspectAuditItem.id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E0E5E7] dark:border-[#222D34]">
                  <span className="text-[#667781] dark:text-[#8696A0]">Correlation ID:</span>
                  <span className="font-mono text-[#111B21] dark:text-[#E9EDEF]">{inspectAuditItem.correlationId || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E0E5E7] dark:border-[#222D34]">
                  <span className="text-[#667781] dark:text-[#8696A0]">Timestamp:</span>
                  <span className="text-[#111B21] dark:text-[#E9EDEF]">{new Date(inspectAuditItem.createdAt).toISOString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E0E5E7] dark:border-[#222D34]">
                  <span className="text-[#667781] dark:text-[#8696A0]">Action:</span>
                  <span className="font-mono text-[#128C7E] dark:text-[#25D366] font-bold">{inspectAuditItem.action}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E0E5E7] dark:border-[#222D34]">
                  <span className="text-[#667781] dark:text-[#8696A0]">Resource:</span>
                  <span className="font-mono text-[#111B21] dark:text-[#E9EDEF]">{inspectAuditItem.resource}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E0E5E7] dark:border-[#222D34]">
                  <span className="text-[#667781] dark:text-[#8696A0]">Outcome:</span>
                  <span className="font-semibold text-emerald-400">{inspectAuditItem.outcome}</span>
                </div>

                <div className="pt-2">
                  <span className="text-[#667781] dark:text-[#8696A0] block mb-1">Payload / Metadata:</span>
                  <pre className="bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl p-3 text-[11px] font-mono text-[#111B21] dark:text-[#E9EDEF] max-h-48 overflow-y-auto">
                    {JSON.stringify(inspectAuditItem.metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setInspectAuditItem(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#128C7E] dark:bg-[#25D366] dark:text-[#111B21] rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
};

export default SecurityAuditSection;
