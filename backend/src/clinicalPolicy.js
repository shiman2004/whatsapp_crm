export const CLINICAL_STATUSES = Object.freeze([
  'DRAFT',
  'SUBMITTED_BY_NURSE',
  'PENDING_DOCTOR_REVIEW',
  'ADDITIONAL_INFORMATION_REQUESTED',
  'DOCTOR_ASSESSMENT_IN_PROGRESS',
  'DOCTOR_ASSESSMENT_COMPLETED',
  'PENDING_REPORT_ANALYST',
  'AI_DRAFT_GENERATED',
  'ANALYST_REVIEW_COMPLETED',
  'PENDING_DOCTOR_FINAL_APPROVAL',
  'RETURNED_FOR_CORRECTION',
  'DOCTOR_APPROVED',
  'PDF_GENERATED',
  'DELIVERED_TO_PATIENT',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
]);

export const VISIT_TYPES = Object.freeze(['treatment', 'consultation', 'follow_up']);
export const REQUESTED_SERVICES = Object.freeze([
  'Hair transplant', 'Beard transplant', 'Hair growth treatment', 'Scalp PRP', 'Hair loss consultation',
  'Face treatment', 'Hydrafacial', 'Acne treatment', 'Pigmentation treatment', 'Skin rejuvenation',
  'Anti-aging treatment', 'Scar treatment', 'General skin consultation', 'General wellness consultation', 'Other',
]);

export class ClinicalError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function requireClinicalValue(condition, code, message, status = 400) {
  if (!condition) throw new ClinicalError(status, code, message);
}

export function isClinicalUser(user) {
  return Boolean(user?.id && user.active !== false && ['super_admin', 'clinical_nurse', 'clinical_doctor', 'report_analyst'].includes(user.role));
}
export function isClinicalAdmin(user) { return Boolean(user?.id && user.active !== false && user.role === 'super_admin'); }
export function canNurse(user) { return isClinicalAdmin(user) || user?.role === 'clinical_nurse'; }
export function canDoctor(user) { return isClinicalAdmin(user) || user?.role === 'clinical_doctor'; }
export function canAnalyst(user) { return isClinicalAdmin(user) || user?.role === 'report_analyst'; }
export function canViewAllClinical(user) { return isClinicalAdmin(user); }

const trim = (value, max = 500) => String(value ?? '').trim().slice(0, max);
export function cleanAssessmentInput(input = {}) {
  const consent = input.consent && typeof input.consent === 'object' ? input.consent : {};
  const files = Array.isArray(input.files) ? input.files.slice(0, 30).map(file => ({
    id: trim(file.id, 120),
    fileName: trim(file.fileName || file.name, 255),
    mimeType: trim(file.mimeType || file.type, 100),
    category: trim(file.category, 80),
    mediaUrl: trim(file.mediaUrl || file.url, 1000),
    uploadedAt: trim(file.uploadedAt, 50) || new Date().toISOString(),
  })).filter(file => file.fileName || file.mediaUrl) : [];
  return {
    patientName: trim(input.patientName, 255),
    contactNumber: trim(input.contactNumber, 50),
    email: trim(input.email, 255).toLowerCase(),
    dateOfBirth: trim(input.dateOfBirth, 30),
    age: input.age === '' || input.age == null ? null : Number(input.age),
    sex: trim(input.sex, 40),
    visitType: trim(input.visitType, 40).toLowerCase(),
    requestedServices: Array.isArray(input.requestedServices)
      ? [...new Set(input.requestedServices.map(value => trim(value, 160)).filter(Boolean))].slice(0, 20)
      : [],
    branch: trim(input.branch, 80),
    category: trim(input.category, 100),
    concernTypes: Array.isArray(input.concernTypes)
      ? [...new Set(input.concernTypes.map(value => trim(value, 160)).filter(Boolean))].slice(0, 20)
      : (trim(input.concernType, 160) ? [trim(input.concernType, 160)] : []),
    // Keep a readable legacy field for existing reports and older clients.
    concernType: Array.isArray(input.concernTypes)
      ? [...new Set(input.concernTypes.map(value => trim(value, 160)).filter(Boolean))].slice(0, 20).join(', ')
      : trim(input.concernType, 160),
    concern: trim(input.concern, 3000),
    medicalHistory: input.medicalHistory && typeof input.medicalHistory === 'object' ? input.medicalHistory : {},
    measurements: Array.isArray(input.measurements) ? input.measurements.slice(0, 50) : [],
    medications: Array.isArray(input.medications) ? input.medications.slice(0, 50) : [],
    allergies: Array.isArray(input.allergies) ? input.allergies.slice(0, 50) : [],
    labs: Array.isArray(input.labs) ? input.labs.slice(0, 50) : [],
    assignedDoctorId: trim(input.assignedDoctorId, 150),
    assignedDoctorName: trim(input.assignedDoctorName, 255),
    assignedNurseId: trim(input.assignedNurseId, 150),
    assignedNurseName: trim(input.assignedNurseName, 255),
    consent: {
      clinicalPhotography: consent.clinicalPhotography === true,
      dataProcessing: consent.dataProcessing === true,
      signedBy: trim(consent.signedBy, 255),
      signedAt: trim(consent.signedAt, 50),
    },
    files,
  };
}

