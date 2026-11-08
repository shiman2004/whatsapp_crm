import crypto from 'node:crypto';
import { getPrisma } from '../db.js';
import { encryptReversible, decryptReversible } from '../secretHash.js';

export class VersionConflictError extends Error {
  constructor(details) {
    super('This setting section was modified by another administrator.');
    this.name = 'VersionConflictError';
    this.code = 'VERSION_CONFLICT';
    this.details = details;
  }
}

// Default payloads when no database row exists yet
export const DEFAULT_SETTINGS = {
  company: {
    name: 'Alpha Health Group',
    displayName: 'Alpha Health Group',
    legalName: '',
    registrationNumber: '',
    logoUrl: '/uploads/logos/alpha-health.png',
    contactEmail: 'contact@royalwellness.lk',
    contactPhone: '+94 11 234 5678',
    email: 'contact@royalwellness.lk',
    phone: '+94 11 234 5678',
    address: 'Colombo, Sri Lanka',
    country: 'Sri Lanka',
    description: '',
    status: 'active',
    timezone: 'Asia/Colombo',
    currency: 'LKR',
    dateFormat: 'DD/MM/YYYY',
    fiscalYearStart: '01-01',
    activeBrands: ['RWC', 'CRAS', 'AHC'],
    enabledFeatures: ['whatsapp', 'appointments', 'clinical', 'exams', 'marketing']
  },
  company_localization: {
    currency: 'LKR',
    timezone: 'Asia/Colombo',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    language: 'en',
    fiscalYearStart: '01-01',
    workingWeek: [1, 2, 3, 4, 5],
    holidayCalendarRef: 'LK'
  },
  whatsapp_messaging: {
    defaultInboxId: 'rwc-main',
    autoAssignEnabled: true,
    routingStrategy: 'round_robin', // 'round_robin' | 'workload' | 'manual'
    transferApprovalRequired: false,
    businessHoursAutoReply: 'Thank you for reaching out to Alpha Health Group. Our advisors will respond during operational hours.',
    outOfOfficeMessage: 'Our clinics are currently closed. We will connect with you tomorrow morning.',
    maxOpenChatsPerCoordinator: 15,
    retentionDays: 365,
    optOutKeywords: ['STOP', 'UNSUBSCRIBE', 'OPT OUT']
  },
  sales: {
    defaultTaxRate: 0.00,
    leadSources: ['WhatsApp', 'Facebook Ads', 'Google Ads', 'Walk-In', 'Referral', 'Instagram', 'Web Form'],
    dealStatuses: ['open', 'won', 'lost', 'on_hold'],
    lostReasons: ['Price too high', 'Chose competitor', 'Not eligible', 'Unresponsive', 'Changed mind', 'Other'],
    requireLostReason: true
  },
  marketing: {
    maxContactAllocation: 50,
    duplicateThresholdHours: 48,
    consentEnforced: true,
    roundRobinBatchSize: 10,
    suppressionKeywords: ['STOP', 'DND']
  },
  clinical: {
    defaultBookingDurationMinutes: 60,
    bufferMinutes: 15,
    doubleBookingAllowed: false,
    cancellationCutoffHours: 24,
    noShowThresholdMinutes: 30,
    reminderHoursBefore: [24, 2]
  },
  academic: {
    registrationWindowOpen: true,
    passingScorePercentage: 60,
    allowRetakes: true,
    maxRetakeAttempts: 2,
    studentNotificationMethod: 'whatsapp_and_email'
  },
  email_notifications: {
    smtpHost: 'smtp.sendgrid.net',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '', // Encrypted at rest, masked in responses
    senderName: 'Alpha Health Group CRM',
    senderEmail: 'notifications@royalwellness.lk',
    eventToggles: {
      newLead: true,
      leadAssigned: true,
      appointmentBooked: true,
      appointmentCancelled: true,
      slaEscalation: true,
      securityAlert: true
    },
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00'
  },
  security_policy: {
    minPasswordLength: 12,
    requireNumbers: true,
    requireSpecialChars: true,
    sessionTimeoutMinutes: 60,
    idleTimeoutMinutes: 60,
    enforceSingleSession: false,
    mfaRequired: false,
    maxFailedLogins: 5,
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 15,
    lockoutMinutes: 15,
    ipAllowlist: []
  },
  data_management: {
    retentionDays: 730,
    backupSchedule: 'daily_at_midnight',
    exportAllowedRoles: ['super_admin']
  },
  reporting: {
    defaultDateRange: 'month_to_date',
    targetMonthlyConversions: 50,
    slaResponseMinutes: 15
  },
  appearance: {
    theme: 'dark',
    density: 'comfortable',
    language: 'en',
    timezone: 'Asia/Colombo'
  }
};

const SECRET_FIELDS = ['smtpPassword', 'signingSecret', 'secretKey', 'webhookSecret'];

export function maskSecrets(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  for (const key of Object.keys(clone)) {
    if (SECRET_FIELDS.includes(key)) {
      if (clone[key]) clone[key] = '••••••••';
    } else if (typeof clone[key] === 'object' && clone[key] !== null) {
      clone[key] = maskSecrets(clone[key]);
    }
  }
  return clone;
}

export function encryptSecretsInPayload(payload, existingPayload = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  const clone = JSON.parse(JSON.stringify(payload));
  for (const key of Object.keys(clone)) {
    if (SECRET_FIELDS.includes(key)) {
      if (clone[key] === '••••••••') {
        // Keep existing encrypted value
        clone[key] = existingPayload[key] || '';
      } else if (clone[key] && !String(clone[key]).startsWith('enc:v1:')) {
        clone[key] = encryptReversible(clone[key]);
      }
    } else if (typeof clone[key] === 'object' && clone[key] !== null) {
      clone[key] = encryptSecretsInPayload(clone[key], existingPayload[key] || {});
    }
  }
  return clone;
}

