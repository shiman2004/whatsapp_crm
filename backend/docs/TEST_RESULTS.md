# Backend Test Results

## Executed

- `node --check backend/server.js`: passed.
- `node --check backend/src/whatsappWindow.js`: pending after this change.
- `node backend/test-security-hardening.js`: passed previously.
- `node backend/test-auth-security.js`: passed previously.
- `node backend/test-meta-token-security.js`: passed previously.
- `npm.cmd run build --prefix backend`: passed previously.
- `node backend/test-24h-window.js`: passed after extracting production utility.
- `node --check backend/webhook-standalone.js`: passed.
- `node --check backend/test-lead-assignment.js`: passed.

## Incomplete or not run

- `npm test` progressed through company-pipeline checks and failed at `test-super-admin-settings.js` because the configured PostgreSQL host was unreachable. It did not reach later appointment/status suites.
- Live database, Supabase Storage, Meta webhook, and multi-instance rate-limit tests require isolated services and are not claimed as passed.
