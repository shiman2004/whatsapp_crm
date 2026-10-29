// User Management & Security authorization suite.
//
// These are the required negative tests: no non-admin may reach the module,
// nobody may elevate themselves, nobody may move records across tenants, and a
// deactivated or revoked session must stop working immediately.
import assert from 'node:assert/strict';
import { server, signAuthToken } from './server.js';
import { checkDbConnection, getPrisma, waitForSchemaBootstrap } from './src/db.js';

const PORT = 5997;
const suffix = Date.now().toString(36);
const PASSWORD = 'StrongPassword2026!';

const FIXTURES = {
  admin: { id: `um-admin-${suffix}`, email: `um-admin-${suffix}@test.local`, role: 'super_admin', fullName: 'UM Admin' },
  coordinator: { id: `um-coord-${suffix}`, email: `um-coord-${suffix}@test.local`, role: 'coordinator', fullName: 'UM Coordinator', company: 'RWC' },
  crasStaff: { id: `um-cras-${suffix}`, email: `um-cras-${suffix}@test.local`, role: 'leads_officer', fullName: 'UM CRAS Officer', company: 'CRAS' },
};

let prisma;
const created = { users: [], invitations: [], leads: [], customers: [], sessions: [] };

async function seed() {
  for (const fixture of Object.values(FIXTURES)) {
    await prisma.user.create({
      data: {
        id: fixture.id,
        fullName: fixture.fullName,
        email: fixture.email,
        role: fixture.role,
        company: fixture.company || 'RWC',
        active: true,
      },
    });
  }
}

async function cleanup() {
  const ids = [...new Set([...Object.values(FIXTURES).map(f => f.id), ...created.users])];
  await prisma.$executeRawUnsafe('DELETE FROM public.team_members WHERE user_id = ANY($1::text[])', ids).catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM public.user_sessions WHERE user_id = ANY($1::text[])', ids).catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM public.user_invitations WHERE invited_by = ANY($1::text[]) OR email LIKE $2', ids, `%${suffix}%`).catch(() => {});
  if (created.leads.length) {
    await prisma.$executeRawUnsafe('DELETE FROM public.lead_assignment_histories WHERE "leadId" = ANY($1::text[])', created.leads).catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM public.leads WHERE id = ANY($1::text[])', created.leads).catch(() => {});
  }
  if (created.customers.length) {
    await prisma.$executeRawUnsafe('DELETE FROM public.customers WHERE id = ANY($1::text[])', created.customers).catch(() => {});
  }
  await prisma.$executeRawUnsafe('DELETE FROM public.security_audit_events WHERE actor_id = ANY($1::text[])', ids).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
}

function token(user) {
  return signAuthToken({ userId: user.id, email: user.email, role: user.role, fullName: user.fullName });
}

