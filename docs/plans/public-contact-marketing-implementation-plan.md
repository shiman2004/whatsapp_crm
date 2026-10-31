# Public Contact Marketing — Recommended Implementation Plan

## 1. Approved architecture direction

Build Public Contact Marketing as a separate PostgreSQL/Prisma domain and a dedicated authenticated route module. It must not write to `Lead`, `Customer`, sales assignment, or WhatsApp messaging tables. It may reuse existing users, bearer-token authentication, company configuration, the shell, Supabase Storage, and the visual component conventions.

### Selected role proposal

Extend the existing `Role` enum with `marketing_officer` and `marketing_admin`. Keep `leads_officer` as the PRD's Staff role for this first release, but grant marketing capabilities through an explicit server-side `MarketingPermission` map rather than role-name checks scattered in handlers.

| Existing/new role | Marketing capabilities |
| --- | --- |
| `leads_officer` (Staff) | Create/import contacts; see only own import batches and contribution outcomes. |
| `marketing_officer` | See only assigned contacts/tasks/campaign materials; update progress, notes, follow-ups, consent/opt-out events. |
| `marketing_admin` | View approved scoped reports; create/edit draft campaign content; no assignment/reassignment unless separately granted. |
| `super_admin` | All scoped marketing operations including assignments, reassignment, campaign approval, exports, audit history. |

The permission map is the selected proposal because it preserves existing sales roles and makes future exceptions explicit. Database queries and every route must apply scope; sidebar visibility is convenience only.

### Company and uniqueness policy

Use **global uniqueness across the marketing master database** for `normalizedPhone` as required. Store `company` / organizational scope on every marketing entity and contribution, but a second company submitting the same normalized number creates a contribution/duplicate-attempt history record, not a second master contact. Cross-company visibility must remain restricted. Super-admin cross-company access requires an explicit approved scope policy; default to the authenticated user's company.

## 2. Data model and migration design

Add Prisma models and enums for:

- `MarketingContact`: UUID, immutable permanent serial, unique `normalizedPhone`, first source/group/contributor/time, consent summary, active owner, assignment metadata, last updater, timestamps, company.
- `MarketingImportBatch` and `MarketingImportRow`: source/file metadata, idempotency key, state/counters, processor attempts/progress/error summary, immutable row outcomes.
- `MarketingContactContribution`: one record per accepted new submission or duplicate attempt; preserve who, source, batch, original input and outcome.
- `MarketingConsentEvent` and `MarketingSuppression`: immutable consent evidence/events and active opt-out/suppression state.
- `MarketingAssignmentHistory`, `MarketingTask`, and `MarketingNotification`: ownership timeline, officer work state/follow-up/notes, durable notification records.
- `MarketingCampaign`, `MarketingCampaignAsset`, and `MarketingCampaignOfficer`: campaign lifecycle, private assets, approval, officer membership.
- `MarketingAuditLog`: sensitive-action trail with actor, scoped target, action, before/after-safe metadata, correlation ID and timestamp.
- `MarketingImportJob`: durable claimable job record for the worker, linked one-to-one to batch.

Use PostgreSQL constraints/indexes: unique `MarketingContact.normalizedPhone`; unique immutable serial; foreign keys to `User`; partial indexes for unassigned eligible contacts and open tasks; `(company, createdAt)` report indexes; `(batchId, rowNumber)` unique rows; and one active task per `(contactId, ownerId)` where applicable. Generate serials with a dedicated atomic PostgreSQL counter table/function, modeled after existing company lead serial allocation but never reused.

### Migration and rollback

1. Establish a tracked migration baseline first: one reviewed Prisma migration directory per change and a production `migrate deploy` command. Stop adding marketing DDL to runtime `schemaBootstrap.js`.
2. Apply initial additive marketing schema to an isolated staging PostgreSQL database; run constraint/index inspection and a duplicate-phone preflight.
3. Deploy application and worker code compatible with both pre- and post-migration releases, then apply the migration once through the deployment release step.
4. Validate schema version, worker claim, sample import, access scopes, and dashboards before enabling navigation for users.
5. Roll back code by disabling the marketing feature flag and worker. Do not drop tables in a rollback. A later, reviewed forward migration corrects bad data/schema; restore from backup only under an incident runbook.

## 3. Backend implementation groups

Modify:

- `backend/prisma/schema.prisma` — role enum and marketing models/enums/indexes.
- `backend/package.json` — Prisma deploy/generate, worker, and targeted marketing test scripts; add `libphonenumber-js`, CSV/XLSX parser, and request-schema validation dependency.
- `backend/src/legacyServer.js` — import and call the new post-auth marketing dispatcher; retain existing public-route behavior.
- `backend/src/db.js` — migration readiness checks only; do not add business schema bootstrap for marketing.
- deployment documentation/configuration — add release migration and separate worker process definitions.

