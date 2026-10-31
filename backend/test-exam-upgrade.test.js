import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { ExamOperations, orderKey } from './src/examOperations.js';
import { StudentAccess } from './src/studentAccess.js';
import { legacyExamAccess, validateHandoff } from './src/examPolicy.js';

// Transactional test double: serializes work and rolls back failures. No live DB.
class TestStore {
  rows = new Map(); queue = Promise.resolve(); events = [];
  async transaction(work) {
    const run = this.queue.then(async () => {
      const rows = structuredClone(this.rows); const events = structuredClone(this.events);
      const tx = {
        lock: async () => {},
        get: async (kind,id) => structuredClone(rows.get(kind + ':' + id) || null),
        list: async (kind,owner) => [...rows.entries()].filter(([key,value]) => key.startsWith(kind + ':') && (!owner || value.ownerId === owner)).map(([,value]) => structuredClone(value)),
        put: async (kind,id,data) => { const key = kind + ':' + id; const result = { ...structuredClone(data), revision: (rows.get(key)?.revision || 0) + 1 }; rows.set(key,result); return result; },
        audit: async (...event) => { events.push(event); },
      };
      const value = await work(tx); this.rows = rows; this.events = events; return value;
    });
    this.queue = run.catch(() => {}); return run;
  }
}
const admin = { id: 'admin', role: 'super_admin' };
const sales = { id: 'sales-a', role: 'coordinator', company: 'CRAS' };
const otherSales = { id: 'sales-b', role: 'coordinator', company: 'CRAS' };
const input = () => ({ orderId: crypto.randomUUID(), studentName:'Test Student', email:'student@example.test', phone:'0000000', country:'Sri Lanka', timeZone:'Asia/Colombo', profession:'Nurse', authority:'Test Authority', examName:'Practice', packageId:'NURSE', packageVersion:'1', currency:'USD', amountMinor:12900, durationDays:90, attemptAllowance:3, startTrigger:'activation', services:['Notes','Mock tests'] });
const fails = (promise,code) => assert.rejects(promise,error => error.code === code);

