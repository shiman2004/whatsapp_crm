import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessAcademic,
  hasExamCapability,
  checkAcademicTransition,
  validateAcademicUpload,
  ACADEMIC_LIFECYCLE,
  legacyExamAccess,
  validateHandoff
} from './src/examPolicy.js';
import { ROLE_CAPABILITIES, hasCapability } from './src/roleMatrix.js';

// Test Actors
const superAdmin = { id: 'admin-1', role: 'super_admin' };
const examManager = { id: 'mgr-1', role: 'exam_department_manager' };
const coordinator = { id: 'coord-1', role: 'exam_coordinator' };
const providingOfficer = { id: 'officer-1', role: 'exam_providing_officer' };
const otherOfficer = { id: 'officer-2', role: 'exam_providing_officer' };
const clinicalNurse = { id: 'nurse-1', role: 'clinical_nurse' };
const clinicalDoctor = { id: 'doctor-1', role: 'clinical_doctor' };
const salesCoordinator = { id: 'sales-1', role: 'coordinator', company: 'CRAS' };
const marketingAdmin = { id: 'mkt-1', role: 'marketing_admin' };

// -------------------------------------------------------------
// 1. Role Matrix & Capability Grants
// -------------------------------------------------------------
test('roleMatrix: grant definitions match the capability matrix', () => {
  // Super Admin & Manager have publish, review, delete, manage capabilities
  assert.equal(hasCapability('super_admin', 'exam.content.publish'), true);
  assert.equal(hasCapability('exam_department_manager', 'exam.content.publish'), true);
  assert.equal(hasCapability('exam_department_manager', 'exam.content.review'), true);
  assert.equal(hasCapability('exam_department_manager', 'exam.content.delete'), true);
  assert.equal(hasCapability('exam_department_manager', 'exam.course.create_draft'), true);

  // Coordinator can create course draft, materials, questions, mock tests, but NOT publish or review
  assert.equal(hasCapability('exam_coordinator', 'exam.course.create_draft'), true);
  assert.equal(hasCapability('exam_coordinator', 'exam.material.create_draft'), true);
  assert.equal(hasCapability('exam_coordinator', 'exam.question.create_draft'), true);
  assert.equal(hasCapability('exam_coordinator', 'exam.mock_test.create_draft'), true);
  assert.equal(hasCapability('exam_coordinator', 'exam.draft.submit'), true);
  assert.equal(hasCapability('exam_coordinator', 'exam.content.publish'), false);
  assert.equal(hasCapability('exam_coordinator', 'exam.content.review'), false);
  assert.equal(hasCapability('exam_coordinator', 'exam.content.delete'), false);

  // Providing Officer CANNOT create courses, but can create materials, questions, mock tests
  assert.equal(hasCapability('exam_providing_officer', 'exam.course.create_draft'), false);
  assert.equal(hasCapability('exam_providing_officer', 'exam.material.create_draft'), true);
  assert.equal(hasCapability('exam_providing_officer', 'exam.question.create_draft'), true);
  assert.equal(hasCapability('exam_providing_officer', 'exam.mock_test.create_draft'), true);
  assert.equal(hasCapability('exam_providing_officer', 'exam.content.publish'), false);
  assert.equal(hasCapability('exam_providing_officer', 'exam.content.review'), false);
  assert.equal(hasCapability('exam_providing_officer', 'exam.content.delete'), false);
});

// -------------------------------------------------------------
// 2. Academic Access Perimeter (canAccessAcademic)
// -------------------------------------------------------------
test('perimeter: canAccessAcademic allows exam staff and denies others', () => {
  // Absent identity returns 401
  assert.equal(canAccessAcademic(null), 401);
  assert.equal(canAccessAcademic({}), 401);

  // Non-exam roles return 403
  assert.equal(canAccessAcademic(salesCoordinator), 403);
  assert.equal(canAccessAcademic(marketingAdmin), 403);
  assert.equal(canAccessAcademic(clinicalNurse), 403);
  assert.equal(canAccessAcademic(clinicalDoctor), 403);

  // Authorized academic roles return 200
  assert.equal(canAccessAcademic(superAdmin), 200);
  assert.equal(canAccessAcademic(examManager), 200);
  assert.equal(canAccessAcademic(coordinator), 200);
  assert.equal(canAccessAcademic(providingOfficer), 200);
});

