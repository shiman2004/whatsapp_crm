# Milestone 1: CRM Workflow & Sales-to-Exam Handover — Backend Review & Adversarial Challenge Report

**Author**: teamwork_reviewer (Code Reviewer & Adversarial Critic)  
**Date**: 2026-10-29  
**Review Target**: Milestone 1 Backend Implementation  
- `backend/src/examOperations.js`
- `backend/src/examOperationsRoutes.js`
- `backend/test-exam-upgrade.test.js`  
**Verdict**: **APPROVE**

---

## 1. Review Summary

- **Verdict**: **APPROVE**
- **Integrity Check**: **PASSED** (Zero integrity violations. No hardcoded test IDs, no facades, no bypasses, genuine optimistic locking and audit logging).
- **Core Requirements Check**:
  - Accept, Assign, Reassign with mandatory reason (>= 3 chars): **PASS**
  - Return to Sales with mandatory reason (>= 3 chars): **PASS**
  - Officer requirement acceptance, work tracking, and completion: **PASS**
  - Discussion history preservation and note appending with department/sender attribution: **PASS**
  - Automated in-app notifications across counter-parties: **PASS**
  - Zero regression on existing test suites: **PASS**

---

## 2. Observation

### 2.1 Code Review Observations

1. **State Machine Transitions in `backend/src/examOperations.js`**:
   - `updateHandoff` (lines 279–460) enforces strict lifecycle progression:
     - `accept` (lines 288–301): Validates caller is Head of Exam (`canManageExam(user)`), current status is `PENDING_ACCEPTANCE`, sets status to `ACCEPTED`, logs `acceptedBy`, `acceptedByName`, `acceptedAt`, and dispatches notification to the sales coordinator (`record.ownerId`).
     - `assign` (lines 302–349): Restricted to manager. Checks target officer format and name. Detects whether action is initial assignment or reassignment (`const isReassignment = Boolean(record.assignedOfficerId && (record.assignedOfficerId !== officerId || record.status !== 'ACCEPTED'))`). Reassignments mandate `reason.length >= 3` (line 311: throws 400 `REASON_REQUIRED`). Sets status to `ASSIGNED`, records `previousOfficerId`, `previousOfficerName`, `reassignmentReason`, `reassignedAt`, and notifies both the newly assigned officer and the previous officer (`exam.handoff.reassigned_from`).
     - `return` (lines 350–365): Restricted to manager. Permitted from `['PENDING_ACCEPTANCE', 'ACCEPTED', 'ASSIGNED', 'OFFICER_ACCEPTED', 'IN_PROGRESS']`. Strictly enforces `reason.length >= 3` (line 353: throws 400 `REASON_REQUIRED`). Sets status to `RETURNED_TO_SALES`, records `returnedBy`, `returnedByName`, `returnedAt`, `returnReason`, and notifies the sales coordinator.
     - `accept-assignment` (lines 366–379): Rejects managers (`requireValue(!manager, 'FORBIDDEN', ...)`), validates status is `ASSIGNED`, and enforces `record.assignedOfficerId === user.id`. Updates status to `OFFICER_ACCEPTED` and notifies Head of Exam.
     - `start` (lines 380–390): Enforces `record.assignedOfficerId === user.id` and status `OFFICER_ACCEPTED`. Updates status to `IN_PROGRESS`, sets `startedAt`, and notifies Head of Exam.
     - `complete` (lines 391–411): Enforces `record.assignedOfficerId === user.id` and status `IN_PROGRESS`. Sets status to `DELIVERED_TO_CRM`, records `completedAt`, `completionNote`, and sends notifications to both Head of Exam and Sales coordinator (`record.ownerId`).
     - `add-note` (lines 412–450): Checks authorization (`manager || record.assignedOfficerId === user.id || record.ownerId === user.id`). Enforces non-empty note content. Accurately attributes department (`isExamStaff ? 'Exam Department' : 'Sales'`). Appends uploaded attachments to both the note and `record.attachments`. Notifies counterparties.

2. **Sales Discussion History & Attachments Ingestion in `submitHandoff`** (lines 116–188):
   - Ingests `discussionHistory` or `customerDiscussionHistory` into initial note items with department attribution (`Sales`).
   - Ingests `attachments` array and automatically registers signed `paymentReceiptUrl` and `receiptVoucherUrl` into `record.attachments` with file metadata and attribution.
   - Enforces regex `/^[a-zA-Z0-9_-]{1,150}$/` on `leadId`, and strict URL validation `/^\/uploads\/[A-Za-z0-9._-]+(?:\?sig=[A-Za-z0-9_-]+)?$/` preventing path traversal.
   - Duplicate prevention (line 190) excludes leads in `RETURNED_TO_SALES` or `CLOSED`, allowing returned inquiries to be re-forwarded by sales.

