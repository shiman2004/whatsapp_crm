# User Management & Security — Delivery Record

Project: Alpha Health Group WhatsApp CRM (repo `whatsapp_crm`, branch work uncommitted on top of `255350e`)
Date: 2026-10-29

This module was built **on top of** the existing CRM. No route, table, model or workflow was replaced.
Legacy Staff Management and Admin Accounts now live inside **User Management**; the old URLs still work.

---

## 1. Architecture

```
Browser (hash router)                     Backend (node, port 3000)
──────────────────────                    ─────────────────────────
#/staff/…    → UserManagementView  ──▶   /api/user-management/*   ─┐
#/security/… → SecurityAccessView  ──▶   /api/security/*         ─┤ legacyServer.js
#/<legacy>   → alias/prefix remap                            ────┘  dispatches both handlers
```

**Every request goes through the same authority chain** (`backend/src/legacyServer.js`):

1. HMAC-SHA256 bearer token verified (no unsigned/forged payload accepted).
2. Token carries `userId, role, sid, sv`. The account is **re-read from the database on every request**; the DB role wins over the token role.
3. Reject when: account missing, `active = false` (set by both deactivate and suspend), `locked_until > now()`, token `sv` ≠ `users.session_version`, or the `sid` row in `user_sessions` is revoked/absent.
4. `handleSecurityRoutes` (existing) resolves role defaults + per-user overrides through `securityPolicy.js` / `securityStore.js` and enforces the capability + scope.
5. Module handlers re-check tenant (company), branch and assignment ownership for the specific record.
6. Sensitive operations write an audit row through `securityAudit.js` (redacted, append-only).

**Owning modules for the new screens**

| Concern | File |
| --- | --- |
| User Management API | `backend/src/userManagementRoutes.js` |
| Security API (existing, reused) | `backend/src/securityRoutes.js` |
| Policy registry (existing, reused) | `backend/src/securityPolicy.js` |
| Profile/audit store (existing, reused) | `backend/src/securityStore.js`, `securityAudit.js` |
| Secret hashing | `backend/src/secretHash.js` |
| Additive DDL applied at boot | `backend/src/schemaBootstrap.js` |
| Versioned migration | `backend/prisma/migrations/20261031_user_management_security.sql` |

Server-side authorization is the only authority. The sidebar and the `currentUser.role` checks in React are UX only; hiding a menu item never grants or removes access.

---

## 2. Files

### New — backend
- `backend/src/userManagementRoutes.js` — overview, directory, CSV, create/edit, lifecycle, credentials, session revoke, invitations, departments/teams/members, assignments, sessions.
- `backend/src/secretHash.js` — scrypt hash/verify (extracted from `legacyServer.js`, which still re-exports `hashSecret`/`verifySecret` so existing imports keep working).
- `backend/prisma/migrations/20261031_user_management_security.sql` — expand-only DDL + append-only audit trigger.
- `backend/test-user-management.js` — 57 assertions covering authorization, validation, lifecycle, invitations, reassignment and audit.

### Changed — backend
- `backend/src/legacyServer.js` — session/version checks, DB re-read per request, `user_sessions` on login, generic auth failures, invitation preview/accept endpoints, user-management dispatch, immutable audit wiring.
- `backend/src/schemaBootstrap.js` — same additive DDL as the migration, applied idempotently at startup.
- `backend/prisma/schema.prisma` — new columns and `Department`, `Team`, `TeamMember`, `UserInvitation`, `UserSession` models (`npx prisma validate` passes).
- `backend/scripts/run-tests.js` — registers `test-user-management.js`.
- `backend/test-security-permissions.js` — audit-fixture cleanup dropped: the trail is now immutable by design.

### New — frontend
- `frontend/src/config/navigation.ts` — five-section sidebar, children, visibility rules, legacy aliases.
- `frontend/src/hooks/useHashRoute.ts` — hash path source of truth.
- `frontend/src/components/layout/AppShell.tsx`, `Breadcrumbs.tsx`, `CommandPalette.tsx`, `NotificationCenter.tsx` — shell used by both new modules.
- `frontend/src/components/ui/index.tsx` — shared primitives (`PageHeader`, `SectionCard`, `StatCard`, `ConfirmDialog`, `FormDrawer`, states).
- `frontend/src/components/admin/user-management/` — `UserManagementView.tsx`, `DirectoryTab.tsx`, `CreateUserTab.tsx`, `TeamsTab.tsx`, `AssignmentsTab.tsx`, `InvitationsTab.tsx`, `UserDetailDrawer.tsx`, `api.ts`, `bits.tsx`.
- `frontend/src/components/admin/security/SessionsTab.tsx` — Login & Session Activity.

