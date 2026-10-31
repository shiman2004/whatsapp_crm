import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { ExamOperations } from './src/examOperations.js';

/**
 * Transactional Test Double:
 * Fully serializes transactions, isolates state rollbacks, and records all audit events.
 */
class TestStore {
  rows = new Map();
  queue = Promise.resolve();
  events = [];

  async transaction(work) {
    const run = this.queue.then(async () => {
      const rows = structuredClone(this.rows);
      const events = structuredClone(this.events);
      const tx = {
        lock: async () => {},
        get: async (kind, id) => structuredClone(rows.get(kind + ':' + id) || null),
        list: async (kind, owner) => [...rows.entries()]
          .filter(([key, value]) => key.startsWith(kind + ':') && (!owner || value.ownerId === owner))
          .map(([, value]) => structuredClone(value)),
        put: async (kind, id, data) => {
          const key = kind + ':' + id;
          const result = { ...structuredClone(data), revision: (rows.get(key)?.revision || 0) + 1 };
          rows.set(key, result);
          return result;
        },
        audit: async (...event) => {
          events.push(event);
        },
      };
      const value = await work(tx);
      this.rows = rows;
      this.events = events;
      return value;
    });
    this.queue = run.catch(() => {});
    return run;
  }
}

// Actor personas
const salesUser = { id: 'sales-coordinator-1', fullName: 'Fatima Al-Nuaimi', role: 'sales_coordinator', company: 'CRAS' };
const salesUser2 = { id: 'sales-coordinator-2', fullName: 'Zaid Hassan', role: 'sales_coordinator', company: 'CRAS' };
const headExamUser = { id: 'head-exam-dept', fullName: 'Dr. Tariq Mansoor', role: 'exam_department_manager', company: 'CRAS' };
const superAdminUser = { id: 'super-admin-root', fullName: 'Global Super Admin', role: 'super_admin', company: 'CRAS' };
const officerAhmed = { id: 'officer-ahmed', fullName: 'Ahmed Mansoor', role: 'exam_providing_officer', company: 'CRAS' };
const officerSara = { id: 'officer-sara', fullName: 'Sara Chen', role: 'exam_providing_officer', company: 'CRAS' };
const officerJohn = { id: 'officer-john', fullName: 'John Doe', role: 'exam_providing_officer', company: 'CRAS' };
const financeUser = { id: 'finance-officer-1', fullName: 'Rashid Finance', role: 'finance_officer', company: 'CRAS' };

const fails = (promise, code) => assert.rejects(promise, error => {
  if (error.code !== code) {
    throw new Error(`Expected error code ${code}, but got ${error.code} (${error.message})`);
  }
  return true;
});

const sampleHandoffInput = () => ({
  leadId: 'lead-adversarial-101',
  leadName: 'Dr. Tariq Healthcare Lead',
  phone: '+971509988776',
  email: 'tariq.lead@ahg-example.ae',
  profession: 'Specialist Cardiologist',
  requirementType: 'country_specific',
  examCountry: 'United Arab Emirates',
  examTitle: 'DHA Cardiology Specialist Exam',
  authority: 'Dubai Health Authority (DHA)',
  priority: 'urgent',
  services: ['exam_material', 'mock_test'],
  quotationNumber: 'QT-AHG-2026-9901',
  clientName: 'Dr. Tariq Healthcare Lead',
  clientEmail: 'tariq.lead@ahg-example.ae',
  contactNumber: '+971509988776',
  paymentReceiptUrl: '/uploads/receipt_payment_2026_client_alpha.pdf?sig=9f83c605d4a85f0291f020d2a492e458bc57121bda352abf84164b321867303b',
  paymentReceiptFileName: 'receipt_payment_2026_client_alpha.pdf',
  receiptVoucherUrl: '/uploads/voucher_official_rv9901_final.pdf?sig=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  receiptVoucherFileName: 'voucher_official_rv9901_final.pdf',
  receiptVoucherNo: 'RV-AHG-9901',
  company: 'CRAS',
  notes: 'High priority VIP cardiologist case requiring expedited materials.',
  discussionHistory: [
    { id: 'dh-1', content: 'Customer requested cardiology blueprint syllabus.', senderName: 'Sales Intake', department: 'Sales' },
    { id: 'dh-2', content: 'Sent commercial proposal QT-AHG-2026-9901.', senderName: 'Sales Intake', department: 'Sales' }
  ]
});

