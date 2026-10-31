# Backend Codebase Exploration & Architectural Gap Analysis

## Executive Summary
This report presents a comprehensive investigation of the backend architecture of the WhatsApp CRM for Alpha Health Group (AHG). The investigation assesses the existing technical foundation, models, security perimeter, API dispatchers, test runners, and specific capability gaps required to deliver the Exam Department Management System across all 5 operational phases (CRM Workflow, Student Account & Device Security, Payment & Approval, Examination Content System, and Monitoring & Reporting).

---

## 1. Observation

### 1.1 Backend Technology Stack
- **Language / Runtime**: Node.js (v18+/v20+) using ES Modules (`"type": "module"` in `package.json` line 5 and `backend/package.json` line 5).
- **Web Server Framework**: Native Node.js `http.createServer` (`backend/src/legacyServer.js` line 1012), exposed through `createApp` (`backend/src/app.js` line 7). **Notice: Express.js is NOT used.** The server implements direct pathname routing with streaming JSON decoders (`readJson`, `readExamJson`) and native response serializers (`examJson`, `json`).
- **Real-Time Communication**: Socket.IO (`socket.io` v4.8.4, `backend/package.json` line 33) mounted on the HTTP server (`backend/src/legacyServer.js` line 26) for broadcasting message statuses and lead updates.
- **ORM / Database Client**: Prisma ORM (`@prisma/client` v7.10.1, `prisma` v7.10.1) with driver adapter `@prisma/adapter-pg` v7.10.1 and `pg` v8.23.1 (`backend/src/db.js` lines 1–2).
- **Database Engine**: PostgreSQL on Supabase Cloud (`DATABASE_URL` transaction pooler and `DIRECT_URL`). Supports local isolated PostgreSQL instances via `backend/.env.test`.
- **Migration & Schema System**:
  - Declarative Prisma Schema: `backend/prisma/schema.prisma` (1,117 lines, 48 Prisma models, 8 enums).
  - Versioned SQL Migrations: `backend/prisma/migrations/` (21 migration files).
  - Idempotent Runtime DDL Bootstrap: `backend/src/schemaBootstrap.js` (631 lines). Executed once per process on connection via `ensureSchema(prisma)` (`backend/src/db.js` lines 71–77).
  - Hybrid Storage Architecture: Strongly-typed relational tables for core CRM records (`users`, `leads`, `customers`, `messages`, `departments`, `teams`) combined with PostgreSQL JSONB transactional document stores (`public.exam_ops_records`, `public.clinical_ops_records`) backed by transactional advisory locking (`pg_advisory_xact_lock`) and optimistic concurrency revisions (`backend/src/examStore.js` lines 17–42).

### 1.2 Existing Database Schema, Models & Relationships
- **Users, Staff & Roles**:
  - `User` model (`backend/prisma/schema.prisma` lines 143–178, mapped to `users`):
    - Fields: `id`, `fullName`, `email`, `password`, `pin`, `phone`, `role`, `branch`, `company` (`RWC` | `CRAS` | `AHC`), `treatmentCategoryId`, `language`, `avatar`, `active`, `marketingAccess`, `employeeId`, `departmentId`, `managerId`, `suspendedAt`, `lockedUntil`, `lastLoginAt`, `sessionVersion`, `createdAt`, `updatedAt`.
    - Role Enum `UserRole` (`schema.prisma` lines 13–26): `super_admin`, `leads_officer`, `coordinator`, `sales_coordinator`, `exam_department_manager`, `exam_coordinator`, `exam_providing_officer`, `marketing_officer`, `marketing_admin`, `clinical_nurse`, `clinical_doctor`, `report_analyst`.
    - **Notice**: `finance_officer` is present in `backend/src/roleMatrix.js` line 105, but is **MISSING** from Prisma `UserRole` enum and `backend/src/securityPolicy.js` `ROLE_DEFINITIONS`.
  - `UserSession` model (`schema.prisma` lines 1103–1117): Active session registry with `tokenVersion`, `ip`, `userAgent`, and revocation timestamps.
  - `Department`, `Team`, `TeamMember`, `UserInvitation` (`schema.prisma` lines 1046–1101): Organizational hierarchy.
