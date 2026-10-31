import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamOperations, orderKey } from '../../src/examOperations.js';
import { StudentAccess } from '../../src/studentAccess.js';
import { checkAcademicTransition } from '../../src/examPolicy.js';
import {
  TestStore,
  DevicePolicyManager,
  InteractiveMcqValidator,
  fails,
  unsealPayload,
  JWT_SECRET
} from './fixtures/testHarness.js';
import {
  superAdmin,
  examManager,
  examOfficer,
  salesOfficer,
  financeOfficer,
  examCoordinator
} from './fixtures/actors.js';
import {
  createSalesHandoffInput,
  createOrderRequirementInput,
  createSampleMcqQuestion
} from './fixtures/payloads.js';

// =============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise & Cross-Module Interactions)
// =============================================================================

test('Tier 3 [Comb 1]: Sales Handoff -> Finance Verification -> Maker-Checker Approval -> Entitlement Release', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const email = 'comb1.candidate@example.com';
  const studentId = orderKey(email);

  await store.transaction(tx => tx.put('asset', 'mat-comb-1', { id: 'mat-comb-1', title: 'Comb Materials', status: 'PUBLISHED' }));

  // 1. Sales submits handoff and requirement
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput({ clientEmail: email }));
  const req = await ops.submit(salesOfficer, createOrderRequirementInput({ email }));
  assert.equal(req.paymentStatus, 'PENDING');

  // 2. Head of Exam accepts handoff and assigns officer
  await ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 1 });
  await ops.updateHandoff(examManager, handoff.id, 'assign', { revision: 2, officerId: examOfficer.id, officerName: examOfficer.fullName });

  // 3. Finance independently verifies payment
  await ops.update(superAdmin, req.id, 'verify-payment', { revision: 1, reference: 'TXN-COMB-01' });

  // 4. Officer accepts assignment and progresses case
  await ops.updateHandoff(examOfficer, handoff.id, 'accept-assignment', { revision: 3 });
  await ops.updateHandoff(examOfficer, handoff.id, 'start', { revision: 4 });

  // 5. Officer prepares requirement checklist
  await ops.update(examManager, req.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, req.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, req.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  await ops.update(examManager, req.id, 'mark-email-verified', { revision: 5, reason: 'Verified' });
  await ops.update(examManager, req.id, 'transition', { revision: 6, status: 'READY' });
  await ops.update(examManager, req.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });

  // 6. Head of Exam approves and activates
  await ops.update(examManager, req.id, 'manager-approve', { revision: 8, reason: 'Approved' });
  const prepared = await ops.update(superAdmin, req.id, 'prepare-access', { revision: 9, materialIds: ['mat-comb-1'] });

  assert.ok(prepared.entitlementId);
  const entitlement = await store.transaction(tx => tx.get('entitlement', prepared.entitlementId));
  assert.equal(entitlement.studentId, studentId);
  assert.equal(entitlement.status, 'ACTIVE');
});

test('Tier 3 [Comb 2]: Activation Trigger Computing startsAt and endsAt dynamically', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const access = new StudentAccess(store, JWT_SECRET);
  const email = 'comb2.trigger@example.com';
  const studentId = orderKey(email);

  await store.transaction(tx => tx.put('asset', 'mat-trigger-1', { id: 'mat-trigger-1', title: 'Trigger Asset', status: 'PUBLISHED' }));

  const req = await ops.submit(salesOfficer, createOrderRequirementInput({ email, startTrigger: 'activation', durationDays: 60 }));
  await ops.update(superAdmin, req.id, 'verify-payment', { revision: 1, reference: 'TXN-COMB-02' });
  await ops.update(examManager, req.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, req.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, req.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  await ops.update(examManager, req.id, 'mark-email-verified', { revision: 5, reason: 'Verified' });
  await ops.update(examManager, req.id, 'transition', { revision: 6, status: 'READY' });
  await ops.update(examManager, req.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });
  await ops.update(examManager, req.id, 'manager-approve', { revision: 8, reason: 'Approved' });
  const prepared = await ops.update(superAdmin, req.id, 'prepare-access', { revision: 9, materialIds: ['mat-trigger-1'] });

  // Prior to student activation, startsAt is null
  let ent = await store.transaction(tx => tx.get('entitlement', prepared.entitlementId));
  assert.equal(ent.startsAt, null, 'startsAt must be null before student activation');

  // Super Admin invites student and student activates
  await access.invite(superAdmin, studentId, 'http://localhost:5173');
  const outboxItem = store.rows.get([...store.rows.keys()].find(k => k.startsWith('outbox:')));
  const token = unsealPayload(access, outboxItem.payload).link.split('#activate=')[1];
  await access.activate(token, 'ValidStrongPassphrase2026!', 'browser-comb');

  // After activation, startsAt and endsAt must be calculated
  ent = await store.transaction(tx => tx.get('entitlement', prepared.entitlementId));
  assert.ok(ent.startsAt, 'startsAt must be set to activation time');
  assert.ok(ent.endsAt, 'endsAt must be computed');
  const startMs = Date.parse(ent.startsAt);
  const endMs = Date.parse(ent.endsAt);
  assert.equal(Math.round((endMs - startMs) / 86400000), 60, 'Duration must equal 60 days');
});

