# PHASE 2 — Test Results

**Project:** Royal Wellness Center / CRAS WhatsApp CRM
**Date:** 2026-10-21
**Test database:** `localhost:5432/crm_test` (isolated; enforced by `backend/src/testDbGuard.js`)
**Production database:** **not written to** — verified unchanged (see §6)

---

## 1. Backend suites — 19/19 PASS, exit 0

Command: `npm test` (root) → `node scripts/run-tests.js` (backend)

| Suite | Result | Time |
|---|---|---|
| `test-security-hardening.js` | PASS | 0.9 s |
| `test-meta-token-security.js` | PASS | 0.1 s |
| `test-bell-notification.js` | PASS | 0.2 s |
| `test-sender-audit.js` | PASS | 0.2 s |
| `test-auth-security.js` | PASS | 0.7 s |
| `test-login-security.js` | PASS | 3.0 s |
| `test-24h-window.js` | PASS | 0.1 s |
| `test-company-switching.js` | PASS | 0.1 s |
| `test-cras-contact-creation.js` | PASS | 0.1 s |
| `test-company-pipelines.js` | PASS | 0.1 s |
| `test-lead-assignment.js` | PASS | 2.2 s |
| `test-media-and-memory-security.js` | PASS | 1.0 s |
| `test-marketing-foundation.js` | PASS | 0.1 s |
| `test-pagination.js` | PASS | 1.1 s |
| **`test-message-cursor.js`** (new) | PASS | 1.3 s |
| `test-super-admin-settings.js` | PASS | 1.4 s |
| `test-meta-message-status.js` | PASS | 0.4 s |
| `test-appointments.js` | PASS | 0.2 s |
| `test-phonetic-composer.js` | PASS | 0.2 s |

**19/19 passed. Runner exit code 0.**

Phase 1 reported 16 suites; this is 19 because the runner now enumerates the suites that already
existed in the repo but were never wired into `package.json`, plus the new cursor suite.

---

## 2. Repeatability and state isolation

| Check | Result |
|---|---|
| Full run from a **completely empty** database | 19/19 pass, exit 0 |
| Second consecutive full run, same database | 19/19 pass, exit 0 |
| Leftover rows after the run | `leads=0 customers=0 users=0 messages=0 lead_notes=0 lead_assignment_histories=0` |
| Rows remaining that *should* persist (seeded catalogs) | `lead_stages=9 treatments=39` |

The suites are self-contained: they create uniquely-identified fixtures and delete them, rather than
depending on pre-existing rows. Before this phase, `test-meta-message-status.js` leaked one customer
and one lead **per run**, and `test-super-admin-settings.js` depended on live Super Admin records.

---

## 3. Isolation guard — verified by attempting to violate it

| Test | Expected | Observed |
|---|---|---|
| Unit cases for `isTestRun()` / `assertIsolatedTestDatabase()` | 10/10 correct | 10/10 |
| A suite run against the **production** configuration | Fail fast, no connection | `ProductionDatabaseRefusedError` / `TEST_DB_GUARD`, exit 1 |
| `setup-test-db.js` pointed at a non-local, non-`_test` target | Refuse | Refused |
| A benchmark script that set `NODE_ENV=test` but imported statically | Should **not** reach production | **It did reach production** — see §3.1 |

### 3.1 The guard caught a real mistake (evidence, not hypothetical)

A benchmark script was written with `process.env.NODE_ENV = 'test'` on line 3 and a static
`import { server } from './server.js'` on line 4. Because ESM hoists static imports, `db.js` was
evaluated **before** that assignment, so it fell through to `backend/.env` — production. The script
reported `total: 322` (the production lead count) while believing it was isolated.

This is why the guard keys off `process.argv[1]` (the entry-script path) and not `NODE_ENV`. The
script was renamed to the `test-*` convention and now prints its resolved target; it then correctly
reported `isolated test database localhost/crm_test (from TEST_DATABASE_URL)` and `total: 2000`.

No production rows were modified by that mistake (read-only query), and the production counts were
confirmed identical afterwards (§6).

---

## 4. Not verified — stated plainly

**No browser testing was performed in this phase.** The following are therefore **unverified**, and
are *not* claimed as working:

| Item | Status | What *was* verified |
|---|---|---|
| Scroll-up loads older messages in a real browser | **Unverified** | Code path read and traced as correct; the API contract it depends on is covered by `test-message-cursor.js` (4 checks). |
| Visual rendering of the notes badge after reload | **Unverified in browser** | Server contract verified over HTTP: `notesCount` present with the correct value; `notes`/`stageHistories` absent; `assignmentHistories` length 1. |
| Scroll-position preservation when a page is prepended | **Unverified** | Logic reviewed (`previousHeight`/`previousTop` + `requestAnimationFrame`); not exercised. |
| SSE live-update behaviour in a browser | **Unverified** | Covered at the protocol level by the existing suites. |

Everything in this document marked "verified" was produced by an executed command whose output is
reproducible with the commands given. Nothing is inferred.

---

## 5. Frontend

