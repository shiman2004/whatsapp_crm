# Public Contact Marketing Module Implementation Plan

## Current baseline

- Existing CRM shell: `frontend/src/App.tsx`, `frontend/src/components/layout/Sidebar.tsx`, and `frontend/src/context/CrmContext.tsx`.
- Existing roles include `marketing_officer` and `marketing_admin` in `backend/prisma/schema.prisma`.
- Marketing persistence foundation exists in `backend/prisma/migrations/20261021_public_contact_marketing.sql` and the Prisma schema: contacts, import batches/rows/jobs, contributions, consent events, suppressions, assignment history, tasks, notifications, audit logs, campaigns, and assets.
- Backend marketing routing currently exposes only protected health discovery in `backend/src/marketing/routes.js`; all functional endpoints remain to be implemented.
- Existing authentication and role enforcement are in `backend/src/legacyServer.js` and should be reused. The module must remain separate from `Lead` and must not create sales inquiries.

## Recommended delivery sequence

### Phase 0 — Confirm foundation and deployment safety

1. Verify the migration is applied in local/staging and production with the actual PostgreSQL enum/table names.
2. Run Prisma client generation and schema validation without rewriting unrelated migrations.
3. Add a marketing test database fixture and seed users for staff, marketing officer, marketing admin, and super admin.
4. Define one shared E.164 normalization utility and a supported default region policy; reject ambiguous local numbers rather than guessing.

### Phase 1 — Contact collection and My Uploads

1. Add backend services for single entry, bulk text, and CSV/XLSX parsing.
2. Create idempotent import-batch processing with row-level outcomes: saved, duplicate, invalid, and failed.
3. Enforce global uniqueness with the `marketing_contacts.normalized_phone` constraint and transaction-safe conflict handling.
4. Allocate permanent serials using `next_marketing_contact_serial()` only for successfully created contacts.
5. Process small imports inline and queue larger imports through `marketing_import_jobs`; expose batch status and summary endpoints.
6. Add APIs for staff-owned upload history and backend ownership checks.
7. Add frontend views: expandable `Public Contact Marketing` navigation and `Add Public Numbers` / `My Uploads` screens, preserving existing layout/theme.

### Phase 2 — Master Contact Database and consent controls

1. Add paginated, searchable, filterable contact listing with company scope and permission-controlled export.
2. Add consent status/event endpoints and suppression handling.
3. Ensure outbound eligibility requires an explicit acceptable consent state plus no suppression; public/group visibility alone must never qualify.
4. Add frontend `Contact Database` with audit fields and clear read-only restrictions for non-authorized roles.

### Phase 3 — Atomic assignment and officer work queue

1. Implement quantity, equal-distribution, source, batch, and contribution-based assignment selectors.
2. Execute assignment in a database transaction using row locks or an atomic update predicate so concurrent admins cannot claim the same contact.
3. Create one active task/owner per contact, append immutable assignment history, write audit records, and create officer notifications in the same transaction.
4. Restrict assignment/reassignment to super admin; preserve prior-owner history on reassignment.
5. Add `Contact Assignment` and `My Marketing Tasks` frontend views, with officers seeing only their own contacts and allowed task updates.

### Phase 4 — Campaign content and approved messaging

1. Add campaign CRUD, officer targeting, approval/rejection, date-window validation, and asset upload/download through the existing private storage approach.
2. Enforce that officers can see only assigned campaigns and approved content.
3. Link task execution to consent eligibility and campaign approval; do not expose a send action for ineligible contacts.
4. Add `Campaign Content` frontend view for authorized roles.

### Phase 5 — Dashboard, reports, and reconciliation

1. Add aggregate APIs for collection, duplicates, invalids, contributions, assignments, unassigned contacts, progress, campaign completion, and reassignment history.
2. Implement Today, Yesterday, This Month, Last Month, and custom date-range filters with timezone-safe boundaries.
3. Reconcile report totals directly from import rows and contact/assignment history rather than UI counters.
4. Add `Marketing Dashboard` and `Marketing Reports` frontend views.

## Critical backend files to add or change

- `backend/src/marketing/routes.js` — route dispatch and request validation.
- `backend/src/marketing/permissions.js` — capability and company-scope checks.
- New `backend/src/marketing/contacts.js`, `imports.js`, `assignments.js`, `campaigns.js`, `reports.js`, and `normalization.js` services.
- `backend/src/legacyServer.js` — only the minimal authenticated route integration if needed.
- `backend/prisma/schema.prisma` and additive migrations only when the implementation identifies missing constraints or fields.

## Critical frontend files to add or change

- `frontend/src/components/layout/Sidebar.tsx` — expandable marketing menu, capability-aware visibility.
- `frontend/src/App.tsx` and `frontend/src/context/CrmContext.tsx` — route/view state and authenticated API integration.
- New `frontend/src/components/marketing/` views for dashboard, imports, uploads, contacts, assignment, tasks, campaigns, and reports.
- New marketing API/types modules rather than coupling marketing state to lead state.

## Verification plan

- Backend unit tests: E.164 normalization, duplicate detection, idempotency, consent eligibility, role/company access, and report date boundaries.
- Backend integration tests: 10,000-row queued import, concurrent assignment race, reassignment history, notification creation, and export authorization.
- Frontend checks: TypeScript build, lint, and role-based rendering tests for all seven submenu areas.
- Regression checks: existing backend suite, lead pipeline, WhatsApp chat, authentication, and current migration checks.
- Manual/browser QA: import summary, upload ownership, contact filters, assignment distribution, officer isolation, campaign approval, and blocked messaging for unknown/denied consent.
- Production gate: staging migration rehearsal, backup/rollback confirmation, queue worker monitoring, storage limits, retention policy, and live database reconciliation before release.

## Delivery boundary

Implement in phases. Do not attempt the entire module as one UI-only change: the acceptance criteria depend on database constraints, backend authorization, transactional assignment, asynchronous imports, consent enforcement, and auditable history.
