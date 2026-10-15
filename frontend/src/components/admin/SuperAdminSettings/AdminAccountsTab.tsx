import React, { useState } from 'react';
import { useCrm } from '../../../context/CrmContext';
import { User } from '../../../types';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Pencil,
  Power,
  Lock,
  CheckCircle2,
  AlertTriangle,
  X,
  Mail,
  KeyRound,
  ShieldAlert,
  UserCheck
} from 'lucide-react';

export const AdminAccountsTab: React.FC = () => {
  const { superAdmins, createSuperAdmin, updateSuperAdmin, currentUser } = useCrm();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [createError, setCreateError] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Edit Name Modal State
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editError, setEditError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Toggle Confirm Modal State
  const [togglingAdmin, setTogglingAdmin] = useState<User | null>(null);
  const [toggleError, setToggleError] = useState('');
  const [isSubmittingToggle, setIsSubmittingToggle] = useState(false);

  const activeAdmins = superAdmins.filter((u) => u.active !== false);
  const totalCount = superAdmins.length;
  const activeCount = activeAdmins.length;
  const inactiveCount = totalCount - activeCount;

  // Last Active Super Admin Lockout Guard
  const isLastActiveAdmin = (admin: User) => {
    return admin.active !== false && activeCount <= 1;
  };

  const filteredAdmins = superAdmins.filter((u) => {
    if (statusFilter === 'active' && u.active === false) return false;
    if (statusFilter === 'inactive' && u.active !== false) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = u.fullName.toLowerCase().includes(q);
      const matchEmail = u.email ? u.email.toLowerCase().includes(q) : false;
      if (!matchName && !matchEmail) return false;
    }
    return true;
  });

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setPin('');
    setCreateError('');
    setShowCreateModal(true);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanPin = pin.trim();

    if (!cleanName) {
      setCreateError('Full Name is required.');
      return;
    }
    if (!cleanEmail) {
      setCreateError('Email address is required.');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 4) {
      setCreateError('Password must be at least 4 characters.');
      return;
    }
    if (!cleanPin || cleanPin.length < 4) {
      setCreateError('Security PIN must be 4 digits.');
      return;
    }

    // Duplicate email check locally
    const duplicate = superAdmins.find(
      (u) => u.email && u.email.toLowerCase() === cleanEmail
    );
    if (duplicate) {
      setCreateError(`A Super Admin account with email "${cleanEmail}" already exists.`);
      return;
    }

    setIsSubmittingCreate(true);
    const res = await createSuperAdmin({
      fullName: cleanName,
      email: cleanEmail,
      password: cleanPassword,
      pin: cleanPin,
    });

    setIsSubmittingCreate(false);
    if (!res.success) {
      setCreateError(res.error || 'Failed to create Super Admin account');
    } else {
      setShowCreateModal(false);
    }
  };

  // Open Edit Name Modal
  const handleOpenEditModal = (admin: User) => {
    setEditingAdmin(admin);
    setEditFullName(admin.fullName);
    setEditError('');
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setEditError('');

    const cleanName = editFullName.trim();
    if (!cleanName) {
      setEditError('Full Name is required.');
      return;
    }

    setIsSubmittingEdit(true);
    const res = await updateSuperAdmin(editingAdmin.id, {
      fullName: cleanName,
    });

    setIsSubmittingEdit(false);
    if (!res.success) {
      setEditError(res.error || 'Failed to update account name');
    } else {
      setEditingAdmin(null);
    }
  };

  // Handle Toggle Status
  const handleConfirmToggle = async () => {
    if (!togglingAdmin) return;
    setToggleError('');

    const isCurrentlyActive = togglingAdmin.active !== false;

    // Last Active Admin Lockout Guard
    if (isCurrentlyActive && activeCount <= 1) {
      setToggleError('Security Lockout Guard: Cannot deactivate the last active Super Admin account.');
      return;
    }

    setIsSubmittingToggle(true);
    const res = await updateSuperAdmin(togglingAdmin.id, {
      active: !isCurrentlyActive,
    });

    setIsSubmittingToggle(false);
    if (!res.success) {
      setToggleError(res.error || 'Failed to update account status');
    } else {
      setTogglingAdmin(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Super Admins</p>
            <p className="text-2xl font-bold text-slate-100 font-mono mt-0.5">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Accounts</p>
            <p className="text-2xl font-bold text-emerald-400 font-mono mt-0.5">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Deactivated</p>
            <p className="text-2xl font-bold text-slate-400 font-mono mt-0.5">{inactiveCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <Power className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Lockout Warning Banner if only 1 active admin exists */}
      {activeCount <= 1 && (
        <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-600/40 flex items-center gap-3 text-xs text-amber-200 shadow-lg">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <span className="font-bold text-amber-300">Single Active Super Admin Warning: </span>
            There is currently only 1 active Super Admin account. Deactivation of this account is strictly blocked by the system lockout guard to guarantee administrative CRM access.
          </div>
        </div>
      )}

      {/* Control Bar: Search & Create Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by full name or email..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-slate-700 text-slate-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Inactive ({inactiveCount})
            </button>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-purple-950/40 transition-all shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create Super Admin</span>
        </button>
      </div>

      {/* Super Admin Accounts Table */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">Super Admin</th>
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-4">Role & Scope</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    No Super Admin accounts found matching your query.
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((admin) => {
                  const isActive = admin.active !== false;
                  const isCurrent = admin.id === currentUser?.id;
                  const isLastActive = isLastActiveAdmin(admin);

                  return (
                    <tr
                      key={admin.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Name & Badge */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold text-xs uppercase shrink-0">
                            {admin.fullName.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-100 text-sm">{admin.fullName}</p>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                  YOU
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono">ID: {admin.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <span>{admin.email}</span>
                        </div>
                      </td>

                      {/* Role & Scope */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          Full CRM Access (RWC + CRAS)
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'System Origin'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5"></span>
                            Deactivated
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(admin)}
                            title="Edit Account Name"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {isLastActive ? (
                            <div
                              title="Lockout Guard: Cannot deactivate the last active Super Admin account."
                              className="p-1.5 bg-slate-900/80 text-slate-600 rounded-lg border border-slate-800 cursor-not-allowed"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setTogglingAdmin(admin);
                                setToggleError('');
                              }}
                              title={isActive ? 'Deactivate Account' : 'Activate Account'}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                isActive
                                  ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border-rose-800/60'
                                  : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border-emerald-800/60'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Policies Card */}
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-3 text-xs text-slate-400">
        <Lock className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">Zero-Trust RBAC & Secret Security: </span>
          Super Admin accounts cannot be created via public sign-up or unauthenticated requests.
          Passwords and PINs are stored securely in Supabase and are never exposed in frontend payloads or API query results.
        </div>
      </div>

      {/* Modal: Create Super Admin */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Create Super Admin</h3>
                <p className="text-xs text-slate-400">Add an authorized executive administrator</p>
              </div>
            </div>

            {createError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Jahan"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address <span className="text-purple-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. jahan@royalwellness.lk"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Password <span className="text-purple-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 4 characters"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Security PIN (4 digits) <span className="text-purple-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 1234"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  Super Admins receive full cross-company oversight over both Royal Wellness Center (RWC) and CRAS Academy.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-950/50 transition-colors disabled:opacity-50"
                >
                  {isSubmittingCreate ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Super Admin Name */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setEditingAdmin(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Edit Account Name</h3>
                <p className="text-xs text-slate-400 font-mono">{editingAdmin.email}</p>
              </div>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateName} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-950/50 transition-colors disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Activate / Deactivate */}
      {togglingAdmin && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  togglingAdmin.active !== false
                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                }`}
              >
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {togglingAdmin.active !== false ? 'Deactivate Super Admin' : 'Activate Super Admin'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to{' '}
                  {togglingAdmin.active !== false ? 'deactivate' : 'activate'}{' '}
                  <span className="font-semibold text-slate-200">"{togglingAdmin.fullName}"</span>?
                </p>
              </div>
            </div>

            {toggleError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{toggleError}</span>
              </div>
            )}

            <p className="text-xs text-slate-400 mb-6 bg-slate-950 p-3 rounded-xl border border-slate-800">
              {togglingAdmin.active !== false
                ? 'Deactivating will revoke this user’s ability to log in or modify CRM settings immediately.'
                : 'Activating will re-enable login and full Super Admin permissions.'}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTogglingAdmin(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingToggle}
                onClick={handleConfirmToggle}
                className={`px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-colors disabled:opacity-50 ${
                  togglingAdmin.active !== false
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                }`}
              >
                {isSubmittingToggle
                  ? 'Updating...'
                  : togglingAdmin.active !== false
                  ? 'Confirm Deactivation'
                  : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