- **Inquiries & Sales**:
  - `Customer` model (`schema.prisma` lines 292–311): E.164 phone numbers (`whatsappNumber`), display names, preferred language.
  - `Lead` model (`schema.prisma` lines 314–356):
    - Fields: `id`, `customerId`, `categoryId`, `treatmentId`, `serialNumber` (allocated atomically per company via `public.next_company_lead_serial`), `stage` (`LeadStage`), `source`, `company`, `assignedTo` (User), `assignedById`, `assignedByName`, `assignedAt`, `acceptedAt`.
    - Stages: `new`, `assigned`, `contacted`, `potential`, `under_discussion`, `forwarded_to_exam_department`, `forwarded_to_processing_department`, `not_relevant`, `not_eligible`, `converted`, `lost`, `interested`, `follow_up`.
  - Discussion history: `Message` model (`schema.prisma` lines 359–400) and `LeadNote` (`schema.prisma` lines 447–462).
  - Pipeline Stage Audit: `LeadStageHistory` (`schema.prisma` lines 465–482) and `LeadAssignmentHistory` (`schema.prisma` lines 518–535).
- **Quotations and Payments**:
  - **No dedicated relational table**: There is no `Quotation` or `Payment` model in `backend/prisma/schema.prisma`.
  - In `backend/src/examOperations.js` (lines 54–62, 206–213), financial data (`quotationNumber`, `amountMinor`, `currency`, `paymentReceiptUrl`, `receiptVoucherNo`, `receiptVoucherUrl`, `paymentStatus`, `paymentReference`) is serialized inside the JSONB `data` column of `public.exam_ops_records` (kind: `exam-handoff` or `requirement`).
- **Audit Trails**:
  - `AuditLog` (`schema.prisma` lines 485–499): Entity changes.
  - `SecurityAuditEvent` (`backend/src/schemaBootstrap.js` lines 102–114): Has an explicit PostgreSQL trigger `security_audit_events_no_rewrite` (`schemaBootstrap.js` lines 516–521) that aborts any `UPDATE` or `DELETE` statement, enforcing pure append-only immutability.
  - `exam_ops_audit` (`backend/prisma/migrations/20261027_exam_operations.sql` lines 17–24): Append-only log of exam events (`actor_id`, `action`, `target`, `details`, `created_at`).
  - `exam_academic_audit` (`backend/prisma/migrations/20261029_exam_academic_rbac_workflow.sql` lines 24–38): Draft lifecycle transitions.
- **Attachments and Media Storage**:
  - `public.media_files` (`schemaBootstrap.js` lines 81–89): PostgreSQL `BYTEA` storage.
  - Supabase Storage (`backend/src/supabaseMedia.js`): Private bucket upload/download.
  - Signed private media URLs (`backend/src/examRoutes.js` lines 37–55): HMAC SHA-256 tokens signed with `JWT_SECRET` (`/uploads/:fileName?exp=...&sig=...`).

### 1.3 Authentication & Authorization Mechanisms
- **Staff Authentication**:
  - Endpoint: `POST /api/auth/login` (`backend/src/legacyServer.js` line 1243).
  - Secret verification via scrypt/HMAC in `backend/src/secretHash.js`.
  - Issues signed JWT token containing `{ id, email, role, company, branch, name, sessionVersion }`.
  - Rate limiting via database table `auth_rate_limits` (`backend/src/schemaBootstrap.js` lines 92–99).
- **Student Authentication**:
  - Endpoints in `backend/src/studentRoutes.js` (lines 33–47): `POST /api/student/activate`, `POST /api/student/login`, `POST /api/student/verify-device`, `GET /api/student/me`, `POST /api/student/logout`.
  - Logic in `backend/src/studentAccess.js`:
    - Passwords hashed using `crypto.scrypt` with a 16-byte random salt, requiring minimum 15 characters (`studentAccess.js` lines 22–27).
    - Session tracking using HttpOnly Lax cookie `exam_session` and device cookie `exam_browser`.
    - Token digest stored in database `session` document.
    - Single active session enforcement: logging in increments `student.generation` (`studentAccess.js` line 96), immediately invalidating previous session tokens upon subsequent requests.
