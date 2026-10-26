# Project Architecture Audit

## Stack

- Frontend: React 19, TypeScript, Vite, TailwindCSS, Recharts.
- Backend: Node.js native HTTP server, Prisma/PostgreSQL, Baileys WhatsApp gateway, Meta Cloud API webhook, SSE events.
- Persistence: PostgreSQL/Supabase; Prisma models cover users, customers, leads, treatments, categories, messages, appointments, notes, stages, broadcasts, and audit records.

## Module inventory

- `frontend/src/context/CrmContext.tsx`: authenticated client state, lead/message synchronization, mutations, SSE handling, permissions.
- `frontend/src/components/leads`: table, Kanban, filters, contact drawer, assignment, stage, notes, treatment UI.
- `frontend/src/components/chat`: chat list/thread, composer, notes, follow-ups, 24-hour window, profile and intelligence panels.
- `frontend/src/components/appointments`: booking, scheduling, rooms, doctors, appointment details.
- `frontend/src/components/admin`: staff, treatments, courses, stages, templates, audit and webhook tools.
- `backend/src/legacyServer.js`: HTTP routes, authentication, leads, users, messages, catalog, configuration and Meta operations.
- `backend/src/appointmentRoutes.js`: appointment, branch, room, doctor and availability routes.
- `backend/src/db.js`: Prisma/Supabase connection and company serial allocator.
- `backend/src/schemaBootstrap.js`: idempotent legacy schema compatibility bootstrap.
- `backend/prisma`: schema and SQL migrations.

## Boundaries

The frontend is a single SPA with context-driven state. The backend is a unified HTTP service with route dispatch in `legacyServer.js`; appointment routes and marketing routes are separated modules. The current architecture is functional but the legacy route file is a maintainability and regression-risk hotspot.
