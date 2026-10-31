# Project: Alpha Health Group (AHG) CRM — Exam Department Management System

## Architecture
- **Technology Stack**:
  - Backend: Node.js (v20 ESM), native `http.createServer` (pathname dispatching, streaming JSON decoders/encoders), Socket.IO for real-time events, Prisma ORM with `@prisma/adapter-pg` and PostgreSQL (Supabase/isolated test DB), hybrid relational tables + JSONB transactional document store (`public.exam_ops_records`) with `pg_advisory_xact_lock` and revision counters.
  - Frontend: React 19.2.8, Vite 8.3.0, TypeScript 6.0.2, Tailwind CSS 3.4.17, Recharts, Lucide React, Socket.IO client.
  - Security Perimeter: Deterministic capability evaluation (`identity -> role default -> role override -> user override -> immutable boundary -> scope clamp -> default deny`), scrypt password hashing (min 15 chars), session versioning, append-only immutable audit tables with PostgreSQL triggers.
  - Student Portal: Isolated mount at `/student` outside `CrmProvider`, strict 2-device policy (1 mobile + 1 desktop/laptop), single active session enforcement, dynamic watermarking on study PDFs.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Mandatory Sales-to-Exam Handoff Form & Automation | Auto/manual conversion of sales leads creates linked Exam case with quotation, voucher, and receipt attachments | M1 | Survey (R1, UAT 1) |
| 2 | Head of Exam Handoff Acceptance | Head of Exam reviews and accepts handoff from inbox | M1 | Survey (R1, UAT 2) |
| 3 | Officer Assignment & Reassignment with Mandatory Reason | Manager assigns/reassigns case to Exam Providing Officer with mandatory recorded reason | M1 | Survey (R1, UAT 2, 4) |
| 4 | Officer Requirement Acceptance & Notifications | Assigned officer acknowledges assignment; automated notification sent | M1 | Survey (R1, UAT 3) |
| 5 | Officer Start Work & Delivery to CRM | Officer tracks preparation and completes handoff back to CRM upon material provision | M1 | Survey (R1, UAT 3) |
| 6 | Case Return to Sales with Mandatory Reason | Manager can return incomplete/invalid cases to Sales with mandatory recorded reason | M1 | Survey (R1, UAT 4) |
| 7 | Sales Discussion History & Attachments Accessibility | Preserves and displays original lead discussion notes and files to both Sales and Exam staff | M1 | Survey (R1, UAT 1) |
| 8 | Student Account Provisioning with Personal Email | Provisioned via personal email; passwords hashed via scrypt; plaintext hidden from staff | M2 | Survey (R2, UAT 5) |
| 9 | Repeat Purchase Identity Linking | Subsequent purchases link entitlements to existing student without duplicate records | M2 | Survey (R2, UAT 6) |
| 10 | Strict Two-Device Registration Gating | Maximum 2 registered devices: strictly 1 Mobile Phone AND 1 Desktop/Laptop | M2 | Survey (R2, UAT 7) |
| 11 | Single Concurrent Session Enforcement | Only one concurrent active session across registered devices; login on device 2 terminates device 1 | M2 | Survey (R2, UAT 8) |
| 12 | Unregistered 3rd Device Block & Replacement Request | 3rd device blocked; generates email OTP challenge and requires CRM Admin approval | M2 | Survey (R2, UAT 9) |
| 13 | Quotation & Financial Details Tracking | Tracks quotation number, total, discount, net amount, paid amount, balance, payment method | M3 | Survey (R3, UAT 1) |
| 14 | Gated Access: Receipt Alone Leaves Materials Locked | Uploading receipt or converting lead leaves materials locked until Finance confirms payment | M3 | Survey (R3, UAT 10) |
| 15 | Independent Finance Payment Verification | Dedicated Finance Officer verifies actual bank/gateway payment with reference code | M3 | Survey (R3, UAT 11) |
| 16 | Maker-Checker Release Request Submission | Exam Processing Officer completes 4-point preparation checklist and submits release request | M3 | Survey (R3, UAT 12) |
| 17 | Maker-Checker Manager Approval & Self-Approval Block | Exam Manager authorizes material release; backend strictly forbids officers from approving own requests | M3 | Survey (R3, UAT 12, 13) |
| 18 | Automatic Student Portal Activation & Idempotent Duplicate Prevention | Manager approval activates materials in student portal; duplicate release calls return existing without dups | M3 | Survey (R3, UAT 13) |
| 19 | Dynamic Examinations, Services & Packages Masters | Super Admin creates, edits, activates/deactivates exams, services, packages dynamically | M4 | Survey (R4, UAT 14) |
| 20 | Multi-Stage Academic Content Draft & Publishing RBAC | Draft -> Submit -> Review -> Changes_Requested / Approve -> Publish lifecycle with role gates | M4 | Survey (R4, UAT 15) |
| 21 | Interactive MCQ Practice Engine with Immediate Validation | 5 options (A-E); wrong answer triggers retry; correct answer unlocks 3 Remember Notes & explanation | M4 | Survey (R4, UAT 16) |
| 22 | Timed Simulation Mock Test Engine | Timed mock test with overall countdown; zero answers disclosed during test; post-test scoring review | M4 | Survey (R4, UAT 17) |
| 23 | Student Portal Access Protection & Dynamic PDF Watermark | Displays only purchased active materials; PDF viewer applies dynamic diagonal student watermark | M4 | Survey (R4, UAT 18) |
| 24 | Centralized Dashboard Workload KPIs & Monitoring | Operations dashboard displays pending handoffs, active cases, SLA countdowns, and workload KPIs | M5 | Survey (R1/R5, UAT 20) |
| 25 | Append-Only Immutable Audit Trail with PostgreSQL Triggers | Logs all transitions, assignments, reassignments, verifications, and approvals; DB triggers block UPDATE/DELETE | M5 | Survey (R5, UAT 19) |
| 26 | Role-Based Perimeter Security across 5 Roles | Enforces RBAC across Super Admin, Sales Officer, Exam Manager, Exam Processing Officer, Finance Officer | M5 | Survey (R1/R5, UAT 20) |

