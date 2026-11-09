import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Users,
  ShieldCheck,
  Activity,
  Monitor,
  Laptop,
  Search,
  Plus,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  ArrowRight,
  Layers,
  Building2,
  Sliders,
  Check,
  X,
  FileSpreadsheet,
  Stethoscope,
  GraduationCap
} from 'lucide-react';
import { SettingsLayout } from './SettingsLayout';
import { useCrm } from '../../context/CrmContext';
import { UserDetailDrawer } from '../admin/user-management/UserDetailDrawer';
import { setUserManagementTokenReader, userManagementApi, type Department, type ManagedUser } from '../admin/user-management/api';

interface RolesPermissionsSectionProps {
  currentSectionId: string;
  onSelectSection: (id: string) => void;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
}

type TabType = 'staff' | 'roles' | 'activity' | 'sessions';

interface RoleModuleAccess {
  crm: boolean;
  clinical: boolean;
  reports: boolean;
  userManagement: boolean;
  exams: boolean;
  whatsapp: boolean;
}

const ROLE_COLUMNS = [
  { key: 'Super Admin', label: 'Super Admin' },
  { key: 'Admin', label: 'Admin' },
  { key: 'Clinical Admin', label: 'Clinical Admin' },
  { key: 'Clinical Doctor', label: 'Clinical Doctor' },
  { key: 'Marketing Admin', label: 'Marketing Admin' },
  { key: 'Patient Coordinator', label: 'Coordinator' },
  { key: 'Reports Viewer', label: 'Reports Viewer' },
] as const;

const PERMISSION_MODULES: Array<{ key: keyof RoleModuleAccess; label: string; description: string; icon: React.ElementType }> = [
  { key: 'crm', label: 'CRM & Leads', description: 'Contacts, pipeline, and customer activity', icon: MessageSquare },
  { key: 'clinical', label: 'Clinical', description: 'Assessments, notes, and appointments', icon: Stethoscope },
  { key: 'reports', label: 'Reports', description: 'Analytics and financial reporting', icon: FileSpreadsheet },
  { key: 'userManagement', label: 'User & Staff', description: 'Staff directory and access management', icon: Users },
  { key: 'exams', label: 'Academic Exams', description: 'CRAS batches, content, and exams', icon: GraduationCap },
  { key: 'whatsapp', label: 'WhatsApp', description: 'Messaging and chat routing', icon: MessageSquare },
];

interface ActivityEvent {
  id: string;
  type: 'login' | 'role_update' | 'session_revoke' | 'whatsapp';
  title: string;
  timestamp: string;
}

interface SessionItem {
  id: string;
  user: string;
  device: string;
  ip: string;
  location: string;
  activeSince: string;
  status: 'active' | 'revoked';
}