export class SettingsService {
  /**
   * Retrieves a section configuration by section, scope, and scopeId.
   * If company scope is requested but does not exist, transparently falls back to global scope.
   */
  static async getSetting(section, scope = 'global', scopeId = null) {
    const prisma = getPrisma();
    if (!prisma) throw new Error('Database connection unavailable');

    // 1. Check specific scoped setting
    let record = await prisma.systemSetting.findFirst({
      where: {
        section,
        scope,
        scopeId: scopeId || null
      }
    });

    // 2. Fall back to global setting if scoped row is missing
    if (!record && scope !== 'global') {
      record = await prisma.systemSetting.findFirst({
        where: {
          section,
          scope: 'global',
          scopeId: null
        }
      });
    }

    const defaultData = DEFAULT_SETTINGS[section] || {};
    const rawPayload = record ? record.payload : defaultData;
    const version = record ? record.version : 1;
    const updatedAt = record ? record.updatedAt : new Date().toISOString();

    return {
      section,
      scope: record ? record.scope : scope,
      scopeId: record ? record.scopeId : scopeId,
      version,
      data: maskSecrets(rawPayload),
      isDefault: !record,
      updatedAt,
      updatedById: record ? record.updatedById : null
    };
  }

  /**
   * Updates a section configuration with Optimistic Concurrency Control and transaction-bound audit logging.
   */
  static async updateSetting({ section, scope = 'global', scopeId = null, version, data, user, correlationId }) {
    const prisma = getPrisma();
    if (!prisma) throw new Error('Database connection unavailable');

    const expectedVersion = Number(version) || 1;

    return await prisma.$transaction(async (tx) => {
      // 1. Fetch current row
      const existing = await tx.systemSetting.findFirst({
        where: {
          section,
          scope,
          scopeId: scopeId || null
        }
      });

      // 2. Optimistic locking check
      if (existing) {
        if (existing.version !== expectedVersion) {
          throw new VersionConflictError({
            clientVersion: expectedVersion,
            currentVersion: existing.version,
            serverData: maskSecrets(existing.payload),
            updatedBy: existing.updatedById || 'System',
            updatedAt: existing.updatedAt
          });
        }
      }

      // 3. Encrypt sensitive fields
      const existingPayload = existing ? (existing.payload || {}) : {};
      const encryptedPayload = encryptSecretsInPayload(data, existingPayload);

      // 4. Upsert with incremented version
      let savedRecord;
      if (existing) {
        savedRecord = await tx.systemSetting.update({
          where: { id: existing.id },
          data: {
            payload: encryptedPayload,
            version: existing.version + 1,
            updatedById: user?.id || null
          }
        });
      } else {
        savedRecord = await tx.systemSetting.create({
          data: {
            id: crypto.randomUUID(),
            section,
            scope,
            scopeId: scopeId || null,
            payload: encryptedPayload,
            version: 2,
            updatedById: user?.id || null
          }
        });
      }

      // 5. Transaction-bound Audit Log entry. Company-scoped rows are keyed by
      // company first so a company audit trail can be queried without leaking
      // another company's settings history.
      const entityId = scope === 'company' && scopeId
        ? `${scopeId}:settings:${section}`
        : `${section}:${scope}:${scopeId || 'global'}`;

      await tx.auditLog.create({
        data: {
          action: 'settings.update',
          entityType: 'SystemSetting',
          entityId,
          performedById: user?.id || null,
          performedByName: user?.fullName || 'Administrator',
          previousValue: JSON.stringify(maskSecrets(existingPayload)),
          newValue: JSON.stringify(maskSecrets(encryptedPayload)),
          timestamp: new Date()
        }
      });

      return {
        section,
        scope,
        scopeId,
        version: savedRecord.version,
        data: maskSecrets(savedRecord.payload),
        updatedAt: savedRecord.updatedAt
      };
    });
  }

  /**
   * Retrieves paginated settings audit logs with diff information.
   */
  static async getAuditLogs({ page = 1, limit = 20, section, userId, fromDate, toDate, companyId }) {
    const prisma = getPrisma();
    if (!prisma) throw new Error('Database connection unavailable');

    const take = Math.min(Math.max(1, Number(limit) || 20), 100);
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;

    const where = {
      entityType: 'SystemSetting'
    };

    if (companyId) {
      where.entityId = section
        ? `${companyId}:settings:${section}`
        : { startsWith: `${companyId}:settings:` };
    } else if (section) {
      where.entityId = { startsWith: `${section}:` };
    }
    if (userId) {
      where.performedById = userId;
    }
    if (fromDate || toDate) {
      where.timestamp = {};
      if (fromDate) where.timestamp.gte = new Date(fromDate);
      if (toDate) where.timestamp.lte = new Date(toDate);
    }

    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take
      })
    ]);

    const items = rows.map(r => ({
      id: r.id,
      action: r.action,
      entityId: r.entityId,
      performedById: r.performedById,
      performedByName: r.performedByName,
      previousValue: r.previousValue ? JSON.parse(r.previousValue) : null,
      newValue: r.newValue ? JSON.parse(r.newValue) : null,
      timestamp: r.timestamp
    }));

    return {
      items,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    };
  }
}

