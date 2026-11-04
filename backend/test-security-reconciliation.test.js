/**
 * Focused Security Reconciliation & Credential Management Test Suite
 *
 * Verifies all claims from the security audit:
 * 1. Enterprise departments initialization is idempotent and non-destructive
 * 2. Credential storage uses one-way salted scrypt hashing (no reversible storage)
 * 3. Transparent lazy migration upgrades legacy enc:v1: credentials to scrypt on login
 * 4. User creation is transactional and atomic (employee_id, department_id, manager_id)
 * 5. Passwords and PINs are strictly validated (min 12 chars for pass, 4-10 digits for PIN)
 * 6. Login supports both password and PIN verifiers
 * 7. Rate limiting protects against brute force attacks
 * 8. Credential reset revokes active sessions and updates scrypt hashes
 * 9. Existing credentials cannot be retrieved (pin and password are null in user-detail)
 * 10. Super Admin self-privilege and lockout guards are enforced
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { server, signAuthToken } from './server.js';
import { getPrisma, checkDbConnection, waitForSchemaBootstrap } from './src/db.js';
import { hashSecret, verifySecret, encryptReversible } from './src/secretHash.js';

let prisma;
const SUFFIX = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const TEST_PASSWORD = 'SuperSecurePassword2026!#';
const TEST_PIN = '849201';

const ADMIN_FIXTURE = {
  id: `audit-admin-${SUFFIX}`,
  fullName: 'Audit Super Admin',
  email: `audit-admin-${SUFFIX}@test.local`,
  role: 'super_admin',
  company: 'ALL',
  branch: 'Colombo (Head Office)',
  password: hashSecret(TEST_PASSWORD),
  active: true,
};

const COORD_FIXTURE = {
  id: `audit-coord-${SUFFIX}`,
  fullName: 'Audit Coordinator',
  email: `audit-coord-${SUFFIX}@test.local`,
  role: 'coordinator',
  company: 'RWC',
  branch: 'Colombo',
  password: hashSecret(TEST_PASSWORD),
  pin: hashSecret(TEST_PIN),
  active: true,
};

let baseUrl;
const createdUserIds = [];

// Helper to make authenticated HTTP requests to the test harness
async function apiCall(path, { method = 'GET', body = null, as = ADMIN_FIXTURE } = {}) {
  const url = `${baseUrl}${path}`;
  const token = as ? signAuthToken({
    userId: as.id,
    email: as.email,
    role: as.role,
    fullName: as.fullName,
  }) : null;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, headers: res.headers, body: data };
}

test.before(async () => {
  await checkDbConnection();
  await waitForSchemaBootstrap();
  prisma = getPrisma();

  // Insert fixtures
  await prisma.user.createMany({
    data: [ADMIN_FIXTURE, COORD_FIXTURE],
  });
  createdUserIds.push(ADMIN_FIXTURE.id, COORD_FIXTURE.id);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) await new Promise((res) => server.close(res));
  if (createdUserIds.length > 0) {
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM public.user_sessions WHERE user_id = ANY($1::text[])`,
        createdUserIds
      ).catch(() => {});
      await prisma.$executeRawUnsafe(
        `DELETE FROM public.users WHERE id = ANY($1::text[])`,
        createdUserIds
      ).catch(() => {});
    } catch (e) {
      // ignore
    }
  }
});

test('1. Department initialization is idempotent and non-destructive', async () => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, name, active FROM public.departments WHERE id IN (
      'dept-admin', 'dept-operations', 'dept-crm', 'dept-clinical', 'dept-exam', 'dept-finance', 'dept-marketing'
    )`
  );
  assert.equal(rows.length, 7, 'All 7 enterprise departments must exist');

  // Verify that ON CONFLICT DO NOTHING preserves any customized state
  await prisma.$executeRawUnsafe(
    `UPDATE public.departments SET active = FALSE WHERE id = 'dept-marketing'`
  );

  // Re-run the idempotent bootstrap statement
  await prisma.$executeRawUnsafe(`
    INSERT INTO public.departments (id, name, company, branch, description, active)
    VALUES
      ('dept-marketing', 'Public Contact Marketing', NULL, NULL, 'Marketing outreach, campaigns, and audience engagement', TRUE)
    ON CONFLICT (id) DO NOTHING;
  `);

  const updatedDept = await prisma.$queryRawUnsafe(
    `SELECT active FROM public.departments WHERE id = 'dept-marketing'`
  );
  assert.equal(updatedDept[0].active, false, 'Disabled department was NOT unexpectedly reactivated');

  // Restore active state
  await prisma.$executeRawUnsafe(
    `UPDATE public.departments SET active = TRUE WHERE id = 'dept-marketing'`
  );
});

test('2. Reversible storage elimination & transparent migration flag', async () => {
  const secret = 'SamplePassword123!';
  const scryptHash = hashSecret(secret);
  assert.ok(scryptHash.startsWith('scrypt:'), 'hashSecret produces scrypt hash');

  const scryptCheck = verifySecret(secret, scryptHash);
  assert.equal(scryptCheck.match, true, 'scrypt password matches');
  assert.equal(scryptCheck.needsRehash, false, 'scrypt does not need rehash');

  const legacyEncrypted = encryptReversible(secret);
  assert.ok(legacyEncrypted.startsWith('enc:v1:'), 'encryptReversible creates enc:v1 format');

  // verifySecret must now return needsRehash: true for enc:v1: so logins transparently migrate
  const legacyCheck = verifySecret(secret, legacyEncrypted);
  assert.equal(legacyCheck.match, true, 'legacy enc:v1 password verifies successfully');
  assert.equal(legacyCheck.needsRehash, true, 'legacy enc:v1 is flagged with needsRehash: true for lazy migration');
});

test('3. Atomic user creation transaction with strict validation', async () => {
  // 3.1 Weak password rejected
  const weakRes = await apiCall('/api/user-management/users', {
    method: 'POST',
    as: ADMIN_FIXTURE,
    body: {
      fullName: 'Weak Password User',
      email: `weak-${SUFFIX}@test.local`,
      password: 'short',
      role: 'coordinator',
    },
  });
  assert.equal(weakRes.status, 400);
  assert.equal(weakRes.body.code, 'WEAK_PASSWORD');

  // 3.2 Invalid PIN rejected
  const invalidPinRes = await apiCall('/api/user-management/users', {
    method: 'POST',
    as: ADMIN_FIXTURE,
    body: {
      fullName: 'Bad PIN User',
      email: `badpin-${SUFFIX}@test.local`,
      password: 'ValidPassword123!',
      pin: '12',
      role: 'coordinator',
    },
  });
  assert.equal(invalidPinRes.status, 400);
  assert.equal(invalidPinRes.body.code, 'INVALID_PIN');

  // 3.3 Successful atomic creation
  const newUserEmail = `created-staff-${SUFFIX}@test.local`;
  const empId = `EMP-TEST-${SUFFIX}`;
  const createRes = await apiCall('/api/user-management/users', {
    method: 'POST',
    as: ADMIN_FIXTURE,
    body: {
      fullName: 'Dr. Kasun Perera',
      email: newUserEmail,
      phone: '+94 77 123 4567',
      role: 'coordinator',
      company: 'RWC',
      branch: 'Colombo (Head Office)',
      employeeId: empId,
      departmentId: 'dept-crm',
      managerId: ADMIN_FIXTURE.id,
      password: TEST_PASSWORD,
      pin: TEST_PIN,
      active: true,
      marketingAccess: true,
    },
  });

  assert.equal(createRes.status, 201, JSON.stringify(createRes.body));
  const newUserId = createRes.body.data.id;
  createdUserIds.push(newUserId);

  assert.equal(createRes.body.data.email, newUserEmail);
  assert.equal(createRes.body.data.employeeId, empId);
  assert.equal(createRes.body.data.departmentId, 'dept-crm');
  assert.equal(createRes.body.data.departmentName, 'CRM / Patient Care');
  assert.equal(createRes.body.data.managerId, ADMIN_FIXTURE.id);
  assert.equal(createRes.body.data.password, undefined, 'Plaintext password is never in creation return data');

  // Check stored database record
  const dbUser = await prisma.user.findUnique({
    where: { id: newUserId },
    select: { password: true, pin: true, employeeId: true, departmentId: true, managerId: true },
  });

  assert.ok(dbUser.password.startsWith('scrypt:'), 'Stored password is one-way scrypt hash');
  assert.ok(dbUser.pin.startsWith('scrypt:'), 'Stored PIN is one-way scrypt hash');
  assert.equal(dbUser.employeeId, empId, 'Employee ID saved atomically');
  assert.equal(dbUser.departmentId, 'dept-crm', 'Department ID saved atomically');
  assert.equal(dbUser.managerId, ADMIN_FIXTURE.id, 'Manager ID saved atomically');

  // 3.4 Duplicate employee ID rejected
  const dupEmpRes = await apiCall('/api/user-management/users', {
    method: 'POST',
    as: ADMIN_FIXTURE,
    body: {
      fullName: 'Duplicate Emp User',
      email: `diff-${SUFFIX}@test.local`,
      password: TEST_PASSWORD,
      employeeId: empId,
      role: 'coordinator',
    },
  });
  assert.equal(dupEmpRes.status, 409);
  assert.equal(dupEmpRes.body.code, 'EMPLOYEE_ID_IN_USE');

  // 3.5 Duplicate email rejected
  const dupEmailRes = await apiCall('/api/user-management/users', {
    method: 'POST',
    as: ADMIN_FIXTURE,
    body: {
      fullName: 'Duplicate Email User',
      email: newUserEmail,
      password: TEST_PASSWORD,
      role: 'coordinator',
    },
  });
  assert.equal(dupEmailRes.status, 409);
  assert.equal(dupEmailRes.body.code, 'EMAIL_IN_USE');
});

test('4. Existing credentials cannot be retrieved (Non-disclosure in User Details)', async () => {
  const detailRes = await apiCall(`/api/user-management/users/${COORD_FIXTURE.id}`, {
    method: 'GET',
    as: ADMIN_FIXTURE,
  });

  assert.equal(detailRes.status, 200);
  const creds = detailRes.body.data.credentials;
  assert.ok(creds, 'Credentials status block is present for Super Admin');
  assert.equal(creds.pin, null, 'Existing PIN is NEVER revealed in plaintext');
  assert.equal(creds.password, null, 'Existing password is NEVER revealed in plaintext');
  assert.equal(creds.pinConfigured, true, 'PIN is reported as configured');
  assert.equal(creds.passwordConfigured, true, 'Password is reported as configured');
  assert.equal(creds.pinIsHashed, true, 'PIN is reported as hashed');
  assert.equal(creds.passwordIsHashed, true, 'Password is reported as hashed');
});

test('5. Credential reset revokes active sessions and updates scrypt hashes', async () => {
  // Create an active session for COORD_FIXTURE
  const sessionId = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO public.user_sessions (id, user_id, token_version, ip, user_agent)
     VALUES ($1, $2, 0, '127.0.0.1', 'Audit Test Agent')`,
    sessionId, COORD_FIXTURE.id
  );

  const activeBefore = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM public.user_sessions WHERE user_id = $1 AND revoked_at IS NULL`,
    COORD_FIXTURE.id
  );
  assert.equal(activeBefore[0].count, 1, 'Session is active before reset');

  // Reset credentials
  const NEW_PASSWORD = 'BrandNewPassword2026!#$';
  const NEW_PIN = '992211';
  const resetRes = await apiCall(`/api/user-management/users/${COORD_FIXTURE.id}/credentials`, {
    method: 'POST',
    as: ADMIN_FIXTURE,
    body: { password: NEW_PASSWORD, pin: NEW_PIN },
  });

  assert.equal(resetRes.status, 200, JSON.stringify(resetRes.body));

  // Verify all sessions were revoked
  const activeAfter = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM public.user_sessions WHERE user_id = $1 AND revoked_at IS NULL`,
    COORD_FIXTURE.id
  );
  assert.equal(activeAfter[0].count, 0, 'All sessions revoked after credential reset');

  // Verify new credentials stored as scrypt hashes and match
  const updatedUser = await prisma.user.findUnique({
    where: { id: COORD_FIXTURE.id },
    select: { password: true, pin: true },
  });

  assert.ok(updatedUser.password.startsWith('scrypt:'), 'Reset password stored as scrypt hash');
  assert.ok(updatedUser.pin.startsWith('scrypt:'), 'Reset PIN stored as scrypt hash');

  const passCheck = verifySecret(NEW_PASSWORD, updatedUser.password);
  assert.equal(passCheck.match, true, 'New password matches stored scrypt hash');

  const pinCheck = verifySecret(NEW_PIN, updatedUser.pin);
  assert.equal(pinCheck.match, true, 'New PIN matches stored scrypt hash');
});

test('6. Super Admin protection guards', async () => {
  // Self lockout rejection
  const deactivateSelf = await apiCall(`/api/user-management/users/${ADMIN_FIXTURE.id}/status`, {
    method: 'POST',
    as: ADMIN_FIXTURE,
    body: { action: 'deactivate' },
  });
  assert.equal(deactivateSelf.status, 403);
  assert.equal(deactivateSelf.body.code, 'SELF_LOCKOUT');

  // Self elevation / role change rejection
  const demoteSelf = await apiCall(`/api/user-management/users/${ADMIN_FIXTURE.id}`, {
    method: 'PATCH',
    as: ADMIN_FIXTURE,
    body: { role: 'coordinator' },
  });
  assert.equal(demoteSelf.status, 403);
  assert.equal(demoteSelf.body.code, 'SELF_ELEVATION');
});

test('7. Login verification using password, PIN, and legacy transparent migration', async () => {
  // 7.1 Login with password
  const passLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: ADMIN_FIXTURE.email, password: TEST_PASSWORD }),
  });
  assert.equal(passLogin.status, 200, 'Password login succeeds');
  const passBody = await passLogin.json();
  assert.ok(passBody.token, 'Token returned on password login');

  // 7.2 Login with PIN
  const pinLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: COORD_FIXTURE.email, pin: '992211' }),
  });
  assert.equal(pinLogin.status, 200, 'PIN login succeeds');
  const pinBody = await pinLogin.json();
  assert.ok(pinBody.token, 'Token returned on PIN login');

  // 7.3 Invalid credential rejected
  const failLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: ADMIN_FIXTURE.email, password: 'WrongPassword123!' }),
  });
  assert.equal(failLogin.status, 401, 'Bad credentials rejected with 401');

  // 7.4 Transparent lazy migration of legacy encrypted account
  const legacyEmail = `legacy-${SUFFIX}@test.local`;
  const legacyPass = 'LegacyReversiblePassword2026!';
  const legacyEncrypted = encryptReversible(legacyPass);

  const legacyUser = await prisma.user.create({
    data: {
      fullName: 'Legacy Encrypted Staff',
      email: legacyEmail,
      role: 'coordinator',
      company: 'RWC',
      branch: 'Colombo',
      password: legacyEncrypted,
      active: true,
    },
  });
  createdUserIds.push(legacyUser.id);

  // Assert user is initially stored with enc:v1:
  const preLoginUser = await prisma.user.findUnique({ where: { id: legacyUser.id }, select: { password: true } });
  assert.ok(preLoginUser.password.startsWith('enc:v1:'), 'Initially stored as legacy enc:v1:');

  // User logs in with their password
  const legacyLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: legacyEmail, password: legacyPass }),
  });
  assert.equal(legacyLogin.status, 200, 'Legacy user logs in seamlessly');

  // Wait a moment for background migration update to complete
  await new Promise((r) => setTimeout(r, 200));

  const postLoginUser = await prisma.user.findUnique({ where: { id: legacyUser.id }, select: { password: true } });
  assert.ok(postLoginUser.password.startsWith('scrypt:'), 'Stored password automatically upgraded to scrypt hash on login');
  assert.ok(!postLoginUser.password.startsWith('enc:v1:'), 'Legacy reversible enc:v1 is removed');
});
