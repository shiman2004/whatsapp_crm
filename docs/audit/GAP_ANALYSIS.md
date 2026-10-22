# Gap Analysis

## Resolved Gaps (Phase 2 Remediation)

- **Database Missing Treatments:** **RESOLVED** — Re-queried database: 323/323 leads have valid treatment and category relationships. Missing treatments is 0.
- **Route Interception in `legacyServer.js`:** **RESOLVED** — `/api/leads/create` and `/api/leads/delete` are no longer intercepted by the lead update route handler.
- **Appointment Doctor Column Mapping:** **RESOLVED** — Replaced non-existent `u."full_name"` with `u."fullName"` in `appointmentRoutes.js`.
- **Lead Stage History Audit Fields:** **RESOLVED** — `changedById` and `changedByName` properly populated in `legacyServer.js`.
- **Node Deprecation Warning:** **RESOLVED** — Replaced legacy `url.parse()` with standard WHATWG `URL` across backend route files.
- **Fallback Treatment Identifier:** **RESOLVED** — Corrected fallback treatment reference from `'trt-hair-prp'` to valid `'trt-prp'`.

---

## Remaining Operational & Architectural Gaps

### P1 / Release-Impacting (Operational Go-Live Pre-requisite)
- **Live WhatsApp/Baileys/Meta Delivery:** Automated mocks and HMAC signatures verified; live dispatch to physical clinic numbers is blocked per safety rules and requires execution on clinic devices during on-site go-live cutover.

### P2 / Technical & Architectural Debt
- **Monolithic Route Handler:** `backend/src/legacyServer.js` (> 6,600 lines) contains routes, webhook logic, socket handling, and DB queries. Recommend gradual modularization into route groups behind `src/app.js`.
- **Global Context Concentration:** `frontend/src/context/CrmContext.tsx` (> 3,400 lines) manages multi-domain state. Recommend separating into modular domain contexts.
- **Frontend Lint Warnings:** Oxlint reports 286 non-fatal warnings (0 errors).

### P3 / Enhancements
- **Bundle Optimization:** Frontend production bundle chunk is 1,452 kB (> 500 kB recommended threshold). Recommend code splitting via dynamic imports.
- **Browser Automation:** Headless browser automation (Playwright) deferred to post-release CI integration.
