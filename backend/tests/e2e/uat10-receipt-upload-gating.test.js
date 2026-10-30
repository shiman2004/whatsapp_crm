import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamOperations, orderKey } from '../../src/examOperations.js';
import { StudentAccess } from '../../src/studentAccess.js';
import { TestStore, fails, JWT_SECRET } from './fixtures/testHarness.js';
import { salesOfficer, superAdmin, examManager } from './fixtures/actors.js';
import { createOrderRequirementInput } from './fixtures/payloads.js';

test('UAT 10: Receipt Upload Leaves Materials Locked Until Finance Verifies (Happy Path)', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const email = 'locked.student@example.com';
  const studentId = orderKey(email);

  await store.transaction(tx =>
    tx.put('asset', 'mat-locked-dha', { id: 'mat-locked-dha', title: 'DHA Materials', status: 'PUBLISHED' })
  );

  // Sales Officer submits inquiry handoff with receipt
  const input = createOrderRequirementInput({
    email,
    paymentStatus: 'VERIFIED', // Attempting to inject verified status in submission
    ownerId: 'someone-else'
  });

  const record = await ops.submit(salesOfficer, input);

  // 1. Verify paymentStatus is strictly initialized to PENDING (injection stripped)
  assert.equal(record.paymentStatus, 'PENDING');
  assert.equal(record.status, 'SUBMITTED');
  assert.equal(record.ownerId, salesOfficer.id);

  // 2. Head of Exam accepts
  await ops.update(examManager, record.id, 'transition', { revision: 1, status: 'ACCEPTED' });

  // 3. Attempting to transition to PREPARING without verified payment is blocked
  await fails(
    ops.update(examManager, record.id, 'transition', { revision: 2, status: 'PREPARING' }),
    'PAYMENT_REQUIRED'
  );

  // 4. Attempting to execute prepare-access is blocked
  await fails(
    ops.update(superAdmin, record.id, 'prepare-access', { revision: 2, materialIds: ['mat-locked-dha'] }),
    'NOT_READY'
  );

  // 5. Verify zero entitlements exist in store
  const entitlements = await store.transaction(tx => tx.list('entitlement', studentId));
  assert.equal(entitlements.length, 0, 'No entitlement must exist while payment is unverified');
});

test('UAT 10: Security Barrier — Sales Coordinator cannot call verify-payment', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const record = await ops.submit(salesOfficer, createOrderRequirementInput());

  await fails(
    ops.update(salesOfficer, record.id, 'verify-payment', { revision: 1, reference: 'FAKEREF-99' }),
    'FORBIDDEN'
  );
});

test('UAT 10: Financial Details Tracking & Materials Locked Status on Handoff', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  const handoff = await ops.submitHandoff(salesOfficer, {
    leadId: 'lead-finance-101',
    leadName: 'Sara Al-Maktoum',
    phone: '+971501234567',
    clientEmail: 'sara.fin@example.com',
    profession: 'Registered Nurse',
    requirementType: 'country_specific',
    examCountry: 'United Arab Emirates',
    examTitle: 'DHA Nursing Exam Preparation',
    authority: 'DHA',
    priority: 'urgent',
    services: ['exam_material', 'mock_test'],
    quotationNumber: 'Q-2026-9921',
    quotationTotal: 3500,
    discount: 500,
    netAmount: 3000,
    amountPaid: 3000,
    balance: 0,
    paymentMethod: 'Standard Chartered Wire Transfer',
    transactionReference: 'TXN-BANK-SCB-9921',
    paymentReceiptUrl: '/uploads/receipt-sara.pdf',
    paymentReceiptFileName: 'receipt-sara.pdf',
    receiptVoucherNo: 'RV-2026-0044',
    receiptVoucherUrl: '/uploads/voucher-sara.pdf',
    receiptVoucherFileName: 'voucher-sara.pdf',
    clientName: 'Sara Al-Maktoum',
    contactNumber: '+971501234567'
  });

  // Verify financial details are tracked
  assert.equal(handoff.quotationNumber, 'Q-2026-9921');
  assert.equal(handoff.quotationTotal, 3500);
  assert.equal(handoff.discount, 500);
  assert.equal(handoff.netAmount, 3000);
  assert.equal(handoff.amountPaid, 3000);
  assert.equal(handoff.balance, 0);
  assert.equal(handoff.paymentMethod, 'Standard Chartered Wire Transfer');
  assert.equal(handoff.transactionReference, 'TXN-BANK-SCB-9921');

  // Verify materials remain strictly locked
  assert.equal(handoff.paymentStatus, 'PENDING');
  assert.equal(handoff.materialsStatus, 'LOCKED');
});
