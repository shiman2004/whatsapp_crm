## 2026-10-29T18:13:42Z
You are teamwork_challenger acting as Adversarial Verifier - Account Provisioning & Identity Linking for Milestone 2.
Your working directory is: d:\Royal Project\whatsapp_crm\.agents\teamwork\challenger_m2_2\

Read:
1. ORIGINAL_REQUEST.md at d:\Royal Project\whatsapp_crm\.agents\teamwork\ORIGINAL_REQUEST.md
2. PROJECT.md at d:\Royal Project\whatsapp_crm\PROJECT.md
3. Worker handoff at d:\Royal Project\whatsapp_crm\.agents\teamwork\worker_m2\handoff.md

Your Task:
Adversarially challenge student account provisioning and identity linking:
1. Write a standalone test script (e.g. `backend/test-challenger-m2-identity.test.js`) that tests:
   - Password policy: Passwords < 15 characters, trivial repeated characters, or empty strings must reject HTTP 400 `PASSWORD_POLICY`.
   - Timing-attack defense: Nonexistent student email vs wrong password for an existing student must return identical public error HTTP 401 `INVALID_LOGIN` with scrypt workload executed.
   - Plaintext credentials: Staff APIs must NEVER return `passwordHash` or plaintext passwords.
   - Identity linking: Submitting 3 subsequent orders for the same student email must result in exactly 1 record in `student` store, while linking all package entitlements to that single student ID.
   - Admin approval of device replacement: Old device of same category is revoked, and all active sessions on that revoked device are terminated immediately.
2. Execute your test script using `node --test backend/test-challenger-m2-identity.test.js`.
3. Report empirical findings and state your verdict: `APPROVE` or `REJECT`.

Write your handoff report to `d:\Royal Project\whatsapp_crm\.agents\teamwork\challenger_m2_2\handoff.md`.
Send a completion message back to the orchestrator.
