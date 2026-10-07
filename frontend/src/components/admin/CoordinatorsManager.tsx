import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { 
  Users, 
  UserPlus, 
  Building2, 
  Trash2, 
  X, 
  KeyRound, 
  Lock 
} from 'lucide-react';

const BRANCH_OPTIONS = [
  'Colombo',
  'Maruthamunai',
];

export const CoordinatorsManager: React.FC = () => {
  const { users, leads, addCoordinator, deleteCoordinator } = useCrm();
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('Colombo');
  const [pin, setPin] = useState('2026');
  const [password, setPassword] = useState('staff');

  const coordinators = users.filter(u => u.role === 'coordinator');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    addCoordinator({
      fullName: fullName.trim(),
      branch: branch || 'Colombo',
      pin: pin.trim() || '2026',
      password: password.trim() || 'staff',
    });

    // Reset Form
    setFullName('');
    setBranch('Colombo');
    setPin('2026');
    setPassword('staff');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 font-serif">Clinical Coordinators & Staff</h2>
          <p className="text-xs text-slate-400">Add your staff members, assign their branch location, and route incoming WhatsApp patient inquiries</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Coordinator</span>
        </button>
      </div>

      {coordinators.length === 0 ? (
        <div className="bg-[#111b21] border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">No Coordinators Added Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click the <span className="text-emerald-400 font-semibold">"Add Coordinator"</span> button above to register your team coordinators with their designated branch.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add First Coordinator</span>
          </button>
        </div>
      ) : (
        /* Coordinator Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {coordinators.map((coord) => {
            const activeLeads = leads.filter(l => l.assignedTo === coord.id && l.stage !== 'converted' && l.stage !== 'lost');
            const convertedLeads = leads.filter(l => l.assignedTo === coord.id && l.stage === 'converted');

            return (
              <div
                key={coord.id}
                className="bg-[#111b21] rounded-2xl border border-slate-800 p-5 space-y-4 shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Header with avatar */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-emerald-700/30 text-emerald-300 font-bold text-base flex items-center justify-center border border-emerald-500/30">
                        {coord.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-100">{coord.fullName}</h4>
                        <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-0.5">
                          <Building2 className="w-3 h-3" />
                          <span>{coord.branch || 'Colombo Branch'}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete coordinator "${coord.fullName}"?\n\nAll leads assigned to this coordinator will be reverted to Unassigned.`)) {
                          deleteCoordinator(coord.id);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Remove Coordinator"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Branch & Login PIN */}
                  <div className="bg-[#202c33]/60 p-2.5 rounded-xl border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-medium">Branch Location:</span>
                      <span className="font-bold text-emerald-300 flex items-center gap-1 text-xs">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                        {coord.branch || 'Colombo Branch'}
                      </span>
                    </div>
                    <div className="pt-1 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <KeyRound className="w-3 h-3 text-amber-400" /> Quick PIN:
                      </span>
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                        {coord.pin || '2026'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Workload and Conversion Stats */}
                <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#202c33]/40 p-2 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Assigned Leads</span>
                    <span className="text-base font-black font-mono text-slate-100">{activeLeads.length} active</span>
                  </div>
                  <div className="bg-[#202c33]/40 p-2 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Closed / Won</span>
                    <span className="text-base font-black font-mono text-emerald-400">{convertedLeads.length} won</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Coordinator Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111b21] border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>Add Team Coordinator</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Coordinator Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Coordinator Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Dilshan / Sarah Perera"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#202c33] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
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
                  <label className="text-xs font-bold text-slate-300 block">
                    Security PIN (4-Digits) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    placeholder="2026"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[#202c33] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 outline-none focus:border-emerald-500"
                  />
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
                >
                  Save Coordinator
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
