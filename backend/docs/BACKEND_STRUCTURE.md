# Backend Structure and Incremental Refactor Plan

`server.js` is the compatibility bootstrap. `src/app.js` is the composition boundary. The former monolithic implementation currently lives in `src/legacyServer.js` so route extraction can proceed without changing public URLs or response contracts.

## Target extraction order

1. `config/`: validated environment and trusted proxy/origin configuration.
2. `core/`: router, request parsing, correlation IDs and error responses.
3. `modules/auth/`: JWT verification, login, setup, RBAC and rate limiting.
4. `modules/webhooks/` and `modules/whatsapp/`: Meta verification, idempotency, messaging and SSE.
5. `modules/leads/`, `modules/appointments/`, `modules/staff/`: route/controller/service boundaries.
6. `modules/media/`: authenticated ownership checks, private storage and signed URLs.
7. `repositories/`: Prisma query ownership and transaction boundaries.

Each extraction must retain the existing route path, method, status code and response shape, with a focused regression test before the next extraction.
