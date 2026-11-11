import type { Lead, LeadStageConfig, User } from '../types';

export type StageOutcomeCategory =
  | 'open'
  | 'appointment'
  | 'consultation'
  | 'treatment'
  | 'payment'
  | 'converted'
  | 'negative';

export interface StageClassification {
  key: string;
  category: StageOutcomeCategory;
  isTerminalNegative: boolean;
  isAppointmentMilestone: boolean;
  isConsultationMilestone: boolean;
  isTreatmentMilestone: boolean;
  isPaymentMilestone: boolean;
  /** Strictly closed/revenue-realized business conversion */
  isBusinessConverted: boolean;
  /** Clinical progression (booked appointment, consultation, treatment, payment, or won) */
  isClinicalProgressed: boolean;
  isActiveOpen: boolean;
}

const NEGATIVE_STAGE_KEYS = new Set(['lost', 'not_relevant', 'not_eligible']);
const APPOINTMENT_STAGE_KEYS = new Set(['appointment_booked', 'next_appointment', 'rescheduled']);
const CONSULTATION_STAGE_KEYS = new Set(['consultation__done', 'consultation_done']);
const TREATMENT_STAGE_KEYS = new Set(['treatment_completed']);
const PAYMENT_STAGE_KEYS = new Set(['payment_received']);
const CONVERTED_STAGE_KEYS = new Set(['converted']);

export function normalizeLeadStageKey(stage?: string | null): string {
  return String(stage || 'new').trim().toLowerCase();
}

export function classifyLeadStage(stage?: string | null, stageConfig?: LeadStageConfig | null): StageClassification {
  const key = normalizeLeadStageKey(stage);
  const label = String(stageConfig?.label || '').toLowerCase();

  const isTerminalNegative =
    NEGATIVE_STAGE_KEYS.has(key) ||
    label === 'lost' ||
    label.includes('not eligible');

  const isAppointmentMilestone =
    APPOINTMENT_STAGE_KEYS.has(key) ||
    label.includes('appointment');

  const isConsultationMilestone =
    CONSULTATION_STAGE_KEYS.has(key) ||
    label.includes('consultation');

  const isTreatmentMilestone =
    TREATMENT_STAGE_KEYS.has(key) ||
    label.includes('treatment completed');

  const isPaymentMilestone =
    PAYMENT_STAGE_KEYS.has(key) ||
    label.includes('payment received');

  const isExplicitConverted =
    CONVERTED_STAGE_KEYS.has(key) ||
    label.includes('converted') ||
    label.includes('enrolled');

  // Business conversion covers closed won, payment received, and treatment completed
  const isBusinessConverted = isExplicitConverted || isPaymentMilestone || isTreatmentMilestone;
  const isClinicalProgressed =
    isBusinessConverted || isAppointmentMilestone || isConsultationMilestone;

  const isActiveOpen = !isTerminalNegative && !isBusinessConverted;

  let category: StageOutcomeCategory = 'open';
  if (isTerminalNegative) category = 'negative';
  else if (isExplicitConverted) category = 'converted';
  else if (isPaymentMilestone) category = 'payment';
  else if (isTreatmentMilestone) category = 'treatment';
  else if (isConsultationMilestone) category = 'consultation';
  else if (isAppointmentMilestone) category = 'appointment';

  return {
    key,
    category,
    isTerminalNegative,
    isAppointmentMilestone,
    isConsultationMilestone,
    isTreatmentMilestone,
    isPaymentMilestone,
    isBusinessConverted,
    isClinicalProgressed,
    isActiveOpen,
  };
}

export function isEligibleStaffForLeaderboard(user: User): boolean {
  if (!user || user.active === false) return false;
  return user.role === 'coordinator' || user.role === 'sales_coordinator';
}

/**
 * Returns YYYY-MM-DD in Asia/Colombo (clinic headquarters timezone) so
 * daily boundaries never shift across different browser timezones.
 */
export function getColomboDayString(dateInput?: string | Date | number | null): string {
  if (!dateInput) return 'invalid';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return 'invalid';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Resolves the verified assignment date (Asia/Colombo YYYY-MM-DD) for `coordId`.
 * Only trusts `lead.assignedAt` or an assignment history explicitly matching `coordId`.
 */
export function resolveAssignedColomboDay(lead: Lead, coordId: string): string {
  if (!lead || lead.assignedTo !== coordId) return 'invalid';

  if (lead.assignedAt) {
    const k = getColomboDayString(lead.assignedAt);
    if (k !== 'invalid') return k;
  }

  if (Array.isArray(lead.assignmentHistories) && lead.assignmentHistories.length > 0) {
    const matching = lead.assignmentHistories
      .filter((h) => h.assignedToId === coordId && h.assignedAt)
      .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
    if (matching[0]?.assignedAt) {
      const k = getColomboDayString(matching[0].assignedAt);
      if (k !== 'invalid') return k;
    }
  }

  return getColomboDayString(lead.createdAt);
}

export function summarizeStageMetrics(leads: Lead[], stageConfigs?: LeadStageConfig[]) {
  const configMap = new Map<string, LeadStageConfig>();
  (stageConfigs || []).forEach((s) => configMap.set(normalizeLeadStageKey(s.key), s));

  let appointmentBooked = 0;
  let consultationDone = 0;
  let treatmentCompleted = 0;
  let paymentReceived = 0;
  let closedWon = 0;
  let businessConverted = 0;
  let activeOpen = 0;
  let negativeLost = 0;

  for (const lead of leads) {
    const c = classifyLeadStage(lead.stage, configMap.get(normalizeLeadStageKey(lead.stage)));
    if (c.isAppointmentMilestone) appointmentBooked += 1;
    if (c.isConsultationMilestone) consultationDone += 1;
    if (c.isTreatmentMilestone) treatmentCompleted += 1;
    if (c.isPaymentMilestone) paymentReceived += 1;
    if (c.category === 'converted') closedWon += 1;
    if (c.isBusinessConverted) businessConverted += 1;
    if (c.isActiveOpen) activeOpen += 1;
    if (c.isTerminalNegative) negativeLost += 1;
  }

  const total = leads.length;
  return {
    total,
    appointmentBooked,
    consultationDone,
    treatmentCompleted,
    paymentReceived,
    closedWon,
    businessConverted,
    activeOpen,
    negativeLost,
    conversionRatePct: total > 0 ? Math.round((businessConverted / total) * 100) : 0,
    conversionRateExact: total > 0 ? ((businessConverted / total) * 100).toFixed(1) : '0.0',
  };
}
