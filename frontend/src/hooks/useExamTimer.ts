// src/hooks/useExamTimer.ts
import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import axios from "axios"; // Assuming axios is used for API calls

interface UseExamTimerProps {
  examId: string;
  studentId: string;
  onTimeUp?: () => void; // optional callback after auto‑submit
}
/**
 * Hook to handle real‑time exam countdown via Socket.io.
 * Connects to the backend server (same origin) and joins the exam room.
 * Emits `joinExam` with `{ examId, studentId }` and receives:
 *   - `timerTick`: remaining seconds (number)
 *   - `timeUp`: indicates timeout, triggers auto‑submit.
 */
export function useExamTimer({ examId, studentId, onTimeUp }: UseExamTimerProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Initialize socket connection once
  useEffect(() => {
    const s = io("http://localhost:3000", {
      withCredentials: true,
    });
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  // Join exam and set up listeners
  useEffect(() => {
    if (!socket) return;

    const joinPayload = { examId, studentId };
    socket.emit("joinExam", joinPayload);

    const handleTick = (seconds: number) => {
      setRemaining(seconds);
    };
    const handleTimeUp = async () => {
      setRemaining(0);
      // Auto‑submit the exam via existing API endpoint
      try {
        await axios.post(`/api/exams/${examId}/submit`, { studentId });
      } catch (err) {
        console.error("Auto‑submit failed", err);
      }
      if (onTimeUp) onTimeUp();
    };

    socket.on("timerTick", handleTick);
    socket.on("timeUp", handleTimeUp);

    return () => {
      socket.off("timerTick", handleTick);
      socket.off("timeUp", handleTimeUp);
    };
  }, [socket, examId, studentId, onTimeUp]);

  // Optional manual submit function
  const submitNow = useCallback(async () => {
    try {
      await axios.post(`/api/exams/${examId}/submit`, { studentId });
    } catch (err) {
      console.error("Manual submit failed", err);
    }
  }, [examId, studentId]);

  return { remaining, submitNow };
}
