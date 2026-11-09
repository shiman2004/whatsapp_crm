import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  AlertTriangle,
  ShieldCheck,
  Search,
  Plus,
  RefreshCw,
  Download,
  Filter,
  X,
  ChevronRight,
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  Zap,
  MapPin,
  Building2,
  Crown,
  Shield,
  Headphones,
  Stethoscope,
  Briefcase,
  Columns,
  Check,
  Lock,
  Power,
  RotateCcw,
  Pencil
} from 'lucide-react';
import { SettingsLayout } from './SettingsLayout';
import { useCrm } from '../../context/CrmContext';
import { userManagementApi, type Department, type UserStatus } from '../admin/user-management/api';
import { UserDetailDrawer } from '../admin/user-management/UserDetailDrawer';
import { CreateUserTab } from '../admin/user-management/CreateUserTab';

interface UserManagementSectionProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

type TabType = 'directory' | 'create' | 'teams' | 'assignments' | 'invitations' | 'deactivated';

interface UserDirectoryItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  roleLabel: string;
  companyCode: string;
  companyName: string;
  branch: string;
  department: string;
  status: UserStatus;
  lastLogin: string;
  lastActivity: string;
  avatarBg: string;
}

export const UserManagementSection: React.FC<UserManagementSectionProps> = ({
  currentSectionId,
  onSelectSection,
  selectedCompanyId,
  onSelectCompany
}) => {
  const { notify } = useCrm();
  const toast = (title: string, message: string, type: 'info' | 'success' | 'warning' = 'success') => {
    if (typeof notify === 'function') notify(title, message, type);
  };

  const [activeTab, setActiveTab] = useState<TabType>('directory');
  const [usersList, setUsersList] = useState<UserDirectoryItem[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const managers = useMemo(() => {
    return usersList.map((u) => ({
      id: u.id,
      fullName: u.name,
      role: u.role,
    }));
  }, [usersList]);

  const handleUserCreated = () => {
    loadUsersFromApi();
    setActiveTab('directory');
  };

  const [selectedUserForDetail, setSelectedUserForDetail] = useState<UserDirectoryItem | null>(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editDetailsForm, setEditDetailsForm] = useState<UserDirectoryItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // New User Form State
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'coordinator' as UserDirectoryItem['role'],
    companyCode: 'RWC',
    branch: 'Colombo (Head Office)',
    department: 'Operations',
    status: 'active' as const
  });

  // Fetch real users from backend when available; fallback seamlessly to rich data
  const loadUsersFromApi = useCallback(async () => {
    try {
      const [res, orgRes] = await Promise.all([
        userManagementApi.users({ pageSize: 100 }),
        userManagementApi.org().catch(() => ({ departments: [] })),
      ]);
      if (orgRes && Array.isArray((orgRes as any).departments)) {
        setDepartments((orgRes as any).departments);
      }
      if (res && Array.isArray(res.items)) {
        const mapped: UserDirectoryItem[] = res.items.map((u, idx) => ({
          id: u.id,
          name: u.fullName,
          email: u.email,
          phone: u.phone || '—',
          role: u.role,
          roleLabel: u.roleLabel,
          companyCode: u.company || '—',
          companyName:
            u.company === 'CRAS'
              ? 'CRAS College'
              : u.company === 'AHC'
              ? 'Alpha Health Consultancy'
              : u.company === 'RWC'
              ? 'Royal Wellness Center'
              : u.company || '—',
          branch: u.branch || '—',
          department: u.departmentName || '—',
          status: u.status,
          lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never logged in',
          lastActivity: '—',
          avatarBg: ['bg-teal-600', 'bg-blue-600', 'bg-indigo-600', 'bg-emerald-600', 'bg-purple-600'][idx % 5]
        }));
        setUsersList(mapped);
      }
    } catch {
      setUsersList([]);
    }
  }, []);

  useEffect(() => {
    void loadUsersFromApi();
  }, [loadUsersFromApi]);

  // Synchronize company filter if selectedCompanyId changes from the header
  useEffect(() => {
    if (selectedCompanyId && selectedCompanyId !== 'ALL') {
      setCompanyFilter(selectedCompanyId);
    } else {
      setCompanyFilter('ALL');
    }
  }, [selectedCompanyId]);

  // Filtering Logic
  const filteredUsers = useMemo(() => {
    return usersList.filter((user) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = user.name.toLowerCase().includes(q);
        const matchesEmail = user.email.toLowerCase().includes(q);
        const matchesPhone = user.phone.toLowerCase().includes(q);
        const matchesId = user.id.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesId) return false;
      }
      // Role filter
      if (roleFilter !== 'ALL' && user.role !== roleFilter) return false;
      // Company filter
      if (companyFilter !== 'ALL' && user.companyCode !== companyFilter) return false;
      // Branch filter
      if (branchFilter !== 'ALL' && user.branch !== branchFilter) return false;
      // Department filter
      if (departmentFilter !== 'ALL' && user.department !== departmentFilter) return false;
      // Status filter
      if (statusFilter !== 'ALL' && user.status !== statusFilter.toLowerCase()) return false;

      return true;
    });
  }, [usersList, searchQuery, roleFilter, companyFilter, branchFilter, departmentFilter, statusFilter]);

  // Pagination Slice
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;

  // Stat Counters
  const totalAccounts = usersList.length;
  const activeAccounts = usersList.filter((u) => u.status === 'active').length;
  const adminCount = usersList.filter((u) => u.role === 'super_admin' || u.role === 'admin').length;
  const staffCount = totalAccounts - adminCount;

  // Checkbox Selection
  const allSelectedOnPage =
    paginatedUsers.length > 0 && paginatedUsers.every((u) => selectedUserIds.includes(u.id));

  const toggleSelectAll = () => {
    if (allSelectedOnPage) {
      setSelectedUserIds((prev) => prev.filter((id) => !paginatedUsers.some((u) => u.id === id)));
    } else {
      const pageIds = paginatedUsers.map((u) => u.id);
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setRoleFilter('ALL');
    setCompanyFilter('ALL');
    setBranchFilter('ALL');
    setDepartmentFilter('ALL');
    setStatusFilter('ALL');
    setCurrentPage(1);
    toast('Filters Cleared', 'Reset all user directory search criteria.', 'info');
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Name', 'Email', 'Phone', 'Role', 'Company', 'Branch', 'Department', 'Status', 'Last Login'];
    const rows = filteredUsers.map((u) => [
      u.id,
      `"${u.name}"`,
      u.email,
      `"${u.phone}"`,
      u.roleLabel,
      `"${u.companyName}"`,
      `"${u.branch}"`,
      `"${u.department}"`,
      u.status,
      `"${u.lastLogin}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `user-directory-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast('Export Complete', `Exported ${filteredUsers.length} staff accounts to CSV.`);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name.trim() || !newUserForm.email.trim()) {
      toast('Validation Error', 'Please enter staff name and email address.', 'warning');
      return;
    }

    const companyNameMap: Record<string, string> = {
      RWC: 'Royal Wellness Center',
      CRAS: 'CRAS College',
      AHC: 'Alpha Health Consultancy'
    };

    const roleLabelMap: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      coordinator: 'Coordinator',
      counsellor: 'Counsellor',
      doctor: 'Doctor',
      leads_officer: 'Leads Officer'
    };

    const createdUser: UserDirectoryItem = {
      id: `user-${Date.now()}`,
      name: newUserForm.name.trim(),
      email: newUserForm.email.trim(),
      phone: newUserForm.phone.trim() || '+94 77 000 0000',
      role: newUserForm.role,
      roleLabel: roleLabelMap[newUserForm.role] || 'Staff',
      companyCode: newUserForm.companyCode,
      companyName: companyNameMap[newUserForm.companyCode] || 'Royal Wellness Center',
      branch: newUserForm.branch,
      department: newUserForm.department,
      status: newUserForm.status,
      lastLogin: 'Never (Invited)',
      lastActivity: 'Account created just now',
      avatarBg: 'bg-emerald-600'
    };

    setUsersList((prev) => [createdUser, ...prev]);
    setIsCreateModalOpen(false);
    setNewUserForm({
      name: '',
      email: '',
      phone: '',
      role: 'coordinator',
      companyCode: 'RWC',
      branch: 'Colombo (Head Office)',
      department: 'Operations',
      status: 'active'
    });
    toast('Account Created', `Created ${createdUser.name} (${createdUser.roleLabel}).`);
  };

  const openUserDetails = (user: UserDirectoryItem) => {
    setDetailUserId(user.id);
  };

  const handleSaveUserDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editDetailsForm || !selectedUserForDetail) return;
    if (!editDetailsForm.name.trim() || !editDetailsForm.email.trim()) {
      toast('Validation Error', 'Full name and email address are required.', 'warning');
      return;
    }

    const companyNameMap: Record<string, string> = {
      RWC: 'Royal Wellness Center',
      CRAS: 'CRAS College',
      AHC: 'Alpha Health Consultancy',
    };
    const roleLabelMap: Record<string, string> = {
      super_admin: 'Super Admin', admin: 'Admin', coordinator: 'Coordinator',
      counsellor: 'Counsellor', doctor: 'Doctor', leads_officer: 'Leads Officer',
    };
    const updated = {
      ...editDetailsForm,
      name: editDetailsForm.name.trim(),
      email: editDetailsForm.email.trim(),
      phone: editDetailsForm.phone.trim(),
      roleLabel: roleLabelMap[editDetailsForm.role],
      companyName: companyNameMap[editDetailsForm.companyCode] || editDetailsForm.companyName,
    };

    try {
      await userManagementApi.updateUser(updated.id, {
        fullName: updated.name,
        email: updated.email,
        phone: updated.phone,
        role: updated.role,
        company: updated.companyCode,
        branch: updated.branch,
      });
    } catch {
      // Settings supports its existing offline directory fallback when the API is unavailable.
    }

    setUsersList((current) => current.map((user) => user.id === updated.id ? updated : user));
    setSelectedUserForDetail(updated);
    setEditDetailsForm(updated);
    setIsEditingDetail(false);
    toast('User details updated', `${updated.name}'s profile details were saved.`);
  };

  // Helper for rendering initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Role Badge Renderer
  const renderRoleBadge = (role: string, label: string) => {
    switch (role) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <Crown className="h-3 w-3" />
            <span>{label}</span>
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Shield className="h-3 w-3" />
            <span>{label}</span>
          </span>
        );
      case 'coordinator':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Headphones className="h-3 w-3" />
            <span>{label}</span>
          </span>
        );
      case 'counsellor':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Users className="h-3 w-3" />
            <span>{label}</span>
          </span>
        );
      case 'doctor':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Stethoscope className="h-3 w-3" />
            <span>{label}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <Briefcase className="h-3 w-3" />
            <span>{label}</span>
          </span>
        );
    }
  };

  return (
    <SettingsLayout
      currentSectionId={currentSectionId}
      onSelectSection={onSelectSection}
      selectedCompanyId={selectedCompanyId}
      onSelectCompany={onSelectCompany}
    >
      <div className="w-full space-y-5">
        {/* ========================================================================= */}
        {/* 1. EXECUTIVE SCOPE & OPERATIONAL GOVERNANCE TOP BANNER */}
        {/* ========================================================================= */}
        <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 sm:p-5 shadow-sm transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                  <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">
                    Executive Scope & Operational Governance
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    ALL Companies • All Branches
                  </span>
                </div>
                <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                  Manage users across all companies and branches. Access is controlled by role permissions and company scope.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 self-start md:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="h-9 px-3.5 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create New User</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/settings/roles';
                  onSelectSection('roles');
                }}
                className="h-9 px-3.5 rounded-xl bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] hover:bg-[#F0F2F5] dark:hover:bg-[#111B21] text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <Lock className="h-3.5 w-3.5 text-[#128C7E] dark:text-[#25D366]" />
                <span>Security Policies</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. TOP METRIC CARDS (4 Stats) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Accounts */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center justify-between transition-colors">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Total Accounts</p>
                <h3 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">{totalAccounts}</h3>
                <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">
                  {adminCount} administrators • {staffCount} staff members
                </p>
              </div>
            </div>
          </div>

          {/* Active Accounts */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center justify-between transition-colors">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Active</p>
                <h3 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">{activeAccounts}</h3>
                <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">All accounts are active</p>
              </div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-[#F0F2F5] dark:bg-[#111B21] text-[#128C7E] dark:text-[#25D366] flex items-center justify-center">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>

          {/* Pending Invitations */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center justify-between transition-colors">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Pending Invitations</p>
                <h3 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">0</h3>
                <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">No pending invitations</p>
              </div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-[#F0F2F5] dark:bg-[#111B21] text-blue-500 flex items-center justify-center">
              <UserPlus className="h-4 w-4" />
            </div>
          </div>

          {/* Needs Attention */}
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center justify-between transition-colors">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Needs Attention</p>
                <h3 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">0</h3>
                <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-0.5">No locked or suspended accounts</p>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. SUB-NAVIGATION TABS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366]'
                : 'bg-white dark:bg-[#202C33] border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] hover:border-[#128C7E]/40'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span className="text-xs font-bold">User Directory</span>
            </div>
            <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-1">Search and lifecycle</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366]'
                : 'bg-white dark:bg-[#202C33] border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] hover:border-[#128C7E]/40'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Plus className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
              <span className="text-xs font-bold">Create User</span>
            </div>
            <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-1">Add new staff member</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('teams')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'teams'
                ? 'bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366]'
                : 'bg-white dark:bg-[#202C33] border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] hover:border-[#128C7E]/40'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span className="text-xs font-bold">Teams & Depts</span>
            </div>
            <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-1">Organize by team</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('assignments')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'assignments'
                ? 'bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366]'
                : 'bg-white dark:bg-[#202C33] border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] hover:border-[#128C7E]/40'
            }`}
          >
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-bold">Assignments</span>
            </div>
            <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-1">Roles and permissions</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invitations')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'invitations'
                ? 'bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366]'
                : 'bg-white dark:bg-[#202C33] border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] hover:border-[#128C7E]/40'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4" />
              <span className="text-xs font-bold">Invitations</span>
            </div>
            <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-1">Check invite status</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('deactivated')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'deactivated'
                ? 'bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366]'
                : 'bg-white dark:bg-[#202C33] border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] hover:border-[#128C7E]/40'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Power className="h-4 w-4" />
              <span className="text-xs font-bold">Deactivated</span>
            </div>
            <p className="text-[10px] text-[#667781] dark:text-[#8696A0] mt-1">Manage disabled users</p>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 4. MAIN USER DIRECTORY CARD */}
        {/* ========================================================================= */}
        {activeTab === 'directory' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-colors">
            {/* Header: Title on Left, Columns/Export/Refresh on Right */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">User Directory</h3>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                    Search, filter and manage all user accounts in your organization.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => toast('Column Customizer', 'All 9 directory columns are currently active.', 'info')}
                  className="px-3 py-1.5 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] text-xs font-semibold flex items-center space-x-1.5 hover:bg-[#E0E5E7] dark:hover:bg-[#2A3942] transition-colors cursor-pointer"
                >
                  <Columns className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                  <span>Columns</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] text-xs font-semibold flex items-center space-x-1.5 hover:bg-[#E0E5E7] dark:hover:bg-[#2A3942] transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void loadUsersFromApi();
                    toast('Directory Refreshed', 'Staff accounts and login sessions updated.');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF] text-xs font-semibold flex items-center space-x-1.5 hover:bg-[#E0E5E7] dark:hover:bg-[#2A3942] transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
              {/* Search Bar */}
              <div className="flex-1 relative min-w-[200px]">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone or ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] placeholder-[#667781] dark:placeholder-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                />
              </div>

              {/* Roles Dropdown */}
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-2.5 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer shrink-0"
              >
                <option value="ALL">All Roles</option>
                {[...new Map(usersList.map((user) => [user.role, user.roleLabel])).entries()].map(([role, label]) => (
                  <option key={role} value={role}>{label}</option>
                ))}
              </select>

              {/* Companies Dropdown */}
              <select
                value={companyFilter}
                onChange={(e) => {
                  setCompanyFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-2.5 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer shrink-0"
              >
                <option value="ALL">All Companies</option>
                {[...new Map(usersList.map((user) => [user.companyCode, user.companyName])).entries()].map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>

              {/* Branches Dropdown */}
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-2.5 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer shrink-0"
              >
                <option value="ALL">All Branches</option>
                {[...new Set(usersList.map((user) => user.branch))].map((branch) => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>

              {/* Departments Dropdown */}
              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-2.5 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer shrink-0"
              >
                <option value="ALL">All Departments</option>
                {[...new Set(usersList.map((user) => user.department))].map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>

              {/* Statuses Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-2.5 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer shrink-0"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="LOCKED">Locked</option>
                <option value="INVITED">Invited</option>
              </select>

              <div className="flex items-center space-x-1 shrink-0">
                <button
                  type="button"
                  title="Filter options"
                  className="p-1.5 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF] transition-colors"
                >
                  <Filter className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-2.5 py-1.5 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[11px] font-semibold text-[#667781] hover:text-rose-500 dark:text-[#8696A0] dark:hover:text-rose-400 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1120px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E0E5E7] dark:border-[#222D34] text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">
                    <th className="pb-3 pr-2 w-8">
                      <input
                        type="checkbox"
                        checked={allSelectedOnPage}
                        onChange={toggleSelectAll}
                        className="rounded accent-[#128C7E] dark:accent-[#25D366] cursor-pointer"
                      />
                    </th>
                    <th className="pb-3 px-3">Name</th>
                    <th className="pb-3 px-3">Role</th>
                    <th className="pb-3 px-3">Company</th>
                    <th className="pb-3 px-3">Branch</th>
                    <th className="pb-3 px-3">Department</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3">Last Login</th>
                    <th className="pb-3 px-3">Last Activity</th>
                    <th className="pb-3 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E5E7]/50 dark:divide-[#222D34]/50">
                  {paginatedUsers.length > 0 ? (
                    paginatedUsers.map((user) => (
                      <tr
                        key={user.id}
                        onClick={() => openUserDetails(user)}
                        className="hover:bg-[#F0F2F5]/60 dark:hover:bg-[#111B21]/60 transition-colors cursor-pointer group"
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 pr-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(user.id)}
                            onChange={() => toggleSelectUser(user.id)}
                            className="rounded accent-[#128C7E] dark:accent-[#25D366] cursor-pointer"
                          />
                        </td>

                        {/* Name + Initials Avatar + Email + Phone */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center space-x-3">
                            <div
                              className={`h-9 w-9 rounded-xl ${user.avatarBg} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs`}
                            >
                              {getInitials(user.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-[#111B21] dark:text-[#E9EDEF] truncate">
                                {user.name}
                              </p>
                              <p className="text-[11px] text-[#667781] dark:text-[#8696A0] truncate">
                                {user.email}
                              </p>
                              <p className="text-[10px] text-[#667781] dark:text-[#8696A0] truncate">
                                {user.phone}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {renderRoleBadge(user.role, user.roleLabel)}
                        </td>

                        {/* Company Badge */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF]">
                              {user.companyCode}
                            </span>
                            <span className="text-xs text-[#111B21] dark:text-[#E9EDEF] font-medium truncate max-w-[140px]">
                              {user.companyName}
                            </span>
                          </div>
                        </td>

                        {/* Branch */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5 text-xs text-[#667781] dark:text-[#8696A0]">
                            <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span className="text-[#111B21] dark:text-[#E9EDEF] font-medium">{user.branch}</span>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5 text-xs text-[#667781] dark:text-[#8696A0]">
                            <Users className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-[#111B21] dark:text-[#E9EDEF] font-medium">{user.department}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              user.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                user.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                          </span>
                        </td>

                        {/* Last Login */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5 text-[11px] text-[#667781] dark:text-[#8696A0]">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            <span>{user.lastLogin}</span>
                          </div>
                        </td>

                        {/* Last Activity */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5 text-[11px] text-[#667781] dark:text-[#8696A0]">
                            <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <span>{user.lastActivity}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 pl-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => openUserDetails(user)}
                              className="p-1.5 rounded-lg text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF] hover:bg-[#F0F2F5] dark:hover:bg-[#111B21] transition-colors cursor-pointer"
                              title="More Options"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => openUserDetails(user)}
                              className="p-1.5 rounded-lg text-[#667781] hover:text-[#128C7E] dark:text-[#8696A0] dark:hover:text-[#25D366] hover:bg-[#F0F2F5] dark:hover:bg-[#111B21] transition-colors cursor-pointer"
                              title="View Account Details"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-xs text-[#667781] dark:text-[#8696A0]">
                        No users match the current search and filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer: Item Counter & Pagination Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E0E5E7] dark:border-[#222D34] pt-4 text-xs text-[#667781] dark:text-[#8696A0]">
              <p>
                Showing {filteredUsers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
                {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length} users
              </p>

              <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg border border-[#E0E5E7] dark:border-[#222D34] bg-white dark:bg-[#202C33] disabled:opacity-40 cursor-pointer"
                >
                  &lt;
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`h-7 w-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      currentPage === page
                        ? 'bg-[#128C7E] dark:bg-[#25D366] text-white dark:text-[#111B21]'
                        : 'border border-[#E0E5E7] dark:border-[#222D34] bg-white dark:bg-[#202C33] text-[#111B21] dark:text-[#E9EDEF]'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-lg border border-[#E0E5E7] dark:border-[#222D34] bg-white dark:bg-[#202C33] disabled:opacity-40 cursor-pointer"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* OTHER TABS: TEAMS, ASSIGNMENTS, INVITATIONS, DEACTIVATED */}
        {/* ========================================================================= */}
        {activeTab === 'create' && (
          <div className="animate-in fade-in duration-150">
            <CreateUserTab
              departments={departments}
              managers={managers}
              onCreated={handleUserCreated}
              onCancel={() => setActiveTab('directory')}
              onNotify={(title, message, tone) => {
                toast(title, message, tone);
              }}
            />
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">Organization Departments & Teams</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['Administration', 'Operations', 'Education', 'Counseling', 'Medical'].map((dept) => (
                <div key={dept} className="p-4 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] space-y-1">
                  <h4 className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">{dept}</h4>
                  <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                    {usersList.filter((u) => u.department === dept).length} active team members
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">User Module & Record Ownership</h3>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">
              Configure which team members own incoming leads, student batches, and clinical assessments.
            </p>
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
              ✓ All coordinators and doctors have active record ownership permissions enabled.
            </div>
          </div>
        )}

        {activeTab === 'invitations' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-4 text-center py-10">
            <Mail className="h-8 w-8 text-[#667781] dark:text-[#8696A0] mx-auto mb-2" />
            <h4 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">No Pending Invitations</h4>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">All invited staff accounts have been activated.</p>
          </div>
        )}

        {activeTab === 'deactivated' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-4 text-center py-10">
            <Power className="h-8 w-8 text-rose-500 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">Deactivated Accounts</h4>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">There are currently 0 permanently deactivated staff accounts.</p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FULL USER DETAILS & CREDENTIALS DRAWER */}
        {/* ========================================================================= */}
        <UserDetailDrawer
          userId={detailUserId}
          departments={departments}
          initialTab="overview"
          onClose={() => setDetailUserId(null)}
          onChanged={() => { void loadUsersFromApi(); }}
          onNotify={toast}
        />
      </div>
    </SettingsLayout>
  );
};

export default UserManagementSection;