test('legacy global academic routes deny staff roles and absent identity', () => {
  assert.equal(legacyExamAccess(null),401); assert.equal(legacyExamAccess(sales),403);
  assert.equal(legacyExamAccess({id:'x',role:'marketing_admin'}),403);
  assert.equal(legacyExamAccess(admin),200);
});
test('handoff validates dates, time zones, amounts and services', () => {
  for (const changes of [{durationDays:0},{amountMinor:-1},{timeZone:'Invalid/Zone'},{startTrigger:'fixed',fixedStart:'bad'},{services:[]}]) assert.throws(() => validateHandoff({...input(),...changes}));
});
test('duplicate submission is idempotent and cannot overwrite sold terms', async () => {
  const store = new TestStore(); const ops = new ExamOperations(store); const data = input();
  await ops.submit(sales,data); const repeat = await ops.submit(sales,data); assert.equal(repeat.duplicate,true);
  assert.equal((await ops.list(sales)).length,1);
  await fails(ops.submit(sales,{...data,durationDays:365}),'AMENDMENT_REQUIRED');
  await fails(ops.submit(otherSales,data),'ORDER_CONFLICT');
});
test('sales cannot set owner, approval, status or read another salesperson records', async () => {
  const store = new TestStore(); const ops = new ExamOperations(store);
  const record = await ops.submit(sales,{...input(),ownerId:'someone',paymentStatus:'VERIFIED',status:'DELIVERED'});
  assert.equal(record.ownerId,sales.id); assert.equal(record.paymentStatus,'PENDING');
  assert.equal((await ops.list(otherSales)).length,0);
  await fails(ops.update(sales,record.id,'verify-payment',{revision:1,reference:'bank-ref'}),'FORBIDDEN');
  await fails(ops.update(otherSales,record.id,'transition',{revision:1,status:'ACCEPTED'}),'NOT_FOUND');
});
test('concurrent acceptance has one winner and rejects stale updates', async () => {
  const store = new TestStore(); const ops = new ExamOperations(store); const r = await ops.submit(sales,input());
  const results = await Promise.allSettled([ops.update(admin,r.id,'transition',{revision:1,status:'ACCEPTED'}),ops.update({id:'admin2',role:'super_admin'},r.id,'transition',{revision:1,status:'ACCEPTED'})]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal((await ops.list(admin))[0].coordinatorId,admin.id);
});
test('payment and checklist gate preparation and no entitlement is created by submission', async () => {
  const store = new TestStore(); const ops = new ExamOperations(store); const r = await ops.submit(sales,input());
  let current = await ops.update(admin,r.id,'transition',{revision:1,status:'ACCEPTED'});
  await fails(ops.update(admin,r.id,'transition',{revision:current.revision,status:'PREPARING'}),'PAYMENT_REQUIRED');
  assert.equal([...store.rows.keys()].filter(k=>k.startsWith('entitlement:')).length,0);
});
test('amendment preserves previous sold snapshot', async () => {
  const store = new TestStore(); const ops = new ExamOperations(store); const data = input(); const r = await ops.submit(sales,data);
  await ops.update(sales,r.id,'amend',{revision:1,reason:'Correct duration',changes:{durationDays:60}});
  const previous = [...store.rows.entries()].find(([key])=>key.startsWith('revision:'))[1];
  assert.equal(previous.snapshot.durationDays,90); assert.equal((await ops.list(sales))[0].snapshot.durationDays,60);
});
async function account() {
  const store = new TestStore(); const access = new StudentAccess(store,'test-signing-secret-for-local-test-only'); const id = orderKey('student@example.test');
  const passwordHash = await access.hashPassword('A private test passphrase 87654');
  await store.transaction(tx => tx.put('student',id,{id,name:'Student',email:'student@example.test',status:'ACTIVE',generation:0,passwordHash,browserDigest:access.digest('browser-a')}));
  return {store,access,id};
}
test('production device replacement result never includes the test OTP', async () => {
  const {store,access,id} = await account();
  const previousMode = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const result = await access.devicePolicy.requestDeviceReplacement(id, {targetDeviceId:'new-device',targetDeviceType:'desktop'});
    assert.equal(result.otpCodeSent,true);
    assert.equal('codeForTest' in result,false);
  } finally { process.env.NODE_ENV = previousMode; }
});
function unseal(access,payload) {
  const decipher = crypto.createDecipheriv('aes-256-gcm',access.key,Buffer.from(payload.iv,'base64')); decipher.setAuthTag(Buffer.from(payload.tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.ciphertext,'base64')),decipher.final()]).toString());
}
test('unknown account and wrong password have the same public error', async () => {
  const {access} = await account();
  await fails(access.login('unknown@example.test','wrong','browser-a'),'INVALID_LOGIN');
  await fails(access.login('student@example.test','wrong','browser-a'),'INVALID_LOGIN');
});
test('new browser password alone does not revoke existing session', async () => {
  const {store,access} = await account(); const old = await access.login('student@example.test','A private test passphrase 87654','browser-a');
  const challenge = await access.login('student@example.test','A private test passphrase 87654','browser-b');
  assert.equal(challenge.requiresOtp,true); assert.equal(challenge.token,undefined);
  await access.portal(old.token,'browser-a');
  await fails(access.verifyDevice(challenge.challengeId,'00000000','browser-b'),'INVALID_CODE');
  await access.portal(old.token,'browser-a');
  assert.equal((await store.transaction(tx=>tx.get('challenge',access.digest(challenge.challengeId)))).failures,1);
});
test('verified switch invalidates old session and rejects reused OTP', async () => {
  const {store,access} = await account(); const old = await access.login('student@example.test','A private test passphrase 87654','browser-a');
  const challenge = await access.login('student@example.test','A private test passphrase 87654','browser-b');
  const mail = [...store.rows.values()].find(x=>x.purpose==='device-code'); const code=unseal(access,mail.payload).code;
  assert.equal(JSON.stringify(mail).includes(code),false);
  const next=await access.verifyDevice(challenge.challengeId,code,'browser-b');
  await fails(access.portal(old.token,'browser-a'),'SESSION_EXPIRED'); await access.portal(next.token,'browser-b');
  await fails(access.verifyDevice(challenge.challengeId,code,'browser-b'),'INVALID_CODE');
});
test('five invalid codes lock the challenge while preserving existing session', async () => {
  const {store,access} = await account(); const old=await access.login('student@example.test','A private test passphrase 87654','browser-a');
  const c=await access.login('student@example.test','A private test passphrase 87654','browser-b');
  const mail=[...store.rows.values()].find(x=>x.purpose==='device-code'); const code=unseal(access,mail.payload).code; const wrong=code==='00000000'?'11111111':'00000000';
  for(let i=0;i<5;i++) await fails(access.verifyDevice(c.challengeId,wrong,'browser-b'),'INVALID_CODE');
  await fails(access.verifyDevice(c.challengeId,code,'browser-b'),'INVALID_CODE'); await access.portal(old.token,'browser-a');
});
test('concurrent verified switches have one winner', async () => {
  const {store,access}=await account(); await access.login('student@example.test','A private test passphrase 87654','browser-a');
  const c=await access.login('student@example.test','A private test passphrase 87654','browser-b');
  const mail=[...store.rows.values()].find(x=>x.purpose==='device-code'); const code=unseal(access,mail.payload).code;
  const results=await Promise.allSettled([access.verifyDevice(c.challengeId,code,'browser-b'),access.verifyDevice(c.challengeId,code,'browser-b')]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
});
test('logout retains recognition but ends the active session', async () => {
  const {store,access,id}=await account(); const session=await access.login('student@example.test','A private test passphrase 87654','browser-a'); await access.logout(session.token,'browser-a');
  await fails(access.portal(session.token,'browser-a'),'SESSION_EXPIRED'); assert.equal((await store.transaction(tx=>tx.get('student',id))).browserDigest,access.digest('browser-a'));
});
test('expired or suspended entitlement never appears in portal', async () => {
  const {store,access,id}=await account(); const session=await access.login('student@example.test','A private test passphrase 87654','browser-a');
  await store.transaction(async tx=>{ await tx.put('entitlement','one',{id:'one',ownerId:id,status:'ACTIVE',startsAt:'2020-01-01',endsAt:'2020-02-01'}); await tx.put('entitlement','two',{id:'two',ownerId:id,status:'SUSPENDED',startsAt:'2020-01-01',endsAt:'2099-01-01'}); });
  assert.equal((await access.portal(session.token,'browser-a')).accesses.length,0);
});

// ============================================================================
// MILESTONE 1: CRM WORKFLOW & SALES-TO-EXAM HANDOVER (UAT SCENARIOS 1–4)
// ============================================================================

const salesUser = { id: 'user-sales-1', fullName: 'Sales Coordinator 1', role: 'sales_coordinator', company: 'CRAS' };
const headExamUser = { id: 'user-head-exam', fullName: 'Head of Exam', role: 'exam_department_manager', company: 'CRAS' };
const officerAhmed = { id: 'officer-ahmed', fullName: 'Ahmed Mansoor', role: 'exam_providing_officer', company: 'CRAS' };
const officerSara = { id: 'officer-sara', fullName: 'Sara Chen', role: 'exam_providing_officer', company: 'CRAS' };

const validHandoffInput = () => ({
  leadId: 'lead-1001',
  leadName: 'Dr. Fatima Al-Zahra',
  phone: '+971501234567',
  email: 'fatima.zahra@example.com',
  profession: 'General Practitioner',
  requirementType: 'country_specific',
  examCountry: 'United Arab Emirates',
  examTitle: 'DHA General Practitioner Licensing',
  authority: 'Dubai Health Authority (DHA)',
  priority: 'urgent',
  services: ['exam_material', 'mock_test'],
  quotationNumber: 'QT-2026-8891',
  clientName: 'Dr. Fatima Al-Zahra',
  clientEmail: 'fatima.zahra@example.com',
  contactNumber: '+971501234567',
  paymentReceiptUrl: '/uploads/receipt-fatima.pdf?sig=abc123xyz',
  paymentReceiptFileName: 'receipt-fatima.pdf',
  receiptVoucherUrl: '/uploads/voucher-fatima.pdf?sig=def456uvw',
  receiptVoucherFileName: 'voucher-fatima.pdf',
  receiptVoucherNo: 'RV-9901',
  company: 'CRAS',
  discussionHistory: [
    { id: 'note-1', content: 'Inquired about DHA GP exam syllabus.', senderName: 'Sales Rep', department: 'Sales' },
    { id: 'note-2', content: 'Sent quotation QT-2026-8891.', senderName: 'Sales Rep', department: 'Sales' },
    { id: 'note-3', content: 'Client confirmed payment via bank transfer.', senderName: 'Sales Rep', department: 'Sales' },
    { id: 'note-4', content: 'Payment voucher RV-9901 uploaded.', senderName: 'Sales Rep', department: 'Sales' }
  ]
});

test('UAT Scenario 1: Sales Inquiry Conversion & Automated Exam Case Creation', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  // Negative paths: missing receipt or voucher
  await fails(ops.submitHandoff(salesUser, { ...validHandoffInput(), paymentReceiptUrl: '' }), 'PAYMENT_RECEIPT_REQUIRED');
  await fails(ops.submitHandoff(salesUser, { ...validHandoffInput(), receiptVoucherNo: '' }), 'RECEIPT_VOUCHER_REQUIRED');
  await fails(ops.submitHandoff(salesUser, { ...validHandoffInput(), receiptVoucherUrl: '' }), 'RECEIPT_VOUCHER_FILE_REQUIRED');

  // Submit valid handoff
  const record = await ops.submitHandoff(salesUser, validHandoffInput());
  assert.ok(record.id);
  assert.ok(record.number.startsWith('EH-'));
  assert.equal(record.status, 'PENDING_ACCEPTANCE');
  assert.equal(record.paymentStatus, 'PENDING');
  assert.equal(record.recipientRole, 'exam_department_manager');
  assert.equal(record.leadId, 'lead-1001');
  assert.equal(record.quotationNumber, 'QT-2026-8891');
  assert.equal(record.receiptVoucherNo, 'RV-9901');
  assert.equal(record.discussionHistory.length, 4);
  assert.equal(record.attachments.length >= 2, true);

  // Check automated notification to Head of Exam
  const headNotif = record.notifications.find(n => n.recipientRole === 'exam_department_manager');
  assert.ok(headNotif, 'Should generate notification to exam department manager');
  assert.match(headNotif.title, /New Exam Handoff/);

  // Check audit event
  const forwardAudit = store.events.find(([, action]) => action === 'exam.handoff.forwarded');
  assert.ok(forwardAudit, 'Should record audit log for forwarded handoff');

  // Duplicate check returns existing record
  const duplicate = await ops.submitHandoff(salesUser, validHandoffInput());
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.id, record.id);
});

