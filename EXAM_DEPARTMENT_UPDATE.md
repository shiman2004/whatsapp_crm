# Exam department update

The active `D:\whatsapp_crm-main` project now includes a protected student practice workflow.

- Student access is checked before questions are returned.
- Correct answers are never sent with the question list.
- Answers are evaluated on the server.
- Attempt allowance is checked against the student's active entitlement.
- Attempts are stored in the existing durable exam operations store with an audit event.
- The portal exposes an **Open practice questions** action when an entitlement includes a course ID.
- The practice runner now follows the supplied reference format: Tamil-friendly headings, progress panel, question navigator, question card, answer choices, timer and secure submission.
- The same runner supports a separate **Mock Test** mode when the entitlement includes `mock-tests`; it never exposes correct answers before submission.
- Mock exams remain unavailable until reviewed mock-test content is authored and published.

Verification completed:

- Frontend production build passed.
- 14 exam workflow/session tests passed.
- 3 runtime configuration tests passed.
- Backend syntax checks passed.
- Unauthenticated assessment requests return 401.
- Existing Supabase exam tables and practice-question data were inspected read-only.

The active database currently has three active practice questions and zero mock-test records. No database migration or content mutation was performed in this step. Mock Test will remain unavailable until reviewed mock-test questions are authored and published.
