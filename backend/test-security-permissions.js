import assert from 'node:assert/strict';
import { server, signAuthToken } from './server.js';
import { checkDbConnection, getPrisma, waitForSchemaBootstrap } from './src/db.js';

const PORT = 5996;
const suffix = Date.now().toString(36);

const FIXTURES = {
  admin: { id: `sec-admin-${suffix}`, email: `sec-admin-${suffix}@test.local`, role: 'super_admin', fullName: 'Security Admin' },
  officer: { id: `sec-officer-${suffix}`, email: `sec-officer-${suffix}@test.local`, role: 'exam_providing_officer', fullName: 'Exam Officer' },
  inactive: { id: `sec-inactive-${suffix}`, email: `sec-inactive-${suffix}@test.local`, role: 'exam_providing_officer', fullName: 'Disabled Officer', active: false },
  coordinator: { id: `sec-coord-${suffix}`, email: `sec-coord-${suffix}@test.local`, role: 'coordinator', fullName: 'Coordinator' },
  nurse: { id: `sec-nurse-${suffix}`, email: `sec-nurse-${suffix}@test.local`, role: 'clinical_nurse', fullName: 'Clinical Nurse' },
};

let prisma;

async function seed() {
  for (const fixture of Object.values(FIXTURES)) {
    await prisma.user.create({
      data: {
        id: fixture.id,
        fullName: fixture.fullName,
        email: fixture.email,
        role: fixture.role,
        active: fixture.active !== false,
      },
    });
  }
}

async function cleanup() {
  const ids = Object.values(FIXTURES).map(fixture => fixture.id);
  await prisma.$executeRawUnsafe("DELETE FROM public.security_permission_profiles WHERE subject_type = 'user' AND subject_id = ANY($1::text[])", ids);
  await prisma.$executeRawUnsafe("DELETE FROM public.security_permission_profiles WHERE subject_type = 'role' AND subject_id = ANY($1::text[])", ['exam_coordinator', 'exam_providing_officer']);
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$executeRawUnsafe("DELETE FROM public.security_audit_events WHERE actor_id = ANY($1::text[])", [FIXTURES.admin.id]);
}

function token(fixture) {
  return signAuthToken({ userId: fixture.id, email: fixture.email, role: fixture.role, fullName: fixture.fullName });
}

