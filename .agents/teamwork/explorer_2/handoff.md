# Frontend Codebase Exploration & UI/UX Architectural Analysis Report

**Date**: 2026-10-29  
**Explorer**: `teamwork_explorer` (Frontend Codebase Explorer)  
**Working Directory**: `d:\Royal Project\whatsapp_crm\.agents\teamwork\explorer_2`  
**Target Project**: `d:\Royal Project\whatsapp_crm`  
**Reference Document**: `d:\Royal Project\whatsapp_crm\.agents\teamwork\ORIGINAL_REQUEST.md`

---

## 1. Observation

### 1.1 Frontend Technology Stack, Build Tools, and Package Manager
- **Root Repository Configuration**:
  - `package.json` (`d:\Royal Project\whatsapp_crm\package.json`, lines 6-9):
    ```json
    "workspaces": [
      "frontend",
      "backend"
    ]
    ```
    Package manager is standard **npm** using npm workspaces.
- **Frontend Dependencies** (`frontend/package.json`, lines 12-38):
  - **Framework**: React `19.2.8` (`react`, `react-dom`, `react-is`)
  - **Build Tool**: Vite `8.3.0` with `@vitejs/plugin-react` `6.1.1`
  - **TypeScript**: `~6.0.2` with project references configured in `tsconfig.json`, `tsconfig.app.json`, and `tsconfig.node.json`
  - **Styling**: Tailwind CSS `3.4.17` (`tailwindcss`), `postcss` `8.5.28`, `autoprefixer` `10.6.1`
  - **Icons**: Lucide React `1.47.0` (`lucide-react`)
  - **Charts & Data Visualization**: Recharts `3.10.1` (`recharts`)
  - **Real-Time Client**: Socket.IO client `4.8.4` (`socket.io-client`)
  - **HTTP Client**: Axios `1.21.0` (`axios`) alongside native `fetch()`
  - **Utilities**: `canvas-confetti` `1.9.4`, `qrcode` `1.5.4`, `lamejs` `1.2.1`
  - **Linter**: OxLint `1.81.0` (`oxlint`)
- **Vite Configuration** (`frontend/vite.config.ts`, lines 7-29):
  - Development server runs on `localhost:5173` with `strictPort: true`.
  - Manual vendor chunk splitting configured for `vendor-react`, `vendor-charts`, and `vendor-icons`.
  - Chunk size warning limit: `600 kB`.

### 1.2 Application Architecture: Staff CRM vs Public/Student Views
- **Dual Mount Split** (`frontend/src/App.tsx`, lines 174-187):
  ```tsx
  export default function App() {
    if (window.location.pathname === '/student') {
      return (
        <Suspense fallback={<InlineLoader label="Loading student portal…" />}>
          <StudentPortal />
        </Suspense>
      );
    }
    return (
      <CrmProvider>
        <RootApp />
      </CrmProvider>
    );
  }
  ```
  - Direct pathname routing `/student` bypasses `CrmProvider` entirely and mounts `<StudentPortal />` in complete isolation.
  - All other paths mount `<CrmProvider>` -> `<RootApp>` -> `<MainLayout>` inside `<AppShell>`.
- **CRM Router Implementation** (`frontend/src/App.tsx`, lines 58-156 & `src/config/navigation.ts`):
  - CRM operates via hash routing (`#/dashboard`, `#/leads`, `#/inbox`, `#/exam-department/...`, `#/settings/...`, `#/staff/...`, `#/security/...`).
  - Hash route resolution is controlled by `useHashPath()` (`src/hooks/useHashRoute.ts`) and `resolveRoute()` (`src/config/navigation.ts`, lines 404-414).
  - Sub-navigation within modules uses custom `intentEvent` dispatch (e.g. `'exam-subtab-change'`, `'settings-subtab-change'`).
  - Legacy view `<StudentExamPage />` is still mapped under CRM hash route `#/exam-portal` (navigation.ts line 250), which causes confusion between internal staff and public student portals.