test('UAT Scenario 2: Exam Manager Case Acceptance & Officer Assignment', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesUser, validHandoffInput());

  // Non-manager cannot accept or assign
  await fails(ops.updateHandoff(salesUser, handoff.id, 'accept', { revision: handoff.revision }), 'FORBIDDEN');
  await fails(ops.updateHandoff(officerAhmed, handoff.id, 'accept', { revision: handoff.revision }), 'FORBIDDEN');

  // Stale revision is rejected
  await fails(ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: 999 }), 'STALE_RECORD');

  // Head of Exam accepts handoff
  const accepted = await ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision });
  assert.equal(accepted.status, 'ACCEPTED');
  assert.equal(accepted.acceptedBy, headExamUser.id);
  assert.ok(accepted.acceptedAt);

  // Non-manager cannot assign officer
  await fails(ops.updateHandoff(salesUser, accepted.id, 'assign', { revision: accepted.revision, officerId: officerAhmed.id, officerName: officerAhmed.fullName }), 'FORBIDDEN');

  // Head of Exam assigns officer
  const assigned = await ops.updateHandoff(headExamUser, accepted.id, 'assign', {
    revision: accepted.revision,
    officerId: officerAhmed.id,
    officerName: officerAhmed.fullName,
    reason: 'Assigned based on UAE medical licensing specialization.'
  });
  assert.equal(assigned.status, 'ASSIGNED');
  assert.equal(assigned.assignedOfficerId, officerAhmed.id);
  assert.equal(assigned.assignedOfficerName, officerAhmed.fullName);
  assert.equal(assigned.assignmentReason, 'Assigned based on UAE medical licensing specialization.');
  assert.ok(assigned.assignedAt);

  // Notification sent to assigned officer
  const officerNotif = assigned.notifications.find(n => n.recipientId === officerAhmed.id);
  assert.ok(officerNotif, 'Officer should receive assignment notification');
  assert.match(officerNotif.title, /New Exam Assignment/);

  // Audit trails logged
  assert.ok(store.events.find(([, action]) => action === 'exam.handoff.accept'));
  assert.ok(store.events.find(([, action]) => action === 'exam.handoff.assign'));
});