// -------------------------------------------------------------
// 3. Granular Exam Capabilities & Ownership Checks
// -------------------------------------------------------------
test('capabilities: coordinator can create course draft; providing officer denied', () => {
  assert.equal(hasExamCapability(superAdmin, 'exam.course.create_draft'), true);
  assert.equal(hasExamCapability(examManager, 'exam.course.create_draft'), true);
  assert.equal(hasExamCapability(coordinator, 'exam.course.create_draft'), true);
  assert.equal(hasExamCapability(providingOfficer, 'exam.course.create_draft'), false);
});

test('capabilities: both lower roles can create materials, questions, and mock tests', () => {
  for (const actor of [coordinator, providingOfficer]) {
    assert.equal(hasExamCapability(actor, 'exam.material.create_draft'), true);
    assert.equal(hasExamCapability(actor, 'exam.question.create_draft'), true);
    assert.equal(hasExamCapability(actor, 'exam.mock_test.create_draft'), true);
  }
});

test('capabilities: lower roles cannot publish content or delete published content', () => {
  const publishedItem = { created_by: coordinator.id, status: 'PUBLISHED' };

  for (const actor of [coordinator, providingOfficer]) {
    assert.equal(hasExamCapability(actor, 'exam.content.publish'), false);
    assert.equal(hasExamCapability(actor, 'exam.content.delete', publishedItem), false);
  }

  // Manager and Super Admin CAN publish and delete published content
  assert.equal(hasExamCapability(examManager, 'exam.content.publish'), true);
  assert.equal(hasExamCapability(examManager, 'exam.content.delete', publishedItem), true);
  assert.equal(hasExamCapability(superAdmin, 'exam.content.delete', publishedItem), true);
});

test('capabilities: draft ownership enforcement prevents editing or deleting others drafts', () => {
  const myDraft = { created_by: providingOfficer.id, status: 'DRAFT' };
  const otherDraft = { created_by: otherOfficer.id, status: 'DRAFT' };

  // Providing officer can edit own draft, but cannot delete content (denied to lower roles)
  assert.equal(hasExamCapability(providingOfficer, 'exam.draft.edit_own', myDraft), true);
  assert.equal(hasExamCapability(providingOfficer, 'exam.content.delete', myDraft), false);

  // Providing officer CANNOT edit or delete other officer's draft
  assert.equal(hasExamCapability(providingOfficer, 'exam.draft.edit_own', otherDraft), false);
  assert.equal(hasExamCapability(providingOfficer, 'exam.content.delete', otherDraft), false);

  // Manager and super admin CAN edit any draft
  assert.equal(hasExamCapability(examManager, 'exam.draft.edit_own', otherDraft), true);
  assert.equal(hasExamCapability(superAdmin, 'exam.draft.edit_own', otherDraft), true);
});

// -------------------------------------------------------------
// 4. Academic Lifecycle Transitions & Security Rules
// -------------------------------------------------------------
test('lifecycle: author can submit own draft for review', () => {
  const nextStatus = checkAcademicTransition(
    'Draft',
    'submit_for_review',
    coordinator,
    { resource: { created_by: coordinator.id } }
  );
  assert.equal(nextStatus, 'Pending_Review');
});

test('lifecycle: non-owner lower role cannot submit others draft for review', () => {
  assert.throws(
    () => checkAcademicTransition(
      'Draft',
      'submit_for_review',
      providingOfficer,
      { resource: { created_by: otherOfficer.id } }
    ),
    (err) => err.status === 403
  );
});

test('lifecycle: author cannot self-publish content (privilege escalation prevention)', () => {
  assert.throws(
    () => checkAcademicTransition(
      'Pending_Review',
      'publish',
      coordinator,
      { resource: { created_by: coordinator.id } }
    ),
    (err) => err.status === 403
  );
});

