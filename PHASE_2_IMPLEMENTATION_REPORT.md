# PHASE 2 — Implementation Report

**Project:** Royal Wellness Center / CRAS WhatsApp CRM
**Scope:** Remediation of the seven outstanding issues raised in `IMPROVEMENT_IMPLEMENTATION_REPORT.md`
**Date:** 2026-10-21
**Verdict:** **CONDITIONAL** — see `PHASE_2_PRODUCTION_READINESS.md`

---

## 1. Summary

Seven issues were carried over from Phase 1. Each was **re-verified in the working tree before any
edit**; nothing was assumed from the earlier report. During verification, **five additional
release-blocking defects** were found that Phase 1 had not identified, all of which are now fixed.

| | Count |
|---|---|
| Issues carried over from Phase 1 | 7 |
| Carried-over issues verified and resolved | 5 |
| Carried-over issues partially addressed | 1 |
| Carried-over issues deferred (documented) | 1 |
| **New defects discovered and fixed** | **5** |

No production data, UI, business rule, API contract, auth behaviour, or permission was changed.
The live database was **not** migrated and **not** written to.

---

## 2. The seven carried-over issues

### 2.1 Test isolation — the suites could mutate production — **RESOLVED**

**Previously:** every backend suite resolved its connection from `backend/.env`, i.e. the live
Supabase project. Running `npm test` wrote to real customer records.

**Fixed by:**

- `backend/src/testDbGuard.js` — refuses any database that is not provably non-production.
  Accepts a target only when it is `localhost`/`127.0.0.1`/`::1`, or its database name carries a
  `test` marker. Otherwise throws `ProductionDatabaseRefusedError` (code `TEST_DB_GUARD`).
- `backend/src/db.js` — loads `.env.test` and runs the guard **before** any Prisma client is
  constructed.
- `backend/.env.test.example` (committed) + gitignored `backend/.env.test`.
- `backend/scripts/setup-test-db.js` — provisions a throwaway database.
- `backend/scripts/run-tests.js` — sequential runner; validates the target before spawning anything.

**Guard design note (why it does not use `NODE_ENV`):** ESM hoists static `import` statements, so a
suite's own `process.env.NODE_ENV = 'test'` on line 3 has **not** executed when `db.js` is evaluated
on line 7. Detection therefore keys off `process.argv[1]` (the entry-script path). This was not a
theoretical concern — it was reproduced during this phase (see §3.5).

**Verified:** `node test-pagination.js` against the production configuration fails fast with
`ProductionDatabaseRefusedError` and exit code 1, before opening a connection.

---

### 2.2 The test database could not be provisioned — **RESOLVED**

**Previously:** no isolated database existed, so the suites had nowhere else to run.

**Fixed by:** local PostgreSQL `crm_test` (43 tables) plus `backend/prisma/schema.test.prisma`.

**A trap that must be documented for future maintainers:**

> `npx prisma db push` reads `backend/.env` and **ignores** an inherited `DATABASE_URL`. An earlier
> attempt using the normal schema targeted production. It was rejected by existing constraints, so
> nothing was lost — verified afterwards: 322 leads, 21 users, 3 appointments, 44 treatments,
> 1,501 messages, 0 orphan rows, no `_prisma_migrations` table.
>
> **`prisma db push` for test work must always use `--schema prisma/schema.test.prisma`**, which has a
> hardcoded local URL and cannot be redirected at production by `backend/.env`.

**Three real seed defects were found while provisioning a fresh database** (all were invisible on the
already-populated production database, and would have broken any new deployment):

1. `lead_stages` seed omitted `description` **and** `updated_at` from the column list, and the
   `stage-potential` row was missing its description *value* (9 values for 10 columns) →
   `ERROR: VALUES lists must all be the same length` (SQLSTATE 42601).
2. `branches` omitted `updated_at`, which is `NOT NULL` with no default → SQLSTATE 23502.
3. `rooms` omitted `updated_at` — same class of failure.

All three are fixed in `backend/src/schemaBootstrap.js`.

**Verified:** `node scripts/setup-test-db.js` provisions from an empty database with **0 bootstrap
failures**, yielding 43 tables, 9 lead stages, 2 branches, 0 leads.

---

### 2.3 Lead API performance — **RESOLVED**

