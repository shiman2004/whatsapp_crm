/**
 * stageValidation.js
 * Centralized stage normalization, company authorization, and configuration
 * validation against `public.lead_stages` with built-in safe fallbacks.
 */

export const DEFAULT_BUILTIN_STAGES = [
  { id: 'stage-new', key: 'new', label: 'New Inquiry', isActive: true, isSystem: true, company: 'ALL' },
  { id: 'stage-assigned', key: 'assigned', label: 'Assigned', isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-contacted', key: 'contacted', label: 'Contacted', isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-potential', key: 'potential', label: 'Potential', isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-under-discussion', key: 'under_discussion', label: 'Under Discussion', isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-forwarded-exam', key: 'forwarded_to_exam_department', label: 'Forwarded to Exam Department', isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-forwarded-processing', key: 'forwarded_to_processing_department', label: 'Forwarded to Processing Department', isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-not-relevant', key: 'not_relevant', label: 'Not Relevant', isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-not-eligible', key: 'not_eligible', label: 'Not Eligible', isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-converted', key: 'converted', label: 'Converted (Closed Won)', isActive: true, isSystem: true, company: 'ALL' },
  { id: 'stage-lost', key: 'lost', label: 'Lost', isActive: true, isSystem: true, company: 'ALL' },
  { id: 'stage-interested', key: 'interested', label: 'Interested', isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-follow-up', key: 'follow_up', label: 'Follow Up', isActive: true, isSystem: false, company: 'ALL' },
];

export function normalizeStageKey(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidStageKeyFormat(key) {
  return /^[a-z][a-z0-9_]{0,99}$/.test(String(key || ''));
}

/**
 * Loads configured pipeline stages from DB (`lead_stages`), falling back cleanly
 * when offline or unseeded.
 */
export async function loadConfiguredStages(prisma) {
  if (prisma) {
    try {
      const dbStages = await prisma.leadStageConfig.findMany({
        orderBy: { orderIndex: 'asc' },
      });
      if (Array.isArray(dbStages) && dbStages.length > 0) {
        return dbStages;
      }
    } catch {
      try {
        const rawStages = await prisma.$queryRawUnsafe(`
          SELECT id, key, label, description, color, order_index AS "orderIndex",
                 is_active AS "isActive", is_system AS "isSystem", company
          FROM public.lead_stages
          ORDER BY order_index ASC;
        `);
        if (Array.isArray(rawStages) && rawStages.length > 0) {
          return rawStages;
        }
      } catch {
        // Fallback to built-in stages
      }
    }
  }
  return DEFAULT_BUILTIN_STAGES;
}

/**
 * Validates that a requested stage key is well-formed, exists, is active,
 * and is permitted for the lead's company (`ALL` or matching `companyCode`).
 * Historical stages already held by the lead or recorded in its `lead_stage_histories`
 * are preserved safely even if retired/deactivated in `lead_stages`.
 */
export async function validateAuthorizedStage({
  prisma,
  stageKey,
  companyCode = 'RWC',
  configuredStages = null,
  currentStage = null,
  leadId = null,
}) {
  const normalized = normalizeStageKey(stageKey);
  const currentNormalized = normalizeStageKey(currentStage);
  if (!isValidStageKeyFormat(normalized)) {
    return {
      valid: false,
      statusCode: 400,
      errorCode: 'INVALID_STAGE_KEY',
      error: `Invalid pipeline stage key "${String(stageKey ?? '')}".`,
    };
  }

  const stages = Array.isArray(configuredStages)
    ? configuredStages
    : await loadConfiguredStages(prisma);

  const match = stages.find((s) => normalizeStageKey(s.key) === normalized);

  const checkVerifiedHistoricalStage = async () => {
    if (currentStage !== null && currentStage !== undefined && normalized === currentNormalized) {
      return true;
    }
    if (prisma && leadId) {
      try {
        const histCount = await prisma.leadStageHistory.count({
          where: {
            leadId,
            OR: [{ fromStage: normalized }, { toStage: normalized }],
          },
        });
        if (histCount > 0) return true;
      } catch {
        // Fall through to strict rejection if history lookup fails
      }
    }
    return false;
  };

  if (!match) {
    if (await checkVerifiedHistoricalStage()) {
      return {
        valid: true,
        stageKey: normalized,
        stageConfig: null,
        preservedHistorical: true,
      };
    }
    return {
      valid: false,
      statusCode: 400,
      errorCode: 'UNKNOWN_STAGE',
      error: `Stage "${normalized}" does not exist in configured pipeline stages.`,
    };
  }

  const stageCompany = String(match.company || 'ALL').trim().toUpperCase();
  const leadCompany = String(companyCode || 'RWC').trim().toUpperCase();
  if (stageCompany && stageCompany !== 'ALL' && stageCompany !== leadCompany) {
    return {
      valid: false,
      statusCode: 403,
      errorCode: 'STAGE_COMPANY_MISMATCH',
      error: `Stage "${match.label || normalized}" belongs to ${stageCompany} and cannot be applied to a ${leadCompany} lead.`,
    };
  }

  if (match.isActive === false) {
    if (currentStage !== null && currentStage !== undefined && normalized === currentNormalized) {
      return {
        valid: true,
        stageKey: match.key,
        stageConfig: match,
        preservedHistorical: true,
      };
    }
    return {
      valid: false,
      statusCode: 400,
      errorCode: 'INACTIVE_STAGE',
      error: `Stage "${match.label || normalized}" is currently inactive and cannot be assigned.`,
    };
  }

  return {
    valid: true,
    stageKey: match.key,
    stageConfig: match,
  };
}
