import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderKey } from '../../src/examOperations.js';
import { StudentAccess } from '../../src/studentAccess.js';
import { TestStore, fails, unsealPayload, JWT_SECRET } from './fixtures/testHarness.js';
import { superAdmin, examManager, salesOfficer } from './fixtures/actors.js';

test('UAT 5: Student Account Provisioning & Secure Activation (Happy Path)', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const email = 'fatima.zahra@example.com';
  const studentId = orderKey(email);

  // 1. Initial student record created in PENDING status
  await store.transaction(tx =>
    tx.put('student', studentId, {
      id: studentId,
      name: 'Dr. Fatima Al-Zahra',
      email,
      status: 'PENDING',
      generation: 0
    })
  );

  // 2. Super Admin queues invitation
  const inviteRes = await access.invite(superAdmin, studentId, 'http://localhost:5173');
  assert.equal(inviteRes.queued, true);

  // 3. Extract invitation token from sealed outbox email
  const outboxItem = store.rows.get([...store.rows.keys()].find(k => k.startsWith('outbox:')));
  assert.ok(outboxItem);
  const mail = unsealPayload(access, outboxItem.payload);
  assert.ok(mail.link, 'Email must contain activation link');
  const token = mail.link.split('#activate=')[1];
  assert.ok(token, 'Activation token must be extracted');

  // 4. Student activates with strong password (>= 15 characters)
  const password = 'CorrectHorseBatteryStaple2026!';
  const browser = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0';
  const session = await access.activate(token, password, browser);

  assert.ok(session.token, 'Active session token must be returned');
  assert.equal(session.student.id, studentId);
  assert.equal(session.student.email, email);

  // 5. Verify database record
  const studentRow = await store.transaction(tx => tx.get('student', studentId));
  assert.equal(studentRow.status, 'ACTIVE');
  assert.ok(studentRow.activatedAt);
  assert.ok(studentRow.emailVerifiedAt);
  assert.ok(studentRow.passwordHash, 'Password must be hashed');
  assert.equal(studentRow.passwordHash.includes(':'), true, 'Password hash format must be salt:digest');
  assert.equal(studentRow.passwordHash.includes(password), false, 'Plaintext password must NEVER be stored');

  // 6. Challenge token must be marked consumed
  const challenge = [...store.rows.values()].find(v => v.purpose === 'activate');
  assert.equal(challenge.consumed, true);
});

test('UAT 5: Negative Path — Weak password (< 15 chars or common pattern) rejected', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const email = 'short.pass@example.com';
  const studentId = orderKey(email);

  await store.transaction(tx =>
    tx.put('student', studentId, { id: studentId, name: 'Student', email, status: 'PENDING', generation: 0 })
  );
  await access.invite(superAdmin, studentId, 'http://localhost:5173');
  const outboxItem = store.rows.get([...store.rows.keys()].find(k => k.startsWith('outbox:')));
  const token = unsealPayload(access, outboxItem.payload).link.split('#activate=')[1];

  // Password < 15 chars
  await fails(access.activate(token, 'Short123!', 'browser-1'), 'PASSWORD_POLICY');
  // Common repeated character password
  await fails(access.activate(token, 'aaaaaaaaaaaaaaaa', 'browser-1'), 'PASSWORD_POLICY');
  // Common word prefix
  await fails(access.activate(token, 'password123456789', 'browser-1'), 'PASSWORD_POLICY');
});

test('UAT 5: Negative Path — Reusing consumed activation token rejected', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const email = 'reused.token@example.com';
  const studentId = orderKey(email);

  await store.transaction(tx =>
    tx.put('student', studentId, { id: studentId, name: 'Student', email, status: 'PENDING', generation: 0 })
  );
  await access.invite(superAdmin, studentId, 'http://localhost:5173');
  const outboxItem = store.rows.get([...store.rows.keys()].find(k => k.startsWith('outbox:')));
  const token = unsealPayload(access, outboxItem.payload).link.split('#activate=')[1];

  // First activation succeeds
  await access.activate(token, 'ValidPassphrase2026!#Secure', 'browser-1');

  // Second activation attempt with same token fails
  await fails(access.activate(token, 'ValidPassphrase2026!#Secure', 'browser-1'), 'INVALID_ACTIVATION');
});

test('UAT 5: Negative Path — Non-admin cannot trigger student activation invitation', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const studentId = orderKey('sales.invite@example.com');

  await store.transaction(tx =>
    tx.put('student', studentId, { id: studentId, name: 'Student', email: 'sales.invite@example.com', status: 'PENDING', generation: 0 })
  );

  // Sales Officer calling invite
  await fails(access.invite(salesOfficer, studentId, 'http://localhost:5173'), 'FORBIDDEN');
  // Exam Manager calling invite
  await fails(access.invite(examManager, studentId, 'http://localhost:5173'), 'FORBIDDEN');
});

test('UAT 5: Timing-Attack Defense — Nonexistent account vs wrong password return identical error', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const email = 'active.student@example.com';
  const studentId = orderKey(email);
  const passwordHash = await access.hashPassword('SuperSecretPassphrase2026!');

  await store.transaction(tx =>
    tx.put('student', studentId, {
      id: studentId,
      name: 'Active Student',
      email,
      status: 'ACTIVE',
      generation: 0,
      passwordHash,
      browserDigest: access.digest('browser-1')
    })
  );

  // Nonexistent email
  await fails(access.login('nonexistent@example.com', 'SuperSecretPassphrase2026!', 'browser-1'), 'INVALID_LOGIN');
  // Existing email with wrong password
  await fails(access.login(email, 'WrongPasswordEntirely12345!', 'browser-1'), 'INVALID_LOGIN');
});
