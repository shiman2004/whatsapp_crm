# API Audit

## Route groups

- Authentication/session: login, session verification and protected-default route handling.
- Leads: list/pagination, assignment, update, delete and company-scoped access.
- Messages/chat: list, cursor pagination, send, status and media operations.
- Catalog/configuration: treatments, courses, stages, coordinators, templates and settings.
- Appointments: branches, rooms, doctors, availability, booking, rescheduling, status and cancellation.
- WhatsApp: Baileys status/QR and Meta webhook/configuration routes.
- Marketing/broadcasts and notifications.

## Verified API behavior

Authentication, resource-level permissions, company isolation, pagination, assignment locking, message cursors, appointment conflicts, Meta status transitions and admin configuration are covered by the backend suites; all 19 suites passed in this audit.

## Risks

- Most route dispatch remains concentrated in `backend/src/legacyServer.js`; route-level contract drift is likely without generated OpenAPI or schema validation.
- Browser/external WhatsApp delivery was not exercised in this environment.
- SQL migration files are standalone SQL files rather than Prisma migration directories, so deployment tracking must be handled deliberately.
