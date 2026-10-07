import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  X, 
  Smartphone, 
  CheckCircle2, 
  RefreshCw, 
  LogOut,
  ShieldCheck, 
  Zap,
  User,
  AlertCircle
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { API_BASE_URL } from '../../config/api';

interface WhatsAppQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppQrModal: React.FC<WhatsAppQrModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, isSuperAdmin, notify } = useCrm() as any;
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'qr_ready' | 'connected' | 'disconnected' | 'syncing' | 'sync_error'>('connecting');
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${currentUser?.id || 'user-admin-1'}`,
    'x-coordinator-id': currentUser?.id || 'user-admin-1'
  };

  // Poll or listen for central clinic QR code & status
  useEffect(() => {
    if (!isOpen) return;

    // Reset local view state
    setQrCode(null);
    setStatus('connecting');
    setConnectedPhone(null);

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/qr`, {
          headers: authHeaders
        });
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
          if (data.qr) {
            setQrCode(data.qr);
            setFetchError(null);
          }
          if (data.phone) setConnectedPhone(data.phone);
        }
      } catch (err: any) {
        console.warn('QR Bridge offline or starting up...', err);
        setFetchError('Connecting to WhatsApp Gateway server...');
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    setFetchError(null);
    try {
      await fetch(`${API_BASE_URL}/api/reconnect`, { 
        method: 'POST',
        headers: authHeaders 
      });
      const res = await fetch(`${API_BASE_URL}/api/qr`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        if (data.qr) setQrCode(data.qr);
      }
    } catch (e: any) {
      console.error('Refresh QR error:', e);
      setFetchError('Unable to generate QR code. Server waking up, please wait a moment.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch(`${API_BASE_URL}/api/disconnect`, { 
        method: 'POST',
        headers: authHeaders 
      });
      setStatus('connecting');
      setQrCode(null);
      setConnectedPhone(null);
      if (notify) notify('Clinic WhatsApp Disconnected', 'Official clinic WhatsApp unlinked.', 'info');
      
      // Re-fetch new QR code for clinic line
      setTimeout(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/qr`, {
            headers: authHeaders
          });
          if (res.ok) {
            const data = await res.json();
            setStatus(data.status);
            if (data.qr) setQrCode(data.qr);
          }
        } catch (e) {}
      }, 1200);
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#111b21] border border-slate-700/80 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#202c33]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-whatsapp/20 text-whatsapp flex items-center justify-center shadow">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Royal Wellness Official WhatsApp Line
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                  status === 'connected' 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                    : status === 'syncing'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {status === 'connected' 
                    ? '🟢 Linked & Online' 
                    : status === 'syncing' 
                    ? '🔄 Syncing History...' 
                    : 'Scan to Connect'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">Single verified clinic number shared across Super Admin, Leads Officer, and all Coordinators</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          
          {status === 'connected' ? (
            /* Connected State */
            <div className="p-6 bg-[#202c33] rounded-2xl border border-emerald-500/40 text-center space-y-4 shadow-lg">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40 shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Royal Wellness Clinic WhatsApp is Active!</h3>
                <p className="text-xs text-slate-300 mt-1 font-mono">
                  Official Clinic Line: <span className="text-emerald-400 font-bold">+{connectedPhone || 'Active SIM'}</span>
                </p>
                <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                  All incoming patient inquiries arrive on this official clinic number. When coordinators reply, messages are sent from this single line.
                </p>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                {isSuperAdmin ? (
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="px-4 py-2 bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{isLoggingOut ? 'Unlinking...' : 'Unlink / Switch Clinic Line'}</span>
                  </button>
                ) : (
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                    🟢 Managed by Super Admin (Shared Clinic Line)
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* QR Scan Instructions & Box */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              
              {/* Instructions */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-200 tracking-wide uppercase text-whatsapp flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" /> Steps to link the Clinic WhatsApp Phone:
                </h3>

                <ol className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#202c33] border border-slate-700 text-slate-200 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      1
                    </span>
                    <span>Open <strong>WhatsApp</strong> on your mobile phone.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#202c33] border border-slate-700 text-slate-200 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      2
                    </span>
                    <span>Tap <strong>Menu ⋮</strong> or <strong>Settings ⚙️</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#202c33] border border-slate-700 text-slate-200 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      3
                    </span>
                    <span>Tap <strong>Linked Devices</strong> → <strong>Link a Device</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#202c33] border border-slate-700 text-slate-200 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      4
                    </span>
                    <span>Point your phone camera at this QR code to scan.</span>
                  </li>
                </ol>

                <div className="p-3 bg-[#202c33]/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-whatsapp shrink-0 mt-0.5" />
                  <span>Scoped to your profile. Other staff accounts will not be affected.</span>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-56 h-56 bg-white p-3 rounded-2xl shadow-2xl flex items-center justify-center border-4 border-slate-800 relative group">
                  {qrCode ? (
                    <img 
                      src={qrCode} 
                      alt="WhatsApp Web Pairing QR Code" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-800 space-y-2 p-4 text-center">
                      <RefreshCw className="w-8 h-8 animate-spin text-whatsapp" />
                      <p className="text-xs font-semibold text-slate-700">Connecting Socket...</p>
                      <p className="text-[10px] text-slate-500">Generating pairing QR code</p>
                    </div>
                  )}
                </div>
                
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    onClick={handleForceRefresh}
                    disabled={isRefreshing}
                    className="px-2.5 py-1 bg-[#202c33] hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium border border-slate-700/80 flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-whatsapp' : ''}`} />
                    <span>{isRefreshing ? 'Generating...' : 'Refresh QR'}</span>
                  </button>
                  <span className="text-[10px] text-slate-500">• Auto-syncs live</span>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#202c33] flex items-center justify-between">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-whatsapp" /> Isolated Coordinator Channel
          </span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-whatsapp hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl transition-all"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