### Changed — frontend
- `frontend/src/App.tsx` — lazy registration, `user-management` route, removed `CoordinatorsManager` import.
- `frontend/src/components/admin/SecurityAccessView.tsx` — six tabs + hash/intent routing + legacy id map.
- `frontend/src/components/admin/security/OverviewTab.tsx`, `api.ts`, `bits.tsx` — navigation to the new tabs, session types.
- `frontend/src/context/CrmContext.tsx` — exposes `notify`; passes the auth token reader to both module clients.
- `frontend/src/components/layout/Sidebar.tsx`, `Header.tsx`, `frontend/index.html`, `frontend/src/index.css`, `frontend/tailwind.config.js` — tokens: sidebar `#101B2A`, accent `#0D9488`, page `#F8FAFC`, card `#FFFFFF`, heading `#0F172A`, secondary `#64748B`, border `#E2E8F0`, status colours, Inter, Lucide, light/dark.
- `frontend/src/components/dashboard/DashboardOverview.tsx` — fixed pre-existing `changedAt` → `createdAt` type error.

---

## 3. Database

Expand-only. **No drop, truncate, backfill or row rewrite.**

| Object | Change |
| --- | --- |
| `users` | `+ employee_id, department_id, manager_id, suspended_at, locked_until, last_login_at, session_version`; unique index on `employee_id` |
| `departments` | new (company/branch scoped) |
| `teams` | new (department, lead) |
| `team_members` | new (team_id, user_id) |
| `user_invitations` | new — stores **only** the token hash, single-use, 7-day expiry |
| `user_sessions` | new — `sid` recorded at login, revoked by id |
| `security_audit_events` | existing; + indexes; **+ `security_audit_events_no_rewrite` trigger** (BEFORE UPDATE OR DELETE → raise) |
| FKs | additive, `IF NOT EXISTS` guarded |

No identity duplication: existing `users` rows remain the only accounts. Staff and Admin Accounts were consolidated onto them, not copied.

### Approval status

The DDL is **additive and already applies automatically** on backend start (`schemaBootstrap.js`), and did so in this environment. `prisma db push` was **not** run and must not be.

**Exact approval requested from the DB owner:**
> Approve applying `backend/prisma/migrations/20261031_user_management_security.sql` to the production Supabase database. It adds 7 nullable/defaulted columns, 5 tables, 7 indexes, 5 foreign keys and 1 trigger. It deletes or rewrites no data. The same statements are re-run idempotently on every backend start, so this approval also covers future deploys.

If approval is withheld, the new modules cannot function (the tables and trigger are required).

---

## 4. API

All `/api/user-management/*` routes are gated to an active Super Admin at the route entry; every write also re-checks the target record's tenant/branch. Responses: `{ success, data }` or `{ success:false, error:{ code, message, correlationId } }`; 401 unauthenticated, 403 unauthorized, 404 not found, 422/400 validation. Paging is `page`/`pageSize` (max 100), sorting is allow-listed, all SQL is parameterised.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/user-management/overview` | KPI counters + distribution (accounts, roles, companies, branches) |
| GET | `/api/user-management/users` | Directory: `search, role, company, branch, departmentId, status, sort, order, page, pageSize` |
| GET | `/api/user-management/users/export.csv` | CSV export, same filters, capped at 5 000 rows, audited |
| POST | `/api/user-management/users` | Create account (password ≥ 12 chars, unique email/employee id, department check) |
| GET | `/api/user-management/users/:id` | Detail: profile, teams, invitation, sessions, activity, assignments |
| PATCH | `/api/user-management/users/:id` | Edit profile/role/scope (self-escalation refused) |
| POST | `/api/user-management/users/:id/status` | activate / deactivate / suspend / unlock |
| POST | `/api/user-management/users/:id/credentials` | Reset password/PIN (bumps `session_version`) |
| POST | `/api/user-management/users/:id/revoke-sessions` | Revoke every session |
| GET/POST | `/api/user-management/invitations` | List / create single-use invitation |
| POST | `/api/user-management/invitations/:id/resend` | Rotate hash, extend 7 days |
| DELETE | `/api/user-management/invitations/:id` | Revoke |
| GET/POST | `/api/user-management/departments` | List / create |
| PATCH | `/api/user-management/departments/:id` | Rename / deactivate |
| POST | `/api/user-management/teams` | Create team |
| PUT | `/api/user-management/teams/:id` | Edit team |
| PUT | `/api/user-management/teams/:id/members` | Replace membership |
| GET | `/api/user-management/assignments` | Unified lead/contact ownership view |
| GET | `/api/user-management/assignments/history` | Reassignment history |
| POST | `/api/user-management/assignments/reassign` | Reassign, refuses cross-tenant/cross-staff scope |
| GET | `/api/user-management/sessions` | Session activity: `state, search, userId, page` |
| DELETE | `/api/user-management/sessions/:id` | Revoke one session |

