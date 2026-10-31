import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamOperations, orderKey } from '../../src/examOperations.js';
import { StudentAccess } from '../../src/studentAccess.js';
import { TestStore, fails, JWT_SECRET } from './fixtures/testHarness.js';
import { salesOfficer, examManager, superAdmin } from './fixtures/actors.js';
import { createOrderRequirementInput } from './fixtures/payloads.js';

test('UAT 6: Repeat Purchase Identity Linking Without Duplication (Happy Path)', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const access = new StudentAccess(store, JWT_SECRET);

  const email = 'fatima.zahra@example.com';
  const studentId = orderKey(email);

  // Setup published material assets in store
  await store.transaction(async tx => {
    await tx.put('asset', 'mat-dha-core', { id: 'mat-dha-core', title: 'DHA Core Notes', status: 'PUBLISHED', version: 1 });
    await tx.put('asset', 'mat-nclex-core', { id: 'mat-nclex-core', title: 'NCLEX Clinical Protocols', status: 'PUBLISHED', version: 1 });
  });

  // 1. Order 1: DHA Package
  const order1Input = createOrderRequirementInput({
    orderId: 'order-dha-101',
    packageId: 'DHA-GP-PRO',
    email,
    services: ['exam_material']
  });
  const req1 = await ops.submit(salesOfficer, order1Input);
  await ops.update(superAdmin, req1.id, 'verify-payment', { revision: 1, reference: 'TXN-DHA-101' });
  await ops.update(examManager, req1.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, req1.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, req1.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  await ops.update(examManager, req1.id, 'mark-email-verified', { revision: 5, reason: 'Email confirmed via phone call' });
  await ops.update(examManager, req1.id, 'transition', { revision: 6, status: 'READY' });
  await ops.update(examManager, req1.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });
  await ops.update(examManager, req1.id, 'manager-approve', { revision: 8, reason: 'Approved for DHA GP materials' });
  await ops.update(superAdmin, req1.id, 'prepare-access', { revision: 9, materialIds: ['mat-dha-core'] });

  // Activate student account
  const studentBefore = await store.transaction(tx => tx.get('student', studentId));
  assert.ok(studentBefore, 'Student account must be created');
  const passwordHash = await access.hashPassword('SuperStrongPassword2026!#');
  const nowIso = new Date().toISOString();
  studentBefore.status = 'ACTIVE';
  studentBefore.activatedAt = nowIso;
  studentBefore.emailVerifiedAt = nowIso;
  studentBefore.passwordHash = passwordHash;
  studentBefore.browserDigest = access.digest('browser-1');
  await store.transaction(async tx => {
    await tx.put('student', studentId, studentBefore);
    const ents = await tx.list('entitlement', studentId);
    for (const e of ents) {
      e.startsAt = nowIso;
      e.endsAt = new Date(Date.now() + e.durationDays * 86400000).toISOString();
      await tx.put('entitlement', e.id, e);
    }
  });

  // 2. Order 2: Repeat purchase for NCLEX package
  const order2Input = createOrderRequirementInput({
    orderId: 'order-nclex-202',
    packageId: 'NCLEX-RN-ADVANCED',
    email,
    services: ['exam_material']
  });
  const req2 = await ops.submit(salesOfficer, order2Input);
  await ops.update(superAdmin, req2.id, 'verify-payment', { revision: 1, reference: 'TXN-NCLEX-202' });
  await ops.update(examManager, req2.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, req2.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, req2.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  await ops.update(examManager, req2.id, 'mark-email-verified', { revision: 5, reason: 'Returning verified student' });
  await ops.update(examManager, req2.id, 'transition', { revision: 6, status: 'READY' });
  await ops.update(examManager, req2.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });
  await ops.update(examManager, req2.id, 'manager-approve', { revision: 8, reason: 'Approved for NCLEX materials' });
  await ops.update(superAdmin, req2.id, 'prepare-access', { revision: 9, materialIds: ['mat-nclex-core'] });

  // 3. Verify ZERO duplicate student rows exist
  const studentRows = [...store.rows.entries()].filter(([k]) => k.startsWith('student:'));
  assert.equal(studentRows.length, 1, 'Exactly ONE student row must exist in the database');
  assert.equal(studentRows[0][1].id, studentId);

  // 4. Verify two distinct entitlements exist for the single student
  const entitlements = await store.transaction(tx => tx.list('entitlement', studentId));
  assert.equal(entitlements.length, 2, 'Student must possess exactly 2 active entitlements');
  const packageIds = entitlements.map(e => e.packageId);
  assert.ok(packageIds.includes('DHA-GP-PRO'));
  assert.ok(packageIds.includes('NCLEX-RN-ADVANCED'));

  // 5. Verify student portal displays assets from both packages
  const loginSession = await access.login(email, 'SuperStrongPassword2026!#', 'browser-1');
  const portalView = await access.portal(loginSession.token, 'browser-1');
  assert.equal(portalView.accesses.length, 2);
  const materialIds = portalView.assets.map(a => a.id);
  assert.ok(materialIds.includes('mat-dha-core'), 'DHA material must be accessible');
  assert.ok(materialIds.includes('mat-nclex-core'), 'NCLEX material must be accessible');
});

test('UAT 6: Idempotent Duplicate Access Prevention', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const email = 'idempotent@example.com';

  await store.transaction(tx => tx.put('asset', 'mat-core-1', { id: 'mat-core-1', title: 'Core', status: 'PUBLISHED' }));

  const req = await ops.submit(salesOfficer, createOrderRequirementInput({ email }));
  await ops.update(superAdmin, req.id, 'verify-payment', { revision: 1, reference: 'TXN-IDEMP-01' });
  await ops.update(examManager, req.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, req.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, req.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  await ops.update(examManager, req.id, 'mark-email-verified', { revision: 5, reason: 'Verified' });
  await ops.update(examManager, req.id, 'transition', { revision: 6, status: 'READY' });
  await ops.update(examManager, req.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });
  await ops.update(examManager, req.id, 'manager-approve', { revision: 8, reason: 'Approved' });

  // First prepare-access succeeds
  const prepared = await ops.update(superAdmin, req.id, 'prepare-access', { revision: 9, materialIds: ['mat-core-1'] });
  assert.ok(prepared.entitlementId);

  // Second prepare-access call on same requirement fails with ACCESS_EXISTS
  await fails(
    ops.update(superAdmin, req.id, 'prepare-access', { revision: 10, materialIds: ['mat-core-1'] }),
    'ACCESS_EXISTS'
  );
});
