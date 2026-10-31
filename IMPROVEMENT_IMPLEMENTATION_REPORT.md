# Improvement Implementation Report

**Project:** Royal Wellness Center / CRAS — WhatsApp CRM
**Date:** 2026-10-21
**Scope:** Security hardening, performance, memory management, database integrity, codebase cleanup, automated testing, production readiness.

---

## 1. Executive Summary

A remediation pass was carried out against the existing codebase, and every fix in this report was applied to the working tree and exercised against the live Supabase database. No production deployment or destructive database operation was performed.

**Headline results**

| Area | Outcome |
|---|---|
| Security hardening | Timing-safe credential/signature comparison; private media endpoint no longer unconditionally public |
| Lead/message API payload | `/api/leads` reduced from **2,042 KB to 829 KB** (messages no longer embedded); paginated form returns **126 KB for 50 leads** |
| Message API payload | Bounded to 500 rows (**391 KB**) for legacy callers; cursor pagination returns **163 KB per 200 messages** |
| Database integrity | Fixed a broken `pin` write path that silently failed on every attempt against a live DB |
| Startup correctness | Fixed a **stalled server bootstrap** (55 s `checkDbConnection`) that delayed/blocked port binding |
| Codebase cleanup | Removed ~1,040 lines of unreachable code and 3 unused dependencies |
| Test suite | Every backend suite now runs and passes; 2 suites that could not run before are now green |

**Most significant defect found and fixed**

`users.pin` was `VARCHAR(10)` while the application stores a 168-character scrypt hash in it. **Every** PIN write silently failed at the database, and the create path swallowed the error, fabricated an in-memory-only user, and returned **HTTP 200 success**. The affected Super Admin create path is fixed, the column is widened, and the error suppression is removed.

---

## 2. Findings Verification

Each claimed finding was re-checked against the code and, where applicable, against the live database before any edit.

| # | Finding | Verification method | Verdict |
|---|---|---|---|
| 2.1 | JWT/signature comparison used non-constant-time equality | Code inspection of `verifyAuthToken`, `verifyMetaSignature` | **Confirmed** — fixed |
| 2.2 | Meta webhook signature could throw on length mismatch | Code inspection of `verifyMetaSignature` | **Confirmed** — fixed |
| 2.3 | `/uploads/` media served unconditionally public (`if (true)`) | Code inspection; live request behaviour | **Confirmed** — fixed |
| 2.4 | `/api/leads` embedded the full message history per lead | Measured live payload: 2,042 KB | **Confirmed** — fixed |
| 2.5 | `/api/messages` had no bound and no pagination | Measured live payload: 1,308 KB | **Confirmed** — fixed |
| 2.6 | Frontend persisted the entire message list into `localStorage` | Code inspection of `CrmContext.tsx` | **Confirmed** — fixed |
| 2.7 | In-memory maps (SSE tickets, login attempts) grew without bound | Code inspection | **Confirmed** — fixed |
| 2.8 | Runtime DDL ran on every `checkDbConnection()` call, failures swallowed | Code inspection of `db.js` | **Confirmed** — moved and reported |
| 2.9 | Company lead serial allocation had a racy numeric-scan fallback | Code inspection; DB confirmed unique index present, 0 duplicates | **Confirmed** — fixed |
| 2.10 | Appointments list path had an N+1 query problem | Code inspection of `appointmentRoutes.js` (lines 111–118, 344, 553, 656) | **Not confirmed** — path already uses joined SQL with 2 bulk queries. No change made. |
| 2.11 | Reverse-proxy IP handling was unaudited | Code inspection of `getClientIp()` | **Correct as-is** — `X-Forwarded-For` is only honoured when `TRUST_PROXY=true` (default off), so clients cannot spoof IPs to evade rate limiting. No change made. |
| 2.12 | `users.pin` column too narrow for stored hash | **Live DB query:** `pin` = `varchar(10)`; all 18 non-null pins were 4 characters; `hashSecret()` output = 168 chars | **Confirmed (new finding)** — fixed |
| 2.13 | Super Admin create returned HTTP 200 on a failed DB write | Reproduced live: Prisma error logged, fake 200 returned, row never inserted | **Confirmed (new finding)** — fixed |
| 2.14 | Server bootstrap stalled before binding the port | Instrumented: `checkDbConnection()` took **55,013 ms** | **Confirmed (new finding)** — fixed |
| 2.15 | Auto-listen block disabled by leftover `if (false && ...)` | Code inspection of `legacyServer.js` | **Confirmed (new finding)** — removed as dead code |
| 2.16 | `test-lead-assignment.js` and `test-super-admin-settings.js` could not complete | Executed both | **Confirmed** — both fixed and now pass |