- **Staff Authorization / Role Matrix**:
  - Defined across `backend/src/roleMatrix.js` and `backend/src/securityPolicy.js`.
  - Deterministic evaluation order: `identity -> role default -> role override -> user override -> immutable boundary -> scope clamp -> default deny` (`securityPolicy.js` lines 239–250).
  - Scopes: `own` (rank 0), `assigned` (rank 1), `department` (rank 2), `all` (rank 3).
  - Current staff roles in `securityPolicy.js` (`ROLE_DEFINITIONS`, lines 108–161):
    - `super_admin`: capability `*`, scope `all`.
    - `leads_officer`: CRM contacts, lead assign/reassign, `exam.operations.view`, `exam.operations.submit`.
    - `sales_coordinator` & `coordinator`: CRM contacts, `exam.operations.view`, `exam.operations.submit`.
    - `exam_department_manager`: `exam.operations.view`, `exam.operations.submit`, `exam.operations.manage`, `exam.academic.view`, `exam.course.create_draft`, `exam.material.create_draft`, `exam.question.create_draft`, `exam.mock_test.create_draft`, `exam.draft.edit_own`, `exam.draft.submit`, `exam.content.review`, `exam.content.publish`, `exam.content.delete`.
    - `exam_coordinator` & `exam_providing_officer`: academic draft creation, draft editing, and submission. Denied publish, review, and delete.

### 1.4 API Architecture & Service Layers
- **Modular Route Handlers**:
  - `handleExamOperations` (`backend/src/examOperationsRoutes.js`): Dispatches `/api/exam-ops/*`.
  - `handleExamAcademicDrafts` (`backend/src/examAcademicRoutes.js`): Dispatches `/api/exam-ops/academic-drafts/*`.
  - `handleExamRoutes` (`backend/src/examRoutes.js`): Dispatches `/api/exam/*` (3,134 lines).
  - `handleStudentRoutes` (`backend/src/studentRoutes.js`): Dispatches `/api/student/*`.
  - `handleSecurityRoutes` (`backend/src/securityRoutes.js`): Dispatches `/api/security/*`.
  - `handleUserManagementRoutes` (`backend/src/userManagementRoutes.js`): Dispatches `/api/users/*`.
- **File Upload Handling**:
  - Direct HTTP streaming to memory/buffer in `backend/src/examRoutes.js` line 1106 (`POST /api/exam/upload`).
  - Validation: `validateAcademicUpload` in `backend/src/examPolicy.js` lines 152–176 blocks executable extensions (`.exe`, `.bat`, `.cmd`, `.sh`, `.msi`) and enforces a 25MB direct upload cap.
- **PDF Generation & Watermarking**:
  - **No PDF generation or binary manipulation library**: Neither `pdf-lib` nor `pdfkit` is installed in `backend/package.json`.
  - In `backend/src/studentRoutes.js` lines 56–57, the watermark is currently returned merely as a string metadata property in the JSON payload:
    `watermark: student.id.slice(0, 12) + ' • ' + student.email.replace(/(^.).*(@.*$)/, '$1***$2') + ' • ' + new Date().toISOString()`.
- **Email Services**:
  - In `backend/src/studentAccess.js` lines 44–47, emails are written to an encrypted database outbox document (`kind: 'outbox'`) with AES-256-GCM.
  - In `backend/src/examOperationsRoutes.js` line 71, activation invites check `process.env.STUDENT_EMAIL_ENABLED === 'true'`. No live SMTP/API delivery dispatch worker is currently running.

### 1.5 Test Setup & Test Runners
- **Test Runner**: Node.js built-in test runner (`node --test`), invoked via:
  - `node --test backend/test-exam-upgrade.test.js` (14/14 tests pass, duration: 1.01s).
  - `node --test backend/test-academic-content-rbac.test.js` (14/14 tests pass, duration: 135ms).
  - `node --test backend/test-permission-resolution.test.js backend/test-security-policy.test.js` (18/18 tests pass, duration: 201ms).
- **Master Sequential Runner**: `backend/scripts/run-tests.js` executes 26 test suites sequentially against the isolated test database specified in `backend/.env.test`.
- **Fixtures & Test Doubles**: Pure-logic test suites utilize an in-memory transactional test double `TestStore` (`test-exam-upgrade.test.js` lines 9–25) that implements `lock`, `get`, `list`, `put`, and `audit` with zero live database dependencies.

---

## 2. Logic Chain

1. **Stack & Routing Architecture**:
   - Because `legacyServer.js` instantiates `http.createServer` directly without Express, all new endpoints must conform to the modular handler signature `async function handleXYZ(req, res, pathname, user): Promise<boolean>` and use `readExamJson(req)` / `examJson(res, status, data)` utilities.