Public (no auth, hash-only): `GET /api/auth/invitation?token=…` (preview) and `POST /api/auth/accept-invitation` (activate).

Security module reuses the existing, unchanged endpoints: `GET /api/security/overview`, `GET /api/security/roles`, `GET|PATCH /api/security/roles/:role/permissions`, `GET /api/security/users`, `GET|PATCH /api/security/users/:id/permissions`, `DELETE /api/security/users/:id/overrides`, `POST /api/security/permissions/preview`, `GET /api/security/audit-logs`.

---

## 5. Sidebar & deep links

`OPERATIONS & WORKSPACE` Dashboard · Live WhatsApp · Leads Pipeline · Appointment Room · Team Broadcast
`CLINICAL & ACADEMIC` Patient Assessment & Reports · Exam Department
`MARKETING & OUTREACH` Public Contact Marketing · Templates & Nurture
`MANAGEMENT & ANALYTICS` Analytics · Treatments
`SYSTEM & SECURITY` User Management · Security & Access · System Settings · Audit Trail · Webhook Sandbox · API Specs

Children: User Management → User Directory, Create User, Teams & Departments, User Assignments, Pending Invitations, Deactivated Accounts. Security & Access → Security Overview, Roles & Permissions, Permission Matrix, Access Policies, Login & Session Activity, Security Events.

Legacy URLs (verified in the browser): `/staff`, `/coordinators`, `/user-management/*`, `/settings/admins` → User Management; `/security-access`, `/security-access/roles` → Security & Access. Existing module ids (`coordinators`, `security-access`) are kept so stored state and in-app links still resolve.

---

## 6. Implemented features

**User Management** — real KPIs from SQL; directory with server search/filter/sort/paging, column visibility, detail drawer, bulk activate/deactivate/suspend (each checked server-side), CSV export; create/edit with validation; lifecycle (activate, deactivate, suspend, unlock, invite, resend, revoke, reset credential, revoke sessions); departments and teams with membership; unified lead/contact assignment view + history with scope-safe reassignment; pending invitations with one-time link display, rotate, revoke; deactivated accounts view; confirmation dialogs before every destructive action; toasts on real outcomes.

**Security & Access** — overview from live counts; role registry editing with the existing immutable Super Admin policy; permission matrix with real save/reset endpoints (no fake toggles); per-user overrides and preview-as-user; login/session activity with per-session revocation; security events with filters and pagination.

---

## 7. Security findings and resolutions

| Finding | Resolution |
| --- | --- |
| Token role could be forged to `super_admin` | DB role re-read on every request and always wins; covered by the forged-token test |
| Deactivated/suspended users kept valid tokens | `active` (cleared by deactivate and suspend), `locked_until`, session version and session id are checked per request; sessions are revoked on deactivation |
| Revoked sessions still worked | `sid` + `sv` claims, `user_sessions` row checked, `session_version` bump invalidates every issued token |
| Weak/default JWT secret | `runtimeConfig.js` fails closed outside `NODE_ENV=test` for short/placeholder secrets |
| Plaintext PINs/passwords | scrypt hashing with per-secret salt and constant-time compare; transparent rehash migration |
| Client-chosen user id / hidden API access | Identity comes only from the verified token; all 9 user-management routes return 403 for non-admins, including when the route is never linked in the UI |
| Self-privilege escalation / self-lockout | Refused explicitly (403) and audited |
| Cross-tenant or cross-staff reassignment | Refused (403) before any write |
| Audit trail rewritable | API is INSERT-only, sensitive keys redacted, and a DB trigger now rejects UPDATE/DELETE |
| Login lockout state disclosed | Identical generic 401 for wrong credential, unknown account, disabled and locked accounts |
| Invitation token theft from DB | Only the SHA-256 hash is stored; single use; 7-day expiry; replay returns 404 |

---

## 8. Test evidence

Commands run on 2026-10-29 against `localhost:5432/crm_test` (backend), Playwright-free suite runner:

