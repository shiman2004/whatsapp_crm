// Dedicated exam capabilities are deliberately separate from display job titles.
import { resolvePermission } from './securityPolicy.js';

export const EXAM_CAPABILITIES = Object.freeze([
  'operations', 'finance', 'content', 'security', 'audit',
  'exam.academic.view',
  'exam.course.create_draft',
  'exam.material.create_draft',
  'exam.question.create_draft',
  'exam.mock_test.create_draft',
  'exam.draft.edit_own',
  'exam.draft.submit',
  'exam.content.review',
  'exam.content.publish',
  'exam.content.delete',
  'exam.permissions.manage'
]);

export function isExamDepartmentManager(user) {
  const title = String(user?.roleTitle || '').toLowerCase();
  return Boolean(user?.id && (user.role === 'exam_department_manager' || title.includes('head of exam') || title.includes('exam department manager')));
}

export function canVerifyPayment(user) {
  const title = String(user?.roleTitle || '').toLowerCase();
  return Boolean(user?.id && user.active !== false && (['finance_officer', 'super_admin'].includes(user.role) || title.includes('finance')));
}

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

export function canAccessAcademic(user) {
  if (!user?.id || user.active === false) return 401;
  return (canManageExam(user) || ['exam_coordinator', 'exam_providing_officer'].includes(user.role)) ? 200 : 403;
}

export function hasExamCapability(user, capability, context = {}) {
  if (!user?.id || user.active === false) return false;
  const role = user.role;
  const isManager = role === 'exam_department_manager' || canManageExam(user);

  const decision = resolvePermission(user, capability, context);
  if (!decision.allowed) return false;
  if (isManager) return true;

  const resource = context.resource || (context.created_by || context.createdBy || context.uploadedBy ? context : null);

  switch (capability) {
    case 'exam.draft.edit_own': {
      if (role !== 'exam_coordinator' && role !== 'exam_providing_officer') return false;
      if (resource) {
        const creatorId = resource.createdBy || resource.created_by || resource.uploadedBy || resource.uploaded_by || resource.authorId;
        const status = String(resource.status || '').toUpperCase().replace(/\s+/g, '_');
        if (status === 'PUBLISHED' || status === 'ACTIVE') return false;
        if (status === 'PENDING_REVIEW') return false;
        if (creatorId && String(creatorId) !== String(user.id)) return false;
      }
      return true;
    }

    case 'exam.draft.submit': {
      if (role !== 'exam_coordinator' && role !== 'exam_providing_officer') return false;
      if (resource) {
        const creatorId = resource.createdBy || resource.created_by || resource.uploadedBy || resource.uploaded_by;
        const status = String(resource.status || '').toUpperCase().replace(/\s+/g, '_');
        if (status === 'PUBLISHED' || status === 'ACTIVE' || status === 'PENDING_REVIEW') return false;
        if (creatorId && String(creatorId) !== String(user.id)) return false;
      }
      return true;
    }

    case 'exam.content.delete': {
      if (isManager) return true;
      if (resource) {
        const creatorId = resource.createdBy || resource.created_by || resource.uploadedBy || resource.uploaded_by;
        const status = String(resource.status || '').toUpperCase().replace(/\s+/g, '_');
        if (status === 'DRAFT' && creatorId && String(creatorId) === String(user.id)) return true;
      }
      return false;
    }

    case 'exam.content.review':
    case 'exam.content.publish':
      return false;

    default:
      return true;
  }
}

export const ACADEMIC_LIFECYCLE = Object.freeze({
  DRAFT: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['CHANGES_REQUESTED', 'PUBLISHED', 'DRAFT'],
  CHANGES_REQUESTED: ['DRAFT', 'PENDING_REVIEW'],
  PUBLISHED: ['DRAFT'],
  ACTIVE: ['DRAFT'],
});

export function checkAcademicTransition(currentStatus, targetAction, user, context = {}) {
  const isManager = canManageExam(user);
  const statusNormalized = String(currentStatus || 'DRAFT').toUpperCase().replace(/\s+/g, '_');

  switch (targetAction) {
    case 'submit_for_review':
      requireValue(['DRAFT', 'CHANGES_REQUESTED'].includes(statusNormalized), 'INVALID_TRANSITION', 'Only drafts or returned items can be submitted for review.', 409);
      if (!isManager) {
        const creatorId = context.resource?.createdBy || context.resource?.created_by || context.resource?.uploadedBy || context.resource?.uploaded_by;
        requireValue(creatorId && String(creatorId) === String(user.id), 'FORBIDDEN', 'You can only submit your own drafts for review.', 403);
      }
      return 'Pending_Review';

    case 'request_changes':
      requireValue(isManager, 'FORBIDDEN', 'Only the Exam Department Manager can request revisions.', 403);
      requireValue(statusNormalized === 'PENDING_REVIEW', 'INVALID_TRANSITION', 'Changes can only be requested for submissions pending review.', 409);
      requireValue(typeof context.comments === 'string' && context.comments.trim().length >= 3, 'COMMENTS_REQUIRED', 'Provide feedback comments for requested changes.', 400);
      return 'Changes_Requested';

    case 'publish':
      requireValue(isManager, 'FORBIDDEN', 'Only the Exam Department Manager can publish academic content.', 403);
      requireValue(['DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED'].includes(statusNormalized), 'INVALID_TRANSITION', 'Invalid transition to published.', 409);
      return 'Published';

    case 'retract_to_draft':
      if (!isManager) {
        const creatorId = context.resource?.createdBy || context.resource?.created_by || context.resource?.uploadedBy || context.resource?.uploaded_by;
        requireValue(creatorId && String(creatorId) === String(user.id), 'FORBIDDEN', 'You can only retract your own submissions.', 403);
      }
      requireValue(statusNormalized !== 'PUBLISHED' && statusNormalized !== 'ACTIVE', 'INVALID_TRANSITION', 'Published content cannot be retracted by authors.', 409);
      return 'Draft';

    default:
      throw new ExamError(400, 'INVALID_ACTION', 'Unknown lifecycle transition action: ' + targetAction);
  }
}

export function validateAcademicUpload(fileMeta = {}) {
  const fileName = fileMeta.fileName || fileMeta.name;
  const fileSize = fileMeta.fileSize || fileMeta.size;

  const prohibitedExtensions = ['.exe', '.sh', '.bat', '.cmd', '.js', '.vbs', '.scr', '.msi'];
  const allowedExtensions = [
    '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
    '.txt', '.csv', '.rtf', '.png', '.jpg', '.jpeg', '.webp', '.zip', '.mp4'
  ];

  if (fileName) {
    const ext = '.' + String(fileName).split('.').pop().toLowerCase();
    if (prohibitedExtensions.includes(ext)) {
      throw new ExamError(400, 'PROHIBITED_FILE_TYPE', `Security restriction: ${ext} is a prohibited file type.`);
    }
    requireValue(allowedExtensions.includes(ext), 'INVALID_FILE_TYPE', `File type ${ext} is not supported. Use PDF, Word, PowerPoint, Excel, image, or MP4.`);
  }

  if (fileSize) {
    const maxDirectUploadBytes = 25 * 1024 * 1024; // 25 MB
    if (fileSize > maxDirectUploadBytes && !fileMeta.externalUrl) {
      throw new ExamError(400, 'FILE_TOO_LARGE', 'Direct upload exceeds 25MB maximum allowed size. For larger files, provide an external cloud storage URL.');
    }
  }
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
