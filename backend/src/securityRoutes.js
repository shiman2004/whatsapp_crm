import { getPrisma, getDbStatus } from './db.js';
import {
  CAPABILITY_KEYS, ROLES, SCOPES,
  PermissionError, editableRoleCapabilities, effectivePolicy, getCapability,
  moduleRegistry, roleCapabilities, roleMaxScope, roleRegistry, validateOverrides, validateScope,
} from './securityPolicy.js';
import {
  describeRolePolicy, describeUserPolicy, getProfile, getUser,
  listAuditEvents, listUsers, resetProfile, rolePolicyDetails, saveProfile, securityOverview,
} from './securityStore.js';
import { auditSecurityEvent } from './securityAudit.js';

const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};

const ok = (res, data) => json(res, 200, { success: true, data });

async function readJson(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 10000) throw new PermissionError(413, 'BODY_TOO_LARGE', 'Request body is too large.');
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

function requireRevision(value) {
  if (value === undefined || value === null || value === '') return 0;
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 0) {
    throw new PermissionError(400, 'INVALID_REVISION', 'expectedRevision must be a non-negative integer.');
  }
  return revision;
}

function requireReason(value) {
  if (value === undefined || value === null) return null;
  const reason = String(value).trim();
  if (reason.length > 500) throw new PermissionError(400, 'REASON_TOO_LONG', 'Reason must be 500 characters or fewer.');
  return reason || null;
}

/** Shared before/after computation for preview and save. Never trusts client capability values. */
async function buildProposal(prisma, input) {
  const subjectType = input.subjectType === 'role' ? 'role' : input.subjectType === 'user' ? 'user' : null;
  if (!subjectType) throw new PermissionError(400, 'INVALID_SUBJECT', 'subjectType must be role or user.');
  if (typeof input.subjectId !== 'string' || !input.subjectId.trim()) {
    throw new PermissionError(400, 'INVALID_SUBJECT', 'A subject id is required.');
  }
  const subjectId = input.subjectId.trim().slice(0, 100);

  if (subjectType === 'role') {
    if (!ROLES.includes(subjectId)) throw new PermissionError(404, 'UNKNOWN_ROLE', 'Unknown role.');
    if (subjectId === 'super_admin') {
      throw new PermissionError(403, 'SUPER_ADMIN_IMMUTABLE', 'Super Admin recovery access cannot be reduced or rewritten.');
    }
    if (input.scope !== undefined && input.scope !== null && input.scope !== '') {
      throw new PermissionError(400, 'ROLE_SCOPE_FIXED', 'Role scope is fixed by the registry and cannot be changed.');
    }
    const overrides = validateOverrides('role', subjectId, input.overrides || {});
    const current = await getProfile(prisma, 'role', subjectId);
    return {
      subjectType, subjectId, overrides, scope: null,
      label: subjectId,
      expectedRevision: current?.revision || 0,
      before: describeRolePolicy(subjectId, current?.overrides || {}),
      after: describeRolePolicy(subjectId, overrides),
    };
  }

  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(subjectId)) throw new PermissionError(400, 'INVALID_USER_ID', 'Invalid user id.');
  const user = await getUser(prisma, subjectId);
  if (!user) throw new PermissionError(404, 'UNKNOWN_USER', 'User not found.');
  if (!user.active) throw new PermissionError(409, 'INACTIVE_USER', 'Permissions cannot be changed for a disabled account.');
  if (user.role === 'super_admin') {
    throw new PermissionError(403, 'SUPER_ADMIN_IMMUTABLE', 'Super Admin accounts are governed by the protected policy and cannot receive user overrides.');
  }
  const overrides = validateOverrides('user', user.role, input.overrides || {});
  const scope = validateScope(user.role, input.scope ?? null);
  const profile = await getProfile(prisma, 'user', subjectId);
  const roleProfile = await getProfile(prisma, 'role', user.role);
  const before = await describeUserPolicy(prisma, user, profile);
  const afterPolicy = effectivePolicy(user, {
    roleOverrides: roleProfile?.overrides || {},
    userOverrides: overrides,
    scope: scope || undefined,
  });
  return {
    subjectType, subjectId, overrides, scope,
    label: user.fullName,
    expectedRevision: profile?.revision || 0,
    before: before.policy,
    after: afterPolicy,
  };
}

