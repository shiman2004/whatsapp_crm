import crypto from 'node:crypto';
import { getPrisma } from '../../../db.js';

const id = () => crypto.randomUUID();

export const CONSENT_STATES = {
  UNKNOWN: 'unknown',
  VERIFIED: 'verified',
  OPTED_OUT: 'opted_out',
  DENIED: 'denied',
};

export const CONSENT_CHANNELS = {
  WHATSAPP_INBOUND: 'WHATSAPP_INBOUND',
  WEB_FORM: 'WEB_FORM',
  SIGNED_FORM: 'SIGNED_FORM',
  PHONE_CALL: 'PHONE_CALL',
  IN_PERSON: 'IN_PERSON',
  OTHER: 'OTHER',
};

export const EVIDENCE_TYPES = {
  MESSAGE_CONFIRMATION: 'MESSAGE_CONFIRMATION',
  SIGNED_DOCUMENT: 'SIGNED_DOCUMENT',
  AUDIO_RECORDING: 'AUDIO_RECORDING',
  INQUIRY_FORM: 'INQUIRY_FORM',
  OTHER: 'OTHER',
};

export function normalizeConsentDecision(raw) {
  const str = String(raw || '').toLowerCase().trim();
  if (str === 'verified' || str === 'opt_in' || str === 'opted_in' || str === 'yes' || str === 'agree') {
    return CONSENT_STATES.VERIFIED;
  }
  if (str === 'opted_out' || str === 'opt_out' || str === 'denied' || str === 'dnd' || str === 'no' || str === 'unsubscribe') {
    return CONSENT_STATES.OPTED_OUT;
  }
  if (str === 'unknown' || str === 'pending') {
    return CONSENT_STATES.UNKNOWN;
  }
  return CONSENT_STATES.UNKNOWN;
}

function resolveContactWhere(identifier) {
  const v = String(identifier || '').trim();
  if (!v) return null;
  // UUID-ish
  if (v.length >= 32 && v.includes('-')) {
    return { id: v };
  }
  const clean = v.replace(/[^0-9]/g, '');
  if (clean.length >= 7) {
    return {
      OR: [
        { normalizedPhone: { contains: clean.slice(-9) } },
        { normalizedPhone: v },
      ],
    };
  }
  return { id: v };
}

export async function getConsentStatus(contactIdOrIdentifier, options = {}) {
  const prisma = options.prisma || getPrisma();
  if (!prisma) throw new Error('Database unavailable');

  let contact = null;
  const v = String(contactIdOrIdentifier || '').trim();
  if (v.length >= 32 && v.includes('-')) {
    contact = await prisma.marketingContact.findUnique({ where: { id: v } });
  }
  if (!contact) {
    const where = resolveContactWhere(v);
    if (where) {
      contact = await prisma.marketingContact.findFirst({ where });
    }
  }
  if (!contact) return null;

  const [suppression, events] = await Promise.all([
    prisma.marketingSuppression.findUnique({ where: { contactId: contact.id } }),
    prisma.marketingConsentEvent.findMany({
      where: { marketingContactId: contact.id },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    }),
  ]);

  const isSuppressed = !!suppression || contact.lifecycleStatus === 'do_not_contact';
  let effectiveStatus = normalizeConsentDecision(contact.consentStatus);
  if (effectiveStatus === CONSENT_STATES.DENIED) effectiveStatus = CONSENT_STATES.OPTED_OUT;
  if (isSuppressed) effectiveStatus = CONSENT_STATES.OPTED_OUT;

  const latestEvent = events[0] || null;

  return {
    contactId: contact.id,
    company: contact.company,
    consentStatus: effectiveStatus,
    lifecycleStatus: contact.lifecycleStatus,
    isSuppressed,
    suppressionReason: suppression?.reason || (isSuppressed ? 'Contact opted out' : null),
    latestEvent,
    history: events,
    authorizedPurposes: latestEvent?.purpose ? [latestEvent.purpose] : [],
    authorizedChannels: latestEvent?.channel ? [latestEvent.channel] : [],
  };
}

