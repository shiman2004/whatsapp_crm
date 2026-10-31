# Original User Request

## Initial Request — 2026-10-29T16:42:34Z

Develop a fully integrated Exam Department Management System within the existing CRM for Alpha Health Group (AHG), delivering the complete end-to-end workflow across all five phases (CRM Workflow, Student Account & Device Security, Payment & Approval, Examination Content System, and Monitoring & Reporting) for production launch.

Working directory: d:\Royal Project\whatsapp_crm
Integrity mode: development

## Requirements

### R1. CRM Workflow & Sales-to-Exam Handover
The system must manage the complete operational workflow from inquiry intake to case closure. Converted inquiries must automatically generate linked Exam Department cases (preserving original inquiry IDs, client discussion history, attachments, quotations, and staff attribution) and notify the Exam Department. Exam Managers must be able to accept, return, assign, and reassign cases with mandatory recorded reasons. Staff workspaces must provide role-based access for Super Administrators, Sales Officers, Exam Managers, Exam Processing Officers, and Finance Officers, alongside centralized dashboards, workload KPIs, reporting, and automated notifications across workflow events.

### R2. Student Account Management & Controlled Device Security
The system must manage student portal accounts using the student's personal email as username, with secure email verification, hashed passwords hidden from staff, and account lifecycle status tracking (Pending Activation, Email Verification Pending, Active, Suspended, Locked, Disabled). Existing students purchasing additional packages must link entitlements to their existing account without duplicate records. The portal must enforce a strict device policy allowing a maximum of two registered devices (strictly 1 Mobile Phone and 1 Desktop OR Laptop; never multiple computers or multiple phones). Only one concurrent active session is permitted across registered devices (logging into a second device terminates the session on the first). Any attempt to log in from an unregistered third device must block access and offer a Device Replacement Request requiring email verification, administrative approval, and automatic session revocation upon approval.

### R3. Quotation, Payment Verification & Maker-Checker Material Release
The system must track financial details (quotation number, total, discount, net amount, amount paid, balance, payment method, transaction reference, receipt upload, and verification status). The system must enforce a strict Maker-Checker approval process: an uploaded payment receipt alone must never release materials; Finance Officers must independently verify actual payment; Exam Officers select purchased material entitlements and submit release requests; and Exam Managers perform final authorization. Exam Officers must not be permitted to approve their own release requests. Upon final approval, the CRM must automatically activate purchased materials in the student portal, prevent duplicate release executions, and keep unpurchased materials locked.

### R4. Dynamic Masters & Examination Material Management with MCQ/Mock Engines
Super Administrators must be able to create, edit, activate, deactivate, and map Examinations (e.g., DHA, DOH, MOHAP, Saudi licensing, and other countries across professions), Services, and Packages dynamically without requiring code modifications. Authorized staff must be able to upload, review, and publish examination content (MCQs, practical questions, mock tests, watermarked PDFs, images, revision notes). The student portal must provide: (1) an interactive MCQ Practice Mode allowing retries upon incorrect answers and revealing explanations with three key learning points upon correct answer selection, (2) a timed Mock Examination Mode with fixed questions, single submission, score reporting, and review rules, and (3) a personalized dashboard displaying only purchased active package materials with watermarking and content access protection.

### R5. Audit Trail & Data Integrity
The CRM must record an immutable audit trail for every critical operational action (inquiry conversion, case assignment and reassignment with reason, account status change, device registration and revocation, payment verification, release request and approval, account suspension). All protected resources and workflow transition rules must be enforced on the backend.

## Verification Resources
The team must implement automated test suites (covering backend API endpoints, workflow state machines, and frontend student portal / dashboard interactions) that programmatically execute and pass each of the 20 User Acceptance Testing scenarios specified in Section 32 using the existing project testing setup.

## Acceptance Criteria

### CRM Workflow & Case Handover
- [ ] Converted sales inquiries automatically create an Exam case linked to the inquiry ID and notify the Exam Department.
- [ ] Exam Managers can accept, return, assign, and reassign cases, with reassignments requiring a mandatory recorded reason and immediate notification.
- [ ] Sales discussion history and attachments remain accessible to both Sales and Exam processing officers with department/sender attribution.

### Student Account & Device Registration
- [ ] Student portal accounts use the student's personal email; staff cannot view or set plaintext passwords.
- [ ] Subsequent purchases by an existing student link entitlements to the existing student account without creating duplicate student records.
- [ ] Device registration allows a maximum of 2 devices: strictly 1 mobile and 1 desktop or laptop (blocking 2 mobiles, 2 laptops, or 3+ devices).
- [ ] Attempting to access from an unauthorized third device blocks access and triggers a replacement request workflow.
- [ ] Approving a device replacement revokes the old device and terminates active sessions on that device.
- [ ] Only one concurrent session is permitted across registered devices; logging into a second device terminates the active session on the first.

### Payment Verification & Maker-Checker Release
- [ ] Uploading a receipt or marking an inquiry converted leaves materials locked until Finance confirms actual payment.
- [ ] Exam Processing Officers can submit material release requests but backend authorization prevents self-approval.
- [ ] Exam Manager approval triggers automatic material activation in the student portal and prevents duplicate releases on repeated retries.
- [ ] Partial payments or unverified payments restrict access according to configured payment policy.

### Dynamic Masters & Learning Portal
- [ ] Super Administrators can create, update, and map examinations, services, and packages dynamically without code changes.
- [ ] Practice Mode displays retry notifications on incorrect answers, and shows explanations with 3 key learning points upon correct answers.
- [ ] Mock Test Mode enforces time limits, single answer submissions, and post-submission scoring without disclosing correct answers during the test.
- [ ] Materials outside the student's purchased package remain locked and inaccessible.
- [ ] Protected study PDFs display dynamic watermarks containing student name, ID, email, and access date.

### Audit & Operational Compliance
- [ ] All 20 User Acceptance Testing scenarios specified in Section 32 pass in automated verification suites.
- [ ] Every status change, assignment, approval, rejection, and device modification is recorded in the immutable audit log.
- [ ] Role-based access control prevents unauthorized users from approving payments, releasing materials, or overriding device restrictions.



## Follow-up — 2026-10-29T20:10:28Z

The user asked you to continue. Your run stopped partway through Milestone 3 because of a temporary RESOURCE_EXHAUSTED (429) quota error, and the quota has reset since then. Resume from where you left off: worker_m3 was adding edge-case validations to UAT suites 10–13 and running workspace builds. Before you continue, check the current workspace state (PROJECT.md, GATE_STATUS.md, worker_m3 handoff/progress files and git status) in case any work was lost. After that, carry on with the Milestone 3 gate and Milestones 4–5 as planned.
