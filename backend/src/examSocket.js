// Exam Socket.io integration – real‑time timer & auto‑submit
// This module is loaded lazily after the HTTP server starts listening.
// It attaches a Socket.IO server to the raw http.Server instance and
// manages per‑student exam timers.

import { Server as SocketIOServer } from 'socket.io';
import { getPrisma } from './db.js';
import { auditSecurityEvent } from './securityAudit.js';

// Keep track of active interval timers per socket connection.
const examTimers = new Map();

/**
 * Initialise the exam‑related Socket.IO handlers.
 * @param {import('http').Server} httpServer The underlying HTTP server created in legacyServer.js
 */
export function initExamSocket(httpServer) {
  const io = new SocketIOServer(httpServer, {
    // Allow any origin that the CORS middleware already permits.
    cors: { origin: true, credentials: true },
  });

  io.on('connection', (socket) => {
    // Expect a client to emit "joinExam" with the exam and student identifiers.
    socket.on('joinExam', async ({ examId, studentId }) => {
      try {
        const prisma = getPrisma();
        if (!prisma) throw new Error('Prisma client not ready');

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

        // Set up a per‑second interval that drives the countdown.
        const timer = setInterval(async () => {
          remaining -= 1;
          if (remaining <= 0) {
            clearInterval(timer);
            examTimers.delete(socket.id);
            // Auto‑submit – simply mark the attempt as completed.
            await prisma.studentExam.update({
              where: { id: studentExam.id },
              data: { completedAt: new Date() },
            });
            socket.emit('timeUp');
            await auditSecurityEvent({
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
