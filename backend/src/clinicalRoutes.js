import crypto from 'node:crypto';
import { getPrisma } from './db.js';
import { ClinicalStore } from './clinicalStore.js';
import {
  ClinicalError, requireClinicalValue, isClinicalUser, isClinicalAdmin, canNurse, canDoctor, canAnalyst,
  cleanAssessmentInput, validateAssessment, findAssessmentProblems, buildVisitSummary,
} from './clinicalPolicy.js';

const now = () => new Date().toISOString();
const idPattern = /^[a-zA-Z0-9_-]{1,150}$/;

export async function readClinicalJson(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 200000) throw new ClinicalError(413, 'BODY_TOO_LARGE', 'Request too large.');
  }
  try { const value = JSON.parse(text || '{}'); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; }
  catch { throw new ClinicalError(400, 'INVALID_JSON', 'A JSON object is required.'); }
}

export function clinicalJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

function pushStatus(record, status, user, extra = {}) {
  record.status = status;
  record.statusHistory = [...(record.statusHistory || []), { status, at: now(), by: user.id, byName: user.fullName || user.email, ...extra }].slice(-100);
  record.updatedAt = now();
}

function canReadRecord(user, record) {
  if (isClinicalAdmin(user)) return true;
  if (user.role === 'clinical_nurse') return record.ownerId === user.id;
  if (user.role === 'clinical_doctor') return record.assignedDoctorId === user.id;
  if (user.role === 'report_analyst') return ['PENDING_REPORT_ANALYST', 'AI_DRAFT_GENERATED', 'ANALYST_REVIEW_COMPLETED', 'PENDING_DOCTOR_FINAL_APPROVAL', 'RETURNED_FOR_CORRECTION'].includes(record.status);
  return false;
}

function assertRecordAccess(user, record) { requireClinicalValue(record && canReadRecord(user, record), 'NOT_FOUND', 'Assessment not found.', 404); }