test('UAT Scenario 3: Officer Requirement Acceptance, Work Tracking & Delivery', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesUser, validHandoffInput());
  const accepted = await ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision });
  const assigned = await ops.updateHandoff(headExamUser, accepted.id, 'assign', {
    revision: accepted.revision,
    officerId: officerAhmed.id,
    officerName: officerAhmed.fullName,
    reason: 'Initial assignment'
  });

  // Unassigned officer (Sara) cannot accept, start or complete
  await fails(ops.updateHandoff(officerSara, assigned.id, 'accept-assignment', { revision: assigned.revision }), 'ASSIGNMENT_REQUIRED');

  // Head of Exam cannot accept assignment on behalf of officer
  await fails(ops.updateHandoff(headExamUser, assigned.id, 'accept-assignment', { revision: assigned.revision }), 'FORBIDDEN');

  // Officer Ahmed accepts assignment
  const officerAccepted = await ops.updateHandoff(officerAhmed, assigned.id, 'accept-assignment', { revision: assigned.revision });
  assert.equal(officerAccepted.status, 'OFFICER_ACCEPTED');
  assert.equal(officerAccepted.officerAcceptedBy, officerAhmed.id);
  assert.ok(officerAccepted.officerAcceptedAt);

  // Cannot complete before starting
  await fails(ops.updateHandoff(officerAhmed, officerAccepted.id, 'complete', { revision: officerAccepted.revision, reason: 'Too early' }), 'ASSIGNMENT_REQUIRED');

  // Officer Ahmed starts work
  const started = await ops.updateHandoff(officerAhmed, officerAccepted.id, 'start', { revision: officerAccepted.revision });
  assert.equal(started.status, 'IN_PROGRESS');
  assert.ok(started.startedAt);

  // Another officer cannot complete
  await fails(ops.updateHandoff(officerSara, started.id, 'complete', { revision: started.revision, reason: 'Completed' }), 'ASSIGNMENT_REQUIRED');

  // Officer Ahmed completes work
  const completed = await ops.updateHandoff(officerAhmed, started.id, 'complete', {
    revision: started.revision,
    reason: 'Complete DHA General Practitioner syllabus and 3 mock exam bundles prepared.'
  });
  assert.equal(completed.status, 'DELIVERED_TO_CRM');
  assert.ok(completed.completedAt);
  assert.equal(completed.completionNote, 'Complete DHA General Practitioner syllabus and 3 mock exam bundles prepared.');

  // Check notifications generated for Head of Exam and Sales
  const delivSalesNotif = completed.notifications.find(n => n.recipientId === salesUser.id);
  assert.ok(delivSalesNotif, 'Sales coordinator should receive completion notification');
});

