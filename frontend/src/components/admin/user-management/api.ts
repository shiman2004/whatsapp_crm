import { API_BASE_URL } from '../../../config/api';

// The User Management API is Super-Admin-only on the server. This client never
// decides access; it only surfaces what the server returns.

let readToken: () => string = () =>
  (typeof window !== 'undefined' ? localStorage.getItem('rw_crm_auth_token') || '' : '');

export function setUserManagementTokenReader(reader: () => string) {
  readToken = reader;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${readToken()}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
  if (!response.ok) {
    throw new ApiError(
      parsed?.error || response.statusText || 'Request failed.',
      response.status,
      parsed?.code,
    );
  }
  return (parsed?.data ?? parsed) as T;
}

function query(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'locked' | 'invited';

export interface ManagedUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  roleLabel: string;
  company: string | null;
  branch: string | null;
  active: boolean;
  status: UserStatus;
  locked: boolean;
  marketingAccess: boolean;
  employeeId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  managerId: string | null;
  lastLoginAt: string | null;
  suspendedAt: string | null;
  lockedUntil: string | null;
  invitationId: string | null;
  invitationExpiresAt: string | null;
  activeSessions: number;
  leadCount: number;
  marketingCount: number;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface UserOverview {
  counters: {
    total: number;
    active: number;
    inactive: number;
    pendingInvitations: number;
    locked: number;
    suspended: number;
    administrators: number;
    coordinators: number;
    staff: number;
  };
  distribution: {
    roles: { role: string; label: string; count: number }[];
    branches: { branch: string; count: number }[];
  };
  recentUsers: ManagedUser[];
  pendingInvitations: Invitation[];
  attention: { id: string; fullName: string; email: string; role: string; suspendedAt: string | null; lockedUntil: string | null; lastLoginAt: string | null }[];
  recentActivity: SecurityEvent[];
}

export interface SecurityEvent {
  id: string;
  actorId: string | null;
  actorName?: string | null;
  action: string;
  resource: string;
  outcome: string;
  createdAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  fullName: string;
  role: string;
  roleLabel?: string;
  company: string | null;
  branch: string | null;
  departmentId: string | null;
  departmentName?: string | null;
  status?: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt?: string;
  invitedByName?: string | null;
}

export interface Department {
  id: string;
  name: string;
  company: string | null;
  branch: string | null;
  description: string | null;
  active: boolean;
  userCount: number;
}

export interface Team {
  id: string;
  departmentId: string | null;
  name: string;
  company: string | null;
  branch: string | null;
  leadUserId: string | null;
  leadName: string | null;
  active: boolean;
  memberCount: number;
}

export interface TeamMember {
  teamId: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

export interface Assignment {
  type: 'lead' | 'marketing_contact';
  id: string;
  reference: string;
  company: string | null;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  assignedAt: string | null;
  assignedByName: string | null;
  lastReassignedAt: string | null;
  resourceName: string | null;
}

export interface AssignmentHistoryEntry {
  type: string;
  id: string;
  resourceId: string;
  reference: string | null;
  toUserId: string | null;
  toUserName: string | null;
  actorId: string | null;
  actorName: string | null;
  assignedAt: string;
  reason: string | null;
}

export interface LoginSession {
  id: string;
  userId: string;
  userName: string | null;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  device: string;
  status: 'active' | 'revoked';
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

export interface UserDetail {
  user: ManagedUser;
  teams: { id: string; name: string; company: string | null; branch: string | null }[];
  invitation: { id: string; expiresAt: string; createdAt: string } | null;
  sessions: LoginSession[];
  activity: SecurityEvent[];
  assignments: { type: string; count: number }[];
  credentials?: {
    pin: string | null;
    pinConfigured: boolean;
    pinIsHashed: boolean;
    password: string | null;
    passwordConfigured: boolean;
    passwordIsHashed: boolean;
  } | null;
}

export interface UserInput {
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
  company?: string;
  branch?: string;
  employeeId?: string;
  departmentId?: string | null;
  managerId?: string | null;
  marketingAccess?: boolean;
  password?: string;
  pin?: string;
  active?: boolean;
}

export const userManagementApi = {
  overview: () => request<UserOverview>('/api/user-management/overview'),
  users: (params: Record<string, string | number | undefined>) =>
    request<Page<ManagedUser>>(`/api/user-management/users${query(params)}`),
  user: (id: string) => request<UserDetail>(`/api/user-management/users/${id}`),
  createUser: (input: UserInput) =>
    request<ManagedUser>('/api/user-management/users', { method: 'POST', body: JSON.stringify(input) }),
  updateUser: (id: string, input: UserInput) =>
    request<ManagedUser>(`/api/user-management/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  setStatus: (id: string, action: 'activate' | 'deactivate' | 'suspend' | 'unlock', reason?: string) =>
    request<ManagedUser>(`/api/user-management/users/${id}/status`, {
      method: 'POST', body: JSON.stringify({ action, reason }),
    }),
  resetCredentials: (id: string, input: { password?: string; pin?: string }) =>
    request<{ id: string; updated: boolean }>(`/api/user-management/users/${id}/credentials`, {
      method: 'POST', body: JSON.stringify(input),
    }),
  revokeSessions: (id: string) =>
    request<{ id: string; revoked: boolean }>(`/api/user-management/users/${id}/revoke-sessions`, { method: 'POST' }),

  exportUsers: async (params: Record<string, string | number | undefined>) => {
    const response = await fetch(`${API_BASE_URL}/api/user-management/users/export.csv${query(params)}`, {
      headers: { Authorization: `Bearer ${readToken()}` },
    });
    if (!response.ok) throw new ApiError('Export failed.', response.status);
    return response.blob();
  },

  invitations: (params: Record<string, string | number | undefined>) =>
    request<Page<Invitation>>(`/api/user-management/invitations${query(params)}`),
  invite: (input: { email: string; fullName: string; role: string; company?: string; branch?: string; departmentId?: string | null }) =>
    request<Invitation & { inviteUrl: string }>('/api/user-management/invitations', {
      method: 'POST', body: JSON.stringify(input),
    }),
  resendInvite: (id: string) =>
    request<{ id: string; inviteUrl: string }>(`/api/user-management/invitations/${id}/resend`, { method: 'POST' }),
  revokeInvite: (id: string) =>
    request<{ id: string; revoked: boolean }>(`/api/user-management/invitations/${id}`, { method: 'DELETE' }),

  org: () => request<{ departments: Department[]; teams: Team[]; members: TeamMember[] }>('/api/user-management/departments'),
  createDepartment: (input: { name: string; company?: string; branch?: string; description?: string }) =>
    request<{ id: string }>('/api/user-management/departments', { method: 'POST', body: JSON.stringify(input) }),
  updateDepartment: (id: string, input: Partial<{ name: string; company: string; branch: string; description: string; active: boolean }>) =>
    request<{ id: string }>(`/api/user-management/departments/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  createTeam: (input: { name: string; departmentId: string; company?: string; branch?: string; leadUserId?: string }) =>
    request<{ id: string }>('/api/user-management/teams', { method: 'POST', body: JSON.stringify(input) }),
  updateTeam: (id: string, input: Partial<{ name: string; departmentId: string; branch: string; leadUserId: string; active: boolean }>) =>
    request<{ id: string }>(`/api/user-management/teams/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  setTeamMembers: (id: string, userIds: string[]) =>
    request<{ teamId: string; members: number }>(`/api/user-management/teams/${id}/members`, {
      method: 'PUT', body: JSON.stringify({ userIds }),
    }),

  assignments: (params: Record<string, string | number | undefined>) =>
    request<Page<Assignment>>(`/api/user-management/assignments${query(params)}`),
  assignmentHistory: (params: Record<string, string | number | undefined>) =>
    request<{ items: AssignmentHistoryEntry[]; page: number; pageSize: number }>(`/api/user-management/assignments/history${query(params)}`),
  reassign: (input: { type: 'lead' | 'marketing_contact'; id: string; toUserId: string; reason?: string }) =>
    request<{ type: string; id: string; ownerId: string; ownerName: string }>('/api/user-management/assignments/reassign', {
      method: 'POST', body: JSON.stringify(input),
    }),

  sessions: (params: Record<string, string | number | undefined>) =>
    request<Page<LoginSession>>(`/api/user-management/sessions${query(params)}`),
  revokeSession: (id: string) =>
    request<{ id: string; revoked: boolean }>(`/api/user-management/sessions/${id}`, { method: 'DELETE' }),
};

export const ROLE_OPTIONS = [
  'super_admin', 'leads_officer', 'coordinator', 'sales_coordinator',
  'exam_department_manager', 'exam_coordinator', 'exam_providing_officer',
  'marketing_officer', 'marketing_admin', 'clinical_nurse', 'clinical_doctor', 'report_analyst',
] as const;

export const COMPANY_OPTIONS = ['RWC', 'CRAS', 'AHC'] as const;

export const STATUS_TONE: Record<string, 'teal' | 'rose' | 'amber' | 'indigo' | 'slate'> = {
  active: 'teal',
  inactive: 'slate',
  suspended: 'rose',
  locked: 'amber',
  invited: 'indigo',
  pending: 'indigo',
  accepted: 'teal',
  revoked: 'slate',
  expired: 'amber',
};