## Milestones
| # | Name | Scope | Dependencies | Status | Outputs & Verification |
|---|------|-------|-------------|--------|------------------------|
| M1 | CRM Workflow & Sales-to-Exam Handover | Features 1–7 (UAT 1–4) | none | **DONE** | Passed all gate reviews (Reviewers, Challengers, Auditor). `examOperations.js`, `examOperationsRoutes.js`, `ExamOperationsView.tsx`, 101/101 tests pass, build clean |
| M2 | Student Account & Controlled Device Security | Features 8–12 (UAT 5–9) | none | **DONE** | Passed all gate reviews (Reviewers, Challengers, Auditor). `legacyServer.js`, `studentAccess.js`, `studentRoutes.js`, `securityRoutes.js`, `StudentPortal.tsx`, 69/69 tests pass, build clean |
| M3 | Quotation, Payment Verification & Maker-Checker Release | Features 13–18 (UAT 10–13) | M1, M2 | IN_PROGRESS | Prerequisites: M1 (Done), M2 (Done). Implementing Maker-Checker approval and Finance payment verification. |
| M4 | Dynamic Masters & Examination Content System | Features 19–23 (UAT 14–18) | M2, M3 | PLANNED | Prerequisites: M2, M3 |
| M5 | Centralized Monitoring, Reporting & Immutable Audit Trail | Features 24–26 (UAT 19–20) | M1, M2, M3, M4 | PLANNED | Prerequisites: M1-M4 |
| M6 | Final Milestone: 100% E2E Test Suite & Adversarial Hardening | Phase 1 (Tiers 1-4, UAT 1-20) + Phase 2 (Tier 5 Challenger) | M1–M5, TEST_READY | PLANNED | `TEST_READY.md` published, 24/24 suites pass |

## Interface Contracts

### M1 (CRM Workflow) ↔ M3 (Payment Verification & Release)
- Contract: `POST /api/exam-ops/handoffs` creates or updates an `exam-handoff` record with `paymentStatus = 'PENDING'`.
- Status transitions:
  - `PENDING_ACCEPTANCE` -> `ACCEPTED` -> `ASSIGNED` -> `OFFICER_ACCEPTED` -> `IN_PROGRESS` -> `DELIVERED_TO_CRM`.
  - Return: `POST /api/exam-ops/handoffs/:id/return` with `{ revision, reason: string (min 3 chars) }` transitions status to `RETURNED_TO_SALES`.
  - Reassign: `POST /api/exam-ops/handoffs/:id/assign` with `{ revision, officerId, officerName, reason: string (min 3 chars) }` updates `assignedOfficerId` and records audit entry.