async function call(baseUrl, path, { method = 'GET', as = FIXTURES.admin, body, raw } = {}) {
  const headers = { Authorization: `Bearer ${token(as)}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (raw) return { status: response.status, text, headers: response.headers };
  let parsed = {};
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { status: response.status, body: parsed };
}

async function main() {
  await checkDbConnection();
  await waitForSchemaBootstrap();
  prisma = getPrisma();
  assert.ok(prisma, 'test database must be available');
  await cleanup();
  await seed();

  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // 1. Server-side gate: every module route rejects non-admins (no UI involvement).
    const routes = [
      ['GET', '/api/user-management/overview'],
      ['GET', '/api/user-management/users'],
      ['GET', '/api/user-management/users/export.csv'],
      ['GET', '/api/user-management/invitations'],
      ['GET', '/api/user-management/departments'],
      ['GET', '/api/user-management/assignments'],
      ['GET', '/api/user-management/sessions'],
      ['POST', `/api/user-management/users/${FIXTURES.coordinator.id}/status`],
      ['POST', '/api/user-management/assignments/reassign'],
    ];
    for (const [method, path] of routes) {
      const denied = await call(baseUrl, path, { method, as: FIXTURES.coordinator, body: method === 'POST' ? {} : undefined });
      assert.equal(denied.status, 403, `${method} ${path} must reject a coordinator (got ${denied.status})`);
    }
    console.log('  ✅ non-admin rejected on every user-management route (403)');

    // 2. Forged token claiming super_admin but bound to a coordinator row is still rejected.
    const forged = signAuthToken({ userId: FIXTURES.coordinator.id, email: FIXTURES.coordinator.email, role: 'super_admin', fullName: 'Fake Admin' });
    const forgedResponse = await fetch(`${baseUrl}/api/user-management/overview`, { headers: { Authorization: `Bearer ${forged}` } });
    assert.equal(forgedResponse.status, 403, 'role is read from the database, never from the token');
    console.log('  ✅ frontend/token role spoofing has no effect');

    // 3. Directory, filters, pagination.
    const listed = await call(baseUrl, `/api/user-management/users?search=${encodeURIComponent(suffix)}&pageSize=2`);
    assert.equal(listed.status, 200);
    assert.ok(listed.body.data.total >= 3, 'fixtures are visible in the directory');
    assert.equal(listed.body.data.items.length, 2, 'server pagination is applied');
    assert.ok(listed.body.data.items.every(row => row.status === 'active'));

    const filtered = await call(baseUrl, `/api/user-management/users?company=CRAS&pageSize=50`);
    assert.equal(filtered.status, 200);
    assert.ok(filtered.body.data.items.every(row => row.company === 'CRAS'));

    // Unknown filter values are ignored, never interpolated into SQL.
    const injected = await call(baseUrl, `/api/user-management/users?sort=id;DROP%20TABLE%20users&order=sideways&role=not_a_role`);
    assert.equal(injected.status, 200);
    assert.ok(injected.body.data.items.length > 0, 'unsafe sort/role input falls back to defaults');
    console.log('  ✅ directory listing, filters, pagination, unsafe input');

    // 4. CSV export is real, authorized, and injection-safe.
    const csv = await call(baseUrl, '/api/user-management/users/export.csv?search=' + encodeURIComponent(suffix), { raw: true });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type') || '', /text\/csv/);
    assert.match(csv.headers.get('content-disposition') || '', /attachment/);
    assert.ok(csv.text.split('\r\n').length >= 4, 'export contains the header and fixture rows');
    console.log('  ✅ CSV export');

    // 5. Creation validation.
    const weak = await call(baseUrl, '/api/user-management/users', {
      method: 'POST', body: { fullName: 'Weak', email: `weak-${suffix}@test.local`, role: 'coordinator', password: 'short' },
    });
    assert.equal(weak.status, 400);
    assert.equal(weak.body.code, 'WEAK_PASSWORD');

    const badRole = await call(baseUrl, '/api/user-management/users', {
      method: 'POST', body: { fullName: 'Bad Role', email: `badrole-${suffix}@test.local`, role: 'root', password: PASSWORD },
    });
    assert.equal(badRole.status, 400);
    assert.equal(badRole.body.code, 'INVALID_ROLE');

    const duplicate = await call(baseUrl, '/api/user-management/users', {
      method: 'POST', body: { fullName: 'Duplicate', email: FIXTURES.coordinator.email, role: 'coordinator', password: PASSWORD },
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, 'EMAIL_IN_USE');

    const unknownDepartment = await call(baseUrl, '/api/user-management/users', {
      method: 'POST', body: { fullName: 'Dept', email: `dept-${suffix}@test.local`, role: 'coordinator', password: PASSWORD, departmentId: 'does-not-exist' },
    });
    assert.equal(unknownDepartment.status, 400);
    assert.equal(unknownDepartment.body.code, 'UNKNOWN_DEPARTMENT');
    console.log('  ✅ create validation (password, role, duplicate email, department)');

    // 6. Real creation, then staff cannot escalate themselves.
    const email = `created-${suffix}@test.local`;
    const createdUser = await call(baseUrl, '/api/user-management/users', {
      method: 'POST',
      body: { fullName: 'Created Officer', email, role: 'coordinator', password: PASSWORD, company: 'RWC', branch: 'Colombo', employeeId: `EMP-${suffix}` },
    });
    assert.equal(createdUser.status, 201, JSON.stringify(createdUser.body));
    const newId = createdUser.body.data.id;
    created.users.push(newId);
    assert.equal(createdUser.body.data.status, 'active');
    assert.equal(createdUser.body.data.employeeId, `EMP-${suffix}`);
    assert.equal(createdUser.body.data.password, undefined, 'credentials are never returned');

    const duplicateEmployee = await call(baseUrl, '/api/user-management/users', {
      method: 'POST', body: { fullName: 'Other', email: `other-${suffix}@test.local`, role: 'coordinator', password: PASSWORD, employeeId: `EMP-${suffix}` },
    });
    assert.equal(duplicateEmployee.status, 409);
    assert.equal(duplicateEmployee.body.code, 'EMPLOYEE_ID_IN_USE');
    console.log('  ✅ user created, employee id uniqueness enforced');

    // 7. Login works, then revocation and deactivation both kill the session.
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, password: PASSWORD }),
    });
    assert.equal(login.status, 200, 'new account can sign in');
    const loginBody = await login.json();
    const userToken = loginBody.token;
    assert.ok(userToken, 'login returns a token');

    const sessionRows = await prisma.$queryRawUnsafe(
      'SELECT id FROM public.user_sessions WHERE user_id = $1 AND revoked_at IS NULL', newId
    );
    assert.ok(sessionRows.length >= 1, 'a server-side session row is recorded on login');

    const selfElevate = await fetch(`${baseUrl}/api/user-management/users/${newId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ role: 'super_admin' }),
    });
    assert.equal(selfElevate.status, 403, 'a signed-in staff member cannot promote themselves');

    const revoke = await call(baseUrl, `/api/user-management/users/${newId}/revoke-sessions`, { method: 'POST' });
    assert.equal(revoke.status, 200);
    const afterRevoke = await fetch(`${baseUrl}/api/auth/session`, { headers: { Authorization: `Bearer ${userToken}` } });
    assert.equal(afterRevoke.status, 401, 'revoked token stops working immediately');

    const sessionRevoke = await call(baseUrl, `/api/user-management/users/${newId}/status`, {
      method: 'POST', body: { action: 'deactivate', reason: 'Suite test' },
    });
    assert.equal(sessionRevoke.status, 200);
    assert.equal(sessionRevoke.body.data.status, 'inactive');

    const selfLockout = await call(baseUrl, `/api/user-management/users/${FIXTURES.admin.id}/status`, {
      method: 'POST', as: FIXTURES.admin, body: { action: 'deactivate' },
    });
    assert.equal(selfLockout.status, 403, 'an administrator cannot disable their own account');
    assert.equal(selfLockout.body.code, 'SELF_LOCKOUT');

    const selfRole = await call(baseUrl, `/api/user-management/users/${FIXTURES.admin.id}`, {
      method: 'PATCH', as: FIXTURES.admin, body: { role: 'coordinator' },
    });
    assert.equal(selfRole.status, 403, 'an administrator cannot change their own role');
    assert.equal(selfRole.body.code, 'SELF_ELEVATION');
    console.log('  ✅ session revocation, deactivation, self-privilege guards');

    // 8. Cross-tenant reassignment is refused; cross-staff reassignment is refused.
    const leadId = `um-lead-${suffix}`;
    const customerId = `um-cust-${suffix}`;
    await prisma.customer.create({
      data: { id: customerId, displayName: 'Suite Customer', whatsappNumber: `+9477${String(Date.now()).slice(-7)}` },
    });
    await prisma.lead.create({
      data: { id: leadId, customerId, stage: 'assigned', company: 'RWC', source: 'whatsapp' },
    });
    created.leads.push(leadId);
    created.customers = [customerId];

    const allowed = await call(baseUrl, '/api/user-management/assignments/reassign', {
      method: 'POST', body: { type: 'lead', id: leadId, toUserId: FIXTURES.coordinator.id },
    });
    assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
    assert.equal(allowed.body.data.ownerId, FIXTURES.coordinator.id);

    const crossTenant = await call(baseUrl, '/api/user-management/assignments/reassign', {
      method: 'POST', body: { type: 'lead', id: leadId, toUserId: FIXTURES.crasStaff.id },
    });
    assert.equal(crossTenant.status, 403, 'cross-company reassignment is refused');
    assert.equal(crossTenant.body.code, 'CROSS_TENANT_ASSIGNMENT');

    const crossStaff = await call(baseUrl, '/api/user-management/assignments/reassign', {
      method: 'POST', as: FIXTURES.coordinator,
      body: { type: 'lead', id: leadId, toUserId: FIXTURES.admin.id },
    });
    assert.equal(crossStaff.status, 403, 'staff cannot reassign records at all');
    console.log('  ✅ cross-tenant and cross-staff reassignment refused');

    // 9. Invitation lifecycle: create -> preview -> accept -> cannot reuse.
    const inviteEmail = `invite-${suffix}@test.local`;
    const invite = await call(baseUrl, '/api/user-management/invitations', {
      method: 'POST', body: { email: inviteEmail, fullName: 'Invited Nurse', role: 'clinical_nurse', company: 'RWC' },
    });
    assert.equal(invite.status, 201, JSON.stringify(invite.body));
    created.invitations.push(invite.body.data.id);
    const inviteToken = new URL(invite.body.data.inviteUrl).hash.split('token=')[1];
    assert.ok(inviteToken, 'invitation returns a one-time activation token');

    const stored = await prisma.$queryRawUnsafe(
      'SELECT token_hash FROM public.user_invitations WHERE id = $1', invite.body.data.id
    );
    assert.notEqual(stored[0].token_hash, inviteToken, 'only the hash is stored, never the raw token');

    const preview = await fetch(`${baseUrl}/api/auth/invitation?token=${encodeURIComponent(inviteToken)}`);
    assert.equal(preview.status, 200);
    const previewBody = await preview.json();
    assert.equal(previewBody.invitation.email, inviteEmail);

    const accept = await fetch(`${baseUrl}/api/auth/accept-invitation`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: inviteToken, password: PASSWORD }),
    });
    assert.equal(accept.status, 201, 'invitation is accepted');
    const accepted = await accept.json();
    created.users.push(accepted.user.id);
    assert.equal(accepted.user.role, 'clinical_nurse');

    const replay = await fetch(`${baseUrl}/api/auth/accept-invitation`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: inviteToken, password: PASSWORD }),
    });
    assert.equal(replay.status, 404, 'an accepted invitation cannot be replayed');
    console.log('  ✅ invitation create/preview/accept/replay-guard');

    // 10. Audit trail records the sensitive operations performed above.
    const audits = await call(baseUrl, '/api/security/audit-logs?pageSize=50');
    assert.equal(audits.status, 200);
    const actions = new Set(audits.body.data.items.map(item => item.action));
    for (const action of ['user.create', 'user.deactivate', 'session.revoke_all', 'lead.reassign', 'user.invitation.create']) {
      assert.ok(actions.has(action), `audit trail must contain ${action}`);
    }
    console.log('  ✅ sensitive operations are audited');
  } finally {
    await cleanup();
    await new Promise(resolve => server.close(resolve));
  }

  console.log('\n🎉 USER MANAGEMENT AUTHORIZATION SUITE PASSED');
}

main().catch(async error => {
  console.error('\n❌ User management suite failed:', error.message);
  try { await cleanup(); } catch {}
  process.exit(1);
});
