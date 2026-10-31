# PHASE 2 — Production Readiness Assessment

**Project:** Royal Wellness Center / CRAS WhatsApp CRM
**Date:** 2026-10-21
**Previous verdict (Phase 1):** CONDITIONAL — 7 outstanding issues

---

## Verdict

# CONDITIONAL

The verdict **does not change** from Phase 1, despite substantial progress and five additional
release-blocking defects being found and fixed. It stays CONDITIONAL for one reason: **the changes
have not been exercised in a browser or against real user traffic**, and three items remain open. All
backend evidence is strong and reproducible; the UI evidence is absent.

Advancing to **READY** requires the items in §4, of which only one (browser verification) is a true
blocker for the areas this phase touched.

---

## 1. What improved

### Release-blocking defects removed

| # | Defect | Severity if shipped |
|---|---|---|
| 1 | `server.js` never bound a port under `NODE_ENV=test` — every spawned-server suite silently failed | Test infrastructure was **not actually testing anything** for several suites |
| 2 | Message cursor dropped messages sharing a timestamp | **Silent data loss** in chat history |
| 3 | Three schema-bootstrap seed defects (`lead_stages`, `branches`, `rooms`) | A **fresh deployment could not initialise its database** |
| 4 | SSE keep-alive timer not `unref()`'d | Process cannot shut down gracefully — fixable incident during a deploy or scale-down |
| 5 | Test runner recorded green suites as failures | Would train the team to ignore a failing suite |

Defects 2 and 3 are the serious ones. Defect 2 was **already live in production code**: any
conversation where several messages shared a millisecond would lose messages when a coordinator
scrolled up. Defect 3 meant the documented bootstrap path could not build a new environment.

### Test isolation

Tests can no longer reach production. This is enforced by construction, in the shared data-access
module, so it cannot be bypassed by a suite simply forgetting. It was **proven** during this phase by
accidentally triggering it (§3 of `PHASE_2_TEST_RESULTS.md`).

### Test suite health

| | Phase 1 | Phase 2 |
|---|---|---|
| Suites run | 16 | **19** |
| Passing | 16 | **19** |
| Repeatable from an empty database | No | **Yes** |
| Leaves orphan rows | Yes | **No** |
| Can write to production | Yes | **No** |

### Lead API payload

66 % smaller per page, and now **bounded** — it no longer grows with a lead's accumulated notes and
stage history. The notes badge, which was silently lost on every page reload, is now restored from the
server.

---

## 2. Evidence base

Every claim below is backed by an executed command.

| Area | Evidence | Confidence |
|---|---|---|
| Backend suites | 19/19 pass, exit 0, repeated | High |
| State isolation | Zero leftover rows after a full run | High |
| Production DB untouched | Row counts identical to Phase 1 baseline | High |
| Test-DB guard | Refusal verified end-to-end | High |
| Cursor fix correctness | **Test inversion** — old fails, new passes | High |
| Lead API improvement | Interleaved paired benchmark, 4 consistent runs | High |
| Frontend build / lint | Builds clean; lint exit 0 | High |
| **Browser behaviour** | **Not tested** | **None** |

---

## 3. Open items

### 3.1 Browser verification — **BLOCKING**

No browser testing was performed. Unverified: scroll-up history loading, notes-badge rendering after
reload, scroll-position preservation, and live SSE behaviour in the UI.

The code paths were read and traced as correct, and the API contracts they depend on are covered by
automated tests — but "the contract is tested" is not the same as "the feature works on screen".
Given that this phase changed the message-cursor format and the lead-summary payload, the UI is
precisely where an unnoticed regression would live.

### 3.2 Three coordinator accounts have no credentials — **NOT BLOCKING**

| Account | Role | PIN | Password |
|---|---|---|---|
| `coord-1791953678775@royalwellness.lk` | coordinator | none | none |
| `user-admin-1792152224343@royalwellness.lk` | coordinator | none | none |
| `user-zeenath-1@royalwellness.lk` | coordinator | none | none |