// ============================================================================
// 1. DISCUSSION HISTORY INTEGRITY & ATTRIBUTION
// ============================================================================

test('Discussion History: Preserves chronological order, monotonic timestamps, and append-only immutability', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  let handoff = await ops.submitHandoff(salesUser, sampleHandoffInput());
  assert.equal(handoff.discussionHistory.length, 2);

  // Manager accepts
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision });
  // Manager assigns Ahmed
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'assign', {
    revision: handoff.revision,
    officerId: officerAhmed.id,
    officerName: officerAhmed.fullName,
    reason: 'Initial assignment'
  });

  // Officer Ahmed adds note 1
  handoff = await ops.updateHandoff(officerAhmed, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Exam blueprint reviewed. Need clarification on module 4.'
  });

  // Sales replies with note 2
  handoff = await ops.updateHandoff(salesUser, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Module 4 confirmed with client: Interventional Cardiology.'
  });

  // Head of Exam adds note 3
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Manager approval granted to include interventional questions.'
  });

  // Officer Ahmed adds note 4
  handoff = await ops.updateHandoff(officerAhmed, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Final mock exams prepared and verified.'
  });

  assert.equal(handoff.discussionHistory.length, 6);

  // Verify chronological order and monotonic timestamps
  for (let i = 0; i < handoff.discussionHistory.length - 1; i++) {
    const tCurrent = Date.parse(handoff.discussionHistory[i].createdAt);
    const tNext = Date.parse(handoff.discussionHistory[i + 1].createdAt);
    assert.ok(tCurrent <= tNext, `Timestamps must be non-decreasing at index ${i}`);
  }

  // Ensure initial notes content is never mutated or overwritten
  assert.equal(handoff.discussionHistory[0].content, 'Customer requested cardiology blueprint syllabus.');
  assert.equal(handoff.discussionHistory[1].content, 'Sent commercial proposal QT-AHG-2026-9901.');
  assert.equal(handoff.discussionHistory[2].content, 'Exam blueprint reviewed. Need clarification on module 4.');
  assert.equal(handoff.discussionHistory[3].content, 'Module 4 confirmed with client: Interventional Cardiology.');
  assert.equal(handoff.discussionHistory[4].content, 'Manager approval granted to include interventional questions.');
  assert.equal(handoff.discussionHistory[5].content, 'Final mock exams prepared and verified.');
});

test('Discussion History: Enforces correct department badges ("Sales" vs "Exam Department")', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  let handoff = await ops.submitHandoff(salesUser, sampleHandoffInput());
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision });
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'assign', {
    revision: handoff.revision,
    officerId: officerAhmed.id,
    officerName: officerAhmed.fullName,
    reason: 'Assignment'
  });

  // 1. Sales Coordinator note -> MUST have department "Sales"
  handoff = await ops.updateHandoff(salesUser, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Sales update regarding student schedule.'
  });
  const salesNote = handoff.discussionHistory[handoff.discussionHistory.length - 1];
  assert.equal(salesNote.department, 'Sales');
  assert.equal(salesNote.senderId, salesUser.id);
  assert.equal(salesNote.senderRole, 'sales_coordinator');

  // 2. Exam Officer note -> MUST have department "Exam Department"
  handoff = await ops.updateHandoff(officerAhmed, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Exam department review in progress.'
  });
  const officerNote = handoff.discussionHistory[handoff.discussionHistory.length - 1];
  assert.equal(officerNote.department, 'Exam Department');
  assert.equal(officerNote.senderId, officerAhmed.id);
  assert.equal(officerNote.senderRole, 'exam_providing_officer');

  // 3. Exam Department Manager note -> MUST have department "Exam Department"
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Manager review completed.'
  });
  const managerNote = handoff.discussionHistory[handoff.discussionHistory.length - 1];
  assert.equal(managerNote.department, 'Exam Department');
  assert.equal(managerNote.senderId, headExamUser.id);

  // 4. Super Admin note -> MUST have department "Exam Department"
  handoff = await ops.updateHandoff(superAdminUser, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Super admin audit review noted.'
  });
  const adminNote = handoff.discussionHistory[handoff.discussionHistory.length - 1];
  assert.equal(adminNote.department, 'Exam Department');
  assert.equal(adminNote.senderId, superAdminUser.id);
});

