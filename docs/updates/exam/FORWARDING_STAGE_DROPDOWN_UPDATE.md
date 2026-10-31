# Forwarding Stage Dropdown Update

Implemented two lead output stages across the CRM:

- **Forwarded to Exam Department** (`forwarded_to_exam_department`)
- **Forwarded to Processing Department** (`forwarded_to_processing_department`)

The stages are available in the Pipeline table Output selector, lead profile/chat stage selectors, Kanban fallback columns, and dashboard stage reporting. The backend fallback and schema bootstrap add the same stages for offline and PostgreSQL environments, and the Prisma `LeadStage` enum plus an idempotent migration were updated.

Verified in the local CRM at `http://localhost:5174/?admin=true#/exam-department`: the Pipeline Output menu shows both options.