These accounts cannot log in. All three **Super Admins have both a PIN and a password**, so there is
**no administrator lockout risk**. Whether these coordinator accounts should be given credentials or
deactivated is a business decision and was not taken unilaterally.

### 3.3 Database migration process — **NOT BLOCKING**

The live database is not under Prisma Migrate (`_prisma_migrations` is absent). Schema changes are
applied by an idempotent bootstrap in application code. This works — it is how `users.pin` was widened
to 255 — but it means schema state depends on the application having started, and there is no
migration history to audit or roll back.

**The specific hazard:** `prisma db push` reads `backend/.env` and **ignores** inherited environment
variables. A developer who runs it expecting an environment override will target production. This
happened once (harmlessly — the change was rejected by existing constraints, verified afterwards).

### 3.4 Backend modularisation — **NOT BLOCKING**

`legacyServer.js` is ~5,950 lines. A maintainability problem, not a correctness one. Deferred
deliberately: five fixes in this phase had to touch this file, and refactoring it concurrently would
have made the changes unreviewable.

### 3.5 Pre-existing lint warnings — **NOT BLOCKING**

~292 warnings (`no-unused-vars`, `react-hooks(exhaustive-deps)`, plus a few `react(purity)` in files
that are the user's own uncommitted work). Lint exits 0. Three impure-render warnings were fixed;
the rest were left because changing hook dependency arrays in a 2,500-line live-messaging context
risks introducing stale-closure bugs — worse than the warnings.

---

## 4. What must happen to reach READY

| # | Action | Blocking? |
|---|---|---|
| 1 | Browser-verify scroll-up loading, notes badge after reload, and live message delivery | **Yes** |
| 2 | Decide the three credential-less coordinator accounts | No |
| 3 | Verify a second environment (staging) initialises from `setup-test-db.js` + bootstrap | Recommended |
| 4 | Decide whether to adopt Prisma Migrate, or document the bootstrap as the sanctioned path | Recommended |
| 5 | Split `legacyServer.js` | No |

**Item 1 is the only genuine blocker for the changes made in this phase.**

---

## 5. Residual risk if deployed as-is

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A UI regression in scroll-up or the notes badge, undetected because no browser test ran | Medium | Low–Medium | Browser verification before release; the API contract is already tested |
| Clients that parse the cursor as a timestamp break | Low | Low | The cursor was already opaque to the web client; no mobile integration is in this repo |
| `prisma db push` mistakenly run against production | Low | **High** | Use `--schema prisma/schema.test.prisma`; documented in both reports |
| A future fresh deployment hits the seed defects | Very low | High | **Already fixed** and verified by provisioning from empty |

---

## 6. Assessment against the original seven issues

| # | Issue | Phase 1 | Phase 2 |
|---|---|---|---|
| 1 | Tests could mutate production | Open | **Resolved** |
| 2 | No isolated test database | Open | **Resolved** |
| 3 | Lead API unbounded eager loading | Open | **Resolved** (diagnosis corrected; payload now bounded) |
| 4 | Schema bootstrap / migration adoption | Open | **Partially addressed** — failures observable, `pin` verified; adoption decision still open |
| 5 | Backend modularisation | Open | **Deferred** (P2, no functional impact) |
| 6 | Frontend React correctness | Open | **Partially addressed** — impure renders fixed; browser behaviour unverified |
| 7 | Non-deterministic tests | Open | **Resolved** — deterministic fixtures, zero leakage |

Resolved: **4 of 7**. Partially addressed: 2. Deferred: 1.
Additionally: **5 new release-blocking defects found and fixed.**

---

## 7. Bottom line

The backend is in materially better shape than at the start of this phase. The most consequential
outcome is not a planned fix but a discovered one: **the message cursor was silently dropping chat
history**, and that is now fixed and provably tested.

What holds the verdict at CONDITIONAL is process, not code quality: the changes touched the message
payload and the pagination cursor, and **nobody has looked at the screen**. One browser session
covering scroll-up loading, the notes badge, and live message delivery would be sufficient to move
this to READY for the scope of this phase.
