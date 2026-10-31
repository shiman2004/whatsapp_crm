# Phase 3.1 — Security Remediation Report

Date: 2026-10-21

## Verdict

**Not release-ready until the remaining limitations below are addressed.**

RISK-3.1 is remediated by executable backend integration evidence: the client can
become authenticated only after the server verifies a newly issued or restored
bearer token and returns the resolved user record. RISK-3.6 is substantially
reduced for the repository's guarded test, seed, consolidation, media migration,
and Prisma command paths. It is not marked fully resolved because PostgreSQL
role separation and removal of runtime schema DDL have not yet been completed.

## Root causes

### RISK-3.1 — Client-authoritative login

- `CrmContext` treated a cached `rw_crm_auth_user_id` as an authenticated session.
- Login checked cached profile credentials and set authenticated state before the
  login API answered.
- Missing or expired tokens were silently reissued using cached/default credentials.
- The Header could switch the displayed profile without changing the bearer token.
- The server had no dedicated endpoint to return the database-resolved session user.

### RISK-3.6 — Accidental production database writes

- Test checks depended primarily on host/database-name heuristics.
- Seed, consolidation, media migration, and Prisma CLI commands could load an
  inherited or dotenv database URL without explicit operation authorization.
- Non-production tools had no common `DB_ENVIRONMENT` policy or approved production
  migration path.

## Controls implemented

### Verified authentication

- Added protected `GET /api/auth/session`. It uses the existing bearer-token
  verification and database user lookup, then returns only the resolved active user.
- Login now awaits `POST /api/auth/login` and then `/api/auth/session`; no client
  profile, role, or cached secret can establish a session.
- Refresh restoration validates the stored token through the same endpoint before
  the authenticated layout can load data.
- Removed automatic token renewal and Super Admin fallback credentials.
- Logout, failed restoration, account switching, and active-account deletion clear
  bearer/identity storage and user-scoped in-memory CRM data.
- Header profile switching now signs out; the target staff member must authenticate.
- Initial CRM hydration is gated on verified authentication.

### Database operation policy

- Added `databasePolicy.js`, which requires an explicit `DB_ENVIRONMENT` and rejects
  unknown targets without logging credentials.
- Test access requires `DB_ENVIRONMENT=test`, `DATABASE_URL === TEST_DATABASE_URL`,
  and a dedicated test-named database. A configured protected production target is
  rejected independently of a script filename.
- Destructive development utilities require both `DB_ENVIRONMENT=development` and
  `ALLOW_DESTRUCTIVE_DB_TOOLS=true`.
- Production migrations require both `DB_ENVIRONMENT=production` and
  `APPROVED_PRODUCTION_MIGRATION=true` through `prisma:migrate:deploy`.
- Seed, consolidation, CRAS seed, and media migration paths use the policy.
- Prisma push/migrate package commands are routed through the guarded launcher.
- `.env.test.example` documents the required explicit test environment identity.

## Files modified for Phase 3.1

- `backend/.env.test.example`
- `backend/package.json`
- `backend/prisma/consolidate.js`
- `backend/prisma/seed.js`
- `backend/scripts/migrate-media-private.js`
- `backend/scripts/run-prisma-operation.js` (new)
- `backend/scripts/seed_cras_courses.js`
- `backend/src/databasePolicy.js` (new)
- `backend/src/legacyServer.js`
- `backend/src/testDbGuard.js`
- `backend/test-database-policy.js` (new)
- `backend/test-login-security.js`
- `frontend/src/components/auth/LoginScreen.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/context/CrmContext.tsx`

## Executed verification

| Check | Result | Evidence |
| --- | --- | --- |
| Backend syntax checks | Passed | `node --check` for changed backend modules |
| Database policy unit test | Passed | `node test-database-policy.js` |
| Production-looking test target | Passed | Guard rejected a non-test target before a connection was made |
| Unapproved production migration | Passed | Guarded launcher rejected missing environment/approval |
| Login security integration | Passed | Valid Super Admin, Coordinator, invalid credentials, protected session, invalid bearer, rate limiting, hash checks |
| Frontend type-check + production build | Passed | `npm.cmd run build` |
| Frontend lint | Passed with existing warnings | `npm.cmd run lint`; no lint errors |
| Browser validation | Blocked | Local automation CDP channel closed before attachment |

## Production-data safety evidence

- No migration, seeder, database utility, or production deployment command was run
  during this remediation.
- Authentication integration used the canonical in-process test users with an
  unreachable local test URL (`127.0.0.1:1/..._test`); it did not establish a
  PostgreSQL connection.
- Database-policy tests used synthetic URLs only and do not instantiate Prisma.
- No credentials are included in this report or test output.

## Remaining limitations and required next work

1. Give test credentials access only to a dedicated isolated PostgreSQL database;
   enforce this at the database role/network level, not just application policy.
2. Remove runtime schema bootstrap and catalog upserts from application startup;
   use reviewed deployment migrations and fail startup on schema mismatch instead.
3. Add a shared authenticated-fetch wrapper so every individual frontend request
   consistently clears an expired session on HTTP 401. Existing direct token reads
   in several feature components should be migrated to it.
4. Configure a controllable browser/CDP session and run the requested visual checks:
   role switching, lead visibility, pagination, scroll position, note badges, and
   message-cursor ordering.
5. Run the complete database integration suite only after an isolated test database
   with the explicit `DB_ENVIRONMENT=test` configuration is available.