export async function handleClinicalRoutes(req, res, pathname, user) {
  if (!pathname.startsWith('/api/clinical')) return false;
  try {
    requireClinicalValue(isClinicalUser(user), 'FORBIDDEN', 'Clinical workspace access is required.', 403);
    const service = new ClinicalStore(getPrisma());
    if (pathname === '/api/clinical/assessments' && req.method === 'GET') {
      const records = await service.transaction(tx => tx.list('assessment'));
      clinicalJson(res, 200, { success: true, data: records.filter(record => canReadRecord(user, record)) });
    } else if (pathname === '/api/clinical/assessments' && req.method === 'POST') {
      requireClinicalValue(canNurse(user), 'FORBIDDEN', 'Only a clinical nurse can register an assessment.', 403);
      const input = cleanAssessmentInput(await readClinicalJson(req));
      requireClinicalValue(isClinicalAdmin(user) || !input.assignedNurseId || input.assignedNurseId === user.id, 'NURSE_ASSIGNMENT_FORBIDDEN', 'A clinical nurse can only register work assigned to their own queue.', 403);
      validateAssessment(input);
      const id = crypto.randomUUID();
      const record = await service.transaction(async tx => {
        const created = {
          id,
          assessmentNumber: 'RWC-A-' + new Date().toISOString().slice(0, 10).replaceAll('-', '') + '-' + crypto.randomUUID().slice(0, 6).toUpperCase(),
          kind: 'assessment', ownerId: input.assignedNurseId || user.id, nurseId: input.assignedNurseId || user.id, nurseName: input.assignedNurseName || user.fullName || user.email, createdBy: user.id,
          status: 'DRAFT', createdAt: now(), updatedAt: now(), ...input,
          visitSummary: buildVisitSummary(input.sex, input.requestedServices, input.visitType),
          problems: findAssessmentProblems(input), statusHistory: [{ status: 'DRAFT', at: now(), by: user.id, byName: user.fullName || user.email }],
          doctorAssessment: null, reportDraft: null, approval: null,
        };
        const saved = await tx.put('assessment', id, created);
        await tx.audit(user.id, 'clinical.assessment.created', id, { branch: created.branch, category: created.category });
        return saved;
      });
      clinicalJson(res, 201, { success: true, data: record });
    } else if (/^\/api\/clinical\/assessments\/[a-zA-Z0-9_-]+$/.test(pathname) && req.method === 'GET') {
      const id = pathname.split('/').pop();
      const record = await service.transaction(tx => tx.get('assessment', id));
      assertRecordAccess(user, record);
      clinicalJson(res, 200, { success: true, data: record });
    } else if (/^\/api\/clinical\/assessments\/[a-zA-Z0-9_-]+$/.test(pathname) && req.method === 'PATCH') {
      requireClinicalValue(canNurse(user), 'FORBIDDEN', 'Only a clinical nurse can edit an assessment.', 403);
      const id = pathname.split('/').pop();
      const body = await readClinicalJson(req);
      const saved = await service.transaction(async tx => {
        const record = await tx.get('assessment', id, true);
        assertRecordAccess(user, record);
        requireClinicalValue(record.ownerId === user.id || isClinicalAdmin(user), 'FORBIDDEN', 'Only the registering nurse can edit this assessment.', 403);
        requireClinicalValue(['DRAFT', 'ADDITIONAL_INFORMATION_REQUESTED', 'RETURNED_FOR_CORRECTION'].includes(record.status), 'INVALID_STATUS', 'This assessment is locked at its current stage.', 409);
        const merged = { ...record, ...cleanAssessmentInput({ ...record, ...body }), revision: record.revision };
        requireClinicalValue(isClinicalAdmin(user) || !merged.assignedNurseId || merged.assignedNurseId === user.id, 'NURSE_ASSIGNMENT_FORBIDDEN', 'A clinical nurse can only keep work in their own queue.', 403);
        validateAssessment(merged);
        merged.visitSummary = buildVisitSummary(merged.sex, merged.requestedServices, merged.visitType);
        merged.problems = findAssessmentProblems(merged);
        merged.updatedAt = now();
        const result = await tx.put('assessment', id, merged);
        await tx.audit(user.id, 'clinical.assessment.updated', id);
        return result;
      });
      clinicalJson(res, 200, { success: true, data: saved });
    } else if (/^\/api\/clinical\/assessments\/[a-zA-Z0-9_-]+\/submit$/.test(pathname) && req.method === 'POST') {
      requireClinicalValue(canNurse(user), 'FORBIDDEN', 'Only a clinical nurse can submit an assessment.', 403);
      const id = pathname.split('/')[4];
      const saved = await service.transaction(async tx => {
        const record = await tx.get('assessment', id, true);
        assertRecordAccess(user, record);
        requireClinicalValue(record.ownerId === user.id || isClinicalAdmin(user), 'FORBIDDEN', 'Only the registering nurse can submit this assessment.', 403);
        requireClinicalValue(['DRAFT', 'ADDITIONAL_INFORMATION_REQUESTED', 'RETURNED_FOR_CORRECTION'].includes(record.status), 'INVALID_STATUS', 'This assessment cannot be submitted now.', 409);
        validateAssessment(record, { forSubmit: true });
        record.problems = findAssessmentProblems(record, { forSubmit: true });
        requireClinicalValue(!record.problems.some(problem => problem.severity === 'error'), 'PROBLEMS_FOUND', 'Resolve the highlighted assessment problems before submitting.', 409);
        record.submittedAt = now();
        pushStatus(record, 'PENDING_DOCTOR_REVIEW', user);
        const result = await tx.put('assessment', id, record);
        await tx.audit(user.id, 'clinical.assessment.submitted', id, { assignedDoctorId: record.assignedDoctorId });
        return result;
      });
      clinicalJson(res, 200, { success: true, data: saved });
    } else if (/^\/api\/clinical\/assessments\/[a-zA-Z0-9_-]+\/doctor-assessment$/.test(pathname) && req.method === 'POST') {
      requireClinicalValue(canDoctor(user), 'FORBIDDEN', 'Doctor access is required.', 403);
      const id = pathname.split('/')[4];
      const body = await readClinicalJson(req);
      const saved = await service.transaction(async tx => {
        const record = await tx.get('assessment', id, true);
        assertRecordAccess(user, record);
        requireClinicalValue(isClinicalAdmin(user) || record.assignedDoctorId === user.id, 'FORBIDDEN', 'This assessment is assigned to another doctor.', 403);
        requireClinicalValue(['PENDING_DOCTOR_REVIEW', 'DOCTOR_ASSESSMENT_IN_PROGRESS'].includes(record.status), 'INVALID_STATUS', 'This assessment is not waiting for doctor review.', 409);
        const clinicalFindings = String(body.clinicalFindings || '').trim().slice(0, 8000);
        const clinicalImpression = String(body.clinicalImpression || '').trim().slice(0, 5000);
        const treatmentOutcome = String(body.treatmentOutcome || '').trim();
        requireClinicalValue(clinicalFindings.length >= 3 && clinicalImpression.length >= 3, 'ASSESSMENT_REQUIRED', 'Record clinical findings and impression.');
        requireClinicalValue(['recommended', 'further_investigation', 'not_suitable', 'specialist_referral'].includes(treatmentOutcome), 'OUTCOME_REQUIRED', 'Select a treatment outcome.');
        record.doctorAssessment = {
          clinicalFindings, clinicalImpression, differentialDiagnosis: String(body.differentialDiagnosis || '').trim().slice(0, 5000),
          treatmentOutcome, treatmentRecommendation: String(body.treatmentRecommendation || '').trim().slice(0, 5000),
          treatmentRationale: String(body.treatmentRationale || '').trim().slice(0, 5000), risksPrecautions: String(body.risksPrecautions || '').trim().slice(0, 5000),
          followUpPlan: String(body.followUpPlan || '').trim().slice(0, 5000), requestedInvestigations: Array.isArray(body.requestedInvestigations) ? body.requestedInvestigations.slice(0, 30) : [],
          doctorId: user.id, doctorName: user.fullName || user.email, completedAt: now(),
        };
        record.doctorAssessmentAt = now();
        pushStatus(record, 'PENDING_REPORT_ANALYST', user);
        const result = await tx.put('assessment', id, record);
        await tx.audit(user.id, 'clinical.assessment.doctor_completed', id);
        return result;
      });
      clinicalJson(res, 200, { success: true, data: saved });
    } else if (/^\/api\/clinical\/assessments\/[a-zA-Z0-9_-]+\/request-information$/.test(pathname) && req.method === 'POST') {
      requireClinicalValue(canDoctor(user), 'FORBIDDEN', 'Doctor access is required.', 403);
      const id = pathname.split('/')[4]; const body = await readClinicalJson(req);
      const saved = await service.transaction(async tx => {
        const record = await tx.get('assessment', id, true); assertRecordAccess(user, record);
        requireClinicalValue(isClinicalAdmin(user) || record.assignedDoctorId === user.id, 'FORBIDDEN', 'This assessment is assigned to another doctor.', 403);
        const request = String(body.request || '').trim().slice(0, 3000); requireClinicalValue(request.length >= 3, 'REQUEST_REQUIRED', 'Explain what information is needed.');
        record.informationRequest = { request, requestedBy: user.id, requestedAt: now() }; pushStatus(record, 'ADDITIONAL_INFORMATION_REQUESTED', user);
        const result = await tx.put('assessment', id, record); await tx.audit(user.id, 'clinical.assessment.information_requested', id); return result;
      }); clinicalJson(res, 200, { success: true, data: saved });
    } else if (/^\/api\/clinical\/assessments\/[a-zA-Z0-9_-]+\/analyst-draft$/.test(pathname) && req.method === 'POST') {
      requireClinicalValue(canAnalyst(user), 'FORBIDDEN', 'Report analyst access is required.', 403);
      const id = pathname.split('/')[4]; const body = await readClinicalJson(req);
      const saved = await service.transaction(async tx => {
        const record = await tx.get('assessment', id, true); assertRecordAccess(user, record);
        requireClinicalValue(['PENDING_REPORT_ANALYST', 'AI_DRAFT_GENERATED', 'ANALYST_REVIEW_COMPLETED', 'RETURNED_FOR_CORRECTION'].includes(record.status), 'INVALID_STATUS', 'This assessment is not in the analyst queue.', 409);
        const aiDraft = String(body.aiDraft || '').trim().slice(0, 30000); requireClinicalValue(aiDraft.length >= 20, 'DRAFT_REQUIRED', 'Add a meaningful report draft.');
        record.reportDraft = { aiDraft, analystNotes: String(body.analystNotes || '').trim().slice(0, 5000), templateId: String(body.templateId || '').trim().slice(0, 120), analystId: user.id, analystName: user.fullName || user.email, draftedAt: now(), status: 'AI_DRAFT_GENERATED' };
        record.analystReviewAt = now(); pushStatus(record, 'PENDING_DOCTOR_FINAL_APPROVAL', user);
        const result = await tx.put('assessment', id, record); await tx.audit(user.id, 'clinical.report.draft_prepared', id); return result;
      }); clinicalJson(res, 200, { success: true, data: saved });
    } else if (/^\/api\/clinical\/assessments\/[a-zA-Z0-9_-]+\/approve$/.test(pathname) && req.method === 'POST') {
      requireClinicalValue(canDoctor(user), 'FORBIDDEN', 'Doctor approval access is required.', 403);
      const id = pathname.split('/')[4]; const body = await readClinicalJson(req); const decision = String(body.decision || '').trim();
      const saved = await service.transaction(async tx => {
        const record = await tx.get('assessment', id, true); assertRecordAccess(user, record);
        requireClinicalValue(isClinicalAdmin(user) || record.assignedDoctorId === user.id, 'FORBIDDEN', 'This assessment is assigned to another doctor.', 403);
        requireClinicalValue(record.status === 'PENDING_DOCTOR_FINAL_APPROVAL', 'INVALID_STATUS', 'This assessment is not waiting for final approval.', 409);
        requireClinicalValue(['approve', 'return', 'reject'].includes(decision), 'DECISION_REQUIRED', 'Select approve, return, or reject.');
        const remarks = String(body.remarks || '').trim().slice(0, 5000);
        if (decision !== 'approve') requireClinicalValue(remarks.length >= 3, 'REMARKS_REQUIRED', 'Add remarks for a returned or rejected report.');
        record.approval = { decision, remarks, doctorId: user.id, doctorName: user.fullName || user.email, decidedAt: now() };
        pushStatus(record, decision === 'approve' ? 'DOCTOR_APPROVED' : decision === 'return' ? 'RETURNED_FOR_CORRECTION' : 'CANCELLED', user);
        const result = await tx.put('assessment', id, record); await tx.audit(user.id, 'clinical.report.' + decision, id); return result;
      }); clinicalJson(res, 200, { success: true, data: saved });
    } else if (/^\/api\/clinical\/assessments\/[a-zA-Z0-9_-]+\/problems\/check$/.test(pathname) && req.method === 'POST') {
      const id = pathname.split('/')[4];
      const saved = await service.transaction(async tx => {
        const record = await tx.get('assessment', id, true); assertRecordAccess(user, record);
        record.problems = findAssessmentProblems(record, { forSubmit: ['PENDING_DOCTOR_REVIEW', 'SUBMITTED_BY_NURSE'].includes(record.status) });
        record.problemCheckAt = now(); const result = await tx.put('assessment', id, record); await tx.audit(user.id, 'clinical.assessment.problems_checked', id); return result;
      }); clinicalJson(res, 200, { success: true, data: saved });
    } else {
      clinicalJson(res, 404, { success: false, error: 'Clinical route not found.' });
    }
  } catch (error) {
    clinicalJson(res, error instanceof ClinicalError ? error.status : 500, { success: false, code: error.code || 'INTERNAL_ERROR', error: error instanceof ClinicalError ? error.message : 'Unable to complete clinical operation.' });
  }
  return true;
}
