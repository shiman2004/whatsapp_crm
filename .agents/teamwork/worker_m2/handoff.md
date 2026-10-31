# Milestone 2 Handoff Report: Student Account Management & Controlled Device Security

**Target Directory:** `d:\Royal Project\whatsapp_crm\.agents\teamwork\worker_m2\`  
**Agent:** `teamwork_worker` (Milestone 2 Implementer)  
**Date:** 2026-10-29  
**Milestone:** Phase 2 / Milestone 2 (Features 8–12, Section 32 UAT Scenarios 5–9)

---

## 1. Observation

### 1.1 Source Files & Authoritative Specifications Inspected
1. `ORIGINAL_REQUEST.md`: Requirement R2 and Acceptance Criteria for Student Account & Device Registration:
   - Account username strictly keyed by student personal email (`studentId = orderKey(email)`).
   - Scrypt password hashing with 16-byte random salt, minimum 15 characters, entropy checks, plaintext passwords strictly hidden from all staff responses.
   - Account lifecycle tracking: `Pending Activation`, `Email Verification Pending`, `Active`, `Suspended`, `Locked`, `Disabled`.
   - Repeat purchase identity linking without duplicate rows.
   - Strict Two-Device Registration Policy: Maximum 2 registered devices: strictly 1 Mobile Phone AND 1 Desktop/Laptop. Rejects 2 mobiles, 2 laptops, or 3+ devices with HTTP 403 `DEVICE_LIMIT_EXCEEDED` / `THIRD_DEVICE_BLOCKED`.
   - Single concurrent session enforcement across registered devices: login on device 2 terminates active session on device 1 with HTTP 401 `SESSION_EXPIRED`.
   - Unregistered 3rd device block + replacement request workflow: 8-digit OTP code sent to email, locking after 5 consecutive failures, moving to `PENDING_ADMIN_APPROVAL`. Administrative approval revokes the old device of the same category and terminates all active sessions on the revoked device.
2. Test Suites Executed:
   - `backend/tests/e2e/uat05-student-provisioning.test.js`: Verified student provisioning, email invite, scrypt password hashing, timing-attack resistance.
   - `backend/tests/e2e/uat06-repeat-purchase-linking.test.js`: Verified zero duplicate rows on repeat purchases and multi-package entitlement linking.
   - `backend/tests/e2e/uat07-two-device-gating.test.js`: Verified 1 Mobile + 1 Computer gating and rejections of 2 mobiles, 2 desktops, or 3+ devices.
   - `backend/tests/e2e/uat08-single-session-concurrency.test.js`: Verified single active concurrent session enforcement, session termination on device switch, and token replay defense.
   - `backend/tests/e2e/uat09-third-device-replacement.test.js`: Verified 3rd device block, 8-digit OTP challenge, 5-failure lockout, and administrator approval.
   - `backend/test-exam-upgrade.test.js`: 19 tests covering student authentication, concurrent device switches, logout, entitlement access, and Milestone 1 handoffs.
   - `backend/tests/e2e/run-all-uat.js`: 24 suites covering all 20 UAT scenarios and 4 test tiers.

### 1.2 Verbatim Test Command Execution Results

#### Command 1: Milestone 2 UAT Test Suite
```bash
node --test backend/tests/e2e/uat05-student-provisioning.test.js backend/tests/e2e/uat06-repeat-purchase-linking.test.js backend/tests/e2e/uat07-two-device-gating.test.js backend/tests/e2e/uat08-single-session-concurrency.test.js backend/tests/e2e/uat09-third-device-replacement.test.js
```
Output:
```text
✔ UAT 5: Student Account Provisioning & Secure Activation (Happy Path) (94.3613ms)
✔ UAT 5: Negative Path — Weak password (< 15 chars or common pattern) rejected (5.4603ms)
✔ UAT 5: Negative Path — Reusing consumed activation token rejected (142.4682ms)
✔ UAT 5: Negative Path — Non-admin cannot trigger student activation invitation (0.9856ms)
✔ UAT 5: Timing-Attack Defense — Nonexistent account vs wrong password return identical error (230.6807ms)
✔ UAT 6: Repeat Purchase Identity Linking Without Duplication (Happy Path) (233.8741ms)
✔ UAT 6: Idempotent Duplicate Access Prevention (6.3831ms)
✔ UAT 7: Two-Device Registration Gating (Happy Path: 1 Mobile + 1 Desktop) (5.8658ms)
✔ UAT 7: Negative Path — Rejects registration of SECOND mobile phone (4.6938ms)
✔ UAT 7: Negative Path — Rejects registration of SECOND desktop or laptop (1.3013ms)
✔ UAT 7: Negative Path — Rejects 3rd device attempt when 2 devices already registered (1.601ms)
✔ UAT 7: Negative Path — Rejects invalid device type specification (1.6834ms)
✔ UAT 8: Single Concurrent Session Enforcement (Login on Device 2 Terminates Device 1) (264.2371ms)
✔ UAT 8: Token Replay Defense — Replayed revoked session tokens fail with SESSION_EXPIRED (157.2436ms)
✔ UAT 8: Explicit Logout Terminates Session Immediately (95.1565ms)
✔ UAT 9: Unregistered Third Device Block & Approved Replacement Workflow (Happy Path) (17.5814ms)
✔ UAT 9: Negative Path — 5 invalid OTP codes lock the challenge (3.9531ms)
✔ UAT 9: Negative Path — Non-admin cannot approve device replacement (1.7619ms)
ℹ tests 18
ℹ suites 0
ℹ pass 18
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1000.19
```

#### Command 2: Exam Upgrade Core Test Suite
```bash
node --test backend/test-exam-upgrade.test.js
```
Output:
```text
✔ legacy global academic routes deny staff roles and absent identity (1.4016ms)
✔ handoff validates dates, time zones, amounts and services (31.77ms)
✔ duplicate submission is idempotent and cannot overwrite sold terms (3.8993ms)
✔ sales cannot set owner, approval, status or read another salesperson records (1.7696ms)
✔ concurrent acceptance has one winner and rejects stale updates (1.2959ms)
✔ payment and checklist gate preparation and no entitlement is created by submission (1.592ms)
✔ amendment preserves previous sold snapshot (2.0083ms)
✔ unknown account and wrong password have the same public error (176.0745ms)
✔ new browser password alone does not revoke existing session (158.1404ms)
✔ verified switch invalidates old session and rejects reused OTP (141.4261ms)
✔ five invalid codes lock the challenge while preserving existing session (146.5652ms)
✔ concurrent verified switches have one winner (162.4382ms)
✔ logout retains recognition but ends the active session (99.8197ms)
✔ expired or suspended entitlement never appears in portal (88.6249ms)
✔ UAT Scenario 1: Sales Inquiry Conversion & Automated Exam Case Creation (2.7476ms)
✔ UAT Scenario 2: Exam Manager Case Acceptance & Officer Assignment (2.6894ms)
✔ UAT Scenario 3: Officer Requirement Acceptance, Work Tracking & Delivery (4.7061ms)
✔ UAT Scenario 4: Case Reassignment & Return to Sales with Mandatory Reason (2.6872ms)
✔ Sales Discussion History & Attachments Accessibility (1.799ms)
ℹ tests 19
ℹ suites 0
ℹ pass 19
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1190.0571
```

#### Command 3: Full 24-Suite Section 32 & 4-Tier Test Runner
```bash
node backend/tests/e2e/run-all-uat.js
```
Output:
```text
Total Suites: 24 | Passed: 24 | Failed: 0 | Total Time: 10.13s
✅ ALL SECTION 32 UAT SCENARIOS & 4-TIER TEST SUITES PASSED WITH 100% SUCCESS.
```

#### Command 4: Frontend Production Typecheck & Bundle Build
```bash
npm run build --prefix frontend
```
Output:
```text
> royal-wellness-crm-frontend@1.0.0 build
> tsc -b && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 2747 modules transformed.
dist/assets/StudentPortal-YZeIsu9C.js                40.09 kB │ gzip:   9.98 kB
✓ built in 5.96s
```

---

## 2. Logic Chain

1. **Student Provisioning & Password Security** (`backend/src/studentAccess.js`):
   - In accordance with R2, student IDs are derived from `orderKey(email.trim().toLowerCase())`.
   - Passwords enforce a 15–256 character length constraint and non-trivial entropy rules (rejecting repeated characters and dictionary prefixes).
   - Passwords are hashed with `crypto.scrypt` using 16 bytes of cryptographically secure random salt, producing format `salt:digest`.
   - Password hashes are sanitized from all student queries and portal payload responses.
   - Timing safe equality comparisons (`crypto.timingSafeEqual`) prevent side-channel timing enumeration attacks on invalid credentials.

2. **Account Lifecycle State Machine** (`backend/src/studentAccess.js`):
   - Defined `STUDENT_LIFECYCLE_STATUSES`: `Pending Activation`, `Email Verification Pending`, `Active`, `Suspended`, `Locked`, `Disabled`.
   - Normalization and validation ensure only `Active`/`ACTIVE` accounts can authenticate or access study materials.
   - Method `setStatus(actor, studentId, newStatus, reason)` permits Super Admins and Exam Department Managers to transition account status with audit logging.
   - Transitioning an account to `Suspended`, `Locked`, or `Disabled` increments `student.generation` and nullifies `sessionDigest`, immediately terminating all active sessions.

3. **Strict Two-Device Policy & Concurrency Enforcement** (`DevicePolicyManager` in `backend/src/studentAccess.js`):
   - Allows a maximum of 2 devices: strictly 1 Mobile Phone AND 1 Desktop/Laptop Computer.
   - Enforces rejection of 2 mobiles with HTTP 403 `DEVICE_LIMIT_EXCEEDED` ("A mobile device is already registered. Maximum 1 Mobile and 1 Computer permitted.").
   - Enforces rejection of 2 desktops/laptops with HTTP 403 `DEVICE_LIMIT_EXCEEDED` ("A desktop/laptop is already registered. Maximum 1 Mobile and 1 Computer permitted.").
   - Rejects registration of any 3rd device with HTTP 403 `THIRD_DEVICE_BLOCKED` ("Maximum 2 devices registered. Device replacement required.").
   - Single concurrent active session is enforced: whenever a session is created or device verified, `student.generation` is incremented. Existing session tokens from previous devices immediately fail with HTTP 401 `SESSION_EXPIRED`.

4. **3rd Device Replacement Challenge & Admin Approval** (`DevicePolicyManager`, `studentRoutes.js`, `securityRoutes.js`):
   - Access from an unregistered 3rd device triggers the replacement request workflow.
   - `requestDeviceReplacement` generates a cryptographically secure 8-digit OTP code, sets a 15-minute expiration, and queues an outbox notification.
   - `verifyReplacementOtp` checks code match; 5 consecutive incorrect attempts permanently transition the challenge to `LOCKED`.
   - Successful OTP verification transitions challenge to `PENDING_ADMIN_APPROVAL`.
   - `approveDeviceReplacement` endpoint in `backend/src/securityRoutes.js` (`POST /api/security/device-replacements/:id/approve` and `GET /api/security/device-replacements`) verifies administrator authorization (`super_admin` or `exam_department_manager`).
   - Approval revokes the previous device of the same category, sets `status: 'REVOKED'`, adds the new device with `status: 'ACTIVE'`, increments `student.generation` (terminating all active sessions on the revoked device), and records audit event `security.device_replacement.approved`.

5. **Frontend Student Portal Enhancements** (`frontend/src/components/exam/StudentPortal.tsx`):
   - Added automatic device category detection (`mobile` vs `desktop`) based on User-Agent heuristics and persistent client `deviceId`.
   - Displayed active registered device slots (Mobile card + Desktop card) with active status and available slots.
   - Added dedicated `SESSION_EXPIRED` interceptor displaying the session termination banner: *"Your session was signed out because your account was logged in from another registered device. Alpha Health Group enforces a strict single concurrent session policy across all devices."*
   - Added 3-step Device Replacement Request Modal allowing students on blocked devices to request 8-digit email OTP, verify OTP, and track administrative approval in `PENDING_ADMIN_APPROVAL` status.

---

## 3. Caveats

- **No Caveats**: All 5 scope items for Milestone 2 were implemented with genuine domain logic and verified against authoritative specs. No mocks, facades, or test hardcoding were introduced.

---

## 4. Conclusion

Milestone 2 (Student Account Management & Controlled Device Security, Features 8–12, UAT Scenarios 5–9) is **100% complete, fully implemented, and verified**:
- Account provisioning, scrypt password hashing, and lifecycle tracking are operational.
- Zero duplicate rows in repeat purchases verified.
- 1 Mobile + 1 Computer device registration limit strictly enforced.
- Single active concurrent session versioning terminates old sessions with HTTP 401 `SESSION_EXPIRED`.
- 3rd device block + 8-digit OTP verification + CRM admin approval workflow operational.
- `StudentPortal.tsx` UI updated with device detection, session alerts, and replacement modal.
- All 18 tests in `uat05-09`, 19 tests in `test-exam-upgrade`, and all 24 suites in `run-all-uat.js` pass with 100% success.
- Frontend builds cleanly with zero errors.

---

## 5. Verification Method

To independently reproduce and verify this milestone:

1. **Run Milestone 2 UAT Test Suites:**
   ```powershell
   node --test backend/tests/e2e/uat05-student-provisioning.test.js backend/tests/e2e/uat06-repeat-purchase-linking.test.js backend/tests/e2e/uat07-two-device-gating.test.js backend/tests/e2e/uat08-single-session-concurrency.test.js backend/tests/e2e/uat09-third-device-replacement.test.js
   ```
   *Expected:* 18 passing tests, 0 failures, exit code 0.

2. **Run Exam Upgrade Core Regression Suite:**
   ```powershell
   node --test backend/test-exam-upgrade.test.js
   ```
   *Expected:* 19 passing tests, 0 failures, exit code 0.

3. **Run Master Section 32 & 4-Tier Test Runner:**
   ```powershell
   node backend/tests/e2e/run-all-uat.js
   ```
   *Expected:* 24/24 suites pass, 0 failures, exit code 0.

4. **Run Frontend Typecheck & Production Build:**
   ```powershell
   npm run build --prefix frontend
   ```
   *Expected:* `tsc -b && vite build` completes with exit code 0.

5. **Files to Inspect:**
   - `backend/src/studentAccess.js`
   - `backend/src/studentRoutes.js`
   - `backend/src/securityRoutes.js`
   - `frontend/src/components/exam/StudentPortal.tsx`

