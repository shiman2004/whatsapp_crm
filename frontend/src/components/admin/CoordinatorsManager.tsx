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

type StaffRoleChoice = 'leads_officer' | 'coordinator_cras' | 'coordinator_rwc' | 'coordinator_ahc' | 'exam_department_manager' | 'exam_providing_officer' | 'clinical_nurse' | 'clinical_doctor' | 'report_analyst' | 'marketing_officer_rwc' | 'marketing_officer_cras' | 'marketing_admin_rwc' | 'marketing_admin_cras';
type StaffFilter = 'all' | 'leads_officer' | 'coordinator_rwc' | 'coordinator_cras' | 'coordinator_ahc';

const generateRandomPin = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

export const CoordinatorsManager: React.FC = () => {
  const { currentUser, users, leads, addCoordinator, updateCoordinator, deleteCoordinator } = useCrm();
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StaffFilter>('all');

  // Edit Staff State (Name, Branch, PIN & Password)
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editBranch, setEditBranch] = useState('Colombo');
  const [editPin, setEditPin] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Form State
  const [selectedRoleChoice, setSelectedRoleChoice] = useState<StaffRoleChoice>('coordinator_rwc');
  const [company, setCompany] = useState<CompanyCode>('RWC');
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('Colombo');
  const [pin, setPin] = useState(generateRandomPin());
  const [password, setPassword] = useState('staff');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  const staffMembers = users.filter(u => ['coordinator', 'leads_officer', 'exam_department_manager', 'exam_coordinator', 'exam_providing_officer', 'clinical_nurse', 'clinical_doctor', 'report_analyst', 'marketing_officer', 'marketing_admin'].includes(u.role));
  const leadsOfficers = users.filter(u => u.role === 'leads_officer');
  const rwcCoordinators = users.filter(u => u.role === 'coordinator' && (u.company === 'RWC' || !u.company));
  const crasCoordinators = users.filter(u => u.role === 'coordinator' && u.company === 'CRAS');
  const ahcCoordinators = users.filter(u => u.role === 'coordinator' && u.company === 'AHC');

  const filteredStaff = staffMembers.filter(u => {
    if (activeFilter === 'leads_officer') return u.role === 'leads_officer';
    if (activeFilter === 'coordinator_rwc') return u.role === 'coordinator' && (u.company === 'RWC' || !u.company);
    if (activeFilter === 'coordinator_cras') return u.role === 'coordinator' && u.company === 'CRAS';
    if (activeFilter === 'coordinator_ahc') return u.role === 'coordinator' && u.company === 'AHC';
    return true;
  });

  const canViewPins = currentUser?.role === 'super_admin';
  const isStoredPinHash = (value?: string) => Boolean(value && (/^scrypt:/i.test(value) || /^\$2[aby]?\$/i.test(value)));

  const handleRoleChange = (choice: StaffRoleChoice) => {
    setSelectedRoleChoice(choice);
    if (choice === 'coordinator_rwc') {
      setCompany('RWC');
    } else if (choice === 'coordinator_cras') {
      setCompany('CRAS');
    } else if (choice === 'coordinator_ahc') {
      setCompany('AHC');
    } else if (choice === 'exam_department_manager' || choice === 'exam_providing_officer' || choice === 'clinical_nurse' || choice === 'clinical_doctor' || choice === 'report_analyst') {
      setCompany('RWC');
    } else if (choice.endsWith('_cras')) {
      setCompany('CRAS');
    } else if (choice.startsWith('marketing_')) {
      setCompany('RWC');
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
    // Never copy a persisted PIN hash into an editable field. A new PIN is only
    // sent when the Super Admin explicitly enters one.
    setEditPin('');
    setEditPassword(staff.password || '');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !editFullName.trim()) return;

    setIsSubmittingEdit(true);
    try {
      await updateCoordinator(editingStaff.id, {
        fullName: editFullName.trim(),
        branch: editBranch.trim() || 'Colombo',
        pin: editPin.trim() || undefined,
        password: editPassword.trim() || undefined
      });
      setEditingStaff(null);
    } catch (err) {
      console.error('Failed to update staff member:', err);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || isSubmittingAdd) return;

    let systemRole: UserRole = 'coordinator';
    let assignedCompany: CompanyCode | undefined = undefined;

    if (selectedRoleChoice === 'leads_officer') {
      systemRole = 'leads_officer';
      assignedCompany = undefined; // Common role for all leads across both companies
    } else if (['exam_department_manager', 'exam_providing_officer', 'clinical_nurse', 'clinical_doctor', 'report_analyst'].includes(selectedRoleChoice)) {
      systemRole = selectedRoleChoice as UserRole;
      assignedCompany = undefined;
    } else if (selectedRoleChoice.startsWith('marketing_officer')) {
      systemRole = 'marketing_officer';
      assignedCompany = selectedRoleChoice.endsWith('_cras') ? 'CRAS' : 'RWC';
    } else if (selectedRoleChoice.startsWith('marketing_admin')) {
      systemRole = 'marketing_admin';
      assignedCompany = selectedRoleChoice.endsWith('_cras') ? 'CRAS' : 'RWC';
    } else if (selectedRoleChoice === 'coordinator_cras') {
      systemRole = 'coordinator';
      assignedCompany = 'CRAS';
    } else if (selectedRoleChoice === 'coordinator_ahc') {
      systemRole = 'coordinator';
      assignedCompany = 'AHC';
    } else {
      systemRole = 'coordinator';
      assignedCompany = 'RWC';
    }

    setIsSubmittingAdd(true);
    try {
      await addCoordinator({
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
    } catch (err) {
      console.error('Failed to register staff:', err);
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-serif">Staff & Team Management</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage AHC/CRAS coordinators, exam staff, clinical staff, and marketing roles, assign branch locations, and generate access PINs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenModal}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Staffs</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Counts */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            All Staff ({staffMembers.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('leads_officer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'leads_officer'
                ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Leads Officers ({leadsOfficers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('coordinator_rwc')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'coordinator_rwc'
                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#008000]" />
            <span>Patient Coordinators RWC ({rwcCoordinators.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('coordinator_cras')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'coordinator_cras'
                ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#800000]" />
            <span>Education Counsellors CRAS ({crasCoordinators.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('coordinator_ahc')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'coordinator_ahc'
                ? 'bg-teal-50 dark:bg-[#066e77]/20 text-[#066e77] dark:text-teal-300 border border-teal-200 dark:border-[#066e77]/40 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#066e77]" />
            <span>Consultancy Advisors AHC ({ahcCoordinators.length})</span>
          </button>
        </div>
      </div>

      {filteredStaff.length === 0 ? (
        <div className="bg-white dark:bg-[#111b21] border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Staff Members Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
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
            const isExamStaff = ['exam_department_manager', 'exam_coordinator', 'exam_providing_officer'].includes(staff.role);
            const isCras = staff.company === 'CRAS';
            const activeLeads = leads.filter(l => l.assignedTo === staff.id && l.stage !== 'converted' && l.stage !== 'lost');
            const convertedLeads = leads.filter(l => l.assignedTo === staff.id && l.stage === 'converted');
            const rawPin = typeof staff.pin === 'string' ? staff.pin.trim() : '';
            const canRevealStoredPin = canViewPins && Boolean(rawPin) && !isStoredPinHash(rawPin);

            const roleDisplay = isExamStaff
              ? (staff.role === 'exam_department_manager' ? 'Head of Exam Department' : 'Exam Providing Officer')
              : staff.role === 'marketing_admin' ? 'Marketing Administrator'
              : staff.role === 'marketing_officer' ? 'Marketing Officer'
              : isOfficer
              ? 'Leads Officer' 
              : staff.company === 'AHC'
              ? 'Consultancy Advisor'
              : isCras 
              ? 'Education Counsellor' 
              : 'Patient Coordinator';

            return (
              <div
                key={staff.id}
                className="bg-white dark:bg-[#111b21] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Header with avatar & role badge */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl font-bold text-base flex items-center justify-center border ${
                        isOfficer
                          ? 'bg-indigo-50 dark:bg-indigo-700/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30'
                          : isCras
                          ? 'bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700/40'
                          : 'bg-emerald-50 dark:bg-emerald-700/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                      }`}>
                        {staff.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{staff.fullName}</span>
                          {!isOfficer && <CompanyTagBadge company={staff.company || 'RWC'} size="xs" />}
                        </h4>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          <span>{staff.branch || 'Colombo Branch'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleOpenEditModal(staff)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
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
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Remove Staff Member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Role & Branch & Login PIN */}
                  <div className="bg-slate-50 dark:bg-[#202c33]/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Role:</span>
                      <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] flex items-center gap-1 border ${
                        isOfficer
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/40'
                          : isCras
                          ? 'bg-rose-50 dark:bg-[#800000]/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-[#800000]/60'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40'
                      }`}>
                        {isOfficer ? (
                          <ShieldCheck className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <Building2 className={`w-3 h-3 ${isCras ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                        )}
                        {roleDisplay}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Company:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                        {isOfficer ? (
                          <span className="text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Common (All Leads)
                          </span>
                        ) : (
                          <CompanyTagBadge company={staff.company || 'RWC'} size="xs" showFullName={true} />
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Branch Location:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        {staff.branch || 'Colombo'}
                      </span>
                    </div>

                    <div className="pt-1 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <KeyRound className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Quick PIN:
                      </span>
                      <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/30 px-2 py-0.5 rounded-md">
                        <span>{canRevealStoredPin ? rawPin : (staff.pinConfigured ?? Boolean(rawPin)) ? 'Configured (reset required)' : 'Not configured'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Workload and Conversion Stats */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 dark:bg-[#202c33]/40 p-2 rounded-lg border border-slate-200 dark:border-slate-800/80">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                      {isOfficer ? 'Managed Leads' : 'Assigned Leads'}
                    </span>
                    <span className="text-base font-black font-mono text-slate-900 dark:text-slate-100">{activeLeads.length} active</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#202c33]/40 p-2 rounded-lg border border-slate-200 dark:border-slate-800/80">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                      {isOfficer ? 'Triage / Converted' : 'Closed / Won'}
                    </span>
                    <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">{convertedLeads.length} won</span>
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
          <div className="bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700/80 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Add Team Member</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Create a new team member to manage leads
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Full Name</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Sarah Perera / Mohamed Rizwan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 placeholder:text-slate-400 transition-colors"
                />
              </div>

              {/* Two Column Grid: Role & Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Role Level */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    <span>Role</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedRoleChoice}
                    onChange={(e) => handleRoleChange(e.target.value as StaffRoleChoice)}
                    className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 cursor-pointer font-medium"
                  >
                    <option value="coordinator_rwc">
                      Patient Coordinator RWC
                    </option>
                    <option value="coordinator_cras">
                      Education Counsellor CRAS
                    </option>
                    <option value="coordinator_ahc">
                      Consultancy Advisor AHC
                    </option>
                    <option value="leads_officer">
                      Leads Officer (Common)
                    </option>
                    <option value="exam_department_manager">
                      Head of Exam Department
                    </option>
                    <option value="exam_providing_officer">
                      Exam Providing Officer
                    </option>
                    <option value="clinical_nurse">Clinical Nurse</option>
                    <option value="clinical_doctor">Clinical Doctor</option>
                    <option value="report_analyst">Report Analyst</option>
                    <option value="marketing_officer_rwc">Marketing Officer — AHC</option>
                    <option value="marketing_officer_cras">Marketing Officer — CRAS</option>
                    <option value="marketing_admin_rwc">Marketing Administrator — AHC</option>
                    <option value="marketing_admin_cras">Marketing Administrator — CRAS</option>
                  </select>
                </div>

                {/* Company */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Company</span>
                    {!['leads_officer', 'exam_department_manager', 'exam_providing_officer', 'clinical_nurse', 'clinical_doctor', 'report_analyst'].includes(selectedRoleChoice) && <span className="text-rose-500">*</span>}
                  </label>
                  {['leads_officer', 'exam_department_manager', 'exam_providing_officer', 'clinical_nurse', 'clinical_doctor', 'report_analyst'].includes(selectedRoleChoice) ? (
                    <div className="w-full bg-slate-50 dark:bg-[#202c33]/70 border border-indigo-500/30 rounded-xl px-3.5 py-2 text-xs flex items-center justify-between text-slate-800 dark:text-slate-200">
                      <span className="text-indigo-700 dark:text-indigo-300 font-bold flex items-center gap-1.5 text-xs">
                        <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>All Companies (Common)</span>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Receives all leads</span>
                    </div>
                  ) : (
                    <div className="w-full bg-slate-50 dark:bg-[#202c33]/70 border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs flex items-center justify-between text-slate-800 dark:text-slate-200">
                      <CompanyTagBadge company={company} size="sm" showFullName={true} />
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 italic">Auto-assigned</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Branch Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Branch Location</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BRANCH_OPTIONS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBranch(b)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        branch === b
                          ? 'bg-emerald-50 dark:bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border-emerald-500 shadow-sm'
                          : 'bg-slate-50 dark:bg-[#202c33] text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
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
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>PIN Number</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleRegeneratePin}
                      className="text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
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
                      className="w-full bg-slate-50 dark:bg-[#202c33] border border-amber-400/60 dark:border-amber-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-300 tracking-widest outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleRegeneratePin}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                      title="Regenerate PIN"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Web Password</span>
                  </label>
                  <input
                    type="text"
                    placeholder="staff"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!fullName.trim() || isSubmittingAdd}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmittingAdd ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Saving to Supabase...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Team Member</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Member Modal (Name & Branch only - Syncs to Supabase) */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700/80 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Edit Staff Details</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Update name and branch in Supabase
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingStaff(null)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Read-only Role & ID notice */}
            <div className="bg-slate-50 dark:bg-[#202c33]/70 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Role:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {editingStaff.role === 'exam_department_manager'
                    ? 'Head of Exam Department'
                    : ['exam_coordinator', 'exam_providing_officer'].includes(editingStaff.role)
                    ? 'Exam Providing Officer'
                    : editingStaff.role === 'clinical_nurse' ? 'Clinical Nurse'
                    : editingStaff.role === 'clinical_doctor' ? 'Clinical Doctor'
                    : editingStaff.role === 'report_analyst' ? 'Report Analyst'
                    : editingStaff.role === 'marketing_admin' ? 'Marketing Administrator'
                    : editingStaff.role === 'marketing_officer' ? 'Marketing Officer'
                    : editingStaff.role === 'leads_officer'
                    ? 'Leads Officer' 
                    : (editingStaff.company === 'AHC' ? 'Consultancy Advisor' : editingStaff.company === 'CRAS' ? 'Education Counsellor' : 'Patient Coordinator')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Supabase Live Sync</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Full Name</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rinosa"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Branch Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Branch Location</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {BRANCH_OPTIONS.map((br) => (
                    <button
                      key={br}
                      type="button"
                      onClick={() => setEditBranch(br)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                        editBranch === br
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-500/50 shadow-sm'
                          : 'bg-slate-50 dark:bg-[#202c33]/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
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
                  className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* PIN Number & Web Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Security PIN (4-Digits)</span>
                      <span className="text-slate-400 font-normal">(optional reset)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditPin(generateRandomPin())}
                      className="text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                      title="Generate new random 4-digit PIN"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Auto-Gen</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 5839"
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono font-bold tracking-wider text-amber-800 dark:text-amber-400 outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Web Password</span>
                  </label>
                  <input
                    type="text"
                    placeholder="New password (optional)"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editFullName.trim() || isSubmittingEdit}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
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