### 1.3 Role-Based UI and Routing
- **Role Definitions** (`frontend/src/types/index.ts`, line 1):
  ```typescript
  export type UserRole = 'super_admin' | 'leads_officer' | 'coordinator' | 'sales_coordinator' | 'exam_department_manager' | 'exam_coordinator' | 'exam_providing_officer' | 'marketing_officer' | 'marketing_admin' | 'clinical_nurse' | 'clinical_doctor' | 'report_analyst';
  ```
- **Backend Role Capabilities** (`backend/src/roleMatrix.js`, lines 105-118):
  - Backend declares `finance_officer` with capabilities: `'verify_payment'`, `'adjust_payment'`, `'view_financial_reports'`.
  - Backend declares `student` with capabilities: `'access_own_courses'`, `'view_results'`, `'submit_attempt'`, `'request_support'`, `'attempt_exam'`, `'view_exam_results'`.
  - **Discrepancy**: Neither `'finance_officer'` nor `'student'` exists in the frontend `UserRole` union type in `frontend/src/types/index.ts`.
- **Navigation Guarding** (`frontend/src/config/navigation.ts`, lines 426-440):
  - `isNavItemVisible(item, user)` checks role predicates: `item.adminOnly` (`super_admin`), `item.examStaffOnly` (`EXAM_STAFF_ROLES`), `item.clinicalStaffOnly` (`CLINICAL_ROLES`), `item.studentOnly` (`String(role) === 'student'`), and `item.marketingModule`.
- **Component Permission Guards** (`frontend/src/components/ui/index.tsx`, lines 485-497):
  - Primitive `<PermissionGuard user={currentUser} allow={['super_admin', 'exam_department_manager']}>` conditionally displays sections.

### 1.4 Existing UI Components, Styling, Forms, State, and API Clients
- **UI Primitives Library** (`frontend/src/components/ui/index.tsx`, 533 lines):
  - Provides standard UI building blocks: `cn`, `PageHeader`, `StatCard`, `StatusBadge`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `InlineLoader`, `InlineFeedback`, `SearchInput`, `FilterToolbar`, `DataTable`, `ActivityTimeline`, `ConfirmDialog`, `FormDrawer`, `PermissionGuard`, `SectionCard`, `LinkButton`.
  - Styling tokens: Tailored dark/light theme utilizing WhatsApp CRM palette (`#128C7E`, `#25D366`, `#111B21`, `#202C33`, `#2A3942`, `#E0E5E7`).
- **Form Management**:
  - Uncontrolled native forms via `FormData` (`new FormData(event.currentTarget)`) or standard React `useState` hooks.
  - No external form libraries (Formik or React Hook Form are not installed).
- **State Management**:
  - `frontend/src/context/CrmContext.tsx` is a monolithic React context (202 KB, 4700+ lines). It controls `currentUser`, auth tokens, lead pipelines, chat workspaces, broadcasts, appointments, marketing, stages, and real-time Socket.IO subscriptions.
  - Submodules (e.g. `ExamDepartmentWorkspace`, `InteractiveMcqPracticeView`, `StudentPortal`) maintain local `useState` stores and fetch directly upon mounting or parameter change.
- **API Clients**:
  - Central base URL configured in `frontend/src/config/api.ts` (`export const API_BASE_URL = 'http://localhost:5000'`).
  - `frontend/src/services/examService.ts` (1037 lines) encapsulates 50+ CRUD methods for exam categories, materials, courses, question bank, MCQ sessions, and mock tests.
  - Auth tokens are fetched from `localStorage` (`'rw_crm_auth_token'` or `'crm_auth_token'`).

### 1.5 Frontend Testing Setups
- **Dependencies** (`frontend/package.json`):
  - **Zero frontend test frameworks**: No Jest, Vitest, React Testing Library, Playwright, or Cypress dependencies are installed.
  - No `*.test.tsx`, `*.spec.ts`, or test directories exist within `frontend/src/`.