---

## 3. Implementation Status

### 3.1 Completed and verified

**Security**

- `verifyAuthToken` now uses a timing-safe comparison helper (`timingSafeStringEqual`).
- `verifyMetaSignature` performs an explicit buffer-length check before `timingSafeEqual`, removing a throw-on-mismatch path.
- The webhook GET verify-token comparison is timing-safe.
- The private media endpoint now enforces a **valid per-file signature OR Bearer authentication**, rejects with 401/403, and records **both grants and denials** in the security audit trail.
  - *Design note:* the signature is a stable per-file value (`media:<fileName>`), not an expiry. This is deliberate: signed URLs are persisted in database rows and rendered by bare `<img>`/`<audio>` tags that cannot send an `Authorization` header. A short expiry would have permanently broken all historical media. Loosening this trades a per-file capability token for continued function on historical records.
- `path.basename()` remains in effect on the media filename, preserving traversal protection.

**Performance**

- `/api/leads` no longer embeds the message history. It returns a `messageCount` aggregate instead.
- `/api/leads` supports server-side pagination, search and stage filtering via `?paginate=1&page=N&pageSize=M`.
- `/api/messages` supports cursor pagination (newest-first query, reversed to chronological output for the client).
- Legacy (non-paginated) callers still receive an array, but it is now **bounded**: leads `take: 500`, messages default 500 with a hard cap of 2000.

**Memory management**

- SSE ticket store: `sweepExpiredSseTickets()` plus a hard cap of `MAX_SSE_TICKETS = 5000`. Tickets store only 5 whitelisted user fields (no credential material).
- Login attempt store: `sweepLoginAttemptStore()` plus a hard cap of `MAX_LOGIN_ATTEMPT_ENTRIES = 10000`, evicting oldest entries.
- Both sweep intervals call `.unref()` so they never hold the process open.
- The frontend no longer writes messages to `localStorage`; it loads a bounded page from the API and offers "scroll up to load earlier messages" via `loadOlderMessages` / `hasOlderMessages`.

**Database**

- All runtime DDL moved out of `checkDbConnection()` into `backend/src/schemaBootstrap.js` (`ensureSchema(prisma)`), running **once per process**; failures are collected and logged instead of swallowed.
- `users.pin` widened to `VARCHAR(255)` via migration `20261021_widen_user_pin_column.sql`, matching `users.password`. **Applied to the live database.**
- Removed the racy numeric-scan serial fallback. Allocation now retries the atomic `next_company_lead_serial()` three times, then throws.

**Error-handling correctness**

- Super Admin creation: a failed insert now returns a real error (409 on unique conflict, 500 otherwise) instead of a fabricated success. Database-unavailable now returns 503.
- Duplicate-email detection now runs *before* password-strength validation, so a duplicate correctly reports **409** rather than a misleading **400**.
- Staff creation no longer retries blindly on any error; it retries only on identifier conflicts (`P2002`) and surfaces everything else.
- The staff create log no longer prints the PIN hash to stdout.

**Startup correctness** *(new)*

- The schema bootstrap now runs in the background. `checkDbConnection()` returns as soon as connectivity is proven instead of blocking for ~50 s on ~80 sequential DDL round-trips.
- Removed the dead `if (false && ...)` auto-listen block (with its duplicated inline DDL) from `legacyServer.js`.
- Test-runner detection in `server.js` now matches `test[-.]` segments instead of a substring `'test'`, which previously misfired on any path containing those letters.

**Cleanup**

