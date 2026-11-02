// authorizationService.js — Centralized Authorization & Security Engine
// Alpha Health Group CRM: Person -> Company -> Department -> Role -> Permission -> Record Scope
// Deterministic policy evaluation order with explicit-deny precedence, company isolation, and default-deny.

import { getPrisma, getDbStatus } from './db.js';
import {
  CAPABILITY_KEYS,
  SCOPES,
  getCapability,
  resolvePermission,
  roleMaxScope,
  narrowScope,
  isImmutableCapability,
} from './securityPolicy.js';
import { auditSecurityEvent } from './securityAudit.js';

export class AuthorizationError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Normalized authorization result structure.
 */
export function authResult(allowed, code, message, meta = {}) {
  return {
    allowed,
    code,
    message,
    scope: meta.scope || null,
    source: meta.source || (allowed ? 'role' : 'default_deny'),
    company: meta.company || null,
    reason: meta.reason || message,
  };
}

/**
 * Resolves all active company memberships for an actor from the database.
 * Super Admin implicitly has access to all companies (RWC, CRAS, AHC, ALL).
 */
export async function getActorCompanyMemberships(actorId, actorRole) {
  if (actorRole === 'super_admin') {
    return ['RWC', 'CRAS', 'AHC', 'ALL'];
  }
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) {
    return ['RWC']; // Safe fallback for unmigrated test environments
  }

  try {
    const rows = await prisma.companyMembership.findMany({
      where: { userId: actorId, active: true },
      select: { company: true, isDefault: true },
    });
    if (rows.length > 0) {
      return rows.map(r => r.company);
    }
  } catch (err) {
    console.warn('[AuthService] Could not read company memberships:', err.message);
  }
  return ['RWC'];
}

/**
 * Resolves the effective role for an actor within a specific company context.
 * In the new model, UserRoleAssignment stores (userId, roleKey, company).
 * Falls back to actor.role (the primary role) if no specific company override exists.
 */
export async function resolveActorRoleInCompany(actor, targetCompany) {
  if (actor.role === 'super_admin') return 'super_admin';
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) return actor.role;

  try {
    const assignment = await prisma.userRoleAssignment.findFirst({
      where: {
        userId: actor.id,
        company: targetCompany,
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      select: { roleKey: true },
    });
    if (assignment) return assignment.roleKey;
  } catch {}
  return actor.role;
}

/**
 * Resolves user overrides for an actor, including temporary overrides and active expirations.
 */
export async function resolveActorPermissionOverrides(actorId, targetCompany) {
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) return {};

  const overrides = {};
  try {
    const rows = await prisma.userPermissionOverride.findMany({
      where: {
        userId: actorId,
        company: { in: ['ALL', targetCompany] },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      select: { permissionKey: true, effect: true, scope: true, expiresAt: true },
    });
    for (const row of rows) {
      overrides[row.permissionKey] = {
        effect: row.effect,
        scope: row.scope,
        expiresAt: row.expiresAt,
      };
    }
  } catch {}
  return overrides;
}

/**
 * Centralized Authorization Service Interface:
 * authorize(actor, action, resource, context)
 *
 * @param {Object} actor - Authenticated user { id, email, role, company, active }
 * @param {string} action - Required capability key (e.g. 'crm.contact.view', 'crm.contact.assign')
 * @param {Object|string|null} resource - Target record or resource identifier (e.g. lead object, assessment object)
 * @param {Object} context - Optional context: { company, departmentId, correlationId, ip }
 * @returns {Promise<{allowed: boolean, code: string, message: string, scope: string, source: string}>}
 */
export async function authorize(actor, action, resource = null, context = {}) {
  // 1. Identity & Active State Verification (Deny by default for missing/inactive)
  if (!actor || !actor.id) {
    return authResult(false, 'UNAUTHENTICATED', 'No authenticated identity provided.');
  }
  if (actor.active === false) {
    return authResult(false, 'ACCOUNT_DEACTIVATED', 'This staff account has been deactivated.');
  }

  // 2. Explicit Super Admin Access (Unrestricted, auditable)
  if (actor.role === 'super_admin') {
    return authResult(true, 'SUPER_ADMIN_GRANTED', 'Super Admin unrestricted access.', {
      scope: 'all',
      source: 'super_admin',
      company: context.company || actor.company || 'ALL',
    });
  }

  // 3. Resolve Company Scope Boundary
  const requestedCompany = (context.company || actor.company || 'RWC').toUpperCase();
  const allowedCompanies = await getActorCompanyMemberships(actor.id, actor.role);

  if (requestedCompany !== 'ALL' && !allowedCompanies.includes(requestedCompany)) {
    return authResult(false, 'CROSS_COMPANY_FORBIDDEN', `You do not have active membership in ${requestedCompany}.`, {
      company: requestedCompany,
    });
  }

  // 4. Resolve Context-Specific Role & Overrides
  const effectiveRole = await resolveActorRoleInCompany(actor, requestedCompany);
  const userOverrides = await resolveActorPermissionOverrides(actor.id, requestedCompany);

  // 5. Evaluate Capability Permission (Identity -> User Override Deny -> Temp Grant -> User Override Allow -> Role Default -> Default Deny)
  const resolved = resolvePermission({ ...actor, role: effectiveRole }, action, { userOverrides });
  if (!resolved.allowed) {
    return authResult(false, 'PERMISSION_DENIED', resolved.reason || `Action '${action}' is not permitted.`, {
      scope: resolved.scope,
      source: resolved.source,
      company: requestedCompany,
    });
  }

  // 6. Record-Level Scope Enforcement (if a specific record is provided)
  if (resource && typeof resource === 'object') {
    const scopeCheck = checkRecordScope(actor, resolved.scope, resource, requestedCompany);
    if (!scopeCheck.allowed) {
      return authResult(false, scopeCheck.code, scopeCheck.message, {
        scope: resolved.scope,
        source: 'record_scope_clamp',
        company: requestedCompany,
      });
    }
  }

  return authResult(true, 'AUTHORIZED', 'Operation authorized.', {
    scope: resolved.scope,
    source: resolved.source,
    company: requestedCompany,
  });
}

