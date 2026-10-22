# Test Results

## Passed

- **Backend `npm --prefix backend test`:** **PASS, 20/20 suites passed.**
  1. `test-security-hardening.js` (0.6s)
  2. `test-meta-token-security.js` (0.1s)
  3. `test-bell-notification.js` (0.1s)
  4. `test-sender-audit.js` (0.3s)
  5. `test-auth-security.js` (0.9s)
  6. `test-login-security.js` (3.9s)
  7. `test-24h-window.js` (0.1s)
  8. `test-company-switching.js` (0.1s)
  9. `test-cras-contact-creation.js` (0.1s)
  10. `test-company-pipelines.js` (0.3s)
  11. `test-lead-assignment.js` (3.3s)
  12. `test-media-and-memory-security.js` (1.2s)
  13. `test-marketing-foundation.js` (0.1s)
  14. `test-pagination.js` (3.1s)
  15. `test-message-cursor.js` (1.7s)
  16. `test-super-admin-settings.js` (1.6s)
  17. `test-meta-message-status.js` (0.5s)
  18. `test-appointments.js` (0.2s)
  19. `test-phonetic-composer.js` (0.2s)
  20. `test-e2e-workflow-matrix.js` (2.8s)
- **Frontend Production Build (`npm --prefix frontend run build`):** **PASS** (`tsc -b && vite build` built in 5.78s with 0 errors).
- **Frontend Lint (`npm --prefix frontend run lint`):** Completed with **0 errors** (286 warnings).
- **Backend Syntax Check (`node --check server.js`):** **PASS**.
- **Database Integrity Check:** **PASS** (323 leads verified with 0 missing treatments, 0 missing categories, 0 missing serials, and 0 orphaned foreign keys).

## Lint Warnings Status

Oxlint reported 286 warnings (0 errors) consisting of unused imports, unused catch bindings, and React hook dependencies. Core components were cleaned and typechecked with zero breaking changes to existing behavior.

## Blocked External Validations

- **Live WhatsApp Recipient Delivery:** Blocked per audit rules to avoid sending unsolicited messages to real patient phone numbers. Mock webhook signatures, payload processing, and status transitions passed at 100%.
- **Live Clinic Baileys Device Session:** Blocked pending on-site physical QR scanning at clinic go-live.
