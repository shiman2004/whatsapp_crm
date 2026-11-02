import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorize,
  assertAuthorized,
  checkRecordScope,
  buildSecureWhereClause,
  AuthorizationError,
} from './src/authorizationService.js';

test('1. Deactivated accounts are rejected immediately', async () => {
  const actor = { id: 'user-1', role: 'coordinator', company: 'RWC', active: false };
  const res = await authorize(actor, 'crm.contact.view');
  assert.equal(res.allowed, false);
  assert.equal(res.code, 'ACCOUNT_DEACTIVATED');
});

test('2. Super Admin is granted all permissions across any company', async () => {
  const actor = { id: 'admin-1', role: 'super_admin', company: 'RWC', active: true };
  const res = await authorize(actor, 'crm.contact.delete', null, { company: 'CRAS' });
  assert.equal(res.allowed, true);
  assert.equal(res.code, 'SUPER_ADMIN_GRANTED');
  assert.equal(res.scope, 'all');
});

test('3. Coordinator can view assigned contact but not unassigned or others', () => {
  const actor = { id: 'coord-1', role: 'coordinator', company: 'RWC', active: true };
  
  // Own assigned record
  const assignedRecord = { id: 'lead-1', company: 'RWC', assignedTo: 'coord-1' };
  const check1 = checkRecordScope(actor, 'assigned', assignedRecord, 'RWC');
  assert.equal(check1.allowed, true);

  // Other coordinator assigned record
  const otherRecord = { id: 'lead-2', company: 'RWC', assignedTo: 'coord-2' };
  const check2 = checkRecordScope(actor, 'assigned', otherRecord, 'RWC');
  assert.equal(check2.allowed, false);
  assert.equal(check2.code, 'RECORD_NOT_ASSIGNED');

  // Cross-company record
  const crasRecord = { id: 'lead-3', company: 'CRAS', assignedTo: 'coord-1' };
  const check3 = checkRecordScope(actor, 'assigned', crasRecord, 'RWC');
  assert.equal(check3.allowed, false);
  assert.equal(check3.code, 'RECORD_CROSS_COMPANY');
});

test('4. Default-deny on non-permitted capabilities', async () => {
  const actor = { id: 'coord-1', role: 'coordinator', company: 'RWC', active: true };
  const res = await authorize(actor, 'crm.contact.delete');
  assert.equal(res.allowed, false);
  assert.equal(res.code, 'PERMISSION_DENIED');
});

test('5. assertAuthorized throws AuthorizationError with 403 status', async () => {
  const actor = { id: 'coord-1', role: 'coordinator', company: 'RWC', active: true };
  await assert.rejects(
    async () => {
      await assertAuthorized(actor, 'staff.manage');
    },
    (err) => {
      assert.ok(err instanceof AuthorizationError);
      assert.equal(err.status, 403);
      assert.equal(err.code, 'PERMISSION_DENIED');
      return true;
    }
  );
});

test('6. buildSecureWhereClause filters collection query by assignedTo for coordinator', async () => {
  const actor = { id: 'coord-1', role: 'coordinator', company: 'RWC', active: true };
  const where = await buildSecureWhereClause(actor, 'crm.contact.view', 'RWC', { is_active: true });
  assert.equal(where.company, 'RWC');
  assert.equal(where.assignedTo, 'coord-1');
  assert.equal(where.is_active, true);
});

test('7. buildSecureWhereClause returns denied condition for unauthorized action', async () => {
  const actor = { id: 'coord-1', role: 'coordinator', company: 'RWC', active: true };
  const where = await buildSecureWhereClause(actor, 'staff.manage', 'RWC');
  assert.equal(where.id, '__DENIED_BY_POLICY__');
});