2. **Sales-to-Exam Handover Automation (R1)**:
   - In `CrmContext.tsx` line 2441, the Sales-to-Exam handoff is currently dispatched as a frontend client-side `fetch` call upon stage transition.
   - If a lead stage is modified via backend API or network fails, the handoff record is not created.
   - Therefore, a backend hook inside lead stage transitions in `legacyServer.js` or `db.js` is required to guarantee atomic creation of the linked `exam-handoff` record.
   - In `backend/src/examOperations.js`, `updateHandoff` currently supports `accept`, `assign`, `accept-assignment`, `start`, and `complete`. It lacks `return` (return to sales) and `reassign` (reassign between officers) with mandatory recorded reasons.
3. **Student Account Security & Device Enforcement (R2)**:
   - `studentAccess.js` lines 94–104 maintains a single `student.browserDigest`. When logging in from another device, it generates an OTP challenge (`verifyDevice`) and replaces the old browser digest.
   - To satisfy the 2-device policy (strictly 1 mobile and 1 desktop/laptop), `studentAccess.js` must store a structured `registeredDevices` array with `{ deviceId, deviceType: 'mobile' | 'desktop', browserDigest, userAgent, registeredAt, lastActiveAt }`.
   - Any attempt to register a second mobile or a second desktop, or a 3rd unregistered device when 2 are already active, must be rejected with `THIRD_DEVICE_BLOCKED` and route to a formal `DeviceReplacementRequest` workflow requiring email verification and administrative approval.
4. **Financial Details & Maker-Checker Release Flow (R3)**:
   - In `examOperations.js` line 206, `verify-payment` is currently gated behind `assertAdmin(user)` and sets `paymentStatus = 'VERIFIED'`.
   - The requirements specify a strict Maker-Checker process:
     1. `finance_officer` independently verifies payment (`verify-payment`).
     2. `exam_providing_officer` selects purchased material entitlements and submits a release request (`request-release`).
     3. `exam_department_manager` authorizes release (`approve-release`), with a hard check preventing self-approval (`request.requestedBy !== manager.id`).
   - `finance_officer` must be added to Prisma `UserRole`, `securityPolicy.js` `ROLE_DEFINITIONS`, and granted specific capabilities (`finance.payment.verify`, `finance.payment.view`).
5. **Dynamic Masters & PDF Dynamic Watermarking (R4)**:
   - Super Administrators must be able to configure Examinations, Services, and Packages without code modification. While `exam_courses` and `exam_categories` exist, dynamic mapping of Packages and Services is currently held in unstructured JSON arrays.
   - For study PDFs, returning a watermark string in JSON is insufficient for downloaded or viewed PDF assets. A streaming PDF watermarking engine (using `pdf-lib`) must be integrated into `/api/student/materials/:id` to dynamically stamp the student's name, ID, email, and timestamp onto each page.
6. **Immutable Audit Logging (R5)**:
   - `public.security_audit_events` already possesses a database trigger blocking `UPDATE` and `DELETE`.
   - The CRM must route all critical workflow actions (inquiry conversion, case assignment, reassignment with reason, account status change, device registration/revocation, payment verification, release request/approval, account suspension) to this append-only immutable table.

---

## 3. Caveats
- **Live Database Connection**: No live remote database migrations or write mutations were executed during this exploration; all findings are derived from source code analysis, migration files, Prisma schema definitions, and offline test executions.
- **Frontend Contract Alignment**: The frontend already contains rich UI components in `frontend/src/pages/ExamDepartment.tsx` and `frontend/src/context/CrmContext.tsx`. New backend capabilities must maintain backwards compatibility with existing endpoints to avoid breaking existing UI workflows.
- **Email Service Configuration**: External SMTP or API credentials (e.g., Sendgrid, Resend) are currently absent in `.env`. Outbox queuing is functional, but physical delivery requires runtime provider configuration.

---

## 4. Conclusion & Actionable Architectural Requirements

To satisfy all requirements (R1 through R5) and pass all 20 User Acceptance Testing scenarios, the backend requires the following specific implementation tasks:

