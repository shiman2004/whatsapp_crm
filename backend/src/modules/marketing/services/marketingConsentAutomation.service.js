import crypto from 'node:crypto';
import { recordConsentEvent } from './consent.service.js';
import { detectMarketingInterest, isExplicitConsentReply } from './marketingInterest.service.js';

const id = () => crypto.randomUUID();

export async function processMarketingInboundMessage({ prisma, company, phone, text, messageId, receivedAt = new Date() }) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits || !messageId) return null;

  const contact = await prisma.marketingContact.findFirst({
    where: { company, normalizedPhone: { contains: digits.slice(-9) } },
  });
  if (!contact || contact.convertedLeadId) return null;

  const duplicate = await prisma.marketingContactActivity.findFirst({
    where: { contactId: contact.id, type: 'INBOUND_WHATSAPP_MARKETING', note: { contains: messageId } },
  });
  if (duplicate) return { contactId: contact.id, idempotent: true };

  const interest = detectMarketingInterest(text);
  const consentReply = isExplicitConsentReply(text);
  const consentRequest = await prisma.marketingContactActivity.findFirst({
    where: { contactId: contact.id, type: 'CONSENT_REQUEST_SENT' },
    orderBy: { createdAt: 'desc' },
  });
  const actor = { id: contact.lastUpdatedById || contact.firstAddedById, role: 'super_admin', company: contact.company };

  let consent = null;
  if (interest.outcome === 'OPTED_OUT') {
    consent = await recordConsentEvent({
      prisma, contactId: contact.id, decision: 'opted_out', channel: 'WHATSAPP_INBOUND',
      evidenceType: 'MESSAGE_CONFIRMATION', evidenceReference: messageId,
      evidenceDescription: text, idempotencyKey: `meta:${messageId}`,
    }, actor);
  } else if (consentRequest && consentReply) {
    consent = await recordConsentEvent({
      prisma, contactId: contact.id, decision: consentReply, channel: 'WHATSAPP_INBOUND',
      evidenceType: 'MESSAGE_CONFIRMATION', evidenceReference: messageId,
      evidenceDescription: text, purpose: consentRequest.metadata?.purpose || 'Marketing outreach & consultation follow-up',
      idempotencyKey: `meta:${messageId}`,
    }, actor);
  }

  const lifecycleStatus = { INTERESTED: 'interested', NOT_INTERESTED: 'not_interested', FOLLOW_UP: 'follow_up_pending' }[interest.outcome];
  if (lifecycleStatus && !consent) {
    await prisma.marketingContact.update({
      where: { id: contact.id },
      data: { lifecycleStatus, lastActivityAt: receivedAt, lastUpdatedById: actor.id },
    });
  }

  await prisma.marketingContactActivity.create({
    data: {
      id: id(), contactId: contact.id, actorId: actor.id, type: 'INBOUND_WHATSAPP_MARKETING',
      note: `Inbound WhatsApp ${messageId}: ${String(text || '').slice(0, 500)}`,
      metadata: { messageId, receivedAt: new Date(receivedAt).toISOString(), interest, consentDecision: consent?.event?.decision || null, automated: true },
    },
  });

  return { contactId: contact.id, interest, consent: consent?.event || null, idempotent: false };
}
