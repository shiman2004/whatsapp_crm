// Dedicated exam capabilities are deliberately separate from display job titles.
export const EXAM_CAPABILITIES = Object.freeze([
  'operations', 'finance', 'content', 'security', 'audit',
]);

export function canManageExam(user) {
  const title = String(user?.roleTitle || '').toLowerCase();
  return Boolean(user?.id && user.active !== false && (['super_admin', 'exam_department_manager'].includes(user.role) || title.includes('head of exam') || title.includes('exam department manager')));
}

export function canHandleExam(user) {
  const title = String(user?.roleTitle || '').toLowerCase();
  return Boolean(user?.id && user.active !== false && (canManageExam(user) || ['exam_coordinator', 'exam_providing_officer'].includes(user.role) || title.includes('exam providing') || title.includes('exam officer')));
}

// A normal coordinator may process an item only after the Head explicitly
// assigns it. The handoff action still enforces assignedOfficerId for every
// officer transition; this does not grant manager or reassignment privileges.
export function canHandleAssignedExam(user) {
  return canHandleExam(user) || Boolean(user?.id && user.active !== false && user.role === 'coordinator');
}

export function canSubmitExamRequirement(user) {
  return Boolean(user?.id && user.active !== false && (canManageExam(user) || ['super_admin', 'coordinator', 'leads_officer', 'sales_coordinator'].includes(user.role)));
}

// Legacy exam endpoints expose shared question keys and global student records.
// Until those records carry owner/department scope, only administrators may use
// them. Sales retain submission through the new ownership-scoped operations API.
export function legacyExamAccess(user) {
  if (!user?.id || user.active === false) return 401;
  return canManageExam(user) ? 200 : 403;
}

export const TRANSITIONS = Object.freeze({
  SUBMITTED: ['ACCEPTED', 'NEEDS_INFORMATION', 'REJECTED', 'CANCELLED'],
  NEEDS_INFORMATION: ['SUBMITTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'EMAIL_VERIFICATION_PENDING', 'CANCELLED'],
  EMAIL_VERIFICATION_PENDING: ['READY', 'PREPARING', 'CANCELLED'],
  READY: ['PENDING_MANAGER_APPROVAL', 'DELIVERED', 'PREPARING', 'CANCELLED'],
  PENDING_MANAGER_APPROVAL: ['APPROVED_ACTIVATION_PENDING', 'RETURNED_FOR_CORRECTION', 'REJECTED', 'ON_HOLD'],
  RETURNED_FOR_CORRECTION: ['PREPARING', 'PENDING_MANAGER_APPROVAL', 'CANCELLED'],
  APPROVED_ACTIVATION_PENDING: ['DELIVERED', 'ON_HOLD'],
  ON_HOLD: ['PREPARING', 'PENDING_MANAGER_APPROVAL', 'CANCELLED'],
  DELIVERED: ['CLOSED'], CLOSED: [], REJECTED: [], CANCELLED: [],
});

export class ExamError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function requireValue(condition, code, message, status = 400) {
  if (!condition) throw new ExamError(status, code, message);
}

export function validateHandoff(input) {
  const required = ['orderId', 'studentName', 'email', 'phone', 'country', 'timeZone', 'profession', 'authority', 'examName', 'packageId', 'packageVersion', 'startTrigger', 'currency'];
  for (const field of required) requireValue(typeof input[field] === 'string' && input[field].trim().length > 0 && input[field].length <= 500, 'INVALID_FIELD', 'Required field: ' + field);
  requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email), 'INVALID_EMAIL', 'Enter a valid student email.');
  try { new Intl.DateTimeFormat('en', { timeZone: input.timeZone }); } catch { throw new ExamError(400, 'INVALID_TIME_ZONE', 'Select a valid time zone.'); }
  requireValue(['activation', 'purchase', 'fixed'].includes(input.startTrigger), 'INVALID_START', 'Select an access start trigger.');
  requireValue(Number.isInteger(input.durationDays) && input.durationDays > 0 && input.durationDays <= 3650, 'INVALID_DURATION', 'Duration must be between 1 and 3650 days.');
  requireValue(Number.isInteger(input.attemptAllowance) && input.attemptAllowance > 0 && input.attemptAllowance <= 10000, 'INVALID_ATTEMPTS', 'Specify a valid attempt allowance.');
  requireValue(Number.isInteger(input.amountMinor) && input.amountMinor >= 0, 'INVALID_AMOUNT', 'Amount must be a nonnegative integer in minor currency units.');
  requireValue(/^[A-Z]{3}$/.test(input.currency), 'INVALID_CURRENCY', 'Currency must be a three-letter uppercase code.');
  if (input.startTrigger === 'fixed') requireValue(Number.isFinite(Date.parse(input.fixedStart)), 'INVALID_START', 'A fixed start date is required.');
  if (input.startTrigger === 'purchase') requireValue(Number.isFinite(Date.parse(input.purchasedAt)), 'INVALID_START', 'Purchase timestamp is required.');
  requireValue(Array.isArray(input.services) && input.services.length > 0 && input.services.length <= 100 && input.services.every(x => typeof x === 'string' && x.length <= 500), 'INVALID_SERVICES', 'List the included services.');
  return { ...input, email: input.email.trim().toLowerCase(), studentName: input.studentName.trim(), orderId: input.orderId.trim() };
}

export function checkTransition(record, next, reason) {
  requireValue(TRANSITIONS[record.status]?.includes(next), 'INVALID_TRANSITION', 'This status transition is not permitted.', 409);
  if (['REJECTED', 'CANCELLED', 'NEEDS_INFORMATION', 'RETURNED_FOR_CORRECTION', 'ON_HOLD'].includes(next)) requireValue(typeof reason === 'string' && reason.trim().length >= 3, 'REASON_REQUIRED', 'Provide a reason.');
  if (['PREPARING', 'READY', 'PENDING_MANAGER_APPROVAL', 'APPROVED_ACTIVATION_PENDING', 'DELIVERED'].includes(next)) requireValue(record.paymentStatus === 'VERIFIED', 'PAYMENT_REQUIRED', 'Finance must verify payment first.', 409);
  if (next === 'READY') requireValue(record.checklist?.account && record.checklist?.materials && record.checklist?.exams && record.checklist?.quality, 'CHECKLIST_REQUIRED', 'Complete account, materials, exam and quality checks.', 409);
  if (next === 'PENDING_MANAGER_APPROVAL') requireValue(record.checklist?.account && record.checklist?.materials && record.checklist?.exams && record.checklist?.quality, 'CHECKLIST_REQUIRED', 'Complete account, materials, exam and quality checks.', 409);
  if (next === 'DELIVERED') requireValue(record.entitlementId && (record.firstPortalAccessAt || (reason && reason.trim().length >= 10)), 'DELIVERY_CONFIRMATION_REQUIRED', 'Confirm active access and student entry, or record a delivery confirmation reason.', 409);
}
