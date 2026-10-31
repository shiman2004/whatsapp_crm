# Milestone 2 Remediation Forensic Audit Report

**Work Product:** Milestone 2 Remediation (Student Account Management & Controlled Device Security)  
**Auditor:** Forensic Integrity Auditor (`auditor_m2_retry`)  
**Parent Agent:** `5a45365c-818f-4903-b84e-0f8a01e40f66`  
**Date:** 2026-10-29  
**Integrity Mode:** Development (per `ORIGINAL_REQUEST.md`)  
**Verdict:** **`CLEAN`**

---

## 1. Observation

### 1.1 Static Analysis of Target Files

1. **`backend/src/legacyServer.js` (HTTP Gateway Integration & Auth Bypass Exemption):**
   - Lines 1007–1009:
     ```javascript
     // 6. Student Portal & Controlled Device Security API Routes
     if (pathname.startsWith('/api/student/')) return true;
     ```
     Observed: `/api/student/` is explicitly exempted in `isPublicRoute()`, ensuring that unauthenticated student portal requests (login, verify-device, activation, device replacement) bypass the CRM staff Bearer token perimeter check.
   - Lines 1612–1614:
     ```javascript
     // Milestone 2: Student Portal & Controlled Device Security Routes
     if (await handleStudentRoutes(req, res, pathname, authUser)) return;
     ```
     Observed: `handleStudentRoutes` is mounted at the top of the HTTP pipeline prior to `authenticateRequest`.

2. **`backend/src/studentRoutes.js` (HTTP Endpoint Dispatch & Auth Enforcement):**
   - Lines 53–58:
     ```javascript
     const authHeader = req.headers.authorization;
     const bearerToken = (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer '))
       ? authHeader.slice(7).trim()
       : null;
     const sessionToken = bearerToken || state.exam_session;
     ```
     Observed: Authenticated student endpoints accept either `Authorization: Bearer <token>` or `exam_session` cookie.
   - Lines 81–96: Client device metadata (`deviceId`, `deviceType`, `userAgent`, `browserName`) is extracted from request payload and User-Agent headers, then forwarded to `service.login()` and `service.verifyDevice()`.
   - Lines 194–201:
     ```javascript
     } else if (pathname.startsWith('/api/student/admin/') && pathname.endsWith('/status') && (req.method === 'PATCH' || req.method === 'POST')) {
       const targetStudentId = pathname.slice('/api/student/admin/'.length).replace(/\/status$/, '');
       const staffUser = authUser || verifyStaffToken(bearerToken);
       requireValue(staffUser && (staffUser.role === 'super_admin' || staffUser.role === 'exam_department_manager'), 'FORBIDDEN', 'Administrative access required.', 403);
       const body = await readExamJson(req);
       requireValue(body.status, 'STATUS_REQUIRED', 'Status is required.');
       result = await service.setStatus(staffUser, targetStudentId, body.status, body.reason);
     ```
     Observed: Administrator lifecycle status updates are authenticated and restricted strictly to `super_admin` and `exam_department_manager`.

3. **`backend/src/studentAccess.js` (Device Security, Scrypt Hashing & Session Tracking):**
   - Password Hashing (lines 51–64):
     - Uses `promisify(crypto.scrypt)` with a 16-byte random salt and 64-byte derived length.
     - Performs constant-time comparison via `crypto.timingSafeEqual`.
     - In `verifyPassword()`, non-existent accounts trigger a mock scrypt workload against `'unknown-account-salt'` to eliminate timing side-channels.
   - Session Generation & Concurrency (lines 125–144, 323–326):
     - `student.generation = (student.generation || 0) + 1` is executed on every new session, device revocation, or account status change.
     - `StudentAccess.authenticate()` enforces `student.generation === session.generation` and `student.sessionDigest === this.digest(token)`, ensuring single active session concurrency across devices.
   - Device Policy Enforcement in `login()` (lines 166–243):
     - Checks `student.registeredDevices` for active vs revoked devices.
     - Revoked devices are rejected with HTTP 403 `THIRD_DEVICE_BLOCKED`.
     - Unrecognized devices reject with `THIRD_DEVICE_BLOCKED` if 2 active devices already exist.
     - Category limits are enforced: 2nd mobile rejected with `DEVICE_LIMIT_EXCEEDED`, 2nd desktop rejected with `DEVICE_LIMIT_EXCEEDED`.
   - Runtime Coupling in `verifyDevice()` (lines 305–308):
     ```javascript
     await this.devicePolicy.registerDevice(student.id, {
       ...targetDevice,
       browserDigest: this.digest(browser)
     }, tx);
     ```
     Observed: `DevicePolicyManager.registerDevice()` is genuinely invoked inside the transaction upon successful OTP verification.