function summarize(before, after) {
  const changes = [];
  for (const key of CAPABILITY_KEYS) {
    const from = before?.capabilities?.[key] || { allowed: false, scope: null };
    const to = after?.capabilities?.[key] || { allowed: false, scope: null };
    if (from.allowed !== to.allowed || from.scope !== to.scope) {
      const meta = getCapability(key);
      changes.push({
        capability: key,
        module: meta?.module || null,
        label: meta?.label || key,
        action: meta?.action || null,
        from: { allowed: from.allowed, scope: from.scope },
        to: { allowed: to.allowed, scope: to.scope },
        risk: !from.allowed && to.allowed ? 'elevation' : from.allowed && !to.allowed ? 'reduction' : 'scope',
      });
    }
  }
  const elevation = changes.filter(change => change.risk === 'elevation');
  return {
    changes,
    summary: {
      added: changes.filter(change => change.risk === 'elevation').length,
      removed: changes.filter(change => change.risk === 'reduction').length,
      rescoped: changes.filter(change => change.risk === 'scope').length,
    },
    warnings: elevation.map(change => `${change.label} is being newly granted.`),
  };
}

async function handleRolePatch(req, res, role, user, correlationId) {
  const input = await readJson(req);
  const prisma = getPrisma();
  const proposal = await buildProposal(prisma, { subjectType: 'role', subjectId: role, overrides: input.overrides })
    .catch(error => { throw error; });
  const requestedRevision = requireRevision(input.expectedRevision);
  if (requestedRevision !== proposal.expectedRevision) {
    throw new PermissionError(409, 'REVISION_CONFLICT', `This policy changed while you were editing it. Reload and try again (current revision ${proposal.expectedRevision}).`);
  }
  const diff = summarize(proposal.before, proposal.after);
  const saved = await saveProfile(prisma, {
    subjectType: 'role', subjectId: role, overrides: proposal.overrides, scope: null,
    expectedRevision: proposal.expectedRevision, actorId: user.id, correlationId,
    reason: requireReason(input.reason), changes: diff.changes,
  });
  ok(res, {
    role,
    revision: saved.revision,
    policy: describeRolePolicy(role, saved.overrides),
    ...diff,
  });
}

async function handleUserPatch(req, res, targetId, user, correlationId) {
  if (targetId === user.id) {
    throw new PermissionError(403, 'SELF_ELEVATION', 'You cannot modify your own permission profile.');
  }
  const input = await readJson(req);
  const prisma = getPrisma();
  const proposal = await buildProposal(prisma, {
    subjectType: 'user', subjectId: targetId, overrides: input.overrides, scope: input.scope,
  });
  const requestedRevision = requireRevision(input.expectedRevision);
  if (requestedRevision !== proposal.expectedRevision) {
    throw new PermissionError(409, 'REVISION_CONFLICT', `This policy changed while you were editing it. Reload and try again (current revision ${proposal.expectedRevision}).`);
  }
  const diff = summarize(proposal.before, proposal.after);
  const saved = await saveProfile(prisma, {
    subjectType: 'user', subjectId: targetId, overrides: proposal.overrides, scope: proposal.scope,
    expectedRevision: proposal.expectedRevision, actorId: user.id, correlationId,
    reason: requireReason(input.reason), changes: diff.changes,
  });
  const target = await getUser(prisma, targetId);
  const described = await describeUserPolicy(prisma, target, saved);
  ok(res, { ...described, ...diff });
}

