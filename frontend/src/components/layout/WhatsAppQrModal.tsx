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
  Info
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

interface WhatsAppQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppQrModal: React.FC<WhatsAppQrModalProps> = ({ isOpen, onClose }) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'qr_ready' | 'connected' | 'disconnected'>('connecting');
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { notify } = useCrm() as any;

  // Poll or listen for QR code & status
  useEffect(() => {
    if (!isOpen) return;

    // Fetch initial status
    const fetchStatus = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/qr');
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
          if (data.qr) setQrCode(data.qr);
          if (data.phone) setConnectedPhone(data.phone);
        }
      } catch (err) {
        console.warn('QR Bridge offline or starting up...', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2500);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('http://localhost:3001/api/logout', { method: 'POST' });
      setStatus('connecting');
      setQrCode(null);
      setConnectedPhone(null);
      if (notify) notify('WhatsApp Disconnected', 'Session unlinked. Scan new QR code to reconnect.', 'info');
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
                Link WhatsApp via QR Code
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                  status === 'connected' 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {status === 'connected' ? '🟢 Linked & Online' : 'Scan to Connect'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">Use your personal or clinic WhatsApp directly in this CRM</p>
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
                <h3 className="text-base font-bold text-white">WhatsApp Successfully Linked!</h3>
                <p className="text-xs text-slate-300 mt-1 font-mono">
                  Connected Number: <span className="text-emerald-400 font-bold">+{connectedPhone || 'Active SIM'}</span>
                </p>
                <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                  Incoming customer messages on this WhatsApp account will stream directly into your CRM chats.
                </p>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="px-4 py-2 bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isLoggingOut ? 'Unlinking...' : 'Unlink / Switch Device'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* QR Scan Instructions & Box */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              
              {/* Instructions */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-200 tracking-wide uppercase text-whatsapp flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" /> Steps to link:
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
                    <span>Tap <strong>Menu ⋮</strong> (Android) or <strong>Settings ⚙️</strong> (iPhone).</span>
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
                  <span>End-to-end encrypted. Your chats sync live in real-time.</span>
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
                    <div className="flex flex-col items-center justify-center text-slate-800 space-y-2">
                      <RefreshCw className="w-8 h-8 animate-spin text-whatsapp" />
                      <p className="text-[11px] font-semibold text-slate-600">Generating QR Code...</p>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Auto-refreshes every 30 seconds
                </p>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#202c33] flex items-center justify-between">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-whatsapp" /> Instant Multi-Device Sync
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
