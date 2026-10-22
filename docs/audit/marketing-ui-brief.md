# Public Contact Marketing UI Brief

Implement the eight-screen Public Contact Marketing module inside the existing React/Vite WhatsApp CRM. Preserve the existing dark navy, teal-accented enterprise CRM theme, sidebar proportions, typography, authentication, and lead/WhatsApp workflows.

Target: authenticated staff, marketing officers, admins, and super admins. Use the existing `frontend/src/components/marketing/MarketingModule.tsx`, `App.tsx`, `Sidebar.tsx`, `CrmContext.tsx`, and `config/api.ts`. Reuse real marketing endpoints where available (`POST /api/marketing/imports`, `GET /api/marketing/uploads`, `GET /api/marketing/contacts`) and disable or clearly mark unsupported actions rather than simulating success.

Replace placeholder workspaces with reusable compact components: page header, stat card, data table, filter bar, status badge, contact drawer, import summary, empty state, and loading/error states. Provide finished layouts for Dashboard, Add Public Numbers (single/bulk/upload tabs), My Uploads, Contact Database, Contact Assignment, My Marketing Tasks, Campaign Content, and Marketing Reports. Use realistic empty states and backend-connected data; do not add mock success data. Keep assignment/campaign/report actions disabled until corresponding APIs exist.

Prioritize responsive desktop/tablet/mobile layout, dense aligned tables, sticky headers, focus states, accessible labels, clear consent indicators, and no excessive whitespace. Use lucide icons and existing Tailwind conventions. Do not modify unrelated CRM screens.

Validate with frontend TypeScript/build and report any backend/API blockers accurately.
