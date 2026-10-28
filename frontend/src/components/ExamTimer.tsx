// src/components/ExamTimer.tsx
import React from "react";
import { useExamTimer } from "../hooks/useExamTimer";

interface ExamTimerProps {
  examId: string;
  studentId: string;
  onTimeUp?: () => void;
}

/**
 * Simple UI component that displays a mm:ss countdown.
 * It uses the `useExamTimer` hook which handles socket communication
 * and auto‑submission.
 */
export const ExamTimer: React.FC<ExamTimerProps> = ({ examId, studentId, onTimeUp }) => {
  const { remaining, submitNow } = useExamTimer({ examId, studentId, onTimeUp });

  // Format seconds into MM:SS
  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "--:--";
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <span style={{ fontWeight: "bold" }}>Time Remaining:</span>
      <span>{formatTime(remaining)}</span>
      {/* Optional manual submit button */}
      <button onClick={submitNow} style={{ marginLeft: "1rem" }}>
        Submit Now
      </button>
    </div>
  );
};
