## 2026-10-29T17:40:27Z
You are teamwork_worker implementing Milestone 2: Student Account Management & Controlled Device Security.
Your working directory is: d:\Royal Project\whatsapp_crm\.agents\teamwork\worker_m2\

Read:
1. ORIGINAL_REQUEST.md at d:\Royal Project\whatsapp_crm\.agents\teamwork\ORIGINAL_REQUEST.md (Requirement R2 and Acceptance Criteria)
2. PROJECT.md at d:\Royal Project\whatsapp_crm\PROJECT.md
3. Authoritative specifications:
   - d:\Royal Project\whatsapp_crm\.agents\teamwork\spec_miner_1\handoff.md (Scenarios 5–9)
   - d:\Royal Project\whatsapp_crm\TEST_INFRA.md and test suites `backend/tests/e2e/uat05-*.js` through `uat09-*.js`
   - Explorer reports in `explorer_1/handoff.md` and `explorer_2/handoff.md`

Write Ownership:
You exclusively own and may modify:
- backend/src/studentAccess.js
- backend/src/studentRoutes.js
- frontend/src/components/exam/StudentPortal.tsx
- any supporting student security endpoint in backend/src/securityRoutes.js or backend/src/examRoutes.js

Your Scope for Milestone 2 (Features 8–12, UAT Scenarios 5–9):
1. Student Account Provisioning & Lifecycle:
   - Account keying strictly by student personal email (`studentId = orderKey(email)`).
   - Passwords hashed using scrypt with 16-byte random salt, minimum 15 characters, entropy checks, plaintext strictly hidden from all staff responses.
   - Account lifecycle tracking: `Pending Activation`, `Email Verification Pending`, `Active`, `Suspended`, `Locked`, `Disabled`.
2. Repeat Purchase Identity Linking:
   - Returning student purchasing additional packages/orders links entitlements to their existing account (`studentId`) without creating duplicate records. Zero duplicate rows in `student` store.
3. Strict Two-Device Registration Policy:
   - Maximum 2 registered devices: strictly 1 Mobile Phone AND 1 Desktop OR Laptop.
   - Enforce rejection of 2 mobiles, 2 laptops/desktops, or 3+ devices with HTTP 403 `DEVICE_LIMIT_EXCEEDED` ("A mobile device is already registered" or "A desktop/laptop is already registered").
4. Single Concurrent Active Session Enforcement:
   - Only 1 concurrent active session is permitted across registered devices.
   - Logging in on a second device terminates the session on the first device (increments session version/generation, invalidating prior session tokens). Subsequent requests from the first device return HTTP 401 `SESSION_EXPIRED`.
5. Unregistered 3rd Device Block & Replacement Request Workflow:
   - Attempting to access from an unregistered 3rd device blocks direct login.
   - Triggers Device Replacement Request workflow: sends 8-digit OTP to student's email, validates OTP (locking after 5 consecutive failures), and puts request in `PENDING_ADMIN_APPROVAL`.
   - Admin approval endpoint: revokes the old device of the same device category, immediately invalidates all active sessions on the revoked device, and authorizes the new device.
6. Frontend Student Portal (`StudentPortal.tsx`):
   - Student activation & login views.
   - Device detection and registration banner/modal (identifying Mobile vs Desktop/Laptop).
   - Concurrent session termination notice when replaced by another device.
   - Unregistered 3rd device block screen with replacement request modal (OTP verification + reason + pending admin approval status).
7. Verification:
   - Run: `node --test backend/tests/e2e/uat05-student-provisioning.test.js backend/tests/e2e/uat06-repeat-purchase-linking.test.js backend/tests/e2e/uat07-two-device-gating.test.js backend/tests/e2e/uat08-single-session-concurrency.test.js backend/tests/e2e/uat09-third-device-replacement.test.js`
   - Run: `node --test backend/test-exam-upgrade.test.js`
   - Run: `npm run build --prefix frontend`
   - Ensure all tests pass with exit code 0.