test('Tier 3 [Comb 3]: Two-Device Gating + Ping-Pong Concurrent Session Termination', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const manager = new DevicePolicyManager(store);
  const email = 'comb3.pingpong@example.com';
  const studentId = orderKey(email);
  const password = 'PingPongSessionPassphrase2026!';
  const passwordHash = await access.hashPassword(password);
  const nowIso = new Date().toISOString();

  await store.transaction(async tx => {
    await tx.put('student', studentId, {
      id: studentId,
      email,
      status: 'ACTIVE',
      generation: 1,
      passwordHash,
      registeredDevices: [],
      browserDigest: access.digest('browser-mobile')
    });
    await tx.put('asset', 'mat-pp', { id: 'mat-pp', title: 'PP Guide', status: 'PUBLISHED' });
    await tx.put('entitlement', 'ent-pp', {
      id: 'ent-pp',
      studentId,
      ownerId: studentId,
      materialIds: ['mat-pp'],
      status: 'ACTIVE',
      startsAt: nowIso,
      endsAt: new Date(Date.now() + 30 * 86400000).toISOString()
    });
  });

  // Register permitted 2 devices
  await manager.registerDevice(studentId, { deviceId: 'iphone', deviceType: 'mobile' });
  await manager.registerDevice(studentId, { deviceId: 'thinkpad', deviceType: 'desktop' });

  // Login 1: Mobile
  const s1 = await access.login(email, password, 'browser-mobile');
  await access.portal(s1.token, 'browser-mobile');

  // Login 2: Laptop (switches active session)
  const ch1 = await access.login(email, password, 'browser-desktop');
  const code1 = unsealPayload(access, [...store.rows.values()].find(x => x.purpose === 'device-code').payload).code;
  const s2 = await access.verifyDevice(ch1.challengeId, code1, 'browser-desktop');

  // Mobile session is now terminated
  await fails(access.portal(s1.token, 'browser-mobile'), 'SESSION_EXPIRED');
  // Laptop session is active
  await access.portal(s2.token, 'browser-desktop');

  // Advance lastOtpAt past 60s cooldown for test speed
  await store.transaction(async tx => {
    const s = await tx.get('student', studentId, true);
    s.lastOtpAt = Date.now() - 65000;
    await tx.put('student', studentId, s);
  });

  // Login 3: Re-login from Mobile
  const ch2 = await access.login(email, password, 'browser-mobile');
  const code2 = unsealPayload(access, [...store.rows.values()].filter(x => x.purpose === 'device-code').pop().payload).code;
  const s3 = await access.verifyDevice(ch2.challengeId, code2, 'browser-mobile');

  // Laptop session is now terminated
  await fails(access.portal(s2.token, 'browser-desktop'), 'SESSION_EXPIRED');
  // Mobile session is active again
  await access.portal(s3.token, 'browser-mobile');
});

test('Tier 3 [Comb 4]: Academic Draft Lifecycle + MCQ Practice Validation', () => {
  // 1. Author drafts question
  const question = createSampleMcqQuestion({
    id: 'mcq-pediatric-01',
    created_by: examCoordinator.id,
    correctAnswer: 'B',
    status: 'Draft'
  });

  // 2. Author submits for review
  const status1 = checkAcademicTransition('Draft', 'submit_for_review', examCoordinator, { resource: question });
  assert.equal(status1, 'Pending_Review');

  // 3. Manager approves and publishes
  const status2 = checkAcademicTransition('Pending_Review', 'publish', examManager, {});
  assert.equal(status2, 'Published');

  // 4. Live interactive practice validation against the published question
  const wrongAttempt = InteractiveMcqValidator.evaluateAnswer(question, 'A');
  assert.equal(wrongAttempt.isCorrect, false);
  assert.equal(wrongAttempt.rememberNotes, undefined);

  const correctAttempt = InteractiveMcqValidator.evaluateAnswer(question, 'B');
  assert.equal(correctAttempt.isCorrect, true);
  assert.equal(correctAttempt.rememberNotes.length, 3);
});