| Check | Command | Result |
|---|---|---|
| Production build | `npm run build` | **Builds clean** — 2,525 modules, `built in 7.87s` |
| Lint | `npm run lint` | **Exit 0** — warnings only |
| `react(purity)` warning at `CrmContext.tsx:661` | `npm run lint` | **Resolved** (lazy initializer) |
| `react(purity)` warnings at `WhatsApp24hWindowInfo.tsx:21`, `SessionWindowBadge.tsx:12` | `npm run lint` | **Resolved** (lazy initializers) |
| Remaining warnings | `npm run lint` | ~292 pre-existing; all warnings, no errors |

The build emits one advisory: a 1,452 kB chunk (355 kB gzip) after minification. This is
**pre-existing** and unrelated to this phase's changes.

---

## 6. Production database — verified untouched

Queried directly after all test activity:

| Metric | Value | Phase 1 baseline |
|---|---|---|
| Leads | 322 | 322 ✓ |
| Users | 21 | 21 ✓ |
| Customers | 308 | — |
| Appointments | 3 | 3 ✓ |
| Treatments | 44 | 44 ✓ |
| Messages | 1,501 | 1,501 ✓ |
| `users.pin` width | `VARCHAR(255)` | applied in Phase 1 ✓ |
| `_prisma_migrations` table | absent | absent ✓ |
| Orphaned appointment → doctor references | 0 | 0 ✓ |

No row counts differ from the Phase 1 baseline. No production migration was applied in this phase.

---

## 7. Cursor fix — proven by test inversion

The composite-cursor fix was validated by **reverting the fix and confirming the tests fail**, then
restoring it. A test that passes against both the broken and fixed code proves nothing.

| Implementation | `test-message-cursor.js` | `test-pagination.js` |
|---|---|---|
| **Old** (timestamp-only cursor) | **FAIL** — `AssertionError: expected 25 messages, saw 24` | **FAIL** — `duplicate message ids across pages` |
| **New** (composite `timestamp\|id`) | **PASS** — 4/4 checks | **PASS** — 11/11 checks (13 when multi-page data is present) |

The old cursor **dropped a message** whenever several shared a timestamp — silent data loss in chat
history. The fixture deliberately writes 25 messages across only 5 distinct timestamps so the
boundary is exercised.

`test-pagination.js` checks 2.4/2.5 exercise this same walk, but they only run when the database holds
more than one page of messages. On an empty database they are **skipped** (reported as
`⏭️ 2.4/2.5 skipped: only one page of messages exists`), which is why the count is 11 rather than 13.
They were exercised during this phase with benchmark data present — see §8 for the seeding commands —
and both failed against the old implementation.

`test-message-cursor.js` checks:

1. Every message returned exactly once while paging (25/25 across 7 pages).
2. Messages sharing an identical timestamp are not skipped.
3. Each page is chronological, and strictly older than the previous page.
4. A legacy timestamp-only cursor still returns 200 (backward compatibility).

---

## 8. Performance measurement

Method: `bench-leads.mjs`. **Old and new query shapes are measured interleaved in the same process
against the same database**, 15 paired runs, median of the per-pair difference.

Interleaving matters: an early version measured the old shape fully and then the new one, and the
results swung between "24 % faster" and "88 % slower" across identical runs on identical data,
because host load and cache warmth differed between the two phases. Interleaving collapsed the
interquartile range from hundreds of milliseconds to a few.

**Dataset:** 2,000 leads, 8,000 notes, 8,000 assignment-history rows, page size 50.

| Measurement | Old | New | Change |
|---|---|---|---|
| Median | 34 ms | 23 ms | −11 ms |
| Interquartile range | 31–38 ms | 20–28 ms | — |
| Payload | 148.9 KiB | 50.4 KiB | **−66.1 %** |

Four independent runs: 9 ms / 66.1 %, 10 ms / 66.2 %, 10 ms / 66.1 %, 11 ms / 66.2 % payload — the
payload reduction is stable; the latency saving is small and noisy in absolute terms at this size.

**Interpretation, stated honestly:** the latency win is **modest**. The old query was never slow on
this dataset because notes are cheap per row. The **durable** win is the 66 % payload reduction and,
more importantly, that the payload is now **bounded**: it no longer grows as leads accumulate notes
and stage changes, whereas the old shape did.

An earlier Phase 1 report quoted `GET /api/leads` at 5,283 ms / 6,020 ms. Those figures came from
different methodology and load conditions and are **not** comparable to the numbers above; they should
not be presented as a before/after.

Reproduce:

```
npm run bench:leads:seed    # 2,000 leads into the isolated test database
npm run bench:leads
npm run bench:leads:clear   # remove benchmark rows
```

---

## 9. How to reproduce everything

```
# 1. Provision the isolated test database (destroys and recreates public schema in crm_test ONLY)
npm run test:setup

# 2. Run every backend suite
npm test

# 3. Frontend
npm run build
npm run lint

# 4. Lead-query benchmark
npm run bench:leads:seed && npm run bench:leads && npm run bench:leads:clear
```

`setup-test-db.js` requires a local PostgreSQL server. The `psql` client does **not** need to be on
`PATH`: the script searches the standard PostgreSQL install locations and validates each candidate.
Set `PSQL_PATH` to point at a specific binary if it is installed somewhere unusual.
