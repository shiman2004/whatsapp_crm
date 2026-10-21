# Royal Wellness CRM Backend Audit

## Scope

Audited the native-HTTP backend, Prisma schema and migrations, Supabase adapters, WhatsApp/session modules, webhook bridge, startup entry points, and `test-*.js` files.

## File inventory and responsibility map

| Area | Files | Responsibility |
|---|---|---|
| Bootstrap/API | `server.js`, `src/app.js`, `src/legacyServer.js` | Application composition, startup, legacy route dispatcher |
| Persistence | `src/db.js`, `prisma/schema.prisma`, `prisma/migrations/*`, `prisma/seed.js` | Prisma/PostgreSQL access, schema and seed data |
| Domain support | `src/appointmentRoutes.js`, `src/conflictEngine.js`, `src/companyConfig.js`, `src/whatsappWindow.js` | Appointments, conflicts, company isolation, 24-hour rules |
| Integrations | `src/sessionManager.js`, `src/supabaseAuthState.js`, `src/supabaseMedia.js`, `src/whatsappNotifier.js`, `src/audioConverter.js` | WhatsApp sessions, storage, notifications, media conversion |
| Security | `src/securityAudit.js`, auth logic in `src/legacyServer.js` | JWT, rate limits, correlation IDs, audit events, errors |
| Operations | `scripts/*`, `webhook-standalone.js` | Migration/seed tooling and legacy webhook bridge |
| Tests | `test-*.js` | Unit-style, integration-style, security and regression checks |

## Key findings

- The bootstrap boundary is now small, but the legacy dispatcher still contains most route logic and is the next extraction target.
- Authentication is JWT-based in production; legacy identity headers are rejected by the backend. Several old integration tests still need conversion to Bearer tokens.
- Shared PostgreSQL rate-limit tables and private-media migration support exist, but live database/storage verification is still required.
- `webhook-standalone.js` is now a compatibility launcher delegating to the maintained server; the duplicated insecure implementation has been removed.
- Several integration tests directly mutate shared database state and need isolated fixtures/test databases before being treated as CI-safe.

## Current risk rating

Critical legacy webhook bridge: unresolved until deployment usage is confirmed and it is retired or rewritten.

High test isolation and live storage/rate-limit verification: partially resolved.

Medium modular extraction and centralized error coverage: partially resolved.