export const RolesPermissionsSection: React.FC<RolesPermissionsSectionProps> = ({
  currentSectionId,
  onSelectSection,
  selectedCompanyId,
  onSelectCompany
}) => {
  const { currentUser, getAuthToken, notify } = useCrm();

  const [activeTab, setActiveTab] = useState<TabType>('staff');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffUsers, setStaffUsers] = useState<ManagedUser[]>([]);
  const tokenRef = useRef(getAuthToken);

  useEffect(() => {
    tokenRef.current = getAuthToken;
    setUserManagementTokenReader(() => tokenRef.current());
  }, [getAuthToken]);

  useEffect(() => {
    Promise.all([
      userManagementApi.org(),
      userManagementApi.users({ pageSize: 100 }),
      userManagementApi.overview(),
      userManagementApi.sessions({ pageSize: 100 }),
    ])
      .then(([org, directory, overview, sessionPage]) => {
        setDepartments(org.departments);
        setStaffUsers(directory.items);
        setActivityEvents(overview.recentActivity.map((event) => ({
          id: event.id,
          type: event.action.startsWith('session.') ? 'session_revoke' : event.action.startsWith('login') ? 'login' : 'role_update',
          title: `${event.action} — ${event.resource}`,
          timestamp: new Date(event.createdAt).toLocaleString(),
        })));
        setSessions(sessionPage.items.map((session) => ({
          id: session.id,
          user: session.userName || session.email || 'Unknown user',
          device: session.device,
          ip: session.ip || '—',
          location: '',
          activeSince: new Date(session.createdAt).toLocaleString(),
          status: session.status,
        })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setCompanyFilter(selectedCompanyId || 'ALL');
  }, [selectedCompanyId]);

  // Quick Role Access Selected Role
  const [selectedRole, setSelectedRole] = useState<string>('Clinical Admin');
  
  // Role Access Matrix map
  const [roleAccessMap, setRoleAccessMap] = useState<Record<string, RoleModuleAccess>>({
    'Super Admin': { crm: true, clinical: true, reports: true, userManagement: true, exams: true, whatsapp: true },
    'Admin': { crm: true, clinical: true, reports: true, userManagement: true, exams: true, whatsapp: true },
    'Clinical Admin': { crm: true, clinical: true, reports: false, userManagement: false, exams: false, whatsapp: true },
    'Clinical Doctor': { crm: true, clinical: true, reports: true, userManagement: false, exams: false, whatsapp: false },
    'Marketing Admin': { crm: true, clinical: false, reports: true, userManagement: false, exams: false, whatsapp: true },
    'Patient Coordinator': { crm: true, clinical: true, reports: false, userManagement: false, exams: false, whatsapp: true },
    'Reports Viewer': { crm: false, clinical: false, reports: true, userManagement: false, exams: false, whatsapp: false },
  });

  // Security activity and sessions are loaded from the database-backed API.\r\n  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);\r\n  const [sessions, setSessions] = useState<SessionItem[]>([]);\r\n\r\n  // Add staff modal state
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('coordinator');
  const [newStaffCompany, setNewStaffCompany] = useState(selectedCompanyId === 'ALL' ? 'RWC' : selectedCompanyId);

  // Filtered users
  const staffList = useMemo(() => {
    return staffUsers.filter(u => {
      const matchesSearch = 
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      const isEnterpriseRole = u.role === 'super_admin' || u.role === 'leads_officer' || u.company === 'ALL';
      const matchesCompany = 
        companyFilter === 'ALL' 
          ? true
          : (u.company === companyFilter || isEnterpriseRole);
      
      const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter.toLowerCase();

      return matchesSearch && matchesRole && matchesCompany && matchesStatus;
    });
  }, [staffUsers, searchQuery, roleFilter, companyFilter, statusFilter]);

  // Metrics
  const activeStaffCount = staffUsers.filter(u => u.active).length;
  const rolesCount = 13;
  const protectedModulesCount = 7;
  const activeSessionsCount = sessions.filter(s => s.status === 'active').length;

  const currentRoleAccess = roleAccessMap[selectedRole] || {
    crm: true,
    clinical: false,
    reports: false,
    userManagement: false,
    exams: false,
    whatsapp: false
  };

  const handleToggleModule = (moduleKey: keyof RoleModuleAccess) => {
    setRoleAccessMap(prev => ({
      ...prev,
      [selectedRole]: {
        ...currentRoleAccess,
        [moduleKey]: !currentRoleAccess[moduleKey]
      }
    }));
    notify?.('Permission Updated', `${selectedRole}: ${String(moduleKey).toUpperCase()} access toggled`, 'success');
  };

  const handleToggleRoleModule = (role: string, moduleKey: keyof RoleModuleAccess) => {
    const access = roleAccessMap[role];
    if (!access) return;
    setRoleAccessMap(prev => ({
      ...prev,
      [role]: { ...access, [moduleKey]: !access[moduleKey] }
    }));
    notify?.('Permission Updated', `${role}: ${PERMISSION_MODULES.find(item => item.key === moduleKey)?.label} access updated`, 'success');
  };

  const handleRevokeSession = (sessionId: string) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'revoked' } : s));
    notify?.('Session Revoked', 'Selected user device session has been terminated.', 'success');
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const formatRoleLabel = (role: string) => {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'leads_officer') return 'Leads Officer';
    if (role === 'coordinator') return 'Patient Coordinator';
    if (role === 'clinical_doctor') return 'Clinical Doctor';
    if (role === 'clinical_nurse') return 'Clinical Nurse';
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <SettingsLayout
      currentSectionId={currentSectionId}
      onSelectSection={onSelectSection}
      selectedCompanyId={selectedCompanyId}
      onSelectCompany={onSelectCompany}
    >
      <div className="space-y-6">
        {/* Navigation Tab Bar */}
        <div className="flex items-center space-x-1 border-b border-[#E0E5E7] dark:border-[#222D34] pb-px overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'staff'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Staff Access</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'roles'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Role Permissions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'activity'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Activity Monitor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'sessions'
                ? 'border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] bg-[#DDF5EC]/40 dark:bg-[#005C4B]/20 rounded-t-xl'
                : 'border-transparent text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF]'
            }`}
          >
            <Laptop className="h-4 w-4" />
            <span>Login Sessions</span>
          </button>
        </div>

        {/* 4 Stat Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center space-x-3.5 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Active Staff</p>
              <h3 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">{activeStaffCount}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center space-x-3.5 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Protected Modules</p>
              <h3 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">{protectedModulesCount}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center space-x-3.5 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Roles</p>
              <h3 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">{rolesCount}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-4 shadow-sm flex items-center space-x-3.5 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-500/20 text-[#128C7E] dark:text-[#25D366] border border-teal-500/20 flex items-center justify-center shrink-0">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Active Sessions</p>
              <h3 className="text-xl font-bold text-[#111B21] dark:text-[#E9EDEF]">{activeSessionsCount}</h3>
            </div>
          </div>
        </div>

        {/* TAB 1: Staff Access View (Two-Column Layout matching screenshot) */}
        {activeTab === 'staff' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Staff Directory Table */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
                {/* Header & Add Staff button */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">Staff Directory</h3>
                      <p className="text-xs text-[#667781] dark:text-[#8696A0]">Manage staff access, roles, and login activity.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddStaffOpen(true)}
                    className="h-8.5 px-3.5 rounded-xl bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Staff</span>
                  </button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="flex-1 relative min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" />
                    <input
                      type="text"
                      placeholder="Search staff by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] placeholder-[#667781] dark:placeholder-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                    />
                  </div>

                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-2.5 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer shrink-0"
                  >
                    <option value="ALL">Role: All</option>
                    {[...new Map(staffUsers.map((user) => [user.role, user.roleLabel])).entries()].map(([role, label]) => (
                      <option key={role} value={role}>{label}</option>
                    ))}
                  </select>

                  <select
                    value={companyFilter}
                    onChange={(e) => setCompanyFilter(e.target.value)}
                    className="bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-2.5 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer shrink-0"
                  >
                    <option value="ALL">Company: All</option>
                    <option value="RWC">Royal Wellness Center (RWC)</option>
                    <option value="CRAS">CRAS College</option>
                    <option value="AHC">Alpha Health Consultancy</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-2.5 py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer shrink-0"
                  >
                    <option value="ALL">Status: All</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="INACTIVE">Inactive Only</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="LOCKED">Locked</option>
                    <option value="INVITED">Invited</option>
                  </select>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E0E5E7] dark:border-[#222D34] text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">
                        <th className="pb-2.5 pr-4">Staff Name</th>
                        <th className="pb-2.5 px-4">Role</th>
                        <th className="pb-2.5 px-4">Company</th>
                        <th className="pb-2.5 px-4">Status</th>
                        <th className="pb-2.5 px-4">Last Login</th>
                        <th className="pb-2.5 pl-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E5E7]/50 dark:divide-[#222D34]/50">
                      {staffList.length > 0 ? (
                        staffList.map((user) => (
                        <tr
                          key={user.id}
                          onClick={() => setDetailUserId(user.id)}
                          className="cursor-pointer hover:bg-[#F0F2F5]/60 dark:hover:bg-[#111B21]/60 transition-colors"
                        >
                            {/* Staff Name & Initial */}
                            <td className="py-3 pr-4">
                              <div className="flex items-center space-x-3">
                                <div className="h-8 w-8 rounded-lg bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] flex items-center justify-center text-xs font-bold text-[#111B21] dark:text-[#E9EDEF] shrink-0">
                                  {getInitials(user.fullName)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-[#111B21] dark:text-[#E9EDEF] truncate">{user.fullName}</p>
                                  <p className="text-[11px] text-[#667781] dark:text-[#8696A0] truncate">{user.email}</p>
                                </div>
                              </div>
                            </td>

                            {/* Role */}
                            <td className="py-3 px-4 font-medium text-[#111B21] dark:text-[#E9EDEF]">
                              {user.roleLabel || formatRoleLabel(user.role)}
                            </td>

                            {/* Company */}
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#111B21] dark:text-[#E9EDEF]">
                                {user.company || '—'}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#111B21] dark:text-[#E9EDEF]">
                                <span className={`h-2 w-2 rounded-full ${user.status === 'active' ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-gray-400'}`} />
                                {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                              </span>
                            </td>

                            {/* Last Login */}
                            <td className="py-3 px-4 text-[11px] text-[#667781] dark:text-[#8696A0] whitespace-nowrap">
                              {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never logged in'}
                            </td>

                            {/* Actions */}
                            <td className="py-3 pl-4 text-right" onClick={(event) => event.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setDetailUserId(user.id)}
                                className="p-1 rounded-lg text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF] hover:bg-[#F0F2F5] dark:hover:bg-[#111B21] transition-colors"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-[#667781] dark:text-[#8696A0]">
                            No staff records match the active search and scope criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <UserDetailDrawer
              userId={detailUserId}
              departments={departments}
              initialTab="access"
              onClose={() => setDetailUserId(null)}
              onChanged={() => {}}
              onNotify={notify}
            />

            {/* Right Column: Widgets */}
            <div className="lg:col-span-4 space-y-4">
              {/* Widget 1: Quick Role Access */}
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
                <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-3.5">
                  <div className="h-8 w-8 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">Quick Role Access</h3>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">View and update module access for a role.</p>
                  </div>
                </div>

                {/* Role Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">Role</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 cursor-pointer"
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="Admin">Admin</option>
                    <option value="Clinical Admin">Clinical Admin</option>
                    <option value="Clinical Doctor">Clinical Doctor</option>
                    <option value="Marketing Admin">Marketing Admin</option>
                    <option value="Patient Coordinator">Patient Coordinator</option>
                    <option value="Reports Viewer">Reports Viewer</option>
                  </select>
                </div>

                {/* Module Toggles */}
                <div className="space-y-2.5 pt-1">
                  {/* CRM */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[#F0F2F5]/60 dark:bg-[#111B21]/60 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div className="flex items-center space-x-2.5">
                      <MessageSquare className="h-3.5 w-3.5 text-[#128C7E] dark:text-[#25D366]" />
                      <span className="text-xs font-medium text-[#111B21] dark:text-[#E9EDEF]">CRM</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleModule('crm')}
                      className="flex items-center space-x-2 focus:outline-none cursor-pointer"
                    >
                      <span className={`text-[10px] font-bold ${currentRoleAccess.crm ? 'text-[#128C7E] dark:text-[#25D366]' : 'text-[#667781] dark:text-[#8696A0]'}`}>
                        {currentRoleAccess.crm ? 'Allow' : 'Block'}
                      </span>
                      <div className={`w-8 h-4.5 rounded-full transition-colors relative p-0.5 ${currentRoleAccess.crm ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                        <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${currentRoleAccess.crm ? 'translate-x-3.5' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>

                  {/* Clinical */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[#F0F2F5]/60 dark:bg-[#111B21]/60 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div className="flex items-center space-x-2.5">
                      <Stethoscope className="h-3.5 w-3.5 text-[#128C7E] dark:text-[#25D366]" />
                      <span className="text-xs font-medium text-[#111B21] dark:text-[#E9EDEF]">Clinical</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleModule('clinical')}
                      className="flex items-center space-x-2 focus:outline-none cursor-pointer"
                    >
                      <span className={`text-[10px] font-bold ${currentRoleAccess.clinical ? 'text-[#128C7E] dark:text-[#25D366]' : 'text-[#667781] dark:text-[#8696A0]'}`}>
                        {currentRoleAccess.clinical ? 'Allow' : 'Block'}
                      </span>
                      <div className={`w-8 h-4.5 rounded-full transition-colors relative p-0.5 ${currentRoleAccess.clinical ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                        <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${currentRoleAccess.clinical ? 'translate-x-3.5' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>

                  {/* Reports */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[#F0F2F5]/60 dark:bg-[#111B21]/60 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div className="flex items-center space-x-2.5">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-[#128C7E] dark:text-[#25D366]" />
                      <span className="text-xs font-medium text-[#111B21] dark:text-[#E9EDEF]">Reports</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleModule('reports')}
                      className="flex items-center space-x-2 focus:outline-none cursor-pointer"
                    >
                      <span className={`text-[10px] font-bold ${currentRoleAccess.reports ? 'text-[#128C7E] dark:text-[#25D366]' : 'text-[#667781] dark:text-[#8696A0]'}`}>
                        {currentRoleAccess.reports ? 'Allow' : 'Block'}
                      </span>
                      <div className={`w-8 h-4.5 rounded-full transition-colors relative p-0.5 ${currentRoleAccess.reports ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                        <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${currentRoleAccess.reports ? 'translate-x-3.5' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>

                  {/* User & Staff Management */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[#F0F2F5]/60 dark:bg-[#111B21]/60 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <div className="flex items-center space-x-2.5">
                      <Users className="h-3.5 w-3.5 text-[#128C7E] dark:text-[#25D366]" />
                      <span className="text-xs font-medium text-[#111B21] dark:text-[#E9EDEF]">User & Staff Management</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleModule('userManagement')}
                      className="flex items-center space-x-2 focus:outline-none cursor-pointer"
                    >
                      <span className={`text-[10px] font-bold ${currentRoleAccess.userManagement ? 'text-[#128C7E] dark:text-[#25D366]' : 'text-[#667781] dark:text-[#8696A0]'}`}>
                        {currentRoleAccess.userManagement ? 'Allow' : 'Block'}
                      </span>
                      <div className={`w-8 h-4.5 rounded-full transition-colors relative p-0.5 ${currentRoleAccess.userManagement ? 'bg-[#128C7E] dark:bg-[#25D366]' : 'bg-[#E0E5E7] dark:bg-[#2A3942]'}`}>
                        <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${currentRoleAccess.userManagement ? 'translate-x-3.5' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Widget 2: Recent Security Activity */}
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
                <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-3.5">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20 flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">Recent Security Activity</h3>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">Latest access and permission events.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('activity')}
                    className="text-[11px] font-bold text-[#128C7E] dark:text-[#25D366] hover:underline flex items-center gap-1"
                  >
                    <span>View All</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                <div className="space-y-3">
                  {activityEvents.map((evt) => (
                    <div key={evt.id} className="flex items-start justify-between gap-2 text-xs">
                      <div className="flex items-start space-x-2.5 min-w-0">
                        {evt.type === 'login' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />}
                        {evt.type === 'role_update' && <Sliders className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />}
                        {evt.type === 'session_revoke' && <XCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />}
                        {evt.type === 'whatsapp' && <MessageSquare className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />}
                        <p className="text-[11px] font-medium text-[#111B21] dark:text-[#E9EDEF] leading-tight truncate">
                          {evt.title}
                        </p>
                      </div>
                      <span className="text-[10px] text-[#667781] dark:text-[#8696A0] shrink-0 whitespace-nowrap">
                        {evt.timestamp}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Widget 3: Session Health */}
              <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-3 transition-colors">
                <div className="flex items-center space-x-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                  <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-500/20 text-[#128C7E] dark:text-[#25D366] border border-teal-500/20 flex items-center justify-center shrink-0">
                    <Laptop className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">Session Health</h3>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">Current login session overview.</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="p-2.5 rounded-xl bg-[#F0F2F5]/80 dark:bg-[#111B21]/80 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <p className="text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">{activeSessionsCount}</p>
                    <p className="text-[10px] text-[#667781] dark:text-[#8696A0] font-semibold mt-0.5">Active Sessions</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F0F2F5]/80 dark:bg-[#111B21]/80 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <p className="text-base font-bold text-[#111B21] dark:text-[#E9EDEF]">0</p>
                    <p className="text-[10px] text-[#667781] dark:text-[#8696A0] font-semibold mt-0.5">Suspicious</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F0F2F5]/80 dark:bg-[#111B21]/80 border border-[#E0E5E7]/50 dark:border-[#222D34]/50">
                    <p className="text-base font-bold text-amber-600 dark:text-amber-400">1</p>
                    <p className="text-[10px] text-[#667781] dark:text-[#8696A0] font-semibold mt-0.5">Revoked (24h)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Role Permissions Matrix */}
        {activeTab === 'roles' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-5 shadow-sm space-y-5 transition-colors">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                  Role Permission Matrix
                </h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0]">Manage module access across the roles available in this workspace.</p>
              </div>
              <span className="self-start rounded-lg border border-[#128C7E]/20 bg-[#DDF5EC] px-2.5 py-1 text-[11px] font-bold text-[#128C7E] dark:border-[#25D366]/20 dark:bg-[#005C4B]/40 dark:text-[#25D366]">
                {PERMISSION_MODULES.length} protected modules
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#E0E5E7] dark:border-[#222D34]">
              <table className="w-full min-w-[940px] text-left text-xs">
                <thead>
                  <tr className="bg-[#F0F2F5]/70 dark:bg-[#111B21]/70 text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">
                    <th className="px-4 py-3">Module</th>
                    {ROLE_COLUMNS.map(role => (
                      <th key={role.key} className="px-3 py-3 text-center whitespace-nowrap">{role.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E5E7]/60 dark:divide-[#222D34]/60">
                  {PERMISSION_MODULES.map((module) => {
                    const RowIcon = module.icon;
                    return (
                      <tr key={module.key} className="transition-colors hover:bg-[#F0F2F5]/50 dark:hover:bg-[#111B21]/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2.5">
                            <div className="p-1.5 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/30 text-[#128C7E] dark:text-[#25D366]">
                              <RowIcon className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <span className="font-semibold text-[#111B21] dark:text-[#E9EDEF]">{module.label}</span>
                              <p className="mt-0.5 text-[10px] font-normal text-[#667781] dark:text-[#8696A0]">{module.description}</p>
                            </div>
                          </div>
                        </td>
                        {ROLE_COLUMNS.map(role => {
                          const allowed = roleAccessMap[role.key]?.[module.key] ?? false;
                          return (
                            <td key={role.key} className="px-3 py-3 text-center">
                              <button
                                type="button"
                                aria-pressed={allowed}
                                aria-label={`${allowed ? 'Revoke' : 'Grant'} ${module.label} access for ${role.label}`}
                                onClick={() => handleToggleRoleModule(role.key, module.key)}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 ${
                                  allowed
                                    ? 'border-[#128C7E]/25 bg-[#DDF5EC] text-[#128C7E] dark:border-[#25D366]/25 dark:bg-[#005C4B]/40 dark:text-[#25D366]'
                                    : 'border-[#E0E5E7] bg-white text-[#AEBAC1] hover:bg-[#F0F2F5] dark:border-[#222D34] dark:bg-[#202C33] dark:text-[#667781] dark:hover:bg-[#111B21]'
                                }`}
                              >
                                {allowed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Activity Monitor */}
        {activeTab === 'activity' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
            <div>
              <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                Security &amp; Access Audit Trail
              </h3>
              <p className="text-xs text-[#667781] dark:text-[#8696A0]">Append-only log of logins, permission elevations, and session lifecycle changes.</p>
            </div>

            <div className="divide-y divide-[#E0E5E7]/60 dark:divide-[#222D34]/60">
              {activityEvents.map((evt) => (
                <div key={evt.id} className="py-3.5 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34]">
                      {evt.type === 'login' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      {evt.type === 'role_update' && <Sliders className="h-4 w-4 text-blue-500" />}
                      {evt.type === 'session_revoke' && <XCircle className="h-4 w-4 text-amber-500" />}
                      {evt.type === 'whatsapp' && <MessageSquare className="h-4 w-4 text-emerald-600" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">{evt.title}</p>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">Event ID: sec-evt-{evt.id} · Scope: Global</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-[#667781] dark:text-[#8696A0]">{evt.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Login Sessions */}
        {activeTab === 'sessions' && (
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF] uppercase tracking-wider flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-[#128C7E] dark:text-[#25D366]" />
                  Active Device Logins &amp; Sessions
                </h3>
                <p className="text-xs text-[#667781] dark:text-[#8696A0]">Manage logged-in staff browser sessions across desktop and mobile devices.</p>
              </div>

              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366] border border-[#128C7E]/20">
                {activeSessionsCount} Active Devices
              </span>
            </div>

            <div className="divide-y divide-[#E0E5E7]/60 dark:divide-[#222D34]/60">
              {sessions.map((session) => (
                <div key={session.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-xl bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] text-[#128C7E] dark:text-[#25D366] shrink-0 mt-0.5">
                      <Monitor className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">{session.user}</p>
                        <span className={`px-2 py-0.2 rounded-full text-[10px] font-semibold ${
                          session.status === 'active' 
                            ? 'bg-[#DDF5EC] text-[#075E54] dark:bg-[#005C4B]/50 dark:text-[#25D366]'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {session.status === 'active' ? 'Active Now' : 'Revoked'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#667781] dark:text-[#8696A0] mt-0.5">
                        {session.device} · IP: {session.ip} · {session.location}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 self-end sm:self-auto">
                    <span className="text-[11px] text-[#667781] dark:text-[#8696A0]">Since: {session.activeSince}</span>
                    {session.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(session.id)}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-500/20 dark:hover:bg-red-500/30 dark:text-red-300 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add Staff Member */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-[#DDF5EC] dark:bg-[#005C4B]/40 text-[#128C7E] dark:text-[#25D366]">
                  <Users className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">Add Staff Member</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className="text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newStaffName.trim() || !newStaffEmail.trim()) return;
                setIsAddStaffOpen(false);
                notify?.('Staff Created', `${newStaffName} has been assigned to ${newStaffCompany}.`, 'success');
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Kasun Silva"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. kasun@royalwellness.lk"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">Assign Role</label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value)}
                    className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  >
                    <option value="coordinator">Patient Coordinator</option>
                    <option value="clinical_doctor">Clinical Doctor</option>
                    <option value="clinical_nurse">Clinical Nurse</option>
                    <option value="leads_officer">Leads Officer</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">Company Scope</label>
                  <select
                    value={newStaffCompany}
                    onChange={(e) => setNewStaffCompany(e.target.value)}
                    className="w-full bg-[#F0F2F5] dark:bg-[#111B21] border border-[#E0E5E7] dark:border-[#222D34] rounded-xl px-3 py-2 text-xs text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  >
                    <option value="RWC">Royal Wellness Center</option>
                    <option value="CRAS">CRAS College</option>
                    <option value="AHC">Alpha Health</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#E0E5E7] dark:border-[#222D34] text-xs font-semibold text-[#667781] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#128C7E] hover:bg-[#075E54] dark:bg-[#25D366] dark:hover:bg-[#128C7E] text-white dark:text-[#111B21] text-xs font-bold shadow-sm"
                >
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
};

