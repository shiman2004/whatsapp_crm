# SYSTEM SETTINGS SECURITY FINDINGS & VULNERABILITY AUDIT
**Project:** Alpha Health Group WhatsApp CRM  
**Date:** November 03, 2026  
**Security Lead:** Master Codex Autonomous Agent  

---

## 1. Mandatory Security Audit Findings

As mandated by Section 14 of the Master Codex, six specific historical and potential vulnerability surfaces were comprehensively audited and verified against the current branch:

### Finding 1: Hardcoded Login Credentials Reachable via Test Detection
- **Initial Risk**: Historical test harnesses sometimes bypassed password verification if test email addresses or paths were detected.
- **Verification & Status**: **REMEDIATED & SAFE**. `backend/src/legacyServer.js` enforces scrypt password hashing for all authentication paths. No test-path bypass exists. Verified by `test-auth-security.js` and `test-login-security.js`.

### Finding 2: Unauthenticated Coordinator Directory Exposure
- **Initial Risk**: Certain coordinator listings leaked email addresses or phone numbers to unauthenticated callers.
- **Verification & Status**: **REMEDIATED & SAFE**. All coordinator and staff listing endpoints (`/api/users`, `/api/companies/:id/branch-managers`) require a valid Bearer JWT with `staff.view` capability. Tested by `test-sender-audit.js` and `test-e2e-workflow-matrix.js`.

### Finding 3: Missing Appointment Authorization
- **Initial Risk**: Callers could manipulate appointment bookings or create cross-doctor room scheduling conflicts.
- **Verification & Status**: **REMEDIATED & SAFE**. Handled by `appointmentRoutes.js` and `appointmentOperations.js`. Room double-booking and doctor cross-room double-booking are rejected with `409 Conflict`. Confirmed by `test-appointments.js` and Scenario 8 of `test-e2e-workflow-matrix.js`.

### Finding 4: Fail-Open Meta Webhook Signature Verification
- **Initial Risk**: Meta WhatsApp webhook handler failing to validate the `X-Hub-Signature-256` HMAC header on inbound webhooks.
- **Verification & Status**: **REMEDIATED & SAFE**. Inbound Meta webhook payloads are validated against the App Secret using `crypto.createHmac('sha256', appSecret)`. Missing or mismatched signatures return `403 Forbidden` and do not process messages. Verified by `test-media-and-memory-security.js`.

### Finding 5: OTP Disclosure Outside Production
- **Initial Risk**: Student portal OTP codes or password reset tokens accidentally logged in unmasked plain text to public client responses.
- **Verification & Status**: **REMEDIATED & SAFE**. OTP tokens are encrypted with `secretHash.js` and only transmitted via secure SMS/WhatsApp transport. Verified by `test-exam-upgrade.test.js`.

### Finding 6: Student-Admin Authorization using Unverified Token Claims
- **Initial Risk**: JWT claims with elevated roles trusted without validating against the database `User` active record.
- **Verification & Status**: **REMEDIATED & SAFE**. `authenticateRequest` in `backend/src/securityPolicy.js` checks both the cryptographic signature and queries the active database user record to ensure deactivated or role-demoted users are rejected immediately with `401 Unauthorized`. Verified by `test-auth-security.js`.

---

## 2. Additional Vulnerabilities Identified & Remediated During Audit

### Finding 7: Company Settings Route Interception Deadlock (404 NOT_FOUND)
- **Severity**: High (Caused failure of company settings updates).
- **Location**: `backend/src/companyRoutes.js` (line 476).
- **Vulnerability**: `handleCompanyRoutes` captured all `/api/companies` URLs and threw `404 NOT_FOUND` for sub-routes under `/settings/:section`, preventing `settingsRoutes.js` from ever receiving company-scoped settings updates.
- **Remediation**: Added explicit delegation check:
  ```javascript
  if (/^\/api\/companies\/[^/]+\/settings\/[^/]+$/.test(pathname) && !pathname.endsWith('/settings/audit-logs')) {
    return false;
  }
  ```
- **Verification**: Verified via test script: `PUT /api/companies/RWC/settings/company` returned `200 OK` and updated PostgreSQL record.

### Finding 8: Client-Side Logo Image Ingestion Gap
- **Severity**: Medium (Functional block).
- **Location**: `frontend/src/components/settings/CompanyBranchSection.tsx`.
- **Vulnerability**: "Change Logo" button executed a dummy toast with no file input or image ingestion pipeline.
- **Remediation**: Implemented HTML5 `<canvas>` downscaling (512×512) and Base64 Data URL ingestion with native file picker and drag-and-drop support.
- **Verification**: Verified compilation with `tsc -b && vite build`.

