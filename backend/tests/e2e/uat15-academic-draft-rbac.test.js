import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkAcademicTransition,
  hasExamCapability,
  validateAcademicUpload
} from '../../src/examPolicy.js';
import { examManager, examCoordinator, examOfficer, otherOfficer, superAdmin } from './fixtures/actors.js';

test('UAT 15: Academic Content Draft & Multi-Stage RBAC Workflow (Happy Path)', () => {
  const resource = { id: 'mat-draft-01', created_by: examOfficer.id, status: 'Draft' };

  // 1. Author submits own draft for review
  const status1 = checkAcademicTransition('Draft', 'submit_for_review', examOfficer, { resource });
  assert.equal(status1, 'Pending_Review');

  // 2. Head of Exam reviews and requests changes
  const status2 = checkAcademicTransition('Pending_Review', 'request_changes', examManager, {
    comments: 'Please add 2 clinical scenario questions on pediatric dosing.'
  });
  assert.equal(status2, 'Changes_Requested');

  // 3. Author retracts back to Draft to make corrections
  const status3 = checkAcademicTransition('Changes_Requested', 'retract_to_draft', examOfficer, { resource });
  assert.equal(status3, 'Draft');

  // 4. Author re-submits corrected draft
  const status4 = checkAcademicTransition('Draft', 'submit_for_review', examOfficer, { resource });
  assert.equal(status4, 'Pending_Review');

  // 5. Head of Exam approves and publishes content
  const status5 = checkAcademicTransition('Pending_Review', 'publish', examManager, {});
  assert.equal(status5, 'Published');
});

test('UAT 15: Privilege Escalation Prevention — Content Author cannot self-publish', () => {
  const resource = { id: 'mat-draft-02', created_by: examOfficer.id, status: 'Pending_Review' };

  assert.throws(
    () => checkAcademicTransition('Pending_Review', 'publish', examOfficer, { resource }),
    (err) => err.status === 403
  );
});

test('UAT 15: Draft Ownership Enforcement — Author cannot edit or delete another officer draft', () => {
  const myDraft = { id: 'mat-mine', created_by: examOfficer.id, status: 'DRAFT' };
  const otherDraft = { id: 'mat-theirs', created_by: otherOfficer.id, status: 'DRAFT' };

  // Officer can edit own draft
  assert.equal(hasExamCapability(examOfficer, 'exam.draft.edit_own', myDraft), true);

  // Officer CANNOT edit other officer's draft
  assert.equal(hasExamCapability(examOfficer, 'exam.draft.edit_own', otherDraft), false);

  // Manager CAN edit any officer's draft
  assert.equal(hasExamCapability(examManager, 'exam.draft.edit_own', otherDraft), true);
});

test('UAT 15: Academic File Upload Security Barrier — Executables and oversized files rejected', () => {
  // Valid PDF / Word / ZIP uploads
  assert.doesNotThrow(() => validateAcademicUpload({ name: 'dha_cardiology_notes.pdf', size: 2 * 1024 * 1024 }));
  assert.doesNotThrow(() => validateAcademicUpload({ name: 'clinical_case_studies.docx', size: 8 * 1024 * 1024 }));

  // Prohibited script / executable extensions
  assert.throws(() => validateAcademicUpload({ name: 'exploit.exe', size: 500 }), /prohibited file type/);
  assert.throws(() => validateAcademicUpload({ name: 'malware.sh', size: 500 }), /prohibited file type/);
  assert.throws(() => validateAcademicUpload({ name: 'stealer.js', size: 500 }), /prohibited file type/);
  assert.throws(() => validateAcademicUpload({ name: 'payload.bat', size: 500 }), /prohibited file type/);

  // Exceeds 25MB maximum direct upload limit
  assert.throws(
    () => validateAcademicUpload({ name: 'huge_scan.pdf', size: 30 * 1024 * 1024 }),
    /exceeds 25MB maximum allowed size/
  );
});
