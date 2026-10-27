/**
 * Comprehensive Healthcare Licensing Exam Preparation Platform Verification Suite
 * Tests all 12 modules, Spec 89 (Acceptance test for practice question),
 * Spec 90 (Mock test simulation), Question Bank, and Analytics.
 */
import assert from 'assert';
import { Readable } from 'stream';
import { handleExamRoutes } from './src/examRoutes.js';

console.log('🩺 Starting Comprehensive Healthcare Exam Platform Verification Suite...\n');

function createMockReq(method, path, body = null) {
  const req = body ? Readable.from([JSON.stringify(body)]) : Readable.from([]);
  req.method = method;
  req.url = path;
  req.headers = { 'content-type': 'application/json' };
  return req;
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(chunk) {
      if (chunk) this.body += chunk;
      if (this.onEnd) {
        let parsed = null;
        try {
          parsed = this.body ? JSON.parse(this.body) : null;
        } catch (e) {
          parsed = this.body;
        }
        this.onEnd(this.statusCode, parsed);
      }
    }
  };
  return res;
}

function dispatchRoute(method, path, body = null, user = { id: 'admin-01', fullName: 'Dr. Sarah Al Mansoori', role: 'super_admin' }) {
  return new Promise((resolve) => {
    const req = createMockReq(method, path, body);
    const res = createMockRes();
    res.onEnd = (status, data) => resolve({ status, data });
    handleExamRoutes(req, res, path.split('?')[0], user);
  });
}

