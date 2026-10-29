import {
  CAPABILITY_KEYS, MODULES, ROLES, SCOPES, PermissionError,
  editableRoleCapabilities, effectivePolicy, getCapability, narrowScope, roleCapabilities, roleLabel, roleMaxScope,
} from './securityPolicy.js';
import { auditSecurityEventInTransaction, parseAuditMetadata } from './securityAudit.js';

export const PROFILE_SUBJECTS = Object.freeze({ role: 'role', user: 'user' });

export const ROLE_DEPARTMENTS = Object.freeze({
  crm: ['leads_officer', 'sales_coordinator', 'coordinator'],
  exam: ['exam_department_manager', 'exam_coordinator', 'exam_providing_officer'],
  clinical: ['clinical_nurse', 'clinical_doctor', 'report_analyst'],
  marketing: ['marketing_officer', 'marketing_admin'],
  administration: ['super_admin'],
});

const DEPARTMENT_LABELS = Object.freeze({
  crm: 'CRM', exam: 'Exam Department', clinical: 'Clinical',
  marketing: 'Public Contact Marketing', administration: 'Administration',
});

const PROFILE_COLUMNS = 'overrides, scope, revision, updated_by, updated_at';

export function departmentForRole(role) {
  for (const [id, roles] of Object.entries(ROLE_DEPARTMENTS)) {
    if (roles.includes(role)) return id;
  }
  return 'administration';
}

export function departmentLabel(id) {
  return DEPARTMENT_LABELS[id] || null;
}

function normalizeProfileRow(row) {
  if (!row) return null;
  const overrides = typeof row.overrides === 'string' ? safeJson(row.overrides) : (row.overrides || {});
  return {
    overrides: overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? overrides : {},
    scope: row.scope || null,
    revision: Number(row.revision || 0),
    updatedBy: row.updated_by || null,
    updatedAt: row.updated_at || null,
  };
}

function safeJson(value) {
  try { return JSON.parse(value); } catch { return {}; }
}

export async function getProfile(prisma, subjectType, subjectId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${PROFILE_COLUMNS} FROM public.security_permission_profiles WHERE subject_type = $1 AND subject_id = $2`,
    subjectType, subjectId
  );
  return normalizeProfileRow(rows?.[0]);
}

/** Profiles for a page of users, keyed by user id. */
export async function getProfilesFor(prisma, subjectType, subjectIds) {
  if (!Array.isArray(subjectIds) || subjectIds.length === 0) return new Map();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT subject_id, ${PROFILE_COLUMNS} FROM public.security_permission_profiles WHERE subject_type = $1 AND subject_id = ANY($2::text[])`,
    subjectType, subjectIds
  );
  return new Map((rows || []).map(row => [row.subject_id, normalizeProfileRow(row)]));
}

export async function saveProfile(prisma, input) {
  const { subjectType, subjectId, overrides, scope, expectedRevision, actorId, correlationId } = input;
  const expected = Number.isInteger(expectedRevision) ? expectedRevision : 0;

  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRawUnsafe(`
      INSERT INTO public.security_permission_profiles (subject_type, subject_id, overrides, scope, revision, updated_by, updated_at)
      VALUES ($1, $2, $3::jsonb, $4, 1, $5, now())
      ON CONFLICT (subject_type, subject_id) DO UPDATE
        SET overrides = EXCLUDED.overrides,
            scope = EXCLUDED.scope,
            updated_by = EXCLUDED.updated_by,
            updated_at = now(),
            revision = public.security_permission_profiles.revision + 1
        WHERE public.security_permission_profiles.revision = $6
      RETURNING ${PROFILE_COLUMNS}
    `, subjectType, subjectId, JSON.stringify(overrides || {}), scope || null, actorId, expected);

    if (!rows?.length) {
      const current = await tx.$queryRawUnsafe(
        'SELECT revision FROM public.security_permission_profiles WHERE subject_type = $1 AND subject_id = $2',
        subjectType, subjectId
      );
      throw new PermissionError(
        409, 'REVISION_CONFLICT',
        `This policy changed while you were editing it. Reload and try again (current revision ${current?.[0]?.revision ?? 0}).`
      );
    }

    const saved = normalizeProfileRow(rows[0]);
    const moduleIds = [...new Set(Object.keys(overrides || {}).map(key => getCapability(key)?.module).filter(Boolean))];
    await auditSecurityEventInTransaction(tx, {
      correlationId,
      actorId,
      action: subjectType === 'role' ? 'permissions.role.update' : 'permissions.user.update',
      resource: `${subjectType}:${subjectId}`,
      outcome: 'succeeded',
      metadata: {
        subjectType,
        subjectId,
        module: moduleIds[0] || null,
        modules: moduleIds,
        reason: input.reason || null,
        scope: saved.scope,
        changes: input.changes || [],
        revision: saved.revision,
      },
    });
    return saved;
  }, { timeout: 15000 });
}

