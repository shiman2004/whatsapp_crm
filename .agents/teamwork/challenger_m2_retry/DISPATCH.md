# Challenger Assignment: Milestone 2 Remediation Adversarial Challenge

## Objective
Empirically verify through stress testing and attack vectors that the remediated Milestone 2 implementation strictly prevents bypasses:
1. Attack 1: Attempt to register/login a 3rd device without admin approval — must return HTTP 403 `THIRD_DEVICE_BLOCKED`.
2. Attack 2: Attempt to register two mobile phones or two desktop computers — must return HTTP 403 `DEVICE_LIMIT_EXCEEDED`.
3. Attack 3: Attempt to re-register a revoked device — must return HTTP 403 `THIRD_DEVICE_BLOCKED`.
4. Attack 4: Attempt to bypass session invalidation after status change (`Suspended`) — must return HTTP 401 `SESSION_EXPIRED`.
5. Attack 5: Verify live HTTP requests to `/api/student/login` on the HTTP server succeed without staff credentials.

Execute adversarial test harnesses and report your verdict (`APPROVE` or `REQUEST_CHANGES`) in `handoff.md`.

## 2026-10-29T19:22:48Z
You are assigned as Adversarial Verifier / Challenger for Milestone 2 Remediation.

Working directory: d:\Royal Project\whatsapp_crm\.agents\teamwork\challenger_m2_retry\
Original Request: d:\Royal Project\whatsapp_crm\.agents\teamwork\ORIGINAL_REQUEST.md
Project Architecture: d:\Royal Project\whatsapp_crm\PROJECT.md
Task Dispatch Brief: d:\Royal Project\whatsapp_crm\.agents\teamwork\challenger_m2_retry\DISPATCH.md
Worker Remediation Handoff: d:\Royal Project\whatsapp_crm\.agents\teamwork\worker_m2_remediation\handoff.md

Empirically verify through stress testing and attack vectors that the remediated Milestone 2 implementation strictly prevents bypasses:
1. Attack 1: Attempt to register/login a 3rd device without admin approval — must return HTTP 403 THIRD_DEVICE_BLOCKED.
2. Attack 2: Attempt to register two mobile phones or two desktop computers — must return HTTP 403 DEVICE_LIMIT_EXCEEDED.
3. Attack 3: Attempt to re-register a revoked device — must return HTTP 403 THIRD_DEVICE_BLOCKED.
4. Attack 4: Attempt to bypass session invalidation after status change (Suspended) — must return HTTP 401 SESSION_EXPIRED.
5. Attack 5: Verify live HTTP requests to `/api/student/login` on the HTTP server succeed without staff credentials.

Write an adversarial test harness if needed or run existing adversarial suites:
- `node --test backend/test-remediation-m2.test.js`
- `node --test backend/test-challenger-m2-device.test.js backend/test-challenger-m2-identity.test.js`

Write your complete report in `d:\Royal Project\whatsapp_crm\.agents\teamwork\challenger_m2_retry\handoff.md` and send a message with your explicit verdict (APPROVE or REQUEST_CHANGES).
