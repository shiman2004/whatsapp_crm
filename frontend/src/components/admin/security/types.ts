// Shapes returned by the Security & Access API (backend/src/securityRoutes.js).
// The server is authoritative; nothing here grants anything on its own.

export type Scope = 'own' | 'assigned' | 'department' | 'all';
export type Effect = 'allow' | 'deny';
export type Override = { effect: Effect };
export type Overrides = Record<string, Override>;

export interface CapabilityMeta {
  key: string;
  module: string;
  action: string;
  label: string;
  description: string;
  scope: Scope;
  scopes: Scope[];
  immutable: boolean;
  delegatable: boolean;
  roleEditable: boolean;
}

export interface ModuleInfo {
  id: string;
  label: string;
  description: string;
  category: string;
  capabilities: CapabilityMeta[];
}

export interface PolicyCapability {
  capability: string;
  allowed: boolean;
  source: string;
  scope: Scope | null;
  reason?: string;
  module?: string;
  action?: string;
  immutable?: boolean;
  editable?: boolean;
}

export interface PolicyView {
  role: string;
  label?: string;
  maxScope: Scope;
  scope?: Scope;
  active?: boolean;
  capabilities: Record<string, PolicyCapability>;
}

export interface RoleSummary {
  role: string;
  label: string;
  category: string;
  maxScope: Scope;
  capabilities: string[];
  revision: number;
  overrides: Overrides;
  editableCapabilities: string[];
  scope: Scope;
}

export interface RoleDirectory {
  roles: RoleSummary[];
  modules: ModuleInfo[];
  scopes: Scope[];
  capabilities: string[];
}

export interface RoleDetail {
  role: string;
  policy: PolicyView;
  revision: number;
  overrides: Overrides;
  editableCapabilities: string[];
  modules: ModuleInfo[];
  scopes: Scope[];
  immutable: boolean;
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  role: string;
  roleLabel: string;
  department: string;
  departmentLabel: string;
  company: string | null;
  branch: string | null;
  active: boolean;
  marketingAccess: boolean;
  createdAt?: string;
  customPermissions?: boolean;
  overrideCount?: number;
  scope?: Scope;
  revision?: number;
}

export interface UserPage {
  items: UserSummary[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface UserDetail {
  user: UserSummary;
  role: string;
  roleLabel: string;
  maxScope: Scope;
  scope: Scope;
  revision: number;
  overrides: Overrides;
  policy: PolicyView;
  modules: ModuleInfo[];
  roleCapabilities: string[];
  eligibleScopes: Scope[];
  self: boolean;
}

export type ChangeRisk = 'elevation' | 'reduction' | 'scope';

export interface PermissionChange {
  capability: string;
  module: string | null;
  label: string;
  action: string | null;
  from: { allowed: boolean; scope: Scope | null };
  to: { allowed: boolean; scope: Scope | null };
  risk: ChangeRisk;
}

export interface Preview {
  subjectType: 'role' | 'user';
  subjectId: string;
  label: string;
  scope: Scope | null;
  revision: number;
  before: PolicyView;
  after: PolicyView;
  changes: PermissionChange[];
  summary: { added: number; removed: number; rescoped: number };
  warnings: string[];
}

export interface AuditEvent {
  id: string;
  correlationId: string;
  actorId: string;
  actorName: string;
  action: string;
  resource: string;
  outcome: string;
  module: string | null;
  modules: string[] | null;
  subjectType: string | null;
  subjectId: string | null;
  reason: string | null;
  scope: Scope | null;
  changes: PermissionChange[];
  revision: number | null;
  createdAt: string;
}

export interface AuditPage {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface Overview {
  counters: {
    activeUsers: number;
    roles: number;
    customUsers: number;
    protectedModules: number;
  };
  highPrivilegeUsers: { id: string; fullName: string; role: string; roleLabel: string }[];
  recentActivity: AuditEvent[];
  distribution: {
    module: string;
    label: string;
    roles: number;
    capabilities: number;
    roleList: { role: string; label: string }[];
    customized: number;
  }[];
}

export interface AccessRequestItem {
  id: string;
  requesterId: string;
  requester?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    company: string;
  };
  targetCompany?: string | null;
  targetDepartmentId?: string | null;
  requestedRoleKey?: string | null;
  requestedPermissionKey?: string | null;
  requestType: 'role_assignment' | 'permission_override' | 'cross_company_access';
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  durationHours?: number | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessRequestPage {
  items: AccessRequestItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CompanyMembershipItem {
  id: string;
  userId: string;
  company: string;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
}

export interface DepartmentMembershipItem {
  id: string;
  userId: string;
  departmentId: string;
  isPrimary: boolean;
  active: boolean;
  department?: {
    id: string;
    name: string;
    company?: string;
  };
}

export interface UserMemberships {
  companies: CompanyMembershipItem[];
  departments: DepartmentMembershipItem[];
  roleAssignments: Array<{
    id: string;
    roleKey: string;
    company: string;
    active: boolean;
    expiresAt?: string | null;
    role?: { key: string; label: string };
  }>;
  overrides: Array<{
    id: string;
    permissionKey: string;
    effect: 'allow' | 'deny';
    scope?: string | null;
    company: string;
    reason?: string | null;
    expiresAt?: string | null;
    permission?: { key: string; label: string };
  }>;
}

export interface SaveMembershipsPayload {
  companies: string[];
  defaultCompany?: string;
  departmentIds?: string[];
  primaryDepartmentId?: string;
}