4. **`backend/src/securityRoutes.js` (Exam Manager Authorization for Device Replacements):**
   - Lines 192–196:
     ```javascript
     const isDeviceReplacementRoute = pathname.startsWith('/api/security/device-replacements');
     const isAllowed = user?.id && user.active !== false && (
       user.role === 'super_admin' || 
       (isDeviceReplacementRoute && user.role === 'exam_department_manager')
     );
     ```
     Observed: `exam_department_manager` is explicitly authorized to access and approve device replacement requests. Non-manager staff (e.g. `sales_coordinator`, `finance_officer`) are rejected with HTTP 403 `FORBIDDEN`.

5. **`backend/src/examOperationsRoutes.js` (Student Lifecycle Endpoint):**
   - Lines 75–82:
     ```javascript
     } else if (/^\/api\/exam-ops\/students\/([a-zA-Z0-9_-]{1,100})\/status$/.test(pathname) && (req.method === 'PATCH' || req.method === 'POST')) {
       requireValue(canManageExam(user), 'FORBIDDEN', 'Administrator access required.', 403);
       const id = pathname.split('/')[4];
       const body = await readExamJson(req);
       requireValue(body.status, 'STATUS_REQUIRED', 'Status is required.');
       const access = new StudentAccess(service.store, JWT_SECRET);
       const result = await access.setStatus(user, id, body.status, body.reason);
       examJson(res, 200, { success: true, data: result });
     ```

### 1.2 Empirical Runtime Tracing Results

Direct execution of runtime tracing via standalone Node.js environment produced the following verified output:
- **Password Hashing (scrypt):**
  - Hash 1: `de37eb538d8f1c52c5978081b19c2a...`
  - Hash 2: `9bc62add7704a802aabe2f94b64093...`
  - Different salts verified: `true`
  - Valid password verification: `PASS`
  - Invalid password rejection: `PASS`
- **DevicePolicyManager Execution Trace:**
  - Login on new mobile phone yielded: `requiresOtp: true`, 8-digit OTP generated.
  - `verifyDevice()` invoked: `DevicePolicyManager.registerDevice` invocation count = 1.
  - Payload delivered: `deviceId: 'dev-mobile-2'`, `deviceType: 'mobile'`, `browserDigest: '225880ddc74d...'`.
  - Result: Active devices count updated from 1 to 2.
- **Single Concurrent Session Tracking:**
  - Student generation bumped from 1 to 2 upon device 2 verification.
  - Old desktop session token rejected with `UNAUTHORIZED` / `SESSION_EXPIRED`.
  - New mobile session token authenticated successfully.
- **Controlled Device Limits & 3rd Device Blocking:**
  - 2nd mobile attempt blocked with code `DEVICE_LIMIT_EXCEEDED` (HTTP 403).
  - 2nd desktop attempt blocked with code `DEVICE_LIMIT_EXCEEDED` (HTTP 403).
  - 3rd device attempt blocked with code `THIRD_DEVICE_BLOCKED` (HTTP 403).
  - Revoked device re-registration rejected with `THIRD_DEVICE_BLOCKED` (HTTP 403).

### 1.3 Independent Automated Test Suite Execution

All test commands were independently executed by the forensic auditor with verbatim outputs:

1. **Remediation Verification Suite (`backend/test-remediation-m2.test.js`):**
   ```powershell
   node --test backend/test-remediation-m2.test.js
   ```
   *Result:* 12 passed, 0 failed, 0 skipped (duration: 869ms).
2. **Milestone 2 UAT Test Suites (UAT 05 to 09):**
   ```powershell
   node --test backend/tests/e2e/uat05-student-provisioning.test.js backend/tests/e2e/uat06-repeat-purchase-linking.test.js backend/tests/e2e/uat07-two-device-gating.test.js backend/tests/e2e/uat08-single-session-concurrency.test.js backend/tests/e2e/uat09-third-device-replacement.test.js
   ```
   *Result:* 18 passed, 0 failed, 0 skipped (duration: 818ms).
3. **Milestone 2 Challenger Suites (`test-challenger-m2-device.test.js` & `test-challenger-m2-identity.test.js`):**
   ```powershell
   node --test backend/test-challenger-m2-device.test.js backend/test-challenger-m2-identity.test.js
   ```
   *Result:* 35 passed, 0 failed, 0 skipped (duration: 2.43s).
