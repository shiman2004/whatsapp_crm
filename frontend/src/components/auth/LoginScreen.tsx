import React, { useState } from 'react';
import { 
  Crown, 
  Lock, 
  Mail, 
  KeyRound, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Sparkles,
  UserCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

export const LoginScreen: React.FC = () => {
  const { users, login } = useCrm() as any;
  const [authMode, setAuthMode] = useState<'pin' | 'password'>('pin');
  
  // Password Mode State
  const [email, setEmail] = useState('admin@royalwellness.lk');
  const [password, setPassword] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  
  // PIN Mode State
  const [selectedUser, setSelectedUser] = useState<any>(users[0] || null);
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  
  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    setTimeout(() => {
      const res = login(email.trim(), password);
      if (!res.success) {
        setErrorMsg(res.error || 'Invalid email or password.');
      }
      setIsSubmitting(false);
    }, 300);
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
          const res = login(selectedUser?.email || selectedUser?.id, fullPin);
          if (!res.success) {
            setErrorMsg(res.error || 'Incorrect security PIN. Please try again.');
            setPinDigits([]);
          }
          setIsSubmitting(false);
        }, 350);
      }
    }
  };

  const handleBackspace = () => {
    setErrorMsg(null);
    setPinDigits(prev => prev.slice(0, -1));
  };

  const handleClearPin = () => {
    setErrorMsg(null);
    setPinDigits([]);
  };

  const handleQuickSelectUser = (user: any) => {
    setSelectedUser(user);
    setEmail(user.email);
    setPassword(user.password || (user.role === 'super_admin' ? 'admin' : 'staff'));
    setPinDigits([]);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#0b141a] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background Ambience & Grid Patterns */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/30 via-slate-950 to-[#0b141a] pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-[#111b21]/95 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-7 shadow-2xl relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/50 border border-emerald-400/30">
            <Crown className="w-7 h-7 text-amber-200" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-serif text-white tracking-wide">
              Royal Wellness Center
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              WhatsApp Clinical Lead Management & CRM
            </p>
          </div>
        </div>

        {/* Quick Staff Account Switcher */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Select Staff Profile
          </label>
          <div className="grid grid-cols-3 gap-2">
            {users.slice(0, 3).map((u: any) => {
              const isSelected = selectedUser?.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickSelectUser(u)}
                  className={`p-2 rounded-xl text-left border transition-all flex flex-col items-start gap-1 ${
                    isSelected 
                      ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200 shadow-sm' 
                      : 'bg-[#202c33]/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-[#202c33]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold truncate">{u.fullName.split(' ')[0]}</span>
                    {isSelected && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                  </div>
                  <span className="text-[10px] text-slate-400 truncate">
                    {u.role === 'super_admin' ? 'Admin' : 'Staff'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Toggle: PIN vs Password */}
        <div className="flex bg-[#202c33] p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => { setAuthMode('pin'); setErrorMsg(null); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              authMode === 'pin' 
                ? 'bg-emerald-600 text-white shadow' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>4-Digit PIN</span>
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('password'); setErrorMsg(null); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              authMode === 'password' 
                ? 'bg-emerald-600 text-white shadow' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Password</span>
          </button>
        </div>

        {/* Error Feedback */}
        {errorMsg && (
          <div className="p-2.5 bg-rose-950/50 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* PIN Entry Mode */}
        {authMode === 'pin' && (
          <div className="space-y-4">
            {/* PIN Dots Display */}
            <div className="text-center space-y-2">
              <p className="text-xs text-slate-300 font-medium">
                Enter PIN for <span className="text-emerald-400 font-bold">{selectedUser?.fullName || 'Staff'}</span>
              </p>
              <div className="flex justify-center items-center gap-3 py-2">
                {[0, 1, 2, 3].map((idx) => {
                  const filled = pinDigits.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                        filled 
                          ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-lg shadow-emerald-500/50' 
                          : 'bg-[#202c33] border-slate-700'
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Default PIN: <span className="text-emerald-400">{selectedUser?.pin || (selectedUser?.role === 'super_admin' ? '1234' : '2026')}</span>
              </p>
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handlePinKey(digit)}
                  className="h-12 rounded-2xl bg-[#202c33] hover:bg-slate-700 active:scale-95 border border-slate-700/80 text-lg font-bold text-slate-100 transition-all shadow-sm flex items-center justify-center"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearPin}
                className="h-12 rounded-2xl bg-[#202c33]/60 hover:bg-slate-800 text-xs font-semibold text-slate-400 transition-all flex items-center justify-center"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handlePinKey('0')}
                className="h-12 rounded-2xl bg-[#202c33] hover:bg-slate-700 active:scale-95 border border-slate-700/80 text-lg font-bold text-slate-100 transition-all shadow-sm flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="h-12 rounded-2xl bg-[#202c33]/60 hover:bg-slate-800 text-xs font-semibold text-slate-400 transition-all flex items-center justify-center"
              >
                ⌫
              </button>
            </div>
          </div>
        )}

        {/* Password Entry Mode */}
        {authMode === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Staff Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@royalwellness.lk"
                  className="w-full pl-9 pr-3 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Default password: <span className="text-emerald-400 font-mono">admin</span> (or <span className="text-emerald-400 font-mono">staff</span>)
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to CRM'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Security Assurance Footer */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> End-to-End Encrypted
          </span>
          <span className="text-slate-500">v2.4 Production</span>
        </div>

      </div>
    </div>
  );
};
