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
  ChevronDown,
  Menu,
  Bell,
  Sun,
  Moon
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { MetaApiModal } from './MetaApiModal';
import { WhatsAppQrModal } from './WhatsAppQrModal';
import { BlinkingBellNotification } from '../notifications/BlinkingBellNotification';

interface HeaderProps {
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileSidebar }) => {
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
    setQrModalOpen,
    notificationSettings,
    setNotificationSettingsOpen,
    theme,
    toggleTheme
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
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111b21] px-2.5 sm:px-5 flex items-center justify-between sticky top-0 z-30 shrink-0 w-full transition-colors">
        {/* Left: Mobile Menu Toggle + Brand Logo & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {onToggleMobileSidebar && (
            <button
              type="button"
              onClick={onToggleMobileSidebar}
              className="md:hidden p-2 -ml-1 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#202c33] active:bg-slate-200 dark:active:bg-[#2a3942] transition-colors shrink-0 flex items-center justify-center cursor-pointer shadow-xs"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-whatsapp" />
            </button>
          )}

          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white p-0.5 flex items-center justify-center shadow overflow-hidden ring-1 ring-slate-300 dark:ring-slate-700/50 shrink-0">
            <img src="/logo.png" alt="Alpha Health Group Logo" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0 truncate hidden xs:block sm:block">
            <h1 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white font-serif tracking-wide truncate">
              Alpha Health Group
            </h1>
          </div>
        </div>

        {/* Right Controls: Link Device (QR) + Meta API + Theme Toggle + User Profile Dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          
          {/* Light / Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all bg-slate-100 hover:bg-slate-200 dark:bg-[#202c33] dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-xs cursor-pointer active:scale-95"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {/* WhatsApp Web QR Code Link Device Button with Real-time Status */}
          <button
            type="button"
            onClick={() => setQrModalOpen(true)}
            title={whatsappStatus === 'connected' ? 'WhatsApp Web Linked' : whatsappStatus === 'syncing' ? 'Syncing...' : 'Link Device (QR)'}
            className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer ${
              whatsappStatus === 'connected'
                ? 'bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-500/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/80'
                : whatsappStatus === 'syncing'
                ? 'bg-amber-100 dark:bg-amber-950/80 border border-amber-500/50 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/80 animate-pulse'
                : 'bg-whatsapp hover:bg-emerald-500 text-slate-950'
            }`}
          >
            <QrCode className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">
              {whatsappStatus === 'connected' 
                ? '🟢 Linked' 
                : whatsappStatus === 'syncing' 
                ? '🔄 Syncing...' 
                : 'Link Device (QR)'}
            </span>
            <span className="sm:hidden text-[11px]">
              {whatsappStatus === 'connected' 
                ? 'Linked' 
                : whatsappStatus === 'syncing' 
                ? 'Sync...' 
                : 'QR'}
            </span>
          </button>

          {/* Meta Cloud API Live Bridge Toggle */}
          <button
            type="button"
            onClick={() => setMetaModalOpen(true)}
            title="Meta Cloud API Settings & Live Status"
            className="px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-400 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 shadow-xs cursor-pointer"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Meta API</span>
            <span className="sm:hidden text-[11px]">API</span>
          </button>

          {/* Real-time WhatsApp Blinking Bell Notification (Global across all CRM views) */}
          <BlinkingBellNotification variant="top-header" />

          {/* Authenticated User Profile Badge & Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#202c33] dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700/80 rounded-xl px-2 sm:px-2.5 py-1 transition-all shadow-xs cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold text-[11px] shrink-0">
                {currentUser?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[110px]">
                  {currentUser?.fullName?.split(' ')[0]}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-tight">
                  {currentUser?.role === 'super_admin' 
                    ? 'Super Admin' 
                    : (currentUser?.role === 'leads_officer' 
                      ? 'Leads Officer' 
                      : (currentUser?.company === 'CRAS' ? 'Education Counsellor' : 'Patient Coordinator'))}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ml-0.5 shrink-0" />
            </button>

            {/* Dropdown Menu */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700/90 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 flex flex-col">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser?.fullName}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{currentUser?.email}</p>
                </div>

                {/* Switch Profile Section - Scrollable for clean compact view */}
                {isSuperAdmin && (
                  <div className="py-1">
                    <label className="text-[10px] font-bold text-slate-500 px-3 uppercase tracking-wider block py-1">
                      Switch Profile (Admin View)
                    </label>
                    <div className="max-h-56 overflow-y-auto pr-1 space-y-0.5 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                      {users.map((u: any) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setCurrentUser(u);
                            setUserDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer ${
                            currentUser?.id === u.id 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold' 
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#202c33] hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <span className="truncate">{u.fullName}</span>
                          {currentUser?.id === u.id && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0 ml-1.5">Active</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Log Out Button Pinned Directly Under It */}
                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 shrink-0 mt-1">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-300 flex items-center gap-2 transition-all cursor-pointer"
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
