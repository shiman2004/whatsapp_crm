import React, { useState } from 'react';
import { 
  Crown, 
  Smartphone, 
  ShieldCheck, 
  UserCheck,
  QrCode,
  Radio,
  Trash2
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { MetaApiModal } from './MetaApiModal';
import { WhatsAppQrModal } from './WhatsAppQrModal';

export const Header: React.FC = () => {
  const { 
    currentUser, 
    users, 
    setCurrentUser, 
    isSuperAdmin,
    simulatorOpen, 
    setSimulatorOpen,
    clearAllData,
    whatsappStatus,
    qrModalOpen,
    setQrModalOpen
  } = useCrm();

  const [metaModalOpen, setMetaModalOpen] = useState(false);

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to remove all leads, messages, and test data? Authentic clinic treatments and templates will be kept.')) {
      clearAllData();
    }
  };

  return (
    <>
      <header className="h-14 border-b border-slate-800 bg-[#111b21] px-5 flex items-center justify-between sticky top-0 z-30">
        {/* Brand Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow">
            <Crown className="w-4 h-4 text-gold-200" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white font-serif tracking-wide">
              Royal Wellness Center
            </h1>
          </div>
        </div>

        {/* Right Controls: Link Device (QR) + Meta API + Simulator + Clear Data + Role Switcher */}
        <div className="flex items-center gap-2.5">
          
          {/* WhatsApp Web QR Code Link Device Button with Real-time Status */}
          <button
            onClick={() => setQrModalOpen(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
              whatsappStatus === 'connected'
                ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80'
                : whatsappStatus === 'syncing'
                ? 'bg-amber-950/80 border border-amber-500/50 text-amber-300 hover:bg-amber-900/80 animate-pulse'
                : 'bg-whatsapp hover:bg-emerald-500 text-slate-950'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>
              {whatsappStatus === 'connected' 
                ? '🟢 Linked' 
                : whatsappStatus === 'syncing' 
                ? '🔄 Syncing...' 
                : 'Link Device (QR)'}
            </span>
          </button>

          {/* Meta Cloud API Live Bridge Toggle */}
          <button
            onClick={() => setMetaModalOpen(true)}
            className="px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Meta API</span>
          </button>

          {/* Customer Simulator Toggle */}
          <button
            onClick={() => setSimulatorOpen(!simulatorOpen)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              simulatorOpen 
                ? 'bg-whatsapp text-slate-950 border-whatsapp' 
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{simulatorOpen ? 'Close Phone' : 'Test WhatsApp'}</span>
          </button>

          {/* Clear CRM Data Button */}
          <button
            onClick={handleClearData}
            title="Clear all demo/test leads and conversations"
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all bg-rose-950/40 border border-rose-800/50 text-rose-300 hover:bg-rose-900/60 hover:text-rose-200 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Clear Data</span>
          </button>

          {/* User Role Switcher */}
          <div className="flex items-center gap-1.5 bg-[#202c33] border border-slate-700/60 rounded-lg px-2 py-0.5">
            {isSuperAdmin ? (
              <ShieldCheck className="w-3.5 h-3.5 text-gold-400 shrink-0" />
            ) : (
              <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <select
              value={currentUser.id}
              onChange={(e) => {
                const selected = users.find(u => u.id === e.target.value);
                if (selected) setCurrentUser(selected);
              }}
              className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer py-1"
            >
              {users.map(u => (
                <option key={u.id} value={u.id} className="bg-slate-900">
                  {u.fullName} ({u.role === 'super_admin' ? 'Admin' : 'Coordinator'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* WhatsApp Web QR Code Pairing Modal */}
      <WhatsAppQrModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
      />

      {/* Meta API Settings & Test Sender Modal */}
      <MetaApiModal 
        isOpen={metaModalOpen} 
        onClose={() => setMetaModalOpen(false)} 
      />
    </>
  );
};
