import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TimedMockExamEngine } from './fixtures/testHarness.js';
import { createSampleMockTest, createSampleMcqQuestion } from './fixtures/payloads.js';

function generateExamQuestions(count = 10) {
  const options = ['A', 'B', 'C', 'D', 'E'];
  const questions = [];
  for (let i = 1; i <= count; i++) {
    const correct = options[(i - 1) % 5];
    questions.push(
      createSampleMcqQuestion({
        id: `mock-q-${i}`,
        questionCode: `Q-${i}`,
        title: `Mock Question ${i}`,
        correctAnswer: correct,
        detailedExplanation: `Detailed rationale for Question ${i} indicating why ${correct} is correct.`
      })
    );
  }
  return questions;
}

test('UAT 17: Timed Mock Examination Engine & Post-Submission Scoring Review (Happy Path - PASS)', () => {
  const mockTest = createSampleMockTest({
    id: 'mock-dha-rn-01',
    mockTestName: 'DHA Nursing Official Simulation Exam',
    durationMinutes: 60,
    passingScore: 70
  });

  const questions = generateExamQuestions(10); // 10 questions, pass = 70% (7 correct)

  // Student answers: 8 correct, 2 wrong -> 80% (PASS)
  const studentAnswers = {
    'mock-q-1': 'A', // correct
    'mock-q-2': 'B', // correct
    'mock-q-3': 'C', // correct
    'mock-q-4': 'D', // correct
    'mock-q-5': 'E', // correct
    'mock-q-6': 'A', // correct
    'mock-q-7': 'B', // correct
    'mock-q-8': 'C', // correct
    'mock-q-9': 'A', // wrong (expected D)
    'mock-q-10': 'A' // wrong (expected E)
  };

  const result = TimedMockExamEngine.gradeMockTest(mockTest, questions, studentAnswers, 2400);

  // Scoring assertions
  assert.equal(result.totalQuestions, 10);
  assert.equal(result.score, 8);
  assert.equal(result.percentage, 80);
  assert.equal(result.passed, true);
  assert.equal(result.result, 'PASS');
  assert.equal(result.correctCount, 8);
  assert.equal(result.wrongCount, 2);
  assert.equal(result.unansweredCount, 0);

  // Post-test review assertions
  assert.equal(result.review.length, 10);
  const q9Review = result.review.find(r => r.questionId === 'mock-q-9');
  assert.equal(q9Review.studentAnswer, 'A');
  assert.equal(q9Review.correctAnswer, 'D');
  assert.equal(q9Review.isCorrect, false);
  assert.ok(q9Review.rationale.includes('Question 9'));
});

test('UAT 17: Timed Mock Exam — Scoring Below Threshold produces FAIL result', () => {
  const mockTest = createSampleMockTest({ passingScore: 70 });
  const questions = generateExamQuestions(10);

  // Student answers: 5 correct, 5 wrong -> 50% (FAIL)
  const studentAnswers = {
    'mock-q-1': 'A', // correct
    'mock-q-2': 'B', // correct
    'mock-q-3': 'C', // correct
    'mock-q-4': 'D', // correct
    'mock-q-5': 'E', // correct
    'mock-q-6': 'E', // wrong
    'mock-q-7': 'E', // wrong
    'mock-q-8': 'E', // wrong
    'mock-q-9': 'E', // wrong
    'mock-q-10': 'A' // wrong
  };

  const result = TimedMockExamEngine.gradeMockTest(mockTest, questions, studentAnswers, 3600);
  assert.equal(result.percentage, 50);
  assert.equal(result.passed, false);
  assert.equal(result.result, 'FAIL');
});

test('UAT 17: Unanswered Questions Counted as Incorrect and Included in Review', () => {
  const mockTest = createSampleMockTest({ passingScore: 70 });
  const questions = generateExamQuestions(5);

  // Student answers only 2 questions, leaves 3 blank
  const studentAnswers = {
    'mock-q-1': 'A', // correct
    'mock-q-2': 'B'  // correct
  };

  const result = TimedMockExamEngine.gradeMockTest(mockTest, questions, studentAnswers, 1800);
  assert.equal(result.totalQuestions, 5);
  assert.equal(result.score, 2);
  assert.equal(result.percentage, 40);
  assert.equal(result.unansweredCount, 3);
  assert.equal(result.result, 'FAIL');

  const blankQ = result.review.find(r => r.questionId === 'mock-q-3');
  assert.equal(blankQ.studentAnswer, null);
  assert.equal(blankQ.isCorrect, false);
});
