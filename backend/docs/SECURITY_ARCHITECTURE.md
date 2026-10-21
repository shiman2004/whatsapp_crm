# Backend security architecture

`server.js` remains the compatibility entry point. New cross-cutting concerns are
implemented in `src/securityAudit.js`, while media persistence and appointment
routes remain in their existing modules. The intended extraction order is:

1. `src/config/` for environment validation and trusted-origin/proxy settings.
2. `src/middleware/` for correlation IDs, body limits, authentication, CORS and errors.
3. `src/routes/` and `src/controllers/` for the existing route groups.
4. `src/services/` and `src/repositories/` for Meta, media, Prisma and audit operations.

The route contracts are intentionally unchanged during this incremental migration.
Protected requests use `Authorization: Bearer <token>`. Identity headers are not
accepted. SSE uses a single-use ticket obtained with a Bearer-authenticated POST.

## Required production configuration

- `JWT_SECRET`
- `META_VERIFY_TOKEN`
- `META_APP_SECRET`
- `FRONTEND_URL`
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INITIAL_ADMIN_SETUP_TOKEN` only during first administrator bootstrap

## Media migration

Run `npm run media:migrate-private` after creating a private `whatsapp-media`
bucket. The script uploads and downloads each local file for integrity verification
and never deletes the source files. Remove legacy files only after the report is
reviewed and a backup is confirmed. Media access remains authenticated and
coordinator access is checked against the assigned lead.

## Audit events

Security events are written to `security_audit_events` and emitted as structured
JSON logs. Sensitive fields are redacted. Each request receives an
`X-Correlation-Id` response header.