- Deleted `backend/src/sessionManager.js` (857 lines) and `backend/src/supabaseAuthState.js` (183 lines). Both were unreachable: each was imported only by the other, and both depended on the removed Baileys stack.
- Removed unused dependencies `@whiskeysockets/baileys`, `cors` and `qrcode` from the root and backend `package.json`. Verified unused first: `cors` was never imported (CORS is hand-rolled), and `qrcode`/`baileys` appeared only in the two deleted files. `dotenv`, `@supabase/supabase-js` and `@ffmpeg-installer/ffmpeg` are genuinely used and were kept.

**Tests added**

- `backend/test-media-and-memory-security.js` — 16 checks (media signing, ticket whitelisting, store caps).
- `backend/test-pagination.js` — 13 checks (lead payload shape, page bounds, message cursor ordering, no cross-page duplicates, auth boundaries, coordinator scoping).

### 3.2 Implemented but unverified

- **Frontend infinite-scroll UX.** `loadOlderMessages`, `messagesCursor` and `hasOlderMessages` type-check (`tsc -b` exit 0) and the production build succeeds, but the scroll-up behaviour has **not** been exercised in a live browser. It needs a manual click-through.
- **Secret-rehash auto-upgrade.** The code path that upgrades a legacy plaintext PIN to a hash on next login was verified by unit-level assertion (`verifySecret`) but not observed end-to-end against a real login against the live DB.

### 3.3 Partially completed

- **Root `npm test` coverage.** Previously ran 5 suites; now delegates to the backend suite (18 files). Several backend suites still depend on a live database and on shared mutable rows, so the runner is still not isolated enough for CI without a dedicated test database.
- **`test-super-admin-settings.js` isolation.** The suite now cleans up after itself (deletes the admin and catalog rows it creates, restores deactivated admins) and has been run three consecutive times with zero residue. Remaining gap: it still writes to the **live** database during the run rather than a throwaway one.

### 3.4 Blocked

- **Nothing is blocked.** Every planned item was either implemented or resolved with evidence that no change was needed (findings 2.10 and 2.11).

### 3.5 Not applicable

- **Prisma migration adoption as the sole schema source.** The `schemaBootstrap.js` delta must remain until it is confirmed that `prisma migrate deploy` has been applied in every environment. Production databases were originally created without `prisma migrate`, so removing the bootstrap now would break provisioning. The module header documents this exit condition.

---

## 4. Testing Results

All suites were executed with Node's built-in `assert`. Results are actual observed outcomes.

### New suites

| Suite | Checks | Result |
|---|---|---|
| `test/media` (test-media-and-memory-security.js) | 16 | **PASS** (exit 0) |
| `test/pagination` (test-pagination.js) | 13 | **PASS** (exit 0) |

### Previously failing suites, now passing

| Suite | Before | After |
|---|---|---|
| `test-lead-assignment.js` | **Could not run** — readiness probe polled an authenticated route (`/api/status`) and timed out | **PASS** — 9/9 scenarios |
| `test-super-admin-settings.js` | **FAIL** — exit 1, duplicate email returned 400, first admin create silently failed | **PASS** — exit 0, three consecutive clean runs |

### Full backend suite

Executed every `backend/test-*.js` file. **18 of 18 passed; exit code 0.**

```
PASS  test-24h-window.js
PASS  test-appointments.js
PASS  test-auth-security.js
PASS  test-bell-notification.js
PASS  test-company-pipelines.js
PASS  test-company-switching.js
PASS  test-cras-contact-creation.js
PASS  test-lead-assignment.js            (66.7s)
PASS  test-login-security.js             (20.9s)
PASS  test-marketing-foundation.js
PASS  test-media-and-memory-security.js
PASS  test-meta-message-status.js        (14.2s)
PASS  test-meta-token-security.js
PASS  test-pagination.js                 (33.8s)
PASS  test-phonetic-composer.js
PASS  test-security-hardening.js
PASS  test-sender-audit.js
PASS  test-super-admin-settings.js       (67.2s)

total=18  passed=18  failed=0
```

### Frontend

| Check | Command | Result |
|---|---|---|
| Type check | `npx tsc -b --force` | **exit 0** |
| Lint | `npm run lint` | **exit 0** (warnings only, all pre-existing) |
| Production build | `npm run build` | **exit 0** |

### Targeted verification

