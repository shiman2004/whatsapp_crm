# Public Contact Marketing Assignment Compatibility Design

## Intent

Upgrade the existing Public Contact Marketing workflow in place. Preserve the current upload, normalization, duplicate prevention, consent governance, lead conversion, routes, roles, company isolation, and CRM integrations.

## Goals

- Keep the existing deterministic equal-assignment engine and preview.
- Preserve an original assignment timestamp forever and record the latest reassignment timestamp separately.
- Make each assignment-history record self-describing and available in the existing contact detail experience.
- Enforce the existing reassignment capability server-side.
- Add requested contact-database assignment filters through the existing paginated contacts API.
- Make task transfer explicit: close a previous owner's pending task; create or reactivate one pending task for the new owner; leave completed tasks historically attributed.

## Non-goals

- No new marketing tables, navigation, assignment engine, role, or endpoint family.
- No automatic WhatsApp sending, consent changes, lead conversion, or reassignment during import.
- No fabricated historical assignment/reassignment facts for existing contacts.

## Chosen approach

Use an additive Prisma migration on `MarketingContact` and `MarketingAssignmentHistory`, then adapt the existing assignment transaction, contacts query, DTOs, table, and drawer. Existing `assignedAt` values become original assignment times; `lastReassignedAt` remains null until a future reassignment. Existing history rows retain their current data and receive no invented event metadata.

## Compatibility and rollback

The migration only adds nullable columns. Code reads missing historical reassignment data as a dash. Rollback is code-only: deploy the prior compatible build and leave additive columns/data intact. No records, history, consent, tasks, or leads are deleted.

## Security and data rules

- Derive assignment actor exclusively from authenticated `authUser`.
- Require `CAPABILITIES.assign` for initial assignment and `CAPABILITIES.reassign` for reassignment.
- Retain existing active, marketing-access, company, and contact-scope checks.
- Run assignment/history/task changes in the current transaction and retain conditional ownership claims for conflict detection.
- Store UTC timestamps; render with the browser's `toLocaleString()`.

## UI scope

The existing Contact Database gains assignment state/date columns, a history action in its current detail drawer, and the missing filter controls. Existing assignment/reassignment actions and batch-to-assignment navigation remain unchanged.
