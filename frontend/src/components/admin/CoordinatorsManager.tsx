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
  ShieldCheck, 
  Sparkles, 
  MapPin, 
  Eye, 
  EyeOff,
  User as UserIcon,
  Briefcase,
  Lock,
  Pencil,
  Check
} from 'lucide-react';
import { CompanyCode, UserRole, User } from '../../types';
import { CompanyTagBadge } from '../common/CompanyTagBadge';

const BRANCH_OPTIONS = [
  'Maruthamunai',
  'Colombo'
];

type StaffRoleChoice = 'leads_officer' | 'coordinator_cras' | 'coordinator_rwc';
type StaffFilter = 'all' | 'leads_officer' | 'coordinator_rwc' | 'coordinator_cras';

const generateRandomPin = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

export const CoordinatorsManager: React.FC = () => {
  const { users, leads, addCoordinator, updateCoordinator, deleteCoordinator } = useCrm();
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StaffFilter>('all');
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  // Edit Staff State (Name & Branch only)
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editBranch, setEditBranch] = useState('Colombo');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Form State
  const [selectedRoleChoice, setSelectedRoleChoice] = useState<StaffRoleChoice>('coordinator_rwc');
  const [company, setCompany] = useState<CompanyCode>('RWC');
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('Colombo');
  const [pin, setPin] = useState(generateRandomPin());
  const [password, setPassword] = useState('staff');

  const staffMembers = users.filter(u => u.role === 'coordinator' || u.role === 'leads_officer');
  const leadsOfficers = users.filter(u => u.role === 'leads_officer');
  const rwcCoordinators = users.filter(u => u.role === 'coordinator' && (u.company === 'RWC' || !u.company));
  const crasCoordinators = users.filter(u => u.role === 'coordinator' && u.company === 'CRAS');

  const filteredStaff = staffMembers.filter(u => {
    if (activeFilter === 'leads_officer') return u.role === 'leads_officer';
    if (activeFilter === 'coordinator_rwc') return u.role === 'coordinator' && (u.company === 'RWC' || !u.company);
    if (activeFilter === 'coordinator_cras') return u.role === 'coordinator' && u.company === 'CRAS';
    return true;
  });

  const handleRoleChange = (choice: StaffRoleChoice) => {
    setSelectedRoleChoice(choice);
    if (choice === 'coordinator_rwc') {
      setCompany('RWC');
    } else if (choice === 'coordinator_cras') {
      setCompany('CRAS');
    }
  };

  const handleOpenModal = () => {
    setSelectedRoleChoice('coordinator_rwc');
    setCompany('RWC');
    setFullName('');
    setBranch('Colombo');
    setPin(generateRandomPin());
    setPassword('staff');
    setShowAddModal(true);
  };

  const handleRegeneratePin = () => {
    setPin(generateRandomPin());
  };

  const handleOpenEditModal = (staff: User) => {
    setEditingStaff(staff);
    setEditFullName(staff.fullName || '');
    setEditBranch(staff.branch || 'Colombo');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !editFullName.trim()) return;

    setIsSubmittingEdit(true);
    try {
      await updateCoordinator(editingStaff.id, {
        fullName: editFullName.trim(),
        branch: editBranch.trim() || 'Colombo'
      });
      setEditingStaff(null);
    } catch (err) {
      console.error('Failed to update staff member:', err);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    let systemRole: UserRole = 'coordinator';
    let assignedCompany: CompanyCode | undefined = undefined;

    if (selectedRoleChoice === 'leads_officer') {
      systemRole = 'leads_officer';
      assignedCompany = undefined; // Common role for all leads across both companies
    } else if (selectedRoleChoice === 'coordinator_cras') {
      systemRole = 'coordinator';
      assignedCompany = 'CRAS';
    } else {
      systemRole = 'coordinator';
      assignedCompany = 'RWC';
    }

    addCoordinator({
      fullName: fullName.trim(),
      branch: branch || 'Colombo',
      company: assignedCompany,
      pin: pin.trim() || generateRandomPin(),
      password: password.trim() || 'staff',
      role: systemRole
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
            Manage Leads Officers and Coordinators (RWC & CRAS), assign branch locations, and generate access PINs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenModal}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-emerald-900/30 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Staffs</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Counts */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
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
            onClick={() => setActiveFilter('coordinator_rwc')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'coordinator_rwc'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#008000]" />
            <span>Coordinators (RWC) ({rwcCoordinators.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('coordinator_cras')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'coordinator_cras'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#800000]" />
            <span>Coordinators (CRAS) ({crasCoordinators.length})</span>
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
            Click the button below to register Leads Officers and Coordinators for RWC or CRAS with auto-generated PINs.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={handleOpenModal}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Staffs</span>
            </button>
          </div>
        </div>
      ) : (
        /* Staff Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStaff.map((staff) => {
            const isOfficer = staff.role === 'leads_officer';
            const isCras = staff.company === 'CRAS';
            const activeLeads = leads.filter(l => l.assignedTo === staff.id && l.stage !== 'converted' && l.stage !== 'lost');
            const convertedLeads = leads.filter(l => l.assignedTo === staff.id && l.stage === 'converted');

            const roleDisplay = isOfficer 
              ? 'Leads Officer' 
              : isCras 
              ? 'Coordinator (CRAS)' 
              : 'Coordinator (RWC)';

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
                          : isCras
                          ? 'bg-rose-900/40 text-rose-300 border-rose-700/40'
                          : 'bg-emerald-700/30 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {staff.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                          <span>{staff.fullName}</span>
                          {!isOfficer && <CompanyTagBadge company={staff.company || 'RWC'} size="xs" />}
                        </h4>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>{staff.branch || 'Colombo Branch'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleOpenEditModal(staff)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Edit Staff (Name & Branch only)"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete ${roleDisplay} "${staff.fullName}"?\n\nAll leads assigned will be safely unassigned.`)) {
                            deleteCoordinator(staff.id);
                          }
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Remove Staff Member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Role & Branch & Login PIN */}
                  <div className="bg-[#202c33]/60 p-2.5 rounded-xl border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-medium">Role:</span>
                      <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] flex items-center gap-1 border ${
                        isOfficer
                          ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40'
                          : isCras
                          ? 'bg-[#800000]/30 text-rose-300 border-[#800000]/60'
                          : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                      }`}>
                        {isOfficer ? (
                          <ShieldCheck className="w-3 h-3 text-indigo-400" />
                        ) : (
                          <Building2 className={`w-3 h-3 ${isCras ? 'text-rose-400' : 'text-emerald-400'}`} />
                        )}
                        {roleDisplay}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-medium">Company:</span>
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                        {isOfficer ? (
                          <span className="text-indigo-300 text-[11px] font-semibold flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Common (All Leads)
                          </span>
                        ) : (
                          <CompanyTagBadge company={staff.company || 'RWC'} size="xs" showFullName={true} />
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-medium">Branch Location:</span>
                      <span className="font-semibold text-slate-200 flex items-center gap-1 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
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
                          className="text-amber-400/80 hover:text-amber-200 transition-colors ml-0.5 cursor-pointer"
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

      {/* Add Staff Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#111b21] border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600/30 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>Add Team Member</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Create a new team member to manage leads
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Full Name</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Sarah Perera / Mohamed Rizwan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-emerald-500 placeholder:text-slate-500 transition-colors shadow-inner"
                />
              </div>

              {/* Two Column Grid: Role & Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Role Level */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    <span>Role</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={selectedRoleChoice}
                    onChange={(e) => handleRoleChange(e.target.value as StaffRoleChoice)}
                    className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-emerald-500 cursor-pointer font-medium"
                  >
                    <option value="coordinator_rwc" className="bg-[#111b21] text-white">
                      Coordinator (RWC)
                    </option>
                    <option value="coordinator_cras" className="bg-[#111b21] text-white">
                      Coordinator (CRAS)
                    </option>
                    <option value="leads_officer" className="bg-[#111b21] text-white">
                      Leads Officers
                    </option>
                  </select>
                </div>

                {/* Company */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Company</span>
                    {selectedRoleChoice !== 'leads_officer' && <span className="text-rose-400">*</span>}
                  </label>
                  {selectedRoleChoice === 'leads_officer' ? (
                    <div className="w-full bg-[#202c33]/70 border border-indigo-500/30 rounded-xl px-3.5 py-2 text-xs flex items-center justify-between text-slate-200">
                      <span className="text-indigo-300 font-bold flex items-center gap-1.5 text-xs">
                        <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>All Companies (Common)</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Receives all leads</span>
                    </div>
                  ) : (
                    <div className="w-full bg-[#202c33]/70 border border-slate-700/80 rounded-xl px-3 py-2 text-xs flex items-center justify-between text-slate-200">
                      <CompanyTagBadge company={company} size="sm" showFullName={true} />
                      <span className="text-[10px] text-slate-400 italic">Auto-assigned</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Branch Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Branch Location</span>
                  <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BRANCH_OPTIONS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBranch(b)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
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

              {/* PIN Number & Web Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>PIN Number</span>
                      <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleRegeneratePin}
                      className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
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
                      placeholder="7341"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full bg-[#202c33] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 tracking-widest outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={handleRegeneratePin}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                      title="Regenerate PIN"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Web Password</span>
                  </label>
                  <input
                    type="text"
                    placeholder="staff"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!fullName.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Create Team Member</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Member Modal (Name & Branch only - Syncs to Supabase) */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#111b21] border border-slate-700/80 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600/30 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>Edit Staff Details</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Update name and branch in Supabase
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingStaff(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Read-only Role & ID notice */}
            <div className="bg-[#202c33]/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px]">Role:</span>
                <span className="font-semibold text-slate-200">
                  {editingStaff.role === 'leads_officer' 
                    ? 'Leads Officer' 
                    : `Coordinator (${editingStaff.company || 'RWC'})`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Supabase Live Sync</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Full Name</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rinosa"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Branch Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Branch Location</span>
                  <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {BRANCH_OPTIONS.map((br) => (
                    <button
                      key={br}
                      type="button"
                      onClick={() => setEditBranch(br)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                        editBranch === br
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50 shadow-sm'
                          : 'bg-[#202c33]/50 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {br}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Or enter custom branch name"
                  value={editBranch}
                  onChange={(e) => setEditBranch(e.target.value)}
                  className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editFullName.trim() || isSubmittingEdit}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmittingEdit ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
