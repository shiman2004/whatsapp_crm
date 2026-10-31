import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canManageExam,
  canHandleExam,
  canHandleAssignedExam,
  canSubmitExamRequirement,
  canAccessAcademic,
  hasExamCapability
} from '../../src/examPolicy.js';
import { hasCapability } from '../../src/roleMatrix.js';
import {
  superAdmin,
  examManager,
  examOfficer,
  salesOfficer,
  financeOfficer,
  examCoordinator
} from './fixtures/actors.js';

test('UAT 20: Super Administrator — Has comprehensive supervisory capabilities', () => {
  assert.equal(canManageExam(superAdmin), true);
  assert.equal(canHandleExam(superAdmin), true);
  assert.equal(canSubmitExamRequirement(superAdmin), true);
  assert.equal(canAccessAcademic(superAdmin), 200);
  assert.equal(hasExamCapability(superAdmin, 'exam.content.publish'), true);
  assert.equal(hasExamCapability(superAdmin, 'exam.course.create_draft'), true);
  assert.equal(hasCapability('super_admin', 'exam.content.publish'), true);
});

test('UAT 20: Exam Department Manager — Can manage, assign, approve, and publish', () => {
  assert.equal(canManageExam(examManager), true);
  assert.equal(canHandleExam(examManager), true);
  assert.equal(canAccessAcademic(examManager), 200);
  assert.equal(hasExamCapability(examManager, 'exam.content.review'), true);
  assert.equal(hasExamCapability(examManager, 'exam.content.publish'), true);
  assert.equal(hasExamCapability(examManager, 'exam.content.delete'), true);
});

test('UAT 20: Exam Providing Officer — Can draft and complete tasks, CANNOT publish or create courses', () => {
  assert.equal(canManageExam(examOfficer), false);
  assert.equal(canHandleExam(examOfficer), true);
  assert.equal(canHandleAssignedExam(examOfficer), true);
  assert.equal(canAccessAcademic(examOfficer), 200);

  // Can draft materials, questions, mock tests
  assert.equal(hasExamCapability(examOfficer, 'exam.material.create_draft'), true);
  assert.equal(hasExamCapability(examOfficer, 'exam.question.create_draft'), true);
  assert.equal(hasExamCapability(examOfficer, 'exam.mock_test.create_draft'), true);

  // CANNOT create course masters, review, or publish
  assert.equal(hasExamCapability(examOfficer, 'exam.course.create_draft'), false);
  assert.equal(hasExamCapability(examOfficer, 'exam.content.review'), false);
  assert.equal(hasExamCapability(examOfficer, 'exam.content.publish'), false);
});

test('UAT 20: Sales Coordinator — Can submit leads, CANNOT accept handoffs or publish academic content', () => {
  assert.equal(canSubmitExamRequirement(salesOfficer), true);
  assert.equal(canManageExam(salesOfficer), false);
  assert.equal(canAccessAcademic(salesOfficer), 403);
  assert.equal(hasExamCapability(salesOfficer, 'exam.content.publish'), false);
});

test('UAT 20: Finance Officer — Role capability isolation', () => {
  // Finance Officer has finance verification capabilities
  assert.equal(hasCapability('finance_officer', 'verify_payment'), true);
  assert.equal(hasCapability('finance_officer', 'view_financial_reports'), true);
  assert.equal(hasCapability('finance_officer', 'adjust_payment'), true);

  // Finance Officer CANNOT publish academic content or create exam drafts
  assert.equal(hasCapability('finance_officer', 'exam.content.publish'), false);
  assert.equal(hasCapability('finance_officer', 'exam.course.create_draft'), false);
});

test('UAT 20: Unauthenticated & Foreign Roles Perimeter Block', () => {
  // Unauthenticated / Absent identity returns 401
  assert.equal(canAccessAcademic(null), 401);
  assert.equal(canAccessAcademic({}), 401);

  // Non-exam clinical roles return 403
  assert.equal(canAccessAcademic({ id: 'nurse-x', role: 'clinical_nurse' }), 403);
  assert.equal(canAccessAcademic({ id: 'doc-x', role: 'clinical_doctor' }), 403);
  assert.equal(canAccessAcademic({ id: 'mkt-x', role: 'marketing_admin' }), 403);
});
