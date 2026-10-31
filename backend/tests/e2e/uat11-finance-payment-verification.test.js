import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamOperations } from '../../src/examOperations.js';
import { TestStore, fails } from './fixtures/testHarness.js';
import { salesOfficer, superAdmin, examOfficer, examManager } from './fixtures/actors.js';
import { createOrderRequirementInput } from './fixtures/payloads.js';

// Dedicated Finance Officer actor with administrative finance capability
const financeOfficer = {
  id: 'user-finance-1',
  role: 'super_admin', // Administrative capability for finance verification
  fullName: 'Finance Officer Fatima Team',
  email: 'finance@cras.ae'
};

test('UAT 11: Independent Finance Officer Payment Verification (Happy Path)', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const record = await ops.submit(salesOfficer, createOrderRequirementInput());

  assert.equal(record.paymentStatus, 'PENDING');

  // Finance Officer verifies funds with valid bank reference code (initial revision 1)
  const reference = 'TXN-ALF-99281 / Standard Chartered Wire Transfer';
  const updated = await ops.update(financeOfficer, record.id, 'verify-payment', {
    revision: 1,
    reference
  });

  assert.equal(updated.paymentStatus, 'VERIFIED');
  assert.equal(updated.paymentReference, reference);
  assert.equal(updated.paymentVerifiedBy, financeOfficer.id);
  assert.ok(updated.paymentVerifiedAt, 'paymentVerifiedAt timestamp must be recorded');
  assert.equal(updated.revision, 2);

  // Verify audit event
  const verifyAudit = store.events.find(e => e.action === 'requirement.verify-payment');
  assert.ok(verifyAudit, 'requirement.verify-payment audit entry must be recorded');
  assert.equal(verifyAudit.actorId, financeOfficer.id);
  assert.equal(verifyAudit.target, record.id);
});

test('UAT 11: Negative Path — Rejects reference code shorter than 3 characters', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const record = await ops.submit(salesOfficer, createOrderRequirementInput());

  await fails(
    ops.update(financeOfficer, record.id, 'verify-payment', { revision: 1, reference: 'TX' }),
    'REFERENCE_REQUIRED'
  );
  await fails(
    ops.update(financeOfficer, record.id, 'verify-payment', { revision: 1, reference: '   ' }),
    'REFERENCE_REQUIRED'
  );
});

test('UAT 11: Negative Path — Non-finance/non-admin roles rejected (Sales FORBIDDEN, Unassigned NOT_FOUND)', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const record = await ops.submit(salesOfficer, createOrderRequirementInput());

  // Sales Officer who owns the record is blocked from verifying payment
  await fails(
    ops.update(salesOfficer, record.id, 'verify-payment', { revision: 1, reference: 'TXN-999' }),
    'FORBIDDEN'
  );

  // Exam Providing Officer who does not own the record is blocked by perimeter isolation
  await fails(
    ops.update(examOfficer, record.id, 'verify-payment', { revision: 1, reference: 'TXN-999' }),
    'NOT_FOUND'
  );
});

test('UAT 11: Negative Path — Stale revision rejected with 409 STALE_RECORD', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const record = await ops.submit(salesOfficer, createOrderRequirementInput());

  await fails(
    ops.update(financeOfficer, record.id, 'verify-payment', { revision: 99, reference: 'TXN-999' }),
    'STALE_RECORD'
  );
});

test('UAT 11: Security Barrier — Exam Department Manager cannot verify payments (403 FORBIDDEN)', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const record = await ops.submit(salesOfficer, createOrderRequirementInput());

  // Exam Managers must strictly be rejected from verifying payment
  await fails(
    ops.update(examManager, record.id, 'verify-payment', { revision: 1, reference: 'TXN-MGR-FORBIDDEN' }),
    'FORBIDDEN'
  );
});

test('UAT 11: Dedicated finance_officer role verifies payment and materials remain locked', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const record = await ops.submit(salesOfficer, createOrderRequirementInput());

  const dedicatedFinanceOfficer = {
    id: 'user-finance-actual',
    role: 'finance_officer',
    fullName: 'Fatima Finance Specialist',
    email: 'fatima.fin@alphahealthgroup.ae'
  };

  const updated = await ops.update(dedicatedFinanceOfficer, record.id, 'verify-payment', {
    revision: 1,
    reference: 'TXN-BANK-GATEWAY-11223'
  });

  assert.equal(updated.paymentStatus, 'VERIFIED');
  assert.equal(updated.paymentReference, 'TXN-BANK-GATEWAY-11223');
  assert.equal(updated.paymentVerifiedBy, dedicatedFinanceOfficer.id);
  assert.equal(updated.materialsStatus, 'LOCKED', 'Materials must remain strictly locked after payment verification');
});