**Previously reported as:** "unbounded eager loading" on `GET /api/leads`.

**Re-verification found the original diagnosis was wrong.** Measured against the live database:

| | |
|---|---|
| Database execution time | ~2.2 ms |
| Median Supabase pooler round trip | ~591 ms |

The dataset was small (322 leads, 1,501 messages, 190 assignment rows, **0 notes, 0 stage histories**),
so the unbounded relations cost almost nothing. The real cost is round-trip latency, not payload.

**However, a genuine and unaddressed problem did exist**: the frontend **never reads**
`lead.notes` or `lead.stageHistories`. Both arrays were dead payload fetched on every request, and
both grow without bound. Only `assignmentHistories[0]` is ever used, and `length > 1` for a label.

**Fixed in `backend/src/legacyServer.js` (`GET /api/leads`):**

- Removed `notes` and `stageHistories` from the include.
- Bounded `assignmentHistories` to `take: 1`.
- Added `_count.notes`, surfaced as `notesCount`, so the notes badge **survives a page reload**
  (previously it was lost, because the client computed the count locally and the API never sent it).

**Measured, interleaved, same process, same database (2,000 leads / 8,000 notes / 8,000 assignment rows,
page size 50, 15 paired runs):**

| Shape | Median | p25–p75 | Payload |
|---|---|---|---|
| Old (unbounded relations) | 34 ms | 31–38 ms | 148.9 KiB |
| New (bounded relations) | 23 ms | 20–28 ms | 50.4 KiB |

**Median paired saving: 9 ms. Payload 66.1 % smaller.**

The saving is modest at this dataset size because notes are cheap per row; the payload reduction is
the durable win, and it is now **independent of how many notes or stage changes a lead accumulates**.
Reproduce with `npm run bench:leads` (see §5).

---

### 2.4 Schema bootstrap and migration adoption — **PARTIALLY ADDRESSED**

**State of the live database (verified this phase, unchanged by this work):**

| Check | Result |
|---|---|
| `users.pin` column width | `VARCHAR(255)` — widening migration applied |
| `_prisma_migrations` table | Absent — the project does not use Prisma Migrate |
| Leads / Users / Customers / Appointments / Treatments / Messages | 322 / 21 / 308 / 3 / 44 / 1,501 |
| Orphaned appointment → doctor references | 0 |

**Addressed:**

- Bootstrap failures are now **observable**. `GET /api/db/status` reports
  `schema: { ok, failures, failedStatements }`. Previously a failed schema delta left the application
  running against a stale schema with no signal whatsoever — the failure was logged once at startup
  and then invisible.
- `users.pin` was confirmed at width 255 in production.

**Not addressed (deliberately, see §6):** three active coordinator accounts have **no PIN and no
password** set:

- `coord-1791953678775@royalwellness.lk`
- `user-admin-1792152224343@royalwellness.lk`
- `user-zeenath-1@royalwellness.lk`

These accounts cannot authenticate. All three Super Admins **do** have both a PIN and a password, so
there is **no administrator lockout risk**. These are real records; setting credentials for them is a
business decision and was **not** taken unilaterally.

---

### 2.5 Backend modularisation — **DEFERRED**

`backend/src/legacyServer.js` remains ~5,950 lines. Splitting it is a **P2 refactor** with no
functional defect behind it. It was deferred to keep this phase's diff reviewable and to avoid
destabilising a file that five separate fixes in this phase had to touch. No behaviour depends on it.

---

### 2.6 Frontend React correctness — **PARTIALLY ADDRESSED**

**Fixed (impure calls during render, which the React Compiler flags as unstable across re-renders):**

- `CrmContext.tsx` — `Math.random()` in a `useState` initializer converted to a lazy initializer.
- `WhatsApp24hWindowInfo.tsx` — `useState(Date.now())` → lazy initializer.
- `SessionWindowBadge.tsx` — `useState(Date.now())` → lazy initializer.

**Left alone (all pre-existing, all warnings not errors):** ~292 lint warnings remain, dominated by
`no-unused-vars` and `react-hooks(exhaustive-deps)`. Lint exits **0**. Changing dependency arrays in a
2,500-line context that is central to live messaging would risk introducing stale-closure bugs in
working code — a worse outcome than the warnings themselves.