export async function resetProfile(prisma, input) {
  const { subjectType, subjectId, expectedRevision, actorId, correlationId, reason } = input;
  const expected = Number.isInteger(expectedRevision) ? expectedRevision : 0;

  return prisma.$transaction(async tx => {
    const current = await tx.$queryRawUnsafe(
      'SELECT revision FROM public.security_permission_profiles WHERE subject_type = $1 AND subject_id = $2 FOR UPDATE',
      subjectType, subjectId
    );
    const currentRevision = Number(current?.[0]?.revision || 0);
    if (!currentRevision) return { revision: 0, reset: true };
    if (currentRevision !== expected) {
      throw new PermissionError(409, 'REVISION_CONFLICT', `This policy changed while you were editing it. Reload and try again (current revision ${currentRevision}).`);
    }
    await tx.$executeRawUnsafe(
      'DELETE FROM public.security_permission_profiles WHERE subject_type = $1 AND subject_id = $2',
      subjectType, subjectId
    );
    await auditSecurityEventInTransaction(tx, {
      correlationId,
      actorId,
      action: subjectType === 'role' ? 'permissions.role.reset' : 'permissions.user.reset',
      resource: `${subjectType}:${subjectId}`,
      outcome: 'succeeded',
      metadata: { subjectType, subjectId, reason: reason || null, revision: 0 },
    });
    return { revision: 0, reset: true };
  }, { timeout: 15000 });
}

/** Role policy as the administration UI sees it (defaults + stored role overrides). */
export function describeRolePolicy(role, overrides = {}) {
  const editable = new Set(editableRoleCapabilities(role));
  const capabilities = {};
  for (const key of CAPABILITY_KEYS) {
    const meta = getCapability(key);
    const granted = roleCapabilities(role).includes(key);
    const override = overrides[key];
    const allowed = meta?.immutable ? granted : (override ? override.effect === 'allow' : granted);
    capabilities[key] = {
      capability: key,
      module: meta?.module || null,
      action: meta?.action || null,
      allowed,
      source: meta?.immutable ? 'immutable_policy' : override ? 'role_override' : 'role',
      immutable: Boolean(meta?.immutable),
      editable: editable.has(key),
      scope: allowed ? narrowScope(meta?.scope, roleMaxScope(role)) : null,
    };
  }
  return { role, label: roleLabel(role), maxScope: roleMaxScope(role), capabilities };
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    roleLabel: roleLabel(user.role),
    department: departmentForRole(user.role),
    departmentLabel: departmentLabel(departmentForRole(user.role)),
    company: user.company || null,
    branch: user.branch || null,
    active: user.active !== false,
    marketingAccess: Boolean(user.marketingAccess),
    createdAt: user.createdAt,
  };
}

export async function listUsers(prisma, params = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
  const search = String(params.search || '').trim().slice(0, 120);
  const role = String(params.role || '').trim();
  const department = String(params.department || '').trim();
  const status = String(params.status || '').trim();
  const custom = String(params.custom || '').trim();

  const where = {};
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (role && ROLES.includes(role)) where.role = role;
  if (department && ROLE_DEPARTMENTS[department]) where.role = { in: ROLE_DEPARTMENTS[department] };
  if (status === 'active') where.active = true;
  if (status === 'disabled') where.active = false;

  const customIds = await prisma.$queryRawUnsafe(
    `SELECT subject_id FROM public.security_permission_profiles
     WHERE subject_type = 'user' AND overrides <> '{}'::jsonb`
  );
  const customIdSet = new Set((customIds || []).map(row => row.subject_id));
  if (custom === 'custom') where.id = { in: [...customIdSet] };
  if (custom === 'default') where.id = { notIn: [...customIdSet] };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, fullName: true, email: true, role: true, company: true, branch: true,
        active: true, marketingAccess: true, createdAt: true,
      },
    }),
  ]);

  const profiles = await getProfilesFor(prisma, 'user', users.map(user => user.id));
  const items = users.map(user => {
    const profile = profiles.get(user.id);
    const overrideCount = Object.keys(profile?.overrides || {}).length;
    return {
      ...publicUser(user),
      customPermissions: Boolean(profile && (overrideCount > 0 || profile.scope)),
      overrideCount,
      scope: profile?.scope || roleMaxScope(user.role),
      revision: profile?.revision || 0,
    };
  });

  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getUser(prisma, id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, fullName: true, email: true, role: true, company: true, branch: true,
      active: true, marketingAccess: true, createdAt: true,
    },
  });
  return user ? publicUser(user) : null;
}

