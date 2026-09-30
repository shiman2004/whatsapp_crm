# Royal Wellness CRM — Backend Server

Unified WhatsApp Gateway Service providing:
- **WhatsApp Web (Baileys Socket)**: Direct QR code authentication and phone pairing.
- **Meta WhatsApp Cloud API**: Webhook verification (`GET /api/webhook`) and payload processing (`POST /api/webhook`).
- **Server-Sent Events (SSE)**: Live event streaming (`GET /api/events`) to the frontend for real-time inbound chat delivery and status updates.
- **REST Endpoints**:
  - `GET /api/status`: Current WhatsApp connection state and paired phone number.
  - `GET /api/qr`: Real-time pairing QR code data URL.
  - `POST /api/send`: Outbound WhatsApp message dispatch.
  - `POST /api/disconnect`: WhatsApp session logout.

## Quick Start

```bash
# Install dependencies
npm install

# Start server
npm run dev
# Running on http://localhost:3001
```
