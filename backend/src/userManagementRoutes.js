// User Management administration API.
//
// Every route is Super-Admin-only and audited. The module intentionally writes
// through the existing `users`, `leads`, `marketing_contacts`, and audit tables;
// it never creates a second identity model. Additive tables (departments, teams,
// invitations, sessions) are created by schemaBootstrap / the matching migration.
import crypto from 'crypto';
import { getPrisma, getDbStatus } from './db.js';
import { PermissionError, ROLES, roleLabel } from './securityPolicy.js';
import { auditSecurityEvent } from './securityAudit.js';
import { listAuditEvents } from './securityStore.js';
import { hashSecret, encryptReversible, decryptReversible } from './secretHash.js';
import { COMPANIES, resolveLeadCompany } from './companyConfig.js';

const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};
const ok = (res, data) => json(res, 200, { success: true, data });

async function readJson(req, limit = 30000) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > limit) throw new PermissionError(413, 'BODY_TOO_LARGE', 'Request body is too large.');
  }
  try {
    const value = JSON.parse(text || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new PermissionError(400, 'INVALID_JSON', 'A JSON object is required.');
  }
}

function queryOf(req) {
  try { return new URL(req.url, 'http://localhost').searchParams; } catch { return new URLSearchParams(); }
}

const ASSIGNABLE_ROLES = Object.freeze([
  'super_admin', 'leads_officer', 'coordinator', 'sales_coordinator',
  'exam_department_manager', 'exam_coordinator', 'exam_providing_officer',
  'marketing_officer', 'marketing_admin', 'clinical_nurse', 'clinical_doctor', 'report_analyst',
]);

function text(value, max = 255) {
  return String(value ?? '').trim().slice(0, max);
}
function requireText(value, label, max = 255) {
  const result = text(value, max);
  if (!result) throw new PermissionError(400, 'MISSING_FIELD', `${label} is required.`);
  return result;
}
function requireRole(value) {
  const role = text(value, 50);
  if (!ASSIGNABLE_ROLES.includes(role)) throw new PermissionError(400, 'INVALID_ROLE', 'Unknown role.');
  return role;
}
function requireEmail(value) {
  const email = text(value, 255).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PermissionError(400, 'INVALID_EMAIL', 'A valid email address is required.');
  return email;
}
function requireCompany(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const code = text(value, 50).toUpperCase();
  if (!COMPANIES[code]) throw new PermissionError(400, 'INVALID_COMPANY', 'Unknown company.');
  return code;
}
function optionalId(value) {
  if (value === undefined || value === null || value === '') return null;
  const id = text(value, 36);
  if (!/^[a-zA-Z0-9_-]{1,36}$/.test(id)) throw new PermissionError(400, 'INVALID_ID', 'Invalid identifier.');
  return id;
}
function pageParams(query) {
  return {
    page: Math.max(1, Number(query.get('page')) || 1),
    pageSize: Math.min(100, Math.max(1, Number(query.get('pageSize')) || 20)),
  };
}
function dateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function audit(user, correlationId, action, resource, outcome, metadata = {}) {
  await auditSecurityEvent({ correlationId, actorId: user?.id, action, resource, outcome, metadata });
}

function publicUserRow(row) {
  if (!row) return null;
  const locked = row.lockedUntil && new Date(row.lockedUntil).getTime() > Date.now();
  const status = !row.active ? (row.suspendedAt ? 'suspended' : 'inactive') : locked ? 'locked' : row.invitationId ? 'invited' : 'active';
  return {
    ...row,
    roleLabel: roleLabel(row.role),
    status,
    locked: Boolean(locked),
  };
}

const USER_SELECT = `
  SELECT u.id, u."fullName", u.email, u.phone, u.role, u.company, u.branch, u.active,
         u."createdAt", u.marketing_access AS "marketingAccess",
         u.employee_id AS "employeeId", u.department_id AS "departmentId",
         u.manager_id AS "managerId", u.last_login_at AS "lastLoginAt",
         u.suspended_at AS "suspendedAt", u.locked_until AS "lockedUntil",
         d.name AS "departmentName",
         inv.id AS "invitationId", inv.expires_at AS "invitationExpiresAt",
         (SELECT COUNT(*)::int FROM public.user_sessions s
           WHERE s.user_id = u.id AND s.revoked_at IS NULL) AS "activeSessions",
         (SELECT COUNT(*)::int FROM public.leads l WHERE l."assignedTo" = u.id) AS "leadCount",
         (SELECT COUNT(*)::int FROM public.marketing_contacts mc
           WHERE mc.current_owner_id = u.id) AS "marketingCount"
    FROM public.users u
    LEFT JOIN public.departments d ON d.id = u.department_id
    LEFT JOIN LATERAL (
      SELECT i.id, i.expires_at FROM public.user_invitations i
       WHERE LOWER(i.email) = LOWER(u.email) AND i.accepted_at IS NULL AND i.revoked_at IS NULL
       ORDER BY i.created_at DESC LIMIT 1
    ) inv ON TRUE`;

const SORTS = Object.freeze({
  createdAt: 'u."createdAt"', name: 'u."fullName"', email: 'u.email',
  lastLogin: 'u.last_login_at', role: 'u.role', branch: 'u.branch',
});

function buildUserFilters(query) {
  const conditions = [];
  const values = [];
  const add = (sql, value) => { values.push(value); conditions.push(sql.replace(/\?/g, `$${values.length}`)); };

  const search = text(query.get('search'), 120);
  if (search) {
    values.push(`%${search}%`);
    const n = `$${values.length}`;
    conditions.push(`(u."fullName" ILIKE ${n} OR u.email ILIKE ${n} OR COALESCE(u.phone,'') ILIKE ${n} OR COALESCE(u.employee_id,'') ILIKE ${n})`);
  }
  const role = text(query.get('role'), 50);
  if (role && ASSIGNABLE_ROLES.includes(role)) add('u.role = ?::"UserRole"', role);
  const company = text(query.get('company'), 50).toUpperCase();
  if (company && COMPANIES[company]) add('u.company = ?', company);
  const branch = text(query.get('branch'), 100);
  if (branch) add('u.branch = ?', branch);
  const department = text(query.get('department'), 36);
  if (department) add('u.department_id = ?', department);

  const status = text(query.get('status'), 20);
  if (status === 'active') {
    conditions.push(`u.active = TRUE AND u.suspended_at IS NULL
      AND (u.locked_until IS NULL OR u.locked_until <= NOW())
      AND NOT EXISTS (SELECT 1 FROM public.user_invitations i WHERE LOWER(i.email) = LOWER(u.email)
        AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > NOW())`);
  } else if (status === 'inactive') {
    conditions.push('u.active = FALSE AND u.suspended_at IS NULL');
  } else if (status === 'suspended') {
    conditions.push('u.suspended_at IS NOT NULL');
  } else if (status === 'locked') {
    conditions.push('u.locked_until IS NOT NULL AND u.locked_until > NOW()');
  } else if (status === 'invited') {
    conditions.push(`EXISTS (SELECT 1 FROM public.user_invitations i WHERE LOWER(i.email) = LOWER(u.email)
      AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > NOW())`);
  }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', values };
}