Add:

- `backend/prisma/migrations/<timestamp>_public_contact_marketing/migration.sql`
- `backend/src/marketing/routes.js` — route dispatcher, scope/permission gates, consistent error responses.
- `backend/src/marketing/permissions.js`, `scope.js`, `validation.js`, `phone.js`, `serials.js`, `audit.js`, `notifications.js`.
- `backend/src/marketing/contactService.js`, `importService.js`, `assignmentService.js`, `taskService.js`, `campaignService.js`, `reportService.js`.
- `backend/src/marketing/importWorker.js` and `backend/scripts/run-marketing-worker.js`.
- marketing-specific Node/assert tests under `backend/test-marketing-*.js`.

Route implementation must follow `handleAppointmentRoutes`'s dispatcher pattern, but route/service logic must use centralized permissions and transactions rather than copying inline legacy checks.

## 4. REST contract

All endpoints require bearer authentication, return the established success/error envelope, enforce company scope, cap pagination/sorting, and never log raw phone lists. IDs are UUIDs; phone display is masked unless a permission explicitly permits full viewing.

| Area | Endpoint and intent |
| --- | --- |
| Dashboard | `GET /api/marketing/dashboard?range=` — role-scoped KPIs/charts/recent imports. |
| Contact submit/import | `POST /contacts`, `POST /imports/paste`, `POST /imports/file`, `GET /imports`, `GET /imports/:id`, `GET /imports/:id/errors`. File creation returns `202 { batchId, jobId, state }`; no long request waits for completion. |
| Contacts | `GET /contacts`, `GET /contacts/:id`, `PATCH /contacts/:id`, `GET /contacts/:id/history`, `POST /contacts/:id/consent-events`, `POST /contacts/:id/opt-out`. |
| Assignment | `GET /assignments/eligible`, `POST /assignments`, `POST /assignments/distribute`, `POST /assignments/reassign`, `GET /assignments/history`. Reassign requires non-empty reason. |
| Tasks | `GET /tasks`, `GET /tasks/:id`, `PATCH /tasks/:id`, `POST /tasks/:id/notes`. |
| Campaigns | `GET/POST /campaigns`, `GET/PATCH /campaigns/:id`, `POST /campaigns/:id/assets`, `POST /campaigns/:id/approve`. |
| Reports | `GET /reports/overview`, `/contributions`, `/assignments`, `/campaigns`, `/reassignments`, and authorized `/export`. |

Every mutating request includes an idempotency key where retry is expected. Import detail exposes counters and row outcomes; assignment responses expose selected, assigned, skipped/conflicted, and notification counts.

## 5. Import worker architecture

Use a **separate durable worker process** backed by PostgreSQL jobs, not process memory. The web request validates metadata, stores the private source file/reference, creates batch/job/rows transactionally, and responds `202`.

The worker claims jobs with `FOR UPDATE SKIP LOCKED`, marks a lease/heartbeat, processes bounded chunks (for example 250 rows), normalizes with `libphonenumber-js` and the declared country, and persists each row outcome. Contact insertion uses `INSERT ... ON CONFLICT (normalized_phone)` semantics inside a transaction: a new master gets a serial and first attribution; conflict adds a contribution/duplicate attempt without changing first attribution. Counters derive from durable rows, so retry is idempotent. Lease expiry makes interrupted jobs reclaimable; retry limits mark the batch failed with actionable error summaries. Frontend polls batch status initially; SSE may later push state changes, but is not a correctness dependency.

Store CSV/XLSX files privately in configured Supabase Storage with size/MIME/extension checks. Parse files only in the worker. Use upload limits distinct from WhatsApp media limits. Never put raw rows in app logs or analytics events.

## 6. Assignment, consent, and campaign rules

Assignment services run a single Prisma interactive transaction that: authorizes actor; locks eligible unassigned contacts with `FOR UPDATE SKIP LOCKED`; conditionally writes owner fields; creates assignment history, task and notification; and returns conflict counts. Equal/quantity/source/batch/contributor strategies resolve candidates server-side. Reassignment uses separately locked active assignments, requires reason, closes/replaces task ownership as policy dictates, and writes both audit/history.

Consent defaults to `unknown`. Only a verified affirmative consent event with purpose/channel/evidence can set `verified`; opt-out creates suppression and makes the contact ineligible immediately. No endpoint sends marketing messages in this release. Campaign audience queries always require current eligibility and approved status; officers only receive approved campaigns assigned to them.

## 7. Frontend implementation groups

Modify:

