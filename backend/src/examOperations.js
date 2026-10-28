import crypto from 'node:crypto';
import { canManageExam, canHandleAssignedExam, canSubmitExamRequirement, requireValue, validateHandoff, checkTransition, ExamError } from './examPolicy.js';

const now = () => new Date().toISOString();
export const orderKey = order => crypto.createHash('sha256').update(order).digest('hex');
const fingerprint = input => crypto.createHash('sha256').update(JSON.stringify(Object.keys(input).sort().map(key => [key, input[key]]))).digest('hex');
const assertAdmin = user => requireValue(canManageExam(user), 'FORBIDDEN', 'Administrator permission required.', 403);
const mayRead = (user, record) => canManageExam(user) || record.ownerId === user.id;

export class ExamOperations {
  constructor(store) { this.store = store; }
  async list(user) {
    requireValue(canSubmitExamRequirement(user), 'FORBIDDEN', 'Exam sales access required.', 403);
    return this.store.transaction(tx => tx.list('requirement', canManageExam(user) ? null : user.id));
  }
  async submit(user, input) {
    requireValue(canSubmitExamRequirement(user), 'FORBIDDEN', 'Exam sales access required.', 403);
    // Whitelist the sold snapshot: callers cannot inject status, owner or payment approval.
    const allowed = ['orderId','studentName','email','phone','country','timeZone','profession','authority','examName','courseId','packageId','packageVersion','startTrigger','currency','durationDays','attemptAllowance','amountMinor','fixedStart','purchasedAt','services','language','priority','notes','requestedStart','accessibilityNeeds'];
    const clean = Object.fromEntries(allowed.filter(key => input[key] !== undefined).map(key => [key, input[key]]));
    const snapshot = validateHandoff(clean);
    const id = orderKey(snapshot.orderId);
    const digest = fingerprint(snapshot);
    return this.store.transaction(async tx => {
      await tx.lock('order:' + id);
      const previous = await tx.get('requirement', id, true);
      if (previous) {
        requireValue(mayRead(user, previous), 'ORDER_CONFLICT', 'Order reference already exists.', 409);
        requireValue(previous.snapshotDigest === digest, 'AMENDMENT_REQUIRED', 'This order already exists with different terms. Submit an amendment.', 409);
        return { ...previous, duplicate: true };
      }
      const record = { id, number: 'EX-' + crypto.randomUUID().slice(0, 8).toUpperCase(), ownerId: user.id, company: user.company || 'RWC', submittedAt: now(), status: 'SUBMITTED', paymentStatus: 'PENDING', emailVerificationStatus: 'PENDING', onboardingStatus: 'NOT_INVITED', coordinatorId: null, snapshot, snapshotDigest: digest, email: snapshot.email, checklist: {}, history: [{ at: now(), actorId: user.id, action: 'SUBMITTED' }] };
      await tx.put('requirement', id, record);
      await tx.audit(user.id, 'requirement.submitted', id);
      return record;
    });
  }