- **Existing Build and Quality Checks**:
  - Build command: `npm run build --prefix frontend` (`tsc -b && vite build`) executes cleanly with exit code 0.
  - Lint command: `npm run lint --prefix frontend` (`oxlint`) runs OxLint across 164 files with 0 errors and 546 warnings.
- **Backend Test Suite Execution**:
  - Root `package.json` specifies `"test": "npm test --prefix backend"`.
  - Backend tests run via Node's native test runner (`node --test`) or `node scripts/run-tests.js`.
  - Tested commands:
    - `node --test backend/test-runtime-config.test.js` — 4/4 passing (145ms)
    - `node --test backend/test-academic-content-rbac.test.js` — 14/14 passing (151ms)
    - `node --test backend/test-exam-upgrade.test.js` — 14/14 passing (996ms)

---

## 2. Logic Chain

### 2.1 Technology Stack & Monorepo Cohesion
1. *Observation*: The root `package.json` declares workspaces `["frontend", "backend"]`. Vite 8 + React 19 + TypeScript 6 + Tailwind 3 are in `frontend/package.json`.
2. *Deduction*: The frontend is a modern Single Page Application (SPA). The build pipeline is fast (`vite build` completes in ~7.1s), and TypeScript enforces static type safety across modules.

### 2.2 Routing & Dual Entrypoint Separation
1. *Observation*: `App.tsx` lines 175-181 mounts `<StudentPortal />` when `window.location.pathname === '/student'`. Otherwise it mounts `<CrmProvider>` with hash routing.
2. *Deduction*:
   - Clean architectural isolation exists: students do not load CRM state, CRM websockets, or internal staff leads.
   - However, in `navigation.ts` line 250, a legacy `exam` item (`path: '/exam-portal'`) points to `<StudentExamPage />`. This internal link is confusing because students access via `/student`, not via CRM hash routes.
   - Deep linking within the student portal (e.g. `/student#activate=...` or `/student#exam=...`) relies on manual hash parsing instead of structured routes.

### 2.3 Role & Permission Consistency Gap
1. *Observation*: `backend/src/roleMatrix.js` line 105 lists `finance_officer` with specific capabilities (`verify_payment`, `adjust_payment`, `view_financial_reports`), and line 110 lists `student`. However, `frontend/src/types/index.ts` line 1 and `frontend/src/components/admin/user-management/CreateUserTab.tsx` line 7 do not contain `finance_officer`.
2. *Deduction*:
   - Staff administrators cannot create or invite a user with the `finance_officer` role through the Super Admin User Management UI.
   - When a Finance Officer logs in, the navigation system in `navigation.ts` has no role mapping or dedicated workspace for them, falling back to 404 or default dashboard.
   - Finance verification UI cannot be guarded until `finance_officer` is added to `UserRole`.

### 2.4 Exam Department Workspace & Handoff Gap
1. *Observation*: In `frontend/src/components/exam/ExamOperationsView.tsx`:
   - Line 60: Head of Exam can click "Accept handoff" (`POST /api/exam-ops/handoffs/:id/accept`).
   - Line 61: Manager can select officer and click "Assign to officer" (`POST /api/exam-ops/handoffs/:id/assign`).
   - Lines 62-64: Officer can click "Accept requirement", "Start work", and "Complete handoff".
2. *Deduction*:
   - **Missing Return Action**: Requirement R1 explicitly specifies: *"Exam Managers must be able to accept, return, assign, and reassign cases with mandatory recorded reasons."* Currently there is NO return button, modal, or API trigger to return an invalid case to Sales with a recorded reason.
   - **Missing Reassign Action**: Once an officer accepts a handoff (`OFFICER_ACCEPTED` or `IN_PROGRESS`), the UI provides no mechanism for the manager to reassign the case or record a reassignment reason.
   - **Missing Assignment Reason**: The current assign action immediately submits `{ officerId, officerName }` without capturing the required assignment/reassignment reason.
   - **Missing Sales Discussion & Context Link**: Handover cases show metadata (quotation, voucher, email), but do not render or link to the customer discussion history, WhatsApp chat transcript, or staff attribution from the original lead.

