import React, { useState, useEffect, useCallback } from 'react';
import { 
  Crown, 
  Lock, 
  Mail, 
  KeyRound, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Sparkles,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Users,
  ArrowLeft,
  ChevronRight,
  Building2,
  GraduationCap
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

// Helper to detect if Super Admin is unlocked via URL param (?admin=true, ?admin=1, ?admin, #admin, or /admin)
const checkIsAdminAllowed = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    const adminParam = url.searchParams.get('admin');
    const hasAdminQuery = 
      url.searchParams.has('admin') && 
      (adminParam === null || adminParam === '' || adminParam.toLowerCase() === 'true' || adminParam === '1' || adminParam.toLowerCase() === 'yes');
    const hasAdminHash = window.location.hash.toLowerCase().includes('admin');
    const hasAdminPath = window.location.pathname.toLowerCase().endsWith('/admin');
    return Boolean(hasAdminQuery || hasAdminHash || hasAdminPath);
  } catch {
    return false;
  }
};

export type PortalView = 'portal_select' | 'rwc' | 'cras' | 'ahc' | 'leads_officer' | 'super_admin' | 'student';

export const LoginScreen: React.FC = () => {
  const { users, login, refreshStaffUsers } = useCrm() as any;
  const initialAdminAllowed = checkIsAdminAllowed();
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(initialAdminAllowed);
  
  // Navigation: If admin param is present in URL, open super_admin directly; otherwise start at portal selection
  const [portalView, setPortalView] = useState<PortalView>(
    initialAdminAllowed ? 'super_admin' : 'portal_select'
  );
  
  const [logoClickCount, setLogoClickCount] = useState<number>(0);
  const [authMode, setAuthMode] = useState<'pin' | 'password'>('pin');

  // Ensure latest authoritative staff members are loaded from Supabase/Postgres
  useEffect(() => {
    if (typeof refreshStaffUsers === 'function') {
      refreshStaffUsers().catch(() => {});
    }
  }, [refreshStaffUsers]);

  // Filtered staff groups — also exclude deleted users persisted in localStorage
  const _deletedIds: string[] = (() => {
    try { return JSON.parse(localStorage.getItem('rw_crm_deleted_users') || '[]'); } catch { return []; }
  })();
  const _activeStaff = (u: any) => !_deletedIds.includes(u.id) && u.active !== false;
  const superAdmins = users.filter((u: any) => _activeStaff(u) && u.role === 'super_admin');
  const rwcUsers = users.filter((u: any) => _activeStaff(u) && (u.company === 'RWC' || (!u.company && u.role === 'coordinator')));
  const crasUsers = users.filter((u: any) => _activeStaff(u) && (u.company === 'CRAS' || (!u.company && u.role === 'coordinator')));
  const ahcUsers = users.filter((u: any) => _activeStaff(u) && (u.company === 'AHC' || (!u.company && u.role === 'coordinator')));
  const leadsOfficers = users.filter((u: any) => _activeStaff(u) && u.role === 'leads_officer');

  const [identifierInput, setIdentifierInput] = useState<string>('faiha@royalwellness.lk');
  const [passwordInput, setPasswordInput] = useState<string>('staff');
  const [showPassword, setShowPassword] = useState(false);

  // PIN Mode State
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setLockoutSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockoutSeconds]);

  const applyLoginResult = (result: { success: boolean; error?: string; retryAfter?: number }) => {
    if (result.success) return;
    if (result.retryAfter) {
      setLockoutSeconds(Math.ceil(result.retryAfter));
      const minutes = Math.floor(result.retryAfter / 60);
      const seconds = Math.ceil(result.retryAfter % 60);
      setErrorMsg(`Too many failed attempts. Try again in ${minutes}:${String(seconds).padStart(2, '0')}.`);
      return;
    }
    setErrorMsg(result.error || 'Invalid credentials.');
  };

  // Listen for URL changes or stealth shortcut (Ctrl+Shift+A or Alt+A)
  useEffect(() => {
    const evaluateUrl = () => {
      if (checkIsAdminAllowed()) {
        setIsAdminUnlocked(true);
        setPortalView('super_admin');
      }
    };

    window.addEventListener('popstate', evaluateUrl);
    window.addEventListener('hashchange', evaluateUrl);

    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) || (e.altKey && (e.key === 'A' || e.key === 'a'))) {
        e.preventDefault();
        setIsAdminUnlocked(prev => {
          const next = !prev;
          if (next) {
            setPortalView('super_admin');
          } else if (portalView === 'super_admin') {
            setPortalView('portal_select');
          }
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('popstate', evaluateUrl);
      window.removeEventListener('hashchange', evaluateUrl);
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [portalView]);

  const handleLogoClick = () => {
    setLogoClickCount(prev => {
      const next = prev + 1;
      if (next >= 3) {
        setIsAdminUnlocked(true);
        setPortalView('super_admin');
        return 0;
      }
      return next;
    });
  };

  // Sync default identifier based on active portal view
  useEffect(() => {
    setPinDigits([]);
    setErrorMsg(null);

    if (portalView === 'super_admin') {
      const firstAdmin = superAdmins[0];
      setIdentifierInput(firstAdmin ? firstAdmin.email : 'mnmshiman@gmail.com');
      setPasswordInput('admin');
    } else if (portalView === 'rwc') {
      const firstRwc = rwcUsers[0];
      setIdentifierInput(firstRwc ? firstRwc.email : 'faiha@royalwellness.lk');
      setPasswordInput('staff');
    } else if (portalView === 'cras') {
      const firstCras = crasUsers[0];
      setIdentifierInput(firstCras ? firstCras.email : 'zeenath@royalwellness.lk');
      setPasswordInput('staff');
    } else if (portalView === 'ahc') {
      const firstAhc = ahcUsers[0];
      setIdentifierInput(firstAhc ? firstAhc.email : 'staff@royalwellness.lk');
      setPasswordInput('staff');
    } else if (portalView === 'leads_officer') {
      const firstOfficer = leadsOfficers[0];
      setIdentifierInput(firstOfficer ? firstOfficer.email : 'sarah@royalwellness.lk');
      setPasswordInput('staff');
    }
  }, [portalView, superAdmins.length, rwcUsers.length, crasUsers.length, ahcUsers.length, leadsOfficers.length]);

  const activeUser = users.find((u: any) => 
    u.email.toLowerCase() === identifierInput.toLowerCase() ||
    u.fullName.toLowerCase() === identifierInput.toLowerCase() ||
    u.id.toLowerCase() === identifierInput.toLowerCase()
  );

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const res = await login(identifierInput.trim(), passwordInput);
    applyLoginResult(res);
    setIsSubmitting(false);
  };

  const handlePinKey = useCallback((digit: string) => {
    setErrorMsg(null);
    setPressedKey(digit);
    setTimeout(() => setPressedKey(null), 150);

    setPinDigits(prev => {
      if (prev.length >= 4) return prev;
      const next = [...prev, digit];
      if (next.length === 4) {
        const fullPin = next.join('');
        setIsSubmitting(true);
        setTimeout(async () => {
          const res = await login(identifierInput.trim(), fullPin);
          if (!res.success) {
            applyLoginResult(res);
            setPinDigits([]);
          }
          setIsSubmitting(false);
        }, 200);
      }
      return next;
    });
  }, [identifierInput, login]);

  const handleClearPin = useCallback(() => {
    setErrorMsg(null);
    setPressedKey('clear');
    setTimeout(() => setPressedKey(null), 150);
    setPinDigits([]);
  }, []);

  const handleBackspace = useCallback(() => {
    setErrorMsg(null);
    setPressedKey('backspace');
    setTimeout(() => setPressedKey(null), 150);
    setPinDigits(prev => prev.slice(0, -1));
  }, []);

  // Physical Keyboard Listener (Captures 0-9, Numpad 0-9, Backspace, Delete, Escape)
  useEffect(() => {
    if (portalView === 'portal_select' || authMode !== 'pin' || isSubmitting) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'SELECT' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handlePinKey(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'Delete' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClearPin();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [portalView, authMode, isSubmitting, handlePinKey, handleBackspace, handleClearPin]);

  // Portal configuration metadata
  const getPortalMeta = () => {
    switch (portalView) {
      case 'rwc':
        return {
          title: 'Royal Wellness Center',
          subtitle: 'Patient Coordinator Portal',
          accountLabel: 'Patient Coordinator Account',
          logoSrc: '/rwc-logo.png',
          accentColor: '#008000',
          badgeText: 'RWC Clinic',
          badgeClass: 'bg-emerald-950 text-emerald-400 border-emerald-800/60',
          focusBorderClass: 'focus:border-[#008000]',
          activeKeyClass: 'bg-[#008000]/40 border-[#008000] ring-[#008000]/60'
        };
      case 'cras':
        return {
          title: 'College of Royal Aesthetic',
          subtitle: 'Education Counsellor Portal',
          accountLabel: 'Education Counsellor Account',
          logoSrc: '/cras-logo.png',
          accentColor: '#800000',
          badgeText: 'CRAS Academy',
          badgeClass: 'bg-rose-950 text-rose-300 border-rose-800/60',
          focusBorderClass: 'focus:border-rose-600',
          activeKeyClass: 'bg-rose-900/50 border-rose-500 ring-rose-500/60'
        };
      case 'ahc':
        return {
          title: 'Alpha Health Consultancy',
          subtitle: 'Consultancy Advisor Portal',
          accountLabel: 'Consultancy Advisor Account',
          logoSrc: '/ahc-logo.png',
          accentColor: '#066e77',
          badgeText: 'AHC Consultancy',
          badgeClass: 'bg-teal-950 text-teal-300 border-teal-800/60',
          focusBorderClass: 'focus:border-[#066e77]',
          activeKeyClass: 'bg-[#066e77]/40 border-[#066e77] ring-[#066e77]/60'
        };
      case 'leads_officer':
        return {
          title: 'Inquiries Handling Department',
          subtitle: 'Inquiries & Leads Intake Portal',
          accountLabel: 'Inquiries Officer Account',
          logoSrc: '/inquiries-logo.png',
          accentColor: '#1d8cf8',
          badgeText: 'Common Gateway',
          badgeClass: 'bg-blue-950 text-blue-300 border-blue-800/60',
          focusBorderClass: 'focus:border-blue-500',
          activeKeyClass: 'bg-blue-900/50 border-blue-500 ring-blue-500/60'
        };
      case 'super_admin':
        return {
          title: 'Alpha Health Group',
          subtitle: 'Super Admin Gateway',
          accountLabel: 'Super Admin Account',
          logoSrc: '/logo.png',
          accentColor: '#00a884',
          badgeText: 'Executive Control',
          badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
          focusBorderClass: 'focus:border-[#00a884]',
          activeKeyClass: 'bg-[#00a884]/40 border-[#00a884] ring-[#00a884]/60'
        };
      default:
        return {
          title: 'Alpha Health Group',
          subtitle: 'Centralized Gateway',
          accountLabel: 'Account',
          logoSrc: '/logo.png',
          accentColor: '#00a884',
          badgeText: '',
          badgeClass: '',
          focusBorderClass: 'focus:border-[#00a884]',
          activeKeyClass: 'bg-[#00a884]/40 border-[#00a884] ring-[#00a884]/60'
        };
    }
  };

  const currentMeta = getPortalMeta();

  return (
    <div className="min-h-screen w-full bg-[var(--app-bg)] text-[var(--text-primary)] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background Ambience */}
      <div 
        className="absolute top-0 left-0 right-0 h-44 pointer-events-none opacity-90 transition-colors duration-500"
        style={{
          backgroundColor: portalView === 'cras' 
            ? '#800000' 
            : portalView === 'rwc' 
            ? '#008000' 
            : portalView === 'ahc'
            ? '#066e77'
            : portalView === 'leads_officer'
            ? '#4338ca'
            : '#00a884'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--app-bg)]/80 to-[var(--app-bg)] pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-7 shadow-2xl relative z-10 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* ========================================================================= */}
        {/* VIEW 1: PORTAL SELECTION (Option 2 Workplace Grid)                       */}
        {/* ========================================================================= */}
        {portalView === 'portal_select' ? (
          <div className="space-y-5">
            {/* Brand Header */}
            <div className="text-center space-y-2">
              <div 
                onClick={handleLogoClick}
                className="w-16 h-16 rounded-2xl bg-white p-1.5 flex items-center justify-center mx-auto shadow-xl overflow-hidden ring-1 ring-slate-700/50 cursor-pointer transition-transform active:scale-95"
                title="Alpha Health Group"
              >
                <img src="/logo.png" alt="Alpha Health Group Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF] tracking-wide">
                  Alpha Health Group
                </h1>
                <p className="text-xs text-[#667781] dark:text-[#8696A0]">
                  Centralized WhatsApp Healthcare & Clinical Gateway
                </p>
              </div>
              <div className="pt-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#111B21] dark:text-[#E9EDEF] bg-[#F0F2F5] dark:bg-[#2A3942] px-3 py-1 rounded-full border border-[#E0E5E7] dark:border-[#222D34] inline-block shadow-inner">
                  Select Workplace Portal
                </span>
              </div>
            </div>

            {/* Portal Cards List */}
            <div className="space-y-3 pt-1">
              
              {/* 1. Royal Wellness Center RWC Card */}
              <button
                type="button"
                onClick={() => setPortalView('rwc')}
                className="w-full p-3.5 rounded-2xl bg-[#F0F2F5] hover:bg-[#E0E5E7] dark:bg-[#2A3942] dark:hover:bg-[#202C33] border border-emerald-900/50 hover:border-emerald-500/70 shadow-lg hover:shadow-emerald-950/40 transition-all text-left flex items-center gap-3.5 group cursor-pointer active:scale-[0.99]"
              >
                <div className="w-14 h-14 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shrink-0 ring-1 ring-emerald-500/30 group-hover:ring-emerald-400 group-hover:scale-105 transition-all">
                  <img src="/rwc-logo.png" alt="Royal Wellness Center" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] group-hover:text-[#128C7E] dark:group-hover:text-[#25D366] transition-colors">
                      Royal Wellness Center
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                      RWC
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              {/* 2. College of Royal Aesthetic CRAS Card */}
              <button
                type="button"
                onClick={() => setPortalView('cras')}
                className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-[#111b21] to-[#241316] hover:to-[#2e181c] border border-rose-900/50 hover:border-rose-500/70 shadow-lg hover:shadow-rose-950/40 transition-all text-left flex items-center gap-3.5 group cursor-pointer active:scale-[0.99]"
              >
                <div className="w-14 h-14 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shrink-0 ring-1 ring-rose-500/30 group-hover:ring-rose-400 group-hover:scale-105 transition-all">
                  <img src="/cras-logo.png" alt="College of Royal Aesthetic" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] group-hover:text-rose-600 dark:group-hover:text-rose-300] transition-colors">
                      College of Royal Aesthetic
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800/60">
                      CRAS
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              {/* 3. Alpha Health Consultancy AHC Card */}
              <button
                type="button"
                onClick={() => setPortalView('ahc')}
                className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-[#111b21] to-[#122325] hover:to-[#173033] border border-teal-900/50 hover:border-[#066e77]/70 shadow-lg hover:shadow-teal-950/40 transition-all text-left flex items-center gap-3.5 group cursor-pointer active:scale-[0.99]"
              >
                <div className="w-14 h-14 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shrink-0 ring-1 ring-teal-500/30 group-hover:ring-teal-400 group-hover:scale-105 transition-all">
                  <img src="/ahc-logo.png" alt="Alpha Health Consultancy" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors">
                      Alpha Health Consultancy
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-950 text-teal-300 border border-teal-800/60">
                      AHC
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              {/* 4. Inquiries Handling Department Card (Common for every lead officer) */}
              <button
                type="button"
                onClick={() => setPortalView('leads_officer')}
                className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-[#111b21] to-[#151a2b] hover:to-[#1a2137] border border-indigo-900/50 hover:border-indigo-500/70 shadow-lg hover:shadow-indigo-950/40 transition-all text-left flex items-center gap-3.5 group cursor-pointer active:scale-[0.99]"
              >
                <div className="w-14 h-14 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shrink-0 ring-1 ring-blue-500/30 group-hover:ring-blue-400 group-hover:scale-105 transition-all overflow-hidden">
                  <img src="/inquiries-logo.png" alt="Inquiries Handling Department" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                      Inquiries Handling Department
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                      Common
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              {/* 4. Super Admin (Discreetly rendered when unlocked via ?admin=true or shortcut) */}
              {isAdminUnlocked && (
                <button
                  type="button"
                  onClick={() => setPortalView('super_admin')}
                  className="w-full p-3 rounded-2xl bg-gradient-to-r from-amber-950/40 to-[#111b21] hover:to-amber-950/60 border border-amber-600/50 hover:border-amber-400 shadow-md transition-all text-left flex items-center gap-3 group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
                    <Crown className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-amber-300 block">
                      Super Admin Gateway
                    </span>
                    <span className="text-[10px] text-[#8696a0] block truncate">
                      Executive access & system administration
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              )}

            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: SPECIFIC PORTAL LOGIN SCREEN                                      */
          /* ========================================================================= */
          <div className="space-y-4">
            
            {/* Top Navigation Row: Back Button */}
            <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
              <button
                type="button"
                onClick={() => setPortalView('portal_select')}
                className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-800"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Switch Portal</span>
              </button>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentMeta.badgeClass}`}>
                {currentMeta.badgeText}
              </span>
            </div>

            {/* Portal Specific Brand Header */}
            <div className="text-center space-y-2">
              <div 
                className="w-16 h-16 rounded-2xl bg-white p-1.5 flex items-center justify-center mx-auto shadow-xl overflow-hidden ring-1 ring-slate-700/50"
              >
                <img 
                  src={currentMeta.logoSrc} 
                  alt={currentMeta.title} 
                  className="w-full h-full object-contain" 
                />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">
                  {currentMeta.title}
                </h2>
                <p 
                  className="text-xs font-semibold"
                  style={{ color: currentMeta.accentColor }}
                >
                  {currentMeta.subtitle}
                </p>
              </div>
            </div>

            {/* Account Identifier Selector / Input */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider block">
                {currentMeta.accountLabel}
              </label>
              
              {portalView === 'super_admin' && superAdmins.length > 0 ? (
                <select
                  value={identifierInput}
                  onChange={(e) => {
                    setIdentifierInput(e.target.value);
                    setPinDigits([]);
                    setErrorMsg(null);
                  }}
                  className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs font-semibold text-white outline-none focus:border-[#00a884] transition-colors cursor-pointer"
                >
                  {superAdmins.map((a: any) => (
                    <option key={a.id} value={a.email} className="bg-[#111b21] text-white">
                      {a.fullName} — Super Admin ({a.branch || 'Executive'})
                    </option>
                  ))}
                </select>
              ) : portalView === 'rwc' && rwcUsers.length > 0 ? (
                <select
                  value={identifierInput}
                  onChange={(e) => {
                    setIdentifierInput(e.target.value);
                    setPinDigits([]);
                    setErrorMsg(null);
                  }}
                  className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs font-semibold text-white outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                >
                  {rwcUsers.map((c: any) => (
                    <option key={c.id} value={c.email} className="bg-[#111b21] text-white">
                      {c.fullName} — {c.role === 'coordinator' ? 'Patient Coordinator' : (c.roleTitle || c.role?.replace(/_/g, ' ') || 'Staff')} ({c.branch || 'Colombo'})
                    </option>
                  ))}
                </select>
              ) : portalView === 'cras' && crasUsers.length > 0 ? (
                <select
                  value={identifierInput}
                  onChange={(e) => {
                    setIdentifierInput(e.target.value);
                    setPinDigits([]);
                    setErrorMsg(null);
                  }}
                  className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs font-semibold text-white outline-none focus:border-rose-600 transition-colors cursor-pointer"
                >
                  {crasUsers.map((c: any) => (
                    <option key={c.id} value={c.email} className="bg-[#111b21] text-white">
                      {c.fullName} — {c.role === 'coordinator' ? 'Education Counsellor' : (c.roleTitle || c.role?.replace(/_/g, ' ') || 'Staff')} ({c.branch || 'Colombo'})
                    </option>
                  ))}
                </select>
              ) : portalView === 'ahc' ? (
                <select
                  value={identifierInput}
                  onChange={(e) => {
                    setIdentifierInput(e.target.value);
                    setPinDigits([]);
                    setErrorMsg(null);
                  }}
                  className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs font-semibold text-white outline-none focus:border-[#066e77] transition-colors cursor-pointer"
                >
                  {ahcUsers.length > 0 ? (
                    ahcUsers.map((c: any) => (
                      <option key={c.id} value={c.email} className="bg-[#111b21] text-white">
                        {c.fullName} — {c.role === 'coordinator' ? 'Consultancy Advisor' : (c.roleTitle || c.role?.replace(/_/g, ' ') || 'Staff')} ({c.branch || 'Colombo'})
                      </option>
                    ))
                  ) : (
                    <option value="staff@royalwellness.lk" className="bg-[#111b21] text-white">
                      Consultancy Advisor (staff@royalwellness.lk)
                    </option>
                  )}
                </select>
              ) : portalView === 'leads_officer' && leadsOfficers.length > 0 ? (
                <select
                  value={identifierInput}
                  onChange={(e) => {
                    setIdentifierInput(e.target.value);
                    setPinDigits([]);
                    setErrorMsg(null);
                  }}
                  className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs font-semibold text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                >
                  {leadsOfficers.map((o: any) => (
                    <option key={o.id} value={o.email} className="bg-[#111b21] text-white">
                      {o.fullName} — Inquiries & Leads Officer (Common Gateway)
                    </option>
                  ))}
                </select>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={identifierInput}
                    onChange={(e) => {
                      setIdentifierInput(e.target.value);
                      setPinDigits([]);
                      setErrorMsg(null);
                    }}
                    placeholder={portalView === 'super_admin' ? 'admin@royalwellness.lk' : 'staff@royalwellness.lk'}
                    className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs font-semibold text-white outline-none focus:border-[#00a884] transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Auth Mode Switch: PIN vs Password */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[#8696a0] font-medium">
                Authentication Method:
              </span>
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('pin');
                    setPinDigits([]);
                    setErrorMsg(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    authMode === 'pin' 
                      ? 'bg-slate-700 text-white shadow-xs' 
                      : 'text-[#8696a0] hover:text-white'
                  }`}
                  style={authMode === 'pin' ? { backgroundColor: `${currentMeta.accentColor}33`, color: currentMeta.accentColor } : {}}
                >
                  PIN Pad
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('password');
                    setErrorMsg(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    authMode === 'password' 
                      ? 'bg-slate-700 text-white shadow-xs' 
                      : 'text-[#8696a0] hover:text-white'
                  }`}
                  style={authMode === 'password' ? { backgroundColor: `${currentMeta.accentColor}33`, color: currentMeta.accentColor } : {}}
                >
                  Password
                </button>
              </div>
            </div>

            {/* Error Feedback */}
            {errorMsg && (
              <div className="p-2.5 bg-rose-950/50 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Password Form Mode */}
            {authMode === 'password' ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Account Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                      style={{ borderColor: undefined }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || lockoutSeconds > 0}
                  style={{ backgroundColor: currentMeta.accentColor }}
                  className="w-full py-2.5 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Verifying...' : lockoutSeconds > 0 ? `Try again in ${Math.ceil(lockoutSeconds / 60)} min` : `Sign In to ${currentMeta.title}`}
                </button>
              </form>
            ) : (
              /* PIN Entry Mode with Keypad */
              <div className="space-y-3">
                <div className="text-center space-y-1">
                  <p className="text-xs text-[#d1d7db] font-medium">
                    Enter PIN for <span className="font-bold text-white">{activeUser?.fullName || identifierInput}</span>
                  </p>
                  <div className="flex justify-center items-center gap-3 py-1">
                    {[0, 1, 2, 3].map((idx) => {
                      const filled = pinDigits.length > idx;
                      return (
                        <div
                          key={idx}
                          style={filled ? { backgroundColor: currentMeta.accentColor, borderColor: currentMeta.accentColor } : {}}
                          className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                            filled 
                              ? 'scale-110 shadow-lg' 
                              : 'bg-[#202c33] border-slate-700'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-[#8696a0] font-sans">
                    Type with keyboard or tap keypad
                  </p>
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      disabled={isSubmitting || lockoutSeconds > 0}
                      onClick={() => handlePinKey(digit)}
                      className={`h-11 rounded-xl bg-[#202c33] hover:bg-slate-700 active:scale-95 border border-slate-700 text-base font-bold text-slate-100 transition-all shadow-sm flex items-center justify-center cursor-pointer ${
                        pressedKey === digit ? 'bg-slate-600 scale-95 ring-2 ring-white/60 text-white' : ''
                      }`}
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClearPin}
                    className={`h-11 rounded-xl bg-[#202c33]/60 hover:bg-slate-800 text-xs font-semibold text-[#8696a0] transition-all flex items-center justify-center cursor-pointer ${
                      pressedKey === 'clear' ? 'bg-[#202c33] text-white scale-95 ring-1 ring-slate-500' : ''
                    }`}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || lockoutSeconds > 0}
                    onClick={() => handlePinKey('0')}
                    className={`h-11 rounded-xl bg-[#202c33] hover:bg-slate-700 active:scale-95 border border-slate-700 text-base font-bold text-slate-100 transition-all shadow-sm flex items-center justify-center cursor-pointer ${
                      pressedKey === '0' ? 'bg-slate-600 scale-95 ring-2 ring-white/60 text-white' : ''
                    }`}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className={`h-11 rounded-xl bg-[#202c33]/60 hover:bg-slate-800 text-xs font-semibold text-[#8696a0] transition-all flex items-center justify-center cursor-pointer ${
                      pressedKey === 'backspace' ? 'bg-[#202c33] text-white scale-95 ring-1 ring-slate-500' : ''
                    }`}
                  >
                    ⌫
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Security / Feature Banner */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-[#8696a0]">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <QrCode className="w-3.5 h-3.5" /> Central WhatsApp Multi-Branch Gateway
          </span>
          <span className="text-slate-500">v2.5 Live</span>
        </div>

      </div>
    </div>
  );
};