export async function recordConsentEvent(payload, actor = {}) {
  const prisma = payload.prisma || getPrisma();
  if (!prisma) throw new Error('Database unavailable');

  const contactId = payload.contactId || payload.marketingContactId || payload.contact?.id;
  if (!contactId) throw Object.assign(new Error('Contact ID is required'), { status: 400 });

  let rawDecision = payload.decision || payload.status || payload.consentStatus;
  let decision = normalizeConsentDecision(rawDecision);
  if (decision === CONSENT_STATES.DENIED) decision = CONSENT_STATES.OPTED_OUT;

  const channel = String(payload.channel || 'OTHER').toUpperCase().trim();
  const evidenceType = payload.evidenceType ? String(payload.evidenceType).toUpperCase().trim() : undefined;
  const evidenceRef = String(payload.evidenceReference || payload.reference || '').trim();
  const evidenceDesc = String(payload.evidenceDescription || payload.evidence || payload.proof || '').trim();
  const purpose = String(payload.purpose || 'Marketing outreach & consultation follow-up').trim();
  const idempotencyKey = payload.idempotencyKey ? String(payload.idempotencyKey).trim() : undefined;

  if (decision === CONSENT_STATES.VERIFIED) {
    if (!evidenceDesc && !evidenceRef && !evidenceType) {
      throw Object.assign(
        new Error('Verifiable evidence (description or reference ID) is required to record verified consent.'),
        { status: 400, code: 'CONSENT_EVIDENCE_REQUIRED' }
      );
    }
  }

  const contact = await prisma.marketingContact.findUnique({ where: { id: contactId } });
  if (!contact) throw Object.assign(new Error('Marketing contact not found.'), { status: 404 });

  if (actor.company && actor.company !== 'ALL' && contact.company !== actor.company && actor.role !== 'super_admin') {
    throw Object.assign(new Error('Unauthorized: cannot modify consent for another company.'), { status: 403 });
  }

  const actorId = actor.id || payload.recordedById || 'SYSTEM';

  if (idempotencyKey) {
    const existing = await prisma.marketingConsentEvent.findFirst({
      where: { marketingContactId: contactId, idempotencyKey },
    });
    if (existing) {
      const suppression = await prisma.marketingSuppression.findUnique({ where: { contactId } });
      return {
        success: true,
        contact,
        event: existing,
        suppression,
        idempotent: true,
      };
    }
  }

  return prisma.$transaction(async tx => {
    const event = await tx.marketingConsentEvent.create({
      data: {
        id: id(),
        marketingContactId: contactId,
        companyId: contact.company,
        decision,
        purpose,
        channel,
        evidenceType: evidenceType || null,
        evidenceReference: evidenceRef || null,
        evidenceDescription: evidenceDesc || (decision === CONSENT_STATES.OPTED_OUT ? 'Customer opted out' : 'Pending consent recorded'),
        recordedById: actorId,
        occurredAt: new Date(),
        createdAt: new Date(),
        idempotencyKey: idempotencyKey || null,
      },
    });

    const isOptOut = decision === CONSENT_STATES.OPTED_OUT;

    let suppressionRecord = null;
    if (isOptOut) {
      suppressionRecord = await tx.marketingSuppression.upsert({
        where: { contactId },
        create: {
          id: id(),
          contactId,
          reason: evidenceDesc || evidenceRef || 'Customer requested opt-out / DND',
          recordedById: actorId,
        },
        update: {
          reason: evidenceDesc || evidenceRef || 'Customer requested opt-out / DND',
          recordedById: actorId,
        },
      });

      await tx.marketingTask.updateMany({
        where: { contactId, status: { notIn: ['completed'] } },
        data: {
          status: 'completed',
          notes: 'Task automatically closed: Contact requested opt-out (DND).',
          closedAt: new Date(),
        },
      });
    } else if (decision === CONSENT_STATES.VERIFIED) {
      if (actor.role === 'super_admin' || actor.role === 'marketing_admin') {
        await tx.marketingSuppression.deleteMany({ where: { contactId } });
      } else {
        const existingSup = await tx.marketingSuppression.findUnique({ where: { contactId } });
        if (existingSup) {
          throw Object.assign(
            new Error('Ordinary staff cannot reactivate a suppressed contact. Super Admin or Marketing Admin approval required.'),
            { status: 403, code: 'SUPPRESSION_REACTIVATION_RESTRICTED' }
          );
        }
      }
    }

    const updatedContact = await tx.marketingContact.update({
      where: { id: contactId },
      data: {
        consentStatus: decision,
        lifecycleStatus: isOptOut ? 'do_not_contact' : contact.lifecycleStatus,
        lastUpdatedById: actorId,
        lastActivityAt: new Date(),
      },
    });

    await tx.marketingContactActivity.create({
      data: {
        id: id(),
        contactId,
        actorId,
        type: isOptOut ? 'CONTACT_SUPPRESSED' : 'CONSENT_RECORDED',
        note: isOptOut
          ? `Contact opted out (${evidenceDesc || evidenceRef || 'DND'})`
          : `Consent ${decision} via ${channel}`,
        metadata: {
          decision,
          channel,
          evidenceType: evidenceType || null,
          evidenceReference: evidenceRef || null,
          evidenceDescription: evidenceDesc || null,
        },
      },
    });

    return {
      success: true,
      contact: updatedContact,
      event,
      suppression: suppressionRecord,
    };
  });
}