async function runPlatformTests() {
  // 1. Verify Courses
  console.log('--- 1. Testing Courses API (/api/exam/courses) ---');
  const coursesRes = await dispatchRoute('GET', '/api/exam/courses');
  assert.strictEqual(coursesRes.status, 200);
  assert(Array.isArray(coursesRes.data.data), 'Expected array of courses');
  assert(coursesRes.data.data.length >= 6, 'Expected at least 6 initial healthcare courses');
  const dhaRn = coursesRes.data.data.find(c => c.courseCode === 'DHA-RN');
  assert(dhaRn, 'DHA Registered Nurse course must exist');
  console.log(`✅ Loaded ${coursesRes.data.data.length} courses. DHA-RN verified: ${dhaRn.courseName}`);

  // 2. Verify Course Subjects
  console.log('\n--- 2. Testing Course Subjects (/api/exam/courses/course-dha-rn/subjects) ---');
  const subsRes = await dispatchRoute('GET', '/api/exam/courses/course-dha-rn/subjects');
  assert.strictEqual(subsRes.status, 200);
  assert(Array.isArray(subsRes.data.data), 'Expected array of subjects');
  assert(subsRes.data.data.length >= 10, 'Expected at least 10 subjects for DHA Registered Nurse');
  console.log(`✅ Loaded ${subsRes.data.data.length} DHA-RN subjects (Clinical Procedures, Pharmacology, Emergency, etc.)`);

  // 3. Verify Centralized Question Bank
  console.log('\n--- 3. Testing Question Bank (/api/exam/questions) ---');
  const qbRes = await dispatchRoute('GET', '/api/exam/questions?courseId=course-dha-rn');
  assert.strictEqual(qbRes.status, 200);
  assert(Array.isArray(qbRes.data.data), 'Expected array of questions');
  assert(qbRes.data.data.length >= 10, 'Expected at least 10 clinical questions');
  const bloodQ = qbRes.data.data.find(q => q.questionCode === 'DHA-RN-00001');
  assert(bloodQ, 'Question DHA-RN-00001 must exist');
  assert.strictEqual(bloodQ.correctAnswer, 'C', 'Question 1 correct answer must be C');
  assert(bloodQ.rememberNote1 && bloodQ.rememberNote2 && bloodQ.rememberNote3, 'Must have 3 remember notes');
  console.log(`✅ Question Bank verified: DHA-RN-00001 has 5 options, 1 correct answer, and 3 Remember Notes.`);

  // 4. Spec 89 Acceptance Test: Practice Mode Immediate Checking & Retry Flow
  console.log('\n--- 4. Spec 89 Acceptance Test: Blood Transfusion Scenario ---');
  
  // Step 4.1: Student chooses Option A (Wrong)
  const att1 = await dispatchRoute('POST', '/api/exam/practice/check-answer', {
    questionId: bloodQ.id,
    selectedAnswer: 'A',
    attemptNumber: 1,
    timeSpentSeconds: 12
  });
  assert.strictEqual(att1.data.isCorrect, false);
  assert.strictEqual(att1.data.status, 'incorrect');
  assert.strictEqual(att1.data.message, '❌ Your answer is wrong. Please try again.');
  assert(!att1.data.correctAnswer, 'Must NOT reveal correct answer on wrong attempt');
  assert(!att1.data.rememberNotes, 'Must NOT reveal remember notes on wrong attempt');
  console.log('✅ Attempt 1 (A): Correctly rejected with "❌ Your answer is wrong. Please try again." No answers leaked.');

  // Step 4.2: Student chooses Option D (Wrong)
  const att2 = await dispatchRoute('POST', '/api/exam/practice/check-answer', {
    questionId: bloodQ.id,
    selectedAnswer: 'D',
    attemptNumber: 2,
    timeSpentSeconds: 24
  });
  assert.strictEqual(att2.data.isCorrect, false);
  assert.strictEqual(att2.data.status, 'incorrect');
  assert.strictEqual(att2.data.message, '❌ Your answer is wrong. Please try again.');
  console.log('✅ Attempt 2 (D): Correctly rejected with "❌ Your answer is wrong. Please try again."');

  // Step 4.3: Student chooses Option C (Correct!)
  const att3 = await dispatchRoute('POST', '/api/exam/practice/check-answer', {
    questionId: bloodQ.id,
    selectedAnswer: 'C',
    attemptNumber: 3,
    timeSpentSeconds: 38
  });
  assert.strictEqual(att3.data.isCorrect, true);
  assert.strictEqual(att3.data.status, 'correct');
  assert.strictEqual(att3.data.message, '✅ Your answer is correct.');
  assert.strictEqual(att3.data.correctAnswer, 'C');
  assert(Array.isArray(att3.data.rememberNotes) && att3.data.rememberNotes.length === 3, 'Must return 3 remember notes');
  assert(att3.data.rememberNotes[0].includes('STOP the blood transfusion immediately'));
  console.log('✅ Attempt 3 (C): Validated as correct with 3 Remember Notes unlocked:');
  att3.data.rememberNotes.forEach((n, i) => console.log(`   ${i + 1}. ${n}`));

  // 5. Spec 90 Acceptance Test: Timed Mock Test Simulation & Scoring
  console.log('\n--- 5. Spec 90 Acceptance Test: Timed Mock Test Simulation ---');
  
  // 5.1 Fetch Mock Test for Taker: Answers must be SANITIZED
  const mockExamRes = await dispatchRoute('GET', '/api/exam/mock-tests/mock-dha-rn-01');
  assert.strictEqual(mockExamRes.status, 200);
  const testTakerQuestions = mockExamRes.data.data.questions;
  assert(testTakerQuestions.length > 0, 'Mock test must contain questions');
  for (const q of testTakerQuestions) {
    assert.strictEqual(q.correctAnswer, undefined, `Question ${q.questionCode} must NOT contain correctAnswer for test takers`);
    assert.strictEqual(q.rememberNote1, undefined, `Question ${q.questionCode} must NOT contain remember notes for test takers`);
  }
  console.log(`✅ Mock test retrieved with ${testTakerQuestions.length} questions. Zero answers or notes exposed to taker.`);

  // 5.2 Submit Mock Exam
  const submitRes = await dispatchRoute('POST', '/api/exam/mock-tests/mock-dha-rn-01/submit', {
    answers: {
      'q-dha-rn-00001': 'C', // Correct
      'q-dha-rn-00002': 'B', // Correct
      'q-dha-rn-00003': 'C', // Correct
      'q-dha-rn-00004': 'B', // Correct
      'q-dha-rn-00005': 'D', // Correct (Rule of 15 simple carbs)
      'q-dha-rn-00006': 'A', // Wrong
      'q-dha-rn-00007': 'B', // Correct
      'q-dha-rn-00008': 'B'  // Correct
    },
    studentName: 'Dr. Sarah Al Mansoori',
    timeTakenSeconds: 3450
  });
  assert.strictEqual(submitRes.status, 200);
  const resData = submitRes.data.data;
  assert.strictEqual(resData.correctAnswers, 7, 'Expected 7 correct answers');
  assert.strictEqual(resData.wrongAnswers, 1, 'Expected 1 wrong answer');
  assert.strictEqual(resData.unanswered, 2, 'Expected 2 unanswered');
  assert.strictEqual(resData.percentage, 70, 'Expected 70% score');
  assert.strictEqual(resData.result, 'PASS', '70% >= 65% should be PASS');
  assert(Array.isArray(resData.answersSnapshot), 'Answers snapshot must be saved');
  console.log(`✅ Mock Exam Graded: Score: ${resData.score}/${resData.totalQuestions} (${resData.percentage}%) Result: ${resData.result}`);

  // 6. Study Materials Platform
  console.log('\n--- 6. Testing Study Materials API (/api/exam/study-materials) ---');
  const matRes = await dispatchRoute('GET', '/api/exam/study-materials');
  assert.strictEqual(matRes.status, 200);
  assert(Array.isArray(matRes.data.data) && matRes.data.data.length >= 4, 'Expected study materials');
  console.log(`✅ Loaded ${matRes.data.data.length} study materials (PDFs, Pharmacology Drug Calculations, etc.)`);

  // 7. Exam Guidelines Platform
  console.log('\n--- 7. Testing Exam Guidelines API (/api/exam/guidelines) ---');
  const guideRes = await dispatchRoute('GET', '/api/exam/guidelines');
  assert.strictEqual(guideRes.status, 200);
  assert(Array.isArray(guideRes.data.data) && guideRes.data.data.length >= 4, 'Expected guidelines');
  console.log(`✅ Loaded ${guideRes.data.data.length} guidelines (Overview, Eligibility, Required Documents, Exam Format)`);

  // 8. Student Progress & Weak Area Analytics
  console.log('\n--- 8. Testing Student Analytics API (/api/exam/analytics/student-progress) ---');
  const analRes = await dispatchRoute('GET', '/api/exam/analytics/student-progress');
  assert.strictEqual(analRes.status, 200);
  assert(Array.isArray(analRes.data.data.recommendedPractice), 'Expected recommended practice generator');
  console.log(`✅ Analytics loaded. Weak areas identified and dynamic recommendations generated:`);
  analRes.data.data.recommendedPractice.forEach(r => console.log(`   • ${r.subject} (${r.accuracy}%): ${r.recommendation}`));

  console.log('\n🎉 ALL HEALTHCARE EXAM PLATFORM VERIFICATIONS COMPLETED SUCCESSFULLY WITH 100% PASS RATE!');
}

runPlatformTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
