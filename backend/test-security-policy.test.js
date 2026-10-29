import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePermission } from './src/securityPolicy.js';

test('an explicit deny overrides an eligible role capability', () => {
  const decision = resolvePermission({ id: 'officer', role: 'exam_providing_officer', active: true }, 'exam.material.create_draft', [{ capability: 'exam.material.create_draft', effect: 'deny' }]);
  assert.equal(decision.allowed, false);
  assert.equal(decision.source, 'user_override');
});

test('an explicit allow cannot override immutable publication', () => {
  const decision = resolvePermission({ id: 'officer', role: 'exam_providing_officer', active: true }, 'exam.content.publish', [{ capability: 'exam.content.publish', effect: 'allow' }]);
  assert.equal(decision.allowed, false);
  assert.equal(decision.source, 'immutable_policy');
});

test('clinical nurse retains own-assessment create permission only', () => {
  assert.equal(resolvePermission({ id: 'nurse', role: 'clinical_nurse', active: true }, 'clinical.assessment.create').allowed, true);
  assert.equal(resolvePermission({ id: 'nurse', role: 'clinical_nurse', active: true }, 'clinical.assessment.approve').allowed, false);
});