3. **HTTP Routing in `backend/src/examOperationsRoutes.js`** (lines 75–89):
   - Alphanumeric ID support (`EH-...` and UUIDs): `/^\/api\/exam-ops\/handoffs\/[a-zA-Z0-9_-]+$/` and `/^\/api\/exam-ops\/handoffs\/[a-zA-Z0-9_-]+\/[a-z-]+$/`.
   - Single handoff endpoint: `GET /api/exam-ops/handoffs/:id` routing to `service.getHandoff(user, id)`.
   - Notes endpoint: `POST /api/exam-ops/handoffs/:id/notes` routing to `service.updateHandoff(user, id, 'add-note', ...)`.
   - Inbox notifications endpoint: `GET /api/exam-ops/notifications` routing to `service.listNotifications(user)`.

4. **Independent Automated Test Execution**:
   - `node --test backend/test-exam-upgrade.test.js`:
     ```
     ✔ legacy global academic routes deny staff roles and absent identity
     ✔ handoff validates dates, time zones, amounts and services
     ✔ duplicate submission is idempotent and cannot overwrite sold terms
     ✔ sales cannot set owner, approval, status or read another salesperson records
     ✔ concurrent acceptance has one winner and rejects stale updates
     ✔ payment and checklist gate preparation and no entitlement is created by submission
     ✔ amendment preserves previous sold snapshot
     ✔ unknown account and wrong password have the same public error
     ✔ new browser password alone does not revoke existing session
     ✔ verified switch invalidates old session and rejects reused OTP
     ✔ five invalid codes lock the challenge while preserving existing session
     ✔ concurrent verified switches have one winner
     ✔ logout retains recognition but ends the active session
     ✔ expired or suspended entitlement never appears in portal
     ✔ UAT Scenario 1: Sales Inquiry Conversion & Automated Exam Case Creation
     ✔ UAT Scenario 2: Exam Manager Case Acceptance & Officer Assignment
     ✔ UAT Scenario 3: Officer Requirement Acceptance, Work Tracking & Delivery
     ✔ UAT Scenario 4: Case Reassignment & Return to Sales with Mandatory Reason
     ✔ Sales Discussion History & Attachments Accessibility
     ℹ tests 19 | suites 0 | pass 19 | fail 0 | cancelled 0 | duration_ms 1980
     ```
   - `node --test backend/test-academic-content-rbac.test.js`:
     ```
     14/14 tests pass | 0 fail | exit code 0
     ```
   - `node --test backend/test-permission-resolution.test.js backend/test-security-policy.test.js`:
     ```
     14/14 tests pass | 0 fail | exit code 0
     ```
   - `npm run build --prefix frontend`:
     ```
     tsc -b && vite build completed with 0 errors (built in 9.07s)
     ```

---

## 3. Adversarial Challenges & Stress Testing

| Challenge | Attack Scenario | Stress-Test Executed | Result | Status |
|---|---|---|---|---|
| **AC-1: Reassignment Reason Bypass** | Attacker passes whitespace string (`'   '`) or empty string as reassignment reason | Invoked `assign` on assigned case with `reason: '   '` and `reason: 'no'` | Both rejected with HTTP 400 `REASON_REQUIRED` due to pre-validation `.trim()` | **PASS** |
| **AC-2: Return Reason Bypass** | Attacker attempts to return case to sales with whitespace or 1-2 char reason | Invoked `return` with `reason: 'x'` and `reason: ''` | Rejected with HTTP 400 `REASON_REQUIRED` | **PASS** |
| **AC-3: Officer Impersonation** | Officer B attempts to accept requirement or complete work on Officer A's assigned handoff | Officer Sara attempts `accept-assignment`, `start`, and `complete` on case assigned to Officer Ahmed | Blocked with HTTP 403 `ASSIGNMENT_REQUIRED` | **PASS** |
| **AC-4: Manager Bypass of Officer** | Manager attempts to accept officer requirement on their behalf | Head of Exam attempts `accept-assignment` | Blocked with HTTP 403 `FORBIDDEN` | **PASS** |
| **AC-5: Discussion Snooping & Note Tampering** | Unauthorized officer / third-party staff attempts to add notes to another officer's case | Officer Sara calls `add-note` on case assigned to Ahmed | Blocked with HTTP 403 `FORBIDDEN` | **PASS** |
| **AC-6: Stale Concurrency Update** | Attacker submits modification with outdated revision | Dispatched transition with `revision: 999` | Blocked with HTTP 409 `STALE_RECORD` | **PASS** |
| **AC-7: Sales Record Isolation** | Sales Coordinator B attempts to query Sales Coordinator A's handoff | Sales B calls `getHandoff` and `listHandoffs` | `getHandoff` throws HTTP 403 `FORBIDDEN`; `listHandoffs` strictly filters to `ownerId === user.id` | **PASS** |
| **AC-8: Path Traversal in Upload URLs** | Attacker sends malicious URL `/uploads/../../etc/passwd` | Submitted handoff with path traversal receipt URL | Regex strictly enforces alphanumeric characters after `/uploads/`, rejecting slashes and directory escapes with 400 `PAYMENT_RECEIPT_REQUIRED` | **PASS** |
| **AC-9: Mass Assignment Injection** | Attacker injects `status: 'ACCEPTED'`, `paymentStatus: 'VERIFIED'`, or `ownerId` in request payload | Evaluated payload extraction in `submitHandoff` and `updateHandoff` | Explicit whitelisting / explicit field assignments discard all injected attributes | **PASS** |