4. **Master Section 32 Test Runner (All 24 Suites):**
   ```powershell
   node backend/tests/e2e/run-all-uat.js
   ```
   *Result:* 24 passed, 0 failed (duration: 7.50s).
5. **Core Upgrade Suite (`backend/test-exam-upgrade.test.js`):**
   ```powershell
   node --test backend/test-exam-upgrade.test.js
   ```
   *Result:* 19 passed, 0 failed (duration: 1.13s).
6. **Frontend Production Build:**
   ```powershell
   npm run build --prefix frontend
   ```
   *Result:* Built in 9.43s, 0 TypeScript errors, 0 compilation warnings.

---

## 2. Logic Chain

1. **Premise 1 (Authentic Routing):**
   - Observation 1.1.1 demonstrates that `handleStudentRoutes` is placed at line 1613 before CRM staff authentication, and `isPublicRoute` at line 1008 includes `/api/student/`.
   - Observation 1.3.1 (Fix 1 tests) confirms that unauthenticated requests to public endpoints (`/api/student/login`) execute student domain logic rather than failing at the CRM staff Bearer perimeter.
   - Logic deduction: Student routes are genuinely wired and active on the HTTP server without perimeter blocking.

2. **Premise 2 (Genuine Domain Logic & No Facades):**
   - Observation 1.1.3 and Observation 1.2 demonstrate that `StudentAccess.login()` and `verifyDevice()` perform active state checks against `registeredDevices`, evaluate device category counts, and invoke `DevicePolicyManager.registerDevice()`.
   - Observation 1.2 proved through runtime function interception that `DevicePolicyManager.registerDevice` was invoked with concrete parameters (`studentId`, `deviceDetails`, `browserDigest`).
   - Logic deduction: There are no mock returns, dummy shortcuts, or facade implementations. Logic is genuine.

3. **Premise 3 (Authentic Security & Cryptography):**
   - Observation 1.1.3 and Observation 1.2 confirm `crypto.scrypt` is invoked with randomized salts, constant-time verification is enforced, and non-existent accounts trigger identical computational work to prevent user enumeration.
   - `student.generation` incrementation reliably terminates previous sessions across all devices upon new login, device revocation, or account suspension.
   - Logic deduction: Cryptographic handling and session concurrency controls strictly satisfy Requirement R2 and Section 32 UAT 5, 7, 8, 9.

4. **Premise 4 (RBAC & Lifecycle Administration):**
   - Observation 1.1.2, 1.1.4, and 1.1.5 demonstrate that `exam_department_manager` is authorized to manage student status (`PATCH /api/exam-ops/students/:id/status` and `PATCH /api/student/admin/:id/status`) and review/approve device replacements (`/api/security/device-replacements*`), while unauthorized staff roles are rejected with HTTP 403 `FORBIDDEN`.
   - Logic deduction: Administrative delegation adheres to the maker-checker and least-privilege principles of Requirement R2.

---

## 3. Caveats

- **No Caveats.** The codebase contains no mock returns, hardcoded passes, or facade bypasses. All tests execute authentic domain logic against the data store and pass with 100% success.

---

## 4. Conclusion

The Milestone 2 Remediation work product has been thoroughly inspected and verified through static analysis, dynamic runtime tracing, adversarial stress-testing, and independent execution of all test suites. 

All 5 remediation items have been authentically implemented with genuine production-grade logic. Zero integrity violations were detected.

**Binary Audit Verdict:** **`CLEAN`**

---

## 5. Verification Method

To independently re-verify the audit findings:

1. **Verify Remediation Tests:**
   ```powershell
   node --test backend/test-remediation-m2.test.js
   ```
2. **Verify Milestone 2 UAT Tests:**
   ```powershell
   node --test backend/tests/e2e/uat05-student-provisioning.test.js backend/tests/e2e/uat06-repeat-purchase-linking.test.js backend/tests/e2e/uat07-two-device-gating.test.js backend/tests/e2e/uat08-single-session-concurrency.test.js backend/tests/e2e/uat09-third-device-replacement.test.js
   ```
3. **Verify Adversarial Challenger Tests:**
   ```powershell
   node --test backend/test-challenger-m2-device.test.js backend/test-challenger-m2-identity.test.js
   ```
4. **Verify Complete Section 32 Test Suite (24 Suites):**
   ```powershell
   node backend/tests/e2e/run-all-uat.js
   ```
5. **Verify Frontend Build:**
   ```powershell
   npm run build --prefix frontend
   ```
