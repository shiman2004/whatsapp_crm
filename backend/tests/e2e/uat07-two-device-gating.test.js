import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderKey } from '../../src/examOperations.js';
import { TestStore, DevicePolicyManager, fails } from './fixtures/testHarness.js';

async function setupStudent(email = 'device.test@example.com') {
  const store = new TestStore();
  const manager = new DevicePolicyManager(store);
  const studentId = orderKey(email);

  await store.transaction(tx =>
    tx.put('student', studentId, {
      id: studentId,
      name: 'Device Test Student',
      email,
      status: 'ACTIVE',
      generation: 1,
      registeredDevices: []
    })
  );

  return { store, manager, studentId };
}

test('UAT 7: Two-Device Registration Gating (Happy Path: 1 Mobile + 1 Desktop)', async () => {
  const { manager, studentId } = await setupStudent();

  // 1. Register Mobile Phone
  const res1 = await manager.registerDevice(studentId, {
    deviceId: 'dev-iphone-15',
    deviceType: 'mobile',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    browserName: 'Mobile Safari'
  });
  assert.equal(res1.success, true);
  assert.equal(res1.devices.length, 1);
  assert.equal(res1.device.deviceType, 'mobile');

  // 2. Register Desktop / Laptop Computer
  const res2 = await manager.registerDevice(studentId, {
    deviceId: 'dev-thinkpad-x1',
    deviceType: 'desktop',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    browserName: 'Chrome'
  });
  assert.equal(res2.success, true);
  assert.equal(res2.devices.length, 2);
  assert.equal(res2.device.deviceType, 'desktop');

  // Verify stored registry
  const registered = await manager.getRegisteredDevices(studentId);
  assert.equal(registered.length, 2);
  assert.ok(registered.some(d => d.deviceType === 'mobile' && d.deviceId === 'dev-iphone-15'));
  assert.ok(registered.some(d => d.deviceType === 'desktop' && d.deviceId === 'dev-thinkpad-x1'));
});

test('UAT 7: Negative Path — Rejects registration of SECOND mobile phone', async () => {
  const { manager, studentId } = await setupStudent();

  // Register first mobile
  await manager.registerDevice(studentId, {
    deviceId: 'dev-iphone-15',
    deviceType: 'mobile'
  });

  // Attempt to register a second mobile (Samsung Galaxy)
  await fails(
    manager.registerDevice(studentId, {
      deviceId: 'dev-samsung-s24',
      deviceType: 'mobile'
    }),
    'DEVICE_LIMIT_EXCEEDED'
  );
});

test('UAT 7: Negative Path — Rejects registration of SECOND desktop or laptop', async () => {
  const { manager, studentId } = await setupStudent();

  // Register first desktop
  await manager.registerDevice(studentId, {
    deviceId: 'dev-dell-desktop',
    deviceType: 'desktop'
  });

  // Attempt to register a second computer (MacBook Pro)
  await fails(
    manager.registerDevice(studentId, {
      deviceId: 'dev-macbook-pro',
      deviceType: 'desktop'
    }),
    'DEVICE_LIMIT_EXCEEDED'
  );
});

test('UAT 7: Negative Path — Rejects 3rd device attempt when 2 devices already registered', async () => {
  const { manager, studentId } = await setupStudent();

  // Register permitted combo (1 mobile + 1 desktop)
  await manager.registerDevice(studentId, { deviceId: 'dev-phone-1', deviceType: 'mobile' });
  await manager.registerDevice(studentId, { deviceId: 'dev-laptop-1', deviceType: 'desktop' });

  // Attempt to register a 3rd device
  await fails(
    manager.registerDevice(studentId, { deviceId: 'dev-tablet-3', deviceType: 'desktop' }),
    'THIRD_DEVICE_BLOCKED'
  );
});

test('UAT 7: Negative Path — Rejects invalid device type specification', async () => {
  const { manager, studentId } = await setupStudent();

  await fails(
    manager.registerDevice(studentId, { deviceId: 'dev-smart-tv', deviceType: 'smart_tv' }),
    'INVALID_DEVICE_TYPE'
  );
});