### 2.5 Student Portal Security & 2-Device Policy Gap
1. *Observation*: In `frontend/src/components/exam/StudentPortal.tsx`:
   - Line 16: `signIn` only supports password login or simple 8-digit OTP challenge (`/verify-device`).
   - Lines 23-24: Tamil UI text is hardcoded (`பயிற்சி கேள்விகள்`, `மாதிரி தேர்வு`).
   - Line 26: Materials viewer renders raw plaintext: `<div className="whitespace-pre-wrap">{material.text}</div>`.
2. *Deduction*:
   - **Strict Device Policy Missing**: R2 mandates strictly max 2 devices: **strictly 1 Mobile Phone AND 1 Desktop OR Laptop** (never 2 laptops or 2 mobiles). The current portal code does not detect device category (Mobile vs Desktop) or register device fingerprints.
   - **No Concurrent Session Termination Alert**: Logging in on a second device must terminate session on the first device, displaying an explicit termination message.
   - **No Device Replacement Request UI**: An unauthorized 3rd device must be blocked and offered a replacement workflow (student email verification + device selection + replacement reason + CRM admin approval).
   - **No CRM Approval Screen**: CRM staff have no screen to view, approve, or reject student device replacement requests.

### 2.6 Finance Verification & Maker-Checker Material Release Gap
1. *Observation*: In `ExamOperationsView.tsx` line 148, payment verification is a single input field:
   `action('verify-payment', { reference })` placed under an `{admin && ...}` check.
2. *Deduction*:
   - Requirement R3 enforces: *"an uploaded payment receipt alone must never release materials; Finance Officers must independently verify actual payment; Exam Officers select purchased material entitlements and submit release requests; and Exam Managers perform final authorization. Exam Officers must not be permitted to approve their own release requests."*
   - Currently:
     - No Finance Officer workspace or queue exists to verify payments (matching quotation, total, discount, amount paid, balance, payment method, bank transaction reference, and receipt attachment).
     - No Maker-Checker UI exists: Exam Officers do not have an entitlement selection checklist to submit a formal "Material Release Request".
     - No self-approval guard exists in the UI to prevent the requesting officer from authorizing their own release.
     - No dedicated Manager Release Authorization queue exists.

### 2.7 Dynamic Masters Management Gap
1. *Observation*: Super Admin settings currently has `CourseManagementTab.tsx` and `TreatmentsManager.tsx`. Examination titles and professions are hardcoded in `HEALTHCARE_PROFESSION_MASTER_LIST` (`CoursesManagerView.tsx`, line 19) and `countryOptions` (`ExamHandoffRequestModal.tsx`, line 11).
2. *Deduction*:
   - Requirement R4 states: *"Super Administrators must be able to create, edit, activate, deactivate, and map Examinations (e.g., DHA, DOH, MOHAP, Saudi licensing, and other countries across professions), Services, and Packages dynamically without requiring code modifications."*
   - There is no unified Dynamic Masters view for Super Admin to create new examination authorities, define new service capabilities, construct packages (examination + services + duration + attempts + price), and map professions dynamically.

### 2.8 Dynamic PDF Viewer with Student Watermark Gap
1. *Observation*: In `StudentPortal.tsx` line 26, material viewing displays plain text with a text string `Personal access · {material.watermark}`. In `StudyMaterialsView.tsx` line 353, the document viewer is an HTML mockup of "Chapter 1: Clinical Protocols".
2. *Deduction*:
   - Requirement R4 states: *"Protected study PDFs display dynamic watermarks containing student name, ID, email, and access date."*
   - Neither component uses a real PDF canvas rendering engine.
   - There is no dynamic, repeating diagonal watermark overlay embedding Student Name, Portal ID / Email, Access Timestamp, and Client IP/Device Digest.

