import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPABILITY_KEYS, ROLES, SCOPES,
  diffPolicy, effectivePolicy, editableRoleCapabilities, getCapability,
  isDelegatableCapability, isImmutableCapability, resolvePermission,
  validateOverrides, validateScope, PermissionError,
} from './src/securityPolicy.js';
import { hasExamCapability } from './src/examPolicy.js';

const user = (role, extra = {}) => ({ id: `${role}-user`, role, active: true, ...extra });

test('registry is internally consistent', () => {
  assert.equal(new Set(CAPABILITY_KEYS).size, CAPABILITY_KEYS.length);
  assert.equal(ROLES.length, 12);
  for (const role of ROLES) {
    const editable = editableRoleCapabilities(role);
    for (const key of editable) {
      const meta = getCapability(key);
      assert.ok(meta, `${key} must exist`);
      assert.equal(meta.roleEditable, true);
      assert.equal(meta.immutable, false);
    }
  }
  // Immutable and delegatable are deliberately disjoint.
  for (const key of CAPABILITY_KEYS) {
    if (isImmutableCapability(key)) assert.equal(isDelegatableCapability(key), false, `${key} cannot be both immutable and delegatable`);
  }
});

test('unknown capabilities and disabled accounts deny by default', () => {
  assert.equal(resolvePermission(user('super_admin'), 'does.not.exist').allowed, false);
  assert.equal(resolvePermission({ id: 'x', role: 'super_admin', active: false }, 'crm.contact.view').allowed, false);
  assert.equal(resolvePermission({ id: null, role: 'super_admin' }, 'crm.contact.view').allowed, false);
});

test('role defaults match the exam target policy', () => {
  assert.equal(hasExamCapability(user('exam_coordinator'), 'exam.course.create_draft'), true);
  assert.equal(hasExamCapability(user('exam_coordinator'), 'exam.material.create_draft'), true);
  assert.equal(hasExamCapability(user('exam_providing_officer'), 'exam.course.create_draft'), false);
  assert.equal(hasExamCapability(user('exam_providing_officer'), 'exam.material.create_draft'), true);
  assert.equal(hasExamCapability(user('exam_providing_officer'), 'exam.question.create_draft'), true);
  assert.equal(hasExamCapability(user('exam_providing_officer'), 'exam.mock_test.create_draft'), true);
  assert.equal(hasExamCapability(user('exam_coordinator'), 'exam.content.publish'), false);
  assert.equal(hasExamCapability(user('exam_providing_officer'), 'exam.content.delete'), false);
});

test('explicit user deny always wins', () => {
  const decision = resolvePermission(user('exam_coordinator'), 'exam.material.create_draft', {
    userOverrides: { 'exam.material.create_draft': { effect: 'deny' } },
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.source, 'user_override');
});

test('delegated allow works only for delegatable capabilities', () => {
  const granted = resolvePermission(user('exam_providing_officer'), 'exam.course.create_draft', {
    userOverrides: { 'exam.course.create_draft': { effect: 'allow' } },
  });
  assert.equal(granted.allowed, true);
  assert.equal(granted.source, 'user_override');

  const notDelegatable = resolvePermission(user('clinical_nurse'), 'clinical.assessment.approve', {
    userOverrides: { 'clinical.assessment.approve': { effect: 'allow' } },
  });
  assert.equal(notDelegatable.allowed, false);
});

test('immutable policy ignores both role and user overrides', () => {
  for (const overrides of [
    { 'exam.content.publish': { effect: 'allow' } },
    { 'security.manage': { effect: 'allow' } },
    { 'marketing.delete_contacts': { effect: 'allow' } },
  ]) {
    const key = Object.keys(overrides)[0];
    const decision = resolvePermission(user('exam_providing_officer'), key, {
      roleOverrides: overrides, userOverrides: overrides,
    });
    assert.equal(decision.allowed, false, key);
    assert.equal(decision.source, 'immutable_policy', key);
  }
});

test('role overrides apply to role defaults and are reported', () => {
  const decision = resolvePermission(user('exam_coordinator'), 'exam.course.create_draft', {
    roleOverrides: { 'exam.course.create_draft': { effect: 'deny' } },
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.source, 'role_override');
});

test('scope only narrows', () => {
  assert.equal(resolvePermission(user('exam_providing_officer'), 'exam.academic.view', { scope: 'all' }).scope, 'department');
  assert.equal(resolvePermission(user('exam_providing_officer'), 'exam.academic.view', { scope: 'own' }).scope, 'own');
  assert.equal(validateScope('exam_providing_officer', 'own'), 'own');
  assert.throws(() => validateScope('clinical_nurse', 'department'), PermissionError);
});

test('override validation rejects unsafe requests', () => {
  assert.throws(() => validateOverrides('user', 'exam_providing_officer', { 'exam.content.publish': 'allow' }), /immutable|protected/i);
  assert.throws(() => validateOverrides('user', 'exam_providing_officer', { 'marketing.export': 'allow' }), /delegated|module/i);
  assert.throws(() => validateOverrides('role', 'exam_providing_officer', { 'crm.contact.delete': 'deny' }), /immutable/i);
  assert.throws(() => validateOverrides('role', 'exam_providing_officer', { 'clinical.assessment.create': 'deny' }), /role|immutable/i);
  const accepted = validateOverrides('user', 'exam_providing_officer', { 'exam.course.create_draft': 'allow' });
  assert.deepEqual(accepted, { 'exam.course.create_draft': { effect: 'allow' } });
});

test('effective policy and diff describe real decisions', () => {
  const before = effectivePolicy(user('exam_providing_officer'));
  assert.equal(before.capabilities['exam.course.create_draft'].allowed, false);
  assert.equal(before.capabilities['exam.material.create_draft'].allowed, true);

  const after = effectivePolicy(user('exam_providing_officer'), {
    userOverrides: { 'exam.course.create_draft': { effect: 'allow' } },
    scope: 'own',
  });
  assert.equal(after.capabilities['exam.course.create_draft'].allowed, true);

  const changes = diffPolicy(before, after);
  const elevation = changes.find(change => change.capability === 'exam.course.create_draft');
  assert.equal(elevation.risk, 'elevation');
  assert.equal(elevation.to.allowed, true);
});

test('every scope value is a known scope', () => {
  for (const key of CAPABILITY_KEYS) {
    const meta = getCapability(key);
    for (const scope of meta.scopes) assert.ok(SCOPES.includes(scope), `${key} has invalid scope ${scope}`);
  }
});