test('lifecycle: manager can request changes and author can retract to draft for revision', () => {
  // Manager reviews and requests changes with feedback comments
  const statusAfterReview = checkAcademicTransition(
    'Pending_Review',
    'request_changes',
    examManager,
    { comments: 'Please add 5 more clinical scenarios.' }
  );
  assert.equal(statusAfterReview, 'Changes_Requested');

  // Author retracts changes requested to draft to revise
  const statusAfterRetract = checkAcademicTransition(
    'Changes_Requested',
    'retract_to_draft',
    providingOfficer,
    { resource: { created_by: providingOfficer.id } }
  );
  assert.equal(statusAfterRetract, 'Draft');
});

test('lifecycle: manager or super admin can publish pending review content', () => {
  const publishResult = checkAcademicTransition(
    'Pending_Review',
    'publish',
    examManager,
    {}
  );
  assert.equal(publishResult, 'Published');

  const adminPublishResult = checkAcademicTransition(
    'Pending_Review',
    'publish',
    superAdmin,
    {}
  );
  assert.equal(adminPublishResult, 'Published');
});

// -------------------------------------------------------------
// 5. File Upload Validation & Security
// -------------------------------------------------------------
test('upload: validateAcademicUpload validates file extensions and sizes', () => {
  // Valid files
  assert.doesNotThrow(() => validateAcademicUpload({ name: 'clinical_notes.pdf', size: 1024 * 1024 }));
  assert.doesNotThrow(() => validateAcademicUpload({ name: 'mock_exam.docx', size: 5 * 1024 * 1024 }));
  assert.doesNotThrow(() => validateAcademicUpload({ name: 'anatomy_diagrams.zip', size: 20 * 1024 * 1024 }));

  // Prohibited executables/scripts
  assert.throws(() => validateAcademicUpload({ name: 'malicious.exe', size: 1000 }), /prohibited file type/);
  assert.throws(() => validateAcademicUpload({ name: 'exploit.sh', size: 1000 }), /prohibited file type/);
  assert.throws(() => validateAcademicUpload({ name: 'script.js', size: 1000 }), /prohibited file type/);

  // File size exceeding 25MB limit
  assert.throws(() => validateAcademicUpload({ name: 'huge_video.pdf', size: 30 * 1024 * 1024 }), /exceeds 25MB maximum allowed size/);
});

// -------------------------------------------------------------
// 6. Regression: Clinical Nurse and Doctor Workflows Untouched
// -------------------------------------------------------------
test('regression: clinical nurse and doctor permissions remain segregated and untouched', () => {
  // Clinical Nurse has patient assessment capabilities
  assert.equal(hasCapability('clinical_nurse', 'create_patient_assessment'), true);
  assert.equal(hasCapability('clinical_nurse', 'upload_clinical_files'), true);
  assert.equal(hasCapability('clinical_nurse', 'submit_doctor_review'), true);

  // Clinical Nurse does NOT have any academic exam capabilities
  assert.equal(hasCapability('clinical_nurse', 'exam.academic.view'), false);
  assert.equal(hasCapability('clinical_nurse', 'exam.course.create_draft'), false);
  assert.equal(hasCapability('clinical_nurse', 'exam.material.create_draft'), false);
  assert.equal(hasCapability('clinical_nurse', 'exam.question.create_draft'), false);
  assert.equal(hasCapability('clinical_nurse', 'exam.content.publish'), false);

  // Doctor review workflow intact
  assert.equal(hasCapability('clinical_doctor', 'review_clinical_assessment'), true);
  assert.equal(hasCapability('clinical_doctor', 'approve_clinical_report'), true);
  assert.equal(hasCapability('clinical_doctor', 'exam.content.publish'), false);
});

// -------------------------------------------------------------
// 7. Regression: Legacy exam policy functions remain backward compatible
// -------------------------------------------------------------
test('regression: legacyExamAccess and validateHandoff work unchanged', () => {
  assert.equal(legacyExamAccess(null), 401);
  assert.equal(legacyExamAccess(salesCoordinator), 403);
  assert.equal(legacyExamAccess(superAdmin), 200);
  assert.equal(legacyExamAccess(examManager), 200);

  // Handoff validation rejects invalid parameters
  assert.throws(() => validateHandoff({ durationDays: 0 }));
});
