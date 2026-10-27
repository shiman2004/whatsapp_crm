# Marketing Assignment Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the missing assignment/reassignment audit, filtering, and UI behavior without replacing Public Contact Marketing.

**Architecture:** Extend the existing marketing schema and assignment transaction additively, expose the new fields through the existing contacts endpoint, then render and filter them in the existing Contact Database and drawer. Historical rows stay untouched; new events are immutable records.

**Tech Stack:** Prisma/PostgreSQL, Node route dispatcher, React 19, TypeScript, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-27-marketing-assignment-compatibility-design.md`

## Global Constraints

- Reuse current tables, APIs, role permissions, company isolation, and transaction pattern.
- Additive migration only; never fabricate prior history or overwrite original assignment time.
- Consent, WhatsApp gating, lead conversion, and import ownership remain unchanged.
- All mutation tests run before frontend compilation.

## Review Focus

- A reassignment must never alter the original assignment timestamp.
- An actor with assignment but not reassignment capability must be denied reassignment.
- Competing assignment requests must not create two current owners/history outcomes.
- Pending task ownership changes once; completed work remains attributed to its previous owner.
- Server-side filters must remain company-scoped and paginated.

### Task 1: Additive assignment audit schema

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_marketing_assignment_audit/migration.sql`
- Test: `backend/test-marketing-e2e.js`

- [ ] Write failing assertions that original assignment time survives reassignment and the latest reassignment time is present.
- [ ] Add nullable `lastReassignedAt` and assignment-history event metadata needed for future events only.
- [ ] Run the marketing E2E test and Prisma validation.

### Task 2: Secure assignment transaction and contact query

**Files:**
- Modify: `backend/src/marketing/routes.js`
- Test: `backend/test-marketing-e2e.js`, `backend/test-marketing-foundation.js`

- [ ] Write failing route tests for reassignment capability denial, timestamp preservation, task transfer, and returned history.
- [ ] Split initial-assignment/reassignment authorization, preserve `assignedAt`, write reassignment time/event metadata, and expose scoped history.
- [ ] Add server-side owner, coordinator, batch, lead-status, assignment-date, and reassignment-date filters to the existing contacts query.
- [ ] Run targeted marketing tests.

### Task 3: Contact Database and detail history

**Files:**
- Modify: `frontend/src/components/marketing/types.ts`
- Modify: `frontend/src/components/marketing/MarketingModule.tsx`
- Modify: `frontend/src/components/marketing/MarketingContacts.tsx`
- Modify: `frontend/src/components/marketing/MarketingContactDrawer.tsx`

- [ ] Add the new DTO/filter state before changing rendering.
- [ ] Render assignment status, original/latest dates, current owner/actor, and a chronological history section in the existing drawer.
- [ ] Wire the existing contacts fetch to the new server-side filters and retain responsive table overflow.
- [ ] Run frontend build.

### Task 4: Regression verification

**Files:**
- Test: `backend/test-marketing-foundation.js`, `backend/test-marketing-e2e.js`

- [ ] Run the complete marketing test commands, Prisma validation, frontend build, and whitespace check.
- [ ] Inspect the focused diff for scope, existing route compatibility, consent preservation, and no generated-file changes.