- `frontend/src/types/index.ts` — roles and marketing DTOs.
- `frontend/src/context/CrmContext.tsx` — only active navigation/current-user marketing permission exposure; do not load marketing datasets globally.
- `frontend/src/App.tsx` — marketing page mounts and centralized tab authorization.
- `frontend/src/components/layout/Sidebar.tsx` — one expandable role-aware Marketing group, child active states, collapsed/mobile behavior.
- `frontend/src/config/api.ts` — reuse API base/token conventions only if a shared helper is extracted safely.
- `frontend/src/components/layout/ToastContainer.tsx` — restore/replace an accessible reusable feedback surface before relying on success/error notifications.

Add `frontend/src/services/marketingService.ts` plus feature-local components under `frontend/src/components/marketing/`:

- `MarketingDashboardView`, `AddPublicNumbersView`, `MyUploadsView`, `ContactDatabaseView`, `ContactAssignmentView`, `MyMarketingTasksView`, `CampaignContentView`, `MarketingReportsView`.
- Import tabs/wizard, batch-detail view, contact-detail drawer, assignment/reassignment dialogs, campaign editor/asset uploader, report cards/charts, local loading/empty/error state components.

Use feature-local query state and server pagination. Reuse Tailwind, Lucide, existing modal/drawer/table styles, and Recharts. Do not add a router merely for this feature; add distinct `NavTab` values and submenu disclosure state. Tables keep a sticky header and horizontal scrolling at narrow widths. Hide/disable UI actions based on permissions but treat server enforcement as authoritative.

## 8. Phased delivery

### Phase 0 — decisions and platform readiness

Approve role/company policy, retention/deletion policy, consent evidence standard, country defaults, file limits, worker hosting, private storage rules, migration owner, and test database. Establish staging DB and deployment release workflow.

### Phase 1 — foundation and safe schema

Create migration baseline, roles/permissions, marketing models, serial allocator, audit utilities, route dispatcher, feature flag, and test database harness. No UI exposure yet.

### Phase 2 — collection and durable imports

Implement normalization, single/paste/file flows, private upload, batch/row accounting, PostgreSQL worker, retry/reclaim, My Uploads APIs/UI, and status polling. Validate 10,000-row processing in staging.

### Phase 3 — contact operations and consent

Deliver contact database, details/history drawer, scopes, contribution evidence, consent/suppression event APIs and UI, safe export, and dashboard base metrics.

### Phase 4 — assignment and officer workflow

Deliver transactional allocation/reassignment, notifications, officer tasks, follow-ups/notes/progress, conflict UX, and concurrency tests.

### Phase 5 — campaigns and reporting

Deliver private campaign assets, approval/assignment rules, marketing dashboards/reports/exports, reconciliation metrics, and Recharts interfaces.

### Phase 6 — release hardening

Run migration rehearsal and rollback drill, worker restart/recovery test, security review, performance test, CRM regressions, accessibility/responsive QA, documentation, staged production enablement.

## 9. Verification matrix

| Layer | Required verification |
| --- | --- |
| Database | Migration applies to clean/staging DB; FK/index/unique constraints inspected; serial and duplicate races tested concurrently. |
| Import | Single, paste, CSV, XLSX; invalid/mixed/duplicate rows; 10,000 rows; retry/reclaim after worker stop; counters reconcile with rows. |
| Security | Each role and company scope; ID tampering; export restriction; officer-only task visibility; campaign asset authorization; consent/opt-out enforcement. |
| Assignment | Bulk/equal/quantity/source/batch/contributor; concurrent admins; reassignment reason/history; task/notification atomicity. |
| Reporting | Range/timezone boundaries; no duplicate double-counting; dashboards match batch/contact records; role-scoped export. |
| Frontend | TypeScript/build; desktop/mobile sidebar; form keyboard/error states; table overflow; loading/empty states; live API integration. |
| Regression | Existing backend test suite, targeted marketing suite, frontend production build, Leads/Chat/Appointments/Analytics smoke paths. |

## 10. Required decisions/blockers before implementation

1. Approve the selected role extension/mapping, or choose an alternative permission model.
2. Confirm global phone uniqueness despite company scoping and define what limited cross-company duplicate feedback is allowed.
3. Provide worker hosting (separate Render worker or equivalent), PostgreSQL worker connection limits, and a durable deployment/restart policy.
4. Approve a tracked production migration owner/command and supply a non-production PostgreSQL test database; current flat SQL/runtime bootstrap is insufficient.
5. Confirm supported countries/default country, file formats/maximum file size, and consent evidence requirements.
6. Define retention/deletion/export policy, phone masking rules, campaign asset storage/virus-scanning policy, and legal approval owner.
7. Decide whether `marketing_admin` is a new user role or a granular permission assigned to selected existing admins.

No implementation should start on assignment, imports, or campaigns until items 1–4 are resolved.
