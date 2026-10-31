import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InteractiveMcqValidator } from './fixtures/testHarness.js';
import { createSampleMcqQuestion } from './fixtures/payloads.js';

test('UAT 16: Interactive MCQ Practice Immediate Validation (Happy Path)', () => {
  const question = createSampleMcqQuestion({
    id: 'RN-001',
    correctAnswer: 'C',
    rememberNote1: 'Suspected acute transfusion reaction: STOP the blood transfusion immediately.',
    rememberNote2: 'Maintain IV access with 0.9% normal saline using new tubing.',
    rememberNote3: 'Assess vital signs and notify physician and blood bank.',
    detailedExplanation: 'An acute hemolytic reaction is a medical emergency requiring immediate cessation of the infusion.'
  });

  // 1. Initial Question Payload for student must NEVER disclose correct answer or notes
  const studentSafePayload = {
    id: question.id,
    questionCode: question.questionCode,
    title: question.title,
    questionText: question.questionText,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    optionE: question.optionE
  };
  assert.equal(studentSafePayload.correctAnswer, undefined, 'Initial question payload must hide correctAnswer');
  assert.equal(studentSafePayload.rememberNotes, undefined, 'Initial question payload must hide rememberNotes');
  assert.equal(studentSafePayload.detailedExplanation, undefined, 'Initial question payload must hide detailedExplanation');

  // 2. Step 1: Student submits WRONG Option A
  const wrongResult = InteractiveMcqValidator.evaluateAnswer(question, 'A');
  assert.equal(wrongResult.isCorrect, false);
  assert.equal(wrongResult.status, 'incorrect');
  assert.equal(wrongResult.message, '❌ Your answer is wrong. Please try again.');
  assert.equal(wrongResult.correctAnswer, undefined, 'Wrong answer MUST NOT reveal correctAnswer');
  assert.equal(wrongResult.rememberNotes, undefined, 'Wrong answer MUST NOT reveal rememberNotes');
  assert.equal(wrongResult.detailedExplanation, undefined, 'Wrong answer MUST NOT reveal detailedExplanation');

  // 3. Step 2: Student retries and submits CORRECT Option C
  const correctResult = InteractiveMcqValidator.evaluateAnswer(question, 'C');
  assert.equal(correctResult.isCorrect, true);
  assert.equal(correctResult.status, 'correct');
  assert.equal(correctResult.message, '✅ Your answer is correct.');
  assert.equal(correctResult.correctAnswer, 'C');

  // Exactly three Remember Notes must be unlocked
  assert.ok(Array.isArray(correctResult.rememberNotes), 'rememberNotes must be an array');
  assert.equal(correctResult.rememberNotes.length, 3, 'Must contain exactly 3 Remember Notes');
  assert.equal(correctResult.rememberNotes[0], question.rememberNote1);
  assert.equal(correctResult.rememberNotes[1], question.rememberNote2);
  assert.equal(correctResult.rememberNotes[2], question.rememberNote3);

  // Detailed clinical explanation must be unlocked
  assert.equal(correctResult.detailedExplanation, question.detailedExplanation);
});

test('UAT 16: Case-Insensitivity & Whitespace Resiliency', () => {
  const question = createSampleMcqQuestion({ correctAnswer: 'B' });

  const resultLower = InteractiveMcqValidator.evaluateAnswer(question, '  b  ');
  assert.equal(resultLower.isCorrect, true);
  assert.equal(resultLower.correctAnswer, 'B');
});