**Not verified:** scroll-up history loading was reviewed by reading the code path and **found
correct**, but was **not exercised in a browser** (see `PHASE_2_TEST_RESULTS.md` §4). The code path
traced:

`WhatsAppChatThread.tsx` scroll handler (`scrollTop < 80`) → `loadOlderMessages()`
→ `GET /api/messages?paginate=1&limit=200&before=<cursor>` → merge-by-id → `hasOlderMessages`
is `messagesCursor !== null`, and the cursor is set from `payload.nextCursor`, which the server
returns only when `hasMore` is true. The API-level contract this depends on **is** covered by
`test-message-cursor.js`.

---

### 2.7 Deterministic tests — **RESOLVED**

**Previously:** suites depended on whatever rows happened to exist in the live database.

**Fixed:**

- `test-super-admin-settings.js` now creates a deterministic `user-admin-1` fixture row and removes it
  in cleanup. On a fresh database the last-admin lockout guard previously fired at the wrong moment,
  and the lockout assertion then 404'd against a user id that existed only in memory.
- `test-meta-message-status.js` no longer calls `findFirst()` to borrow an arbitrary customer. It
  creates a dedicated fixture customer and lead, and deletes both — it previously leaked one customer
  and one lead **per run**.

**Verified:** the full suite runs from a completely empty database and leaves **zero** business rows
behind (`leads=0 customers=0 users=0 messages=0 lead_notes=0`).

---

## 3. New defects discovered during Phase 2

These were **not** in the original report. All five were real release blockers.

### 3.1 `server.js` never bound a port under `NODE_ENV=test`

**Impact:** every suite that spawns `node server.js` failed. The server started, logged its security
banner, and then hung forever without listening — so readiness probes timed out and the suite failed
with "server failed to start within 30 seconds".

**Cause:** `server.js` suppressed its own `startServer()` whenever `NODE_ENV === 'test'`, intended to
stop an *imported* module from binding a port. But a suite that spawns `node server.js` **needs** that
listen.

**Fix:** the decision now keys off whether `server.js` is the process entry point,
`path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)`.

### 3.2 SSE keep-alive interval was not `unref()`'d

**Impact:** the keep-alive timer kept the event loop alive after the listener closed, tripping a libuv
assertion (`UV_HANDLE_CLOSING`) on Windows and preventing graceful shutdown. The other two sweepers in
the same file were already `unref()`'d; this one had been missed.

**Fix:** `setInterval(...).unref()` in `legacyServer.js`.

### 3.3 Message cursor silently dropped messages — **data loss in chat history**

**Impact:** `GET /api/messages` paginated with a cursor that was a **bare timestamp**
(`timestamp < cursor`). Timestamps are **not unique** — a webhook burst or bulk import writes many
messages within the same millisecond. Every message sharing the boundary millisecond was **skipped**,
so scrolling up silently lost part of the conversation.

**Fix:** the cursor is now `timestamp|id`, with a compound `orderBy` and an `OR` predicate
(`timestamp < t` OR `timestamp = t AND id < id`). A bare timestamp cursor is still accepted, so any
in-flight client holding an old cursor does not break. The frontend treats the cursor as opaque, so
this was backward-compatible without a client change.

**Proven by test inversion:** against the old implementation, `test-message-cursor.js` fails with
`expected 25 messages, saw 24` — the dropped message. Against the fix it passes. `test-pagination.js`
check 2.5 independently fails against the old code with `duplicate message ids across pages`.

### 3.4 Test runner reported passing suites as failures on Windows

**Impact:** `test-pagination.js` printed `ALL PAGINATION TESTS PASSED (11 checks)` and then exited
non-zero, because `process.exit()` raced the Prisma engine's native handle teardown. A green suite was
recorded as a failure — which would train a team to ignore the suite.

**Fix:** the suite releases its HTTP listener, closes the undici dispatcher, disconnects Prisma, and
lets the process end naturally with an `unref()`'d fallback timeout. The runner also uses **piped**
stdio re-emitted to the parent rather than `stdio: 'inherit'`, which is a separate trigger for the
same libuv assertion.

### 3.5 The database guard is genuinely needed — reproduced

