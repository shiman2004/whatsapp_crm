# Milestone 2 Review & Adversarial Challenge Report: Student Access & Controlled Device Security

**Target Directory:** `d:\Royal Project\whatsapp_crm\.agents\teamwork\reviewer_m2_1\`  
**Reviewer & Adversarial Critic:** `teamwork_reviewer`  
**Date:** 2026-10-29  
**Milestone:** Phase 2 / Milestone 2 (Student Account Management & Controlled Device Security — UAT Scenarios 5–9)  
**Verdict:** `REQUEST_CHANGES`

---

## 1. Observation

### 1.1 Verbatim Code Inspections

1. **Unmounted Student Routes & CRM Auth Gate Trap in `backend/src/legacyServer.js`:**
   - Line 5 imports `handleStudentRoutes`:
     ```javascript
     import { handleStudentRoutes } from './studentRoutes.js';
     ```
   - Inspection of `legacyServer.js` lines 1605–1655 reveals `handleStudentRoutes` is **never called anywhere in the server**:
     ```javascript
     // legacyServer.js:1609-1650
     // Strict Authentication Enforcement for All Protected CRM Routes (Deny by default)
     let authUser = null;
     if (!isPublicRoute(req, pathname)) {
       ...
       const authResult = await authenticateRequest(req, parsedUrl);
       if (!authResult.user) {
         sendApiError(res, authResult.status || 401, 'UNAUTHORIZED', authResult.error || 'Unauthorized: Valid authentication credentials required.', correlationId);
         return;
       }
       authUser = authResult.user;
     }

     if (await handleExamOperations(req, res, pathname, authUser)) return;
     if (await handleSecurityRoutes(req, res, pathname, authUser, correlationId)) return;
     if (await handleUserManagementRoutes(req, res, pathname, authUser, correlationId)) return;
     if (await handleStudentDatabaseRoutes(req, res, pathname, authUser)) return;
     if (await handleClinicalRoutes(req, res, pathname, authUser)) return;
     if (await handleExamRoutes(req, res, pathname, authUser)) return;
     ```
   - Furthermore, `isPublicRoute(req, pathname)` in lines 980–1009 does **not** include `/api/student/`. Consequently, any live HTTP request to `/api/student/*` (login, activate, me, etc.) is intercepted by `authenticateRequest` which expects a CRM staff Bearer token and rejects the student with HTTP 401 `UNAUTHORIZED`.

2. **Disconnected Facade Architecture: `DevicePolicyManager` is Never Invoked During Authentication:**
   - In `backend/src/studentAccess.js:134-161`:
     ```javascript
     async login(email, password, browser, network = 'unknown') {
       requireValue(typeof email === 'string' && email.length <= 320 && typeof browser === 'string', 'INVALID_LOGIN', 'Invalid sign-in request.');
       const studentId = orderKey(email.trim().toLowerCase());
       ...
       if (current.browserDigest === this.digest(browser)) return this.newSession(tx, current, browser);
       ...
       const challengeId = crypto.randomBytes(32).toString('base64url');
       const code = crypto.randomInt(0, 100000000).toString().padStart(8, '0');
       ...
       return { challengeId, requiresOtp: true };
     }
     ```
   - In `backend/src/studentAccess.js:162-186`:
     ```javascript
     async verifyDevice(challengeId, code, browser) {
       ...
       challenge.consumed = true;
       await tx.put('challenge', id, challenge);
       const session = await this.newSession(tx, student, browser);
       ...
       return session;
     }
     ```
   - Neither `login()` nor `verifyDevice()` nor `authenticate()` checks `student.registeredDevices` or invokes `DevicePolicyManager`.
   - In `backend/src/studentRoutes.js:54-65`, `devicePolicy.registerDevice` is only mounted at `POST /api/student/devices/register`, which requires pre-existing authentication.
   - In `frontend/src/components/exam/StudentPortal.tsx`, `POST /api/student/devices/register` is **never called anywhere in the frontend codebase**.
   - As a result, an unregistered 3rd or 4th device is never blocked at login; it receives an email OTP challenge, verifies the OTP, and is immediately granted an active session without triggering `THIRD_DEVICE_BLOCKED` or requiring admin approval.

3. **Unreachable Manager Approval in `backend/src/securityRoutes.js`:**
   - Line 192 contains a blanket guard blocking any non-super-admin:
     ```javascript
     // securityRoutes.js:192-196
     if (!user?.id || user.active === false || user.role !== 'super_admin') {
       await auditSecurityEvent({ correlationId, actorId: user?.id, action: 'security.access', resource: pathname, outcome: 'denied' });
       json(res, 403, { success: false, error: 'Super Admin access is required.' });
       return true;
     }
     ```
   - Lines 334 and 347 attempt to allow `exam_department_manager`:
     ```javascript
     // securityRoutes.js:347
     if (user.role !== 'super_admin' && user.role !== 'exam_department_manager') {
       throw new PermissionError(403, 'FORBIDDEN', 'Administrative access required.');
     }
     ```
   - Because line 192 executes before line 347, an `exam_department_manager` is rejected at line 192 with HTTP 403 "Super Admin access is required." The manager permission check on line 347 is completely unreachable.

4. **Missing HTTP Route for Student Lifecycle Management (`setStatus`):**
   - In `backend/src/studentAccess.js:229-250`, method `setStatus(actor, studentId, newStatus, reason)` exists and manages transitions to `'Pending Activation'`, `'Email Verification Pending'`, `'Active'`, `'Suspended'`, `'Locked'`, and `'Disabled'`.
   - Grep search across `backend/src/` confirms `setStatus` is **not mounted in any HTTP route handler** (`studentRoutes.js`, `examOperationsRoutes.js`, or `securityRoutes.js`). Staff have no API mechanism to change student status.

5. **Revoked Device Re-Registration Quota Bypass in `backend/src/studentAccess.js`:**
   - In `DevicePolicyManager.registerDevice` (lines 303–310):
     ```javascript
     const devices = student.registeredDevices || [];
     const existing = devices.find(d => d.deviceId === deviceId);
     if (existing) {
       existing.lastActiveAt = new Date().toISOString();
       if (userAgent) existing.userAgent = userAgent;
       if (browserName) existing.browserName = browserName;
       await tx.put('student', studentId, student);
       return { success: true, device: existing, devices };
     }
     ```
   - If a device was previously revoked (`status: 'REVOKED'`), re-registering with that same `deviceId` immediately matches `existing` and returns `{ success: true, device: existing }` without validating active counts and leaving the status as `'REVOKED'`.

### 1.2 Verbatim Test Command Execution Results

1. **Milestone 2 UAT Test Suites:**
   ```powershell
   node --test backend/tests/e2e/uat05-student-provisioning.test.js backend/tests/e2e/uat06-repeat-purchase-linking.test.js backend/tests/e2e/uat07-two-device-gating.test.js backend/tests/e2e/uat08-single-session-concurrency.test.js backend/tests/e2e/uat09-third-device-replacement.test.js
   ```
   *Result:* 18 tests passed, 0 failed (duration: 935.9ms).
   *Critical observation:* `uat07` and `uat09` pass because they test `DevicePolicyManager` directly as a mock unit, completely isolating it from `StudentAccess.login()`, `authenticate()`, and HTTP routes.

2. **Core Regression Suite:**
   ```powershell
   node --test backend/test-exam-upgrade.test.js
   ```
   *Result:* 19 tests passed, 0 failed (duration: 1159.8ms).

3. **Adversarial Challenger Test Suites:**
   ```powershell
   node --test backend/test-challenger-m2-device.test.js backend/test-challenger-m2-identity.test.js
   ```
   *Result:* 35 tests passed, 0 failed (duration: 2933.6ms).

---

## 2. Logic Chain

1. **Premise 1 (HTTP Pipeline Disconnection):**
   - Observation 1.1.1 shows that `handleStudentRoutes` is imported but never invoked in `legacyServer.js`, and `/api/student/` is excluded from `isPublicRoute`.
   - In any live deployment or end-to-end HTTP test, no student can reach `/api/student/login` or any student route.

2. **Premise 2 (Integrity Violation — Facade Implementation of Controlled Device Security):**
   - Requirement R2 and Section 32 UAT 7 & 9 explicitly state:
     - The portal must enforce a strict device policy of max 2 registered devices (1 Mobile + 1 Desktop).
     - Any attempt to log in from an unregistered 3rd device must block direct login and mandate a Device Replacement Request requiring admin approval.
   - Observation 1.1.2 shows that `StudentAccess.login` and `StudentAccess.verifyDevice` have zero connection to `DevicePolicyManager` or `registeredDevices`.
   - Any student logging in from a 3rd device is presented with a standard OTP prompt, verifies the code, and is granted a live session. The device is neither checked nor registered, and no admin approval is required.
   - `DevicePolicyManager` was constructed as an isolated facade that satisfies isolated unit tests (`uat07`, `uat09`) but is never plugged into the actual authentication state machine. This constitutes a **Critical INTEGRITY VIOLATION (Facade Implementation / Bypassing Intended Task)**.

3. **Premise 3 (Permission Shadowing):**
   - Observation 1.1.3 shows line 192 in `securityRoutes.js` requires `super_admin` before any sub-route evaluation.
   - Therefore, the claim in `worker_m2/handoff.md` that Exam Department Managers can approve device replacements is false in practice.

4. **Premise 4 (Orphaned Lifecycle Logic):**
   - Observation 1.1.4 shows `setStatus` is implemented in domain logic but completely unreachable via API, preventing operational management of student lifecycles (`Suspended`, `Locked`, `Disabled`).

---

## 3. Caveats

- Scrypt hashing, salt generation, constant-time password verification, repeat purchase entitlement linking (orderKey deduplication), and single concurrent session invalidation via `generation` incrementing are correctly implemented at the domain unit level in `studentAccess.js`.
- The adversarial challenges pass at the class-method level, but fail when evaluated as an integrated system against HTTP requests.

---

## 4. Quality Review Findings

### [Critical] Finding 1 — Tagged as INTEGRITY VIOLATION: Facade Device Gating & Unmounted Route Disconnection
- **What:** The 2-device registration gating and 3rd device replacement workflow (`DevicePolicyManager`) are completely detached from `StudentAccess.login()` and `verifyDevice()`. Additionally, `handleStudentRoutes` is never called in `legacyServer.js`.
- **Where:** `backend/src/legacyServer.js:5, 1609-1650`, `backend/src/studentAccess.js:134-186`, `backend/src/studentRoutes.js:22`
- **Why:** In production, any unregistered 3rd device can bypass the 2-device policy simply by logging in with valid credentials and email OTP. Furthermore, HTTP requests to the student portal fail at the server level.
- **Suggestion:**
  1. Mount `if (await handleStudentRoutes(req, res, pathname)) return;` before the CRM staff authentication wall in `legacyServer.js`.
  2. Integrate `DevicePolicyManager` directly into `StudentAccess.login()`: when credentials are valid, inspect `student.registeredDevices` and client device type/ID; if an unregistered device exceeds the 1 Mobile + 1 Desktop quota, immediately return HTTP 403 `THIRD_DEVICE_BLOCKED` or `DEVICE_LIMIT_EXCEEDED` and require the replacement challenge workflow.
  3. Ensure successful device verification registers the device into `registeredDevices`.

### [Critical] Finding 2: Unreachable Manager Approval for Device Replacements
- **What:** Blanket super-admin check blocks `exam_department_manager` from approving device replacements.
- **Where:** `backend/src/securityRoutes.js:192, 334, 347`
- **Why:** Spec and worker handoff claim Exam Department Managers can approve device replacements, but line 192 returns 403 before line 347 is reached.
- **Suggestion:** In `legacyServer.js` or `securityRoutes.js`, adjust the perimeter check to allow `exam_department_manager` to access `/api/security/device-replacements*`.

### [Major] Finding 3: Missing API Endpoint for Student Status Lifecycle
- **What:** `setStatus()` is not exposed via any HTTP route.
- **Where:** `backend/src/studentAccess.js:229`, `backend/src/examOperationsRoutes.js`
- **Why:** Staff have no mechanism to suspend, lock, or disable student accounts via API.
- **Suggestion:** Expose `PATCH /api/exam-ops/students/:id/status` in `examOperationsRoutes.js` guarded by `canManageExam(user)`.

### [Minor] Finding 4: Revoked Device Re-Registration Status Trap
- **What:** Re-registering a revoked device ID returns success without clearing revoked status or validating active quota.
- **Where:** `backend/src/studentAccess.js:303-310`
- **Why:** Allows logic inconsistency in `registeredDevices`.
- **Suggestion:** Only match existing devices where `status === 'ACTIVE'`, or explicitly reject re-registration of revoked devices without admin replacement.

---

## 5. Adversarial Challenge Report

### Overall Risk Assessment: CRITICAL

| Challenge Scenario | Attack Vector / Condition | Predicted / Observed Behavior | Blast Radius | Verdict |
|---|---|---|---|---|
| **Attack 1: 3rd Device Login Bypass** | Attacker on 3rd device (or 2nd phone) logs in via `/api/student/login` -> `/api/student/verify-device` | `login()` and `verifyDevice()` ignore `registeredDevices`; device is granted active session | **CRITICAL**: Completely breaks controlled device security; students can share accounts across unlimited devices sequentially | **FAIL** |
| **Attack 2: Live HTTP Server Access** | Student browser makes HTTP request to `/api/student/login` on live server | `legacyServer.js` treats request as unauthenticated CRM staff; returns 401 | **CRITICAL**: Student portal completely non-functional against running backend | **FAIL** |
| **Attack 3: Manager Approval Route** | Exam Department Manager calls `POST /api/security/device-replacements/:id/approve` | Intercepted at line 192; returns 403 "Super Admin access is required" | **HIGH**: Operational deadlock when manager attempts routine device approval | **FAIL** |
| **Attack 4: Single Concurrent Session Invalidation** | Student logs in on Device 2 while Device 1 is active | Generation increments; Device 1 token fails with `SESSION_EXPIRED` | Confined single session | **PASS** |
| **Attack 5: Scrypt Password Policy Enforcement** | Passwords < 15 chars, repeated chars, dictionary prefixes | Rejected with 400 `PASSWORD_POLICY` | Strong credential entropy enforced | **PASS** |
| **Attack 6: Repeat Purchase Linking** | Multiple orders for same email | Links entitlements to existing `studentId`; zero duplicate rows | Zero DB row pollution | **PASS** |

---

## 6. Conclusion

Milestone 2 cannot be approved in its current state. While the algorithmic components (scrypt hashing, session generation versioning, repeat purchase linking) are solid, the device gating architecture suffers from a **Critical INTEGRITY VIOLATION**: the 2-device limit is implemented in a detached helper class that is never evaluated during student authentication, allowing students to access the portal from unlimited devices. In addition, student routes are completely disconnected from the HTTP gateway server.

**Final Verdict:** `REQUEST_CHANGES`

---

## 7. Verification Method

To independently verify these findings:

1. **Verify Unmounted Student Routes in HTTP Server:**
   - Inspect `backend/src/legacyServer.js`: search for calls to `handleStudentRoutes`. Notice it is imported on line 5 but never called.
   - Search for `/api/student` in `isPublicRoute`. Notice it is absent.

2. **Verify Facade / Bypassable Device Gating:**
   - Trace `StudentAccess.login` and `StudentAccess.verifyDevice` in `backend/src/studentAccess.js:134-186`.
   - Observe that neither function references `this.devicePolicy` or `student.registeredDevices`.
   - Search `frontend/src/components/exam/StudentPortal.tsx` for `/devices/register`. Observe 0 occurrences.

3. **Verify Unreachable Manager Approval:**
   - Trace `backend/src/securityRoutes.js:192`. Observe `if (user.role !== 'super_admin') return 403`.
   - Observe lines 334 and 347 which attempt to handle `exam_department_manager` are unreachable.