/**
 * Asserts authorization and throws AuthorizationError if rejected.
 */
export async function assertAuthorized(actor, action, resource = null, context = {}) {
  const decision = await authorize(actor, action, resource, context);
  if (!decision.allowed) {
    if (context.correlationId) {
      await auditSecurityEvent({
        correlationId: context.correlationId,
        actorId: actor?.id || null,
        action: `authz.${action}`,
        resource: typeof resource === 'string' ? resource : (resource?.id || action),
        outcome: 'denied',
        metadata: { code: decision.code, reason: decision.reason, company: context.company },
      }).catch(() => null);
    }
    throw new AuthorizationError(403, decision.code, decision.message, decision);
  }
  return decision;
}

/**
 * Checks whether an authorized actor can access a specific record given their granted scope.
 * Scopes: 'own', 'assigned', 'department', 'all'
 */
export function checkRecordScope(actor, scope, record, companyContext) {
  // Check Company Match First
  const recordCompany = (record.company || record.source || '').toUpperCase();
  if (recordCompany && companyContext && companyContext !== 'ALL' && recordCompany !== companyContext) {
    return { allowed: false, code: 'RECORD_CROSS_COMPANY', message: 'Record belongs to a different company.' };
  }

  // Scope: 'all'
  if (scope === 'all') {
    return { allowed: true };
  }

  // Scope: 'department'
  if (scope === 'department') {
    if (actor.departmentId && record.departmentId && actor.departmentId !== record.departmentId) {
      return { allowed: false, code: 'RECORD_CROSS_DEPARTMENT', message: 'Record belongs to another department.' };
    }
    if (actor.treatmentCategoryId && record.categoryId && actor.treatmentCategoryId !== record.categoryId) {
      return { allowed: false, code: 'RECORD_CROSS_CATEGORY', message: 'Record does not match assigned treatment category.' };
    }
    return { allowed: true };
  }

  // Scope: 'assigned'
  if (scope === 'assigned') {
    const isAssigned = (
      (record.assignedTo && record.assignedTo === actor.id) ||
      (record.assignedCoordinatorId && record.assignedCoordinatorId === actor.id) ||
      (record.assignedDoctorId && record.assignedDoctorId === actor.id) ||
      (record.assignedNurseId && record.assignedNurseId === actor.id) ||
      (record.assignedOfficerId && record.assignedOfficerId === actor.id)
    );
    if (!isAssigned) {
      return { allowed: false, code: 'RECORD_NOT_ASSIGNED', message: 'This record is not assigned to you.' };
    }
    return { allowed: true };
  }

  // Scope: 'own'
  if (scope === 'own') {
    const isOwner = (
      (record.ownerId && record.ownerId === actor.id) ||
      (record.createdById && record.createdById === actor.id) ||
      (record.userId && record.userId === actor.id) ||
      (record.studentId && record.studentId === actor.id) ||
      (record.assignedTo && record.assignedTo === actor.id)
    );
    if (!isOwner) {
      return { allowed: false, code: 'RECORD_NOT_OWNED', message: 'You can only access records created by or owned by yourself.' };
    }
    return { allowed: true };
  }

  return { allowed: false, code: 'SCOPE_UNKNOWN', message: 'Invalid record access scope.' };
}

/**
 * Builds a secure Prisma WHERE clause for collection and aggregate queries.
 * Enforces company boundary and record-level scope automatically before querying.
 *
 * @param {Object} actor - Authenticated user
 * @param {string} capability - Capability key (e.g. 'crm.contact.view')
 * @param {string} company - Target company
 * @param {Object} baseWhere - Existing query filter
 * @returns {Promise<Object>} Safe Prisma where clause
 */
export async function buildSecureWhereClause(actor, capability, company = 'RWC', baseWhere = {}) {
  // Super Admin: unfiltered (except company filter if requested)
  if (actor.role === 'super_admin') {
    if (company && company !== 'ALL') {
      return { ...baseWhere, company };
    }
    return { ...baseWhere };
  }

  // Resolve permission & scope
  const decision = await authorize(actor, capability, null, { company });
  if (!decision.allowed) {
    // Return impossible condition to return empty collection safely (default deny)
    return { id: '__DENIED_BY_POLICY__' };
  }

  const where = { ...baseWhere };

  // 1. Enforce Company Boundary
  if (company && company !== 'ALL') {
    where.company = company;
  }

  // 2. Enforce Record Scope
  if (decision.scope === 'assigned') {
    where.assignedTo = actor.id;
  } else if (decision.scope === 'own') {
    where.OR = [
      { assignedTo: actor.id },
      { createdById: actor.id }
    ];
  } else if (decision.scope === 'department' && actor.treatmentCategoryId) {
    where.categoryId = actor.treatmentCategoryId;
  }

  return where;
}

