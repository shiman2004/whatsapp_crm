import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderKey } from '../../src/examOperations.js';
import { TestStore, DevicePolicyManager, fails } from './fixtures/testHarness.js';
import { superAdmin, salesOfficer } from './fixtures/actors.js';

async function setupStudentWithTwoDevices(email = 'replacement.student@example.com') {
  const store = new TestStore();
  const manager = new DevicePolicyManager(store);
  const studentId = orderKey(email);

  await store.transaction(tx =>
    tx.put('student', studentId, {
      id: studentId,
      name: 'Dr. Fatima Replacement',
      email,
      status: 'ACTIVE',
      generation: 1,
      registeredDevices: []
    })
  );

  // Register 1 Mobile (iPhone 14) and 1 Laptop (Dell XPS)
  await manager.registerDevice(studentId, {
    deviceId: 'dev-iphone-14',
    deviceType: 'mobile',
    browserName: 'Mobile Safari'
  });
  await manager.registerDevice(studentId, {
    deviceId: 'dev-dell-xps',
    deviceType: 'desktop',
    browserName: 'Chrome Windows'
  });

  return { store, manager, studentId };
}

test('UAT 9: Unregistered Third Device Block & Approved Replacement Workflow (Happy Path)', async () => {
  const { store, manager, studentId } = await setupStudentWithTwoDevices();

  // 1. Attempt to register 3rd device (iPad Safari replacing iPhone)
  await fails(
    manager.registerDevice(studentId, { deviceId: 'dev-ipad-pro', deviceType: 'mobile' }),
    'THIRD_DEVICE_BLOCKED'
  );

  // 2. Student initiates device replacement challenge
  const challengeReq = await manager.requestDeviceReplacement(studentId, {
    targetDeviceId: 'dev-ipad-pro',
    targetDeviceType: 'mobile'
  });
  assert.ok(challengeReq.challengeId);
  assert.ok(challengeReq.codeForTest, '8-digit OTP code generated');

  // 3. Student verifies OTP code
  const verifyRes = await manager.verifyReplacementOtp(challengeReq.challengeId, challengeReq.codeForTest);
  assert.equal(verifyRes.status, 'PENDING_ADMIN_APPROVAL');

  // 4. Super Admin reviews and approves the replacement
  const approvalRes = await manager.approveDeviceReplacement(superAdmin, challengeReq.challengeId);
  assert.equal(approvalRes.success, true);
  assert.equal(approvalRes.revokedDeviceId, 'dev-iphone-14', 'Old mobile phone must be revoked');
  assert.equal(approvalRes.newDeviceId, 'dev-ipad-pro', 'New mobile phone must be registered');

  // 5. Verify final device registry: old phone revoked, new phone active, laptop preserved
  const devices = await manager.getRegisteredDevices(studentId);
  const activeDevices = devices.filter(d => d.status === 'ACTIVE');
  assert.equal(activeDevices.length, 2);
  assert.ok(activeDevices.some(d => d.deviceId === 'dev-ipad-pro' && d.deviceType === 'mobile'));
  assert.ok(activeDevices.some(d => d.deviceId === 'dev-dell-xps' && d.deviceType === 'desktop'));

  // 6. Verify audit trail
  const approvalEvent = store.events.find(e => e.action === 'security.device_replacement.approved');
  assert.ok(approvalEvent, 'security.device_replacement.approved audit entry must be recorded');
  assert.equal(approvalEvent.actorId, superAdmin.id);
});

test('UAT 9: Negative Path — 5 invalid OTP codes lock the challenge', async () => {
  const { manager, studentId } = await setupStudentWithTwoDevices();

  const challengeReq = await manager.requestDeviceReplacement(studentId, {
    targetDeviceId: 'dev-new-laptop',
    targetDeviceType: 'desktop'
  });

  // Enter 4 wrong codes
  for (let i = 0; i < 4; i++) {
    await fails(manager.verifyReplacementOtp(challengeReq.challengeId, '00000000'), 'INVALID_OTP');
  }

  // 5th wrong code locks the challenge
  await fails(manager.verifyReplacementOtp(challengeReq.challengeId, '00000000'), 'CHALLENGE_LOCKED');

  // Any subsequent attempt (even with correct code) fails with CHALLENGE_LOCKED
  await fails(
    manager.verifyReplacementOtp(challengeReq.challengeId, challengeReq.codeForTest),
    'CHALLENGE_LOCKED'
  );
});

test('UAT 9: Negative Path — Non-admin cannot approve device replacement', async () => {
  const { manager, studentId } = await setupStudentWithTwoDevices();

  const challengeReq = await manager.requestDeviceReplacement(studentId, {
    targetDeviceId: 'dev-new-mobile',
    targetDeviceType: 'mobile'
  });
  await manager.verifyReplacementOtp(challengeReq.challengeId, challengeReq.codeForTest);

  // Sales Officer attempting approval
  await fails(
    manager.approveDeviceReplacement(salesOfficer, challengeReq.challengeId),
    'FORBIDDEN'
  );
});
