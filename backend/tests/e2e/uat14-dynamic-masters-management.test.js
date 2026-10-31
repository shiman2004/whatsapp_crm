import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasExamCapability } from '../../src/examPolicy.js';
import { hasCapability } from '../../src/roleMatrix.js';
import { superAdmin, examManager, examCoordinator, examOfficer, salesOfficer } from './fixtures/actors.js';

test('UAT 14: Dynamic Masters Management by Super Administrator (Happy Path)', () => {
  // 1. Super Admin and Exam Manager have full dynamic master creation & publishing capabilities
  assert.equal(hasExamCapability(superAdmin, 'exam.course.create_draft'), true);
  assert.equal(hasExamCapability(superAdmin, 'exam.content.publish'), true);
  assert.equal(hasExamCapability(examManager, 'exam.course.create_draft'), true);
  assert.equal(hasExamCapability(examManager, 'exam.content.publish'), true);

  // 2. Exam Coordinator can draft dynamic courses
  assert.equal(hasExamCapability(examCoordinator, 'exam.course.create_draft'), true);
  assert.equal(hasExamCapability(examCoordinator, 'exam.draft.submit'), true);

  // Dynamic course simulation
  const coursePayload = {
    courseCode: 'OMSB-PN-01',
    courseName: 'OMSB Pediatric Nurse Specialist Exam Prep',
    examAuthority: 'Oman Medical Specialty Board',
    profession: 'Pediatric Nurse',
    country: 'Oman',
    accessType: 'Paid',
    status: 'Draft',
    created_by: superAdmin.id
  };

  assert.equal(coursePayload.status, 'Draft');
  assert.equal(coursePayload.courseCode, 'OMSB-PN-01');
  assert.equal(coursePayload.created_by, superAdmin.id);
});

test('UAT 14: Role Segregation — Providing Officers and Sales Officers cannot create dynamic courses', () => {
  // Providing Officer CANNOT create course masters (only materials, questions, mocks)
  assert.equal(hasExamCapability(examOfficer, 'exam.course.create_draft'), false);
  assert.equal(hasCapability(examOfficer.role, 'exam.course.create_draft'), false);

  // Sales Officer CANNOT create course masters
  assert.equal(hasExamCapability(salesOfficer, 'exam.course.create_draft'), false);
  assert.equal(hasCapability(salesOfficer.role, 'exam.course.create_draft'), false);
});

test('UAT 14: Publishing Gate — Academic Coordinators cannot publish dynamic courses directly', () => {
  // Coordinators can create and submit, but NOT publish
  assert.equal(hasExamCapability(examCoordinator, 'exam.content.publish'), false);
  assert.equal(hasCapability(examCoordinator.role, 'exam.content.publish'), false);
});
