# User Credentials and Invitation Delivery Design

## Intent

Make the User Management flow visibly and safely manage login access while retaining Super Admin direct creation of an initial password and PIN. Deliver invitations by SMTP when configured, with the existing copyable one-time link retained as the no-provider fallback.

## Goals

- Keep direct creation with an initial password and optional PIN.
- Store every newly written password and PIN as a salted scrypt hash; existing encrypted credentials remain sign-in compatible.
- Keep credential values non-readable in every Super Admin response and UI.
- Send new and renewed invitations through the configured SMTP provider only after a successful transport result; otherwise return the activation link for manual delivery with a truthful status.
- Audit credential resets and invitation delivery outcomes without recording credentials or tokens.

## Non-goals

- No password recovery email, MFA, third-party identity provider, or new invitation table.
- No provider-specific integration: SMTP is the configured provider seam already represented by Email Notifications settings.

## Approach

Use the current User Management routes and invitation token lifecycle. Add a minimal SMTP mail service backed by the existing global `email_notifications` setting, and inject its transport in tests. The route must keep its manual-link response when SMTP is not configured or delivery fails, so invitations remain usable without credential leakage.

## Constraints

- Super Admin authorization, tenant validation, session revocation, and append-only audit behavior remain server-enforced.
- SMTP secrets never appear in API responses, audit metadata, or the browser.
- SMTP credentials must be supplied by an administrator before any email can be sent.