test('Discussion History: Anti-Spoofing & Input Validation Integrity', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  let handoff = await ops.submitHandoff(salesUser, sampleHandoffInput());
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision });
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'assign', {
    revision: handoff.revision,
    officerId: officerAhmed.id,
    officerName: officerAhmed.fullName,
    reason: 'Assignment'
  });

  // Adversarial Attack 1: Officer Ahmed tries to spoof department as "Sales" and sender as "Sales Rep"
  handoff = await ops.updateHandoff(officerAhmed, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Spoofed sales message attempt',
    department: 'Sales', // Should be ignored
    senderId: 'spoofed-id', // Should be ignored
    senderName: 'Innocent Sales Person' // Should be ignored
  });
  const spoofedNote = handoff.discussionHistory[handoff.discussionHistory.length - 1];
  assert.equal(spoofedNote.department, 'Exam Department', 'Must enforce true department from authenticated user');
  assert.equal(spoofedNote.senderId, officerAhmed.id, 'Must enforce true senderId');
  assert.equal(spoofedNote.senderName, officerAhmed.fullName, 'Must enforce true senderName');

  // Adversarial Attack 2: Sales tries to spoof department as "Exam Department"
  handoff = await ops.updateHandoff(salesUser, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Spoofed exam dept message attempt',
    department: 'Exam Department'
  });
  const spoofedSalesNote = handoff.discussionHistory[handoff.discussionHistory.length - 1];
  assert.equal(spoofedSalesNote.department, 'Sales', 'Must enforce Sales department for sales user');

  // Negative validation: Empty and whitespace notes rejected
  await fails(ops.updateHandoff(salesUser, handoff.id, 'add-note', { revision: handoff.revision, text: '' }), 'NOTE_REQUIRED');
  await fails(ops.updateHandoff(salesUser, handoff.id, 'add-note', { revision: handoff.revision, text: '    \n\t   ' }), 'NOTE_REQUIRED');

  // Content length clamping: Note with >5000 characters is safely truncated to 5000
  const longText = 'A'.repeat(6000);
  handoff = await ops.updateHandoff(salesUser, handoff.id, 'add-note', { revision: handoff.revision, text: longText });
  const clampedNote = handoff.discussionHistory[handoff.discussionHistory.length - 1];
  assert.equal(clampedNote.content.length, 5000);
});

test('Discussion History: Role-based Access Control forbids unauthorized users from viewing or posting notes', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  let handoff = await ops.submitHandoff(salesUser, sampleHandoffInput());
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision });
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'assign', {
    revision: handoff.revision,
    officerId: officerAhmed.id,
    officerName: officerAhmed.fullName,
    reason: 'Assigned to Ahmed'
  });

  // Unassigned Officer Sara tries to add note -> 403 FORBIDDEN
  await fails(ops.updateHandoff(officerSara, handoff.id, 'add-note', { revision: handoff.revision, text: 'Unauthorized note' }), 'FORBIDDEN');

  // Non-owner Sales Coordinator 2 tries to add note -> 403 FORBIDDEN
  await fails(ops.updateHandoff(salesUser2, handoff.id, 'add-note', { revision: handoff.revision, text: 'Unauthorized sales note' }), 'FORBIDDEN');

  // Finance Officer tries to add note -> 403 FORBIDDEN
  await fails(ops.updateHandoff(financeUser, handoff.id, 'add-note', { revision: handoff.revision, text: 'Finance note' }), 'FORBIDDEN');

  // Unassigned Officer Sara tries to fetch handoff via getHandoff -> 403 FORBIDDEN
  await fails(ops.getHandoff(officerSara, handoff.id), 'FORBIDDEN');

  // Non-owner Sales Coordinator 2 tries to fetch handoff via getHandoff -> 403 FORBIDDEN
  await fails(ops.getHandoff(salesUser2, handoff.id), 'FORBIDDEN');
});

// ============================================================================
// 2. SIGNED ATTACHMENTS PRESERVATION & DATA LEAKAGE PREVENTION
// ============================================================================

