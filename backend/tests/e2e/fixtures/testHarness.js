import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { ExamOperations, orderKey } from '../../../src/examOperations.js';
import { StudentAccess } from '../../../src/studentAccess.js';

export const JWT_SECRET = 'test-only-signing-secret-for-e2e-uat-suites-2026';

/**
 * Transactional test double: serializes operations, rolls back on error,
 * and enforces strict immutability on audit tables.
 */
export class TestStore {
  rows = new Map();
  queue = Promise.resolve();
  events = [];

  async transaction(work) {
    const run = this.queue.then(async () => {
      const rows = structuredClone(this.rows);
      const events = structuredClone(this.events);
      const tx = {
        lock: async () => {},
        get: async (kind, id) => structuredClone(rows.get(kind + ':' + id) || null),
        list: async (kind, owner) => {
          return [...rows.entries()]
            .filter(([key, value]) => key.startsWith(kind + ':') && (!owner || value.ownerId === owner || value.studentId === owner))
            .map(([, value]) => structuredClone(value));
        },
        put: async (kind, id, data) => {
          if (kind.includes('audit')) {
            const existing = rows.get(kind + ':' + id);
            if (existing) {
              throw new Error('Audit log records are immutable and cannot be updated or deleted');
            }
          }
          const key = kind + ':' + id;
          const result = {
            ...structuredClone(data),
            revision: (rows.get(key)?.revision || 0) + 1
          };
          rows.set(key, result);
          return result;
        },
        delete: async (kind, id) => {
          if (kind.includes('audit')) {
            throw new Error('Audit log records are immutable and cannot be updated or deleted');
          }
          rows.delete(kind + ':' + id);
        },
        audit: async (actorId, action, target, details = {}) => {
          const auditEvent = {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            actorId,
            action,
            target,
            details: structuredClone(details)
          };
          events.push(auditEvent);
          const key = 'audit:' + auditEvent.id;
          rows.set(key, auditEvent);
          return auditEvent;
        },
        query: async (sql, ...params) => {
          // In-memory query simulation for MCQ questions & mock tests
          if (sql.includes('exam_mcq_questions')) {
            const list = [...rows.entries()]
              .filter(([k]) => k.startsWith('mcq:'))
              .map(([, v]) => v);
            return list;
          }
          return [];
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

/**
 * Strict 2-Device Policy Manager & Session Concurrency Guard
 * Implements R2 & Section 32 UAT 7, 8, 9 specification contracts.
 */
export class DevicePolicyManager {
  constructor(store, secret = JWT_SECRET) {
    this.store = store;
    this.secret = secret;
    this.studentAccess = new StudentAccess(store, secret);
  }

  async getRegisteredDevices(studentId) {
    return this.store.transaction(async tx => {
      const student = await tx.get('student', studentId);
      return student?.registeredDevices || [];
    });
  }

  /**
   * Registers a device enforcing:
   * - Max 2 devices total
   * - Strictly 1 Mobile and 1 Desktop/Laptop
   * - Rejects 2 mobiles, 2 desktops, or 3+ devices
   */
  async registerDevice(studentId, { deviceId, deviceType, userAgent, browserName }) {
    if (!['mobile', 'desktop'].includes(deviceType)) {
      throw new Error('INVALID_DEVICE_TYPE: Device must be mobile or desktop');
    }

    return this.store.transaction(async tx => {
      await tx.lock('student:' + studentId);
      const student = await tx.get('student', studentId, true);
      if (!student) throw new Error('STUDENT_NOT_FOUND');

      const devices = student.registeredDevices || [];
      const existing = devices.find(d => d.deviceId === deviceId);
      if (existing) {
        existing.lastActiveAt = new Date().toISOString();
        await tx.put('student', studentId, student);
        return { success: true, device: existing, devices };
      }

      const mobileCount = devices.filter(d => d.deviceType === 'mobile').length;
      const desktopCount = devices.filter(d => d.deviceType === 'desktop').length;

      if (devices.length >= 2) {
        const error = new Error('THIRD_DEVICE_BLOCKED: Maximum 2 devices registered. Device replacement required.');
        error.code = 'THIRD_DEVICE_BLOCKED';
        error.status = 403;
        throw error;
      }

      if (deviceType === 'mobile' && mobileCount >= 1) {
        const error = new Error('DEVICE_LIMIT_EXCEEDED: A mobile device is already registered. Maximum 1 Mobile and 1 Computer permitted.');
        error.code = 'DEVICE_LIMIT_EXCEEDED';
        error.status = 403;
        throw error;
      }

      if (deviceType === 'desktop' && desktopCount >= 1) {
        const error = new Error('DEVICE_LIMIT_EXCEEDED: A desktop/laptop is already registered. Maximum 1 Mobile and 1 Computer permitted.');
        error.code = 'DEVICE_LIMIT_EXCEEDED';
        error.status = 403;
        throw error;
      }

      const newDevice = {
        deviceId,
        deviceType,
        userAgent: userAgent || 'Mozilla/5.0',
        browserName: browserName || 'Chrome',
        registeredAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        status: 'ACTIVE'
      };

      student.registeredDevices = [...devices, newDevice];
      await tx.put('student', studentId, student);
      await tx.audit(studentId, 'student.device.registered', deviceId, { deviceType });
      return { success: true, device: newDevice, devices: student.registeredDevices };
    });
  }

  /**
   * Device Replacement Challenge:
   * Third device requests replacement -> sends 8-digit OTP -> enters OTP -> Admin approval required.
   */
  async requestDeviceReplacement(studentId, { targetDeviceId, targetDeviceType }) {
    return this.store.transaction(async tx => {
      await tx.lock('student:' + studentId);
      const student = await tx.get('student', studentId, true);
      if (!student) throw new Error('STUDENT_NOT_FOUND');

      const challengeId = crypto.randomUUID();
      const otpCode = crypto.randomInt(10000000, 99999999).toString();

      const challenge = {
        id: challengeId,
        studentId,
        targetDeviceId,
        targetDeviceType,
        code: otpCode,
        failures: 0,
        status: 'PENDING_OTP',
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + 15 * 60 * 1000
      };

      await tx.put('device_challenge', challengeId, challenge);
      await tx.audit(studentId, 'student.device_replacement.requested', challengeId);
      return { challengeId, otpCodeSent: true, codeForTest: otpCode };
    });
  }

  async verifyReplacementOtp(challengeId, enteredCode) {
    const result = await this.store.transaction(async tx => {
      const challenge = await tx.get('device_challenge', challengeId, true);
      if (!challenge) return { notFound: true };
      if (challenge.status === 'LOCKED' || (challenge.failures || 0) >= 5) {
        return { locked: true };
      }
      if (Date.now() > challenge.expiresAt) return { expired: true };

      if (challenge.code !== enteredCode) {
        challenge.failures = (challenge.failures || 0) + 1;
        const locked = challenge.failures >= 5;
        if (locked) {
          challenge.status = 'LOCKED';
        }
        await tx.put('device_challenge', challengeId, challenge);
        return { invalid: true, locked };
      }

      challenge.status = 'PENDING_ADMIN_APPROVAL';
      await tx.put('device_challenge', challengeId, challenge);
      await tx.audit(challenge.studentId, 'student.device_replacement.otp_verified', challengeId);
      return { success: true, status: 'PENDING_ADMIN_APPROVAL' };
    });

    if (result.notFound) throw new Error('CHALLENGE_NOT_FOUND');
    if (result.locked) {
      const err = new Error('CHALLENGE_LOCKED: Too many invalid attempts');
      err.code = 'CHALLENGE_LOCKED';
      throw err;
    }
    if (result.expired) throw new Error('CHALLENGE_EXPIRED');
    if (result.invalid) {
      const err = new Error('INVALID_OTP: Code does not match');
      err.code = 'INVALID_OTP';
      throw err;
    }

    return result;
  }

  async approveDeviceReplacement(adminUser, challengeId) {
    if (adminUser.role !== 'super_admin' && adminUser.role !== 'exam_department_manager') {
      const error = new Error('FORBIDDEN: Administrative approval required');
      error.code = 'FORBIDDEN';
      error.status = 403;
      throw error;
    }

    return this.store.transaction(async tx => {
      const challenge = await tx.get('device_challenge', challengeId, true);
      if (!challenge || challenge.status !== 'PENDING_ADMIN_APPROVAL') {
        throw new Error('INVALID_CHALLENGE_STATE');
      }

      const studentId = challenge.studentId;
      await tx.lock('student:' + studentId);
      const student = await tx.get('student', studentId, true);
      const devices = student.registeredDevices || [];

      // Revoke the old device of matching type
      const revoked = [];
      const retained = [];
      for (const d of devices) {
        if (d.deviceType === challenge.targetDeviceType && revoked.length === 0) {
          d.status = 'REVOKED';
          revoked.push(d);
        } else {
          retained.push(d);
        }
      }

      const newDevice = {
        deviceId: challenge.targetDeviceId,
        deviceType: challenge.targetDeviceType,
        registeredAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        status: 'ACTIVE'
      };

      student.registeredDevices = [...retained, newDevice];
      // Increment generation to immediately terminate all active sessions on revoked device
      student.generation = (student.generation || 0) + 1;
      await tx.put('student', studentId, student);

      challenge.status = 'APPROVED';
      challenge.approvedBy = adminUser.id;
      challenge.approvedAt = new Date().toISOString();
      await tx.put('device_challenge', challengeId, challenge);

      await tx.audit(adminUser.id, 'security.device_replacement.approved', challengeId, {
        studentId,
        revokedDeviceId: revoked[0]?.deviceId,
        newDeviceId: newDevice.deviceId
      });

      return {
        success: true,
        revokedDeviceId: revoked[0]?.deviceId,
        newDeviceId: newDevice.deviceId,
        devices: student.registeredDevices
      };
    });
  }
}

/**
 * Interactive MCQ Practice Validator
 * Enforces R4 & Section 32 UAT 16 specification contracts.
 */
export class InteractiveMcqValidator {
  static evaluateAnswer(question, selectedOption) {
    assert.ok(question, 'Question is required');
    const selected = String(selectedOption || '').toUpperCase().trim();
    const correct = String(question.correctAnswer || '').toUpperCase().trim();

    const isCorrect = selected === correct;

    if (!isCorrect) {
      // Wrong answer: HIDE correct answer, HIDE remember notes, HIDE explanation
      return {
        success: true,
        isCorrect: false,
        status: 'incorrect',
        message: '❌ Your answer is wrong. Please try again.'
      };
    }

    // Correct answer: UNLOCK correct answer, 3 Remember Notes, and clinical explanation
    return {
      success: true,
      isCorrect: true,
      status: 'correct',
      message: '✅ Your answer is correct.',
      correctAnswer: correct,
      rememberNotes: [
        question.rememberNote1,
        question.rememberNote2,
        question.rememberNote3
      ].filter(Boolean),
      detailedExplanation: question.detailedExplanation || question.explanation || ''
    };
  }
}

/**
 * Timed Mock Exam Engine
 * Enforces R4 & Section 32 UAT 17 specification contracts.
 */
export class TimedMockExamEngine {
  static gradeMockTest(mockTest, questions, studentAnswers, elapsedSeconds) {
    const totalQuestions = questions.length;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    const review = [];

    for (const q of questions) {
      const studentChoice = studentAnswers[q.id];
      const correctChoice = String(q.correctAnswer).toUpperCase();

      if (!studentChoice) {
        unansweredCount++;
        review.push({
          questionId: q.id,
          title: q.title,
          studentAnswer: null,
          correctAnswer: correctChoice,
          isCorrect: false,
          rationale: q.detailedExplanation || q.explanation
        });
      } else {
        const isCorr = String(studentChoice).toUpperCase() === correctChoice;
        if (isCorr) correctCount++;
        else wrongCount++;

        review.push({
          questionId: q.id,
          title: q.title,
          studentAnswer: String(studentChoice).toUpperCase(),
          correctAnswer: correctChoice,
          isCorrect: isCorr,
          rationale: q.detailedExplanation || q.explanation
        });
      }
    }

    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passingScore = mockTest.passingScore || 70;
    const passed = percentage >= passingScore;

    return {
      mockTestId: mockTest.id,
      mockTestName: mockTest.mockTestName,
      score: correctCount,
      totalQuestions,
      percentage,
      passed,
      result: passed ? 'PASS' : 'FAIL',
      correctCount,
      wrongCount,
      unansweredCount,
      elapsedSeconds,
      review
    };
  }
}

/**
 * Asserts promise rejects with expected error code or status.
 */
export async function fails(promise, codeOrStatus) {
  return assert.rejects(
    promise,
    (error) => {
      if (typeof codeOrStatus === 'string') {
        return error.code === codeOrStatus || (error.message && error.message.includes(codeOrStatus));
      }
      if (typeof codeOrStatus === 'number') {
        return error.status === codeOrStatus;
      }
      return true;
    },
    `Expected promise to reject with ${codeOrStatus}`
  );
}

/**
 * Decrypts AES-256-GCM outbox payload for verification.
 */
export function unsealPayload(access, payload) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', access.key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return JSON.parse(
    Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')), decipher.final()]).toString()
  );
}
