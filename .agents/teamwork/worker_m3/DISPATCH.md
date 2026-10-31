# Task Assignment: Milestone 3 (Quotation, Payment Verification & Maker-Checker Material Release)

## Objectives
Implement the complete Phase 3 workflow satisfying requirements R3 and Section 32 UAT Scenarios 10 through 13:
1. **Financial Details & Receipt Gating (UAT 10)**:
   - Track quotation number, total, discount, net amount, paid amount, balance, payment method, transaction reference, receipt upload.
   - Converting inquiries or uploading receipts leaves study materials strictly locked (`paymentStatus = 'PENDING'`, `materialsStatus = 'LOCKED'`).
2. **Independent Finance Payment Verification (UAT 11)**:
   - Endpoint `POST /api/exam-ops/requirements/:orderId/verify-payment`.
   - Strictly restricted to `finance_officer` or `super_admin`. Reject Exam Officers and Exam Managers with HTTP 403 `FORBIDDEN`.
   - Updates `paymentStatus = 'VERIFIED'`, but materials remain locked until maker-checker release.
3. **Maker-Checker Release Request Submission (UAT 12)**:
   - Exam Processing Officer validates the 4-point checklist (`account`, `materials`, `exams`, `quality`) and submits release request.
   - Requires verified payment (`paymentStatus === 'VERIFIED'`).
   - Sets `status = 'PENDING_MANAGER_APPROVAL'` and stores `submittedByOfficerId = actor.id`.
4. **Maker-Checker Manager Approval & Self-Approval Prevention (UAT 12 & 13)**:
   - Endpoint `POST /api/exam-ops/requirements/:orderId/manager-approve`.
   - Authorized for `exam_department_manager` or `super_admin`.
   - **MANDATORY HARD CHECK**: If `actor.id === order.submittedByOfficerId`, reject with HTTP 403 `SELF_APPROVAL_FORBIDDEN` (Officers cannot approve their own release requests).
   - Approval transitions status to `MATERIALS_RELEASED` and automatically provisions material entitlements in the student portal (`studentAccess.addEntitlements` / `prepareAccess`).
   - **Idempotency**: Repeated calls or retries must be idempotent, returning the existing activation without duplicate entitlement records.
5. **Role & UI Updates**:
   - Ensure `finance_officer` is recognized in `backend/src/roleMatrix.js`, `backend/src/securityPolicy.js`, `frontend/src/types/index.ts`, and navigation.
   - Ensure release actions and status badges display in `ExamOperationsView.tsx`.
6. **Verification**:
   - Run: `node --test backend/tests/e2e/uat10-*.js backend/tests/e2e/uat11-*.js backend/tests/e2e/uat12-*.js backend/tests/e2e/uat13-*.js`
   - Run: `node backend/tests/e2e/run-all-uat.js`
   - Run: `npm run build --prefix frontend`


## 2026-10-29T19:39:38Z
You are assigned as the Milestone 3 Implementation Worker (Quotation, Payment Verification & Maker-Checker Material Release).
- Implement financial details & receipt gating (UAT 10)
- Independent finance payment verification (UAT 11)
- Maker-checker material release request (UAT 12)
- Maker-checker manager approval & self-approval prevention (UAT 12 & 13)
- Role matrix & UI updates
- Verification via tests and frontend build

