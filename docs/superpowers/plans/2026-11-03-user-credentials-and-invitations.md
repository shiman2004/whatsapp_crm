# User Credentials and Invitation Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely hash new login credentials and deliver user invitations through configured SMTP without removing manual link delivery.

**Architecture:** Retain existing User Management endpoints and invitation records. A small mail service reads the existing global email settings server-side and returns delivery status; route handlers keep issuing the existing one-time link regardless of email availability.

**Tech Stack:** Node.js, existing Prisma settings storage, Nodemailer SMTP transport, React, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-03-user-credentials-and-invitations-design.md`

## Global Constraints

- Retain direct Super Admin password/PIN creation and the manual invitation link fallback.
- Never return, log, or audit raw passwords, PINs, SMTP secrets, or invitation tokens.
- Preserve existing encrypted credentials for login compatibility; write scrypt hashes for all new credentials.

## Review Focus

- Reset credentials must sign in with the new value and not expose it in account detail responses (Task 1).
- An unconfigured SMTP provider must not cause invitation creation or resend to fail (Task 2).
- SMTP delivery failure must be auditable without the invitation token or SMTP secret (Task 2).
- A successful provider result is required before reporting an invitation as emailed (Task 2).
- Frontend text must distinguish an emailed invitation from a copied manual activation link (Task 3).

### Task 1: One-way credential resets

**Files:**
- Modify: `backend/src/userManagementRoutes.js`
- Test: `backend/test-user-credential-hashing.test.js`

**Interfaces:**
- Uses `hashSecret()` and `verifySecret()` from `backend/src/secretHash.js`.
- Produces scrypt-formatted values for reset password and PIN writes.

- [x] Write a failing test proving a newly written credential is verifiable but not reversibly readable.
- [x] Run the test and confirm it fails against reversible reset storage.
- [x] Replace credential-reset writes with `hashSecret` values, preserving existing verification compatibility.
- [x] Run the focused test and confirm it passes.

### Task 2: SMTP invitation delivery service

**Files:**
- Create: `backend/src/services/invitationMailer.js`
- Modify: `backend/src/userManagementRoutes.js`
- Modify: `backend/package.json`, `backend/package-lock.json`
- Test: `backend/test-invitation-mailer.test.js`

**Interfaces:**
- `sendInvitationEmail({ to, fullName, inviteUrl })` returns `{ delivered: boolean, reason?: string }`.
- Invitation create/resend responses add `emailDelivered` without changing `inviteUrl`.

- [x] Write failing service tests for configured delivery, absent SMTP configuration, and a transport failure.
- [x] Run focused tests and confirm they fail because the service does not exist.
- [x] Add the SMTP mailer using the existing global `email_notifications` setting; never pass secrets to callers or logs.
- [x] Update invitation creation and resend to call it after persisting the invitation, audit only the delivery outcome, and retain the manual link fallback.
- [x] Run focused tests and confirm they pass.

### Task 3: Truthful invitation status in the UI

**Files:**
- Modify: `frontend/src/components/admin/user-management/api.ts`
- Modify: `frontend/src/components/admin/user-management/InvitationsTab.tsx`
- Test: `frontend/src/components/admin/user-management/InvitationsTab.test.tsx`

**Interfaces:**
- Reads `emailDelivered` returned by invitation creation/resend.
- Shows emailed confirmation only for successful SMTP delivery; otherwise labels the returned activation URL as manual delivery.

- [x] Write failing UI tests for emailed and manual-link outcomes.
- [x] Run the focused test and confirm it fails before status handling exists.
- [x] Add response typing and status-specific notification/copy.
- [x] Run focused test and `npm.cmd run build`.