---

## 4. Integrity Violation Check

- **Hardcoded test results or expected outputs embedded in source code**: None found. Grep search confirmed zero test lead IDs (`1001`), client names (`Fatima`), or static responses in `examOperations.js` or `examOperationsRoutes.js`.
- **Dummy or facade implementations**: None. All state transitions, validations, optimistic locking, audit events, and notifications are implemented with active execution paths and persistence.
- **Shortcuts that bypass intended workflow**: None. The state progression graph strictly gates each transition.
- **Fabricated verification outputs or logs**: None. All tests were executed live via the command line and verified independently.

---

## 5. Logic Chain

1. **Premise 1**: UAT Scenarios 1–4 require end-to-end sales-to-exam conversion, manager acceptance/assignment, officer acceptance/work tracking/delivery, reassignment/return with mandatory >= 3 char reasons, discussion history preservation, and automated notifications.
2. **Observation 1**: `examOperations.js` implements these state machines and checks (`accept`, `assign`, `return`, `accept-assignment`, `start`, `complete`, `add-note`), with trimmed reason validation enforcing `reason.length >= 3`.
3. **Observation 2**: `examOperationsRoutes.js` routes all required endpoints (`/api/exam-ops/handoffs`, `/api/exam-ops/handoffs/:id`, `/api/exam-ops/handoffs/:id/notes`, `/api/exam-ops/notifications`) and handles alphanumeric handoff IDs.
4. **Observation 3**: `test-exam-upgrade.test.js` covers UAT Scenarios 1–4, negative paths, concurrency, role permissions, and discussion accessibility.
5. **Observation 4**: Independent test execution yielded 19/19 passing tests in `test-exam-upgrade.test.js` and 14/14 passing tests in `test-academic-content-rbac.test.js`, with clean frontend typecheck and production build.
6. **Observation 5**: Adversarial stress-testing confirmed robust RBAC isolation, injection prevention, and boundary validation under hostile attack scenarios.
7. **Conclusion**: The backend implementation for Milestone 1 is functionally complete, robust, secure, and regression-free.

---

## 6. Caveats

- **No Caveats.** The Milestone 1 backend implementation meets all authoritative specification requirements and passes independent verification.

---

## 7. Conclusion

**Verdict: APPROVE**

Milestone 1 satisfies all criteria for CRM Workflow & Sales-to-Exam Handover:
- Full lifecycle transitions are correctly implemented, protected by RBAC and optimistic concurrency locking.
- Mandatory reason logging (>= 3 chars) is strictly enforced on reassignment and returns to sales.
- Discussion notes and signed attachments are preserved with departmental attribution.
- In-app notification events are triggered for counterparties across all workflow actions.
- Zero regressions across existing RBAC and security test suites.

---

## 8. Verification Method

To independently reproduce and verify this review:

1. **Execute Milestone 1 Suite**:
   ```powershell
   node --test backend/test-exam-upgrade.test.js
   ```
   *Expected Output*: 19 passed, 0 failed, exit code 0.

2. **Execute RBAC and Security Regression Suites**:
   ```powershell
   node --test backend/test-academic-content-rbac.test.js backend/test-permission-resolution.test.js backend/test-security-policy.test.js
   ```
   *Expected Output*: 28 passed, 0 failed, exit code 0.

3. **Verify Frontend Build**:
   ```powershell
   npm run build --prefix frontend
   ```
   *Expected Output*: `tsc -b && vite build` completes cleanly with exit code 0.
