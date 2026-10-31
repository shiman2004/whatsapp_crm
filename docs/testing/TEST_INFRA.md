# TEST_INFRA.md — Automated Test Infrastructure & 4-Tier Architecture Specification
**Project:** Alpha Health Group (AHG) CRM — Exam Department Management System  
**Framework:** Node.js Native Test Runner (`node:test` + `node:assert/strict`)  
**Status:** Authoritative Test Architecture & Delivery Baseline  
**Target Coverage:** 100% Section 32 User Acceptance Testing (UAT 1 – 20) & Tiers 1–4  

---

## 1. Test Philosophy & Design Principles

### 1.1 Opaque-Box & Requirement-Driven
The testing strategy is strictly **opaque-box** and **specification-driven**, derived directly from `ORIGINAL_REQUEST.md`, `PROJECT.md`, and the Section 32 User Acceptance Testing specifications. Tests treat the system as a black/opaque box:
- Interactions occur strictly via defined API contracts, public service entry points, state machine triggers, and observable HTTP request/response payloads.
- Expected outputs are derived from authoritative specifications, mathematical/cryptographic properties (e.g. SHA-256 digests, scrypt verification, revision monotonicity), and documented error codes.
- Tests do not assert against internal private implementation variables; instead, they verify contract guarantees, HTTP status codes, security boundaries, and immutable audit logs.

### 1.2 Deterministic Isolation & Safety Guard
- **Zero Production Risk:** In accordance with `backend/src/testDbGuard.js`, automated tests never connect to or mutate the production Supabase/PostgreSQL database.
- **Transactional Test Double (`TestStore`):** Test suites execute against isolated transactional memory doubles that mirror the PostgreSQL hybrid relational + JSONB document schema (`exam_ops_records`, `exam_ops_audit`, `exam_academic_audit`). Each test manages its own state lifecycle and serializes operations through transactional locking (`tx.lock`).
- **Complete Test Independence:** Each test case sets up its own fixtures, creates dedicated UUIDs, runs without reliance on prior test state, and cleans up deterministically.
- **Flake-Free Execution:** Network timing dependencies, real SMTP servers, and third-party WhatsApp Meta webhooks are decoupled via deterministic local fixtures and cryptographic tokens.

---

## 2. The 4-Tier Test Architecture

The test suite is organized into four distinct architectural tiers providing comprehensive depth and defense-in-depth:

```
+-----------------------------------------------------------------------------------+
|                           4-TIER TEST ARCHITECTURE                                |
+-----------------------------------------------------------------------------------+
|  Tier 4: Real-World Scenarios (End-to-End Multi-Phase Candidate Lifecycles)      |
|  - Full sales-to-learning-to-certification pathways                                |
|  - Repeat purchase, device replacement, and incident audits                       |
+-----------------------------------------------------------------------------------+
|  Tier 3: Cross-Feature Combinations (Pairwise & Cross-Module Interactions)        |
|  - Sales Handoff <-> Finance Verification <-> Maker-Checker Approval               |
|  - Entitlement Provisioning <-> Student Login <-> Device Limit Gating             |
+-----------------------------------------------------------------------------------+
|  Tier 2: Boundary & Corner Cases (>=5 per Feature Category)                       |
|  - Input bounds, 0/negative/extreme numbers, string lengths, MIME types            |
|  - Stale revision concurrency races, 5-OTP lockout, brute-force defenses          |
+-----------------------------------------------------------------------------------+
|  Tier 1: Feature Coverage (>=5 per Feature Category)                              |
|  - Happy-path validation for all 26 Features across all 5 Phases                  |
|  - Verification of core CRUD, state machines, scrypt hashing, RBAC gates          |
+-----------------------------------------------------------------------------------+
```

### 2.1 Tier 1: Feature Coverage (>= 5 Tests Per Category)
Covers the primary contract behavior (happy paths) for every assigned feature:
1. **Phase 1: CRM Workflow & Sales-to-Exam Handover**
   - Handoff submission with valid signed documents and quotation.
   - Manager handoff acceptance with timestamp and audit attribution.
   - Manager officer assignment with valid officer ID and reason.
   - Officer requirement acceptance and notification emission.
   - Officer progress tracking and CRM delivery completion.
2. **Phase 2: Student Account Management & Controlled Device Security**
   - Student account generation keyed by `orderKey(email)`.
   - Email invitation challenge token generation.
   - Secure activation with >=15 character password and scrypt salt:digest storage.
   - Returning student entitlement linking without duplicate records.
   - Successful login from first mobile device and first desktop computer.