export async function canSendWhatsApp(recipient, messageType = 'text', options = {}) {
  const prisma = options.prisma || getPrisma();
  if (!prisma) return { allowed: false, reason: 'Database unavailable' };

  let phone = String(recipient || '').trim();
  let contact = null;

  if (phone.includes('-') && phone.length >= 32) {
    try {
      contact = await prisma.marketingContact.findUnique({ where: { id: phone } });
    } catch {}
    if (contact) phone = contact.normalizedPhone || phone;
  }

  const cleanDigits = phone.replace(/[^0-9]/g, '');
  if (!contact && cleanDigits.length >= 7) {
    contact = await prisma.marketingContact.findFirst({
      where: {
        OR: [
          { normalizedPhone: { contains: cleanDigits.slice(-9) } },
          { normalizedPhone: phone },
        ],
      },
    });
  }

  if (contact && !contact.convertedLeadId) {
    const suppression = await prisma.marketingSuppression.findUnique({ where: { contactId: contact.id } });
    const isSuppressed =
      !!suppression ||
      contact.lifecycleStatus === 'do_not_contact' ||
      contact.consentStatus === CONSENT_STATES.OPTED_OUT ||
      contact.consentStatus === CONSENT_STATES.DENIED;

    if (isSuppressed) {
      return {
        allowed: false,
        reason: 'Outbound messaging blocked: Contact has opted out and is suppressed (DND).',
        code: 'CONTACT_OPTED_OUT',
      };
    }

    let consentStatus = normalizeConsentDecision(contact.consentStatus);
    if (consentStatus === CONSENT_STATES.DENIED) consentStatus = CONSENT_STATES.OPTED_OUT;
    if (consentStatus !== CONSENT_STATES.VERIFIED) {
      return {
        allowed: false,
        reason: 'Unsolicited WhatsApp messaging blocked: Marketing contact consent is not verified.',
        code: 'CONSENT_NOT_VERIFIED',
      };
    }

    if (messageType !== 'template' && !options.isCustomerServiceReply) {
      return {
        allowed: false,
        reason: 'Business-initiated WhatsApp messages to marketing contacts require an approved Meta template.',
        code: 'TEMPLATE_REQUIRED',
      };
    }
  }

  if (contact) {
    const suppression = await prisma.marketingSuppression.findUnique({ where: { contactId: contact.id } });
    if (suppression) {
      return {
        allowed: false,
        reason: `Recipient is suppressed: ${suppression.reason}`,
        code: 'RECIPIENT_SUPPRESSED',
      };
    }
  }

  if (options.check24hWindow && options.lastCustomerMessageAt) {
    const lastMsgTime = new Date(options.lastCustomerMessageAt).getTime();
    if (Number.isNaN(lastMsgTime)) {
      // if we can't determine, be conservative only for non-template business-initiated? follow requirement: permit free-form replies only inside the customer-service window using actual inbound timestamp
    } else {
      const isWindowOpen = Date.now() - lastMsgTime <= 24 * 60 * 60 * 1000;
      if (!isWindowOpen && messageType !== 'template') {
        return {
          allowed: false,
          reason: 'WhatsApp 24-hour service window closed. Only approved Meta templates are permitted.',
          code: 'WINDOW_CLOSED',
        };
      }
    }
  }

  return { allowed: true };
}

export async function canConvertToLead(contactId, actor = {}, options = {}) {
  const prisma = options.prisma || getPrisma();
  if (!prisma) return { eligible: false, reasons: ['Database unavailable'] };

  let contact = null;
  if (options.tx && options.tx.marketingContact) {
    contact = await options.tx.marketingContact.findUnique({ where: { id: contactId } });
  } else {
    contact = await prisma.marketingContact.findUnique({ where: { id: contactId } });
  }
  if (!contact) return { eligible: false, reasons: ['Marketing contact not found'] };

  const reasons = [];

  let consentStatus = normalizeConsentDecision(contact.consentStatus);
  if (consentStatus === CONSENT_STATES.DENIED) consentStatus = CONSENT_STATES.OPTED_OUT;
  const isVerified = consentStatus === CONSENT_STATES.VERIFIED;
  if (!isVerified) {
    reasons.push('Verified Opt-In Consent is strictly required before conversion.');
  }

  if (contact.lifecycleStatus !== 'interested') {
    reasons.push('Contact lifecycle status must be qualified as "Interested".');
  }

  const tx = options.tx || prisma;
  const suppression = await tx.marketingSuppression.findUnique({ where: { contactId } });
  if (suppression || contact.lifecycleStatus === 'do_not_contact' || consentStatus === CONSENT_STATES.OPTED_OUT) {
    reasons.push(`Contact is suppressed (${suppression?.reason || 'Opted out'}). Conversion blocked.`);
  }

  if (isVerified) {
    const consentEvent = await tx.marketingConsentEvent.findFirst({
      where: { marketingContactId: contactId, decision: CONSENT_STATES.VERIFIED },
      orderBy: { occurredAt: 'desc' },
    });
    if (!consentEvent) {
      reasons.push('Audit failure: No verifiable consent event record exists in consent logs.');
    }
  }

  if (contact.convertedLeadId) {
    reasons.push(`Contact has already been converted to CRM Lead (${contact.convertedLeadId}).`);
  }

  if (actor.company && actor.company !== 'ALL' && contact.company !== actor.company && actor.role !== 'super_admin') {
    reasons.push(`Unauthorized company scope: Contact belongs to ${contact.company}, not ${actor.company}.`);
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    contact,
  };
}

export async function suppressContact(contactId, reason = 'Customer requested DND / Opt-out', actor = {}) {
  return recordConsentEvent(
    {
      contactId,
      decision: CONSENT_STATES.OPTED_OUT,
      evidenceDescription: reason,
      channel: CONSENT_CHANNELS.OTHER,
    },
    actor
  );
}