---

## 3. Caveats

1. **Backend Integration Boundary**: This report focuses on the frontend codebase (`frontend/`). While backend route signatures and `roleMatrix.js` were inspected to verify compatibility, backend database schema migrations or Prisma model alterations are outside the explorer's write boundary.
2. **Current Network Mode**: Running in local offline code investigation mode. External CDN assets (e.g. Unsplash or third-party hosted media) were evaluated based on local fallbacks (`courseArtwork` in `CoursesManagerView.tsx`).
3. **No Existing Frontend Unit Tests**: Because `frontend/` contains no test files or testing libraries, frontend verification relies on TypeScript compilation (`tsc -b`), bundler validation (`vite build`), and linter diagnostics (`oxlint`).

---

## 4. Conclusion & UI/UX Architectural Blueprint

The frontend foundation is modern, performant, and well-structured, utilizing React 19, TypeScript, Vite, and Tailwind CSS with WhatsApp CRM theme tokens. However, there are architectural gaps across the six requested workflows. Below is the blueprint to address them:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND ARCHITECTURE                                          │
├───────────────────────────────────────────────────┬───────────────────────────────────────────────┤
│                  STAFF CRM                        │                STUDENT PORTAL                 │
│      (CrmProvider + AppShell + Hash Router)       │     (Isolated Mount: window.location =        │
│                                                   │                '/student')                    │
├───────────────────────────────────────────────────┼───────────────────────────────────────────────┤
│ 1. EXAM WORKSPACE                                 │ 1. AUTHENTICATION & LIFECYCLE                │
│    • Case Queues (Inbox, In Progress, Review)     │    • Student personal email login             │
│    • Modals: Accept, Return, Assign, Reassign     │    • Email verification OTP challenge         │
│    • Sales Discussion & Attachments Timeline      │    • Hashed password creation                 │
│                                                   │                                               │
│ 2. FINANCE & MAKER-CHECKER                        │ 2. 2-DEVICE CONTROL ENGINE                    │
│    • Finance Verification Workspace               │    • Device Fingerprinting (Canvas/UA)        │
│    • Maker UI: Officer Entitlement Release Request│    • Strictly 1 Mobile + 1 Desktop/Laptop     │
│    • Checker UI: Manager Release Authorization    │    • Concurrent session termination notice    │
│    • Self-Approval Block Guard                    │    • 3rd device block + Replacement Request   │
│                                                   │                                               │
│ 3. DYNAMIC MASTERS HUB (Super Admin)              │ 3. LEARNING ENGINES                           │
│    • Examinations Master (DHA, MOH, Saudi, etc.)  │    • MCQ Practice Mode (instant retry,        │
│    • Services Master (MCQ, Mock, PDF, Notes)      │      3 key learning points, reveal notes)     │
│    • Package Builder (Exam + Services + Days)     │    • Timed Mock Mode (countdown, palette,     │
│    • Profession-to-Exam Mapping Matrix            │      single submission, review screen)        │
│                                                   │                                               │
│ 4. DEVICE REPLACEMENT REVIEW                      │ 4. PROTECTED PDF VIEWER                       │
│    • Approve/reject student device replacements   │    • PDF canvas rendering                     │
│    • Immediate session revocation                 │    • Diagonal dynamic watermark: Student Name,│
│                                                   │      ID, Email, Timestamp, IP               │
└───────────────────────────────────────────────────┴───────────────────────────────────────────────┘
```

### Detailed Component Specifications

#### Module 1: Exam Department Workspace in CRM (`ExamOperationsView.tsx` & Queues)
- **File**: `frontend/src/components/exam/ExamOperationsView.tsx`
- **Case Queues**:
  - `New Cases Inbox`: Unassigned cases awaiting Head of Exam acceptance.
  - `Assigned Queue`: Cases assigned to Exam Providing Officers awaiting officer start.
  - `In Preparation`: Active cases being prepared by officers.
  - `Pending Manager Approval`: Entitlements prepared, awaiting Manager authorization.
  - `Delivered / Active`: Fully activated and released cases.
  - `Returned Cases`: Cases returned for information or correction.
- **Action Modals**:
  - `AcceptModal`: One-click confirmation by Exam Manager.
  - `ReturnModal`: Dropdown of standard reasons (`Incomplete Quotation`, `Unverified Payment`, `Invalid Profession/Exam Mismatch`, `Other`) + mandatory text explanation. Transitions case to `RETURNED_FOR_CORRECTION` and notifies Sales Officer.
  - `AssignModal`: Select officer from `exam_providing_officer` / `exam_coordinator` list + priority (`Urgent`, `Regular`) + instructions.
  - `ReassignModal`: Available to Manager even after officer acceptance. Captures mandatory reassignment reason for the immutable audit trail.
- **Sales Discussion Timeline**:
  - Embedded tab within case detail rendering:
    - WhatsApp message history with customer (timestamped, directional styling).
    - Original lead serial number and inquiry ID.
    - Attached sales files, quotations, and receipt voucher PDF with quick preview.
    - Staff attribution (which sales coordinator handled the conversion).

#### Module 2: Student Portal Account & 2-Device Controlled Security
- **File**: `frontend/src/components/exam/StudentPortal.tsx`
- **Account Lifecycle States**:
  - `Pending Activation`: Student accesses via email activation link, creates passphrase (min 15 chars).
  - `Email Verification Pending`: Enter 8-digit OTP sent to verified personal email.
  - `Active`: Normal access to purchased materials.
  - `Suspended` / `Locked` / `Disabled`: Informative error screen directing student to contact support.
- **Device Fingerprint & 2-Device Policy**:
  - Fingerprint generator: Computes hash from `navigator.userAgent`, screen resolution, color depth, platform, and canvas rendering digest.
  - Device classification: Evaluates user agent / viewport to categorize as `MOBILE` or `DESKTOP_OR_LAPTOP`.
  - Registration rule:
    - Slot 1: Strictly 1 Mobile phone.
    - Slot 2: Strictly 1 Desktop or Laptop computer.
    - Disallows registering 2 mobiles or 2 computers.
  - Registration Modal: On first login from a new device class, prompts: *"Register this device as your Primary [Mobile/Desktop] device?"* Displays device name, OS, and browser.
- **Single Concurrent Session**:
  - If a student signs in on their registered Laptop while their registered Mobile is active, the mobile session is immediately invalidated via websocket/polling.
  - Mobile displays: *"You have been signed out because your account was accessed from another registered device."*
- **Device Replacement Request Workflow**:
  - When accessing from an unregistered 3rd device:
    - Block access with modal: *"Device Limit Reached (Max 2 registered devices: 1 Mobile, 1 Computer)"*.
    - Option: *"Request Device Replacement"*.
    - Step 1: Select device to replace (e.g. replace previous iPhone with new Samsung).
    - Step 2: Provide mandatory reason (e.g. device lost, upgraded phone).
    - Step 3: Verify identity via email OTP.
    - Step 4: Submission creates a pending replacement request in CRM.
- **CRM Staff Review Screen**:
  - Placed under Exam Department Workspace / Security.
  - Exam Manager views student request, old device metadata, new device fingerprint, and reason.
  - Buttons: `Approve Replacement` (revokes old device session immediately and registers new device) vs `Reject Replacement` (with reason).

#### Module 3: Finance Verification & Maker-Checker Material Release UI
- **Finance Officer Workspace**:
  - Route: `#/finance` (accessible to `super_admin` and `finance_officer`).
  - Table of converted sales leads / exam orders requiring financial verification.
  - Displays: Quotation Number, Package Title, Total Amount, Discount, Net Amount, Amount Paid, Balance, Payment Method (Bank Transfer, Credit Card, Cash), Transaction Reference, and Receipt Attachment preview.
  - Action: `Verify Payment` modal: input bank settlement date, transaction reference, verified amount, and verification status (`VERIFIED` or `DISCREPANCY`).