3. **Phase 3: Quotation, Payment Verification & Maker-Checker Material Release**
   - Handoff initialization with `paymentStatus = 'PENDING'`.
   - Independent Finance Officer payment verification with reference code.
   - Processing Officer completion of 4-point preparation checklist.
   - Transition to `PENDING_MANAGER_APPROVAL`.
   - Manager approval triggering automatic student entitlement activation.
4. **Phase 4: Dynamic Masters & Content System with MCQ/Mock Engines**
   - Super Admin dynamic course creation without code modifications.
   - Multi-stage draft lifecycle (`Draft` -> `Pending_Review` -> `Published`).
   - Interactive MCQ Practice correct answer unlocking 3 Remember Notes & explanation.
   - Timed Mock Exam submission grading and scoring accuracy.
   - Student portal displaying only purchased active course materials.
5. **Phase 5: Monitoring, Reporting & Immutable Audit Trail**
   - Operational health metrics and SLA countdown monitoring.
   - Immutable audit logging on every handoff transition.
   - Immutable audit logging on financial payment verification.
   - Immutable audit logging on device security challenges.
   - Role-based capabilities verification across all 5 core roles.

### 2.2 Tier 2: Boundary & Corner Cases (>= 5 Tests Per Category)
Exhaustively stresses edges, validations, error cascades, and adversarial conditions:
1. **Phase 1 Boundaries:**
   - Missing or malformed payment receipt URL (must match signed pattern).
   - Missing or malformed voucher number or voucher file URL.
   - Stale revision numbers on case accept/assign (HTTP 409 `STALE_RECORD`).
   - Non-manager attempting acceptance or assignment (HTTP 403 `FORBIDDEN`).
   - Empty or sub-3-character reassignment reason (HTTP 400 `REASON_REQUIRED`).
2. **Phase 2 Boundaries:**
   - Password < 15 characters, repeated characters (`aaaa...`), or common words (HTTP 400 `PASSWORD_POLICY`).
   - Nonexistent email vs. wrong password (identical public error HTTP 401 `INVALID_LOGIN`, constant-time scrypt).
   - Attempting to register 2 mobile devices (HTTP 403 `DEVICE_LIMIT_EXCEEDED`).
   - Attempting to register 2 laptop computers (HTTP 403 `DEVICE_LIMIT_EXCEEDED`).
   - 5 consecutive invalid OTP verification attempts locking the device challenge.
3. **Phase 3 Boundaries:**
   - Attempting material activation while payment is `PENDING` (HTTP 409 `PAYMENT_REQUIRED`).
   - Attempting manager approval with any of the 4 checklist items `false` (HTTP 409 `CHECKLIST_REQUIRED`).
   - Maker-Checker self-approval block: processing officer attempting manager approval (HTTP 403 `FORBIDDEN`).
   - Passing payment reference < 3 characters (HTTP 400 `REFERENCE_REQUIRED`).
   - Duplicate `prepare-access` call returning HTTP 409 `ACCESS_EXISTS` without duplicate rows.
4. **Phase 4 Boundaries:**
   - Duplicate `courseCode` creation returning HTTP 409 conflict.
   - Non-manager attempting content publication (HTTP 403 `FORBIDDEN`).
   - Author attempting to edit another author's draft (HTTP 403 `FORBIDDEN`).
   - Upload of prohibited file extensions (`.exe`, `.sh`, `.bat`, `.js`, etc.) returning HTTP 400 `PROHIBITED_FILE_TYPE`.
   - Upload of file exceeding 25MB returning HTTP 400 `FILE_TOO_LARGE`.
