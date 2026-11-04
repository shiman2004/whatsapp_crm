# Company & Branch API Integration Design

## Goal

Make the existing Company & Branch Management settings screen persist real company and branch configuration through the existing authorized API routes.

## Decisions

- Reuse `/api/companies/:companyId`, `/settings`, and `/branches` routes; do not add a parallel settings API.
- Treat `ALL` as a read-only aggregate scope because the company API accepts only RWC, CRAS, and AHC mutations.
- Keep profile and localization version numbers separate to preserve server-side optimistic concurrency.
- Map weekly hours to each branch's existing `businessHours` field; applying hours updates active branches individually.
- Persist branding metadata supported by the current company profile (`logoUrl`); do not invent file-storage or upload behavior.
- Preserve existing server-side authorization, identity-change confirmation, branch dependency checks, auditing, and soft-archive semantics.

## UX

- Load live company/branch data with the current visual fallback only for unavailable local development APIs.
- Show loading, save, and error feedback in the existing design system.
- Branch create/edit, deactivate/reactivate/archive, localization changes, business hours, and profile updates are persisted through the API.
- Destructive branch actions require confirmation and display dependency failures returned by the server.
