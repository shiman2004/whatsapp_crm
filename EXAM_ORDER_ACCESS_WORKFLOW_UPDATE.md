# Exam Order & Access Management Update

Implemented the first controlled Sales-to-Exam workflow slice in the active CRM.

- Added workflow states for email-verification pending, manager approval pending, returned for correction, approved activation pending, and on hold.
- Added audited manager actions: approve, return for correction, and reject.
- Manager approval now requires verified payment, the preparation checklist, and recorded student email verification.
- Access preparation is blocked until manager approval is recorded.
- Added payment and email verification status visibility in the Exam Operations detail view.
- Added a manager role to Exam Department access while preserving backend role checks.
- Existing transaction locking, revision checks, audit records, and entitlement safeguards remain in place.
- The email provider is still not configured; no real OTP or activation email is sent.

Validation completed:

- Frontend production build passed.
- Existing 14 exam/security workflow tests passed.

Remaining integration work for the full specification includes the Sales inquiry “Convert to Exam Order” button, provider-backed email OTP delivery, notification adapters, and live SLA dashboard metrics.
