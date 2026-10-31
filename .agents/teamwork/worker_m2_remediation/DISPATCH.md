# Task Assignment: Milestone 2 Remediation (Student Account & Controlled Device Security)

## Context
Milestone 2 initial implementation was completed, but code review and adversarial challenge by `reviewer_m2_1` returned `REQUEST_CHANGES` due to four critical architectural gaps:
1. Unmounted Student Routes in `legacyServer.js` & missing public route exemption.
2. Disconnected `DevicePolicyManager`: not invoked during live `login()` and `verifyDevice()` authentication flow.
3. Unreachable manager approval in `securityRoutes.js:192` due to blanket `super_admin` check.
4. Student lifecycle management `setStatus()` not exposed on any HTTP route.
5. Revoked device re-registration status trap in `DevicePolicyManager.registerDevice()`.

## Objectives
Implement the 5 targeted remediation fixes in:
- `backend/src/legacyServer.js`
- `backend/src/studentAccess.js`
- `backend/src/studentRoutes.js`
- `backend/src/securityRoutes.js`
- `backend/src/examOperationsRoutes.js` (or `studentRoutes.js`)

## Detailed Instructions
1. **Mount Student Routes in `backend/src/legacyServer.js`**:
   - Call `if (await handleStudentRoutes(req, res, pathname, authUser)) return;` before the CRM staff authentication wall `authenticateRequest`.
   - In `studentRoutes.js`, handle public routes (`/api/student/login`, `/api/student/verify-device`, `/api/student/activate`, `/api/student/replace-device/request`, `/api/student/replace-device/verify-otp`) without requiring a staff token.
   - For student authenticated routes (`/api/student/me`, `/api/student/materials`, etc.), authenticate using the student bearer token via `studentAccess.authenticate(token)`.

2. **Connect `DevicePolicyManager` to Live Authentication Flow in `backend/src/studentAccess.js`**:
   - In `StudentAccess.login()` & `verifyDevice()`:
     - Check client device against `student.registeredDevices`.
     - If client device is not registered and the student already has 2 registered active devices, throw/return HTTP 403 `THIRD_DEVICE_BLOCKED` and route to the device replacement workflow.
     - If client device type would exceed the strict 1 Mobile Phone + 1 Desktop/Laptop rule (e.g., trying to register a 2nd phone or 2nd computer), block with HTTP 403 `DEVICE_LIMIT_EXCEEDED`.
     - When OTP device verification completes successfully, register the device via `DevicePolicyManager.registerDevice()` so it is recorded in `student.registeredDevices`.
     - In `DevicePolicyManager.registerDevice()`: prevent re-registration of revoked devices (`status: 'REVOKED'`) from bypassing policy.

3. **Allow Exam Department Manager in `backend/src/securityRoutes.js`**:
   - Ensure `user.role === 'exam_department_manager'` alongside `super_admin` can access `/api/security/device-replacements` and `/api/security/device-replacements/:id/approve`.
   - Prevent the blanket line 192 guard from blocking managers from the device replacement endpoints.

4. **Expose Student Lifecycle Status API**:
   - Mount an endpoint (e.g., `PATCH /api/student/admin/:id/status` or `PATCH /api/exam-ops/students/:id/status`) callable by `exam_department_manager` or `super_admin` that invokes `studentAccess.setStatus(actor, studentId, newStatus, reason)`.

5. **Verify and Run Tests**:
   - Run Milestone 2 UAT test suites:
     `node --test backend/tests/e2e/uat05-student-provisioning.test.js backend/tests/e2e/uat06-repeat-purchase-linking.test.js backend/tests/e2e/uat07-two-device-gating.test.js backend/tests/e2e/uat08-single-session-concurrency.test.js backend/tests/e2e/uat09-third-device-replacement.test.js`
   - Run adversarial challenger suites:
     `node --test backend/test-challenger-m2-device.test.js backend/test-challenger-m2-identity.test.js`
   - Run full E2E master suite:
     `node backend/tests/e2e/run-all-uat.js`
   - Run frontend build:
     `npm run build --prefix frontend`
   - Ensure all tests pass with 0 failures and report complete results in `handoff.md`.

