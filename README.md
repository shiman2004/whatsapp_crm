# Royal Wellness Center — WhatsApp Concierge & Clinical Lead CRM

A modern, full-stack WhatsApp-integrated CRM designed for premier medical and wellness clinics. Features real-time WhatsApp Web QR synchronization, Meta WhatsApp Cloud API webhooks, automated multilingual onboarding (English, Sinhala, Tamil), multi-reaction live chat thread, and clinical pipeline management.

---

## 📁 Project Architecture

The codebase is organized into clean, dedicated workspaces:

```
royal-wellness-crm/
├── 📂 frontend/              # React 19 + TypeScript + Vite + TailwindCSS App
│   ├── public/              # Static assets & SVG icons
│   ├── src/                 # UI components, contexts, state hooks, types
│   ├── index.html           # Main SPA entry point
│   ├── vite.config.ts       # Vite configuration
│   ├── tailwind.config.js   # Royal Wellness luxury theme tokens
│   └── package.json         # Frontend dependencies & scripts
│
├── 📂 backend/               # Node.js WhatsApp Gateway Server (Port 3001)
│   ├── server.js            # Unified Baileys Socket + Meta Webhook + SSE Event Hub
│   ├── webhook-standalone.js # Standalone Meta Cloud API Webhook receiver
│   ├── auth_info_baileys/   # WhatsApp credentials & secure pairing keys
│   ├── .env.example         # Environment variable template
│   └── package.json         # Backend dependencies & scripts
│
├── 📄 package.json          # Root orchestration & workspace scripts
├── 📄 .gitignore            # Multi-layer gitignore rules
└── 📄 README.md             # Project documentation
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Start Both Frontend & Backend Concurrently
```bash
npm run dev
```

- **Frontend Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Backend WhatsApp Gateway**: [http://localhost:3001](http://localhost:3001)

---

## 🛠️ Individual Workspace Scripts

### Run Frontend Only:
```bash
npm run dev:frontend
```

### Run Backend Only:
```bash
npm run dev:backend
```

### Build Frontend for Production:
```bash
npm run build
```

---

## 📱 WhatsApp Integration Channels

1. **WhatsApp Web (Baileys Socket)**:
   - Click **"Link Device (QR)"** in the top header.
   - Scan the QR code using your WhatsApp mobile app (`Linked Devices`).
   - Receives inbound messages & reactions directly without Meta Business verification.

2. **Meta WhatsApp Cloud API**:
   - Webhook URL: `https://your-domain.com/api/webhook`
   - Verification Token: Configurable in `backend/.env` (default: `royal_wellness_token_2026`).
