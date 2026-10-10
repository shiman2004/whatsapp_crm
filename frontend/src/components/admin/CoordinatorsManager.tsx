import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { 
  Users, 
  UserPlus, 
  Building2, 
  Trash2, 
  X, 
  KeyRound, 
  RefreshCw,
  UserCheck,
  ShieldCheck,
  Sparkles,
  MapPin,
  Eye,
  EyeOff
} from 'lucide-react';
import { UserRole } from '../../types';

const BRANCH_OPTIONS = [
  'Colombo',
  'Maruthamunai',
];

const generateRandomPin = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

export const CoordinatorsManager: React.FC = () => {
  const { users, leads, addCoordinator, deleteCoordinator } = useCrm();
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'coordinator' | 'leads_officer'>('all');
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  // Form State
  const [role, setRole] = useState<'coordinator' | 'leads_officer'>('leads_officer');
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('Colombo');
  const [pin, setPin] = useState(generateRandomPin());
  const [password, setPassword] = useState('staff');

  const staffMembers = users.filter(u => u.role === 'coordinator' || u.role === 'leads_officer');
  const coordinators = users.filter(u => u.role === 'coordinator');
  const leadsOfficers = users.filter(u => u.role === 'leads_officer');

  const filteredStaff = staffMembers.filter(u => {
    if (activeFilter === 'coordinator') return u.role === 'coordinator';
    if (activeFilter === 'leads_officer') return u.role === 'leads_officer';
    return true;
  });

  const handleOpenModal = (defaultRole: 'coordinator' | 'leads_officer' = 'leads_officer') => {
    setRole(defaultRole);
    setFullName('');
    setBranch('Colombo');
    setPin(generateRandomPin());
    setPassword('staff');
    setShowAddModal(true);
  };

  const handleRegeneratePin = () => {
    setPin(generateRandomPin());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    addCoordinator({
      fullName: fullName.trim(),
      branch: branch || 'Colombo',
      pin: pin.trim() || generateRandomPin(),
      password: password.trim() || 'staff',
      role: role as UserRole
    });

    // Reset Form & Close
    setFullName('');
    setBranch('Colombo');
    setPin(generateRandomPin());
    setPassword('staff');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 font-serif">Staff & Team Management</h2>
          <p className="text-xs text-slate-400">
            Add Leads Officers and Clinical Coordinators, assign branch locations, and generate access PINs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenModal('leads_officer')}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Add Leads Officer</span>
          </button>
          <button
            onClick={() => handleOpenModal('coordinator')}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Coordinator</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Counts */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFilter === 'all'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Staff ({staffMembers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('leads_officer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeFilter === 'leads_officer'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Leads Officers ({leadsOfficers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('coordinator')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeFilter === 'coordinator'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Coordinators ({coordinators.length})</span>
          </button>
        </div>
      </div>

      {filteredStaff.length === 0 ? (
        <div className="bg-[#111b21] border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800/60 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">No Staff Members Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click the buttons above to register your Leads Officers and Clinical Coordinators with auto-generated PINs.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => handleOpenModal('leads_officer')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Add Leads Officer</span>
            </button>
            <button
              onClick={() => handleOpenModal('coordinator')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Coordinator</span>
            </button>
          </div>
        </div>
      ) : (
        /* Staff Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStaff.map((staff) => {
            const isOfficer = staff.role === 'leads_officer';
            const activeLeads = leads.filter(l => l.assignedTo === staff.id && l.stage !== 'converted' && l.stage !== 'lost');
            const convertedLeads = leads.filter(l => l.assignedTo === staff.id && l.stage === 'converted');

            return (
              <div
                key={staff.id}
                className="bg-[#111b21] rounded-2xl border border-slate-800 p-5 space-y-4 shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Header with avatar & role badge */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl font-bold text-base flex items-center justify-center border ${
                        isOfficer
                          ? 'bg-indigo-700/30 text-indigo-300 border-indigo-500/30'
                          : 'bg-emerald-700/30 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {staff.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-100">{staff.fullName}</h4>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>{staff.branch || 'Colombo Branch'}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const roleName = isOfficer ? 'Leads Officer' : 'Clinical Coordinator';
                        if (window.confirm(`Are you sure you want to delete ${roleName} "${staff.fullName}"?\n\nAll leads assigned will be safely unassigned.`)) {
                          deleteCoordinator(staff.id);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Remove Staff Member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Role & Branch & Login PIN */}
                  <div className="bg-[#202c33]/60 p-2.5 rounded-xl border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-medium">System Role:</span>
                      <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] flex items-center gap-1 border ${
                        isOfficer
                          ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40'
                          : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                      }`}>
                        {isOfficer ? <ShieldCheck className="w-3 h-3 text-indigo-400" /> : <Building2 className="w-3 h-3 text-emerald-400" />}
                        {isOfficer ? 'Leads Officer' : 'Clinical Coordinator'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-medium">Branch:</span>
                      <span className="font-semibold text-slate-200 flex items-center gap-1 text-xs">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {staff.branch || 'Colombo'}
                      </span>
                    </div>

                    <div className="pt-1 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <KeyRound className="w-3 h-3 text-amber-400" /> Quick PIN:
                      </span>
                      <div className="flex items-center gap-1.5 font-mono font-bold text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-md tracking-wider">
                        <span>{revealedPins[staff.id] ? (staff.pin || (isOfficer ? '4321' : '2026')) : '••••'}</span>
                        <button
                          type="button"
                          onClick={() => setRevealedPins(prev => ({ ...prev, [staff.id]: !prev[staff.id] }))}
                          className="text-amber-400/80 hover:text-amber-200 transition-colors ml-0.5"
                          title={revealedPins[staff.id] ? "Hide PIN" : "Show PIN"}
                        >
                          {revealedPins[staff.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Workload and Conversion Stats */}
                <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#202c33]/40 p-2 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">
                      {isOfficer ? 'Managed Leads' : 'Assigned Leads'}
                    </span>
                    <span className="text-base font-black font-mono text-slate-100">{activeLeads.length} active</span>
                  </div>
                  <div className="bg-[#202c33]/40 p-2 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">
                      {isOfficer ? 'Triage / Converted' : 'Closed / Won'}
                    </span>
                    <span className="text-base font-black font-mono text-emerald-400">{convertedLeads.length} won</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Staff Modal (Coordinators + Leads Officers) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111b21] border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {role === 'leads_officer' ? (
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                ) : (
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                )}
                <span>Add {role === 'leads_officer' ? 'Leads Officer' : 'Clinical Coordinator'}</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role Selector Tabs */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  Select Role <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('leads_officer')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      role === 'leads_officer'
                        ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500 shadow-sm'
                        : 'bg-[#202c33] text-slate-400 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span>Leads Officer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('coordinator')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      role === 'coordinator'
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500 shadow-sm'
                        : 'bg-[#202c33] text-slate-400 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span>Coordinator</span>
                  </button>
                </div>
              </div>

              {/* Staff Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={role === 'leads_officer' ? 'e.g. Sarah Perera / Mohamed Rizwan' : 'e.g. Dr. Dilshan / Nurse Kavindi'}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#202c33] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500 placeholder:text-slate-500"
                />
              </div>

              {/* Branch */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  Branch Location <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BRANCH_OPTIONS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBranch(b)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                        branch === b
                          ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500 shadow-sm'
                          : 'bg-[#202c33] text-slate-400 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{b}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Security PIN & Password */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 block">
                      PIN Number <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleRegeneratePin}
                      className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold transition-colors"
                      title="Generate new random 4-digit PIN"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Auto-Gen</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={4}
                      required
                      placeholder="4-digit PIN"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full bg-[#202c33] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 tracking-wider outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={handleRegeneratePin}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-amber-400 transition-colors"
                      title="Regenerate PIN"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">
                    Web Password
                  </label>
                  <input
                    type="text"
                    placeholder="staff"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#202c33] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!fullName.trim()}
                  className={`px-5 py-2 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md ${
                    role === 'leads_officer'
                      ? 'bg-indigo-600 hover:bg-indigo-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  Create {role === 'leads_officer' ? 'Leads Officer' : 'Coordinator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
