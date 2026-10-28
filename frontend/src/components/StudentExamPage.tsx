// src/components/StudentExamPage.tsx
import React from "react";
import { ExamTimer } from "./ExamTimer";
import { useCrm } from "../context/CrmContext";

/**
 * Placeholder page for a student taking an exam.
 * It expects the current user to be a student and receives the examId
 * via query params (e.g., `?examId=123`).
 * In a real implementation the exam data would be fetched from the API.
 */
export const StudentExamPage: React.FC = () => {
  const { currentUser } = useCrm();

  // Simple extraction of `examId` from URL query string
  const params = new URLSearchParams(window.location.search);
  const examId = params.get("examId") ?? "";

  // Guard: render nothing if missing data
  if (!currentUser?.id || !examId) {
    return <div>Loading exam…</div>;
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Exam #{examId}</h2>
      <ExamTimer examId={examId} studentId={currentUser.id} />
    </div>
  );
};