  async submitHandoff(user, input) {
    requireValue(canSubmitExamRequirement(user), 'FORBIDDEN', 'Sales access required to forward an exam handoff.', 403);
    const services = Array.isArray(input.services) ? [...new Set(input.services.map(value => String(value).trim()).filter(Boolean))] : [];
    const clean = {
      leadId: String(input.leadId || '').trim(),
      leadName: String(input.leadName || '').trim(),
      phone: String(input.phone || '').trim(),
      email: String(input.email || '').trim().toLowerCase(),
      profession: String(input.profession || '').trim(),
      requirementType: String(input.requirementType || '').trim(),
      examCountry: String(input.examCountry || '').trim(),
      examTitle: String(input.examTitle || '').trim(),
      authority: String(input.authority || '').trim(),
      priority: String(input.priority || '').trim(),
      services,
      quotationNumber: String(input.quotationNumber || '').trim(),
      clientName: String(input.clientName || '').trim(),
      clientEmail: String(input.clientEmail || '').trim().toLowerCase(),
      contactNumber: String(input.contactNumber || '').trim(),
      paymentReceiptUrl: String(input.paymentReceiptUrl || '').trim(),
      paymentReceiptFileName: String(input.paymentReceiptFileName || '').trim(),
      receiptVoucherUrl: String(input.receiptVoucherUrl || '').trim(),
      receiptVoucherFileName: String(input.receiptVoucherFileName || '').trim(),
      receiptVoucherNo: String(input.receiptVoucherNo || '').trim(),
      source: String(input.source || 'Sales Pipeline').trim(),
      company: String(input.company || 'RWC').trim().toUpperCase(),
      notes: String(input.notes || '').trim().slice(0, 2000)
    };
    requireValue(/^[a-zA-Z0-9_-]{1,150}$/.test(clean.leadId), 'INVALID_LEAD', 'A valid lead reference is required.');
    requireValue(clean.leadName.length >= 1 && clean.leadName.length <= 255, 'INVALID_LEAD', 'A lead name is required.');
    requireValue(['international', 'country_specific'].includes(clean.requirementType), 'REQUIREMENT_TYPE_REQUIRED', 'Select the exam requirement type.');
    requireValue(clean.examCountry.length >= 2 && clean.examCountry.length <= 120, 'EXAM_COUNTRY_REQUIRED', 'Exam country is required.');
    requireValue(clean.examTitle.length >= 2 && clean.examTitle.length <= 255, 'EXAM_TITLE_REQUIRED', 'Exam title is required.');
    requireValue(clean.authority.length >= 2 && clean.authority.length <= 120, 'AUTHORITY_REQUIRED', 'Exam authority is required.');
    requireValue(['urgent', 'regular_work'].includes(clean.priority), 'PRIORITY_REQUIRED', 'Select an exam handoff priority.');
    requireValue(services.length >= 1 && services.length <= 10 && services.every(value => ['exam_material', 'mock_test', 'model_study_question'].includes(value)), 'SERVICES_REQUIRED', 'Select at least one exam service.');
    requireValue(clean.quotationNumber.length >= 1 && clean.quotationNumber.length <= 120, 'QUOTATION_REQUIRED', 'Quotation number is required.');
    requireValue(clean.clientName.length >= 2 && clean.clientName.length <= 255, 'CLIENT_NAME_REQUIRED', 'Client name is required.');
    requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.clientEmail), 'CLIENT_EMAIL_REQUIRED', 'A valid client email is required.');
    requireValue(/^[+0-9()\-\s]{7,30}$/.test(clean.contactNumber), 'CONTACT_REQUIRED', 'A valid client contact number is required.');
    requireValue(/^\/uploads\/[A-Za-z0-9._-]+(?:\?sig=[A-Za-z0-9_-]+)?$/.test(clean.paymentReceiptUrl), 'PAYMENT_RECEIPT_REQUIRED', 'Attach a valid payment receipt.');
    requireValue(clean.receiptVoucherNo.length >= 1 && clean.receiptVoucherNo.length <= 120, 'RECEIPT_VOUCHER_REQUIRED', 'Receipt voucher number is required.');
    requireValue(/^\/uploads\/[A-Za-z0-9._-]+(?:\?sig=[A-Za-z0-9_-]+)?$/.test(clean.receiptVoucherUrl), 'RECEIPT_VOUCHER_FILE_REQUIRED', 'Attach the receipt voucher PDF.');
    return this.store.transaction(async tx => {
      const existing = (await tx.list('exam-handoff')).find(item => item.leadId === clean.leadId && !['DELIVERED_TO_CRM', 'CLOSED', 'CANCELLED'].includes(item.status));
      if (existing) return { ...existing, duplicate: true };
      const id = crypto.randomUUID();
      const record = {
        id,
        number: 'EH-' + crypto.randomUUID().slice(0, 8).toUpperCase(),
        kind: 'exam-handoff',
        ownerId: user.id,
        recipientRole: 'exam_department_manager',
        submittedBy: user.id,
        submittedByName: user.fullName || user.email || 'Sales team',
        submittedAt: now(),
        status: 'PENDING_ACCEPTANCE',
        leadId: clean.leadId,
        leadName: clean.leadName,
        phone: clean.phone,
        email: clean.email || clean.clientEmail,
        profession: clean.profession,
        requirementType: clean.requirementType,
        examCountry: clean.examCountry,
        examTitle: clean.examTitle,
        authority: clean.authority,
        priority: clean.priority,
        services: clean.services,
        quotationNumber: clean.quotationNumber,
        clientName: clean.clientName,
        clientEmail: clean.clientEmail,
        contactNumber: clean.contactNumber,
        paymentReceiptUrl: clean.paymentReceiptUrl,
        paymentReceiptFileName: clean.paymentReceiptFileName.slice(0, 255),
        receiptVoucherUrl: clean.receiptVoucherUrl,
        receiptVoucherFileName: clean.receiptVoucherFileName.slice(0, 255),
        receiptVoucherNo: clean.receiptVoucherNo,
        company: clean.company,
        source: clean.source,
        notes: clean.notes,
        assignedOfficerId: null,
        assignedOfficerName: null,
        history: [{ at: now(), actorId: user.id, action: 'FORWARDED_TO_EXAM_DEPARTMENT' }]
      };
      await tx.put('exam-handoff', id, record);
      await tx.audit(user.id, 'exam.handoff.forwarded', id, { leadId: clean.leadId, recipientRole: record.recipientRole });
      return record;
    });
  }

  async listHandoffs(user) {
    requireValue(canHandleAssignedExam(user) || canSubmitExamRequirement(user), 'FORBIDDEN', 'Exam handoff access required.', 403);
    return this.store.transaction(async tx => {
      if (canManageExam(user)) return tx.list('exam-handoff');
      // Officers must see assignments addressed to them (the handoff owner is
      // normally the salesperson who forwarded it, not the exam officer).
      return (await tx.list('exam-handoff')).filter(item => item.assignedOfficerId === user.id || item.ownerId === user.id);
    });
  }

  async updateHandoff(user, id, action, input = {}) {
    requireValue(canHandleAssignedExam(user), 'FORBIDDEN', 'Head of Exam or exam officer access required.', 403);
    return this.store.transaction(async tx => {
      const record = await tx.get('exam-handoff', id, true);
      requireValue(record, 'NOT_FOUND', 'Exam handoff not found.', 404);
      requireValue(Number.isInteger(input.revision) && input.revision === record.revision, 'STALE_RECORD', 'This handoff changed. Refresh before trying again.', 409);
      const reason = String(input.reason || '').trim().slice(0, 2000);
      const manager = canManageExam(user);
      if (action === 'accept') {
        requireValue(manager, 'FORBIDDEN', 'Only the Head of Exam Department can accept a handoff.', 403);
        requireValue(record.status === 'PENDING_ACCEPTANCE', 'INVALID_STATUS', 'This handoff has already been accepted or assigned.', 409);
        record.status = 'ACCEPTED';
        record.acceptedBy = user.id;
        record.acceptedByName = user.fullName || user.email;
        record.acceptedAt = now();
      } else if (action === 'assign') {
        requireValue(manager, 'FORBIDDEN', 'Only the Head of Exam Department can assign an exam officer.', 403);
        requireValue(['ACCEPTED', 'ASSIGNED'].includes(record.status), 'INVALID_STATUS', 'Accept the handoff before assigning an officer.', 409);
        const officerId = String(input.officerId || '').trim();
        const officerName = String(input.officerName || '').trim();
        requireValue(/^[a-zA-Z0-9_-]{1,150}$/.test(officerId) && officerName.length >= 1, 'OFFICER_REQUIRED', 'Select an exam providing officer.');
        record.status = 'ASSIGNED';
        record.assignedOfficerId = officerId;
        record.assignedOfficerName = officerName.slice(0, 255);
        record.assignedAt = now();
        record.assignedBy = user.id;
      } else if (action === 'accept-assignment') {
        requireValue(!manager, 'FORBIDDEN', 'This action is for the assigned exam officer.', 403);
        requireValue(record.status === 'ASSIGNED' && record.assignedOfficerId === user.id, 'ASSIGNMENT_REQUIRED', 'This handoff is assigned to another officer.', 403);
        record.status = 'OFFICER_ACCEPTED';
        record.officerAcceptedBy = user.id;
        record.officerAcceptedByName = user.fullName || user.email;
        record.officerAcceptedAt = now();
      } else if (action === 'start') {
        requireValue(record.status === 'OFFICER_ACCEPTED' && record.assignedOfficerId === user.id, 'ASSIGNMENT_REQUIRED', 'The assigned exam officer must accept this handoff before starting work.', 403);
        record.status = 'IN_PROGRESS';
        record.startedAt = now();
      } else if (action === 'complete') {
        requireValue(record.status === 'IN_PROGRESS' && record.assignedOfficerId === user.id, 'ASSIGNMENT_REQUIRED', 'Only the assigned exam officer can complete this handoff.', 403);
        record.status = 'DELIVERED_TO_CRM';
        record.completedAt = now();
        record.completionNote = reason;
      } else {
        throw new ExamError(404, 'UNKNOWN_ACTION', 'Handoff action not found.');
      }
      record.history = [...(record.history || []), { at: now(), actorId: user.id, action, status: record.status, reason }];
      const saved = await tx.put('exam-handoff', id, record);
      await tx.audit(user.id, 'exam.handoff.' + action, id, { reason, assignedOfficerId: record.assignedOfficerId });
      return saved;
    });
  }
  async update(user, id, action, input = {}) {
    return this.store.transaction(async tx => {
      const record = await tx.get('requirement', id, true);
      requireValue(record && mayRead(user, record), 'NOT_FOUND', 'Requirement not found.', 404);
      requireValue(Number.isInteger(input.revision) && input.revision === record.revision, 'STALE_RECORD', 'This record changed. Refresh before trying again.', 409);
      const reason = String(input.reason || '').trim().slice(0, 2000);
      const details = { reason };
      if (action === 'amend') {
        requireValue(['SUBMITTED','NEEDS_INFORMATION'].includes(record.status), 'AMENDMENT_LOCKED', 'Accepted work needs an administrator-managed change request.', 409);
        requireValue(reason.length >= 3, 'REASON_REQUIRED', 'Explain the amendment.');
        const snapshot = validateHandoff({ ...record.snapshot, ...input.changes, orderId: record.snapshot.orderId });
        await tx.put('revision', crypto.randomUUID(), { requirementId: id, snapshot: record.snapshot, changedAt: now(), actorId: user.id });
        record.snapshot = snapshot;
        record.snapshotDigest = fingerprint(snapshot);
        record.email = snapshot.email;
        record.status = 'SUBMITTED';
      } else if (action === 'verify-payment') {
        assertAdmin(user);
        requireValue(typeof input.reference === 'string' && input.reference.trim().length >= 3, 'REFERENCE_REQUIRED', 'Payment verification reference is required.');
        record.paymentStatus = 'VERIFIED';
        record.paymentReference = input.reference.trim().slice(0, 500);
        record.paymentVerifiedBy = user.id;
        record.paymentVerifiedAt = now();
      } else if (action === 'checklist') {
        assertAdmin(user);
        requireValue(['ACCEPTED','PREPARING'].includes(record.status), 'INVALID_STATUS', 'Accept this requirement before preparing it.', 409);
        for (const key of ['account','materials','exams','quality','contact']) if (typeof input[key] === 'boolean') record.checklist[key] = input[key];
      } else if (action === 'contact') {
        assertAdmin(user);
        requireValue(['email','phone','whatsapp','other'].includes(input.channel) && reason.length >= 3, 'INVALID_CONTACT', 'Record a channel and contact outcome.');
        record.lastContactAt = now();
        await tx.put('contact', crypto.randomUUID(), { requirementId: id, ownerId: record.ownerId, channel: input.channel, outcome: reason, at: now(), staffId: user.id });
      } else if (action === 'manager-approve') {
        assertAdmin(user);
        requireValue(record.status === 'PENDING_MANAGER_APPROVAL', 'INVALID_STATUS', 'This order is not waiting for manager approval.', 409);
        requireValue(record.paymentStatus === 'VERIFIED', 'PAYMENT_REQUIRED', 'Payment must be verified before approval.', 409);
        requireValue(record.emailVerificationStatus === 'VERIFIED', 'EMAIL_NOT_VERIFIED', 'Student email verification is required before approval.', 409);
        requireValue(record.checklist?.account && record.checklist?.materials && record.checklist?.exams && record.checklist?.quality, 'CHECKLIST_REQUIRED', 'Complete the required preparation checklist before approval.', 409);
        record.status = 'APPROVED_ACTIVATION_PENDING';
        record.managerApproval = { decision: 'APPROVED', managerId: user.id, decidedAt: now(), comments: reason };
      } else if (action === 'manager-return') {
        assertAdmin(user);
        requireValue(record.status === 'PENDING_MANAGER_APPROVAL', 'INVALID_STATUS', 'This order is not waiting for manager approval.', 409);
        requireValue(reason.length >= 3, 'REASON_REQUIRED', 'Explain what must be corrected.');
        record.status = 'RETURNED_FOR_CORRECTION';
        record.managerApproval = { decision: 'RETURNED', managerId: user.id, decidedAt: now(), comments: reason };
      } else if (action === 'manager-reject') {
        assertAdmin(user);
        requireValue(record.status === 'PENDING_MANAGER_APPROVAL', 'INVALID_STATUS', 'This order is not waiting for manager approval.', 409);
        requireValue(reason.length >= 3, 'REASON_REQUIRED', 'Provide the rejection reason.');
        record.status = 'REJECTED';
        record.managerApproval = { decision: 'REJECTED', managerId: user.id, decidedAt: now(), comments: reason };
      } else if (action === 'mark-email-verified') {
        assertAdmin(user);
        requireValue(['EMAIL_VERIFICATION_PENDING', 'PREPARING', 'READY'].includes(record.status), 'INVALID_STATUS', 'Email verification is not available at this stage.', 409);
        requireValue(reason.length >= 3, 'VERIFICATION_EVIDENCE_REQUIRED', 'Record how the student email was verified.');
        record.emailVerificationStatus = 'VERIFIED';
        record.emailVerifiedAt = now();
        record.emailVerifiedBy = user.id;
      } else if (action === 'transition') {
        assertAdmin(user);
        checkTransition(record, input.status, reason);
        if (input.status === 'ACCEPTED') {
          requireValue(!record.coordinatorId, 'ALREADY_ASSIGNED', 'Requirement already assigned.', 409);
          record.coordinatorId = user.id;
          record.acceptedAt = now();
        }
        if (input.status === 'DELIVERED') {
          const access = await tx.get('entitlement', record.entitlementId, true);
          requireValue(access?.status === 'ACTIVE' && (!access.endsAt || Date.parse(access.endsAt) > Date.now()) && (!access.startsAt || Date.parse(access.startsAt) <= Date.now()), 'ACCESS_REQUIRED', 'Current active access is required to confirm delivery.', 409);
          record.deliveredAt = now();
        }
        record.status = input.status;
      } else if (action === 'prepare-access') {
        assertAdmin(user);
        requireValue(record.status === 'APPROVED_ACTIVATION_PENDING' && record.paymentStatus === 'VERIFIED', 'NOT_READY', 'Manager approval is required before preparing access.', 409);
        requireValue(!record.entitlementId, 'ACCESS_EXISTS', 'Access has already been prepared.', 409);
        // Verified identity and activation are handled by the student authentication service.
        const studentId = orderKey(record.email);
        await tx.lock('student:' + studentId);
        let student = await tx.get('student', studentId, true);
        if (!student) student = await tx.put('student', studentId, { id: studentId, email: record.email, name: record.snapshot.studentName, status: 'PENDING', generation: 0 });
        const entitlementId = crypto.randomUUID();
        const terms = record.snapshot;
        const startsAt = terms.startTrigger === 'fixed' ? new Date(terms.fixedStart).toISOString() : terms.startTrigger === 'purchase' ? new Date(terms.purchasedAt).toISOString() : student.activatedAt || null;
        const endsAt = startsAt ? new Date(Date.parse(startsAt) + terms.durationDays * 86400000).toISOString() : null;
        const assets = Array.isArray(input.materialIds) ? [...new Set(input.materialIds)] : [];
        requireValue(assets.length > 0 && assets.length <= 100 && assets.every(x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,150}$/.test(x)), 'MATERIALS_REQUIRED', 'Assign at least one published material ID.');
        // Validate assets against the actual library before selling delivery as complete.
        for (const assetId of assets) {
          const asset = await tx.get('asset', assetId);
          requireValue(asset?.status === 'PUBLISHED', 'ASSET_NOT_PUBLISHED', 'Each assigned material must be published.', 409);
        }
        await tx.put('entitlement', entitlementId, { id: entitlementId, studentId, requirementId: id, ownerId: studentId, courseId: terms.courseId || null, packageId: terms.packageId, packageVersion: terms.packageVersion, services: terms.services, materialIds: assets, durationDays: terms.durationDays, attemptAllowance: terms.attemptAllowance, startTrigger: terms.startTrigger, startsAt, endsAt, status: 'ACTIVE', approvedBy: user.id });
        record.entitlementId = entitlementId;
        record.studentId = studentId;
        record.onboardingStatus = student.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING_INVITATION';
      } else {
        throw new ExamError(404, 'UNKNOWN_ACTION', 'Action not found.');
      }
      record.history = [...(record.history || []), { at: now(), actorId: user.id, action, status: record.status, reason }];
      const saved = await tx.put('requirement', id, record);
      await tx.audit(user.id, 'requirement.' + action, id, details);
      return saved;
    });
  }
  async health(user) {
    assertAdmin(user);
    return this.store.transaction(async tx => {
      const records = await tx.list('requirement');
      const outbox = await tx.list('outbox');
      const issues = [];
      for (const r of records) {
        if (r.paymentStatus === 'VERIFIED' && !r.entitlementId && !['CANCELLED','REJECTED'].includes(r.status)) issues.push({ id: r.id + ':access', severity: 'warning', title: 'Verified purchase awaiting access', requirement: r.number });
        if (['ACCEPTED','PREPARING','READY'].includes(r.status) && !r.coordinatorId) issues.push({ id: r.id + ':owner', severity: 'error', title: 'Accepted requirement has no coordinator', requirement: r.number });
        if (r.status === 'SUBMITTED' && Date.now() - Date.parse(r.submittedAt) > 86400000) issues.push({ id: r.id + ':age', severity: 'warning', title: 'Submission older than 24 elapsed hours', requirement: r.number });
      }
      for (const item of outbox) if (item.status === 'FAILED') issues.push({ id: item.id, severity: 'error', title: 'Student email delivery failed', requirement: item.requirementId });
      return { checkedAt: now(), storage: 'connected', issues, coverage: 'Up to 500 recent records; elapsed-hour checks. Business calendars, backups, external delivery and security monitoring require separate verification.' };
    });
  }
}