test('UAT Scenario 4: Case Reassignment & Return to Sales with Mandatory Reason', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesUser, validHandoffInput());
  const accepted = await ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision });
  const assigned = await ops.updateHandoff(headExamUser, accepted.id, 'assign', {
    revision: accepted.revision,
    officerId: officerAhmed.id,
    officerName: officerAhmed.fullName,
    reason: 'Initial assignment'
  });

  // Reassignment requires reason min 3 chars
  await fails(ops.updateHandoff(headExamUser, assigned.id, 'assign', {
    revision: assigned.revision,
    officerId: officerSara.id,
    officerName: officerSara.fullName,
    reason: ''
  }), 'REASON_REQUIRED');

  await fails(ops.updateHandoff(headExamUser, assigned.id, 'assign', {
    revision: assigned.revision,
    officerId: officerSara.id,
    officerName: officerSara.fullName,
    reason: 'no'
  }), 'REASON_REQUIRED');

  // Reassign to Officer Sara with valid reason
  const reassigned = await ops.updateHandoff(headExamUser, assigned.id, 'assign', {
    revision: assigned.revision,
    officerId: officerSara.id,
    officerName: officerSara.fullName,
    reason: 'Reassigned due to medical leave of primary officer; priority case.'
  });
  assert.equal(reassigned.status, 'ASSIGNED');
  assert.equal(reassigned.assignedOfficerId, officerSara.id);
  assert.equal(reassigned.previousOfficerId, officerAhmed.id);
  assert.equal(reassigned.reassignmentReason, 'Reassigned due to medical leave of primary officer; priority case.');

  // Verify notifications sent to both previous and new officers
  assert.ok(reassigned.notifications.find(n => n.recipientId === officerSara.id));
  assert.ok(reassigned.notifications.find(n => n.recipientId === officerAhmed.id));

  // Case Return to Sales: requires manager and mandatory reason min 3 chars
  await fails(ops.updateHandoff(officerSara, reassigned.id, 'return', { revision: reassigned.revision, reason: 'Valid reason' }), 'FORBIDDEN');
  await fails(ops.updateHandoff(headExamUser, reassigned.id, 'return', { revision: reassigned.revision, reason: 'x' }), 'REASON_REQUIRED');

  const returned = await ops.updateHandoff(headExamUser, reassigned.id, 'return', {
    revision: reassigned.revision,
    reason: 'Incomplete client medical documents; please re-upload registration certificate.'
  });
  assert.equal(returned.status, 'RETURNED_TO_SALES');
  assert.equal(returned.returnedBy, headExamUser.id);
  assert.ok(returned.returnedAt);
  assert.equal(returned.returnReason, 'Incomplete client medical documents; please re-upload registration certificate.');

  // Notification sent to sales
  const returnNotif = returned.notifications.find(n => n.recipientId === salesUser.id && n.eventType === 'exam.handoff.return');
  assert.ok(returnNotif);
  assert.match(returnNotif.title, /Case Returned to Sales/);

  // Can resubmit/re-forward after return to sales
  const reforwarded = await ops.submitHandoff(salesUser, {
    ...validHandoffInput(),
    notes: 'Updated client documentation attached as requested.'
  });
  assert.notEqual(reforwarded.duplicate, true);
  assert.equal(reforwarded.status, 'PENDING_ACCEPTANCE');
});

