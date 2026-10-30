import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderKey } from '../../src/examOperations.js';
import { StudentAccess } from '../../src/studentAccess.js';
import { TestStore, fails, JWT_SECRET } from './fixtures/testHarness.js';

test('UAT 18: Student Learning Portal Material Access & Dynamic Watermarking (Happy Path)', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const email = 'fatima.zahra@example.com';
  const studentId = orderKey(email);
  const password = 'WatermarkPassword2026!#';
  const passwordHash = await access.hashPassword(password);
  const nowIso = new Date().toISOString();

  await store.transaction(async tx => {
    // 1. Create active student
    await tx.put('student', studentId, {
      id: studentId,
      name: 'Dr. Fatima Al-Zahra',
      email,
      status: 'ACTIVE',
      generation: 1,
      passwordHash,
      browserDigest: access.digest('browser-1')
    });

    // 2. Create published study material
    await tx.put('asset', 'mat-dha-protocols', {
      id: 'mat-dha-protocols',
      title: 'DHA Clinical Protocols.pdf',
      version: 1,
      status: 'PUBLISHED',
      text: 'Confidential clinical algorithms for acute management.'
    });

    // 3. Create active entitlement linking material
    await tx.put('entitlement', 'ent-fatima-dha', {
      id: 'ent-fatima-dha',
      studentId,
      ownerId: studentId,
      materialIds: ['mat-dha-protocols'],
      status: 'ACTIVE',
      startsAt: nowIso,
      endsAt: new Date(Date.now() + 90 * 86400000).toISOString()
    });
  });

  // 4. Student logs in and accesses material
  const session = await access.login(email, password, 'browser-1');
  const portalView = await access.portal(session.token, 'browser-1');

  assert.equal(portalView.assets.length, 1);
  assert.equal(portalView.assets[0].id, 'mat-dha-protocols');

  // 5. Generate dynamic watermark stream
  const watermarkText = `Licensed to: Dr. Fatima Al-Zahra (${studentId.slice(0, 10)}) | ${email} | ${new Date().toISOString().slice(0, 10)} | AHG CRM Protected`;
  assert.ok(watermarkText.includes('Dr. Fatima Al-Zahra'));
  assert.ok(watermarkText.includes(email));
  assert.ok(watermarkText.includes('AHG CRM Protected'));
});

test('UAT 18: Gating Barrier — Materials outside purchased package remain locked', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const email = 'limited.access@example.com';
  const studentId = orderKey(email);
  const passwordHash = await access.hashPassword('Passphrase2026!#Secure');
  const nowIso = new Date().toISOString();

  await store.transaction(async tx => {
    await tx.put('student', studentId, {
      id: studentId,
      name: 'Limited Student',
      email,
      status: 'ACTIVE',
      generation: 1,
      passwordHash,
      browserDigest: access.digest('browser-1')
    });
    // Two published assets: Course A (purchased) and Course B (unpurchased)
    await tx.put('asset', 'mat-course-a', { id: 'mat-course-a', title: 'Course A', status: 'PUBLISHED' });
    await tx.put('asset', 'mat-course-b', { id: 'mat-course-b', title: 'Course B', status: 'PUBLISHED' });

    // Entitlement only includes Course A
    await tx.put('entitlement', 'ent-course-a', {
      id: 'ent-course-a',
      studentId,
      ownerId: studentId,
      materialIds: ['mat-course-a'],
      status: 'ACTIVE',
      startsAt: nowIso,
      endsAt: new Date(Date.now() + 90 * 86400000).toISOString()
    });
  });

  const session = await access.login(email, 'Passphrase2026!#Secure', 'browser-1');
  const portalView = await access.portal(session.token, 'browser-1');

  const visibleIds = portalView.assets.map(a => a.id);
  assert.ok(visibleIds.includes('mat-course-a'), 'Purchased Course A must be visible');
  assert.equal(visibleIds.includes('mat-course-b'), false, 'Unpurchased Course B MUST NOT be visible');
});

test('UAT 18: Negative Path — Expired entitlement immediately locks materials', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const email = 'expired.access@example.com';
  const studentId = orderKey(email);
  const passwordHash = await access.hashPassword('Passphrase2026!#Secure');

  await store.transaction(async tx => {
    await tx.put('student', studentId, {
      id: studentId,
      name: 'Expired Student',
      email,
      status: 'ACTIVE',
      generation: 1,
      passwordHash,
      browserDigest: access.digest('browser-1')
    });
    await tx.put('asset', 'mat-expired-item', { id: 'mat-expired-item', title: 'Expired Item', status: 'PUBLISHED' });

    // Expired in 2020
    await tx.put('entitlement', 'ent-expired', {
      id: 'ent-expired',
      studentId,
      ownerId: studentId,
      materialIds: ['mat-expired-item'],
      status: 'ACTIVE',
      startsAt: '2020-01-01T00:00:00.000Z',
      endsAt: '2020-02-01T00:00:00.000Z'
    });
  });

  const session = await access.login(email, 'Passphrase2026!#Secure', 'browser-1');
  const portalView = await access.portal(session.token, 'browser-1');

  assert.equal(portalView.accesses.length, 0, 'Expired entitlement must not appear in accesses');
  assert.equal(portalView.assets.length, 0, 'Materials from expired entitlement must be locked');
});
