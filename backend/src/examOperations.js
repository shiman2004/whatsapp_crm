import crypto from 'node:crypto';
import { canManageExam, canHandleExam, canHandleAssignedExam, canSubmitExamRequirement, canVerifyPayment, isExamDepartmentManager, requireValue, validateHandoff, checkTransition, ExamError } from './examPolicy.js';

const now = () => new Date().toISOString();
export const orderKey = order => crypto.createHash('sha256').update(order).digest('hex');
const fingerprint = input => crypto.createHash('sha256').update(JSON.stringify(Object.keys(input).sort().map(key => [key, input[key]]))).digest('hex');
const assertAdmin = user => requireValue(canManageExam(user), 'FORBIDDEN', 'Administrator permission required.', 403);
const mayRead = (user, record) => canManageExam(user) || record.ownerId === user.id || record.coordinatorId === user.id || record.assignedOfficerId === user.id || canVerifyPayment(user);

export class ExamOperations {
  constructor(store) { this.store = store; }
  async list(user) {
    requireValue(canSubmitExamRequirement(user), 'FORBIDDEN', 'Exam sales access required.', 403);
    return this.store.transaction(tx => tx.list('requirement', canManageExam(user) ? null : user.id));
  }
  async submit(user, input) {
    requireValue(canSubmitExamRequirement(user), 'FORBIDDEN', 'Exam sales access required.', 403);
    // Whitelist the sold snapshot: callers cannot inject status, owner or payment approval.
    const allowed = ['orderId','studentName','email','phone','country','timeZone','profession','authority','examName','courseId','packageId','packageVersion','startTrigger','currency','durationDays','attemptAllowance','amountMinor','fixedStart','purchasedAt','services','language','priority','notes','requestedStart','accessibilityNeeds','quotationNumber','total','discount','netAmount','amountPaid','paidAmount','balance','paymentMethod','transactionReference','paymentReceiptUrl','receiptVoucherNo','receiptVoucherUrl'];
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
      const record = { id, number: 'EX-' + crypto.randomUUID().slice(0, 8).toUpperCase(), ownerId: user.id, company: user.company || 'RWC', submittedAt: now(), status: 'SUBMITTED', paymentStatus: 'PENDING', materialsStatus: 'LOCKED', emailVerificationStatus: 'PENDING', onboardingStatus: 'NOT_INVITED', coordinatorId: null, snapshot, snapshotDigest: digest, email: snapshot.email, checklist: {}, history: [{ at: now(), actorId: user.id, action: 'SUBMITTED' }] };
      await tx.put('requirement', id, record);
      await tx.audit(user.id, 'requirement.submitted', id);
      return record;
    });
  }

  async _notify(tx, record, { recipientId, recipientRole, title, message, eventType }) {
    const notifId = crypto.randomUUID();
    const notif = {
      id: notifId,
      kind: 'notification',
      recipientId: recipientId || null,
      recipientRole: recipientRole || null,
      title,
      message,
      handoffId: record?.id || null,
      eventType: eventType || 'general',
      read: false,
      createdAt: now()
    };
    if (record) {
      record.notifications = [...(record.notifications || []), {
        id: notifId,
        title,
        message,
        recipientId: recipientId || null,
        recipientRole: recipientRole || null,
        eventType,
        at: now()
      }];
    }
    try {
      await tx.put('notification', notifId, notif);
    } catch {
      // Non-fatal if storage double doesn't store notifications table
    }
    return notif;
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
      quotationTotal: input.quotationTotal !== undefined ? Number(input.quotationTotal) : (input.total !== undefined ? Number(input.total) : null),
      discount: input.discount !== undefined ? Number(input.discount) : 0,
      netAmount: input.netAmount !== undefined ? Number(input.netAmount) : null,
      amountPaid: input.amountPaid !== undefined ? Number(input.amountPaid) : (input.paidAmount !== undefined ? Number(input.paidAmount) : 0),
      balance: input.balance !== undefined ? Number(input.balance) : null,
      paymentMethod: String(input.paymentMethod || '').trim(),
      transactionReference: String(input.transactionReference || input.reference || '').trim(),
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

    // Build preserved discussion history
    const initialNotes = [];
    const sourceHistory = Array.isArray(input.discussionHistory) ? input.discussionHistory : (Array.isArray(input.customerDiscussionHistory) ? input.customerDiscussionHistory : []);
    for (const item of sourceHistory) {
      if (item && (item.content || item.text)) {
        initialNotes.push({
          id: item.id || crypto.randomUUID(),
          senderId: item.senderId || user.id,
          senderName: item.senderName || user.fullName || 'Sales Team',
          senderRole: item.senderRole || user.role || 'sales_coordinator',
          department: item.department || 'Sales',
          content: String(item.content || item.text).trim().slice(0, 5000),
          createdAt: item.createdAt || now(),
          attachments: Array.isArray(item.attachments) ? item.attachments : []
        });
      }
    }
    if (clean.notes && initialNotes.length === 0) {
      initialNotes.push({
        id: crypto.randomUUID(),
        senderId: user.id,
        senderName: user.fullName || user.email || 'Sales team',
        senderRole: user.role || 'sales_coordinator',
        department: 'Sales',
        content: clean.notes,
        createdAt: now(),
        attachments: []
      });
    }

    // Build preserved attachments
    const initialAttachments = [];
    if (Array.isArray(input.attachments)) {
      for (const item of input.attachments) {
        if (item && item.url) {
          initialAttachments.push({
            id: item.id || crypto.randomUUID(),
            url: String(item.url),
            fileName: String(item.fileName || 'Attachment').slice(0, 255),
            fileType: String(item.fileType || 'document').slice(0, 50),
            uploadedBy: item.uploadedBy || user.id,
            uploadedByName: item.uploadedByName || user.fullName || 'Sales team',
            uploadedAt: item.uploadedAt || now(),
            department: item.department || 'Sales'
          });
        }
      }
    }
    if (clean.paymentReceiptUrl && !initialAttachments.some(a => a.url === clean.paymentReceiptUrl)) {
      initialAttachments.push({
        id: crypto.randomUUID(),
        url: clean.paymentReceiptUrl,
        fileName: clean.paymentReceiptFileName || 'Payment Receipt',
        fileType: 'payment_receipt',
        uploadedBy: user.id,
        uploadedByName: user.fullName || 'Sales team',
        uploadedAt: now(),
        department: 'Sales'
      });
    }
    if (clean.receiptVoucherUrl && !initialAttachments.some(a => a.url === clean.receiptVoucherUrl)) {
      initialAttachments.push({
        id: crypto.randomUUID(),
        url: clean.receiptVoucherUrl,
        fileName: clean.receiptVoucherFileName || 'Receipt Voucher',
        fileType: 'receipt_voucher',
        uploadedBy: user.id,
        uploadedByName: user.fullName || 'Sales team',
        uploadedAt: now(),
        department: 'Sales'
      });
    }

    return this.store.transaction(async tx => {
      const existing = (await tx.list('exam-handoff')).find(item => item.leadId === clean.leadId && !['DELIVERED_TO_CRM', 'CLOSED', 'CANCELLED', 'RETURNED_TO_SALES'].includes(item.status));
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
        paymentStatus: 'PENDING',
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
        quotationTotal: clean.quotationTotal,
        discount: clean.discount,
        netAmount: clean.netAmount,
        amountPaid: clean.amountPaid,
        balance: clean.balance,
        paymentMethod: clean.paymentMethod,
        transactionReference: clean.transactionReference,
        materialsStatus: 'LOCKED',
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
        discussionHistory: initialNotes,
        attachments: initialAttachments,
        notifications: [],
        assignedOfficerId: null,
        assignedOfficerName: null,
        history: [{ at: now(), actorId: user.id, action: 'FORWARDED_TO_EXAM_DEPARTMENT', status: 'PENDING_ACCEPTANCE' }]
      };
      await this._notify(tx, record, {
        recipientRole: 'exam_department_manager',
        title: `New Exam Handoff: ${clean.leadName}`,
        message: `Sales forwarded lead ${clean.leadName} (${record.number}) for ${clean.examTitle}.`,
        eventType: 'exam.handoff.forwarded'
      });
      const saved = await tx.put('exam-handoff', id, record);
      await tx.audit(user.id, 'exam.handoff.forwarded', id, { leadId: clean.leadId, quotationNumber: clean.quotationNumber, recipientRole: record.recipientRole });
      return saved;
    });
  }

  async getHandoff(user, id) {
    requireValue(canHandleAssignedExam(user) || canSubmitExamRequirement(user) || canVerifyPayment(user), 'FORBIDDEN', 'Exam handoff access required.', 403);
    return this.store.transaction(async tx => {
      const record = await tx.get('exam-handoff', id);
      requireValue(record, 'NOT_FOUND', 'Exam handoff not found.', 404);
      if (!canManageExam(user) && !canVerifyPayment(user) && record.assignedOfficerId !== user.id && record.ownerId !== user.id) {
        throw new ExamError(403, 'FORBIDDEN', 'Access to this handoff is restricted.');
      }
      return record;
    });
  }

  async listHandoffs(user) {
    requireValue(canHandleAssignedExam(user) || canSubmitExamRequirement(user) || canVerifyPayment(user), 'FORBIDDEN', 'Exam handoff access required.', 403);
    return this.store.transaction(async tx => {
      if (canManageExam(user) || canVerifyPayment(user)) return tx.list('exam-handoff');
      // Officers must see assignments addressed to them (the handoff owner is
      // normally the salesperson who forwarded it, not the exam officer).
      return (await tx.list('exam-handoff')).filter(item => item.assignedOfficerId === user.id || item.ownerId === user.id);
    });
  }

  async listNotifications(user) {
    return this.store.transaction(async tx => {
      const all = await tx.list('notification');
      return all.filter(n =>
        n.recipientId === user.id ||
        (n.recipientRole && n.recipientRole === user.role) ||
        (canManageExam(user) && n.recipientRole === 'exam_department_manager') ||
        (canVerifyPayment(user) && n.recipientRole === 'finance_officer')
      );
    });
  }

  async updateHandoff(user, id, action, input = {}) {
    requireValue(canHandleAssignedExam(user) || canSubmitExamRequirement(user) || canVerifyPayment(user), 'FORBIDDEN', 'Exam handoff access required.', 403);
    return this.store.transaction(async tx => {
      const record = await tx.get('exam-handoff', id, true);
      requireValue(record, 'NOT_FOUND', 'Exam handoff not found.', 404);
      requireValue(Number.isInteger(input.revision) && input.revision === record.revision, 'STALE_RECORD', 'This handoff changed. Refresh before trying again.', 409);
      const reason = String(input.reason || '').trim().slice(0, 2000);
      const manager = canManageExam(user);

      if (action === 'verify-payment') {
        if (isExamDepartmentManager(user) && user.role !== 'super_admin') {
          throw new ExamError(403, 'FORBIDDEN', 'Exam Managers cannot verify payments. Independent Finance Officer verification is required.');
        }
        if (!canVerifyPayment(user)) {
          throw new ExamError(403, 'FORBIDDEN', 'Only a Finance Officer or Super Admin can verify payments.');
        }
        requireValue(typeof input.reference === 'string' && input.reference.trim().length >= 3, 'REFERENCE_REQUIRED', 'Payment verification reference is required.');
        record.paymentStatus = 'VERIFIED';
        record.paymentReference = input.reference.trim().slice(0, 500);
        record.paymentVerifiedBy = user.id;
        record.paymentVerifiedByName = user.fullName || user.email || 'Finance Officer';
        record.paymentVerifiedAt = now();
        record.materialsStatus = 'LOCKED';
        await this._notify(tx, record, {
          recipientRole: 'exam_department_manager',
          title: `Payment Verified: ${record.leadName}`,
          message: `Finance verified payment for case ${record.number} (Ref: ${record.paymentReference}).`,
          eventType: 'exam.handoff.payment_verified'
        });
      } else if (action === 'accept') {
        requireValue(manager, 'FORBIDDEN', 'Only the Head of Exam Department can accept a handoff.', 403);
        requireValue(record.status === 'PENDING_ACCEPTANCE', 'INVALID_STATUS', 'This handoff has already been accepted or assigned.', 409);
        record.status = 'ACCEPTED';
        record.acceptedBy = user.id;
        record.acceptedByName = user.fullName || user.email || 'Head of Exam';
        record.acceptedAt = now();
        await this._notify(tx, record, {
          recipientId: record.ownerId,
          recipientRole: 'sales_coordinator',
          title: `Handoff Accepted: ${record.leadName}`,
          message: `Head of Exam accepted case ${record.number} for ${record.examTitle}.`,
          eventType: 'exam.handoff.accept'
        });
      } else if (action === 'assign') {
        requireValue(manager, 'FORBIDDEN', 'Only the Head of Exam Department can assign an exam officer.', 403);
        requireValue(['ACCEPTED', 'ASSIGNED', 'OFFICER_ACCEPTED', 'IN_PROGRESS'].includes(record.status), 'INVALID_STATUS', 'Accept the handoff before assigning an officer.', 409);
        const officerId = String(input.officerId || '').trim();
        const officerName = String(input.officerName || '').trim();
        requireValue(/^[a-zA-Z0-9_-]{1,150}$/.test(officerId) && officerName.length >= 1, 'OFFICER_REQUIRED', 'Select an exam providing officer.');

        const isReassignment = Boolean(record.assignedOfficerId && (record.assignedOfficerId !== officerId || record.status !== 'ACCEPTED'));
        if (isReassignment || ['ASSIGNED', 'OFFICER_ACCEPTED', 'IN_PROGRESS'].includes(record.status)) {
          requireValue(reason.length >= 3, 'REASON_REQUIRED', 'A reason of at least 3 characters is required for reassignment.');
        }

        const previousOfficerId = record.assignedOfficerId;
        const previousOfficerName = record.assignedOfficerName;

        record.status = 'ASSIGNED';
        record.assignedOfficerId = officerId;
        record.assignedOfficerName = officerName.slice(0, 255);
        record.assignedAt = now();
        record.assignedBy = user.id;
        record.assignmentReason = reason;

        if (isReassignment) {
          record.previousOfficerId = previousOfficerId;
          record.previousOfficerName = previousOfficerName;
          record.reassignmentReason = reason;
          record.reassignedAt = now();
        }

        await this._notify(tx, record, {
          recipientId: officerId,
          recipientRole: 'exam_providing_officer',
          title: isReassignment ? `Case Reassigned: ${record.leadName}` : `New Exam Assignment: ${record.leadName}`,
          message: isReassignment
            ? `Case ${record.number} was reassigned to you. Reason: ${reason}`
            : `You have been assigned to case ${record.number} (${record.examTitle}). ${reason ? 'Reason: ' + reason : ''}`,
          eventType: 'exam.handoff.assign'
        });

        if (isReassignment && previousOfficerId) {
          await this._notify(tx, record, {
            recipientId: previousOfficerId,
            recipientRole: 'exam_providing_officer',
            title: `Case Reassigned: ${record.leadName}`,
            message: `Case ${record.number} has been reassigned to ${officerName}. Reason: ${reason}`,
            eventType: 'exam.handoff.reassigned_from'
          });
        }
      } else if (action === 'return') {
        requireValue(manager, 'FORBIDDEN', 'Only the Head of Exam Department can return a handoff to sales.', 403);
        requireValue(['PENDING_ACCEPTANCE', 'ACCEPTED', 'ASSIGNED', 'OFFICER_ACCEPTED', 'IN_PROGRESS'].includes(record.status), 'INVALID_STATUS', 'Cannot return a completed or cancelled handoff.', 409);
        requireValue(reason.length >= 3, 'REASON_REQUIRED', 'A reason of at least 3 characters is required to return a handoff to sales.');
        record.status = 'RETURNED_TO_SALES';
        record.returnedAt = now();
        record.returnedBy = user.id;
        record.returnedByName = user.fullName || user.email || 'Head of Exam';
        record.returnReason = reason;
        await this._notify(tx, record, {
          recipientId: record.ownerId,
          recipientRole: 'sales_coordinator',
          title: `Case Returned to Sales: ${record.leadName}`,
          message: `Exam Department returned case ${record.number}. Reason: ${reason}`,
          eventType: 'exam.handoff.return'
        });
      } else if (action === 'accept-assignment') {
        requireValue(!manager, 'FORBIDDEN', 'This action is for the assigned exam officer.', 403);
        requireValue(record.status === 'ASSIGNED', 'INVALID_STATUS', 'This handoff is not pending officer acceptance.', 409);
        requireValue(record.assignedOfficerId === user.id, 'ASSIGNMENT_REQUIRED', 'This handoff is assigned to another officer.', 403);
        record.status = 'OFFICER_ACCEPTED';
        record.officerAcceptedBy = user.id;
        record.officerAcceptedByName = user.fullName || user.email;
        record.officerAcceptedAt = now();
        await this._notify(tx, record, {
          recipientRole: 'exam_department_manager',
          title: `Requirement Accepted: ${record.leadName}`,
          message: `Officer ${user.fullName || user.email} accepted assignment for case ${record.number}.`,
          eventType: 'exam.handoff.accept-assignment'
        });
      } else if (action === 'start') {
        requireValue(record.assignedOfficerId === user.id, 'ASSIGNMENT_REQUIRED', 'Only the assigned exam officer can start this work.', 403);
        requireValue(record.status === 'OFFICER_ACCEPTED', 'ASSIGNMENT_REQUIRED', 'The assigned exam officer must accept this handoff before starting work.', 403);
        record.status = 'IN_PROGRESS';
        record.startedAt = now();
        await this._notify(tx, record, {
          recipientRole: 'exam_department_manager',
          title: `Work Started: ${record.leadName}`,
          message: `Officer ${user.fullName || user.email} started preparation for case ${record.number}.`,
          eventType: 'exam.handoff.start'
        });
      } else if (action === 'complete') {
        requireValue(record.assignedOfficerId === user.id, 'ASSIGNMENT_REQUIRED', 'Only the assigned exam officer can complete this handoff.', 403);
        requireValue(record.status === 'IN_PROGRESS', 'ASSIGNMENT_REQUIRED', 'Work must be in progress before completion.', 403);
        record.status = 'DELIVERED_TO_CRM';
        record.completedAt = now();
        record.completionNote = reason;
        await this._notify(tx, record, {
          recipientRole: 'exam_department_manager',
          title: `Case Delivered to CRM: ${record.leadName}`,
          message: `Officer ${user.fullName || user.email} delivered case ${record.number} to CRM. ${reason ? 'Note: ' + reason : ''}`,
          eventType: 'exam.handoff.complete'
        });
        if (record.ownerId) {
          await this._notify(tx, record, {
            recipientId: record.ownerId,
            recipientRole: 'sales_coordinator',
            title: `Exam Handoff Delivered: ${record.leadName}`,
            message: `Materials delivered to CRM for lead ${record.leadName} (${record.number}).`,
            eventType: 'exam.handoff.delivered_to_sales'
          });
        }
      } else if (action === 'add-note') {
        const mayNote = manager || record.assignedOfficerId === user.id || record.ownerId === user.id;
        requireValue(mayNote, 'FORBIDDEN', 'Access required to add notes to this case.', 403);
        const noteText = String(input.text || input.content || input.note || '').trim().slice(0, 5000);
        requireValue(noteText.length >= 1, 'NOTE_REQUIRED', 'Discussion note cannot be empty.');
        const isExamStaff = manager || ['exam_coordinator', 'exam_providing_officer'].includes(user.role);
        const newAttachments = Array.isArray(input.attachments) ? input.attachments.map(att => ({
          id: att.id || crypto.randomUUID(),
          url: String(att.url),
          fileName: String(att.fileName || 'Attachment').slice(0, 255),
          fileType: String(att.fileType || 'document').slice(0, 50),
          uploadedBy: user.id,
          uploadedByName: user.fullName || user.email || 'Staff',
          uploadedAt: now(),
          department: isExamStaff ? 'Exam Department' : 'Sales'
        })) : [];
        const note = {
          id: crypto.randomUUID(),
          senderId: user.id,
          senderName: user.fullName || user.email || (isExamStaff ? 'Exam Staff' : 'Sales Team'),
          senderRole: user.role || 'staff',
          department: isExamStaff ? 'Exam Department' : 'Sales',
          content: noteText,
          createdAt: now(),
          attachments: newAttachments
        };
        record.discussionHistory = [...(record.discussionHistory || []), note];
        if (newAttachments.length > 0) {
          record.attachments = [...(record.attachments || []), ...newAttachments];
        }
        const targetRecipientId = isExamStaff ? record.ownerId : record.assignedOfficerId;
        if (targetRecipientId) {
          await this._notify(tx, record, {
            recipientId: targetRecipientId,
            title: `New Note on Case: ${record.leadName}`,
            message: `${note.senderName} (${note.department}): ${noteText.slice(0, 100)}`,
            eventType: 'exam.handoff.note'
          });
        }
      } else {
        throw new ExamError(404, 'UNKNOWN_ACTION', 'Handoff action not found.');
      }

      record.history = [...(record.history || []), { at: now(), actorId: user.id, action, status: record.status, reason }];
      const saved = await tx.put('exam-handoff', id, record);
      await tx.audit(user.id, 'exam.handoff.' + action, id, { reason, assignedOfficerId: record.assignedOfficerId, status: record.status });
      return saved;
    });
  }
  async update(user, id, action, input = {}) {
    return this.store.transaction(async tx => {
      let record = await tx.get('requirement', id, true);
      if (!record && typeof id === 'string') {
        const hashed = orderKey(id);
        const candidate = await tx.get('requirement', hashed, true);
        if (candidate) {
          record = candidate;
          id = hashed;
        }
      }
      if (!record && typeof id === 'string') {
        const all = await tx.list('requirement');
        const candidate = all.find(r => r.snapshot?.orderId === id || r.number === id || r.id === id);
        if (candidate) {
          record = candidate;
          id = candidate.id;
        }
      }
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
        if (isExamDepartmentManager(user) && user.role !== 'super_admin') {
          throw new ExamError(403, 'FORBIDDEN', 'Exam Managers cannot verify payments. Independent Finance Officer verification is required.');
        }
        if (!canVerifyPayment(user)) {
          throw new ExamError(403, 'FORBIDDEN', 'Only a Finance Officer or Super Admin can verify payments.');
        }
        requireValue(typeof input.reference === 'string' && input.reference.trim().length >= 3, 'REFERENCE_REQUIRED', 'Payment verification reference is required.');
        record.paymentStatus = 'VERIFIED';
        record.paymentReference = input.reference.trim().slice(0, 500);
        record.paymentVerifiedBy = user.id;
        record.paymentVerifiedAt = now();
        if (!record.materialsStatus || record.materialsStatus === 'PENDING') {
          record.materialsStatus = 'LOCKED';
        }
      } else if (action === 'checklist') {
        requireValue(canManageExam(user) || canHandleExam(user), 'FORBIDDEN', 'Exam staff permission required.', 403);
        requireValue(['ACCEPTED','PREPARING','READY'].includes(record.status), 'INVALID_STATUS', 'Accept this requirement before preparing it.', 409);
        for (const key of ['account','materials','exams','quality','contact']) if (typeof input[key] === 'boolean') record.checklist[key] = input[key];
      } else if (action === 'release-request' || action === 'submit-release-request') {
        requireValue(canManageExam(user) || canHandleExam(user), 'FORBIDDEN', 'Exam staff permission required.', 403);
        requireValue(record.paymentStatus === 'VERIFIED', 'PAYMENT_REQUIRED', 'Finance must verify payment first.', 409);
        if (input.checklist && typeof input.checklist === 'object') {
          for (const key of ['account','materials','exams','quality']) {
            if (typeof input.checklist[key] === 'boolean') record.checklist[key] = input.checklist[key];
          }
        }
        requireValue(record.checklist?.account && record.checklist?.materials && record.checklist?.exams && record.checklist?.quality, 'CHECKLIST_REQUIRED', 'Complete the 4-point checklist before submitting release request.', 409);
        record.status = 'PENDING_MANAGER_APPROVAL';
        record.submittedByOfficerId = input.submittedByOfficerId || user.id;
        record.releaseRequestedAt = now();
        record.releaseRequestedBy = user.id;
      } else if (action === 'contact') {
        assertAdmin(user);
        requireValue(['email','phone','whatsapp','other'].includes(input.channel) && reason.length >= 3, 'INVALID_CONTACT', 'Record a channel and contact outcome.');
        record.lastContactAt = now();
        await tx.put('contact', crypto.randomUUID(), { requirementId: id, ownerId: record.ownerId, channel: input.channel, outcome: reason, at: now(), staffId: user.id });
      } else if (action === 'manager-approve') {
        assertAdmin(user);
        if (record.submittedByOfficerId && record.submittedByOfficerId === user.id) {
          throw new ExamError(403, 'SELF_APPROVAL_FORBIDDEN', 'Officers cannot approve their own release requests.');
        }
        if (record.status === 'APPROVED_ACTIVATION_PENDING' || record.status === 'MATERIALS_RELEASED') {
          return { ...record, duplicate: true };
        }
        requireValue(record.status === 'PENDING_MANAGER_APPROVAL', 'INVALID_STATUS', 'This order is not waiting for manager approval.', 409);
        requireValue(record.paymentStatus === 'VERIFIED', 'PAYMENT_REQUIRED', 'Payment must be verified before approval.', 409);
        requireValue(record.emailVerificationStatus === 'VERIFIED', 'EMAIL_NOT_VERIFIED', 'Student email verification is required before approval.', 409);
        requireValue(record.checklist?.account && record.checklist?.materials && record.checklist?.exams && record.checklist?.quality, 'CHECKLIST_REQUIRED', 'Complete the required preparation checklist before approval.', 409);
        record.status = 'APPROVED_ACTIVATION_PENDING';
        record.materialsStatus = 'MATERIALS_RELEASED';
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
        if (input.status === 'READY' || input.status === 'PENDING_MANAGER_APPROVAL') {
          requireValue(canManageExam(user) || canHandleExam(user), 'FORBIDDEN', 'Exam staff permission required.', 403);
        } else {
          assertAdmin(user);
        }
        if (input.checklist && typeof input.checklist === 'object') {
          for (const key of ['account','materials','exams','quality']) {
            if (typeof input.checklist[key] === 'boolean') record.checklist[key] = input.checklist[key];
          }
        }
        checkTransition(record, input.status, reason);
        if (input.status === 'ACCEPTED') {
          requireValue(!record.coordinatorId, 'ALREADY_ASSIGNED', 'Requirement already assigned.', 409);
          record.coordinatorId = user.id;
          record.acceptedAt = now();
        }
        if (input.status === 'PENDING_MANAGER_APPROVAL') {
          const officerId = input.submittedByOfficerId || (user.role !== 'exam_department_manager' && user.role !== 'super_admin' ? user.id : null) || input.officerId || record.assignedOfficerId;
          if (officerId) {
            record.submittedByOfficerId = officerId;
          }
          record.releaseRequestedAt = now();
          record.releaseRequestedBy = user.id;
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
        record.materialsStatus = 'MATERIALS_RELEASED';
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