async function queryUsers(prisma, query, { limit } = {}) {
  const { page, pageSize } = pageParams(query);
  const { where, values } = buildUserFilters(query);
  const sortKey = SORTS[text(query.get('sort'), 30)] || SORTS.createdAt;
  const direction = text(query.get('order'), 4).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const take = limit || pageSize;
  const offset = limit ? 0 : (page - 1) * pageSize;

  const countRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM public.users u ${where}`, ...values);
  const total = Number(countRows?.[0]?.count || 0);
  const rows = await prisma.$queryRawUnsafe(
    `${USER_SELECT} ${where} ORDER BY ${sortKey} ${direction} NULLS LAST, u.id ASC LIMIT ${take} OFFSET ${offset}`,
    ...values
  );
  return {
    items: (rows || []).map(publicUserRow),
    total,
    page,
    pageSize: take,
    pages: Math.max(1, Math.ceil(total / take)),
  };
}

async function getUserRow(prisma, id) {
  const rows = await prisma.$queryRawUnsafe(`${USER_SELECT} WHERE u.id = $1 LIMIT 1`, id);
  return publicUserRow(rows?.[0]);
}

async function assertDepartmentCompany(prisma, departmentId, company) {
  if (!departmentId) return null;
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, name, company, branch, active FROM public.departments WHERE id = $1 LIMIT 1',
    departmentId
  );
  const department = rows?.[0];
  if (!department) throw new PermissionError(400, 'UNKNOWN_DEPARTMENT', 'Department not found.');
  if (!department.active) throw new PermissionError(400, 'INACTIVE_DEPARTMENT', 'That department is inactive.');
  if (department.company && company && department.company !== company) {
    throw new PermissionError(400, 'DEPARTMENT_COMPANY_MISMATCH', 'The department belongs to a different company.');
  }
  return department;
}

async function countActiveSuperAdmins(prisma, excludeId = null) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM public.users WHERE role = 'super_admin'::"UserRole" AND active = TRUE AND ($1::text IS NULL OR id <> $1)`,
    excludeId
  );
  return Number(rows?.[0]?.count || 0);
}

async function revokeUserSessions(prisma, userId, actorId, reason) {
  await prisma.$executeRawUnsafe(
    'UPDATE public.users SET session_version = session_version + 1 WHERE id = $1',
    userId
  );
  const result = await prisma.$executeRawUnsafe(
    `UPDATE public.user_sessions
        SET revoked_at = NOW(), revoked_by = $2, revoke_reason = $3
      WHERE user_id = $1 AND revoked_at IS NULL`,
    userId, actorId, reason.slice(0, 255)
  );
  return Number(result || 0);
}

