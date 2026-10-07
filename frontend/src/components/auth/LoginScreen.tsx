import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  UserPlus,
  QrCode,
  Users
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { API_BASE_URL } from '../../config/api';

export const LoginScreen: React.FC = () => {
  const { users, login, setUsers } = useCrm() as any;
  const [roleTab, setRoleTab] = useState<'admin' | 'coordinator'>('coordinator');
  const [authMode, setAuthMode] = useState<'pin' | 'password'>('pin');
  
  // Coordinator Dynamic State
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState<string>('');
  const [isAddingNewCoordinator, setIsAddingNewCoordinator] = useState(false);
  const [newCoordName, setNewCoordName] = useState('');
  const [newCoordPin, setNewCoordPin] = useState('2026');

  // Password / Admin Mode State
  const [email, setEmail] = useState('admin@royalwellness.lk');
  const [password, setPassword] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  
  // PIN Mode State
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  
  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter coordinators
  const coordinatorsList = users.filter((u: any) => u.role !== 'super_admin');
  const adminUser = users.find((u: any) => u.role === 'super_admin') || {
    id: 'user-admin-1',
    fullName: 'Super Admin',
    email: 'admin@royalwellness.lk',
    pin: '1234',
    role: 'super_admin'
  };

  useEffect(() => {
    if (roleTab === 'admin') {
      setEmail('admin@royalwellness.lk');
      setPassword('admin');
    } else {
      if (coordinatorsList.length > 0 && !selectedCoordinatorId) {
        setSelectedCoordinatorId(coordinatorsList[0].id);
      }
    }
    setPinDigits([]);
    setErrorMsg(null);
  }, [roleTab, coordinatorsList.length]);

  const activeUser = roleTab === 'admin' 
    ? adminUser 
    : coordinatorsList.find((u: any) => u.id === selectedCoordinatorId) || coordinatorsList[0];

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    setTimeout(() => {
      const loginIdentifier = roleTab === 'admin' ? 'admin@royalwellness.lk' : (activeUser?.email || email);
      const res = login(loginIdentifier.trim(), password);
      if (!res.success) {
        setErrorMsg(res.error || 'Invalid credentials.');
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
          const targetId = roleTab === 'admin' ? 'user-admin-1' : (activeUser?.id || activeUser?.email);
          const res = login(targetId, fullPin);
          if (!res.success) {
            setErrorMsg(res.error || 'Incorrect PIN. Default PIN: 1234 (Admin) or 2026 (Staff)');
            setPinDigits([]);
          }
          setIsSubmitting(false);
        }, 300);
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

  const handleCreateNewCoordinator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoordName.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/coordinators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newCoordName.trim(),
          pin: newCoordPin.trim() || '2026'
        })
      });

      const data = await res.json();
      if (data.success && data.user) {
        if (setUsers) {
          setUsers((prev: any[]) => [...prev, data.user]);
        }
        setIsAddingNewCoordinator(false);
        setSelectedCoordinatorId(data.user.id);
        login(data.user.id, newCoordPin);
      } else {
        setErrorMsg(data.error || 'Failed to create coordinator account.');
      }
    } catch (err: any) {
      // Fallback local create
      const localId = 'coord-' + Date.now();
      const localUser = {
        id: localId,
        fullName: newCoordName.trim(),
        email: `${newCoordName.toLowerCase().replace(/[^a-z0-9]/g, '')}@royalwellness.lk`,
        pin: newCoordPin.trim() || '2026',
        role: 'coordinator',
        active: true
      };
      if (setUsers) {
        setUsers((prev: any[]) => [...prev, localUser]);
      }
      setIsAddingNewCoordinator(false);
      setSelectedCoordinatorId(localId);
      login(localId, newCoordPin);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0b141a] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background Ambience & WhatsApp Web styling */}
      <div className="absolute top-0 left-0 right-0 h-44 bg-[#00a884] pointer-events-none opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0b141a]/80 to-[#0b141a] pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-[#111b21] border border-slate-800 rounded-2xl p-7 shadow-2xl relative z-10 space-y-6">
        
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
              Multi-Session WhatsApp Clinical Gateway
            </p>
          </div>
        </div>

        {/* Role Selector Tabs: Super Admin vs Coordinator */}
        <div className="grid grid-cols-2 gap-2 bg-[#202c33] p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setRoleTab('coordinator')}
            className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
              roleTab === 'coordinator'
                ? 'bg-[#00a884] text-black shadow-md'
                : 'text-[#8696a0] hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Coordinator</span>
          </button>
          <button
            type="button"
            onClick={() => setRoleTab('admin')}
            className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
              roleTab === 'admin'
                ? 'bg-[#00a884] text-black shadow-md'
                : 'text-[#8696a0] hover:text-white'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>Super Admin</span>
          </button>
        </div>

        {/* Coordinator Profile Selection / Creation */}
        {roleTab === 'coordinator' && !isAddingNewCoordinator && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">
                Select Your Coordinator Account
              </label>
              <button
                type="button"
                onClick={() => setIsAddingNewCoordinator(true)}
                className="text-xs text-[#00a884] hover:underline flex items-center gap-1 font-semibold"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add New</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
              {coordinatorsList.map((c: any) => {
                const isSelected = activeUser?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCoordinatorId(c.id);
                      setPinDigits([]);
                      setErrorMsg(null);
                    }}
                    className={`p-2.5 rounded-xl text-left border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#00a884]/20 border-[#00a884] text-[#00a884]'
                        : 'bg-[#202c33] border-slate-800 text-[#d1d7db] hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 pr-1">
                      <p className="text-xs font-bold truncate">{c.fullName}</p>
                      <p className="text-[10px] text-[#8696a0] truncate">Coordinator</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-[#00a884] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal/Form: Add New Coordinator Profile */}
        {roleTab === 'coordinator' && isAddingNewCoordinator && (
          <form onSubmit={handleCreateNewCoordinator} className="p-3 bg-[#202c33] border border-slate-700 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#e9edef]">New Coordinator Account</span>
              <button
                type="button"
                onClick={() => setIsAddingNewCoordinator(false)}
                className="text-[11px] text-[#8696a0] hover:text-white"
              >
                Cancel
              </button>
            </div>
            <input
              type="text"
              required
              value={newCoordName}
              onChange={(e) => setNewCoordName(e.target.value)}
              placeholder="Coordinator Full Name (e.g. Dr. Kasun)"
              className="w-full px-3 py-2 bg-[#111b21] border border-slate-700 rounded-lg text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
            />
            <input
              type="text"
              maxLength={4}
              value={newCoordPin}
              onChange={(e) => setNewCoordPin(e.target.value)}
              placeholder="4-digit PIN (default 2026)"
              className="w-full px-3 py-2 bg-[#111b21] border border-slate-700 rounded-lg text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newCoordName.trim()}
              className="w-full py-2 bg-[#00a884] hover:bg-[#00c298] text-black font-bold text-xs rounded-lg transition-all disabled:opacity-50"
            >
              Create & Login
            </button>
          </form>
        )}

        {/* Error Feedback */}
        {errorMsg && (
          <div className="p-2.5 bg-rose-950/50 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* PIN Entry Mode */}
        {authMode === 'pin' && !isAddingNewCoordinator && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-xs text-[#d1d7db] font-medium">
                Enter PIN for <span className="text-[#00a884] font-bold">{activeUser?.fullName || (roleTab === 'admin' ? 'Super Admin' : 'Coordinator')}</span>
              </p>
              <div className="flex justify-center items-center gap-3 py-2">
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
                Default PIN: <span className="text-[#00a884]">{roleTab === 'admin' ? '1234' : (activeUser?.pin || '2026')}</span>
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
            <QrCode className="w-3.5 h-3.5" /> WhatsApp Web Linked Per Account
          </span>
          <span className="text-slate-500">v2.4 Live</span>
        </div>

      </div>
    </div>
  );
};

