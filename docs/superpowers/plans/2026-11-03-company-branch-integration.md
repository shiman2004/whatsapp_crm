# Company & Branch API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Company & Branch Management use the existing authorized persistence APIs for every editable screen control.

**Architecture:** Add a focused frontend company API client and make `CompanyBranchSection` consume it for profile, localization, and branches. Existing backend routes remain the authorization, validation, audit, dependency, and optimistic-concurrency authority.

**Tech Stack:** React, TypeScript, existing fetch/API base configuration, Node backend company routes.

**Spec:** `docs/superpowers/specs/2026-11-03-company-branch-integration-design.md`

## Global Constraints

- Preserve company isolation and existing server capability checks.
- Do not create a new API or schema migration.
- Do not add dependencies or change unrelated settings modules.
- Do not fake asset uploads; persist only supported logo metadata.

## Review Focus

- `ALL` scope must never issue a mutating company request; Task 2 covers it.
- Legal identity changes must surface the backend confirmation requirement; Task 2 covers it.
- Branch deactivation with future appointments must retain server failure details; Task 3 covers it.
- Per-branch hour updates must use valid 24-hour times and preserve closed days; Task 4 covers it.
- A profile/localization version conflict must offer reload rather than overwrite; Task 2 covers it.

---

### Task 1: Company API client

**Files:**
- Create: `frontend/src/components/settings/companyApi.ts`
- Test: `frontend/src/components/settings/companyApi.test.ts`

**Interfaces:**
- Produces typed `companyApi.profile`, `localization`, `branches`, and branch lifecycle methods.

- [ ] Write client tests for authenticated requests, JSON errors, and company IDs.
- [ ] Implement the typed client using `API_BASE_URL` and the existing token lookup pattern.
- [ ] Run the focused client tests.

### Task 2: Persist company profile and localization

**Files:**
- Modify: `frontend/src/components/settings/CompanyBranchSection.tsx`
- Test: `frontend/src/components/settings/CompanyBranchSection.test.tsx`

**Interfaces:**
- Consumes `companyApi.profile.get/update` and `companyApi.localization.get/update`.

- [ ] Write failing component tests for loading scope data, saving profile/localization, identity confirmation, version conflict, and read-only ALL scope.
- [ ] Replace preset-only edits with loaded profile/localization state and server versions.
- [ ] Run focused component tests.

### Task 3: Persist branch directory and lifecycle

**Files:**
- Modify: `frontend/src/components/settings/CompanyBranchSection.tsx`
- Test: `frontend/src/components/settings/CompanyBranchSection.test.tsx`

**Interfaces:**
- Consumes `companyApi.branches.list/create/update/deactivate/reactivate/archive`.

- [ ] Write failing tests for create/edit and dependency-blocked deactivation.
- [ ] Wire branch table/modals to live branch data and lifecycle routes, retaining confirmation dialogs.
- [ ] Run focused component tests.

### Task 4: Persist hours and branding metadata

**Files:**
- Modify: `frontend/src/components/settings/CompanyBranchSection.tsx`
- Test: `frontend/src/components/settings/CompanyBranchSection.test.tsx`

**Interfaces:**
- Uses branch updates for business hours and company profile updates for `logoUrl`.

- [ ] Write failing tests for valid/invalid hours, applying active branches only, and logo URL metadata save.
- [ ] Implement 24-hour business-hour conversion/validation and supported branding metadata controls.
- [ ] Run focused tests and `npm.cmd run build`.
