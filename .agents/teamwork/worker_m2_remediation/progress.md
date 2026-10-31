# Progress: Milestone 2 Remediation

Last visited: 2026-10-29T19:21:00Z

## Status
- [x] Initialized DISPATCH.md, BRIEFING.md, and progress.md
- [x] Inspected relevant codebase files and verified baseline test suites pass
- [x] Step 1: Implement legacyServer.js & studentRoutes.js mounting and authentication handling
  - In `backend/src/legacyServer.js`: Mounted `if (await handleStudentRoutes(req, res, pathname, authUser)) return;` before CRM staff `authenticateRequest`. Excluded `/api/student/` from CRM staff auth wall.
  - In `backend/src/studentRoutes.js`: Supported Bearer tokens from `req.headers.authorization` alongside cookie `exam_session`. Permitted public routes without staff Bearer tokens. Added defensive header guards.
- [x] Step 2: Implement DevicePolicyManager integration in studentAccess.js login() and verifyDevice(), and fix revoked device status trap
  - In `backend/src/studentAccess.js`:
    - In `DevicePolicyManager.registerDevice()`: explicitly block re-registration of devices with status `'REVOKED'` (`THIRD_DEVICE_BLOCKED`), and only match active devices. Accepted `existingTx` to avoid nested transaction deadlock. Recorded `browserDigest`.
    - In `StudentAccess.login()`: check client device against `registeredDevices`. If unregistered and `activeDevices.length >= 2`, block with `THIRD_DEVICE_BLOCKED`. If device type exceeds 1 mobile or 1 desktop rule, block with `DEVICE_LIMIT_EXCEEDED`. Store device details in challenge record. Match registered device slot on deviceType.
    - In `StudentAccess.verifyDevice()`: when OTP succeeds, call `this.devicePolicy.registerDevice(student.id, targetDevice, tx)` to record device as `ACTIVE` in `student.registeredDevices` and bind `browserDigest`.
- [x] Step 3: Implement exam_department_manager access in securityRoutes.js without blanket block
  - In `backend/src/securityRoutes.js`: Updated line 192 perimeter check so `exam_department_manager` is permitted alongside `super_admin` for `/api/security/device-replacements*`.
- [x] Step 4: Implement student lifecycle status API in examOperationsRoutes.js and studentRoutes.js
  - In `backend/src/examOperationsRoutes.js`: Mounted `PATCH /api/exam-ops/students/:id/status` guarded by `canManageExam(user)`.
  - In `backend/src/studentRoutes.js`: Mounted `PATCH /api/student/admin/:id/status` guarded by `super_admin` / `exam_department_manager`.
  - Terminates all active student sessions automatically when status transitions away from `ACTIVE`.
- [x] Step 5: Verification & Testing
  - Run M2 UATs (uat05 to uat09): PASS (18/18)
  - Run Challenger M2 suites: PASS (35/35)
  - Run Remediation suite (backend/test-remediation-m2.test.js): PASS (12/12)
  - Run Full UAT suite (run-all-uat.js): PASS (24/24 suites, 100% success)
  - Run Exam Upgrade Core Suite: PASS (19/19)
  - Run Frontend build (`npm run build --prefix frontend`): PASS (built in 21.79s)
- [x] Step 6: Produce comprehensive handoff.md and report to parent

