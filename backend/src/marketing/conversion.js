import crypto from 'node:crypto';
import { allocateCompanyLeadSerial } from '../db.js';
import { canConvertToLead } from './consent.service.js';

const id = () => crypto.randomUUID();
const leadScope = company => ({ company, OR: [{ company }, { source: company }] });

export async function requestConversion(prisma, contact, actor, note) {
  if (contact.currentOwnerId !== actor.id && actor.role !== 'super_admin' && actor.role !== 'marketing_admin') {
    throw Object.assign(new Error('Only the assigned marketing officer or admin can request conversion.'), { status: 403 });
  }

  const check = await canConvertToLead(contact.id, actor);
  if (!check.eligible) {
    throw Object.assign(new Error(check.reasons.join(' ')), { status: 409 });
  }

  return prisma.marketingLeadConversion.upsert({
    where: { contactId: contact.id },
    create: {
      id: id(),
      contactId: contact.id,
      company: contact.company,
      requestedById: actor.id,
      officerNote: note || null,
      consentEvidence: 'verified consent recorded in marketing_consent_events'
    },
    update: {
      status: 'pending',
      requestedById: actor.id,
      requestedAt: new Date(),
      officerNote: note || null,
      rejectionReason: null
    }
  });
}

export async function approveConversion(prisma, conversionId, actor, options = {}) {
  const db = options.tx || prisma;
  return db.$transaction(async tx => {
    const conversion = await tx.marketingLeadConversion.findUnique({ where: { id: conversionId } });
    if (!conversion || conversion.company !== (actor.company || 'RWC')) {
      throw Object.assign(new Error('Conversion request not found.'), { status: 404 });
    }
    if (conversion.status !== 'pending') {
      const existing = await tx.marketingLeadConversion.findUnique({ where: { id: conversionId } });
      if (existing && existing.leadId) {
        const lead = await tx.lead.findUnique({ where: { id: existing.leadId } });
        if (lead) {
          return { duplicate: true, lead, conversion: existing, idempotent: true };
        }
      }
      throw Object.assign(new Error('Conversion request is no longer pending.'), { status: 409 });
    }

    // Lock contact row
    await tx.$queryRawUnsafe('SELECT id FROM marketing_contacts WHERE id = $1 FOR UPDATE', conversion.contactId);

    const check = await canConvertToLead(conversion.contactId, actor, { tx });
    if (!check.eligible) {
      throw Object.assign(new Error(check.reasons.join(' ')), { status: 409 });
    }

    const contact = check.contact;

    // Recheck duplicate by contact already converted
    const contactFresh = await tx.marketingContact.findUnique({ where: { id: contact.id } });
    if (contactFresh?.convertedLeadId) {
      const lead = await tx.lead.findUnique({ where: { id: contactFresh.convertedLeadId } });
      const updatedConv = await tx.marketingLeadConversion.update({
        where: { id: conversion.id },
        data: {
          status: lead ? 'approved' : 'approved',
          leadId: contactFresh.convertedLeadId,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      });
      return { duplicate: true, lead: lead || null, conversion: updatedConv, idempotent: true };
    }

    const existingCustomer = await tx.customer.findFirst({
      where: {
        OR: [
          { whatsappNumber: contact.normalizedPhone },
          { phoneNumber: contact.normalizedPhone },
          { whatsappId: contact.normalizedPhone.replace(/^\+/, '') }
        ]
      }
    });

    const existingLead = existingCustomer
      ? await tx.lead.findFirst({
          where: { customerId: existingCustomer.id, ...leadScope(conversion.company) },
          orderBy: { updatedAt: 'desc' }
        })
      : null;

    if (existingLead && !options.linkExisting) {
      return { duplicate: true, lead: existingLead, conversion };
    }

    const customer = existingCustomer || await tx.customer.create({
      data: {
        id: id(),
        whatsappNumber: contact.normalizedPhone,
        phoneNumber: contact.normalizedPhone,
        whatsappId: contact.normalizedPhone.replace(/^\+/, ''),
        displayName: contact.name || contact.normalizedPhone,
        preferredLanguage: 'en'
      }
    });

    const leadData = {
      id: id(),
      customerId: customer.id,
      company: conversion.company,
      source: 'marketing',
      serialNumber: await allocateCompanyLeadSerial(tx, conversion.company),
      stage: 'new',
      language: 'en',
      marketingContactId: contact.id,
    };

    const lead = existingLead || await tx.lead.create({
      data: leadData
    });

    // If existing lead found and linking, ensure marketingContactId set
    if (existingLead && !existingLead.marketingContactId) {
      try {
        await tx.lead.update({ where: { id: existingLead.id }, data: { marketingContactId: contact.id } });
      } catch {}
    }

    const status = existingLead ? 'linked_existing' : 'approved';
    const updated = await tx.marketingLeadConversion.update({
      where: { id: conversion.id },
      data: {
        status,
        leadId: lead.id,
        duplicateLeadId: existingLead?.id || null,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        consentEvidence: conversion.consentEvidence || 'verified consent recorded in marketing_consent_events'
      }
    });

    await tx.marketingContact.update({
      where: { id: contact.id },
      data: {
        lifecycleStatus: 'converted',
        convertedLeadId: lead.id,
        lastUpdatedById: actor.id,
        lastActivityAt: new Date()
      }
    });

    await tx.marketingContactActivity.create({
      data: {
        id: id(),
        contactId: contact.id,
        actorId: actor.id,
        type: existingLead ? 'linked_existing_lead' : 'converted_to_lead',
        metadata: {
          leadId: lead.id,
          source: contact.originalSource,
          consentEvidence: 'verified',
          marketingContactId: contact.id
        }
      }
    });

    return { duplicate: false, lead, conversion: updated };
  });
}