### Task Breakdown for Implementation:
1. **Schema & Migration Updates**:
   - Update `backend/prisma/schema.prisma` and add a migration for:
     - Add `finance_officer` to `UserRole` enum.
     - Add `DeviceReplacementRequest` model (`id`, `studentId`, `deviceType`, `browserDigest`, `reason`, `status`, `approvedBy`, `createdAt`).
     - Add `MaterialReleaseRequest` model or document schema for the Maker-Checker workflow (`id`, `handoffId`, `studentId`, `materialIds`, `requestedBy`, `approvedBy`, `status`, `createdAt`).
     - Add dynamic master tables: `exam_packages` and `exam_package_services`.
2. **Security & Role Matrix Integration**:
   - In `backend/src/securityPolicy.js` and `backend/src/roleMatrix.js`:
     - Register `finance_officer` in `ROLE_DEFINITIONS` with max scope `department` and capabilities: `finance.payment.verify`, `finance.payment.view`.
     - Add Maker-Checker capabilities: `exam.release.request` (assigned to Exam Officers) and `exam.release.approve` (assigned to Exam Manager / Super Admin with self-approval prevention).
3. **Sales-to-Exam Handover State Machine (`examOperations.js`)**:
   - Add atomic handover trigger upon lead status change to `forwarded_to_exam_department` or `converted`.
   - Add `return` action with mandatory reason.
   - Add `reassign` action requiring `reassignmentReason`, updating `assignedOfficerId`, and logging an immutable audit event.
   - Expose lead discussion history and attachments to assigned exam officers.
4. **Student Account Security & 2-Device Policy (`studentAccess.js`)**:
   - Implement `registeredDevices` array (strictly max 1 mobile and 1 desktop/laptop).
   - Detect device type from User-Agent / client payload (`mobile` vs `desktop`).
   - If 2 devices exist and a new device attempts login: block access with code `THIRD_DEVICE_BLOCKED` and create a `DeviceReplacementRequest`.
   - Implement admin approval endpoint for device replacement that terminates active sessions on the revoked device.
   - Implement complete account lifecycle states: `Pending Activation`, `Email Verification Pending`, `Active`, `Suspended`, `Locked`, `Disabled`.
5. **Maker-Checker Material Release Engine**:
   - `verify-payment`: Restrict strictly to `finance_officer` and `super_admin`.
   - `request-release`: Exam Processing Officer selects entitlements and submits request.
   - `approve-release`: Exam Manager verifies payment and approves; reject self-approval (`requireValue(user.id !== request.requestedBy, 'SELF_APPROVAL_FORBIDDEN')`).
   - Prevent duplicate activations via idempotency keys.
6. **Dynamic Masters, Mock Concealment & PDF Watermarking**:
   - Dynamic CRUD endpoints for Examinations, Services, and Packages.
   - Conceal correct answers and explanations when active mock tests are in progress until final submission.
   - Install `pdf-lib` and inject dynamic watermark stamps (student name, ID, email, date) onto protected PDF streams in `GET /api/student/materials/:id`.
7. **Automated Verification Suite**:
   - Implement a test suite covering the 20 UAT scenarios using `node:test` and `TestStore`.

---

## 5. Verification Method

To independently verify the observations and conclusions in this report:

1. **Verify Backend Offline Test Suites**:
   ```powershell
   node --test backend/test-exam-upgrade.test.js
   node --test backend/test-academic-content-rbac.test.js
   node --test backend/test-permission-resolution.test.js backend/test-security-policy.test.js
   ```
   *Expected result*: All 46 tests across these suites pass with exit code 0.

2. **Verify Native HTTP Server Architecture (Absence of Express)**:
   Inspect `backend/server.js`, `backend/src/app.js`, and `backend/src/legacyServer.js` line 1012.
   *Expected result*: Direct `http.createServer` call without Express middleware.

3. **Verify Roles and Capabilities**:
   Inspect `backend/src/roleMatrix.js` and `backend/src/securityPolicy.js` lines 108–161.
   *Expected result*: Observe `ROLE_DEFINITIONS` contains 11 roles, with `finance_officer` absent from `securityPolicy.js` and `schema.prisma`.

4. **Verify Student Password Hashing & Single Session**:
   Inspect `backend/src/studentAccess.js` lines 22–35, 94–104.
   *Expected result*: Observe `scrypt` hashing and `student.generation` incrementation on new session generation.

5. **Verify Immutable Audit Log Database Trigger**:
   Inspect `backend/src/schemaBootstrap.js` lines 516–521.
   *Expected result*: PostgreSQL trigger `security_audit_events_no_rewrite` raises exception on `UPDATE` or `DELETE`.