test('Attachments: Preserves exact signed URLs without truncation of query strings or signatures', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  const rawReceiptUrl = '/uploads/receipt_payment_2026_client_alpha.pdf?sig=9f83c605d4a85f0291f020d2a492e458bc57121bda352abf84164b321867303b';
  const rawVoucherUrl = '/uploads/voucher_official_rv9901_final.pdf?sig=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const input = {
    ...sampleHandoffInput(),
    paymentReceiptUrl: rawReceiptUrl,
    receiptVoucherUrl: rawVoucherUrl
  };

  const handoff = await ops.submitHandoff(salesUser, input);

  // Check top-level properties
  assert.equal(handoff.paymentReceiptUrl, rawReceiptUrl, 'paymentReceiptUrl must not be truncated');
  assert.equal(handoff.receiptVoucherUrl, rawVoucherUrl, 'receiptVoucherUrl must not be truncated');

  // Check attachments array registry
  assert.ok(Array.isArray(handoff.attachments));
  const receiptAtt = handoff.attachments.find(a => a.fileType === 'payment_receipt');
  assert.ok(receiptAtt, 'Payment receipt must exist in attachments array');
  assert.equal(receiptAtt.url, rawReceiptUrl, 'Attachment url must preserve entire query string with signature');
  assert.equal(receiptAtt.department, 'Sales');
  assert.equal(receiptAtt.uploadedBy, salesUser.id);

  const voucherAtt = handoff.attachments.find(a => a.fileType === 'receipt_voucher');
  assert.ok(voucherAtt, 'Receipt voucher must exist in attachments array');
  assert.equal(voucherAtt.url, rawVoucherUrl, 'Voucher url must preserve entire query string with signature');
  assert.equal(voucherAtt.department, 'Sales');
  assert.equal(voucherAtt.uploadedBy, salesUser.id);
});

test('Attachments: Additional attachments added across lifecycle are accumulated without data leakage or loss', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  let handoff = await ops.submitHandoff(salesUser, sampleHandoffInput());
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision });
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'assign', {
    revision: handoff.revision,
    officerId: officerAhmed.id,
    officerName: officerAhmed.fullName,
    reason: 'Initial assignment'
  });

  const initialAttachmentCount = handoff.attachments.length;

  // Officer Ahmed attaches an exam study package document
  const officerDocUrl = '/uploads/exam_study_pack_cardio_v1.pdf?sig=789abc456def';
  handoff = await ops.updateHandoff(officerAhmed, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Attached official exam study blueprint and 2 mock test sets.',
    attachments: [
      { url: officerDocUrl, fileName: 'exam_study_pack_cardio_v1.pdf', fileType: 'exam_package' }
    ]
  });

  assert.equal(handoff.attachments.length, initialAttachmentCount + 1);
  const examAtt = handoff.attachments.find(a => a.url === officerDocUrl);
  assert.ok(examAtt);
  assert.equal(examAtt.department, 'Exam Department');
  assert.equal(examAtt.uploadedBy, officerAhmed.id);

  // Sales attaches updated client ID document
  const salesDocUrl = '/uploads/client_medical_license_verified.pdf?sig=123fed654cba';
  handoff = await ops.updateHandoff(salesUser, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Client verified license attached.',
    attachments: [
      { url: salesDocUrl, fileName: 'client_medical_license_verified.pdf', fileType: 'client_id' }
    ]
  });

  assert.equal(handoff.attachments.length, initialAttachmentCount + 2);
  const salesAtt = handoff.attachments.find(a => a.url === salesDocUrl);
  assert.ok(salesAtt);
  assert.equal(salesAtt.department, 'Sales');
  assert.equal(salesAtt.uploadedBy, salesUser.id);

  // Verify listHandoffs prevents attachment leakage to unauthorized officers
  const ahmedCases = await ops.listHandoffs(officerAhmed);
  assert.equal(ahmedCases.length, 1);

  const saraCases = await ops.listHandoffs(officerSara);
  assert.equal(saraCases.length, 0, 'Unassigned officer must not see cases or attachments of other officers');

  const otherSalesCases = await ops.listHandoffs(salesUser2);
  assert.equal(otherSalesCases.length, 0, 'Unrelated sales coordinator must not see cases or attachments of other coordinators');
});

// ============================================================================
// 3. NOTIFICATIONS SUBSYSTEM & PHANTOM DUPLICATE PREVENTION
// ============================================================================