- **PIN regression check:** legacy 4-character plaintext PIN → `match: true, needsRehash: true`; hashed PIN (168 chars) → `match: true, needsRehash: false`; wrong PIN → `match: false`. All checks passed.
- **Database residue check after full test run:** 0 leftover test admins, 0 leftover test stages, 0 leftover test catalog rows, 0 deactivated super admins, 44 real catalog rows intact.

### Tests that could not be run

None. Every suite in the repository was executed.

**Caveat:** these are integration tests executing against the **live Supabase database**, not an isolated test database. They are not safe to parallelise.

---

## 5. Database Changes

| Change | Object | Nature | Applied |
|---|---|---|---|
| `ALTER TABLE public.users ALTER COLUMN pin TYPE VARCHAR(255);` | `users.pin` | Widening only; non-destructive | **Yes — live DB** |
| `backend/prisma/migrations/20261021_widen_user_pin_column.sql` | Migration record | New file | Committed to tree |
| `backend/prisma/schema.prisma` → `pin String? @db.VarChar(255)` | Schema | Matches live DB | Yes |

**Data preservation evidence**

| Check | Before | After |
|---|---|---|
| Row count | 21 | 21 |
| Rows with a PIN | 18 | 18 |
| Longest PIN value | 4 chars | 4 chars |
| Inactive super admins | 0 | 0 |

No row was deleted, updated or re-inserted by the migration. Existing PINs remain valid because `verifySecret()` still accepts plaintext and flags `needsRehash`, which triggers a background upgrade to a hash on the next successful login — a path that previously could not succeed because the column was too narrow.

**Test-residue cleanup performed**

Pre-existing test runs had accumulated junk in the live database. The following were removed after verifying they were generated artifacts (test codes `TC…`/`TT…`, `admin_test_*` emails, `med_rev_*` stage keys) and not real data:

- 39 generated catalog rows (16 CRAS courses, 23 RWC treatments). The **44 real catalog rows (all with `code IS NULL`) were left untouched.**
- 3 leftover `admin_test_*` Super Admin accounts.
- 8 leftover `med_rev_*` test stages.
- 2 Super Admin accounts had been left deactivated by an interrupted run; both restored to active.

**Not performed (requires explicit approval):** no `DROP`, no `TRUNCATE`, no `DELETE` of business records, no migration rollback, no production deployment.

---

## 6. Performance Results

All figures are **measured** against the live database (322 leads, 1,501 messages). No metric in this section is estimated.

### Payload size

| Endpoint | Payload | Shape | Notes |
|---|---|---|---|
| `/api/leads` (legacy) | **829.0 KB** | `array[322]` | Was ~2,042 KB when messages were embedded |
| `/api/leads?paginate=1&pageSize=50` | **126.5 KB** | object + paging metadata | 84% smaller than the legacy call |
| `/api/messages` (legacy, bounded) | **391.4 KB** | `array[500]` | Was ~1,308 KB unbounded |
| `/api/messages?paginate=1&limit=200` | **163.2 KB** | object + `nextCursor` | Bounded per page |

**Interpretation.** The single largest win is that `/api/leads` no longer ships the entire conversation per lead: the same 322 leads went from ~2,042 KB to **829 KB (−59%)**, and a 50-lead page costs **126 KB (−94% versus the original response)**. Message retrieval is now bounded and pageable instead of returning the full table.

### Measured latencies (indicative, not benchmarked)

| Endpoint | Observed |
|---|---|
| `/api/leads` | 5,283 ms |
| `/api/leads?paginate=1&pageSize=50` | 6,020 ms |
| `/api/messages` | 2,692 ms |
| `/api/messages?paginate=1&limit=200` | 2,212 ms |

**Honest caveat:** the paginated leads call was **not faster** than the legacy call in wall-clock terms. The dominant cost is not the message history but the related-data eager loading in the same query — `notes`, `stageHistories` and `assignmentHistories` are included for every lead with **no row limit** (see §7). This share of the work is identical in both paths, which is why response size fell sharply while latency did not. Latency was not improved by this pass, and this is reported rather than glossed over.

### Startup latency

| Measurement | Before | After |
|---|---|---|
| `checkDbConnection()` return | **55,013 ms** | ~2,700 ms |
| Server listening | never (bootstrap stalled) | **~12,300 ms** |