- **Maker-Checker Approval Workflow**:
  - **Maker UI (Exam Processing Officer)**:
    - In `ExamOperationsView`, under an accepted case with verified payment:
    - Officer clicks `Select Entitlements & Request Material Release`.
    - Checklist of purchased services/materials (MCQ Question Bank, Timed Mocks, Revision Notes, Study Guides).
    - Submits release request. Status becomes `PENDING_MANAGER_APPROVAL`.
    - **Self-Approval Guard**: If the current user is the same officer who submitted the request, the `Approve` button is hidden and replaced by a badge: *"Awaiting Manager Approval (Self-approval not permitted)"*.
  - **Checker UI (Exam Department Manager / Super Admin)**:
    - Dedicated tab: `Approval Queue` (`ApprovalQueueView.tsx`).
    - Displays: Case Number, Student Name, Quotation & Verified Payment badge, Requesting Officer, and Requested Entitlements.
    - Actions: `Authorize & Activate Release` vs `Return for Correction` (with mandatory reason).
    - Idempotency & Duplicate Prevention: Authorization button disables immediately upon click, sending unique `releaseRequestId` to ensure repeated clicks cannot trigger duplicate entitlement grants.

#### Module 4: Dynamic Masters Management Screens (Super Admin)
- **File**: `frontend/src/components/admin/SuperAdminSettings/DynamicMastersView.tsx`
- **Sub-Tabs**:
  1. `Examinations Master`:
     - Dynamic CRUD for licensing bodies: DHA (Dubai), DOH (Abu Dhabi), MOHAP (UAE Northern Emirates), SCFHS (Saudi Arabia), OMSB (Oman), QCHP (Qatar), NHRA (Bahrain), Prometric, NCLEX.
     - Fields: Authority Name, Authority Code, Country, Active/Inactive switch, Description, Syllabus URL.
  2. `Services Master`:
     - Dynamic CRUD for examination components: Interactive Practice Questions, Timed Mock Examinations, High-Yield Study Guides, Flashcards, Clinical Case Scenarios, Video Lectures.
  3. `Packages Master`:
     - Package bundle builder: Link Examination + Included Services + Access Duration (30, 60, 90, 180 days) + Attempt Allowance + Price & Currency.
  4. `Profession Matrix`:
     - Map healthcare professions (General Practitioner, Registered Nurse, Dentist, Pharmacist, Radiographer, Physiotherapist) to eligible examinations and default packages.