test('Notifications: Verifies complete counterparty notification matrix across all lifecycle transitions', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  // 1. Forward to Exam Department
  let handoff = await ops.submitHandoff(salesUser, sampleHandoffInput());
  assert.equal(handoff.notifications.length, 1);
  assert.equal(handoff.notifications[0].recipientRole, 'exam_department_manager');
  assert.equal(handoff.notifications[0].eventType, 'exam.handoff.forwarded');

  // 2. Head of Exam accepts -> notifies Sales Coordinator (owner)
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision });
  assert.equal(handoff.notifications.length, 2);
  const acceptNotif = handoff.notifications[1];
  assert.equal(acceptNotif.recipientId, salesUser.id);
  assert.equal(acceptNotif.recipientRole, 'sales_coordinator');
  assert.equal(acceptNotif.eventType, 'exam.handoff.accept');

  // 3. Initial assignment -> notifies Officer Ahmed
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'assign', {
    revision: handoff.revision,
    officerId: officerAhmed.id,
    officerName: officerAhmed.fullName,
    reason: 'Initial assignment'
  });
  assert.equal(handoff.notifications.length, 3);
  const assignNotif = handoff.notifications[2];
  assert.equal(assignNotif.recipientId, officerAhmed.id);
  assert.equal(assignNotif.eventType, 'exam.handoff.assign');

  // 4. Note by Officer Ahmed -> notifies Sales Coordinator (owner)
  handoff = await ops.updateHandoff(officerAhmed, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Note from Ahmed to Sales.'
  });
  assert.equal(handoff.notifications.length, 4);
  const noteNotif1 = handoff.notifications[3];
  assert.equal(noteNotif1.recipientId, salesUser.id);
  assert.equal(noteNotif1.eventType, 'exam.handoff.note');

  // 5. Note by Sales Coordinator -> notifies Assigned Officer (Ahmed)
  handoff = await ops.updateHandoff(salesUser, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Reply from Sales to Ahmed.'
  });
  assert.equal(handoff.notifications.length, 5);
  const noteNotif2 = handoff.notifications[4];
  assert.equal(noteNotif2.recipientId, officerAhmed.id);
  assert.equal(noteNotif2.eventType, 'exam.handoff.note');

  // 6. Reassignment to Officer Sara -> sends EXACTLY 2 notifications:
  //    - 1 to newly assigned Officer Sara
  //    - 1 to previously assigned Officer Ahmed
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'assign', {
    revision: handoff.revision,
    officerId: officerSara.id,
    officerName: officerSara.fullName,
    reason: 'Reassigned due to workload rebalancing'
  });
  assert.equal(handoff.notifications.length, 7, 'Reassignment must add exactly 2 notifications');
  const newOfficerNotif = handoff.notifications.find(n => n.recipientId === officerSara.id && n.eventType === 'exam.handoff.assign');
  const prevOfficerNotif = handoff.notifications.find(n => n.recipientId === officerAhmed.id && n.eventType === 'exam.handoff.reassigned_from');
  assert.ok(newOfficerNotif, 'New officer must receive assignment notification');
  assert.ok(prevOfficerNotif, 'Previous officer must receive reassigned_from notification');
  assert.match(newOfficerNotif.message, /Reassigned due to workload rebalancing/);
  assert.match(prevOfficerNotif.message, /Sara Chen/);

  // 7. Officer Sara accepts requirement -> notifies Head of Exam
  handoff = await ops.updateHandoff(officerSara, handoff.id, 'accept-assignment', { revision: handoff.revision });
  assert.equal(handoff.notifications.length, 8);
  const ackNotif = handoff.notifications[7];
  assert.equal(ackNotif.recipientRole, 'exam_department_manager');
  assert.equal(ackNotif.eventType, 'exam.handoff.accept-assignment');

  // 8. Officer Sara starts work -> notifies Head of Exam
  handoff = await ops.updateHandoff(officerSara, handoff.id, 'start', { revision: handoff.revision });
  assert.equal(handoff.notifications.length, 9);
  const startNotif = handoff.notifications[8];
  assert.equal(startNotif.recipientRole, 'exam_department_manager');
  assert.equal(startNotif.eventType, 'exam.handoff.start');

  // 9. Officer Sara completes work -> sends EXACTLY 2 notifications:
  //    - 1 to Head of Exam (exam_department_manager)
  //    - 1 to Sales Coordinator (owner)
  handoff = await ops.updateHandoff(officerSara, handoff.id, 'complete', {
    revision: handoff.revision,
    reason: 'Package complete'
  });
  assert.equal(handoff.notifications.length, 11, 'Completion must add exactly 2 notifications');
  const completeMgrNotif = handoff.notifications.find(n => n.recipientRole === 'exam_department_manager' && n.eventType === 'exam.handoff.complete');
  const completeSalesNotif = handoff.notifications.find(n => n.recipientId === salesUser.id && n.eventType === 'exam.handoff.delivered_to_sales');
  assert.ok(completeMgrNotif, 'Manager must receive completion notification');
  assert.ok(completeSalesNotif, 'Sales must receive delivered notification');
});