export function validateAssessment(input, { forSubmit = false } = {}) {
  const selectedConcerns = Array.isArray(input.concernTypes) ? input.concernTypes : (input.concernType ? [input.concernType] : []);
  requireClinicalValue(input.patientName.length >= 2, 'PATIENT_REQUIRED', 'Patient name is required.');
  requireClinicalValue(input.contactNumber.length >= 7, 'CONTACT_REQUIRED', 'A valid patient contact number is required.');
  if (input.email) requireClinicalValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email), 'EMAIL_INVALID', 'Enter a valid patient email.');
  requireClinicalValue(['Colombo', 'Maruthamunai'].includes(input.branch), 'BRANCH_REQUIRED', 'Select a clinic branch.');
  requireClinicalValue(input.category.length >= 2, 'CATEGORY_REQUIRED', 'Select an assessment category.');
  requireClinicalValue(VISIT_TYPES.includes(input.visitType), 'VISIT_TYPE_REQUIRED', 'Select treatment, consultation, or follow-up.');
  requireClinicalValue(Array.isArray(input.requestedServices) && input.requestedServices.length >= 1 && input.requestedServices.every(service => REQUESTED_SERVICES.includes(service)), 'SERVICES_REQUIRED', 'Select at least one requested service.');
  requireClinicalValue(selectedConcerns.length >= 1, 'CONCERN_REQUIRED', 'Select at least one patient concern.');
  if (input.age !== null) requireClinicalValue(Number.isInteger(input.age) && input.age >= 0 && input.age <= 130, 'AGE_INVALID', 'Enter a valid age.');
  if (forSubmit) {
    requireClinicalValue(input.assignedNurseId.length > 0, 'NURSE_REQUIRED', 'Assign a nurse before submitting.');
    requireClinicalValue(input.assignedDoctorId.length > 0, 'DOCTOR_REQUIRED', 'Assign a doctor before submitting.');
    requireClinicalValue(input.consent.clinicalPhotography && input.consent.dataProcessing, 'CONSENT_REQUIRED', 'Both clinical photography and data processing consent are required.');
    requireClinicalValue(input.files.length > 0, 'FILES_REQUIRED', 'Upload at least one clinical photo or document.');
    requireClinicalValue(input.files.every(file => /^\/uploads\/[A-Za-z0-9._?=&-]+$/.test(file.mediaUrl)), 'FILES_INVALID', 'Clinical attachments must come from the secure media uploader.');
  }
  return true;
}

export function buildVisitSummary(sex, services, visitType) {
  const pronoun = String(sex || '').toLowerCase() === 'male' ? 'He' : String(sex || '').toLowerCase() === 'female' ? 'She' : 'The patient';
  const verb = visitType === 'consultation' ? 'came for a consultation about' : visitType === 'follow_up' ? 'came for a follow-up about' : 'came for';
  return `${pronoun} ${verb} ${services.join(', ').toLowerCase()}.`;
}

export function findAssessmentProblems(record, { forSubmit = false } = {}) {
  const problems = [];
  const add = (code, severity, message, field) => problems.push({ code, severity, message, field });
  if (!record.patientName) add('PATIENT_NAME_MISSING', 'error', 'Patient name is missing.', 'patientName');
  if (!record.contactNumber) add('CONTACT_MISSING', 'error', 'Patient contact number is missing.', 'contactNumber');
  if (!record.branch) add('BRANCH_MISSING', 'error', 'Clinic branch is missing.', 'branch');
  if (!record.category) add('CATEGORY_MISSING', 'error', 'Assessment category is missing.', 'category');
  if (!record.visitType) add('VISIT_TYPE_MISSING', 'error', 'Visit type has not been selected.', 'visitType');
  if (!Array.isArray(record.requestedServices) || record.requestedServices.length === 0) add('SERVICES_MISSING', 'error', 'Requested service has not been selected.', 'requestedServices');
  if (!(Array.isArray(record.concernTypes) ? record.concernTypes.length : record.concernType)) add('CONCERN_MISSING', 'error', 'Patient concern has not been selected.', 'concernTypes');
  if (!record.consent?.clinicalPhotography) add('PHOTO_CONSENT_MISSING', 'error', 'Clinical photography consent has not been recorded.', 'consent.clinicalPhotography');
  if (!record.consent?.dataProcessing) add('DATA_CONSENT_MISSING', 'error', 'Data processing consent has not been recorded.', 'consent.dataProcessing');
  if (forSubmit && !record.assignedDoctorId) add('DOCTOR_UNASSIGNED', 'error', 'No doctor is assigned.', 'assignedDoctorId');
  if (forSubmit && (!Array.isArray(record.files) || record.files.length === 0)) add('FILES_MISSING', 'error', 'No supporting clinical files are attached.', 'files');
  for (const [index, measurement] of (record.measurements || []).entries()) {
    if (measurement?.value !== undefined && (!measurement.unit || !measurement.source || !measurement.measuredAt)) {
      add('MEASUREMENT_METADATA_INCOMPLETE', 'warning', `Measurement ${index + 1} needs a unit, source, and measured date.`, `measurements.${index}`);
    }
  }
  return problems;
}