#### Module 5: MCQ Practice Engine & Mock Test Engine
- **MCQ Practice Mode (Interactive Learning Engine)**:
  - Clean English UI (replacing hardcoded Tamil strings in `StudentPracticeRunner.tsx`).
  - Real-time question timer and category breadcrumb.
  - On selecting an option:
    - **Incorrect**: Instant red feedback border, vibration/sound cue, alert *"Incorrect. Review the question and try again."* Option remains disabled, but student can select another option. Correct answer is NOT disclosed.
    - **Correct**: Instant green celebration badge. Unlocks:
      1. Rationale / Detailed Clinical Explanation.
      2. **Strictly 3 Key Learning Points** (`rememberNote1`, `rememberNote2`, `rememberNote3`) highlighted in high-visibility learning cards.
      3. Unlocks "Next Question" button and updates session progress.
  - Persistent Session: Question state map stored on server/local storage so student can resume seamlessly.
- **Mock Test Mode (Exam Simulation Engine)**:
  - Header: Fixed countdown timer (HH:MM:SS) with warning at 5 minutes remaining.
  - Question Navigator Palette: Visual grid of numbered tiles indicating `Answered` (teal), `Unanswered` (slate), `Flagged for Review` (amber), and `Current` (ring).
  - Single Submission: Option selection updates local answer; no answer validation or explanations shown during the test.
  - Submit Confirmation Modal: Displays summary (`Answered: 45 / 50`, `Unanswered: 5`, `Flagged: 3`) with warning before final submit.
  - Timeout: Automatically triggers auto-submit when countdown hits `00:00:00`.
  - Post-Submission Score Report:
    - Big score hero banner (Percentage, Score / Total, Pass/Fail vs passing score).
    - Time spent breakdown.
    - `Review Mode`: Step-by-step walkthrough showing student answer vs correct answer with full clinical rationale.