/** Effective policy for one user, including the stored overrides and their sources. */
export async function describeUserPolicy(prisma, user, profile) {
  const roleProfile = await getProfile(prisma, 'role', user.role);
  return {
    user,
    role: user.role,
    roleLabel: roleLabel(user.role),
    maxScope: roleMaxScope(user.role),
    scope: profile?.scope || roleMaxScope(user.role),
    revision: profile?.revision || 0,
    overrides: profile?.overrides || {},
    policy: effectivePolicy(user, {
      roleOverrides: roleProfile?.overrides || {},
      userOverrides: profile?.overrides || {},
      scope: profile?.scope || undefined,
    }),
  };
}

function mapAuditRow(row) {
  const metadata = parseAuditMetadata(row.metadata);
  return {
    id: row.id,
    correlationId: row.correlation_id,
    actorId: row.actor_id,
    actorName: row.actor_name || row.actor_id || 'System',
    action: row.action,
    resource: row.resource,
    outcome: row.outcome,
    module: metadata.module || null,
    modules: metadata.modules || null,
    subjectType: metadata.subjectType || null,
    subjectId: metadata.subjectId || null,
    reason: metadata.reason || null,
    scope: metadata.scope ?? null,
    changes: Array.isArray(metadata.changes) ? metadata.changes : [],
    revision: metadata.revision ?? null,
    createdAt: row.created_at,
  };
}

export async function listAuditEvents(prisma, params = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25));
  const filters = [];
  const values = [];
  const add = (sql, value) => { values.push(value); filters.push(sql.replace('?', `$${values.length}`)); };

  if (params.actorId) add('e.actor_id = ?', String(params.actorId).slice(0, 100));
  if (params.outcome) add('e.outcome = ?', String(params.outcome).slice(0, 40));
  if (params.action) add('e.action LIKE ?', `${String(params.action).slice(0, 80)}%`);
  if (params.module) add('e.metadata LIKE ?', `%"module":"${String(params.module).slice(0, 40)}"%`);
  if (params.search) {
    const term = `%${String(params.search).slice(0, 80)}%`;
    values.push(term, term, term);
    filters.push(`(e.resource ILIKE $${values.length - 2} OR e.action ILIKE $${values.length - 1} OR u."fullName" ILIKE $${values.length})`);
  }
  if (params.from) add('e.created_at >= ?::timestamptz', String(params.from));
  if (params.to) add('e.created_at <= ?::timestamptz', String(params.to));

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const joins = 'FROM public.security_audit_events e LEFT JOIN public.users u ON u.id = e.actor_id';

  const countRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count ${joins} ${where}`, ...values);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT e.id, e.correlation_id, e.actor_id, u."fullName" AS actor_name, e.action, e.resource, e.outcome, e.metadata, e.created_at
     ${joins} ${where} ORDER BY e.created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    ...values
  );

  return {
    items: (rows || []).map(mapAuditRow),
    total: Number(countRows?.[0]?.count || 0),
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(Number(countRows?.[0]?.count || 0) / pageSize)),
  };
}

export async function securityOverview(prisma) {
  const [activeUsers, customUsers, highPrivilege, recent, roleProfiles] = await Promise.all([
    prisma.user.count({ where: { active: true } }),
    prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM public.security_permission_profiles WHERE subject_type = 'user' AND overrides <> '{}'::jsonb`),
    prisma.user.findMany({
      where: { active: true, role: { in: ['super_admin', 'exam_department_manager', 'clinical_doctor'] } },
      orderBy: { fullName: 'asc' },
      take: 6,
      select: { id: true, fullName: true, role: true },
    }),
    listAuditEvents(prisma, { page: 1, pageSize: 8 }),
    prisma.$queryRawUnsafe(`SELECT subject_id, overrides FROM public.security_permission_profiles WHERE subject_type = 'role'`),
  ]);

  const roleOverrideMap = new Map((roleProfiles || []).map(row => [row.subject_id, typeof row.overrides === 'string' ? safeJson(row.overrides) : row.overrides || {}]));

  const distribution = MODULES.map(module => {
    const capabilities = CAPABILITY_KEYS.filter(key => getCapability(key)?.module === module.id);
    const roles = ROLES.filter(role => roleCapabilities(role).some(key => capabilities.includes(key)));
    return {
      module: module.id,
      label: module.label,
      roles: roles.length,
      capabilities: capabilities.length,
      roleList: roles.map(role => ({ role, label: roleLabel(role) })),
      customized: roles.filter(role => Object.keys(roleOverrideMap.get(role) || {}).length > 0).length,
    };
  });

  return {
    counters: {
      activeUsers,
      roles: ROLES.length,
      customUsers: Number(customUsers?.[0]?.count || 0),
      protectedModules: MODULES.length,
    },
    highPrivilegeUsers: highPrivilege.map(user => ({
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      roleLabel: roleLabel(user.role),
    })),
    recentActivity: recent.items,
    distribution,
  };
}

export async function rolePolicyDetails(prisma, role) {
  const profile = await getProfile(prisma, 'role', role);
  return { profile, policy: describeRolePolicy(role, profile?.overrides || {}) };
}

export { SCOPES };
