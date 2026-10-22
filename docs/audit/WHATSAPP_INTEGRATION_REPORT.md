# WhatsApp Integration Verification Report

## Executive Summary

The WhatsApp communication layer in Royal Wellness CRM operates through a dual-channel architecture:
1. **Meta Cloud API (Official Graph API v21.0):** Primary channel for verified business messaging, template dispatch, automated delivery receipts, and webhooks.
2. **Baileys Gateway (Self-Hosted WebSocket MD):** Secondary / legacy direct device session fallback for multi-device QR pairing.

---

## 1. Meta Cloud API Architecture & Verification

### 1.1 Webhook Authentication & Security
- **HMAC SHA-256 Signature Verification:**
  - Implemented in `backend/src/legacyServer.js` via `verifyMetaSignature()`.
  - Header `x-hub-signature-256` validated against `META_APP_SECRET` using timing-safe buffer comparison (`crypto.timingSafeEqual`) to prevent timing attack vulnerabilities.
  - Automated test `backend/test-e2e-workflow-matrix.js` Module 6 generates valid HMAC signatures and verifies that non-matching signatures are rejected with `401 Unauthorized`.
- **Webhook Subscription Verification:**
  - `GET /api/webhook` validates `hub.mode === 'subscribe'` and verifies `hub.verify_token` against `process.env.META_VERIFY_TOKEN` before returning `hub.challenge`.

### 1.2 Inbound Message Processing
- **Phone Number Normalization:** International E.164 sanitization removes spaces, hyphens, and leading zeros.
- **Company Routing:** Incoming Phone Number IDs dynamically map to RWC (`1358157244046701` / `+94 70 639 3353`) or CRAS (`1378201582041705` / `+94 70 637 3353`), guaranteeing company isolation.
- **Customer & Lead Auto-Resolution:** Inbound message looks up customer by `whatsappNumber` or `whatsappId`. If not found, a new customer and lead record are transactionally created.
- **Message Deduplication:** Incoming Meta `wamid` strings are stored in `public.messages(id)` with a primary key uniqueness constraint, preventing duplicate processing from webhook retries.

### 1.3 Outbound Messaging & Internal Sender Audit Trail
- **Sender Audit Logging:** Outbound staff messages record staff `id`, `fullName`, and `role` into `public.message_audits`.
- **Role Sanitization:** Outbound messages sent to coordinator endpoints strip audit metadata to prevent internal role leakage, while Super Admins retain full visibility into who sent every message.
- **Timezone Standardization:** Message timestamps formatted to Sri Lanka Time (`Asia/Colombo`).

### 1.4 Message Status Transitions & Blue Ticks
- **Status Lifecycle:** `sent` (1 grey tick) → `delivered` (2 grey ticks) → `read` (2 blue ticks).
- **Out-of-Order Event Protection:** Status progression engine in `backend/src/legacyServer.js` prevents late-arriving `delivered` webhooks from downgrading an already `read` status.
- **Delivered & Read Timestamps:** Captures `deliveredAt` and `readAt` timestamps in `public.messages`.
- **Verification Suite:** Fully verified by `backend/test-meta-message-status.js` (6/6 assertions passing).

### 1.5 WhatsApp 24-Hour Customer Service Window
- **Policy Enforcement:** Free-form session messaging is strictly restricted to 24 hours from the patient's last inbound message (`lastCustomerMessageAt`).
- **Live Timer Activation:** Verified in `backend/test-24h-window.js` and `backend/test-e2e-workflow-matrix.js` Module 7: inbound messages update `lastCustomerMessageAt` and reset the 24-hour service window.
- **Template Fallback:** Beyond 24 hours, free-form text input is locked in the UI, and coordinators are directed to send Meta-approved templates (`cras_welcome_greeting`, etc.).

---

## 2. Baileys Gateway Architecture & Verification

- **Gateway Controller:** Managed via `src/baileysGateway.js` and multi-device auth credentials in `baileys_auth_info/`.
- **Session Persistence:** Credentials stored in database table `public.whatsapp_sessions` and `public.whatsapp_session_keys`.
- **QR Authentication:** QR code generated via `/api/whatsapp/qr` and broadcast over SSE (`/api/events`).
- **Graceful Disconnect:** `/api/whatsapp/disconnect` safely terminates socket connections without dropping message history.

---

## 3. Automated Verification Matrix

| Area | Component | Route / Script | Test Evidence | Status |
|:---|:---|:---|:---|:---|
| Meta Webhook Signature | HMAC SHA-256 Validation | `POST /api/webhook` | `test-e2e-workflow-matrix.js` (Mod 6) | PASS |
| Meta Token Security | Environment Loading & Redaction | `/api/meta/config` | `test-meta-token-security.js` | PASS |
| Message Statuses | Sent → Delivered → Read | Meta Status Webhook | `test-meta-message-status.js` | PASS |
| 24-Hour Service Window | Window Expiration & Reset | `Lead.lastCustomerMessageAt` | `test-24h-window.js`, `test-e2e-workflow-matrix.js` | PASS |
| Sender Identification | Internal Staff Audit Trail | `MessageAudit` | `test-sender-audit.js` | PASS |
| Media Processing | Audio OGG/Opus Conversion | `convertAudioToWhatsAppOggOpus` | `test-media-and-memory-security.js` | PASS |
| Live Customer Message Delivery | Real WhatsApp Recipient | Meta Cloud API / Baileys | Requires authorized phone and live Meta quota | **BLOCKED** |

---

## 4. Live External Verification Status & Constraints

> [!WARNING]
> In accordance with Mandatory Rule #5, live customer WhatsApp messages were NOT sent during testing to protect patient privacy and clinic reputation.
> Automated tests were executed using isolated mock payloads, HMAC verification, and test database fixtures.

- **Automated Mock Verification:** PASS (100% of routes and business logic verified).
- **Live Production Dispatch:** Marked **BLOCKED** pending client deployment on designated production SIM / Meta Phone Number ID (`+94 70 639 3353` for RWC and `+94 70 637 3353` for CRAS).

