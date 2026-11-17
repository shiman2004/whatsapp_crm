import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Send,
  ShieldCheck,
  Copy,
  Check,
  History,
  Info
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

export interface WhatsAppConnection {
  id: string;
  company: string;
  businessName: string;
  branch: string;
  displayName: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED' | 'ERROR' | 'CHECKING' | 'RECONNECTING' | 'UNKNOWN';
  qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  codeVerificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'UNKNOWN';
  webhookStatus: 'SUBSCRIBED' | 'ACTIVE' | 'UNVERIFIED' | 'UNKNOWN';
  lastCheckedAt: string | null;
  lastConnectedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  lastReconnectAttemptAt: string | null;
  reconnectInProgress?: boolean;
}

export interface ConnectionLog {
  id: string;
  connectionId: string;
  eventType: string;
  status: 'SUCCESS' | 'FAILURE' | 'ERROR';
  responseTimeMs: number | null;
  performedById: string | null;
  performedByName: string | null;
  details: Record<string, any>;
  errorMessage: string | null;
  createdAt: string;
}

interface WhatsAppConnectionDrawerProps {
  connection: WhatsAppConnection | null;
  isOpen: boolean;
  onClose: () => void;
  onTest: (connectionId: string) => Promise<any>;
  onRequestReconnect: (connectionId: string) => void;
  isTesting: boolean;
  isReconnecting: boolean;
}

