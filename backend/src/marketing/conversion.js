import crypto from 'node:crypto';
import { allocateCompanyLeadSerial } from '../db.js';

const id = () => crypto.randomUUID();
const leadScope = company => ({ company, OR: [{ company }, { source: company }] });

export async function requestConversion(prisma, contact, actor, note) {
  if (contact.currentOwnerId !== actor.id && actor.role !== 'super_admin' && actor.role !== 'marketing_admin') {
    throw Object.assign(new Error('Only the assigned marketing officer or admin can request conversion.'), { status: 403 });
  }
  if (contact.lifecycleStatus !== 'interested') throw Object.assign(new Error('Contact must be marked interested before conversion.'), { status: 409 });
  if (contact.consentStatus !== 'verified') throw Object.assign(new Error('Verified marketing permission is required.'), { status: 409 });
  const suppression = await prisma.marketingSuppression.findUnique({ where: { contactId: contact.id } });
  if (suppression) throw Object.assign(new Error('This contact is suppressed and cannot be converted.'), { status: 409 });
  return prisma.marketingLeadConversion.upsert({
    where: { contactId: contact.id },
    create: { id: id(), contactId: contact.id, company: contact.company, requestedById: actor.id, officerNote: note || null, consentEvidence: 'verified consent recorded in marketing_consent_events' },
    update: { status: 'pending', requestedById: actor.id, requestedAt: new Date(), officerNote: note || null, rejectionReason: null }
  });
}

export async function approveConversion(prisma, conversionId, actor, options = {}) {
  return prisma.$transaction(async tx => {
    const conversion = await tx.marketingLeadConversion.findUnique({ where: { id: conversionId } });
    if (!conversion || conversion.company !== (actor.company || 'RWC')) throw Object.assign(new Error('Conversion request not found.'), { status: 404 });
    if (conversion.status !== 'pending') throw Object.assign(new Error('Conversion request is no longer pending.'), { status: 409 });
    const contact = await tx.marketingContact.findUnique({ where: { id: conversion.contactId } });
    if (!contact || contact.company !== conversion.company || contact.lifecycleStatus !== 'interested' || contact.consentStatus !== 'verified') throw Object.assign(new Error('Contact is not eligible for conversion.'), { status: 409 });
    const suppressed = await tx.marketingSuppression.findUnique({ where: { contactId: contact.id } });
    if (suppressed) throw Object.assign(new Error('Suppressed contacts cannot be converted.'), { status: 409 });
    const existingCustomer = await tx.customer.findFirst({ where: { OR: [{ whatsappNumber: contact.normalizedPhone }, { phoneNumber: contact.normalizedPhone }, { whatsappId: contact.normalizedPhone.replace(/^\+/, '') }] } });
    const existingLead = existingCustomer ? await tx.lead.findFirst({ where: { customerId: existingCustomer.id, ...leadScope(conversion.company) }, orderBy: { updatedAt: 'desc' } }) : null;
    if (existingLead && !options.linkExisting) return { duplicate: true, lead: existingLead, conversion };
    const customer = existingCustomer || await tx.customer.create({ data: { id: id(), whatsappNumber: contact.normalizedPhone, phoneNumber: contact.normalizedPhone, whatsappId: contact.normalizedPhone.replace(/^\+/, ''), displayName: contact.normalizedPhone, preferredLanguage: 'en' } });
    const lead = existingLead || await tx.lead.create({ data: { id: id(), customerId: customer.id, company: conversion.company, source: 'marketing', serialNumber: await allocateCompanyLeadSerial(tx, conversion.company), stage: 'new', language: 'en' } });
    const status = existingLead ? 'linked_existing' : 'approved';
    const updated = await tx.marketingLeadConversion.update({ where: { id: conversion.id }, data: { status, leadId: lead.id, duplicateLeadId: existingLead?.id || null, reviewedById: actor.id, reviewedAt: new Date() } });
    await tx.marketingContact.update({ where: { id: contact.id }, data: { lifecycleStatus: 'converted', convertedLeadId: lead.id, lastUpdatedById: actor.id, lastActivityAt: new Date() } });
    await tx.marketingContactActivity.create({ data: { id: id(), contactId: contact.id, actorId: actor.id, type: existingLead ? 'linked_existing_lead' : 'converted_to_lead', metadata: { leadId: lead.id, source: contact.originalSource } } });
    return { duplicate: false, lead, conversion: updated };
  });
}
