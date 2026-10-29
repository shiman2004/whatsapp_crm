import { API_BASE_URL } from '../../../config/api';
import type {
  AuditPage,
  Overrides,
  Overview,
  Preview,
  RoleDetail,
  RoleDirectory,
  Scope,
  UserDetail,
  UserPage,
} from './types';

// The shell registers the context's token reader once, so every tab reuses the
// same authenticated client without prop-drilling or stale closures.
let readToken: () => string = () => '';

export function setSecurityTokenReader(reader: () => string) {
  readToken = reader;
}

export class SecurityApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'SecurityApiError';
    this.status = status;
    this.code = code;
  }
}

function toQuery(params: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/security${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${readToken()}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new SecurityApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new SecurityApiError(
      payload?.error || `Request failed with status ${response.status}.`,
      response.status,
      payload?.code,
    );
  }
  return payload.data as T;
}

export interface OverridePayload {
  overrides: Overrides;
  scope?: Scope | null;
  expectedRevision: number;
  reason?: string;
}

export const securityApi = {
  overview: () => request<Overview>('GET', '/overview'),
  roles: () => request<RoleDirectory>('GET', '/roles'),
  role: (role: string) => request<RoleDetail>('GET', `/roles/${encodeURIComponent(role)}/permissions`),
  updateRole: (role: string, payload: OverridePayload) =>
    request<unknown>('PATCH', `/roles/${encodeURIComponent(role)}/permissions`, payload),
  resetRole: (role: string, expectedRevision: number, reason?: string) =>
    request<unknown>('DELETE', `/roles/${encodeURIComponent(role)}/permissions${toQuery({ expectedRevision, reason })}`),
  users: (params: { page?: number; pageSize?: number; search?: string; role?: string; department?: string; status?: string; custom?: string }) =>
    request<UserPage>('GET', `/users${toQuery(params)}`),
  user: (id: string) => request<UserDetail>('GET', `/users/${encodeURIComponent(id)}/permissions`),
  updateUser: (id: string, payload: OverridePayload) =>
    request<unknown>('PATCH', `/users/${encodeURIComponent(id)}/permissions`, payload),
  resetUser: (id: string, expectedRevision: number, reason?: string) =>
    request<unknown>('DELETE', `/users/${encodeURIComponent(id)}/overrides${toQuery({ expectedRevision, reason })}`),
  preview: (payload: { subjectType: 'role' | 'user'; subjectId: string; overrides: Overrides; scope?: Scope | null }) =>
    request<Preview>('POST', '/permissions/preview', payload),
  audit: (params: { page?: number; pageSize?: number; search?: string; actorId?: string; module?: string; action?: string; outcome?: string; from?: string; to?: string }) =>
    request<AuditPage>('GET', `/audit-logs${toQuery(params)}`),
};

export { toQuery };