test('Notifications: Phantom Duplicate Prevention on Duplicate Resubmissions and Retries', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  // Initial submission
  const handoff = await ops.submitHandoff(salesUser, sampleHandoffInput());
  assert.equal(handoff.notifications.length, 1);

  // Resubmission of identical active lead -> duplicate detected
  const duplicate = await ops.submitHandoff(salesUser, sampleHandoffInput());
  assert.equal(duplicate.duplicate, true);
  // Total notifications in store must remain exactly 1 (no duplicate notification emitted)
  const allNotifications = await store.transaction(tx => tx.list('notification'));
  assert.equal(allNotifications.length, 1, 'No phantom notification should be generated on duplicate handoff submission');

  // Failed state transition attempts (e.g. invalid status or stale revision)
  await fails(ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: 999 }), 'STALE_RECORD');
  await fails(ops.updateHandoff(officerAhmed, handoff.id, 'accept', { revision: handoff.revision }), 'FORBIDDEN');

  const afterFailedAttempts = await store.transaction(tx => tx.list('notification'));
  assert.equal(afterFailedAttempts.length, 1, 'Failed transition attempts must never emit phantom notifications');
});

test('Notifications: Mailbox scoping ensures users only see their authorized notifications', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  let handoff = await ops.submitHandoff(salesUser, sampleHandoffInput());
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision });
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'assign', {
    revision: handoff.revision,
    officerId: officerAhmed.id,
    officerName: officerAhmed.fullName,
    reason: 'Initial assignment'
  });
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'assign', {
    revision: handoff.revision,
    officerId: officerSara.id,
    officerName: officerSara.fullName,
    reason: 'Reassigned to Sara'
  });

  // Verify listNotifications delivery and role isolation:
  // 1. Ahmed receives his direct assignment and reassignment notifications
  const ahmedNotifs = await ops.listNotifications(officerAhmed);
  assert.ok(ahmedNotifs.some(n => n.recipientId === officerAhmed.id && n.eventType === 'exam.handoff.assign'));
  assert.ok(ahmedNotifs.some(n => n.recipientId === officerAhmed.id && n.eventType === 'exam.handoff.reassigned_from'));

  // 2. Sara receives her direct assignment notification
  const saraNotifs = await ops.listNotifications(officerSara);
  assert.ok(saraNotifs.some(n => n.recipientId === officerSara.id && n.eventType === 'exam.handoff.assign'));

  // 3. Sales Coordinator receives his direct accepted notification
  const salesNotifs = await ops.listNotifications(salesUser);
  assert.ok(salesNotifs.some(n => n.recipientId === salesUser.id && n.eventType === 'exam.handoff.accept'));

  // 4. Unrelated roles (e.g. Finance Officer) receive ZERO exam handoff notifications
  const financeNotifs = await ops.listNotifications(financeUser);
  assert.equal(financeNotifs.length, 0, 'Unrelated role must receive zero exam workflow notifications');

  // 5. Head of Exam Department should see:
  //    - Notifications addressed to role 'exam_department_manager'
  const managerNotifs = await ops.listNotifications(headExamUser);
  assert.ok(managerNotifs.length >= 1);
  assert.ok(managerNotifs.every(n => n.recipientRole === 'exam_department_manager' || n.recipientId === headExamUser.id));
});

// ============================================================================
// 4. APPEND-ONLY AUDIT TRAIL INTEGRITY
// ============================================================================