export const WhatsAppConnectionDrawer: React.FC<WhatsAppConnectionDrawerProps> = ({
  connection,
  isOpen,
  onClose,
  onTest,
  onRequestReconnect,
  isTesting,
  isReconnecting
}) => {
  const [history, setHistory] = useState<ConnectionLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  const loadHistory = async (connId: string) => {
    setIsLoadingHistory(true);
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : '';
    try {
      const res = await fetch(`${base}/api/whatsapp/connections/${connId}/history`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.warn('Could not fetch connection history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen && connection?.id) {
      loadHistory(connection.id);
    } else {
      setHistory([]);
    }
  }, [isOpen, connection?.id]);

  if (!isOpen || !connection) return null;

  const getCompanyTheme = (company: string) => {
    switch (company) {
      case 'RWC':
        return {
          badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
          dot: 'bg-emerald-500',
          border: 'border-emerald-500/30'
        };
      case 'CRAS':
        return {
          badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
          dot: 'bg-amber-500',
          border: 'border-amber-500/30'
        };
      case 'AHC':
        return {
          badge: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20',
          dot: 'bg-teal-500',
          border: 'border-teal-500/30'
        };
      default:
        return {
          badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
          dot: 'bg-slate-500',
          border: 'border-slate-500/30'
        };
    }
  };

  const theme = getCompanyTheme(connection.company);

  const getStatusBadge = (status: string) => {
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
          label: 'Connection Error'
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

  const statusInfo = getStatusBadge(connection.connectionStatus);

  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Never';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      {/* Backdrop click to close */}
      <div className="flex-1 cursor-pointer" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-xl h-full bg-white dark:bg-[#111B21] border-l border-[#E0E5E7] dark:border-[#222D34] shadow-2xl flex flex-col z-10 overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#E0E5E7] dark:border-[#222D34] bg-[#F0F2F5]/60 dark:bg-[#111B21] flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${theme.badge}`}>
                  {connection.company}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${statusInfo.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                  {statusInfo.label}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#111B21] dark:text-[#E9EDEF] truncate mt-0.5">
                {connection.displayName}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF] hover:bg-[#E0E5E7]/50 dark:hover:bg-[#202C33] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl bg-[#F0F2F5] dark:bg-[#202C33]/60 border border-[#E0E5E7] dark:border-[#222D34]">
            <button
              type="button"
              disabled={isTesting}
              onClick={() => onTest(connection.id)}
              className="flex-1 min-w-[140px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-xs font-bold text-[#111B21] dark:text-[#E9EDEF] hover:text-[#128C7E] dark:hover:text-[#25D366] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testing Health...' : 'Test Connection'}</span>
            </button>
            <button
              type="button"
              disabled={isReconnecting}
              onClick={() => onRequestReconnect(connection.id)}
              className="flex-1 min-w-[140px] px-3.5 py-2 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isReconnecting ? 'animate-spin' : ''}`} />
              <span>{isReconnecting ? 'Reconnecting...' : 'Reconnect Now'}</span>
            </button>
          </div>

          {/* Section 1: General Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#667781] dark:text-[#8696A0] flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-[#128C7E] dark:text-[#25D366]" />
              General Information
            </h3>
            <div className="bg-white dark:bg-[#202C33] rounded-2xl border border-[#E0E5E7] dark:border-[#222D34] divide-y divide-[#E0E5E7] dark:divide-[#222D34]">
              <div className="p-3.5 flex items-center justify-between text-xs">
                <span className="text-[#667781] dark:text-[#8696A0]">Business Entity</span>
                <span className="font-bold text-[#111B21] dark:text-[#E9EDEF]">{connection.businessName}</span>
              </div>
              <div className="p-3.5 flex items-center justify-between text-xs">
                <span className="text-[#667781] dark:text-[#8696A0]">Branch / Location</span>
                <span className="font-semibold text-[#111B21] dark:text-[#E9EDEF] flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#128C7E] dark:text-[#25D366]" />
                  {connection.branch}
                </span>
              </div>
              <div className="p-3.5 flex items-center justify-between text-xs">
                <span className="text-[#667781] dark:text-[#8696A0]">WhatsApp Phone</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#111B21] dark:text-[#E9EDEF]">
                    {connection.phoneNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(connection.phoneNumber, 'phone')}
                    className="p-1 rounded-md text-[#667781] hover:text-[#128C7E] dark:hover:text-[#25D366]"
                    title="Copy Phone"
                  >
                    {copiedKey === 'phone' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
              <div className="p-3.5 flex items-center justify-between text-xs">
                <span className="text-[#667781] dark:text-[#8696A0]">Phone Number ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-[#111B21] dark:text-[#E9EDEF]">
                    {connection.phoneNumberId}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(connection.phoneNumberId, 'phoneId')}
                    className="p-1 rounded-md text-[#667781] hover:text-[#128C7E] dark:hover:text-[#25D366]"
                    title="Copy Phone Number ID"
                  >
                    {copiedKey === 'phoneId' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
              <div className="p-3.5 flex items-center justify-between text-xs">
                <span className="text-[#667781] dark:text-[#8696A0]">WABA ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-[#111B21] dark:text-[#E9EDEF]">
                    {connection.wabaId}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(connection.wabaId, 'wabaId')}
                    className="p-1 rounded-md text-[#667781] hover:text-[#128C7E] dark:hover:text-[#25D366]"
                    title="Copy WABA ID"
                  >
                    {copiedKey === 'wabaId' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: API & Health Diagnostics */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#667781] dark:text-[#8696A0] flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#128C7E] dark:text-[#25D366]" />
              API & Webhook Diagnostics
            </h3>
            <div className="bg-white dark:bg-[#202C33] rounded-2xl border border-[#E0E5E7] dark:border-[#222D34] divide-y divide-[#E0E5E7] dark:divide-[#222D34]">
              <div className="p-3.5 flex items-center justify-between text-xs">
                <span className="text-[#667781] dark:text-[#8696A0]">Integration Provider</span>
                <span className="font-bold text-[#128C7E] dark:text-[#25D366]">Meta WhatsApp Cloud API v20.0</span>
              </div>
              <div className="p-3.5 flex items-center justify-between text-xs">
                <span className="text-[#667781] dark:text-[#8696A0]">Credential Status</span>
                {connection.connectionStatus === 'EXPIRED' ? (
                  <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 text-right">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Token expired — update server secret
                  </span>
                ) : (
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Protected in Server Secret Manager
                  </span>
                )}
              </div>
              <div className="p-3.5 flex items-center justify-between text-xs">
                <span className="text-[#667781] dark:text-[#8696A0]">Webhook Subscription</span>
                <span className="font-bold text-[#111B21] dark:text-[#E9EDEF]">
                  {connection.webhookStatus}
                </span>
              </div>
              <div className="p-3.5 flex items-center justify-between text-xs">
                <span className="text-[#667781] dark:text-[#8696A0]">Meta Quality Rating</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                  connection.qualityRating === 'GREEN'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : connection.qualityRating === 'YELLOW'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}>
                  {connection.qualityRating}
                </span>
              </div>
              <div className="p-3.5 flex items-center justify-between text-xs">
                <span className="text-[#667781] dark:text-[#8696A0]">Last Health Checked</span>
                <span className="font-mono text-[#111B21] dark:text-[#E9EDEF]">{formatDate(connection.lastCheckedAt)}</span>
              </div>
              <div className="p-3.5 flex items-center justify-between text-xs">
                <span className="text-[#667781] dark:text-[#8696A0]">Last Known Connection</span>
                <span className="font-mono text-[#111B21] dark:text-[#E9EDEF]">{formatDate(connection.lastConnectedAt)}</span>
              </div>
            </div>

            {/* Error banner if lastError exists */}
            {connection.lastError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Last Reported Failure</span>
                </div>
                <p className="text-xs font-mono">{connection.lastError}</p>
                {connection.lastErrorAt && (
                  <p className="text-[10px] opacity-75">Occurred at: {formatDate(connection.lastErrorAt)}</p>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Connection History Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#667781] dark:text-[#8696A0] flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-[#128C7E] dark:text-[#25D366]" />
                Recent Connection History & Audit
              </h3>
              <button
                type="button"
                onClick={() => loadHistory(connection.id)}
                className="text-[11px] text-[#128C7E] dark:text-[#25D366] hover:underline cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                <span>Refresh Log</span>
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="p-6 text-center text-xs text-[#667781] dark:text-[#8696A0]">
                Loading connection history...
              </div>
            ) : history.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#667781] dark:text-[#8696A0] bg-white dark:bg-[#202C33] rounded-2xl border border-[#E0E5E7] dark:border-[#222D34]">
                No recorded health events or reconnect attempts yet.
              </div>
            ) : (
              <div className="bg-white dark:bg-[#202C33] rounded-2xl border border-[#E0E5E7] dark:border-[#222D34] divide-y divide-[#E0E5E7] dark:divide-[#222D34] overflow-hidden">
                {history.map((log) => (
                  <div key={log.id} className="p-3.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className="font-bold text-[#111B21] dark:text-[#E9EDEF]">
                          {log.eventType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#667781] dark:text-[#8696A0] font-mono">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#667781] dark:text-[#8696A0]">
                      <span>Triggered by: {log.performedByName || 'System'}</span>
                      {log.responseTimeMs && (
                        <span className="font-mono">{log.responseTimeMs} ms</span>
                      )}
                    </div>

                    {log.errorMessage && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-mono mt-1">
                        {log.errorMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
