import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { ExamOperations } from './src/examOperations.js';

// High-fidelity transactional test store double simulating public.exam_ops_records
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
        get: async (kind, id) => structuredClone(rows.get(`${kind}:${id}`) || null),
        list: async (kind, owner) =>
          [...rows.entries()]
            .filter(([key, value]) => key.startsWith(`${kind}:`) && (!owner || value.ownerId === owner))
            .map(([, value]) => structuredClone(value)),
        put: async (kind, id, data) => {
          const key = `${kind}:${id}`;
          const currentRev = rows.get(key)?.revision || 0;
          const result = { ...structuredClone(data), revision: currentRev + 1 };
          rows.set(key, result);
          return result;
        },
        audit: async (...event) => {
          events.push(event);
        }
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

// User personas representing diverse CRM roles
const salesOfficer = { id: 'sales-user-01', fullName: 'Alice Sales', role: 'sales_coordinator', company: 'CRAS' };
const headOfExam = { id: 'head-exam-01', fullName: 'Dr. Hector Exam', role: 'exam_department_manager', company: 'CRAS' };
const assignedOfficer = { id: 'officer-ahmed', fullName: 'Ahmed Mansoor', role: 'exam_providing_officer', company: 'CRAS' };
const unassignedOfficer = { id: 'officer-sara', fullName: 'Sara Chen', role: 'exam_providing_officer', company: 'CRAS' };
const financeOfficer = { id: 'finance-user-01', fullName: 'Farah Finance', role: 'finance_officer', company: 'CRAS' };
const anonymousUser = { id: null, role: 'anonymous' };

// Factory for standard valid handoff input
const createHandoffInput = (customLead = null) => ({
  leadId: customLead || `lead-${crypto.randomUUID().slice(0, 8)}`,
  leadName: 'Dr. Tariq Al-Hashimi',
  phone: '+971509988776',
  email: 'tariq.hashimi@example.com',
  profession: 'Specialist Cardiologist',
  requirementType: 'country_specific',
  examCountry: 'United Arab Emirates',
  examTitle: 'DHA Cardiology Specialist Exam',
  authority: 'Dubai Health Authority (DHA)',
  priority: 'urgent',
  services: ['exam_material', 'mock_test'],
  quotationNumber: 'QT-2026-CHALLENGER-01',
  clientName: 'Dr. Tariq Al-Hashimi',
  clientEmail: 'tariq.hashimi@example.com',
  contactNumber: '+971509988776',
  paymentReceiptUrl: '/uploads/receipt-tariq.pdf?sig=testreceipt',
  paymentReceiptFileName: 'receipt-tariq.pdf',
  receiptVoucherUrl: '/uploads/voucher-tariq.pdf?sig=testvoucher',
  receiptVoucherFileName: 'voucher-tariq.pdf',
  receiptVoucherNo: 'RV-CHALLENGE-01',
  company: 'CRAS',
  discussionHistory: [
    { id: 'note-01', content: 'Inquired about DHA specialist exam pattern.', senderName: 'Alice Sales', department: 'Sales' }
  ]
});

// Helper asserting that a promise rejects with expected error code and status
const assertFails = async (promise, expectedCode, expectedStatus = null) => {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, expectedCode, `Expected code ${expectedCode}, got ${err.code} (${err.message})`);
    if (expectedStatus !== null) {
      assert.equal(err.status, expectedStatus, `Expected status ${expectedStatus}, got ${err.status} (${err.message})`);
    }
    return true;
  });
};