test('Audit Trail: Every lifecycle transition writes to the append-only audit trail and in-record history', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  // Step 1: Forward
  let handoff = await ops.submitHandoff(salesUser, sampleHandoffInput());

  // Step 2: Accept
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision });

  // Step 3: Assign
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'assign', {
    revision: handoff.revision,
    officerId: officerAhmed.id,
    officerName: officerAhmed.fullName,
    reason: 'Initial assignment to Ahmed'
  });

  // Step 4: Add note by officer
  handoff = await ops.updateHandoff(officerAhmed, handoff.id, 'add-note', {
    revision: handoff.revision,
    text: 'Note by officer'
  });

  // Step 5: Reassign to Sara
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'assign', {
    revision: handoff.revision,
    officerId: officerSara.id,
    officerName: officerSara.fullName,
    reason: 'Reassigned to Sara'
  });

  // Step 6: Accept requirement by Sara
  handoff = await ops.updateHandoff(officerSara, handoff.id, 'accept-assignment', { revision: handoff.revision });

  // Step 7: Start work
  handoff = await ops.updateHandoff(officerSara, handoff.id, 'start', { revision: handoff.revision });

  // Step 8: Complete work
  handoff = await ops.updateHandoff(officerSara, handoff.id, 'complete', {
    revision: handoff.revision,
    reason: 'Completed work documentation'
  });

  // Check in-record history array
  assert.equal(handoff.history.length, 8);
  const expectedHistoryActions = [
    'FORWARDED_TO_EXAM_DEPARTMENT',
    'accept',
    'assign',
    'add-note',
    'assign',
    'accept-assignment',
    'start',
    'complete'
  ];
  for (let i = 0; i < expectedHistoryActions.length; i++) {
    assert.equal(handoff.history[i].action, expectedHistoryActions[i], `History action mismatch at index ${i}`);
    assert.ok(handoff.history[i].at, `History timestamp missing at index ${i}`);
    assert.ok(handoff.history[i].actorId, `History actorId missing at index ${i}`);
  }

  // Check audit trail events logged to store
  const expectedAuditActions = [
    'exam.handoff.forwarded',
    'exam.handoff.accept',
    'exam.handoff.assign',
    'exam.handoff.add-note',
    'exam.handoff.assign',
    'exam.handoff.accept-assignment',
    'exam.handoff.start',
    'exam.handoff.complete'
  ];

  assert.equal(store.events.length, 8);
  for (let i = 0; i < expectedAuditActions.length; i++) {
    const [actorId, action, target, details] = store.events[i];
    assert.equal(action, expectedAuditActions[i], `Audit event action mismatch at index ${i}`);
    assert.equal(target, handoff.id, `Audit target mismatch at index ${i}`);
    assert.ok(actorId, `Audit actorId missing at index ${i}`);
    assert.ok(details !== undefined, `Audit details missing at index ${i}`);
  }
});

test('Audit Trail: Return to Sales logs mandatory reason, actor, and status immutably', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  let handoff = await ops.submitHandoff(salesUser, sampleHandoffInput());
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision });

  const returnReason = 'Incomplete doctor credential documentation; passport scan unreadable.';
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'return', {
    revision: handoff.revision,
    reason: returnReason
  });

  assert.equal(handoff.status, 'RETURNED_TO_SALES');
  assert.equal(handoff.returnReason, returnReason);
  assert.equal(handoff.returnedBy, headExamUser.id);
  assert.ok(handoff.returnedAt);

  // Check history entry
  const returnHistory = handoff.history[handoff.history.length - 1];
  assert.equal(returnHistory.action, 'return');
  assert.equal(returnHistory.status, 'RETURNED_TO_SALES');
  assert.equal(returnHistory.reason, returnReason);
  assert.equal(returnHistory.actorId, headExamUser.id);

  // Check store audit entry
  const returnAudit = store.events.find(([, action]) => action === 'exam.handoff.return');
  assert.ok(returnAudit, 'Return action must write to audit log');
  assert.equal(returnAudit[0], headExamUser.id);
  assert.equal(returnAudit[2], handoff.id);
  assert.equal(returnAudit[3].reason, returnReason);
});

// ============================================================================
// 5. CONCURRENT MODIFICATIONS & RACE RESISTANCE
// ============================================================================

test('Concurrency: Prevents race conditions and duplicate executions on concurrent transitions', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  const handoff = await ops.submitHandoff(salesUser, sampleHandoffInput());

  // Two managers try to accept the handoff simultaneously with revision 1
  const results = await Promise.allSettled([
    ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision }),
    ops.updateHandoff(superAdminUser, handoff.id, 'accept', { revision: handoff.revision })
  ]);

  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Only one concurrent accept must succeed');
  assert.equal(rejected.length, 1, 'Concurrent update with stale revision must be rejected');
  assert.equal(rejected[0].reason.code, 'STALE_RECORD');

  // Verify only 1 accept notification was added
  const latest = await ops.getHandoff(headExamUser, handoff.id);
  const acceptNotifs = latest.notifications.filter(n => n.eventType === 'exam.handoff.accept');
  assert.equal(acceptNotifs.length, 1, 'Exactly one notification emitted for winning transaction');
});

// ============================================================================
// 6. INJECTION RESISTANCE & ATTACHMENT PATH TRAVERSAL DEFENSE
// ============================================================================

