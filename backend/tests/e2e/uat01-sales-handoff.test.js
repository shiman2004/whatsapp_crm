import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamOperations } from '../../src/examOperations.js';
import { TestStore, fails } from './fixtures/testHarness.js';
import { salesOfficer, otherSalesOfficer, superAdmin, examOfficer } from './fixtures/actors.js';
import { createSalesHandoffInput } from './fixtures/payloads.js';

test('UAT 1: Sales Inquiry Conversion & Automated Exam Case Creation (Happy Path)', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const input = createSalesHandoffInput({
    leadId: 'lead-1001',
    leadName: 'Dr. Fatima Al-Zahra',
    quotationNumber: 'QT-2026-8891',
    clientEmail: 'fatima.zahra@example.com'
  });

  const record = await ops.submitHandoff(salesOfficer, input);

  // Assertions from Section 32 UAT 1
  assert.ok(record.id, 'Handoff record must have an ID');
  assert.match(record.number, /^EH-[A-Z0-9]{8}$/, 'Handoff number must match EH- prefix format');
  assert.equal(record.status, 'PENDING_ACCEPTANCE');
  assert.equal(record.recipientRole, 'exam_department_manager');
  assert.equal(record.leadId, 'lead-1001');
  assert.equal(record.quotationNumber, 'QT-2026-8891');
  assert.equal(record.clientEmail, 'fatima.zahra@example.com');
  assert.equal(record.paymentReceiptUrl, input.paymentReceiptUrl);
  assert.equal(record.receiptVoucherUrl, input.receiptVoucherUrl);
  assert.equal(record.receiptVoucherNo, 'RV-9901');
  assert.equal(record.submittedBy, salesOfficer.id);

  // Audit event verification
  const forwardedEvent = store.events.find(e => e.action === 'exam.handoff.forwarded');
  assert.ok(forwardedEvent, 'Audit event exam.handoff.forwarded must be recorded');
  assert.equal(forwardedEvent.actorId, salesOfficer.id);
  assert.equal(forwardedEvent.target, record.id);
});

test('UAT 1: Negative Path — Rejects submission missing payment receipt URL', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const input = createSalesHandoffInput({ paymentReceiptUrl: '' });

  await fails(ops.submitHandoff(salesOfficer, input), 'PAYMENT_RECEIPT_REQUIRED');
});

test('UAT 1: Negative Path — Rejects submission missing receipt voucher number', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const input = createSalesHandoffInput({ receiptVoucherNo: '' });

  await fails(ops.submitHandoff(salesOfficer, input), 'RECEIPT_VOUCHER_REQUIRED');
});

test('UAT 1: Negative Path — Rejects submission missing receipt voucher PDF URL', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const input = createSalesHandoffInput({ receiptVoucherUrl: '' });

  await fails(ops.submitHandoff(salesOfficer, input), 'RECEIPT_VOUCHER_FILE_REQUIRED');
});

test('UAT 1: Idempotency — Re-submitting same lead returns existing record with duplicate: true', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const input = createSalesHandoffInput({ leadId: 'lead-duplicate-check' });

  const first = await ops.submitHandoff(salesOfficer, input);
  const second = await ops.submitHandoff(salesOfficer, input);

  assert.equal(second.duplicate, true);
  assert.equal(second.id, first.id);
  assert.equal(second.number, first.number);
  const handoffs = await ops.listHandoffs(superAdmin);
  assert.equal(handoffs.length, 1, 'Duplicate submissions must not generate duplicate handoff rows');
});

test('UAT 1: Access Control — Non-sales actor without handoff permission is rejected', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const input = createSalesHandoffInput();
  const unauthorizedActor = { id: 'unauth-user', role: 'clinical_nurse' };

  await fails(ops.submitHandoff(unauthorizedActor, input), 'FORBIDDEN');
});