describe('Adversarial Verification Suite: Backend Workflow State Machine', () => {

  describe('1. Unauthorized Role Transitions (Sales & Non-Manager Gating)', () => {
    test('Sales Officer attempting to accept a handoff must be rejected with 403 FORBIDDEN', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());

      await assertFails(
        ops.updateHandoff(salesOfficer, handoff.id, 'accept', { revision: handoff.revision }),
        'FORBIDDEN',
        403
      );
    });

    test('Sales Officer attempting to assign an exam officer must be rejected with 403 FORBIDDEN', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });

      await assertFails(
        ops.updateHandoff(salesOfficer, accepted.id, 'assign', {
          revision: accepted.revision,
          officerId: assignedOfficer.id,
          officerName: assignedOfficer.fullName,
          reason: 'Attempted assignment by sales'
        }),
        'FORBIDDEN',
        403
      );
    });

    test('Sales Officer attempting to return a handoff to sales must be rejected with 403 FORBIDDEN', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());

      await assertFails(
        ops.updateHandoff(salesOfficer, handoff.id, 'return', {
          revision: handoff.revision,
          reason: 'Sales cannot self-return handoff'
        }),
        'FORBIDDEN',
        403
      );
    });

    test('Sales Officer attempting to reassign an already assigned case must be rejected with 403 FORBIDDEN', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Initial assignment'
      });

      await assertFails(
        ops.updateHandoff(salesOfficer, assigned.id, 'assign', {
          revision: assigned.revision,
          officerId: unassignedOfficer.id,
          officerName: unassignedOfficer.fullName,
          reason: 'Sales attempting unauthorized reassignment'
        }),
        'FORBIDDEN',
        403
      );
    });

    test('Sales Officer attempting officer lifecycle actions (accept-assignment, start, complete) must be rejected', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Initial assignment'
      });

      // Sales attempting accept-assignment: sales is not assigned officer -> 403 ASSIGNMENT_REQUIRED
      await assertFails(
        ops.updateHandoff(salesOfficer, assigned.id, 'accept-assignment', { revision: assigned.revision }),
        'ASSIGNMENT_REQUIRED',
        403
      );

      // Sales attempting start: not assigned officer -> 403 ASSIGNMENT_REQUIRED
      await assertFails(
        ops.updateHandoff(salesOfficer, assigned.id, 'start', { revision: assigned.revision }),
        'ASSIGNMENT_REQUIRED',
        403
      );

      // Sales attempting complete: not assigned officer -> 403 ASSIGNMENT_REQUIRED
      await assertFails(
        ops.updateHandoff(salesOfficer, assigned.id, 'complete', { revision: assigned.revision, reason: 'Done' }),
        'ASSIGNMENT_REQUIRED',
        403
      );
    });

    test('Finance Officer has no exam handoff privileges and is rejected with 403 FORBIDDEN on updateHandoff', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());

      await assertFails(
        ops.updateHandoff(financeOfficer, handoff.id, 'accept', { revision: handoff.revision }),
        'FORBIDDEN',
        403
      );
    });

    test('Unauthenticated/Anonymous user is rejected with 403 FORBIDDEN', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());

      await assertFails(
        ops.updateHandoff(anonymousUser, handoff.id, 'accept', { revision: handoff.revision }),
        'FORBIDDEN',
        403
      );
    });
  });

  describe('2. Officer Boundary & Tenant Isolation Enforcement', () => {
    test('Unassigned officer attempting to accept requirement (accept-assignment) on someone else case must reject 403', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Assigned to Ahmed'
      });

      // Officer Sara Chen (unassigned) tries to accept Ahmed's assignment
      await assertFails(
        ops.updateHandoff(unassignedOfficer, assigned.id, 'accept-assignment', { revision: assigned.revision }),
        'ASSIGNMENT_REQUIRED',
        403
      );
    });

    test('Unassigned officer attempting to start work on someone else case must reject 403', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Assigned to Ahmed'
      });
      const officerAccepted = await ops.updateHandoff(assignedOfficer, assigned.id, 'accept-assignment', { revision: assigned.revision });

      // Officer Sara Chen attempts to start work on Ahmed's case
      await assertFails(
        ops.updateHandoff(unassignedOfficer, officerAccepted.id, 'start', { revision: officerAccepted.revision }),
        'ASSIGNMENT_REQUIRED',
        403
      );
    });

    test('Unassigned officer attempting to complete someone else in-progress case must reject 403', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Assigned to Ahmed'
      });
      const officerAccepted = await ops.updateHandoff(assignedOfficer, assigned.id, 'accept-assignment', { revision: assigned.revision });
      const inProgress = await ops.updateHandoff(assignedOfficer, officerAccepted.id, 'start', { revision: officerAccepted.revision });

      // Officer Sara Chen attempts to complete Ahmed's work
      await assertFails(
        ops.updateHandoff(unassignedOfficer, inProgress.id, 'complete', {
          revision: inProgress.revision,
          reason: 'Unauthorized hijacked completion'
        }),
        'ASSIGNMENT_REQUIRED',
        403
      );
    });

    test('Head of Exam Manager cannot accept assignment on behalf of the officer (must reject 403)', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Assigned to Ahmed'
      });

      // Manager attempts to bypass officer and accept requirement
      await assertFails(
        ops.updateHandoff(headOfExam, assigned.id, 'accept-assignment', { revision: assigned.revision }),
        'FORBIDDEN',
        403
      );
    });

    test('Head of Exam Manager cannot start or complete work on assigned officer case (must reject 403)', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Assigned to Ahmed'
      });
      const officerAccepted = await ops.updateHandoff(assignedOfficer, assigned.id, 'accept-assignment', { revision: assigned.revision });

      // Manager tries to start work directly
      await assertFails(
        ops.updateHandoff(headOfExam, officerAccepted.id, 'start', { revision: officerAccepted.revision }),
        'ASSIGNMENT_REQUIRED',
        403
      );
    });

    test('Unassigned officer cannot inspect another officer handoff via getHandoff (must reject 403)', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Assigned to Ahmed'
      });

      // Officer Sara Chen tries to get Ahmed's handoff
      await assertFails(
        ops.getHandoff(unassignedOfficer, assigned.id),
        'FORBIDDEN',
        403
      );
    });

    test('Unassigned officer cannot inject discussion notes or attachments via add-note (must reject 403)', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Assigned to Ahmed'
      });

      // Officer Sara Chen tries to append a note to Ahmed's case
      await assertFails(
        ops.updateHandoff(unassignedOfficer, assigned.id, 'add-note', {
          revision: assigned.revision,
          text: 'Intruder note'
        }),
        'FORBIDDEN',
        403
      );
    });

    test('Unassigned officer listHandoffs isolates cases to only assigned cases', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Assigned to Ahmed'
      });

      const ahmedCases = await ops.listHandoffs(assignedOfficer);
      const saraCases = await ops.listHandoffs(unassignedOfficer);

      assert.equal(ahmedCases.length, 1);
      assert.equal(ahmedCases[0].assignedOfficerId, assignedOfficer.id);
      assert.equal(saraCases.length, 0);
    });
  });

  describe('3. Mandatory Reason Validation (Return to Sales & Reassignment)', () => {
    test('Return to sales with empty string must reject with 400 REASON_REQUIRED', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());

      await assertFails(
        ops.updateHandoff(headOfExam, handoff.id, 'return', { revision: handoff.revision, reason: '' }),
        'REASON_REQUIRED',
        400
      );
    });

    test('Return to sales with whitespace-only string must reject with 400 REASON_REQUIRED', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());

      await assertFails(
        ops.updateHandoff(headOfExam, handoff.id, 'return', { revision: handoff.revision, reason: '    \t\n  ' }),
        'REASON_REQUIRED',
        400
      );
    });

    test('Return to sales with fewer than 3 characters must reject with 400 REASON_REQUIRED', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());

      // 1 char
      await assertFails(
        ops.updateHandoff(headOfExam, handoff.id, 'return', { revision: handoff.revision, reason: 'x' }),
        'REASON_REQUIRED',
        400
      );

      // 2 chars
      await assertFails(
        ops.updateHandoff(headOfExam, handoff.id, 'return', { revision: handoff.revision, reason: 'no' }),
        'REASON_REQUIRED',
        400
      );

      // 2 chars with surrounding whitespace (trimmed to 2 chars)
      await assertFails(
        ops.updateHandoff(headOfExam, handoff.id, 'return', { revision: handoff.revision, reason: '  ab  ' }),
        'REASON_REQUIRED',
        400
      );

      // undefined / null reason
      await assertFails(
        ops.updateHandoff(headOfExam, handoff.id, 'return', { revision: handoff.revision }),
        'REASON_REQUIRED',
        400
      );
    });

    test('Return to sales with valid >= 3 char reason succeeds and transitions to RETURNED_TO_SALES', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());

      const returned = await ops.updateHandoff(headOfExam, handoff.id, 'return', {
        revision: handoff.revision,
        reason: 'Payment voucher amount does not match invoice total.'
      });
      assert.equal(returned.status, 'RETURNED_TO_SALES');
      assert.equal(returned.returnReason, 'Payment voucher amount does not match invoice total.');
      assert.equal(returned.returnedBy, headOfExam.id);
      assert.ok(returned.returnedAt);
    });

    test('Reassigning an assigned case with empty reason must reject with 400 REASON_REQUIRED', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Initial assignment'
      });

      await assertFails(
        ops.updateHandoff(headOfExam, assigned.id, 'assign', {
          revision: assigned.revision,
          officerId: unassignedOfficer.id,
          officerName: unassignedOfficer.fullName,
          reason: ''
        }),
        'REASON_REQUIRED',
        400
      );
    });

    test('Reassigning an assigned case with whitespace-only reason must reject with 400 REASON_REQUIRED', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Initial assignment'
      });

      await assertFails(
        ops.updateHandoff(headOfExam, assigned.id, 'assign', {
          revision: assigned.revision,
          officerId: unassignedOfficer.id,
          officerName: unassignedOfficer.fullName,
          reason: '     '
        }),
        'REASON_REQUIRED',
        400
      );
    });

    test('Reassigning an assigned case with < 3 characters must reject with 400 REASON_REQUIRED', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Initial assignment'
      });

      await assertFails(
        ops.updateHandoff(headOfExam, assigned.id, 'assign', {
          revision: assigned.revision,
          officerId: unassignedOfficer.id,
          officerName: unassignedOfficer.fullName,
          reason: 're'
        }),
        'REASON_REQUIRED',
        400
      );
    });

    test('Reassigning an in-progress case with valid reason >= 3 chars succeeds and logs audit', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Initial assignment'
      });
      const officerAccepted = await ops.updateHandoff(assignedOfficer, assigned.id, 'accept-assignment', { revision: assigned.revision });
      const inProgress = await ops.updateHandoff(assignedOfficer, officerAccepted.id, 'start', { revision: officerAccepted.revision });

      const reassigned = await ops.updateHandoff(headOfExam, inProgress.id, 'assign', {
        revision: inProgress.revision,
        officerId: unassignedOfficer.id,
        officerName: unassignedOfficer.fullName,
        reason: 'Urgent case reassigned to specialist Sara due to workload balance.'
      });

      assert.equal(reassigned.status, 'ASSIGNED');
      assert.equal(reassigned.assignedOfficerId, unassignedOfficer.id);
      assert.equal(reassigned.previousOfficerId, assignedOfficer.id);
      assert.equal(reassigned.reassignmentReason, 'Urgent case reassigned to specialist Sara due to workload balance.');
      assert.ok(reassigned.reassignedAt);
    });
  });

  describe('4. Optimistic Concurrency & Race Condition Defense', () => {
    test('Two concurrent acceptance requests targeting the same revision — exactly 1 succeeds and 1 rejected 409 STALE_RECORD', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());

      const manager1 = { id: 'manager-1', role: 'exam_department_manager', fullName: 'Manager 1' };
      const manager2 = { id: 'manager-2', role: 'exam_department_manager', fullName: 'Manager 2' };

      // Both managers fire accept at the exact same revision (1)
      const results = await Promise.allSettled([
        ops.updateHandoff(manager1, handoff.id, 'accept', { revision: handoff.revision }),
        ops.updateHandoff(manager2, handoff.id, 'accept', { revision: handoff.revision })
      ]);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      assert.equal(fulfilled.length, 1, 'Exactly one concurrent request must succeed');
      assert.equal(rejected.length, 1, 'Exactly one concurrent request must be rejected');
      assert.equal(rejected[0].reason.code, 'STALE_RECORD');
      assert.equal(rejected[0].reason.status, 409);
    });

    test('Two concurrent reassignments targeting the same revision — exactly 1 succeeds and 1 rejected 409 STALE_RECORD', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Initial assignment'
      });

      // Manager attempts two concurrent reassignments at revision 3
      const reqA = ops.updateHandoff(headOfExam, assigned.id, 'assign', {
        revision: assigned.revision,
        officerId: unassignedOfficer.id,
        officerName: unassignedOfficer.fullName,
        reason: 'Reassign to Sara'
      });

      const reqB = ops.updateHandoff(headOfExam, assigned.id, 'assign', {
        revision: assigned.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Reassign back to Ahmed'
      });

      const results = await Promise.allSettled([reqA, reqB]);
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      assert.equal(fulfilled.length, 1, 'Exactly one reassignment must succeed');
      assert.equal(rejected.length, 1, 'Concurrent conflicting reassignment must be rejected');
      assert.equal(rejected[0].reason.code, 'STALE_RECORD');
      assert.equal(rejected[0].reason.status, 409);
    });

    test('Stale revision integer (past revision) is strictly rejected with 409 STALE_RECORD', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      // accepted is now at revision 2

      // Pass old revision 1
      await assertFails(
        ops.updateHandoff(headOfExam, accepted.id, 'assign', {
          revision: 1,
          officerId: assignedOfficer.id,
          officerName: assignedOfficer.fullName,
          reason: 'Initial assignment'
        }),
        'STALE_RECORD',
        409
      );
    });

    test('Future revision integer (e.g. revision + 50) is strictly rejected with 409 STALE_RECORD', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());

      await assertFails(
        ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: 99 }),
        'STALE_RECORD',
        409
      );
    });

    test('Non-integer revision types (string, float, NaN, null, undefined) are rejected with 409 STALE_RECORD', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());

      for (const badRevision of ['1', 'rev-1', 1.5, NaN, null, undefined, -1, 0, {}, []]) {
        await assertFails(
          ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: badRevision }),
          'STALE_RECORD',
          409
        );
      }
    });
  });

  describe('5. Illegal State Jumps & Workflow State Machine Strictness', () => {
    test('Illegal state jump: Attempting to complete a handoff before starting it must be rejected 403', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Initial assignment'
      });
      const officerAccepted = await ops.updateHandoff(assignedOfficer, assigned.id, 'accept-assignment', { revision: assigned.revision });

      // State is currently OFFICER_ACCEPTED. Attempting to complete before 'start'
      await assertFails(
        ops.updateHandoff(assignedOfficer, officerAccepted.id, 'complete', {
          revision: officerAccepted.revision,
          reason: 'Attempting completion before work started'
        }),
        'ASSIGNMENT_REQUIRED',
        403
      );
    });

    test('Illegal state jump: Attempting to complete directly from ASSIGNED status must be rejected 403', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Initial assignment'
      });

      // State is ASSIGNED. Attempting complete directly
      await assertFails(
        ops.updateHandoff(assignedOfficer, assigned.id, 'complete', {
          revision: assigned.revision,
          reason: 'Premature completion'
        }),
        'ASSIGNMENT_REQUIRED',
        403
      );
    });

    test('Illegal state jump: Attempting to start work before accepting assignment must be rejected 403', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Initial assignment'
      });

      // State is ASSIGNED. Attempting to start before accept-assignment
      await assertFails(
        ops.updateHandoff(assignedOfficer, assigned.id, 'start', { revision: assigned.revision }),
        'ASSIGNMENT_REQUIRED',
        403
      );
    });

    test('Illegal state jump: Attempting to assign officer before accepting handoff must be rejected 409 INVALID_STATUS', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());

      // State is PENDING_ACCEPTANCE. Manager attempts to assign without accepting first
      await assertFails(
        ops.updateHandoff(headOfExam, handoff.id, 'assign', {
          revision: handoff.revision,
          officerId: assignedOfficer.id,
          officerName: assignedOfficer.fullName,
          reason: 'Premature assignment'
        }),
        'INVALID_STATUS',
        409
      );
    });

    test('Illegal state jump: Attempting to accept an already accepted handoff must be rejected 409 INVALID_STATUS', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });

      // State is ACCEPTED. Manager tries to accept again
      await assertFails(
        ops.updateHandoff(headOfExam, accepted.id, 'accept', { revision: accepted.revision }),
        'INVALID_STATUS',
        409
      );
    });

    test('Illegal state jump: Operations on DELIVERED_TO_CRM cases must be rejected', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });
      const assigned = await ops.updateHandoff(headOfExam, accepted.id, 'assign', {
        revision: accepted.revision,
        officerId: assignedOfficer.id,
        officerName: assignedOfficer.fullName,
        reason: 'Initial assignment'
      });
      const officerAccepted = await ops.updateHandoff(assignedOfficer, assigned.id, 'accept-assignment', { revision: assigned.revision });
      const inProgress = await ops.updateHandoff(assignedOfficer, officerAccepted.id, 'start', { revision: officerAccepted.revision });
      const completed = await ops.updateHandoff(assignedOfficer, inProgress.id, 'complete', {
        revision: inProgress.revision,
        reason: 'Finished all preparation'
      });

      assert.equal(completed.status, 'DELIVERED_TO_CRM');

      // Attempt to return completed case
      await assertFails(
        ops.updateHandoff(headOfExam, completed.id, 'return', { revision: completed.revision, reason: 'Too late' }),
        'INVALID_STATUS',
        409
      );

      // Attempt to assign completed case
      await assertFails(
        ops.updateHandoff(headOfExam, completed.id, 'assign', {
          revision: completed.revision,
          officerId: unassignedOfficer.id,
          officerName: unassignedOfficer.fullName,
          reason: 'Cannot assign delivered case'
        }),
        'INVALID_STATUS',
        409
      );

      // Attempt to complete again
      await assertFails(
        ops.updateHandoff(assignedOfficer, completed.id, 'complete', { revision: completed.revision, reason: 'Again' }),
        'ASSIGNMENT_REQUIRED',
        403
      );
    });

    test('Illegal state jump: Operations on RETURNED_TO_SALES cases must be rejected', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const returned = await ops.updateHandoff(headOfExam, handoff.id, 'return', {
        revision: handoff.revision,
        reason: 'Invalid documentation attached'
      });

      assert.equal(returned.status, 'RETURNED_TO_SALES');

      // Cannot assign returned case
      await assertFails(
        ops.updateHandoff(headOfExam, returned.id, 'assign', {
          revision: returned.revision,
          officerId: assignedOfficer.id,
          officerName: assignedOfficer.fullName,
          reason: 'Invalid assignment'
        }),
        'INVALID_STATUS',
        409
      );

      // Cannot return already returned case
      await assertFails(
        ops.updateHandoff(headOfExam, returned.id, 'return', {
          revision: returned.revision,
          reason: 'Return again'
        }),
        'INVALID_STATUS',
        409
      );
    });

    test('Unknown lifecycle action is rejected with 404 UNKNOWN_ACTION', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());

      for (const badAction of ['delete', 'purge', 'escalate', '__proto__', 'constructor']) {
        await assertFails(
          ops.updateHandoff(headOfExam, handoff.id, badAction, { revision: handoff.revision }),
          'UNKNOWN_ACTION',
          404
        );
      }
    });
  });

  describe('6. Input Validation & Defense-in-Depth Attack Payloads', () => {
    test('Assigning with invalid officerId formats (spaces, special chars, SQL injection) must reject 400 OFFICER_REQUIRED', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });

      for (const badOfficerId of ['', 'officer id with spaces', "1; DROP TABLE exam_ops_records; --", '<script>alert(1)</script>', 'a'.repeat(151)]) {
        await assertFails(
          ops.updateHandoff(headOfExam, accepted.id, 'assign', {
            revision: accepted.revision,
            officerId: badOfficerId,
            officerName: 'Valid Officer Name',
            reason: 'Testing bad officer IDs'
          }),
          'OFFICER_REQUIRED',
          400
        );
      }
    });

    test('Assigning with empty officerName must reject 400 OFFICER_REQUIRED', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());
      const accepted = await ops.updateHandoff(headOfExam, handoff.id, 'accept', { revision: handoff.revision });

      await assertFails(
        ops.updateHandoff(headOfExam, accepted.id, 'assign', {
          revision: accepted.revision,
          officerId: assignedOfficer.id,
          officerName: '',
          reason: 'Testing empty officer name'
        }),
        'OFFICER_REQUIRED',
        400
      );
    });

    test('Adding discussion note with empty or whitespace-only content must reject 400 NOTE_REQUIRED', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const handoff = await ops.submitHandoff(salesOfficer, createHandoffInput());

      await assertFails(
        ops.updateHandoff(salesOfficer, handoff.id, 'add-note', {
          revision: handoff.revision,
          text: ''
        }),
        'NOTE_REQUIRED',
        400
      );

      await assertFails(
        ops.updateHandoff(salesOfficer, handoff.id, 'add-note', {
          revision: handoff.revision,
          text: '     '
        }),
        'NOTE_REQUIRED',
        400
      );
    });

    test('Attempting updates on non-existent handoff UUID must reject 404 NOT_FOUND', async () => {
      const store = new TestStore();
      const ops = new ExamOperations(store);
      const fakeId = crypto.randomUUID();

      await assertFails(
        ops.updateHandoff(headOfExam, fakeId, 'accept', { revision: 1 }),
        'NOT_FOUND',
        404
      );

      await assertFails(
        ops.getHandoff(headOfExam, fakeId),
        'NOT_FOUND',
        404
      );
    });
  });
});
