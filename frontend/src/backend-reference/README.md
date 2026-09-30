# Royal Wellness Center — NestJS Backend & WhatsApp Cloud API Architecture

This directory contains the production NestJS backend reference implementation for the Royal Wellness WhatsApp CRM platform.

## Architecture Highlights
1. **Webhook Ingestion**:
   - `whatsapp.controller.ts`: Handles Meta's GET challenge handshake and asynchronous POST events.
   - `whatsapp-signature.guard.ts`: Enforces HMAC-SHA256 signature verification over raw request body with `X-Hub-Signature-256`.
2. **Conversation State Machine**:
   - `onboarding.state-machine.ts`: Manages the multi-lingual step transition (`AwaitingLanguage` → `AwaitingCategory` → `AwaitingService` → `LeadCreated`).
3. **Follow-Up Automation (BullMQ)**:
   - `followups.processor.ts`: Worker that schedules Day 1, 3, 5, 7 templates, retries with exponential backoff on delivery failure, and auto-cancels on customer reply.
4. **Database Models**:
   - `schema.prisma`: PostgreSQL schema with indexed lookups, enums, audit logs, and cascading relationships.

## Testing Webhook Locally
\`\`\`bash
# Start Ngrok tunnel
ngrok http 4000

# Configure Webhook in Meta Developers Portal:
# Callback URL: https://<ngrok-id>.ngrok-free.app/webhooks/whatsapp
# Verify Token: WHATSAPP_WEBHOOK_VERIFY_TOKEN
\`\`\`