test('Security & Fuzzing: Path traversal in signed URLs is rejected and malicious HTML/Script content is preserved safely', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  // Path traversal attacks in attachment URLs MUST be rejected
  await fails(ops.submitHandoff(salesUser, {
    ...sampleHandoffInput(),
    paymentReceiptUrl: '/uploads/../../etc/passwd'
  }), 'PAYMENT_RECEIPT_REQUIRED');

  await fails(ops.submitHandoff(salesUser, {
    ...sampleHandoffInput(),
    paymentReceiptUrl: 'https://evil-phishing-site.com/uploads/receipt.pdf'
  }), 'PAYMENT_RECEIPT_REQUIRED');

  await fails(ops.submitHandoff(salesUser, {
    ...sampleHandoffInput(),
    receiptVoucherUrl: '/uploads/..\\..\\windows\\system32\\cmd.exe'
  }), 'RECEIPT_VOUCHER_FILE_REQUIRED');

  // Submit handoff with rich unicode, Arabic characters, emojis, and script tags in notes (with empty discussionHistory to test notes ingestion)
  const handoff = await ops.submitHandoff(salesUser, {
    ...sampleHandoffInput(),
    discussionHistory: [],
    notes: 'Case Notes: د. طارق الهاشمي 🏥 Card: "AHG-VIP" <script>alert(1)</script>'
  });

  assert.equal(handoff.discussionHistory.length, 1);
  const initialNote = handoff.discussionHistory[0];
  assert.equal(initialNote.content, 'Case Notes: د. طارق الهاشمي 🏥 Card: "AHG-VIP" <script>alert(1)</script>');
  assert.equal(initialNote.department, 'Sales');
  assert.equal(handoff.notes, 'Case Notes: د. طارق الهاشمي 🏥 Card: "AHG-VIP" <script>alert(1)</script>');
});

test('Resilience: Return-to-Sales, Re-forwarding, Discussion, Reassignment, and Delivery Lifecycle', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  // 1. Initial submission
  let handoff = await ops.submitHandoff(salesUser, sampleHandoffInput());
  assert.equal(handoff.status, 'PENDING_ACCEPTANCE');

  // 2. Head of Exam returns to sales
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision });
  handoff = await ops.updateHandoff(headExamUser, handoff.id, 'return', {
    revision: handoff.revision,
    reason: 'Please provide certified Arabic translation of degree.'
  });
  assert.equal(handoff.status, 'RETURNED_TO_SALES');

  // 3. Sales re-forwards the lead with amended documents
  const reforwarded = await ops.submitHandoff(salesUser, {
    ...sampleHandoffInput(),
    notes: 'Certified degree translation attached as requested.'
  });
  assert.notEqual(reforwarded.duplicate, true, 'Returned lead must be re-forwardable');
  assert.equal(reforwarded.status, 'PENDING_ACCEPTANCE');

  // 4. Accept and Assign to Ahmed
  let active = await ops.updateHandoff(headExamUser, reforwarded.id, 'accept', { revision: reforwarded.revision });
  active = await ops.updateHandoff(headExamUser, active.id, 'assign', {
    revision: active.revision,
    officerId: officerAhmed.id,
    officerName: officerAhmed.fullName,
    reason: 'Assigned to Ahmed'
  });

  // 5. Discussion exchange between Ahmed and Sales
  active = await ops.updateHandoff(officerAhmed, active.id, 'add-note', {
    revision: active.revision,
    text: 'Translation verified. Processing exam material package.'
  });
  active = await ops.updateHandoff(salesUser, active.id, 'add-note', {
    revision: active.revision,
    text: 'Thank you Ahmed, client has been updated.'
  });

  // 6. Reassignment to Sara
  active = await ops.updateHandoff(headExamUser, active.id, 'assign', {
    revision: active.revision,
    officerId: officerSara.id,
    officerName: officerSara.fullName,
    reason: 'Reassigned due to emergency hospital duty'
  });
  assert.equal(active.status, 'ASSIGNED');
  assert.equal(active.assignedOfficerId, officerSara.id);
  assert.equal(active.previousOfficerId, officerAhmed.id);

  // 7. Sara accepts, starts, and delivers
  active = await ops.updateHandoff(officerSara, active.id, 'accept-assignment', { revision: active.revision });
  active = await ops.updateHandoff(officerSara, active.id, 'start', { revision: active.revision });
  active = await ops.updateHandoff(officerSara, active.id, 'complete', {
    revision: active.revision,
    reason: 'DHA Cardiology study package and 2 mock test sets uploaded and verified.'
  });
  assert.equal(active.status, 'DELIVERED_TO_CRM');
  assert.ok(active.completedAt);
});

