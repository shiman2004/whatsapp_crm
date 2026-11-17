import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Smartphone,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Send,
  Radio,
  Clock,
  Search,
  MapPin,
  Copy,
  Check,
  Eye,
  Activity
} from 'lucide-react';
import { SettingsLayout } from './SettingsLayout';
import { API_BASE_URL } from '../../config/api';
import {
  WhatsAppConnectionDrawer,
  type WhatsAppConnection
} from './WhatsAppConnectionDrawer';

interface WhatsAppConnectionsSectionProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

export const WhatsAppConnectionsSection: React.FC<WhatsAppConnectionsSectionProps> = ({
  currentSectionId,
  onSelectSection,
  selectedCompanyId,
  onSelectCompany
}) => {
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Selected connection for the Details Drawer
  const [selectedConnection, setSelectedConnection] = useState<WhatsAppConnection | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Confirmation Modal state for Reconnect
  const [reconnectModalConn, setReconnectModalConn] = useState<WhatsAppConnection | null>(null);

  // In-flight action states per connection ID
  const [testingId, setTestingId] = useState<string | null>(null);
  const [reconnectingId, setReconnectingId] = useState<string | null>(null);

  // Inline feedback alert
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    action?: string;
  } | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isCheckingAll, setIsCheckingAll] = useState<boolean>(false);

  const getToken = () =>
    localStorage.getItem('rw_crm_auth_token') ||
    localStorage.getItem('royal_crm_token') ||
    localStorage.getItem('auth_token') ||
    '';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const loadConnections = useCallback(async (showRefreshingState = false) => {
    if (showRefreshingState) setIsRefreshing(true);
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : '';
    try {
      const res = await fetch(`${base}/api/whatsapp/connections`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.connections)) {
          setConnections(data.connections);
          // If a drawer is open, keep its state synced
          if (selectedConnection) {
            const updated = data.connections.find((c: WhatsAppConnection) => c.id === selectedConnection.id);
            if (updated) setSelectedConnection(updated);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch WhatsApp connections:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedConnection]);

  // Initial load only; later updates come from SSE, manual refresh and the 30s poll.
  useEffect(() => {
    loadConnections(false);
  }, []);

  // Periodic Auto-refresh (every 30 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadConnections(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadConnections]);

  // Immediate refresh when the backend broadcasts a connection state change
  useEffect(() => {
    const onConnectionUpdate = () => loadConnections(false);
    window.addEventListener('whatsapp-connection-updated', onConnectionUpdate);
    return () => window.removeEventListener('whatsapp-connection-updated', onConnectionUpdate);
  }, [loadConnections]);

  // Run Diagnostic Test Connection
  const handleTestConnection = async (connId: string) => {
    setTestingId(connId);
    setFeedback(null);
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : '';
    try {
      const res = await fetch(`${base}/api/whatsapp/connections/${connId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          title: 'Connection Test Passed',
          message: `Phone number is verified and active on Meta Cloud API (Latency: ${data.responseTimeMs}ms, Quality: ${data.qualityRating}).`
        });
      } else {
        setFeedback({
          type: 'error',
          title: 'Connection Test Failed',
          message: data.errorDetails || 'Verification check failed.',
          action: data.correctiveAction
        });
      }
      await loadConnections(false);
      return data;
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Connection Test Error',
        message: err.message || 'Network error executing diagnostic test.'
      });
      return { success: false, error: err.message };
    } finally {
      setTestingId(null);
    }
  };

  // Run Reconnect Workflow
  const handleReconnect = async (connId: string) => {
    setReconnectingId(connId);
    setFeedback(null);
    setReconnectModalConn(null);
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : '';
    try {
      const res = await fetch(`${base}/api/whatsapp/connections/${connId}/reconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          title: 'Reconnection Successful',
          message: data.message || 'WhatsApp connection verified successfully.'
        });
      } else {
        setFeedback({
          type: 'error',
          title: 'Reconnection Incomplete',
          message: data.message || 'Unable to verify the WhatsApp connection.',
          action: data.correctiveAction || data.reason
        });
      }
      await loadConnections(false);
      return data;
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Reconnection Failed',
        message: err.message || 'Network exception while reconnecting.'
      });
      return { success: false, error: err.message };
    } finally {
      setReconnectingId(null);
    }
  };

  // Check all registered numbers in sequence
  const handleCheckAll = async () => {
    setIsCheckingAll(true);
    const results: Array<{ success?: boolean }> = [];
    try {
      for (const conn of connections) {
        results.push(await handleTestConnection(conn.id));
      }
      const failed = results.filter((r) => !r.success).length;
      setFeedback({
        type: failed ? 'warning' : 'success',
        title: failed ? 'Connection Check Completed With Issues' : 'All Connections Healthy',
        message: `${results.length - failed} of ${results.length} numbers verified with Meta Cloud API.${failed ? ` ${failed} need attention.` : ''}`
      });
    } finally {
      setIsCheckingAll(false);
    }
  };

  // Filter connections by search and status
  const filteredConnections = useMemo(() => {
    return connections.filter((conn) => {
      // Company match if company filter is active and not 'ALL'
      if (selectedCompanyId && selectedCompanyId !== 'ALL' && conn.company !== selectedCompanyId) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && conn.connectionStatus !== statusFilter) return false;

      // Search match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = conn.displayName.toLowerCase().includes(query);
        const matchesBusiness = conn.businessName.toLowerCase().includes(query);
        const matchesBranch = conn.branch.toLowerCase().includes(query);
        const matchesPhone = conn.phoneNumber.replace(/[^0-9]/g, '').includes(query.replace(/[^0-9]/g, ''));
        const matchesPhoneId = conn.phoneNumberId.includes(query);
        const matchesWaba = conn.wabaId.includes(query);
        if (!matchesName && !matchesBusiness && !matchesBranch && !matchesPhone && !matchesPhoneId && !matchesWaba) {
          return false;
        }
      }

      return true;
    });
  }, [connections, selectedCompanyId, statusFilter, searchQuery]);

  // Compute Summary Metrics
  const summary = useMemo(() => {
    return {
      total: connections.length,
      connected: connections.filter((c) => c.connectionStatus === 'CONNECTED').length,
      disconnected: connections.filter((c) => ['DISCONNECTED', 'EXPIRED'].includes(c.connectionStatus)).length,
      errors: connections.filter((c) => c.connectionStatus === 'ERROR').length
    };
  }, [connections]);

  const getCompanyTheme = (company: string) => {
    switch (company) {
      case 'RWC':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
      case 'CRAS':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20';
      case 'AHC':
        return 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20';
      default:
        return 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20';
    }
  };

  const getStatusBadge = (status: string, inProgress: boolean = false) => {
    if (inProgress) {
      return {
        bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
        dot: 'bg-blue-500 animate-ping',
        label: 'Reconnecting...'
      };
    }
    switch (status) {
      case 'CONNECTED':
        return {
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-500 animate-pulse',
          label: 'Connected'
        };
      case 'EXPIRED':
        return {
          bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
          dot: 'bg-amber-500',
          label: 'Token Expired'
        };
      case 'ERROR':
        return {
          bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
          dot: 'bg-rose-500',
          label: 'Error'
        };
      case 'RECONNECTING':
        return {
          bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
          dot: 'bg-blue-500 animate-ping',
          label: 'Reconnecting...'
        };
      default:
        return {
          bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
          dot: 'bg-slate-400',
          label: 'Disconnected'
        };
    }
  };

  const formatTimeAgo = (isoString: string | null) => {
    if (!isoString) return 'Never';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return isoString;
    }
  };

  return (
    <SettingsLayout
      currentSectionId={currentSectionId}
      onSelectSection={onSelectSection}
      selectedCompanyId={selectedCompanyId}
      onSelectCompany={onSelectCompany}
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 flex-1 overflow-y-auto">
        {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0E5E7] dark:border-[#222D34] pb-5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DDF5EC] text-[#075E54] dark:bg-[#005C4B]/40 dark:text-[#25D366] border border-[#128C7E]/20">
                Meta WhatsApp Cloud API v20.0
              </span>
              <span className="text-xs text-[#667781] dark:text-[#8696A0]">
                Zero-Knowledge Security
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111B21] dark:text-[#E9EDEF] mt-1.5 flex items-center gap-2">
              <Radio className="h-6 w-6 text-[#128C7E] dark:text-[#25D366]" />
              WhatsApp Connection Settings
            </h1>
            <p className="text-xs sm:text-sm text-[#667781] dark:text-[#8696A0] mt-1">
              Monitor live connection health, test Meta API reachability, and safely reconnect registered WhatsApp business phone numbers.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={isCheckingAll || isLoading || connections.length === 0}
              onClick={handleCheckAll}
              className="px-3 py-1.5 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Test every registered number against Meta Cloud API"
            >
              <Activity className={`h-3.5 w-3.5 ${isCheckingAll ? 'animate-pulse' : ''}`} />
              <span>{isCheckingAll ? 'Checking...' : 'Check All Connections'}</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-[#F0F2F5] dark:bg-[#202C33] text-[#667781] dark:text-[#8696A0] border-[#E0E5E7] dark:border-[#222D34]'
              }`}
              title={autoRefresh ? 'Auto-refreshing every 30s' : 'Auto-refresh paused'}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{autoRefresh ? 'Auto: 30s' : 'Auto: Off'}</span>
            </button>

            <button
              type="button"
              disabled={isRefreshing}
              onClick={() => loadConnections(true)}
              className="p-2 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] text-[#667781] dark:text-[#8696A0] hover:text-[#128C7E] dark:hover:text-[#25D366] transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Connections"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#128C7E] dark:text-[#25D366]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedback && (
          <div className={`p-4 rounded-2xl border text-xs flex items-start justify-between gap-3 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : feedback.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
          }`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm">
                {feedback.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
                {feedback.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
                {feedback.type === 'error' && <AlertCircle className="h-4 w-4" />}
                <span>{feedback.title}</span>
              </div>
              <p>{feedback.message}</p>
              {feedback.action && (
                <p className="font-semibold mt-1">Recommended Action: {feedback.action}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-[#667781] hover:text-[#111B21] dark:hover:text-[#E9EDEF]"
            >
              ✕
            </button>
          </div>
        )}

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm space-y-1">
            <span className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Total WhatsApp Numbers</span>
            <div className="text-2xl font-bold text-[#111B21] dark:text-[#E9EDEF]">{summary.total}</div>
            <span className="text-[10px] text-[#667781] dark:text-[#8696A0]">RWC, CRAS & AHC</span>
          </div>

          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm space-y-1">
            <span className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Connected & Active</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              {summary.connected}
            </div>
            <span className="text-[10px] text-[#667781] dark:text-[#8696A0]">Verified with Meta Cloud API</span>
          </div>

          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm space-y-1">
            <span className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Disconnected / Expired</span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.disconnected}</div>
            <span className="text-[10px] text-[#667781] dark:text-[#8696A0]">Requires Reconnect Action</span>
          </div>

          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm space-y-1">
            <span className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Connection Errors</span>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{summary.errors}</div>
            <span className="text-[10px] text-[#667781] dark:text-[#8696A0]">Check Diagnostic Logs</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667781] dark:text-[#8696A0]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by business, branch, phone number or ID..."
              className="w-full pl-10 pr-4 py-2 bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-xs">
              {(['ALL', 'CONNECTED', 'DISCONNECTED', 'EXPIRED', 'ERROR', 'RECONNECTING'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === filter
                      ? 'bg-white dark:bg-[#202C33] text-[#111B21] dark:text-[#E9EDEF] shadow-xs'
                      : 'text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
                  }`}
                >
                  {filter === 'ALL' ? 'All Numbers' : filter.charAt(0) + filter.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Connections Table & Cards */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] animate-pulse p-4" />
            ))}
          </div>
        ) : filteredConnections.length === 0 ? (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-8 text-center space-y-3">
            <Smartphone className="h-10 w-10 text-[#667781] dark:text-[#8696A0] mx-auto opacity-50" />
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">No matching WhatsApp connections</h3>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">Try clearing your search query or status filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredConnections.map((conn) => {
              const statusBadge = getStatusBadge(
                conn.connectionStatus,
                reconnectingId === conn.id || Boolean(conn.reconnectInProgress)
              );
              const companyTheme = getCompanyTheme(conn.company);
              const isTestingThis = testingId === conn.id;
              const isReconnectingThis = reconnectingId === conn.id;

              return (
                <div
                  key={conn.id}
                  className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 shadow-sm hover:border-[#128C7E]/40 dark:hover:border-[#25D366]/40 transition-all space-y-4"
                >
                  {/* Top Row: Business Unit, Phone, Status & Actions */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
                      <div className="h-11 w-11 rounded-2xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                        <Smartphone className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${companyTheme}`}>
                            {conn.company}
                          </span>
                          <span className="text-xs font-semibold text-[#667781] dark:text-[#8696A0] flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-[#128C7E] dark:text-[#25D366]" />
                            {conn.branch}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${statusBadge.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                            {statusBadge.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <h2 className="text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                            {conn.displayName}
                          </h2>
                          <span className="text-xs font-mono font-bold text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 px-2 py-0.5 rounded-md">
                            {conn.phoneNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(conn.phoneNumber, `phone-${conn.id}`)}
                            className="p-1 rounded-md text-[#667781] hover:text-[#128C7E] dark:hover:text-[#25D366] transition-colors"
                            title="Copy Phone Number"
                          >
                            {copiedKey === `phone-${conn.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        disabled={isTestingThis || isReconnectingThis}
                        onClick={() => handleTestConnection(conn.id)}
                        className="px-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-xs font-bold text-[#111B21] dark:text-[#E9EDEF] hover:text-[#128C7E] dark:hover:text-[#25D366] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Diagnostic Test Connection"
                      >
                        <Send className={`h-3.5 w-3.5 ${isTestingThis ? 'animate-spin' : ''}`} />
                        <span>{isTestingThis ? 'Testing...' : 'Test Connection'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isTestingThis || isReconnectingThis}
                        onClick={() => setReconnectModalConn(conn)}
                        className="px-3.5 py-2 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Reconnect to WhatsApp Cloud API"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isReconnectingThis ? 'animate-spin' : ''}`} />
                        <span>{isReconnectingThis ? 'Reconnecting...' : 'Reconnect'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedConnection(conn);
                          setIsDrawerOpen(true);
                        }}
                        className="p-2 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#667781] dark:text-[#8696A0] hover:text-[#128C7E] dark:hover:text-[#25D366] transition-colors cursor-pointer"
                        title="View Full Connection Details & History"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Metadata Chips Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-[#E0E5E7] dark:border-[#222D34] text-xs">
                    <div>
                      <span className="text-[10px] text-[#667781] dark:text-[#8696A0] block">Phone Number ID</span>
                      <span className="font-mono font-semibold text-[#111B21] dark:text-[#E9EDEF]">
                        {conn.phoneNumberId}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#667781] dark:text-[#8696A0] block">WABA ID</span>
                      <span className="font-mono font-semibold text-[#111B21] dark:text-[#E9EDEF]">
                        {conn.wabaId}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#667781] dark:text-[#8696A0] block">Last Health Checked</span>
                      <span className="font-semibold text-[#111B21] dark:text-[#E9EDEF]">
                        {formatTimeAgo(conn.lastCheckedAt)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#667781] dark:text-[#8696A0] block">Last Connected</span>
                      <span className="font-semibold text-[#111B21] dark:text-[#E9EDEF]">
                        {formatTimeAgo(conn.lastConnectedAt)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#667781] dark:text-[#8696A0] block">Meta Quality Rating</span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        conn.qualityRating === 'GREEN'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : conn.qualityRating === 'YELLOW'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}>
                        {conn.qualityRating}
                      </span>
                    </div>
                  </div>

                  {/* Inline Error guidance if exists */}
                  {conn.lastError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="font-mono truncate">{conn.lastError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedConnection(conn);
                          setIsDrawerOpen(true);
                        }}
                        className="text-[11px] underline font-bold shrink-0 cursor-pointer"
                      >
                        View Details
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Reconnect Confirmation Modal */}
        {reconnectModalConn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">
                    Reconnect WhatsApp Number
                  </h3>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0]">
                    {reconnectModalConn.displayName} ({reconnectModalConn.phoneNumber})
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-[#667781] dark:text-[#8696A0] bg-[#F0F2F5] dark:bg-[#111B21] p-3.5 rounded-xl border border-[#E0E5E7] dark:border-[#222D34]">
                <p>This operation will perform a full server-side verification:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Validate Meta Graph API credentials.</li>
                  <li>Re-register and subscribe the WABA Webhook App.</li>
                  <li>Verify the Phone Number ID and business status.</li>
                  <li>Audit the reconnection event in tamper-proof security logs.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setReconnectModalConn(null)}
                  className="px-4 py-2 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] hover:bg-[#E0E5E7]/50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleReconnect(reconnectModalConn.id)}
                  className="px-4 py-2 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Proceed with Reconnect
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Details Drawer */}
        <WhatsAppConnectionDrawer
          connection={selectedConnection}
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onTest={handleTestConnection}
          onRequestReconnect={(id) => {
            const conn = connections.find((c) => c.id === id);
            if (conn) setReconnectModalConn(conn);
          }}
          isTesting={testingId === selectedConnection?.id}
          isReconnecting={reconnectingId === selectedConnection?.id}
        />
      </div>
    </SettingsLayout>
  );
};
