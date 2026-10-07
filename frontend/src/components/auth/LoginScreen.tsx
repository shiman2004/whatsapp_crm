import React, { useState, useEffect } from 'react';
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
  Users
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

export const LoginScreen: React.FC = () => {
  const { users, login } = useCrm() as any;
  const [roleTab, setRoleTab] = useState<'coordinator' | 'leads_officer' | 'super_admin'>('coordinator');
  const [authMode, setAuthMode] = useState<'pin' | 'password'>('pin');
  
  // Coordinator selection / typing
  const coordinatorsList = users.filter((u: any) => u.role === 'coordinator');
  const leadsOfficersList = users.filter((u: any) => u.role === 'leads_officer');
  
  const [identifierInput, setIdentifierInput] = useState<string>('shenali@royalwellness.lk');
  const [passwordInput, setPasswordInput] = useState<string>('staff');
  const [showPassword, setShowPassword] = useState(false);
  
  // PIN Mode State
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  
  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync default identifier based on role tab
  useEffect(() => {
    setPinDigits([]);
    setErrorMsg(null);

    if (roleTab === 'super_admin') {
      setIdentifierInput('admin@royalwellness.lk');
      setPasswordInput('admin');
    } else if (roleTab === 'leads_officer') {
      const officer = leadsOfficersList[0];
      setIdentifierInput(officer ? officer.email : 'sarah@royalwellness.lk');
      setPasswordInput('staff');
    } else {
      const firstCoord = coordinatorsList[0];
      setIdentifierInput(firstCoord ? firstCoord.email : 'shenali@royalwellness.lk');
      setPasswordInput('staff');
    }
  }, [roleTab, coordinatorsList.length, leadsOfficersList.length]);

  const activeUser = users.find((u: any) => 
    u.email.toLowerCase() === identifierInput.toLowerCase() ||
    u.fullName.toLowerCase() === identifierInput.toLowerCase() ||
    u.id.toLowerCase() === identifierInput.toLowerCase()
  );

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    setTimeout(() => {
      const res = login(identifierInput.trim(), passwordInput);
      if (!res.success) {
        setErrorMsg(res.error || 'Invalid credentials.');
      }
      setIsSubmitting(false);
    }, 250);
  };

  const handlePinKey = (digit: string) => {
    setErrorMsg(null);
    if (pinDigits.length < 4) {
      const newDigits = [...pinDigits, digit];
      setPinDigits(newDigits);

      if (newDigits.length === 4) {
        const fullPin = newDigits.join('');
        setIsSubmitting(true);
        setTimeout(() => {
          const res = login(identifierInput.trim(), fullPin);
          if (!res.success) {
            setErrorMsg(res.error || 'Incorrect 4-digit PIN. Please try again.');
            setPinDigits([]);
          }
          setIsSubmitting(false);
        }, 250);
      }
    }
  };

  const handleClearPin = () => {
    setErrorMsg(null);
    setPinDigits([]);
  };

  const handleBackspace = () => {
    setErrorMsg(null);
    setPinDigits(prev => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen w-full bg-[#0b141a] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 right-0 h-44 bg-[#00a884] pointer-events-none opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0b141a]/80 to-[#0b141a] pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-[#111b21] border border-slate-800 rounded-2xl p-7 shadow-2xl relative z-10 space-y-5">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/50">
            <Crown className="w-6 h-6 text-[#111b21]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              Royal Wellness CRM
            </h1>
            <p className="text-xs text-[#8696a0]">
              Centralized WhatsApp Healthcare Gateway
            </p>
          </div>
        </div>

        {/* 3 Role Selector Tabs: Coordinator vs Leads Manager vs Super Admin */}
        <div className="grid grid-cols-3 gap-1.5 bg-[#202c33] p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setRoleTab('coordinator')}
            className={`py-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              roleTab === 'coordinator'
                ? 'bg-[#00a884] text-black shadow-md'
                : 'text-[#8696a0] hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Coordinator</span>
          </button>
          <button
            type="button"
            onClick={() => setRoleTab('leads_officer')}
            className={`py-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              roleTab === 'leads_officer'
                ? 'bg-[#00a884] text-black shadow-md'
                : 'text-[#8696a0] hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Leads Manager</span>
          </button>
          <button
            type="button"
            onClick={() => setRoleTab('super_admin')}
            className={`py-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              roleTab === 'super_admin'
                ? 'bg-[#00a884] text-black shadow-md'
                : 'text-[#8696a0] hover:text-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Super Admin</span>
          </button>
        </div>

        {/* Account Identifier Selector / Input */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider block">
            {roleTab === 'coordinator' ? 'Coordinator Account' : (roleTab === 'leads_officer' ? 'Leads Manager Account' : 'Super Admin Account')}
          </label>
          
          {roleTab === 'coordinator' && coordinatorsList.length > 0 ? (
            <select
              value={identifierInput}
              onChange={(e) => {
                setIdentifierInput(e.target.value);
                setPinDigits([]);
                setErrorMsg(null);
              }}
              className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-semibold text-white outline-none focus:border-[#00a884] transition-colors cursor-pointer"
            >
              {coordinatorsList.map((c: any) => (
                <option key={c.id} value={c.email} className="bg-[#111b21] text-white">
                  {c.fullName} ({c.email})
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
                placeholder={roleTab === 'super_admin' ? 'admin@royalwellness.lk' : 'sarah@royalwellness.lk'}
                className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-semibold text-white outline-none focus:border-[#00a884] transition-colors"
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
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                authMode === 'pin' ? 'bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40' : 'text-[#8696a0] hover:text-white'
              }`}
            >
              PIN Pad
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                setErrorMsg(null);
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                authMode === 'password' ? 'bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40' : 'text-[#8696a0] hover:text-white'
              }`}
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
          <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-2">
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
                  className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#00a884]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-[#00a884] hover:bg-[#00c298] text-black font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Verifying...' : 'Sign In to CRM'}
            </button>
          </form>
        ) : (
          /* PIN Entry Mode with Keypad */
          <div className="space-y-3.5">
            <div className="text-center space-y-1">
              <p className="text-xs text-[#d1d7db] font-medium">
                Enter PIN for <span className="text-[#00a884] font-bold">{activeUser?.fullName || identifierInput}</span>
              </p>
              <div className="flex justify-center items-center gap-3 py-1.5">
                {[0, 1, 2, 3].map((idx) => {
                  const filled = pinDigits.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                        filled 
                          ? 'bg-[#00a884] border-[#00a884] scale-110 shadow-lg shadow-[#00a884]/40' 
                          : 'bg-[#202c33] border-slate-700'
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-[10px] text-[#8696a0] font-mono">
                Default PIN: <span className="text-[#00a884]">{roleTab === 'super_admin' ? '1234' : (roleTab === 'leads_officer' ? '4321' : (activeUser?.pin || '2026'))}</span>
              </p>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handlePinKey(digit)}
                  className="h-11 rounded-xl bg-[#202c33] hover:bg-slate-700 active:scale-95 border border-slate-700 text-base font-bold text-slate-100 transition-all shadow-sm flex items-center justify-center"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearPin}
                className="h-11 rounded-xl bg-[#202c33]/60 hover:bg-slate-800 text-xs font-semibold text-[#8696a0] transition-all flex items-center justify-center"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handlePinKey('0')}
                className="h-11 rounded-xl bg-[#202c33] hover:bg-slate-700 active:scale-95 border border-slate-700 text-base font-bold text-slate-100 transition-all shadow-sm flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="h-11 rounded-xl bg-[#202c33]/60 hover:bg-slate-800 text-xs font-semibold text-[#8696a0] transition-all flex items-center justify-center"
              >
                ⌫
              </button>
            </div>
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