```
cd backend && node scripts/run-tests.js          → 24/26 suites passed
cd backend && node scripts/run-tests.js test-user-management.js test-auth-security.js \
   test-security-hardening.js test-security-permissions.js test-login-security.js  → 5/5 passed
```

New suite `test-user-management.js` — PASS (13.9 s, 57 assertions):
route 403s for non-admins · forged super-admin token has no effect · directory filters/sort/paging/unsafe input · CSV export · create validation · employee-id uniqueness · real creation · self-elevation and self-lockout refusal · session revocation + deactivation · cross-tenant/cross-staff reassignment refusal · invitation create/preview/accept/replay-404/hash-not-stored · audit rows present.

Existing suites re-verified: `test-auth-security`, `test-security-hardening`, `test-security-permissions`, `test-login-security`, `test-super-admin-settings`, `test-consent-governance`, `test-lead-assignment`, `test-24h-window`, `test-company-switching`, `test-company-pipelines`, `test-marketing-*`, `test-pagination`, `test-message-cursor`, `test-e2e-workflow-matrix`, `test-exam-academic-drafts`, `test-permission-resolution` — all PASS.

Two suites fail for reasons that pre-date this work (both reproduce on a clean checkout):

- `test-media-and-memory-security.js` — asserts SSE tickets are single-use, while `legacyServer.js` deliberately allows reuse during the 15-minute TTL so `EventSource` can reconnect. Open design conflict; left untouched to avoid changing live WhatsApp streaming behaviour.
- `test-appointments.js` — hardcodes `2026-10-25` slots, which are in the past today, so the "do not delete a room with an upcoming appointment" guard correctly allows deletion and the test expects 400.

**UI verification (browser, admin token):** five sidebar sections with all required children; all six User Management tabs and all six Security tabs render real API data (17 accounts, 12 roles, live admin session row, audit events); dark mode (`html.dark`, page `rgb(17,27,33)`, card `rgb(32,44,51)`); 390×844 mobile drawer opens, navigates and closes; keyboard `Tab` produces a 2px focus ring; legacy deep links `/staff`, `/coordinators`, `/settings/admins`, `/security-access/roles` all resolve to the right screens.

**Build/type evidence:** `npx tsc -b` clean; `npm run build` succeeds (User Management 69 kB, Security & Access 114 kB lazily split); `npm run lint` exits 0 with pre-existing warnings only.

---

## 9. Limitations (deliberate, documented)

1. **Scope vocabulary** stays `own | assigned | department | all` — the values the server already enforces. Branch/company/global are enforced by tenant and branch checks around that scope, not as separate scope names.
2. **No email/SMS delivery** for invitations: the one-time link is displayed once and must be shared through a secure channel.
3. **No automatic pruning** of `user_sessions` / `user_invitations`; a scheduled cleanup job is advisable before volume grows.
4. **Audit immutability is trigger-based, not cryptographic**: no hash chain, so a database superuser could drop the trigger. Ship the audit stream to external storage if regulatory proof is required.
5. **CSV export caps at 5 000 rows** per request (`shortcut: cap avoids multi-MB responses, raise or stream when the directory exceeds it`).
6. **Branding mismatch**: the brief says Alpha Health Group, existing credentials/data still use Royal Wellness names (`admin@royalwellness.lk`, `RWC`). Not renamed to avoid breaking accounts.
7. **Invitation endpoints are not IP-throttled** (only login is). Tokens are 256-bit random and hash-stored, so guessing is infeasible, but add gateway throttling on `GET /api/auth/invitation` and `POST /api/auth/accept-invitation` if abuse appears.
8. `graphify-out/` is untracked generated output, unrelated to this change.

---

## 10. Deployment steps

1. Human approval for the additive DDL (§3) — required before the next backend deploy.
2. Deploy backend; `schemaBootstrap` applies columns/tables/indexes/trigger idempotently. Confirm the boot log has no `[Schema] ... did not apply` lines.
3. Verify: `SELECT tgname FROM pg_trigger WHERE tgrelid='public.security_audit_events'::regclass AND NOT tgisinternal;` → `security_audit_events_no_rewrite`.
4. Deploy frontend; the previous bundle keeps working with old URLs.
5. Smoke test as Super Admin: open `#/staff/directory`, create a throwaway user, deactivate it, confirm it disappears from active and appears under Deactivated Accounts, then sign in as that user and confirm 403 on every user-management route.
6. Confirm non-admin accounts see neither the sidebar entries nor the modules (both are server-gated regardless).
7. Rotate `JWT_SECRET` only through the normal secret process — it invalidates all sessions.
