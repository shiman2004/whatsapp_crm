# CRM Production Deployment & Operational Safety Checklist

## 1. Pre-Deployment Configuration Verification

- [ ] **Environment Variables (`backend/.env`):**
  - [ ] `DATABASE_URL`: Set to production Supabase pooler URL (port `6543`, `pgbouncer=true`).
  - [ ] `DIRECT_URL`: Set to production Supabase direct URL (port `5432`).
  - [ ] `JWT_SECRET`: High-entropy 64+ character random string (never default or test secrets).
  - [ ] `META_APP_SECRET`: Valid Meta WhatsApp Business App Secret for HMAC webhook verification.
  - [ ] `META_ACCESS_TOKEN`: Permanent System User token with `whatsapp_business_messaging` permissions.
  - [ ] `META_PHONE_NUMBER_ID_RWC`: `1358157244046701`
  - [ ] `META_PHONE_NUMBER_ID_CRAS`: `1378201582041705`
  - [ ] `META_VERIFY_TOKEN`: Webhook verification string matching Meta Developer portal configuration.
  - [ ] `FRONTEND_URL`: Production domain URL for CORS whitelist (e.g. `https://royal-wellness-crm.onrender.com`).
  - [ ] `NODE_ENV`: Set to `production`.

- [ ] **Database Pre-Flight Checks:**
  - [ ] Verify database connectivity via pooler (`DATABASE_URL`).
  - [ ] Confirm stored function `public.next_company_lead_serial()` is compiled and operational.
  - [ ] Confirm `public.system_settings` table exists and contains current serial counters.
  - [ ] Create cold snapshot / pg_dump backup prior to release deployment:
    ```bash
    pg_dump -h db.ap-northeast-2.supabase.co -U postgres -d postgres -F c -b -v -f crm_backup_$(date +%Y%m%d).dump
    ```

---

## 2. Build & Artifact Verification

- [ ] **Backend Verification:**
  - [ ] Run complete automated regression suite:
    ```bash
    npm --prefix backend test
    ```
    *Required result: 20/20 suites passed.*
  - [ ] Validate Node.js syntax and module exports:
    ```bash
    node --check backend/server.js
    ```

- [ ] **Frontend Production Build:**
  - [ ] Execute TypeScript compile & Vite bundle:
    ```bash
    npm --prefix frontend run build
    ```
    *Required result: Clean build with 0 TypeScript errors.*

---

## 3. Zero-Downtime Deployment & Rollback Strategy

### Deployment Execution Steps
1. Deploy new backend code container to hosting platform (Render / AWS ECS / Railway).
2. Wait for API readiness probe (`GET /api/db/status` returns HTTP 200 `{ connected: true }`).
3. Deploy frontend static assets to CDN / host.
4. Verify Meta Webhook health via Developer portal (`GET /api/webhook` returns challenge).

### Immediate Rollback Procedure
If critical production regression occurs:
1. Revert hosting service to previous immutable Docker container tag / Git commit.
2. If database schema was modified, execute down-migration script.
3. Purge CDN cache for frontend static assets.
4. Verify auth and lead list recovery on previous release.

---

## 4. Post-Deployment Smoke Verification Checklist

- [ ] **Super Admin Authentication:**
  - [ ] Log in with Super Admin email & PIN. Verify JWT issuance and session persistence.
- [ ] **Lead Management:**
  - [ ] Open table view. Verify pagination loads first page without delay.
  - [ ] Search existing lead by phone number.
- [ ] **Company Isolation:**
  - [ ] Toggle company switcher between RWC and CRAS. Confirm zero cross-pipeline leakage.
- [ ] **Appointment Engine:**
  - [ ] Open Colombo branch room view.
  - [ ] Verify booked slots and test double-booking rejection.
- [ ] **WhatsApp Webhook:**
  - [ ] Send test inbound message from authorized clinic device to registered WhatsApp number.
  - [ ] Verify message displays in contact chat drawer with 24-hour service timer active.

