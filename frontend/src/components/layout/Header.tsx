import React, { useState, useRef, useEffect } from 'react';
import { 
  Crown, 
  Smartphone, 
  ShieldCheck, 
  UserCheck, 
  QrCode, 
  Radio, 
  Trash2,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { MetaApiModal } from './MetaApiModal';
import { WhatsAppQrModal } from './WhatsAppQrModal';

export const Header: React.FC = () => {
  const { 
    currentUser, 
    users, 
    setCurrentUser, 
    logout,
    isSuperAdmin, 
    simulatorOpen, 
    setSimulatorOpen, 
    clearAllData, 
    whatsappStatus, 
    qrModalOpen, 
    setQrModalOpen 
  } = useCrm() as any;

  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            <Crown className="w-4 h-4 text-amber-200" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white font-serif tracking-wide">
              Royal Wellness Center
            </h1>
          </div>
        </div>

        {/* Right Controls: Link Device (QR) + Meta API + Simulator + Clear Data + User Profile Dropdown */}
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

          {/* Authenticated User Profile Badge & Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 bg-[#202c33] hover:bg-slate-800 border border-slate-700/80 rounded-xl px-2.5 py-1 transition-all shadow-sm"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold text-[11px]">
                {currentUser?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold text-slate-200 leading-tight truncate max-w-[110px]">
                  {currentUser?.fullName?.split(' ')[0]}
                </p>
                <p className="text-[10px] text-emerald-400 leading-tight">
                  {isSuperAdmin ? 'Super Admin' : 'Staff'}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {/* Dropdown Menu */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#111b21] border border-slate-700/90 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 space-y-1.5">
                <div className="px-3 py-2 border-b border-slate-800">
                  <p className="text-xs font-bold text-white truncate">{currentUser?.fullName}</p>
                  <p className="text-[11px] text-slate-400 font-mono truncate">{currentUser?.email}</p>
                </div>

                {/* Switch Profile Section - ONLY for Super Admin */}
                {isSuperAdmin && (
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-500 px-3 uppercase tracking-wider block pt-1">
                      Switch Profile (Admin View)
                    </label>
                    {users.map((u: any) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setCurrentUser(u);
                          setUserDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                          currentUser?.id === u.id 
                            ? 'bg-emerald-950/60 text-emerald-300 font-bold' 
                            : 'text-slate-300 hover:bg-[#202c33] hover:text-white'
                        }`}
                      >
                        <span className="truncate">{u.fullName}</span>
                        {currentUser?.id === u.id && <span className="text-[10px] text-emerald-400 font-bold">Active</span>}
                      </button>
                    ))}
                  </div>
                )}

                <div className="pt-1 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 flex items-center gap-2 transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Lock & Log Out</span>
                  </button>
                </div>
              </div>
            )}
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