#### Module 6: Dynamic PDF Viewer with Student Watermark
- **Component**: `frontend/src/components/common/WatermarkedPdfViewer.tsx`
- **Implementation**:
  - Renders PDF document pages using HTML5 canvas / `pdfjs-dist` or responsive SVG/iframe viewer.
  - **Dynamic Watermark Overlay**:
    - Semi-transparent, repeating diagonal canvas grid across every page.
    - Overlay text pattern:
      ```
      [Student Full Name] • [Student ID / Email]
      Accessed: [YYYY-MM-DD HH:mm:ss UTC] • Device: [Device Type]
      Confidential • Alpha Health Group Exam Academy
      ```
    - Watermark is rendered client-side on a dedicated overlay canvas with `pointer-events: none` and `user-select: none`.
  - **Content Access Protection**:
    - Context menu (right-click) disabled on viewer canvas.
    - CSS `@media print` rules hide document content or replace it with a blank page stating *"Printing is disabled for protected examination materials."*
    - Unpurchased or expired materials display a locked banner with contact coordinator button.

---

## 5. Verification Method

To independently verify the observations, structural findings, and build status:

1. **Verify Frontend Build & Typecheck**:
   ```powershell
   npm run build --prefix frontend
   ```
   *Expected outcome*: Exits with code 0 (`tsc -b && vite build` completes in ~7-8 seconds).

2. **Verify Frontend Code Linter**:
   ```powershell
   npm run lint --prefix frontend
   ```
   *Expected outcome*: Exits with code 0 (`oxlint` checks 164 files with 0 errors).

3. **Verify Dual Entrypoint in App.tsx**:
   Inspect `frontend/src/App.tsx`, lines 174-187 to confirm `/student` isolates `<StudentPortal />` outside `<CrmProvider>`.

4. **Verify Role Matrix Discrepancy**:
   - Check `frontend/src/types/index.ts`, line 1 (`UserRole` lacks `'finance_officer'`).
   - Check `backend/src/roleMatrix.js`, line 105 (`finance_officer` is defined with capabilities).

5. **Verify Zero Frontend Automated Tests**:
   - Check `frontend/package.json` dependencies (no `vitest`, `jest`, `playwright`, or `cypress`).
   - Run `find_by_name` on `frontend/src` for `*test*` or `*spec*` — returns 0 results.

6. **Verify Backend Automated Tests Run Cleanly**:
   ```powershell
   npm run test:runtime-config
   node --test backend/test-academic-content-rbac.test.js
   node --test backend/test-exam-upgrade.test.js
   ```
   *Expected outcome*: All test suites pass (4/4, 14/14, 14/14 tests pass).

### Invalidation Conditions
- If `finance_officer` is already present in `frontend/src/types/index.ts`, this observation is invalidated.
- If a frontend test runner (Vitest/Jest/Playwright) is discovered in `frontend/`, the testing gap finding is invalidated.
- If `ExamOperationsView.tsx` already contains a Return modal with mandatory reasons and a sales chat timeline, that specific gap is invalidated.