### M2 (Student Account & Device Security) ↔ M3 (Release) & M4 (Learning Portal)
- Contract: Student identifier `studentId = orderKey(email) = sha256(lowercase(email)).slice(0, 32)`.
- Identity Linking: Multiple orders for same email resolve to the identical `studentId`. Entitlements are appended to student's `accesses` array.
- Device Policy:
  - Allowed devices: array of `{ deviceId, deviceType: 'mobile' | 'desktop', browserDigest, userAgent, registeredAt, lastActiveAt }`.
  - Limit rule: `mobileCount <= 1 && desktopCount <= 1 && total <= 2`.
  - Third device attempt returns HTTP 403 `THIRD_DEVICE_BLOCKED` with challenge ID.
  - Device replacement: `POST /api/student/replace-device/request` -> email OTP -> `POST /api/student/replace-device/verify-otp` -> CRM Admin approval via `POST /api/security/device-replacements/:id/approve`.

### M3 (Finance & Maker-Checker) ↔ M4 (Content Activation)
- Contract: `POST /api/exam-ops/requirements/:orderId/verify-payment`:
  - Actor role: `finance_officer` or `super_admin`.
  - Payload: `{ revision, reference: string (min 3 chars) }`.
  - Updates `paymentStatus = 'VERIFIED'`.
- Contract: `POST /api/exam-ops/requirements/:orderId/transition`:
  - Actor role: `exam_providing_officer` or `exam_coordinator`.
  - Payload: `{ revision, status: 'PENDING_MANAGER_APPROVAL', checklist: { account: true, materials: true, exams: true, quality: true } }`.
- Contract: `POST /api/exam-ops/requirements/:orderId/manager-approve`:
  - Actor role: `exam_department_manager` or `super_admin`.
  - Hard check: `actor.id !== order.submittedByOfficerId`.
  - Payload: `{ revision, reason: string (min 3 chars) }`.
  - Triggers idempotent `prepare-access` creating student entitlements for published material IDs.

### M4 (MCQ Practice & Mock Engines) ↔ Student Portal
- Contract: `POST /api/exam/practice/submit`:
  - Payload: `{ questionId, selectedOption, attemptNumber }`.
  - Incorrect response: `{ isCorrect: false }`.
  - Correct response: `{ isCorrect: true, correctAnswer: string, rememberNotes: string[3], explanation: string }`.
- Contract: `POST /api/exam/mock/submit`:
  - Payload: `{ mockTestId, answers: Record<string, string>, timeSpentSeconds }`.
  - Returns: `{ score, totalQuestions, percentage, passed: boolean, review: Array<{ questionId, selectedOption, correctOption, rationale }> }`.
- Contract: `GET /api/student/materials/:id/content`:
  - Returns streaming PDF with dynamic diagonal text watermark: `"Licensed to: <studentName> (<studentId>) | <email> | <timestamp> | AHG CRM Protected"`.

## Code Layout
- Backend Domain Logic:
  - `backend/src/examOperations.js` — Sales-to-exam workflow, case states, return/reassign logic, maker-checker authorization, entitlement provisioning.
  - `backend/src/studentAccess.js` — Student account provisioning, scrypt hashing, 2-device policy, concurrent session termination, device replacement.
  - `backend/src/examPolicy.js` — RBAC permission resolution, file upload validation, transition definitions.
  - `backend/src/roleMatrix.js` & `backend/src/securityPolicy.js` — Role definitions including `finance_officer`.
  - `backend/src/examRoutes.js`, `backend/src/examOperationsRoutes.js`, `backend/src/studentRoutes.js` — API dispatchers.
  - `backend/prisma/schema.prisma` & migrations — Database models (`UserRole` enum update, device replacements, release requests, dynamic masters).
- Frontend Views & Workspaces:
  - `frontend/src/components/exam/ExamOperationsView.tsx` & `ExamDepartmentWorkspace.tsx` — Exam case queues, accept, assign, return, reassign modals, sales discussion timeline.
  - `frontend/src/components/exam/StudentPortal.tsx` — Student login, device registration, concurrent session alert, replacement request modal.
  - `frontend/src/components/exam/InteractiveMcqPracticeView.tsx` — Practice mode (instant retry, 3 remember notes).
  - `frontend/src/components/exam/MockTestRunnerView.tsx` — Timed mock engine (countdown, review mode).
  - `frontend/src/components/exam/StudyMaterialsView.tsx` — Watermarked PDF viewer.
  - `frontend/src/types/index.ts`, `frontend/src/config/navigation.ts`, `frontend/src/components/admin/user-management/CreateUserTab.tsx` — `finance_officer` role and workspace routing.
- Test Suites:
  - `backend/tests/e2e/run-all-uat.js` — Master runner for all 20 Section 32 UAT suites + 4 Architecture Tiers.
  - `backend/test-academic-content-rbac.test.js`, `backend/test-exam-upgrade.test.js` — Unit/integration tests.
