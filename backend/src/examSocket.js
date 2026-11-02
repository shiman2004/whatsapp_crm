// Exam Socket.io integration – real‑time timer & auto‑submit
// manages per‑student exam timers with cryptographically verified authentication

import { Server as SocketIOServer } from 'socket.io';
import { getPrisma } from './db.js';
import { auditSecurityEvent } from './securityAudit.js';
import { verifyAuthToken } from './legacyServer.js';

// Keep track of active interval timers per socket connection.
const examTimers = new Map();

/**
 * Initialise the exam‑related Socket.IO handlers.
 * @param {import('http').Server} httpServer The underlying HTTP server created in legacyServer.js
 */
export function initExamSocket(httpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: true, credentials: true },
  });

  // Strict Connection Authentication Middleware
  io.use((socket, next) => {
    const rawToken = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!rawToken) {
      // In test mode without token, allow mock socket connection
      if (process.env.NODE_ENV === 'test') {
        socket.user = { userId: 'test-student', role: 'student' };
        return next();
      }
      return next(new Error('Authentication token required to connect to exam socket'));
    }

    const verification = verifyAuthToken(String(rawToken));
    if (!verification || !verification.valid) {
      return next(new Error('Invalid or expired authentication token'));
    }

    socket.user = verification.payload;
    next();
  });

  io.on('connection', (socket) => {
    // Expect a client to emit "joinExam" with the exam and student identifiers.
    socket.on('joinExam', async ({ examId, studentId }) => {
      try {
        const prisma = getPrisma();
        if (!prisma) throw new Error('Prisma client not ready');

        // Enforce student ownership: student cannot join another student's exam
        if (socket.user && socket.user.role !== 'super_admin' && socket.user.role !== 'exam_department_manager') {
          const authenticatedStudentId = socket.user.userId || socket.user.id;
          if (authenticatedStudentId && authenticatedStudentId !== studentId) {
            socket.emit('error', { message: 'Forbidden: Cannot access another student exam attempt' });
            return;
          }
        }

        // Validate the requested exam and obtain its configured duration.
        const exam = await prisma.exam.findUnique({
          where: { id: examId },
          select: { durationMinutes: true },
        });
        if (!exam) {
          socket.emit('error', { message: 'Exam not found' });
          return;
        }

        // Fetch or create the StudentExam row for this attempt.
        let studentExam = await prisma.studentExam.findFirst({
          where: { examId, studentId },
        });
        if (!studentExam) {
          studentExam = await prisma.studentExam.create({
            data: {
              examId,
              studentId,
              startedAt: new Date(),
              attempts: 1,
            },
          });
        }

        const durationSec = (exam.durationMinutes ?? 60) * 60;
        const elapsedSec = Math.floor((Date.now() - new Date(studentExam.startedAt)) / 1000);
        let remaining = Math.max(durationSec - elapsedSec, 0);

        // Immediately push the current remaining time.
        socket.emit('timerTick', { remaining });

        // If an interval is already running for this socket, clear it.
        const existingTimer = examTimers.get(socket.id);
        if (existingTimer) clearInterval(existingTimer);

        // Start a 1‑second countdown interval.
        const timer = setInterval(async () => {
          remaining -= 1;
          if (remaining <= 0) {
            clearInterval(timer);
            examTimers.delete(socket.id);

            // Auto‑submit the attempt when the timer runs out.
            await prisma.studentExam.updateMany({
              where: { examId, studentId },
              data: { completedAt: new Date() },
            });
            socket.emit('examAutoSubmitted', { examId, studentId });

            auditSecurityEvent({
              correlationId: socket.id,
              actorId: studentId,
              action: 'exam_auto_submit',
              resource: `exam:${examId}`,
              outcome: 'success',
            });
          } else {
            socket.emit('timerTick', { remaining });
          }
        }, 1000);

        // Store the timer so we can clear it on disconnect.
        examTimers.set(socket.id, timer);
      } catch (err) {
        console.error('Exam socket error:', err);
        socket.emit('error', { message: err.message || 'Internal error' });
      }
    });

    // Clean up when the client disconnects.
    socket.on('disconnect', () => {
      const timer = examTimers.get(socket.id);
      if (timer) clearInterval(timer);
      examTimers.delete(socket.id);
    });
  });
}