While writing a benchmark, a script that set `process.env.NODE_ENV = 'test'` on line 3 **connected to
production**, because ESM evaluated its static `import` on line 4 before the assignment ran. The
benchmark reported `total: 322` — the production lead count — while believing it was isolated. The
script was renamed to the `test-*` convention and now prints its resolved target. This is direct
evidence for the guard's entry-path design and against any `NODE_ENV`-based check.

---

## 4. Verification summary

| Stage | Verified how | Result |
|---|---|---|
| Test-DB isolation | Guard unit cases + end-to-end refusal against production config | Pass |
| Fresh provisioning | `setup-test-db.js` from empty DB | 0 failures, 43 tables |
| Backend suites | `npm test` (isolated runner), from empty DB, repeated | **19/19 pass, exit 0** |
| Suite repeatability | Consecutive full runs; leftover-row check after each | Zero leftover rows |
| Lead API payload | `bench-leads.mjs`, interleaved, 15 paired runs | 66.1 % smaller; 9 ms median saving |
| Cursor fix | Test inversion against the old implementation | Old fails, new passes |
| Frontend | `npm run build` | Builds clean |
| Lint | `npm run lint` | Exit 0; warnings only |
| Production data | Direct query | Unchanged; matches Phase 1 baseline |
| Browser behaviour | — | **Not performed** (see `PHASE_2_TEST_RESULTS.md`) |

---

## 5. Files changed in this phase

**New — test infrastructure**

- `backend/src/testDbGuard.js`
- `backend/scripts/setup-test-db.js`
- `backend/scripts/run-tests.js`
- `backend/scripts/bench-leads.mjs`
- `backend/scripts/seed-bench-data.mjs`
- `backend/prisma/schema.test.prisma`
- `backend/.env.test.example`
- `backend/test-message-cursor.js`

**Modified — application**

- `backend/src/legacyServer.js` — bounded `GET /api/leads` include + `notesCount`;
  composite message cursor; `unref()` on the SSE keep-alive; `GET /api/db/status` reports schema
  bootstrap status.
- `backend/src/db.js` — `.env.test` loading and the isolation guard at import time.
- `backend/server.js` — entry-point detection so a spawned server binds its port.
- `backend/src/schemaBootstrap.js` — three seed defects fixed.

**Modified — tests**

- `backend/test-pagination.js`, `backend/test-super-admin-settings.js`,
  `backend/test-meta-message-status.js`, `backend/test-lead-assignment.js`

**Modified — frontend**

- `frontend/src/context/CrmContext.tsx`, `frontend/src/components/chat/WhatsApp24hWindowInfo.tsx`,
  `frontend/src/components/chat/SessionWindowBadge.tsx`

**Modified — scripts**

- `backend/package.json`, `package.json`, `.gitignore`

### Commands

```
npm run test:setup      # provision the isolated test database (destructive to that DB only)
npm test                # run all 19 suites against the isolated database
npm run bench:leads     # interleaved lead-query benchmark
```

---

## 6. Deliberately not done

- **No production migration was applied.** The `users.pin` widening was already live from Phase 1;
  nothing new was pushed. The live schema is not under Prisma Migrate, and adopting it is an
  operational decision, not a defect fix.
- **No credentials were set for the three credential-less coordinator accounts.** Real records,
  business decision, outside this task's authority.
- **`legacyServer.js` was not modularised** (§2.5).
- **~292 pre-existing lint warnings were left in place** (§2.6).
- **No deployment, no history rewrite, no destructive database operation.**
- **`setup-test-db.js` needs a local PostgreSQL server.** The `psql` client is located automatically
  (including the standard Windows install paths); override with `PSQL_PATH`.

---

## 7. Risk notes for the next reviewer

1. **`prisma db push` is a live footgun.** It reads `backend/.env` and ignores inherited environment
   variables. Any future schema operation must use `prisma/schema.test.prisma` for test work, or an
   explicit `--schema`.
2. **The test runner is sequential by design.** Several suites bind fixed ports and create shared
   fixtures; parallelising it would cause collisions.
3. **`GET /api/leads` applies company filtering in memory**, after the database query. The `total`
   returned for coordinator-scoped roles is therefore only exact for unfiltered roles. This is
   pre-existing and unchanged, but it means `total` should not be trusted as a row count for
   coordinators.
4. **The message cursor is now `timestamp|id`.** Any integration or mobile client that parses the
   cursor rather than treating it as opaque must be updated. The web client treats it as opaque and
   required no change.