5. **Phase 5 Boundaries:**
   - Simulated database trigger rejecting `UPDATE` or `DELETE` on audit tables.
   - Token forgery or role manipulation in bearer token.
   - Cross-salesperson order isolation (salesperson B cannot read salesperson A's orders).
   - Expired entitlement (`endsAt < now()`) immediately vanishing from student portal.
   - Student attempting to access course material not present in active entitlements (HTTP 403 `NO_ACCESS`).

### 2.3 Tier 3: Cross-Feature Combinations (Pairwise & Multi-Module)
Verifies emergent behavior across module boundaries and integration contracts:
1. **Sales Handoff -> Finance Verification -> Maker-Checker Approval -> Entitlement Release**
   - Full flow across 3 departments; verifying materials remain locked at each intermediate step and unlock only upon manager authorization.
2. **Repeat Purchase Identity Linking + Multi-Package Portal Aggregation**
   - Candidate with existing DHA course purchases an NCLEX package; verifies single student account retains both active packages simultaneously.
3. **Two-Device Registration + Concurrent Session Invalidation**
   - Candidate registers 1 mobile + 1 laptop; logging into mobile terminates active laptop session; laptop token returns HTTP 401 `SESSION_EXPIRED`.
4. **Third Device Access Block -> OTP Challenge -> Admin Approval -> Revocation**
   - Candidate on 2 registered devices logs in from 3rd device; receives block challenge; verifies OTP; admin approves; old device is revoked and sessions terminated.
5. **Academic Publishing RBAC + MCQ Practice Engine Access**
   - Content author drafts question; manager reviews and publishes; question immediately becomes active in Practice Mode; wrong answer yields no notes; correct answer unlocks 3 Remember Notes.
6. **Maker-Checker Checklist Enforcement with Published Asset Gate**
   - Manager approval requires published material IDs; attempting to attach an unpublished draft asset fails with HTTP 409 `ASSET_NOT_PUBLISHED`.

### 2.4 Tier 4: Real-World Application Scenarios (End-to-End Pathways)
Executes complete multi-phase candidate journeys from inquiry intake to exam day:
1. **Scenario Alpha: Dr. Fatima's Complete DHA Licensing Journey**
   - Lead converted with quotation and bank slip -> Head of Exam accepts -> Assigns Officer Ahmed -> Finance verifies bank wire -> Officer Ahmed prepares DHA syllabus and submits for approval -> Head of Exam approves -> Fatima activates account with strong passphrase -> Registers iPhone & Windows PC -> Practices MCQs (handles retry and learns 3 Remember Notes) -> Passes 120-minute simulation mock exam -> Views dynamically watermarked clinical PDF -> Audit log records all 8 events.
2. **Scenario Beta: Nurse Chen's Repeat Purchase & Device Replacement**
   - Existing active student purchases second qualification -> Entitlements link without duplicate record -> Attempts login from new iPad -> Limit triggered -> Requests device replacement -> Enters email OTP -> Admin approves -> Old laptop revoked -> New iPad granted access -> Both courses visible.
3. **Scenario Gamma: Adversarial Integrity & Self-Approval Prevention Drill**
   - Salesperson attempts to bypass finance verification -> Blocked.
   - Processing officer attempts self-approval -> Blocked.
   - Malicious upload of `.sh` script disguised as PDF -> Blocked.
   - Candidate enters 5 wrong OTP codes -> Locked out.
   - Malicious actor attempts `DELETE` on audit trail -> Rejected by trigger.

---

## 3. Section 32 User Acceptance Testing (UAT) Catalog Mapping

All 20 UAT Scenarios are mapped directly to dedicated automated test suites in `backend/tests/e2e/`:

| UAT # | Scenario Name | Primary Features Tested | Dedicated Test File |
|-------|---------------|-------------------------|---------------------|
| **UAT 1** | Sales Inquiry Conversion & Automated Exam Case Creation | Features 1, 7, 13 (R1, R3) | `backend/tests/e2e/uat01-sales-handoff.test.js` |
| **UAT 2** | Exam Manager Case Acceptance & Officer Assignment | Features 2, 3 (R1) | `backend/tests/e2e/uat02-manager-accept-assign.test.js` |
| **UAT 3** | Officer Requirement Acceptance, Work Tracking & Delivery | Features 4, 5 (R1) | `backend/tests/e2e/uat03-officer-work-delivery.test.js` |
| **UAT 4** | Case Reassignment & Return with Mandatory Reason | Features 3, 6 (R1) | `backend/tests/e2e/uat04-reassign-return-reason.test.js` |
| **UAT 5** | Student Account Provisioning & Secure Activation | Feature 8 (R2) | `backend/tests/e2e/uat05-student-provisioning.test.js` |
| **UAT 6** | Repeat Purchase Identity Linking Without Duplication | Feature 9 (R2) | `backend/tests/e2e/uat06-repeat-purchase-linking.test.js` |
| **UAT 7** | Two-Device Registration Gating (1 Mobile + 1 Computer) | Feature 10 (R2) | `backend/tests/e2e/uat07-two-device-gating.test.js` |
| **UAT 8** | Single Concurrent Session Enforcement Across Devices | Feature 11 (R2) | `backend/tests/e2e/uat08-single-session-concurrency.test.js` |
| **UAT 9** | Unregistered Third Device Block & Replacement Request | Feature 12 (R2) | `backend/tests/e2e/uat09-third-device-replacement.test.js` |
| **UAT 10** | Receipt Upload Leaves Materials Locked | Feature 14 (R3) | `backend/tests/e2e/uat10-receipt-upload-gating.test.js` |
| **UAT 11** | Independent Finance Officer Payment Verification | Feature 15 (R3) | `backend/tests/e2e/uat11-finance-payment-verification.test.js` |
| **UAT 12** | Maker-Checker Segregation & Self-Approval Prevention | Features 16, 17 (R3) | `backend/tests/e2e/uat12-maker-checker-segregation.test.js` |
| **UAT 13** | Final Manager Release Approval & Idempotent Portal Activation | Features 17, 18 (R3) | `backend/tests/e2e/uat13-manager-approval-activation.test.js` |
| **UAT 14** | Dynamic Masters Management by Super Administrator | Feature 19 (R4) | `backend/tests/e2e/uat14-dynamic-masters-management.test.js` |
| **UAT 15** | Academic Content Draft & Multi-Stage RBAC Workflow | Feature 20 (R4) | `backend/tests/e2e/uat15-academic-draft-rbac.test.js` |
| **UAT 16** | Interactive MCQ Practice Engine with Immediate Validation | Feature 21 (R4) | `backend/tests/e2e/uat16-mcq-practice-validation.test.js` |
| **UAT 17** | Timed Mock Examination Engine & Scoring Review | Feature 22 (R4) | `backend/tests/e2e/uat17-timed-mock-exam-engine.test.js` |
| **UAT 18** | Student Learning Portal Access & Dynamic Watermarking | Feature 23 (R4) | `backend/tests/e2e/uat18-portal-pdf-watermarking.test.js` |
| **UAT 19** | Immutable Audit Logging Across Operational Lifecycle | Feature 25 (R5) | `backend/tests/e2e/uat19-immutable-audit-trail.test.js` |
| **UAT 20** | Role-Based Perimeter & Capability Enforcement (5 Roles) | Feature 26 (R1, R5) | `backend/tests/e2e/uat20-role-perimeter-security.test.js` |

In addition to individual UAT files, the 4 Tier aggregator suites are located at:
- `backend/tests/e2e/tier1-feature-coverage.test.js`
- `backend/tests/e2e/tier2-boundary-corner-cases.test.js`
- `backend/tests/e2e/tier3-cross-feature-combinations.test.js`
- `backend/tests/e2e/tier4-real-world-e2e-scenarios.test.js`

---

## 4. Test Harness & Shared Fixtures (`backend/tests/e2e/fixtures/`)

To guarantee strict determinism and zero production database interaction:
- `backend/tests/e2e/fixtures/testHarness.js`: Provides the authoritative `TestStore` double with atomic transactions, revision counters, audit recording, and database trigger simulations.
- `backend/tests/e2e/fixtures/actors.js`: Canonical test actors representing the five core roles:
  - `superAdmin`: `role: 'super_admin'`
  - `salesOfficer`: `role: 'coordinator'`, `company: 'CRAS'`
  - `examManager`: `role: 'exam_department_manager'`
  - `examOfficer`: `role: 'exam_providing_officer'`
  - `financeOfficer`: `role: 'finance_officer'`
- `backend/tests/e2e/fixtures/payloads.js`: Standardized payload generators for sales handoffs, quotations, student accounts, MCQ questions, mock tests, and payment verifications.

---

## 5. Execution & Verification Commands

### 5.1 Running the Full E2E Test Suite
```bash
node backend/tests/e2e/run-all-uat.js
```

### 5.2 Running Individual UAT Scenarios
```bash
node --test backend/tests/e2e/uat01-sales-handoff.test.js
node --test backend/tests/e2e/uat12-maker-checker-segregation.test.js
node --test backend/tests/e2e/uat16-mcq-practice-validation.test.js
```

### 5.3 Running by Architecture Tier
```bash
node --test backend/tests/e2e/tier1-feature-coverage.test.js
node --test backend/tests/e2e/tier2-boundary-corner-cases.test.js
node --test backend/tests/e2e/tier3-cross-feature-combinations.test.js
node --test backend/tests/e2e/tier4-real-world-e2e-scenarios.test.js
```

---

## 6. Success & Completion Criteria
1. Every one of the 20 Section 32 UAT scenarios passes with 100% assertions satisfied.
2. Tiers 1 through 4 pass without skips, cancellations, or unhandled rejections.
3. Zero database mutations against live databases (`testDbGuard` satisfied).
4. Automated test runner generates summary report detailing scenario IDs, execution times, and pass/fail statuses.