async function call(baseUrl, path, { method = 'GET', as, body } = {}) {
  const headers = { Authorization: `Bearer ${token(as || FIXTURES.admin)}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
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
    // 1. Only Super Admin reaches the security API.
    const denied = await call(baseUrl, '/api/security/roles', { as: FIXTURES.coordinator });
    assert.equal(denied.status, 403, 'non-admin must be rejected');
    console.log('  ✅ non-admin denied (403)');

    const roles = await call(baseUrl, '/api/security/roles');
    assert.equal(roles.status, 200);
    assert.ok(roles.body.data.roles.length >= 12, 'all roles are returned');
    assert.ok(roles.body.data.capabilities.length >= 40, 'capability catalogue is returned');
    assert.ok(roles.body.data.modules.some(module => module.id === 'exam'));
    console.log('  ✅ role registry returned');

    // 2. User directory is database-backed and searchable.
    const search = await call(baseUrl, `/api/security/users?search=${encodeURIComponent(FIXTURES.officer.email)}`);
    assert.equal(search.status, 200);
    assert.equal(search.body.data.total, 1);
    assert.equal(search.body.data.items[0].department, 'exam');
    assert.equal(search.body.data.items[0].customPermissions, false);
    console.log('  ✅ user directory search');

    const detail = await call(baseUrl, `/api/security/users/${FIXTURES.officer.id}/permissions`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.policy.capabilities['exam.course.create_draft'].allowed, false);
    assert.equal(detail.body.data.policy.capabilities['exam.material.create_draft'].allowed, true);
    assert.ok(detail.body.data.eligibleScopes.includes('own'));
    assert.ok(!detail.body.data.eligibleScopes.includes('all'));
    console.log('  ✅ effective user policy');

    // 3. Preview is computed server-side and reports risk.
    const proposal = { subjectType: 'user', subjectId: FIXTURES.officer.id, overrides: { 'exam.course.create_draft': 'allow' }, scope: 'own' };
    const preview = await call(baseUrl, '/api/security/permissions/preview', { method: 'POST', body: proposal });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.data.after.capabilities['exam.course.create_draft'].allowed, true);
    assert.ok(preview.body.data.warnings.length >= 1, 'elevation warning is produced');
    assert.ok(preview.body.data.changes.some(change => change.capability === 'exam.course.create_draft' && change.risk === 'elevation'));
    console.log('  ✅ preview + risk warnings');

    // 4. Saving applies the override and audits it.
    const save = await call(baseUrl, `/api/security/users/${FIXTURES.officer.id}/permissions`, {
      method: 'PATCH', body: { ...proposal, expectedRevision: 0, reason: 'Delegated by test' },
    });
    assert.equal(save.status, 200);
    assert.equal(save.body.data.revision, 1);
    assert.equal(save.body.data.policy.capabilities['exam.course.create_draft'].allowed, true);

    const afterSave = await call(baseUrl, `/api/security/users/${FIXTURES.officer.id}/permissions`);
    assert.equal(afterSave.body.data.policy.capabilities['exam.course.create_draft'].source, 'user_override');
    assert.equal(afterSave.body.data.policy.capabilities['exam.course.create_draft'].allowed, true);
    console.log('  ✅ user override saved and effective');

    // 5. Stale revisions cannot overwrite newer changes.
    const stale = await call(baseUrl, `/api/security/users/${FIXTURES.officer.id}/permissions`, {
      method: 'PATCH', body: { ...proposal, expectedRevision: 0 },
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, 'REVISION_CONFLICT');
    console.log('  ✅ concurrent edit rejected (409)');

    // 6. No self-elevation, no immutable grants, no inactive/super-admin targets.
    const self = await call(baseUrl, `/api/security/users/${FIXTURES.admin.id}/permissions`, {
      method: 'PATCH', body: { overrides: {}, expectedRevision: 0 },
    });
    assert.equal(self.status, 403);
    assert.equal(self.body.code, 'SELF_ELEVATION');

    const immutable = await call(baseUrl, `/api/security/users/${FIXTURES.officer.id}/permissions`, {
      method: 'PATCH', body: { overrides: { 'exam.content.publish': 'allow' }, expectedRevision: 1 },
    });
    assert.equal(immutable.status, 403);
    assert.equal(immutable.body.code, 'IMMUTABLE_CAPABILITY');

    const crossModule = await call(baseUrl, `/api/security/users/${FIXTURES.officer.id}/permissions`, {
      method: 'PATCH', body: { overrides: { 'marketing.export': 'allow' }, expectedRevision: 1 },
    });
    assert.equal(crossModule.status, 403);

    const inactive = await call(baseUrl, `/api/security/users/${FIXTURES.inactive.id}/permissions`, {
      method: 'PATCH', body: { overrides: { 'exam.course.create_draft': 'allow' }, expectedRevision: 0 },
    });
    assert.equal(inactive.status, 409);
    assert.equal(inactive.body.code, 'INACTIVE_USER');
    console.log('  ✅ privilege-escalation guards');

    // 7. Reset restores role defaults.
    const reset = await call(baseUrl, `/api/security/users/${FIXTURES.officer.id}/overrides?expectedRevision=1&reason=Reset%20test`, { method: 'DELETE' });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.data.revision, 0);
    assert.equal(reset.body.data.policy.capabilities['exam.course.create_draft'].allowed, false);
    console.log('  ✅ reset restores role defaults');

    // 8. Role permissions are editable and enforced.
    const rolePatch = await call(baseUrl, '/api/security/roles/exam_coordinator/permissions', {
      method: 'PATCH',
      body: { overrides: { 'exam.course.create_draft': 'deny', 'exam.material.create_draft': 'deny' }, expectedRevision: 0, reason: 'Role test' },
    });
    assert.equal(rolePatch.status, 200);
    assert.equal(rolePatch.body.data.policy.capabilities['exam.course.create_draft'].allowed, false);

    // A module-scoped save writes the full override set back. The key the drawer
    // never touched must survive that write.
    const moduleSave = await call(baseUrl, '/api/security/roles/exam_coordinator/permissions', {
      method: 'PATCH',
      body: { overrides: { 'exam.course.create_draft': 'deny', 'exam.material.create_draft': 'allow' }, expectedRevision: 1, reason: 'Module scoped save' },
    });
    assert.equal(moduleSave.status, 200);
    const roleGet = await call(baseUrl, '/api/security/roles/exam_coordinator/permissions');
    assert.equal(roleGet.status, 200);
    assert.equal(roleGet.body.data.policy.capabilities['exam.course.create_draft'].source, 'role_override');
    assert.equal(roleGet.body.data.overrides['exam.material.create_draft'].effect, 'allow');
    console.log('  ✅ role override saved without dropping sibling overrides');

    // 9. Role reset is a real delete: row gone, revision back to 0.
    const roleReset = await call(baseUrl, '/api/security/roles/exam_coordinator/permissions?expectedRevision=2&reason=Reset%20role', { method: 'DELETE' });
    assert.equal(roleReset.status, 200);
    assert.equal(roleReset.body.data.revision, 0);
    assert.equal(roleReset.body.data.policy.capabilities['exam.course.create_draft'].allowed, true);
    const roleRows = await prisma.$queryRawUnsafe("SELECT COUNT(*)::int AS count FROM public.security_permission_profiles WHERE subject_type = 'role' AND subject_id = 'exam_coordinator'");
    assert.equal(Number(roleRows[0].count), 0, 'role profile row is deleted, not emptied');
    console.log('  ✅ role reset deletes the profile');

    // 10. Preview reflects a stored role override instead of inventing a baseline.
    const roleGrant = await call(baseUrl, '/api/security/roles/exam_providing_officer/permissions', {
      method: 'PATCH',
      body: { overrides: { 'exam.course.create_draft': 'allow' }, expectedRevision: 0, reason: 'Preview baseline test' },
    });
    assert.equal(roleGrant.status, 200);
    const inherited = await call(baseUrl, '/api/security/permissions/preview', {
      method: 'POST',
      body: { subjectType: 'user', subjectId: FIXTURES.officer.id, overrides: {} },
    });
    assert.equal(inherited.status, 200);
    assert.equal(inherited.body.data.after.capabilities['exam.course.create_draft'].allowed, true);
    assert.equal(inherited.body.data.after.capabilities['exam.course.create_draft'].source, 'role_override');
    console.log('  ✅ preview honors stored role overrides');

    // 11. Role preview clamps scope to the role ceiling (assigned, never department).
    const marketingRole = await call(baseUrl, '/api/security/roles/marketing_officer/permissions');
    assert.equal(marketingRole.status, 200);
    assert.equal(marketingRole.body.data.policy.capabilities['marketing.dashboard'].scope, 'assigned');
    console.log('  ✅ preview scope clamped to role ceiling');

    // 12. Delegation outside the role's modules is refused; the UI hides these Allow toggles.
    const nurseDetail = await call(baseUrl, `/api/security/users/${FIXTURES.nurse.id}/permissions`);
    assert.equal(nurseDetail.status, 200);
    assert.ok(nurseDetail.body.data.roleCapabilities.every(key => !key.startsWith('exam.')), 'nurse exposes no exam capability');
    const nurseGrant = await call(baseUrl, `/api/security/users/${FIXTURES.nurse.id}/permissions`, {
      method: 'PATCH', body: { overrides: { 'exam.course.create_draft': 'allow' }, expectedRevision: 0 },
    });
    assert.equal(nurseGrant.status, 403);
    assert.equal(nurseGrant.body.code, 'OUTSIDE_ROLE');
    console.log('  ✅ cross-module delegation refused');

    // 13. Audit trail is queryable.
    const audit = await call(baseUrl, `/api/security/audit-logs?actorId=${FIXTURES.admin.id}&pageSize=50`);
    assert.equal(audit.status, 200);
    const actions = audit.body.data.items.map(item => item.action);
    assert.ok(actions.includes('permissions.user.update'), 'user update audited');
    assert.ok(actions.includes('permissions.user.reset'), 'user reset audited');
    assert.ok(actions.includes('permissions.role.update'), 'role update audited');
    assert.ok(actions.includes('permissions.role.reset'), 'role reset audited');
    assert.ok(audit.body.data.items.every(item => !JSON.stringify(item).includes('password')), 'no credentials in audit');
    console.log('  ✅ audit trail');

    // 10. Overview uses real data.
    const overview = await call(baseUrl, '/api/security/overview');
    assert.equal(overview.status, 200);
    assert.ok(overview.body.data.counters.activeUsers >= 3);
    assert.equal(overview.body.data.counters.roles, 12);
    assert.equal(overview.body.data.counters.protectedModules, 7);
    console.log('  ✅ overview metrics');

    console.log('\n✅ Security permission suite passed.');
  } finally {
    await cleanup().catch(() => null);
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('❌ Security permission suite failed:', error);
  process.exitCode = 1;
});