export async function handleSecurityRoutes(req, res, pathname, user, correlationId) {
  if (!pathname.startsWith('/api/security')) return false;

  if (!user?.id || user.active === false || user.role !== 'super_admin') {
    await auditSecurityEvent({ correlationId, actorId: user?.id, action: 'security.access', resource: pathname, outcome: 'denied' });
    json(res, 403, { success: false, error: 'Super Admin access is required.' });
    return true;
  }
  if (req.method === 'OPTIONS') { json(res, 204, {}); return true; }

  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) {
    json(res, 503, { success: false, error: 'Security administration requires database storage.' });
    return true;
  }

  try {
    if (pathname === '/api/security/overview' && req.method === 'GET') {
      ok(res, await securityOverview(prisma)); return true;
    }

    if (pathname === '/api/security/roles' && req.method === 'GET') {
      const roles = await Promise.all(roleRegistry().map(async role => {
        const { profile } = await rolePolicyDetails(prisma, role.role);
        return {
          ...role,
          category: role.category,
          revision: profile?.revision || 0,
          overrides: profile?.overrides || {},
          editableCapabilities: editableRoleCapabilities(role.role),
          scope: role.maxScope,
        };
      }));
      ok(res, { roles, modules: moduleRegistry(), scopes: SCOPES, capabilities: CAPABILITY_KEYS });
      return true;
    }

    const roleMatch = pathname.match(/^\/api\/security\/roles\/([a-z_]{1,40})\/permissions$/);
    if (roleMatch) {
      const role = roleMatch[1];
      if (!ROLES.includes(role)) { json(res, 404, { success: false, error: 'Unknown role.' }); return true; }
      if (req.method === 'GET') {
        const { profile, policy } = await rolePolicyDetails(prisma, role);
        ok(res, {
          role, policy, revision: profile?.revision || 0,
          overrides: profile?.overrides || {},
          editableCapabilities: editableRoleCapabilities(role),
          modules: moduleRegistry(), scopes: SCOPES.filter(scope => SCOPES.indexOf(scope) <= SCOPES.indexOf(roleMaxScope(role))),
          immutable: role === 'super_admin',
        });
        return true;
      }
      if (req.method === 'PATCH') { await handleRolePatch(req, res, role, user, correlationId); return true; }
      if (req.method === 'DELETE') {
        if (role === 'super_admin') {
          throw new PermissionError(403, 'SUPER_ADMIN_IMMUTABLE', 'Super Admin recovery access cannot be reduced or rewritten.');
        }
        const query = queryOf(req);
        const result = await resetProfile(prisma, {
          subjectType: 'role', subjectId: role,
          expectedRevision: requireRevision(query.get('expectedRevision')),
          actorId: user.id, correlationId, reason: requireReason(query.get('reason')),
        });
        ok(res, {
          role, revision: result.revision, reset: true, overrides: {},
          policy: describeRolePolicy(role, {}),
        });
        return true;
      }
    }

    if (pathname === '/api/security/users' && req.method === 'GET') {
      const query = queryOf(req);
      ok(res, await listUsers(prisma, {
        page: query.get('page'), pageSize: query.get('pageSize'), search: query.get('search'),
        role: query.get('role'), department: query.get('department'),
        status: query.get('status'), custom: query.get('custom'),
      }));
      return true;
    }

    const userMatch = pathname.match(/^\/api\/security\/users\/([a-zA-Z0-9_-]{1,100})\/permissions$/);
    if (userMatch) {
      const targetId = userMatch[1];
      if (req.method === 'GET') {
        const target = await getUser(prisma, targetId);
        if (!target) { json(res, 404, { success: false, error: 'User not found.' }); return true; }
        const profile = await getProfile(prisma, 'user', targetId);
        ok(res, {
          ...(await describeUserPolicy(prisma, target, profile)),
          modules: moduleRegistry(), scopes: SCOPES,
          roleCapabilities: roleCapabilities(target.role),
          eligibleScopes: SCOPES.filter(scope => SCOPES.indexOf(scope) <= SCOPES.indexOf(roleMaxScope(target.role))),
          self: targetId === user.id,
        });
        return true;
      }
      if (req.method === 'PATCH') { await handleUserPatch(req, res, targetId, user, correlationId); return true; }
    }

    const resetMatch = pathname.match(/^\/api\/security\/users\/([a-zA-Z0-9_-]{1,100})\/overrides$/);
    if (resetMatch && req.method === 'DELETE') {
      const targetId = resetMatch[1];
      if (targetId === user.id) throw new PermissionError(403, 'SELF_ELEVATION', 'You cannot modify your own permission profile.');
      const target = await getUser(prisma, targetId);
      if (!target) { json(res, 404, { success: false, error: 'User not found.' }); return true; }
      if (target.role === 'super_admin') throw new PermissionError(403, 'SUPER_ADMIN_IMMUTABLE', 'Super Admin accounts are governed by the protected policy.');
      const query = queryOf(req);
      const result = await resetProfile(prisma, {
        subjectType: 'user', subjectId: targetId,
        expectedRevision: requireRevision(query.get('expectedRevision')),
        actorId: user.id, correlationId, reason: requireReason(query.get('reason')),
      });
      const described = await describeUserPolicy(prisma, target, null);
      ok(res, { ...described, revision: result.revision, reset: true });
      return true;
    }

    if (pathname === '/api/security/permissions/preview' && req.method === 'POST') {
      const input = await readJson(req);
      const proposal = await buildProposal(prisma, input);
      ok(res, {
        subjectType: proposal.subjectType,
        subjectId: proposal.subjectId,
        label: proposal.label,
        scope: proposal.scope,
        revision: proposal.expectedRevision,
        before: proposal.before,
        after: proposal.after,
        ...summarize(proposal.before, proposal.after),
      });
      return true;
    }

    if (pathname === '/api/security/audit-logs' && req.method === 'GET') {
      const query = queryOf(req);
      ok(res, await listAuditEvents(prisma, {
        page: query.get('page'), pageSize: query.get('pageSize'), search: query.get('search'),
        actorId: query.get('actorId'), module: query.get('module'), action: query.get('action'),
        outcome: query.get('outcome'), from: query.get('from'), to: query.get('to'),
      }));
      return true;
    }
  } catch (error) {
    if (error instanceof PermissionError) {
      await auditSecurityEvent({
        correlationId, actorId: user.id, action: 'security.permission.write',
        resource: pathname, outcome: 'denied', metadata: { code: error.code, message: error.message },
      });
      json(res, error.status || 400, { success: false, error: error.message, code: error.code });
      return true;
    }
    console.error('[Security] Request failed:', error.message);
    json(res, 500, { success: false, error: 'Security administration request failed.' });
    return true;
  }

  json(res, 404, { success: false, error: 'Security route not found.' });
  return true;
}