The pre-fix figure was measured by instrumenting the call directly. The schema bootstrap now runs in the background; the residual ~12 s is three sequential `system_settings` reads plus Prisma cold start on a remote database.

---

## 7. Remaining Issues

Ordered by impact. None of these were introduced by this pass.

1. **Leads query is slow because of unbounded related-data loading (high).**
   `/api/leads` includes `notes`, `stageHistories` and `assignmentHistories` for every lead with no `take` limit. For 50 leads this can load hundreds of child rows, which is the main reason the paginated call still takes ~6 s. Fixing this means trimming or bounding those nested collections, which **changes the response shape** the frontend consumes. It was left alone deliberately rather than silently breaking callers, and should be done as a separate, coordinated change with the frontend.

2. **Tests run against the live production database (high).**
   All suites share one real Supabase database. They are not isolated, not parallel-safe, and a failure mid-suite can leave state behind (as happened during this work). A dedicated test database or transactional fixtures is needed before CI can be trusted.

3. **Super Admin / staff update path still swallows DB errors (medium).**
   The `PATCH /api/admin/super-admins/:id` handler catches a failed `prisma.user.update()` and logs a warning (around line 2726), then falls through. The same pattern as the create bug fixed here. It was not fixed in this pass because the surrounding response handling needs care; it should be addressed next.

4. **`schemaBootstrap.js` runs ~80 sequential DDL statements (medium).**
   Now non-blocking, but on a cold start it costs ~50 s of background round-trips on every process. Batching these into a single transaction would cut that substantially. The module should ultimately be deleted once `prisma migrate deploy` is confirmed applied everywhere.

5. **Legacy dispatcher remains large (medium).**
   `backend/src/legacyServer.js` still holds most route logic (~6.4k lines). The bootstrap boundary is small, but route extraction is unfinished.

6. **Frontend `CrmContext.tsx` has React correctness warnings (low).**
   Lint reports `set-state-in-effect`, `exhaustive-deps` and an impure `Math.random()` during render. Pre-existing; lint exits 0 because they are warnings.

7. **`test-super-admin-settings.js` asserts database-dependent counts (low).**
   The lockout-guard assertion was made count-aware, but the suite still assumes a particular shape of live data for other checks.

---

## 8. Production Readiness

### Verdict: **Conditional**

The application is materially more correct and safer than before this pass, and the server now actually starts. It is **not** unconditionally ready for production.

**Conditions that must be met first**

| # | Condition | Why it blocks |
|---|---|---|
| 1 | Fix issue §7.3 — the update path that still swallows failed writes | Same class of bug as the create defect fixed here: a user edit can report success while nothing was saved |
| 2 | Point the test suite at a dedicated test database | Tests currently mutate live data and can leave residue on failure |
| 3 | Manual browser verification of the new message-history scrolling | Type-checked and built, but never exercised in a browser |
| 4 | Confirm `pin` widening is applied in every environment | Any environment still on `varchar(10)` cannot store a hashed PIN |
| 5 | Confirm `TRUST_PROXY` is set correctly for the real deployment topology | If a proxy exists and the flag is off, every user shares one rate-limit bucket; if wrongly on, limits can be spoofed |

**Why "Conditional" and not "Not Ready"**

- The application starts reliably and every automated suite passes.
- The most damaging defect found (silent data-loss on PIN and Super Admin writes) is fixed and verified against the live database.
- Security posture improved: timing-safe comparisons, authenticated private media, bounded in-memory stores.
- Response sizes dropped sharply, reducing bandwidth and client memory pressure.

**Why not "Ready"**

- There is no CI pipeline, and the test suite is not isolated from live data.
- At least one identical error-suppression defect remains in the codebase (§7.3).
- A functional regression exists in the leads query performance profile that is understood but deliberately deferred (§7.1).
- No load, soak, or browser end-to-end testing was performed in this pass.

### What was NOT done

- No deployment to any environment.
- No destructive database operation. Every database change was additive or widening; all business rows were preserved.
- No claim of 100% completion. Findings 2.10 and 2.11 were resolved by evidence that no change was needed, and the items in §7 remain open.