function inviteUrlFor(req, token) {
  const configured = String(process.env.FRONTEND_URL || '').split(',')[0].trim();
  const origin = configured || (req.headers.origin && String(req.headers.origin).trim()) || 'http://localhost:5173';
  return `${origin.replace(/\/$/, '')}/#/accept-invitation?token=${encodeURIComponent(token)}`;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  let cell = String(value);
  // Prevent spreadsheet formula injection from free-text fields.
  if (/^[=+\-@]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
}

export async function handleUserManagementRoutes(req, res, pathname, user, correlationId) {
  if (!pathname.startsWith('/api/user-management')) return false;

  if (!user?.id || user.active === false || user.role !== 'super_admin') {
    await audit(user, correlationId, 'user_management.access', pathname, 'denied');
    json(res, 403, { success: false, error: 'Super Admin access is required.' });
    return true;
  }
  if (req.method === 'OPTIONS') { json(res, 204, {}); return true; }

  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) {
    json(res, 503, { success: false, error: 'User management requires database storage.' });
    return true;
  }

  try {
    const query = queryOf(req);

    // ---------------------------------------------------------------- overview
    if (pathname === '/api/user-management/overview' && req.method === 'GET') {
      const [counts, byRole, byBranch, recent, invites, attention, recentActivity] = await Promise.all([
        prisma.$queryRawUnsafe(`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE active = TRUE)::int AS active,
            COUNT(*) FILTER (WHERE active = FALSE AND suspended_at IS NULL)::int AS inactive,
            COUNT(*) FILTER (WHERE suspended_at IS NOT NULL)::int AS suspended,
            COUNT(*) FILTER (WHERE locked_until IS NOT NULL AND locked_until > NOW())::int AS locked,
            COUNT(*) FILTER (WHERE role = 'super_admin'::"UserRole" AND active = TRUE)::int AS admins,
            COUNT(*) FILTER (WHERE role = 'coordinator'::"UserRole" AND active = TRUE)::int AS coordinators,
            COUNT(*) FILTER (WHERE role <> 'super_admin'::"UserRole" AND active = TRUE)::int AS staff
          FROM public.users`),
        prisma.$queryRawUnsafe(`SELECT role, COUNT(*)::int AS count FROM public.users GROUP BY role ORDER BY count DESC`),
        prisma.$queryRawUnsafe(`SELECT COALESCE(NULLIF(branch,''), 'Unassigned') AS branch, COUNT(*)::int AS count FROM public.users GROUP BY 1 ORDER BY count DESC`),
        prisma.$queryRawUnsafe(`${USER_SELECT} ORDER BY u."createdAt" DESC LIMIT 6`),
        prisma.$queryRawUnsafe(`
          SELECT i.id, i.email, i.full_name AS "fullName", i.role, i.company, i.branch,
                 i.expires_at AS "expiresAt", i.created_at AS "createdAt", u."fullName" AS "invitedByName"
            FROM public.user_invitations i LEFT JOIN public.users u ON u.id = i.invited_by
           WHERE i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > NOW()
           ORDER BY i.created_at DESC LIMIT 6`),
        prisma.$queryRawUnsafe(`
          SELECT u.id, u."fullName", u.email, u.role, u.active, u.suspended_at AS "suspendedAt",
                 u.locked_until AS "lockedUntil", u.last_login_at AS "lastLoginAt"
            FROM public.users u
           WHERE u.suspended_at IS NOT NULL OR (u.locked_until IS NOT NULL AND u.locked_until > NOW())
           ORDER BY u."updatedAt" DESC LIMIT 8`),
        listAuditEvents(prisma, { page: 1, pageSize: 8 }),
      ]);
      const inviteCount = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS count FROM public.user_invitations
          WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()`
      );
      const c = counts?.[0] || {};
      ok(res, {
        counters: {
          total: c.total || 0, active: c.active || 0, inactive: c.inactive || 0,
          pendingInvitations: Number(inviteCount?.[0]?.count || 0),
          locked: c.locked || 0, suspended: c.suspended || 0,
          administrators: c.admins || 0, coordinators: c.coordinators || 0, staff: c.staff || 0,
        },
        distribution: {
          roles: (byRole || []).map(row => ({ role: row.role, label: roleLabel(row.role), count: row.count })),
          branches: (byBranch || []).map(row => ({ branch: row.branch, count: row.count })),
        },
        recentUsers: (recent || []).map(publicUserRow),
        pendingInvitations: invites || [],
        attention: attention || [],
        recentActivity: recentActivity.items,
      });
      return true;
    }

    // ---------------------------------------------------------------- directory
    if (pathname === '/api/user-management/users' && req.method === 'GET') {
      ok(res, await queryUsers(prisma, query));
      return true;
    }

    if (pathname === '/api/user-management/users/export.csv' && req.method === 'GET') {
      const result = await queryUsers(prisma, query, { limit: 5000 });
      const header = ['User', 'Email', 'Employee ID', 'Role', 'Department', 'Company', 'Branch', 'Status', 'Last Login', 'Created'];
      const lines = [header.map(csvCell).join(',')];
      for (const item of result.items) {
        lines.push([
          item.fullName, item.email, item.employeeId, item.roleLabel, item.departmentName,
          item.company, item.branch, item.status, item.lastLoginAt, item.createdAt,
        ].map(csvCell).join(','));
      }
      await audit(user, correlationId, 'security.export', 'user_management.users', 'success', { rows: result.items.length });
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="user-directory-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      });
      res.end(lines.join('\r\n'));
      return true;
    }

    if (pathname === '/api/user-management/users' && req.method === 'POST') {
      const input = await readJson(req);
      const fullName = requireText(input.fullName, 'Full name');
      const email = requireEmail(input.email);
      const role = requireRole(input.role || 'coordinator');
      const password = String(input.password || '');
      if (password.length < 12) throw new PermissionError(400, 'WEAK_PASSWORD', 'Password must be at least 12 characters.');
      const pin = input.pin === undefined || input.pin === null || input.pin === '' ? '' : String(input.pin).trim();
      if (pin && (pin.length < 4 || pin.length > 10)) throw new PermissionError(400, 'INVALID_PIN', 'PIN must be 4-10 characters.');
      const branch = text(input.branch, 100) || 'Colombo';
      const company = requireCompany(input.company, role === 'super_admin' ? 'RWC' : 'RWC');
      const employeeId = text(input.employeeId, 50) || null;
      const departmentId = optionalId(input.departmentId);
      const managerId = optionalId(input.managerId);
      const department = await assertDepartmentCompany(prisma, departmentId, company);
      if (managerId) {
        const manager = await prisma.user.findUnique({ where: { id: managerId }, select: { id: true, active: true } });
        if (!manager || !manager.active) throw new PermissionError(400, 'INVALID_MANAGER', 'Reporting manager not found.');
      }
      const duplicate = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (duplicate) throw new PermissionError(409, 'EMAIL_IN_USE', 'An account already uses this email address.');
      if (employeeId) {
        const employee = await prisma.$queryRawUnsafe('SELECT id FROM public.users WHERE employee_id = $1 LIMIT 1', employeeId);
        if (employee?.length) throw new PermissionError(409, 'EMPLOYEE_ID_IN_USE', 'That employee ID is already assigned.');
      }

      const created = await prisma.user.create({
        data: {
          fullName, email, role, company, branch,
          phone: text(input.phone, 50) || null,
          password: encryptReversible(password),
          ...(pin ? { pin: encryptReversible(pin) } : {}),
          active: input.active !== false,
          marketingAccess: input.marketingAccess === true,
        },
      });
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE public.users
              SET employee_id = $2, department_id = $3, manager_id = $4
            WHERE id = $1`,
          created.id, employeeId, departmentId, managerId
        );
      } catch (error) {
        // Keep the identity consistent if the additive columns are not deployed yet.
        if (!/employee_id|department_id|manager_id|does not exist/i.test(error.message)) throw error;
      }
      await audit(user, correlationId, 'user.create', `user:${created.id}`, 'success', {
        role, company, branch, department: department?.name || null, invitation: false,
      });
      json(res, 201, { success: true, data: await getUserRow(prisma, created.id) });
      return true;
    }

    // ------------------------------------------------------------- invitations
    if (pathname === '/api/user-management/invitations' && req.method === 'GET') {
      const { page, pageSize } = pageParams(query);
      const status = text(query.get('status'), 20) || 'pending';
      const search = text(query.get('search'), 120);
      const conditions = [];
      const values = [];
      if (status === 'pending') conditions.push('i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > NOW()');
      if (status === 'expired') conditions.push('i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at <= NOW()');
      if (status === 'accepted') conditions.push('i.accepted_at IS NOT NULL');
      if (status === 'revoked') conditions.push('i.revoked_at IS NOT NULL');
      if (search) {
        values.push(`%${search}%`);
        conditions.push(`(i.email ILIKE $${values.length} OR i.full_name ILIKE $${values.length})`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM public.user_invitations i ${where}`, ...values);
      const rows = await prisma.$queryRawUnsafe(`
        SELECT i.id, i.email, i.full_name AS "fullName", i.role, i.company, i.branch,
               i.department_id AS "departmentId", d.name AS "departmentName",
               i.expires_at AS "expiresAt", i.accepted_at AS "acceptedAt", i.revoked_at AS "revokedAt",
               i.created_at AS "createdAt", u."fullName" AS "invitedByName"
          FROM public.user_invitations i
          LEFT JOIN public.users u ON u.id = i.invited_by
          LEFT JOIN public.departments d ON d.id = i.department_id
          ${where}
         ORDER BY i.created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, ...values);
      const items = (rows || []).map(row => ({
        ...row,
        roleLabel: roleLabel(row.role),
        status: row.acceptedAt ? 'accepted' : row.revokedAt ? 'revoked' : new Date(row.expiresAt) < new Date() ? 'expired' : 'pending',
      }));
      ok(res, { items, total: Number(count?.[0]?.count || 0), page, pageSize, pages: Math.max(1, Math.ceil(Number(count?.[0]?.count || 0) / pageSize)) });
      return true;
    }

    if (pathname === '/api/user-management/invitations' && req.method === 'POST') {
      const input = await readJson(req);
      const email = requireEmail(input.email);
      const fullName = requireText(input.fullName, 'Full name');
      const role = requireRole(input.role || 'coordinator');
      const company = requireCompany(input.company, 'RWC');
      const branch = text(input.branch, 100) || 'Colombo';
      const departmentId = optionalId(input.departmentId);
      await assertDepartmentCompany(prisma, departmentId, company);
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) throw new PermissionError(409, 'USER_EXISTS', 'An account already exists for this email. Edit that account instead.');

      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const id = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `UPDATE public.user_invitations SET revoked_at = NOW()
          WHERE LOWER(email) = LOWER($1) AND accepted_at IS NULL AND revoked_at IS NULL`,
        email
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.user_invitations
           (id, email, full_name, role, company, branch, department_id, token_hash, invited_by, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW() + INTERVAL '7 days')`,
        id, email, fullName, role, company, branch, departmentId, tokenHash, user.id
      );
      const invite = { id, email, fullName, role, company, branch, departmentId, expiresAt: null };
      await audit(user, correlationId, 'user.invitation.create', `invitation:${id}`, 'success', { email, role, company });
      json(res, 201, { success: true, data: { ...invite, inviteUrl: inviteUrlFor(req, token) } });
      return true;
    }

    const resendMatch = pathname.match(/^\/api\/user-management\/invitations\/([a-zA-Z0-9-]{1,36})\/resend$/);
    if (resendMatch && req.method === 'POST') {
      const id = resendMatch[1];
      const rows = await prisma.$queryRawUnsafe(
        'SELECT id, email, accepted_at, revoked_at FROM public.user_invitations WHERE id = $1 LIMIT 1', id
      );
      const invite = rows?.[0];
      if (!invite) throw new PermissionError(404, 'UNKNOWN_INVITATION', 'Invitation not found.');
      if (invite.accepted_at) throw new PermissionError(409, 'INVITATION_ACCEPTED', 'This invitation was already accepted.');
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await prisma.$executeRawUnsafe(
        `UPDATE public.user_invitations
            SET token_hash = $2, expires_at = NOW() + INTERVAL '7 days', revoked_at = NULL
          WHERE id = $1`, id, tokenHash
      );
      await audit(user, correlationId, 'user.invitation.resend', `invitation:${id}`, 'success', { email: invite.email });
      ok(res, { id, inviteUrl: inviteUrlFor(req, token) });
      return true;
    }

    const invitationMatch = pathname.match(/^\/api\/user-management\/invitations\/([a-zA-Z0-9-]{1,36})$/);
    if (invitationMatch && req.method === 'DELETE') {
      const id = invitationMatch[1];
      const result = await prisma.$executeRawUnsafe(
        `UPDATE public.user_invitations SET revoked_at = NOW()
          WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL`, id
      );
      if (!Number(result || 0)) throw new PermissionError(404, 'UNKNOWN_INVITATION', 'Pending invitation not found.');
      await audit(user, correlationId, 'user.invitation.revoke', `invitation:${id}`, 'success');
      ok(res, { id, revoked: true });
      return true;
    }

    // ------------------------------------------------------- departments/teams
    if (pathname === '/api/user-management/departments' && req.method === 'GET') {
      const departments = await prisma.$queryRawUnsafe(`
        SELECT d.id, d.name, d.company, d.branch, d.description, d.active,
               d.created_at AS "createdAt", d.updated_at AS "updatedAt",
               (SELECT COUNT(*)::int FROM public.users u WHERE u.department_id = d.id) AS "userCount"
          FROM public.departments d ORDER BY d.active DESC, d.name ASC`);
      const teams = await prisma.$queryRawUnsafe(`
        SELECT t.id, t.department_id AS "departmentId", t.name, t.company, t.branch,
               t.lead_user_id AS "leadUserId", u."fullName" AS "leadName", t.active,
               t.created_at AS "createdAt",
               (SELECT COUNT(*)::int FROM public.team_members m WHERE m.team_id = t.id) AS "memberCount"
          FROM public.teams t LEFT JOIN public.users u ON u.id = t.lead_user_id
         ORDER BY t.active DESC, t.name ASC`);
      const members = await prisma.$queryRawUnsafe(`
        SELECT m.team_id AS "teamId", m.user_id AS "userId", u."fullName", u.email, u.role
          FROM public.team_members m JOIN public.users u ON u.id = m.user_id
         ORDER BY u."fullName" ASC`);
      ok(res, { departments: departments || [], teams: teams || [], members: members || [] });
      return true;
    }

    if (pathname === '/api/user-management/departments' && req.method === 'POST') {
      const input = await readJson(req);
      const id = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.departments (id, name, company, branch, description)
         VALUES ($1,$2,$3,$4,$5)`,
        id, requireText(input.name, 'Department name', 120), requireCompany(input.company, null),
        text(input.branch, 100) || null, text(input.description, 1000) || null
      );
      await audit(user, correlationId, 'department.create', `department:${id}`, 'success', { name: text(input.name, 120) });
      ok(res, { id });
      return true;
    }

    const departmentMatch = pathname.match(/^\/api\/user-management\/departments\/([a-zA-Z0-9-]{1,36})$/);
    if (departmentMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
      const id = departmentMatch[1];
      const input = await readJson(req);
      const fields = [];
      const values = [];
      const push = (column, value) => { values.push(value); fields.push(`${column} = $${values.length + 1}`); };
      if (input.name !== undefined) push('name', requireText(input.name, 'Department name', 120));
      if (input.company !== undefined) push('company', requireCompany(input.company, null));
      if (input.branch !== undefined) push('branch', text(input.branch, 100) || null);
      if (input.description !== undefined) push('description', text(input.description, 1000) || null);
      if (input.active !== undefined) push('active', input.active === true);
      if (!fields.length) throw new PermissionError(400, 'NO_CHANGES', 'No department fields were provided.');
      await prisma.$executeRawUnsafe(
        `UPDATE public.departments SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1`, id, ...values
      );
      await audit(user, correlationId, 'department.update', `department:${id}`, 'success', { changes: Object.keys(input) });
      ok(res, { id, updated: true });
      return true;
    }

    if (pathname === '/api/user-management/teams' && req.method === 'POST') {
      const input = await readJson(req);
      const id = crypto.randomUUID();
      const departmentId = optionalId(input.departmentId);
      if (!departmentId) throw new PermissionError(400, 'MISSING_FIELD', 'A department is required.');
      const department = await assertDepartmentCompany(prisma, departmentId, requireCompany(input.company, null));
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.teams (id, department_id, name, company, branch, lead_user_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        id, departmentId, requireText(input.name, 'Team name', 120),
        requireCompany(input.company, department.company || null), text(input.branch, 100) || department.branch || null,
        optionalId(input.leadUserId)
      );
      await audit(user, correlationId, 'team.create', `team:${id}`, 'success', { departmentId });
      ok(res, { id });
      return true;
    }

    const memberMatch = pathname.match(/^\/api\/user-management\/teams\/([a-zA-Z0-9-]{1,36})\/members$/);
    if (memberMatch && req.method === 'PUT') {
      const teamId = memberMatch[1];
      const input = await readJson(req);
      const ids = Array.isArray(input.userIds) ? [...new Set(input.userIds.map(optionalId).filter(Boolean))] : [];
      const teams = await prisma.$queryRawUnsafe('SELECT id, company FROM public.teams WHERE id = $1 LIMIT 1', teamId);
      const team = teams?.[0];
      if (!team) throw new PermissionError(404, 'UNKNOWN_TEAM', 'Team not found.');
      if (ids.length) {
        const users = await prisma.$queryRawUnsafe(
          'SELECT id, company FROM public.users WHERE id = ANY($1::text[]) AND active = TRUE', ids
        );
        if ((users || []).length !== ids.length) throw new PermissionError(400, 'UNKNOWN_USER', 'One or more team members were not found.');
        if (team.company && users.some(row => row.company && row.company !== team.company)) {
          throw new PermissionError(403, 'CROSS_TENANT_TEAM', 'Team members must belong to the same company as the team.');
        }
      }
      await prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe('DELETE FROM public.team_members WHERE team_id = $1', teamId);
        for (const userId of ids) {
          await tx.$executeRawUnsafe('INSERT INTO public.team_members (team_id, user_id) VALUES ($1,$2)', teamId, userId);
        }
      });
      await audit(user, correlationId, 'team.members.update', `team:${teamId}`, 'success', { members: ids.length });
      ok(res, { teamId, members: ids.length });
      return true;
    }

    const teamMatch = pathname.match(/^\/api\/user-management\/teams\/([a-zA-Z0-9-]{1,36})$/);
    if (teamMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
      const id = teamMatch[1];
      const input = await readJson(req);
      const fields = [];
      const values = [];
      const push = (column, value) => { values.push(value); fields.push(`${column} = $${values.length + 1}`); };
      if (input.name !== undefined) push('name', requireText(input.name, 'Team name', 120));
      if (input.departmentId !== undefined) push('department_id', optionalId(input.departmentId));
      if (input.branch !== undefined) push('branch', text(input.branch, 100) || null);
      if (input.leadUserId !== undefined) push('lead_user_id', optionalId(input.leadUserId));
      if (input.active !== undefined) push('active', input.active === true);
      if (!fields.length) throw new PermissionError(400, 'NO_CHANGES', 'No team fields were provided.');
      await prisma.$executeRawUnsafe(
        `UPDATE public.teams SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1`, id, ...values
      );
      await audit(user, correlationId, 'team.update', `team:${id}`, 'success', { changes: Object.keys(input) });
      ok(res, { id, updated: true });
      return true;
    }

    // -------------------------------------------------------------- assignments
    if (pathname === '/api/user-management/assignments' && req.method === 'GET') {
      const type = text(query.get('type'), 20) || 'all';
      const ownerId = text(query.get('ownerId'), 36);
      const search = text(query.get('search'), 120);
      const company = text(query.get('company'), 50).toUpperCase();
      const page = Math.max(1, Number(query.get('page')) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(query.get('pageSize')) || 25));

      const items = [];
      if (type === 'all' || type === 'lead') {
        const params = [];
        const conds = [`l."assignedTo" IS NOT NULL`];
        if (ownerId) { params.push(ownerId); conds.push(`l."assignedTo" = $${params.length}`); }
        if (company && COMPANIES[company]) { params.push(company); conds.push(`COALESCE(l.company,'RWC') = $${params.length}`); }
        if (search) { params.push(`%${search}%`); conds.push(`(COALESCE(l."serialNumber", l.id) ILIKE $${params.length} OR c."displayName" ILIKE $${params.length} OR COALESCE(c."whatsappNumber",'') ILIKE $${params.length})`); }
        const rows = await prisma.$queryRawUnsafe(`
          SELECT 'lead' AS type, l.id, COALESCE(l."serialNumber", l.id) AS reference,
                 COALESCE(l.company,'RWC') AS company, l.stage::text AS status,
                 l."assignedTo" AS "ownerId", u."fullName" AS "ownerName",
                 l."assignedAt" AS "assignedAt", l."assignedByName" AS "assignedByName",
                 l."updatedAt" AS "lastReassignedAt", c."displayName" AS "resourceName"
            FROM public.leads l
            LEFT JOIN public.users u ON u.id = l."assignedTo"
            LEFT JOIN public.customers c ON c.id = l."customerId"
           WHERE ${conds.join(' AND ')}
           ORDER BY l."assignedAt" DESC NULLS LAST LIMIT 500`, ...params);
        items.push(...(rows || []));
      }
      if (type === 'all' || type === 'marketing') {
        const params = [];
        const conds = ['mc.current_owner_id IS NOT NULL'];
        if (ownerId) { params.push(ownerId); conds.push(`mc.current_owner_id = $${params.length}`); }
        if (company && COMPANIES[company]) { params.push(company); conds.push(`mc.company = $${params.length}`); }
        if (search) { params.push(`%${search}%`); conds.push(`(mc.serial_number ILIKE $${params.length} OR mc.normalized_phone ILIKE $${params.length})`); }
        const rows = await prisma.$queryRawUnsafe(`
          SELECT 'marketing_contact' AS type, mc.id, mc.serial_number AS reference,
                 mc.company, mc.lifecycle_status::text AS status,
                 mc.current_owner_id AS "ownerId", u."fullName" AS "ownerName",
                 mc.assigned_at AS "assignedAt", NULL AS "assignedByName",
                 mc.last_reassigned_at AS "lastReassignedAt", mc.normalized_phone AS "resourceName"
            FROM public.marketing_contacts mc
            LEFT JOIN public.users u ON u.id = mc.current_owner_id
           WHERE ${conds.join(' AND ')}
           ORDER BY mc.assigned_at DESC NULLS LAST LIMIT 500`, ...params);
        items.push(...(rows || []));
      }
      items.sort((a, b) => new Date(b.assignedAt || 0) - new Date(a.assignedAt || 0));
      const total = items.length;
      ok(res, {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)),
      });
      return true;
    }

    if (pathname === '/api/user-management/assignments/history' && req.method === 'GET') {
      const page = Math.max(1, Number(query.get('page')) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(query.get('pageSize')) || 25));
      const rows = await prisma.$queryRawUnsafe(`
        SELECT * FROM (
          SELECT 'lead' AS type, h.id, h."leadId" AS "resourceId", l."serialNumber" AS reference,
                 h."assignedToId" AS "toUserId", h."assignedToName" AS "toUserName",
                 h."assignedById" AS "actorId", h."assignedByName" AS "actorName",
                 h."assignedAt" AS "assignedAt", NULL::text AS reason
            FROM public.lead_assignment_histories h
            LEFT JOIN public.leads l ON l.id = h."leadId"
          UNION ALL
          SELECT 'marketing_contact', mh.id, mh.contact_id, mc.serial_number,
                 mh.new_owner_id, u."fullName", mh.assigned_by_id, ab."fullName",
                 mh.created_at, mh.reason
            FROM public.marketing_assignment_history mh
            LEFT JOIN public.marketing_contacts mc ON mc.id = mh.contact_id
            LEFT JOIN public.users u ON u.id = mh.new_owner_id
            LEFT JOIN public.users ab ON ab.id = mh.assigned_by_id
        ) history
        ORDER BY "assignedAt" DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`);
      ok(res, { items: rows || [], page, pageSize });
      return true;
    }

    if (pathname === '/api/user-management/assignments/reassign' && req.method === 'POST') {
      const input = await readJson(req);
      const type = text(input.type, 20);
      const resourceId = requireText(input.id, 'Resource id', 50);
      const toUserId = requireText(input.toUserId, 'Target user', 36);
      const reason = text(input.reason, 500) || null;
      const targetRows = await prisma.$queryRawUnsafe(
        'SELECT id, "fullName", role, company, active FROM public.users WHERE id = $1 LIMIT 1', toUserId
      );
      const target = targetRows?.[0];
      if (!target || !target.active) throw new PermissionError(400, 'INVALID_TARGET', 'Target staff member is not active.');
      if (target.role === 'super_admin') throw new PermissionError(400, 'INVALID_TARGET', 'Administrators do not own operational records.');

      if (type === 'lead') {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT id, company, source, "whatsappSessionId", "assignedTo" FROM public.leads WHERE id = $1 LIMIT 1`,
          resourceId
        );
        const lead = rows?.[0];
        if (!lead) throw new PermissionError(404, 'UNKNOWN_LEAD', 'Lead not found.');
        const leadCompany = resolveLeadCompany(lead);
        if (target.company && target.company !== leadCompany) {
          throw new PermissionError(403, 'CROSS_TENANT_ASSIGNMENT', 'Staff and lead belong to different companies.');
        }
        await prisma.$transaction(async tx => {
          await tx.lead.update({
            where: { id: resourceId },
            data: {
              assignedTo: toUserId, assignedById: user.id, assignedByName: user.fullName,
              assignedAt: new Date(), acceptedAt: null, stage: 'assigned',
            },
          });
          await tx.$executeRawUnsafe(
            `INSERT INTO public.lead_assignment_histories
               (id, "leadId", "assignedToId", "assignedToName", "assignedById", "assignedByName", "assignedAt")
             VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
            crypto.randomUUID(), resourceId, toUserId, target.fullName, user.id, user.fullName
          );
        });
        await audit(user, correlationId, 'lead.reassign', `lead:${resourceId}`, 'success', { toUserId, reason, company: leadCompany });
        ok(res, { type, id: resourceId, ownerId: toUserId, ownerName: target.fullName });
        return true;
      }

      if (type === 'marketing_contact') {
        const rows = await prisma.$queryRawUnsafe(
          'SELECT id, company, current_owner_id FROM public.marketing_contacts WHERE id = $1 LIMIT 1', resourceId
        );
        const contact = rows?.[0];
        if (!contact) throw new PermissionError(404, 'UNKNOWN_CONTACT', 'Marketing contact not found.');
        if (target.company && target.company !== contact.company) {
          throw new PermissionError(403, 'CROSS_TENANT_ASSIGNMENT', 'Staff and contact belong to different companies.');
        }
        await prisma.$transaction(async tx => {
          await tx.$executeRawUnsafe(
            `UPDATE public.marketing_contacts
                SET current_owner_id = $2, assigned_by_id = $3, assigned_at = NOW(), last_reassigned_at = NOW()
              WHERE id = $1`, resourceId, toUserId, user.id
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO public.marketing_assignment_history
               (id, contact_id, previous_owner_id, new_owner_id, assigned_by_id, event_type, reason)
             VALUES ($1,$2,$3,$4,$5,'reassigned',$6)`,
            crypto.randomUUID(), resourceId, contact.current_owner_id, toUserId, user.id, reason
          );
        });
        await audit(user, correlationId, 'marketing.reassign', `marketing_contact:${resourceId}`, 'success', { toUserId, reason });
        ok(res, { type, id: resourceId, ownerId: toUserId, ownerName: target.fullName });
        return true;
      }

      throw new PermissionError(400, 'INVALID_ASSIGNMENT_TYPE', 'Assignment type must be lead or marketing_contact.');
    }

    // ----------------------------------------------------------------- sessions
    if (pathname === '/api/user-management/sessions' && req.method === 'GET') {
      const page = Math.max(1, Number(query.get('page')) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(query.get('pageSize')) || 25));
      const userId = text(query.get('userId'), 36);
      const state = text(query.get('state'), 20);
      const search = text(query.get('search'), 120);
      const conditions = [];
      const values = [];
      if (userId) { values.push(userId); conditions.push(`s.user_id = $${values.length}`); }
      if (state === 'active') conditions.push('s.revoked_at IS NULL');
      if (state === 'revoked') conditions.push('s.revoked_at IS NOT NULL');
      if (search) {
        values.push(`%${search}%`);
        const n = `$${values.length}`;
        conditions.push(`(COALESCE(u."fullName",'') ILIKE ${n} OR COALESCE(u.email,'') ILIKE ${n} OR COALESCE(s.ip,'') ILIKE ${n} OR COALESCE(s.user_agent,'') ILIKE ${n})`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM public.user_sessions s LEFT JOIN public.users u ON u.id = s.user_id ${where}`, ...values);
      const rows = await prisma.$queryRawUnsafe(`
        SELECT s.id, s.user_id AS "userId", u."fullName" AS "userName", u.email,
               s.ip, s.user_agent AS "userAgent", s.created_at AS "createdAt",
               s.last_seen_at AS "lastSeenAt", s.revoked_at AS "revokedAt",
               s.revoke_reason AS "revokeReason"
          FROM public.user_sessions s LEFT JOIN public.users u ON u.id = s.user_id
          ${where} ORDER BY s.created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, ...values);
      const items = (rows || []).map(row => ({
        ...row,
        status: row.revokedAt ? 'revoked' : 'active',
        device: String(row.userAgent || '').slice(0, 160) || 'Unknown device',
      }));
      ok(res, { items, total: Number(count?.[0]?.count || 0), page, pageSize, pages: Math.max(1, Math.ceil(Number(count?.[0]?.count || 0) / pageSize)) });
      return true;
    }

    const sessionMatch = pathname.match(/^\/api\/user-management\/sessions\/([a-zA-Z0-9-]{1,36})$/);
    if (sessionMatch && req.method === 'DELETE') {
      const id = sessionMatch[1];
      const result = await prisma.$executeRawUnsafe(
        `UPDATE public.user_sessions SET revoked_at = NOW(), revoked_by = $2, revoke_reason = 'Revoked by administrator'
          WHERE id = $1 AND revoked_at IS NULL`, id, user.id
      );
      if (!Number(result || 0)) throw new PermissionError(404, 'UNKNOWN_SESSION', 'Active session not found.');
      await audit(user, correlationId, 'session.revoke', `session:${id}`, 'success');
      ok(res, { id, revoked: true });
      return true;
    }

    // -------------------------------------------------------------- user detail
    const userMatch = pathname.match(/^\/api\/user-management\/users\/([a-zA-Z0-9-]{1,36})(?:\/(status|credentials|revoke-sessions))?$/);
    if (userMatch) {
      const id = userMatch[1];
      const action = userMatch[2] || null;

      if (!action && req.method === 'GET') {
        const target = await getUserRow(prisma, id);
        if (!target) throw new PermissionError(404, 'UNKNOWN_USER', 'User not found.');
        const isSuperAdmin = user?.role === 'super_admin';
        const [sessions, activity, teams, invitation, assignments, credsRow] = await Promise.all([
          prisma.$queryRawUnsafe(`
            SELECT id, ip, user_agent AS "userAgent", created_at AS "createdAt",
                   last_seen_at AS "lastSeenAt", revoked_at AS "revokedAt", revoke_reason AS "revokeReason"
              FROM public.user_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, id),
          listAuditEvents(prisma, { page: 1, pageSize: 15, actorId: id }),
          prisma.$queryRawUnsafe(`
            SELECT t.id, t.name, t.company, t.branch FROM public.team_members m
              JOIN public.teams t ON t.id = m.team_id WHERE m.user_id = $1`, id),
          prisma.$queryRawUnsafe(`
            SELECT id, expires_at AS "expiresAt", created_at AS "createdAt" FROM public.user_invitations
              WHERE LOWER(email) = LOWER($1) AND accepted_at IS NULL AND revoked_at IS NULL
              ORDER BY created_at DESC LIMIT 1`, target.email),
          prisma.$queryRawUnsafe(`
            SELECT 'lead' AS type, COUNT(*)::int AS count FROM public.leads WHERE "assignedTo" = $1
            UNION ALL
            SELECT 'marketing_contact', COUNT(*)::int FROM public.marketing_contacts WHERE current_owner_id = $1`, id),
          isSuperAdmin ? prisma.user.findUnique({ where: { id }, select: { pin: true, password: true } }) : null,
        ]);

        let credentials = null;
        if (isSuperAdmin && credsRow) {
          const rawPin = credsRow.pin;
          const rawPass = credsRow.password;
          credentials = {
            pin: rawPin?.startsWith('enc:v1:') ? decryptReversible(rawPin) : (!rawPin?.startsWith('scrypt:') ? (rawPin || null) : null),
            pinConfigured: Boolean(rawPin),
            pinIsHashed: Boolean(rawPin?.startsWith('scrypt:')),
            password: rawPass?.startsWith('enc:v1:') ? decryptReversible(rawPass) : (!rawPass?.startsWith('scrypt:') ? (rawPass || null) : null),
            passwordConfigured: Boolean(rawPass),
            passwordIsHashed: Boolean(rawPass?.startsWith('scrypt:')),
          };
        }

        ok(res, {
          user: target,
          teams: teams || [],
          invitation: invitation?.[0] || null,
          sessions: (sessions || []).map(row => ({
            ...row,
            status: row.revokedAt ? 'revoked' : 'active',
            device: String(row.userAgent || '').slice(0, 160) || 'Unknown device',
          })),
          activity: activity.items,
          assignments: assignments || [],
          credentials,
        });
        return true;
      }

      if (!action && (req.method === 'PATCH' || req.method === 'PUT')) {
        const input = await readJson(req);
        const target = await getUserRow(prisma, id);
        if (!target) throw new PermissionError(404, 'UNKNOWN_USER', 'User not found.');
        const data = {};
        const raw = {};
        if (input.fullName !== undefined) data.fullName = requireText(input.fullName, 'Full name');
        if (input.email !== undefined) {
          const email = requireEmail(input.email);
          if (email !== target.email) {
            const duplicate = await prisma.user.findUnique({ where: { email }, select: { id: true } });
            if (duplicate) throw new PermissionError(409, 'EMAIL_IN_USE', 'An account already uses this email address.');
          }
          data.email = email;
        }
        if (input.phone !== undefined) data.phone = text(input.phone, 50) || null;
        if (input.branch !== undefined) data.branch = text(input.branch, 100) || null;
        if (input.marketingAccess !== undefined) data.marketingAccess = input.marketingAccess === true;
        if (input.company !== undefined) data.company = requireCompany(input.company, target.company);
        if (input.role !== undefined) {
          const role = requireRole(input.role);
          if (id === user.id && role !== target.role) {
            throw new PermissionError(403, 'SELF_ELEVATION', 'You cannot change your own role.');
          }
          if (target.role === 'super_admin' && role !== 'super_admin') {
            const remaining = await countActiveSuperAdmins(prisma, id);
            if (remaining < 1) throw new PermissionError(409, 'LAST_SUPER_ADMIN', 'At least one active Super Admin must remain.');
          }
          data.role = role;
        }
        if (input.employeeId !== undefined) raw.employee_id = text(input.employeeId, 50) || null;
        if (input.departmentId !== undefined) {
          const departmentId = optionalId(input.departmentId);
          await assertDepartmentCompany(prisma, departmentId, data.company ?? target.company);
          raw.department_id = departmentId;
        }
        if (input.managerId !== undefined) {
          const managerId = optionalId(input.managerId);
          if (managerId === id) throw new PermissionError(400, 'INVALID_MANAGER', 'A user cannot report to themselves.');
          if (managerId) {
            const manager = await prisma.user.findUnique({ where: { id: managerId }, select: { id: true, active: true } });
            if (!manager || !manager.active) throw new PermissionError(400, 'INVALID_MANAGER', 'Reporting manager not found.');
          }
          raw.manager_id = managerId;
        }
        if (raw.employee_id) {
          const employee = await prisma.$queryRawUnsafe(
            'SELECT id FROM public.users WHERE employee_id = $1 AND id <> $2 LIMIT 1', raw.employee_id, id
          );
          if (employee?.length) throw new PermissionError(409, 'EMPLOYEE_ID_IN_USE', 'That employee ID is already assigned.');
        }
        if (!Object.keys(data).length && !Object.keys(raw).length) {
          throw new PermissionError(400, 'NO_CHANGES', 'No profile fields were provided.');
        }
        if (Object.keys(data).length) {
          await prisma.user.update({ where: { id }, data });
        }
        if (Object.keys(raw).length) {
          const columns = Object.keys(raw);
          const values = columns.map(column => raw[column]);
          await prisma.$executeRawUnsafe(
            `UPDATE public.users SET ${columns.map((column, index) => `${column} = $${index + 2}`).join(', ')} WHERE id = $1`,
            id, ...values
          );
        }
        await audit(user, correlationId, 'user.update', `user:${id}`, 'success', {
          fields: Object.keys(input), roleChanged: Boolean(data.role), company: data.company ?? target.company,
        });
        ok(res, await getUserRow(prisma, id));
        return true;
      }

      if (action === 'status' && req.method === 'POST') {
        const input = await readJson(req);
        const actionName = text(input.action, 20);
        const target = await getUserRow(prisma, id);
        if (!target) throw new PermissionError(404, 'UNKNOWN_USER', 'User not found.');
        const reason = text(input.reason, 255) || null;

        if (['deactivate', 'suspend'].includes(actionName)) {
          if (id === user.id) throw new PermissionError(403, 'SELF_LOCKOUT', 'You cannot disable your own account.');
          if (target.role === 'super_admin') {
            const remaining = await countActiveSuperAdmins(prisma, id);
            if (remaining < 1) throw new PermissionError(409, 'LAST_SUPER_ADMIN', 'At least one active Super Admin must remain.');
          }
          const suspended = actionName === 'suspend';
          await prisma.user.update({ where: { id }, data: { active: false } });
          await prisma.$executeRawUnsafe(
            `UPDATE public.users SET suspended_at = ${suspended ? 'NOW()' : 'NULL'} WHERE id = $1`, id
          );
          await revokeUserSessions(prisma, id, user.id, reason || `Account ${actionName}d`);
        } else if (actionName === 'activate') {
          await prisma.user.update({ where: { id }, data: { active: true } });
          await prisma.$executeRawUnsafe(
            'UPDATE public.users SET suspended_at = NULL, locked_until = NULL WHERE id = $1', id
          );
        } else if (actionName === 'unlock') {
          await prisma.$executeRawUnsafe('UPDATE public.users SET locked_until = NULL WHERE id = $1', id);
        } else {
          throw new PermissionError(400, 'INVALID_ACTION', 'Status action must be activate, deactivate, suspend or unlock.');
        }
        await audit(user, correlationId, `user.${actionName}`, `user:${id}`, 'success', { reason, role: target.role });
        ok(res, await getUserRow(prisma, id));
        return true;
      }

      if (action === 'credentials' && req.method === 'POST') {
        if (id === user.id) throw new PermissionError(403, 'SELF_CREDENTIALS', 'Use your own profile to change your credentials.');
        const input = await readJson(req);
        const password = input.password === undefined ? '' : String(input.password);
        const pin = input.pin === undefined || input.pin === null ? '' : String(input.pin).trim();
        if (!password && !pin) throw new PermissionError(400, 'NO_CHANGES', 'Provide a new password or PIN.');
        if (password && password.length < 12) throw new PermissionError(400, 'WEAK_PASSWORD', 'Password must be at least 12 characters.');
        if (pin && (pin.length < 4 || pin.length > 10)) throw new PermissionError(400, 'INVALID_PIN', 'PIN must be 4-10 characters.');
        const data = {};
        if (password) data.password = encryptReversible(password);
        if (pin) data.pin = encryptReversible(pin);
        await prisma.user.update({ where: { id }, data });
        await revokeUserSessions(prisma, id, user.id, 'Credentials reset by administrator');
        await audit(user, correlationId, 'user.credentials.reset', `user:${id}`, 'success', { password: Boolean(password), pin: Boolean(pin) });
        ok(res, { id, updated: true, sessionsRevoked: true });
        return true;
      }

      if (action === 'revoke-sessions' && req.method === 'POST') {
        const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
        if (!target) throw new PermissionError(404, 'UNKNOWN_USER', 'User not found.');
        await revokeUserSessions(prisma, id, user.id, 'Revoked by administrator');
        await audit(user, correlationId, 'session.revoke_all', `user:${id}`, 'success', { self: id === user.id });
        ok(res, { id, revoked: true });
        return true;
      }
    }

    json(res, 404, { success: false, error: 'User management route not found.' });
    return true;
  } catch (error) {
    if (error instanceof PermissionError) {
      await audit(user, correlationId, 'user_management.request', pathname, 'denied', { code: error.code, message: error.message });
      json(res, error.status || 400, { success: false, error: error.message, code: error.code });
      return true;
    }
    console.error('[UserManagement] Request failed:', error.message);
    json(res, 500, { success: false, error: 'User management request failed.' });
    return true;
  }
}