test('Sales Discussion History & Attachments Accessibility', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesUser, validHandoffInput());
  const accepted = await ops.updateHandoff(headExamUser, handoff.id, 'accept', { revision: handoff.revision });
  const assigned = await ops.updateHandoff(headExamUser, accepted.id, 'assign', {
    revision: accepted.revision,
    officerId: officerAhmed.id,
    officerName: officerAhmed.fullName,
    reason: 'Initial assignment'
  });

  // Officer Ahmed adds an exam note with an attachment
  const withOfficerNote = await ops.updateHandoff(officerAhmed, assigned.id, 'add-note', {
    revision: assigned.revision,
    text: 'Exam blueprint reviewed. Starting compilation of Section 1 MCQ bank.',
    attachments: [{ url: '/uploads/blueprint-reviewed.pdf', fileName: 'blueprint-reviewed.pdf', fileType: 'pdf' }]
  });
  assert.equal(withOfficerNote.discussionHistory.length, 5);
  const latestNote = withOfficerNote.discussionHistory[4];
  assert.equal(latestNote.department, 'Exam Department');
  assert.equal(latestNote.senderId, officerAhmed.id);
  assert.ok(withOfficerNote.attachments.some(a => a.url === '/uploads/blueprint-reviewed.pdf'));

  // Sales can fetch handoff and read full discussion history and attachments
  const fetchedBySales = await ops.getHandoff(salesUser, withOfficerNote.id);
  assert.equal(fetchedBySales.discussionHistory.length, 5);
  assert.equal(fetchedBySales.attachments.length >= 3, true);

  // Sales can append a reply note
  const withSalesReply = await ops.updateHandoff(salesUser, withOfficerNote.id, 'add-note', {
    revision: withOfficerNote.revision,
    text: 'Client requested rush delivery for mock test 1 by Thursday.'
  });
  assert.equal(withSalesReply.discussionHistory.length, 6);
  assert.equal(withSalesReply.discussionHistory[5].department, 'Sales');
});

