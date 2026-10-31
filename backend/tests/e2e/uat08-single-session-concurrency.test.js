import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderKey } from '../../src/examOperations.js';
import { StudentAccess } from '../../src/studentAccess.js';
import { TestStore, fails, unsealPayload, JWT_SECRET } from './fixtures/testHarness.js';

async function setupActiveStudentWithEntitlement(email = 'concurrency.student@example.com') {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const studentId = orderKey(email);
  const password = 'StrongConcurrentPassphrase2026!';
  const passwordHash = await access.hashPassword(password);
  const nowIso = new Date().toISOString();

  await store.transaction(async tx => {
    await tx.put('student', studentId, {
      id: studentId,
      name: 'Concurrent Test Student',
      email,
      status: 'ACTIVE',
      generation: 1,
      passwordHash,
      browserDigest: access.digest('device-1-browser')
    });
    await tx.put('asset', 'mat-core-test', { id: 'mat-core-test', title: 'Test Guide', status: 'PUBLISHED' });
    await tx.put('entitlement', 'ent-test-01', {
      id: 'ent-test-01',
      studentId,
      ownerId: studentId,
      materialIds: ['mat-core-test'],
      status: 'ACTIVE',
      startsAt: nowIso,
      endsAt: new Date(Date.now() + 90 * 86400000).toISOString()
    });
  });

  return { store, access, studentId, email, password };
}

test('UAT 8: Single Concurrent Session Enforcement (Login on Device 2 Terminates Device 1)', async () => {
  const { store, access, email, password } = await setupActiveStudentWithEntitlement();

  // 1. Student logs into Device 1 (Windows Laptop)
  const session1 = await access.login(email, password, 'device-1-browser');
  assert.ok(session1.token, 'Device 1 session token generated');

  // Verify Device 1 can browse portal
  const portal1 = await access.portal(session1.token, 'device-1-browser');
  assert.equal(portal1.accesses.length, 1);

  // 2. Student logs into Device 2 (iPhone) - triggers new device challenge
  const challenge = await access.login(email, password, 'device-2-browser');
  assert.equal(challenge.requiresOtp, true);

  // Extract OTP code from outbox
  const mail = [...store.rows.values()].find(x => x.purpose === 'device-code');
  assert.ok(mail);
  const code = unsealPayload(access, mail.payload).code;

  // Verify Device 2 with OTP -> establishes session on Device 2
  const session2 = await access.verifyDevice(challenge.challengeId, code, 'device-2-browser');
  assert.ok(session2.token, 'Device 2 session token generated');

  // 3. Device 2 session is active and functional
  const portal2 = await access.portal(session2.token, 'device-2-browser');
  assert.equal(portal2.accesses.length, 1);

  // 4. Device 1 session must be IMMEDIATELY invalidated
  await fails(access.portal(session1.token, 'device-1-browser'), 'SESSION_EXPIRED');

  // 5. Subsequent attempts to authenticate with Device 1 token reject
  await store.transaction(async tx => {
    await fails(access.authenticate(tx, session1.token, 'device-1-browser'), 'SESSION_EXPIRED');
  });
});

test('UAT 8: Token Replay Defense — Replayed revoked session tokens fail with SESSION_EXPIRED', async () => {
  const { store, access, email, password } = await setupActiveStudentWithEntitlement();

  const session1 = await access.login(email, password, 'device-1-browser');
  const challenge = await access.login(email, password, 'device-2-browser');
  const mail = [...store.rows.values()].find(x => x.purpose === 'device-code');
  const code = unsealPayload(access, mail.payload).code;
  await access.verifyDevice(challenge.challengeId, code, 'device-2-browser');

  // Replay attempt with old session 1 token multiple times
  for (let i = 0; i < 3; i++) {
    await fails(access.portal(session1.token, 'device-1-browser'), 'SESSION_EXPIRED');
  }
});

test('UAT 8: Explicit Logout Terminates Session Immediately', async () => {
  const { access, email, password } = await setupActiveStudentWithEntitlement();

  const session = await access.login(email, password, 'device-1-browser');
  await access.portal(session.token, 'device-1-browser');

  // Explicit logout
  await access.logout(session.token, 'device-1-browser');

  // Access after logout is blocked
  await fails(access.portal(session.token, 'device-1-browser'), 'SESSION_EXPIRED');
});
