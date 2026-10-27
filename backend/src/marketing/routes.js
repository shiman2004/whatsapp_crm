import { CAPABILITIES, assertMarketingCapability, hasMarketingCapability, marketingRoleSummary } from './permissions.js';
import { getPrisma } from '../db.js';
import { normalizeE164, normalizeMany, parseStandardsCompliantCsv } from './normalization.js';
import crypto from 'node:crypto';
import { requestConversion, approveConversion } from './conversion.js';
import {
  getConsentStatus,
  recordConsentEvent,
  suppressContact as suppressContactService,
  canConvertToLead,
  CONSENT_STATES
} from './consent.service.js';

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5_000_000) req.destroy(new Error('Request too large'));
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function id() {
  return crypto.randomUUID();
}

function companyOf(user) {
  return user.company || 'RWC';
}

function failure(res, status, code, message) {
  return sendJson(res, status, { success: false, error: { code, message } });
}

function getDateBounds(range, customStart, customEnd) {
  const now = new Date();
  let start, end;
  if (range === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (range === 'yesterday') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
  } else if (range === 'last7days') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    end = now;
  } else if (range === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = now;
  } else if (range === 'last_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (range === 'custom' && customStart && customEnd) {
    start = new Date(customStart);
    end = new Date(customEnd);
  } else {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    end = now;
  }
  return { start, end };
}

// -------------------------------------------------------------
// 1. DASHBOARD & ANALYTICS
// -------------------------------------------------------------
async function getMarketingDashboard(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.dashboard);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const prisma = getPrisma();
  if (!prisma) return failure(res, 503, 'DATABASE_UNAVAILABLE', 'Marketing database is unavailable.');

  const company = companyOf(authUser);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const companyContacts = await prisma.marketingContact.findMany({ where: { company }, select: { id: true } });
  const companyContactIds = companyContacts.map(c => c.id);

  const [
    totalContacts,
    unassignedContacts,
    assignedContacts,
    interestedContacts,
    convertedLeads,
    contactedContacts,
    dueFollowUps,
    statusGroups,
    sourceGroups
  ] = await Promise.all([
    prisma.marketingContact.count({ where: { company } }),
    prisma.marketingContact.count({ where: { company, currentOwnerId: null } }),
    prisma.marketingContact.count({ where: { company, currentOwnerId: { not: null } } }),
    prisma.marketingContact.count({ where: { company, lifecycleStatus: 'interested' } }),
    prisma.marketingContact.count({ where: { company, lifecycleStatus: 'converted' } }),
    prisma.marketingContact.count({
      where: {
        company,
        lifecycleStatus: { in: ['contacted', 'interested', 'converted', 'follow_up_pending', 'not_interested'] }
      }
    }),
    prisma.marketingTask.count({
      where: {
        contactId: { in: companyContactIds },
        followUpAt: { lte: endOfDay },
        status: { notIn: ['completed', 'not_interested'] }
      }
    }),
    prisma.marketingContact.groupBy({
      by: ['lifecycleStatus'],
      where: { company },
      _count: { _all: true }
    }),
    prisma.marketingContact.groupBy({
      by: ['originalSource'],
      where: { company },
      _count: { _all: true }
    })
  ]);

  const contactRate = assignedContacts > 0 ? Math.round((contactedContacts / assignedContacts) * 1000) / 10 : 0;
  const qualificationRate = contactedContacts > 0 ? Math.round((interestedContacts / contactedContacts) * 1000) / 10 : 0;
  const leadConversionRate = totalContacts > 0 ? Math.round((convertedLeads / totalContacts) * 1000) / 10 : 0;

  return sendJson(res, 200, {
    success: true,
    data: {
      metrics: {
        totalContacts,
        unassignedContacts,
        assignedContacts,
        followUpsDue: dueFollowUps,
        interestedContacts,
        convertedLeads,
        rates: {
          contactRate,
          qualificationRate,
          leadConversionRate
        }
      },
      statusBreakdown: statusGroups.map(g => ({ status: g.lifecycleStatus, count: g._count._all })),
      sourceDistribution: sourceGroups.map(g => ({ source: g.originalSource || 'Unknown', count: g._count._all }))
    }
  });
}

// -------------------------------------------------------------
// 2. CONTACT MANAGEMENT & CRUD
// -------------------------------------------------------------
async function createContact(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.collect);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const payload = await readJson(req);
  const rawPhone = String(payload.phone || payload.normalizedPhone || '').trim();
  if (!rawPhone) return failure(res, 400, 'PHONE_REQUIRED', 'Phone number is required.');

  const normalizedPhone = normalizeE164(rawPhone, payload.region || 'LK');
  if (!normalizedPhone) return failure(res, 400, 'INVALID_PHONE', 'Invalid international telephone number format.');

  const prisma = getPrisma();
  if (!prisma) return failure(res, 503, 'DATABASE_UNAVAILABLE', 'Marketing database is unavailable.');

  const company = companyOf(authUser);
  if (payload.company && payload.company !== company) {
    return failure(res, 403, 'MARKETING_COMPANY_FORBIDDEN', 'Contacts must be created in your company scope.');
  }

  // Check duplicate within marketing contacts
  const existingMarketing = await prisma.marketingContact.findFirst({
    where: { normalizedPhone, company }
  });
  if (existingMarketing) {
    return failure(res, 409, 'DUPLICATE_CONTACT', `Contact with phone ${normalizedPhone} already exists in marketing database.`);
  }

  // Check duplicate within CRM Leads (provide warning)
  const existingCustomer = await prisma.customer.findFirst({
    where: {
      OR: [
        { whatsappNumber: normalizedPhone },
        { phoneNumber: normalizedPhone },
        { whatsappId: normalizedPhone.replace(/^\+/, '') }
      ]
    }
  });

  let existingLeadWarning = null;
  if (existingCustomer) {
    const existingLead = await prisma.lead.findFirst({
      where: {
        customerId: existingCustomer.id,
        OR: [{ company }, { source: company }]
      }
    });
    if (existingLead) {
      existingLeadWarning = `A CRM Lead (${existingLead.serialNumber || existingLead.id}) already exists for this phone number.`;
    }
  }

  let serial = `MKT-${Date.now().toString().slice(-8)}`;
  try {
    const serialResult = await prisma.$queryRawUnsafe('SELECT public.next_marketing_contact_serial() AS serial');
    if (serialResult[0]?.serial) serial = serialResult[0].serial;
  } catch (_) {}

  const source = String(payload.source || payload.contactSource || 'Manual Entry').trim();
  const sourceGroupName = payload.sourceName || payload.sourceGroupName || payload.name || null;
  // New public contacts must default to unknown consent + new lifecycle
  const consentStatus = 'unknown';

  const contact = await prisma.$transaction(async tx => {
    const created = await tx.marketingContact.create({
      data: {
        id: id(),
        serialNumber: serial,
        normalizedPhone,
        company,
        originalSource: source,
        sourceGroupName,
        consentStatus,
        lifecycleStatus: 'new',
        firstAddedById: authUser.id,
        qualificationNote: payload.notes || payload.note || null,
        lastActivityAt: new Date()
      }
    });

    await tx.marketingContactActivity.create({
      data: {
        id: id(),
        contactId: created.id,
        actorId: authUser.id,
        type: 'CONTACT_CREATED',
        note: payload.notes || payload.note || 'Contact manually added to marketing pool',
        metadata: { source, tags: payload.tags || null, existingLeadWarning }
      }
    });

    return created;
  });

  return sendJson(res, 201, { success: true, data: contact, warning: existingLeadWarning });
}

async function listContacts(req, res, authUser) {
  const canDashboard = hasMarketingCapability(authUser, CAPABILITIES.dashboard);
  const canViewTasks = hasMarketingCapability(authUser, CAPABILITIES.viewAssignedTasks);
  if (!canDashboard && !canViewTasks) {
    return failure(res, 403, 'MARKETING_FORBIDDEN', 'Not authorized to list marketing contacts.');
  }

  const prisma = getPrisma();
  if (!prisma) return failure(res, 503, 'DATABASE_UNAVAILABLE', 'Marketing database is unavailable.');

  const url = new URL(req.url, 'http://localhost');
  const take = Math.min(Number(url.searchParams.get('pageSize') || 50), 200);
  const skip = Math.max(Number(url.searchParams.get('page') || 1) - 1, 0) * take;
  const search = (url.searchParams.get('search') || '').trim();
  const consent = (url.searchParams.get('consentStatus') || '').trim();
  const status = (url.searchParams.get('lifecycleStatus') || '').trim();
  const assigned = url.searchParams.get('assigned');
  const dateRange = (url.searchParams.get('dateRange') || '').trim();
  const sortBy = (url.searchParams.get('sortBy') || 'createdAt').trim();
  const sortOrder = (url.searchParams.get('sortOrder') || 'desc').toLowerCase();

  const where = {
    company: companyOf(authUser),
    ...(authUser.role === 'coordinator' || authUser.role === 'marketing_officer' ? { currentOwnerId: authUser.id } : {}),
    ...(consent && consent !== 'all' ? { consentStatus: consent } : {}),
    ...(status && status !== 'all' ? { lifecycleStatus: status } : {}),
    ...(assigned === 'true' ? { currentOwnerId: { not: null } } : assigned === 'false' ? { currentOwnerId: null } : {}),
    ...(search
      ? {
          OR: [
            { normalizedPhone: { contains: search, mode: 'insensitive' } },
            { serialNumber: { contains: search, mode: 'insensitive' } },
            { originalSource: { contains: search, mode: 'insensitive' } },
            { sourceGroupName: { contains: search, mode: 'insensitive' } }
          ]
        }
      : {})
  };

  if (dateRange && dateRange !== 'all') {
    const { start, end } = getDateBounds(dateRange);
    where.createdAt = { gte: start, lte: end };
  }
  let orderBy = { createdAt: 'desc' };
  if (sortBy === 'phone' || sortBy === 'normalizedPhone') {
    orderBy = { normalizedPhone: sortOrder === 'asc' ? 'asc' : 'desc' };
  } else if (sortBy === 'serial' || sortBy === 'serialNumber') {
    orderBy = { serialNumber: sortOrder === 'asc' ? 'asc' : 'desc' };
  } else if (sortBy === 'source' || sortBy === 'originalSource') {
    orderBy = { originalSource: sortOrder === 'asc' ? 'asc' : 'desc' };
  } else if (sortBy === 'group' || sortBy === 'sourceGroupName') {
    orderBy = { sourceGroupName: sortOrder === 'asc' ? 'asc' : 'desc' };
  } else if (sortBy === 'createdAt' || sortBy === 'date') {
    orderBy = { createdAt: sortOrder === 'asc' ? 'asc' : 'desc' };
  }
  const [data, total] = await Promise.all([
    prisma.marketingContact.findMany({ where, orderBy, skip, take }),
    prisma.marketingContact.count({ where })
  ]);

  const ownerIds = [...new Set(data.map(c => c.currentOwnerId).filter(Boolean))];
  const assignedByIds = [...new Set(data.map(c => c.assignedById).filter(Boolean))];
  const allUserIds = [...new Set([...ownerIds, ...assignedByIds])];
  const users = allUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, fullName: true, role: true, company: true }
      })
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  // Fallback for contacts with currentOwnerId but missing assignedById
  const missingAssignedByContactIds = data.filter(c => c.currentOwnerId && !c.assignedById).map(c => c.id);
  const fallbackHistoryMap = new Map();
  if (missingAssignedByContactIds.length) {
    const histories = await prisma.marketingAssignmentHistory.findMany({
      where: { contactId: { in: missingAssignedByContactIds } },
      orderBy: { createdAt: 'desc' },
      take: missingAssignedByContactIds.length * 2,
    });
    const historyUserIds = [...new Set(histories.map(h => h.assignedById).filter(Boolean))];
    const missingHistoryUsers = historyUserIds.filter(id => !userMap.has(id));
    if (missingHistoryUsers.length) {
      const moreUsers = await prisma.user.findMany({
        where: { id: { in: missingHistoryUsers } },
        select: { id: true, fullName: true, role: true, company: true }
      });
      moreUsers.forEach(u => userMap.set(u.id, u));
    }
    for (const h of histories) {
      if (!fallbackHistoryMap.has(h.contactId)) {
        fallbackHistoryMap.set(h.contactId, h.assignedById);
      }
    }
  }

  const enrichedData = data.map(c => {
    const assignedById = c.assignedById || fallbackHistoryMap.get(c.id) || null;
    const assignedByUser = assignedById ? userMap.get(assignedById) || null : null;
    return {
      ...c,
      assignedOwner: c.currentOwnerId ? userMap.get(c.currentOwnerId) || null : null,
      assignedById,
      assignedBy: assignedByUser,
      assignedByName: assignedByUser?.fullName || null,
    };
  });

  return sendJson(res, 200, {
    success: true,
    data: enrichedData,
    pagination: {
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
      totalPages: Math.ceil(total / take),
      hasMore: skip + data.length < total
    }
  });
}

async function contactDetail(req, res, authUser, contactId) {
  const canDashboard = hasMarketingCapability(authUser, CAPABILITIES.dashboard);
  const canViewTasks = hasMarketingCapability(authUser, CAPABILITIES.viewAssignedTasks);
  if (!canDashboard && !canViewTasks) {
    return failure(res, 403, 'MARKETING_FORBIDDEN', 'You are not authorized to view this marketing contact.');
  }

  const prisma = getPrisma();
  if (!prisma) return failure(res, 503, 'DATABASE_UNAVAILABLE', 'Marketing database is unavailable.');

  const contact = await prisma.marketingContact.findFirst({
    where: {
      id: contactId,
      company: companyOf(authUser),
      ...(authUser.role === 'coordinator' || authUser.role === 'marketing_officer' ? { currentOwnerId: authUser.id } : {})
    }
  });

  if (!contact) return failure(res, 404, 'MARKETING_CONTACT_NOT_FOUND', 'Marketing contact not found or access restricted.');

  const [activities, assignments, consent, conversion, owner, tasks, suppression] = await Promise.all([
    prisma.marketingContactActivity.findMany({ where: { contactId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.marketingAssignmentHistory.findMany({ where: { contactId }, orderBy: { createdAt: 'desc' } }),
    prisma.marketingConsentEvent.findMany({ where: { marketingContactId: contactId }, orderBy: { occurredAt: 'desc' } }),
    prisma.marketingLeadConversion.findUnique({ where: { contactId } }),
    contact.currentOwnerId
      ? prisma.user.findUnique({
          where: { id: contact.currentOwnerId },
          select: { id: true, fullName: true, role: true }
        })
      : Promise.resolve(null),
    prisma.marketingTask.findMany({ where: { contactId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.marketingSuppression.findUnique({ where: { contactId } })
  ]);

  const conversionEligibility = await canConvertToLead(contactId, authUser);

  return sendJson(res, 200, {
    success: true,
    data: {
      contact: {
        ...contact,
        assignedOwner: owner || null,
        isSuppressed: !!suppression || contact.lifecycleStatus === 'do_not_contact',
        suppressionReason: suppression?.reason || (contact.lifecycleStatus === 'do_not_contact' ? 'Contact opted out' : null)
      },
      conversionEligibility,
      activities,
      assignments,
      consent,
      conversion,
      tasks
    }
  });
}

async function updateContactStatus(req, res, authUser, contactId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const payload = await readJson(req);
  const hasStatusUpdate = Boolean(payload.status || payload.lifecycleStatus);
  const rawStatus = hasStatusUpdate ? String(payload.status || payload.lifecycleStatus).toLowerCase() : null;

  const allowed = [
    'new',
    'assigned',
    'follow_up_pending',
    'contacted',
    'interested',
    'not_interested',
    'no_response',
    'do_not_contact',
    'converted'
  ];

  if (rawStatus && !allowed.includes(rawStatus)) {
    return failure(res, 400, 'MARKETING_STATUS_INVALID', `Invalid status. Allowed: ${allowed.join(', ')}`);
  }

  const prisma = getPrisma();
  const contact = await prisma.marketingContact.findFirst({
    where: {
      id: contactId,
      company: companyOf(authUser),
      ...(authUser.role === 'coordinator' || authUser.role === 'marketing_officer' ? { currentOwnerId: authUser.id } : {})
    }
  });
  if (!contact) return failure(res, 404, 'MARKETING_CONTACT_NOT_FOUND', 'Marketing contact not found.');

  const suppression = await prisma.marketingSuppression.findUnique({ where: { contactId } });
  if ((suppression || contact.lifecycleStatus === 'do_not_contact') && rawStatus !== 'do_not_contact') {
    if (authUser.role !== 'super_admin' && authUser.role !== 'marketing_admin') {
      return failure(res, 403, 'SUPPRESSION_PROTECTED', 'Suppressed contact cannot be reactivated through status updates. Authorized fresh opt-in required.');
    }
  }

  let newNormalizedPhone = null;
  const rawPhone = String(payload.phone || payload.normalizedPhone || '').trim();
  if (rawPhone) {
    newNormalizedPhone = normalizeE164(rawPhone, payload.region || 'LK');
    if (!newNormalizedPhone) {
      return failure(res, 400, 'INVALID_PHONE', 'Invalid international telephone number format.');
    }
    if (newNormalizedPhone !== contact.normalizedPhone) {
      const existingDuplicate = await prisma.marketingContact.findFirst({
        where: {
          normalizedPhone: newNormalizedPhone,
          company: contact.company,
          id: { not: contact.id }
        }
      });
      if (existingDuplicate) {
        return failure(res, 409, 'DUPLICATE_CONTACT', `A contact with phone number ${newNormalizedPhone} already exists in this company.`);
      }
    }
  }

  if (rawStatus === 'do_not_contact') {
    try {
      const result = await suppressContactService(contactId, payload.note || payload.reason || 'Contact marked Do Not Contact', authUser);
      return sendJson(res, 200, { success: true, data: result.contact });
    } catch (err) {
      const status = err.status || 400;
      return failure(res, status, err.code || 'SUPPRESSION_ERROR', err.message);
    }
  }

  const updated = await prisma.$transaction(async tx => {
    if (rawStatus === 'interested') {
      const check = await canConvertToLead(contact.id, authUser, { tx });
      // Don't block status change, but it's noted; conversion gate enforced separately
    }

    const row = await tx.marketingContact.update({
      where: { id: contact.id },
      data: {
        ...(newNormalizedPhone ? { normalizedPhone: newNormalizedPhone } : {}),
        lifecycleStatus: rawStatus || contact.lifecycleStatus,
        sourceGroupName: payload.sourceGroupName !== undefined ? (payload.sourceGroupName ? String(payload.sourceGroupName).trim() : null) : (payload.name ? String(payload.name).trim() : contact.sourceGroupName),
        originalSource: payload.originalSource || payload.source ? String(payload.originalSource || payload.source).trim() : contact.originalSource,
        qualificationNote: payload.note || payload.qualificationNote || contact.qualificationNote,
        lastUpdatedById: authUser.id,
        lastActivityAt: new Date()
      }
    });

    await tx.marketingContactActivity.create({
      data: {
        id: id(),
        contactId,
        actorId: authUser.id,
        type: 'STATUS_CHANGED',
        note: payload.note || `Status updated to ${rawStatus}`,
        metadata: { from: contact.lifecycleStatus, to: rawStatus }
      }
    });

    if (newNormalizedPhone && newNormalizedPhone !== contact.normalizedPhone) {
      await tx.marketingContactActivity.create({
        data: {
          id: id(),
          contactId,
          actorId: authUser.id,
          type: 'PHONE_UPDATED',
          note: `Phone number updated from ${contact.normalizedPhone} to ${newNormalizedPhone}`,
          metadata: { oldPhone: contact.normalizedPhone, newPhone: newNormalizedPhone }
        }
      });
    }

    return row;
  });

  return sendJson(res, 200, { success: true, data: updated });
}

async function addContactActivity(req, res, authUser, contactId) {
  const canUpdate = hasMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
  const canDashboard = hasMarketingCapability(authUser, CAPABILITIES.dashboard);
  if (!canUpdate && !canDashboard) {
    return failure(res, 403, 'MARKETING_FORBIDDEN', 'You are not authorized to log activities for this contact.');
  }

  const payload = await readJson(req);
  const type = String(payload.type || 'NOTE_ADDED').toUpperCase();
  const note = String(payload.note || payload.description || '').trim();

  const prisma = getPrisma();
  const contact = await prisma.marketingContact.findFirst({
    where: {
      id: contactId,
      company: companyOf(authUser),
      ...(authUser.role === 'coordinator' || authUser.role === 'marketing_officer' ? { currentOwnerId: authUser.id } : {})
    }
  });
  if (!contact) return failure(res, 404, 'MARKETING_CONTACT_NOT_FOUND', 'Marketing contact not found.');

  const activity = await prisma.$transaction(async tx => {
    const act = await tx.marketingContactActivity.create({
      data: {
        id: id(),
        contactId,
        actorId: authUser.id,
        type,
        note: note || null,
        metadata: payload.metadata || {}
      }
    });

    await tx.marketingContact.update({
      where: { id: contactId },
      data: { lastActivityAt: new Date(), lastUpdatedById: authUser.id }
    });

    return act;
  });

  return sendJson(res, 201, { success: true, data: activity });
}

async function addContactNote(req, res, authUser, contactId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const payload = await readJson(req);
  const noteText = String(payload.note || '').trim();
  if (!noteText) return failure(res, 400, 'MARKETING_NOTE_REQUIRED', 'A note is required.');

  const prisma = getPrisma();
  const contact = await prisma.marketingContact.findFirst({
    where: {
      id: contactId,
      company: companyOf(authUser),
      ...(authUser.role === 'coordinator' || authUser.role === 'marketing_officer' ? { currentOwnerId: authUser.id } : {})
    }
  });
  if (!contact) return failure(res, 404, 'MARKETING_CONTACT_NOT_FOUND', 'Marketing contact not found.');

  const activity = await prisma.$transaction(async tx => {
    const row = await tx.marketingContactActivity.create({
      data: {
        id: id(),
        contactId,
        actorId: authUser.id,
        type: 'NOTE_ADDED',
        note: noteText
      }
    });
    await tx.marketingContact.update({
      where: { id: contactId },
      data: { lastActivityAt: new Date(), lastUpdatedById: authUser.id }
    });
    return row;
  });

  return sendJson(res, 201, { success: true, data: activity });
}

async function recordConsent(req, res, authUser, contactId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const payload = await readJson(req);
  try {
    const result = await recordConsentEvent({
      contactId,
      decision: payload.decision || payload.status || payload.consentStatus,
      channel: payload.channel,
      evidenceType: payload.evidenceType,
      evidenceReference: payload.evidenceReference,
      evidenceDescription: payload.evidenceDescription || payload.evidence || payload.proof,
      purpose: payload.purpose,
      idempotencyKey: payload.idempotencyKey,
    }, authUser);
    return sendJson(res, 201, { success: true, data: result });
  } catch (err) {
    const status = err.status || 400;
    const code = err.code || 'CONSENT_ERROR';
    return failure(res, status, code, err.message);
  }
}

async function suppressContact(req, res, authUser, contactId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const payload = await readJson(req);
  try {
    const result = await suppressContactService(contactId, payload.reason || 'Requested DND', authUser);
    return sendJson(res, 200, { success: true, data: result });
  } catch (err) {
    const status = err.status || 400;
    return failure(res, status, 'SUPPRESSION_ERROR', err.message);
  }
}


async function deleteContact(req, res, authUser, contactId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.deleteContacts);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const prisma = getPrisma();
  if (!prisma) return failure(res, 503, 'DATABASE_UNAVAILABLE', 'Marketing database is unavailable.');

  try {
    const deleted = await prisma.$transaction(async tx => {
      const contact = await tx.marketingContact.findFirst({
        where: { id: contactId, company: companyOf(authUser) }
      });
      if (!contact) throw Object.assign(new Error('Marketing contact not found.'), { status: 404, code: 'MARKETING_CONTACT_NOT_FOUND' });
      if (contact.convertedLeadId) {
        throw Object.assign(new Error('Converted contacts cannot be deleted.'), { status: 409, code: 'MARKETING_CONTACT_CONVERTED' });
      }

      await tx.marketingImportRow.updateMany({ where: { contactId }, data: { contactId: null } });
      await tx.marketingContactContribution.updateMany({ where: { contactId }, data: { contactId: null } });
      await tx.marketingTask.deleteMany({ where: { contactId } });
      await tx.marketingAssignmentHistory.deleteMany({ where: { contactId } });
      await tx.marketingConsentEvent.deleteMany({ where: { marketingContactId: contactId } });
      await tx.marketingSuppression.deleteMany({ where: { contactId } });
      await tx.marketingContactActivity.deleteMany({ where: { contactId } });
      await tx.marketingLeadConversion.deleteMany({ where: { contactId } });
      await tx.marketingContact.delete({ where: { id: contactId } });
      await tx.marketingAuditLog.create({
        data: {
          id: id(),
          company: contact.company,
          actorId: authUser.id,
          action: 'marketing_contact_deleted',
          entityType: 'MarketingContact',
          entityId: contact.id,
          metadata: { serialNumber: contact.serialNumber }
        }
      });
      return { id: contact.id, serialNumber: contact.serialNumber };
    });
    return sendJson(res, 200, { success: true, data: deleted });
  } catch (err) {
    return failure(res, err.status || 500, err.code || 'MARKETING_CONTACT_DELETE_FAILED', err.message);
  }
}
// -------------------------------------------------------------
// Bulk Update
async function bulkUpdateContacts(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const payload = await readJson(req);
  const { contactIds, status, source, notes } = payload;
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return failure(res, 400, 'INVALID_PAYLOAD', 'contactIds array is required.');
  }

  const prisma = getPrisma();
  const company = companyOf(authUser);

  const updateData = { lastUpdatedById: authUser.id, lastActivityAt: new Date() };
  if (status) updateData.lifecycleStatus = status;
  if (source) updateData.originalSource = source;
  if (notes) updateData.qualificationNote = notes;

  const result = await prisma.marketingContact.updateMany({
    where: {
      id: { in: contactIds },
      company,
      ...(authUser.role === 'coordinator' || authUser.role === 'marketing_officer' ? { currentOwnerId: authUser.id } : {})
    },
    data: updateData
  });

  return sendJson(res, 200, { success: true, count: result.count });
}

// Bulk Delete
async function bulkDeleteContacts(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.deleteContacts);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const payload = await readJson(req);
  const { contactIds, reason } = payload;
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return failure(res, 400, 'INVALID_PAYLOAD', 'contactIds array is required.');
  }

  const prisma = getPrisma();
  const company = companyOf(authUser);

  let deletedCount = 0;
  for (const contactId of contactIds) {
    try {
      await prisma.$transaction(async tx => {
        const contact = await tx.marketingContact.findFirst({ where: { id: contactId, company } });
        if (!contact || contact.convertedLeadId) return;

        await tx.marketingImportRow.updateMany({ where: { contactId }, data: { contactId: null } });
        await tx.marketingContactContribution.updateMany({ where: { contactId }, data: { contactId: null } });
        await tx.marketingTask.deleteMany({ where: { contactId } });
        await tx.marketingAssignmentHistory.deleteMany({ where: { contactId } });
        await tx.marketingConsentEvent.deleteMany({ where: { marketingContactId: contactId } });
        await tx.marketingSuppression.deleteMany({ where: { contactId } });
        await tx.marketingContactActivity.deleteMany({ where: { contactId } });
        await tx.marketingLeadConversion.deleteMany({ where: { contactId } });
        await tx.marketingContact.delete({ where: { id: contactId } });
        deletedCount++;
      });
    } catch (_) {}
  }

  return sendJson(res, 200, { success: true, count: deletedCount });
}

// 3. CONTACT INGESTION & BATCH IMPORT
// -------------------------------------------------------------
async function createImport(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.collect);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const payload = await readJson(req);
  const source = String(payload.source || '').trim();
  const sourceGroupName = String(payload.sourceGroupName || '').trim() || null;
  let values = [];
  if (payload.csvText) {
    values = parseStandardsCompliantCsv(payload.csvText);
  } else if (Array.isArray(payload.numbers)) {
    values = payload.numbers;
  } else if (payload.text) {
    if (payload.text.includes('\n') && (payload.text.includes(',') || payload.text.includes('\t') || payload.text.includes(';'))) {
      const parsedCsv = parseStandardsCompliantCsv(payload.text);
      values = parsedCsv.length > 0 ? parsedCsv : String(payload.text).split(/[\n,;\t]+/);
    } else {
      values = String(payload.text).split(/[\n,;\t]+/);
    }
  }

  if (!source) return failure(res, 400, 'MARKETING_SOURCE_REQUIRED', 'Contact source is required.');
  if (!values.length || values.length > 10000) {
    return failure(res, 400, 'MARKETING_IMPORT_SIZE_INVALID', 'Import must contain between 1 and 10,000 numbers.');
  }

  const prisma = getPrisma();
  if (!prisma) return failure(res, 503, 'DATABASE_UNAVAILABLE', 'Marketing database is unavailable.');

  const rows = normalizeMany(values, payload.region || 'LK');
  const batchId = id();
  const batchNumber = `MKT-B-${Date.now()}-${batchId.slice(0, 6).toUpperCase()}`;

  const created = await prisma.marketingImportBatch.create({
    data: {
      id: batchId,
      batchNumber,
      company: companyOf(authUser),
      uploadedById: authUser.id,
      source,
      sourceGroupName,
      fileName: payload.fileName || null,
      idempotencyKey: String(payload.idempotencyKey || batchId),
      totalSubmitted: rows.length,
      status: 'processing',
      startedAt: new Date()
    }
  });

  let validNewCount = 0,
    duplicateCount = 0,
    invalidCount = 0,
    savedCount = 0;

  try {
    for (const row of rows) {
      if (!row.normalizedPhone) {
        invalidCount++;
        await prisma.marketingImportRow.create({
          data: {
            id: id(),
            batchId,
            rowNumber: row.rowNumber,
            rawPhone: row.rawPhone,
            status: 'invalid',
            errorCode: 'INVALID_PHONE',
            errorMessage: 'Not a valid international phone number.',
            processedAt: new Date()
          }
        });
        continue;
      }

      const existing = await prisma.marketingContact.findUnique({
        where: { normalizedPhone: row.normalizedPhone }
      });

      if (existing) {
        duplicateCount++;
        await prisma.marketingImportRow.create({
          data: {
            id: id(),
            batchId,
            rowNumber: row.rowNumber,
            rawPhone: row.rawPhone,
            normalizedPhone: row.normalizedPhone,
            status: 'duplicate',
            contactId: existing.id,
            processedAt: new Date()
          }
        });
        continue;
      }

      try {
        let serial = `MKT-${Date.now().toString().slice(-8)}`;
        try {
          const serialResult = await prisma.$queryRawUnsafe('SELECT public.next_marketing_contact_serial() AS serial');
          if (serialResult[0]?.serial) serial = serialResult[0].serial;
        } catch (_) {}

        const contact = await prisma.marketingContact.create({
          data: {
            id: id(),
            serialNumber: serial,
            normalizedPhone: row.normalizedPhone,
            company: companyOf(authUser),
            originalSource: row.source || source,
            sourceGroupName: row.sourceGroupName || sourceGroupName,
            qualificationNote: row.notes || null,
            firstAddedById: authUser.id,
            lifecycleStatus: 'new',
            consentStatus: 'unknown'
          }
        });

        validNewCount++;
        savedCount++;

        await prisma.marketingImportRow.create({
          data: {
            id: id(),
            batchId,
            rowNumber: row.rowNumber,
            rawPhone: row.rawPhone,
            normalizedPhone: row.normalizedPhone,
            status: 'saved',
            contactId: contact.id,
            processedAt: new Date()
          }
        });

        await prisma.marketingContactContribution.create({
          data: {
            id: id(),
            contactId: contact.id,
            batchId,
            contributedById: authUser.id,
            company: companyOf(authUser),
            source,
            sourceGroupName,
            outcome: 'saved'
          }
        });
      } catch (error) {
        if (error?.code === 'P2002') duplicateCount++;
        else throw error;
      }
    }

    const status = invalidCount || duplicateCount ? (savedCount ? 'partially_completed' : 'failed') : 'completed';
    const summary = await prisma.marketingImportBatch.update({
      where: { id: batchId },
      data: { validNewCount, duplicateCount, invalidCount, savedCount, status, completedAt: new Date() }
    });

    return sendJson(res, 201, { success: true, data: summary });
  } catch (err) {
    await prisma.marketingImportBatch
      .update({
        where: { id: batchId },
        data: { status: 'failed', errorSummary: err?.message || 'Processing error', completedAt: new Date() }
      })
      .catch(() => {});
    throw err;
  }
}

async function listUploads(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.viewOwnUploads);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const prisma = getPrisma();
  if (!prisma) return failure(res, 503, 'DATABASE_UNAVAILABLE', 'Marketing database is unavailable.');

  const isSuperAdmin = authUser.role === 'super_admin' || authUser.role === 'marketing_admin';
  const where = {
    company: companyOf(authUser),
    ...(isSuperAdmin ? {} : { uploadedById: authUser.id })
  };

  const rows = await prisma.marketingImportBatch.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200
  });

  return sendJson(res, 200, { success: true, data: rows });
}

async function getUploadDetail(req, res, authUser, batchId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.viewOwnUploads);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const prisma = getPrisma();
  const isElevated = authUser.role === 'super_admin' || authUser.role === 'marketing_admin';
  const batch = await prisma.marketingImportBatch.findFirst({
    where: { id: batchId, company: companyOf(authUser), ...(isElevated ? {} : { uploadedById: authUser.id }) }
  });
  if (!batch) return failure(res, 404, 'BATCH_NOT_FOUND', 'Upload batch not found.');

  const rows = await prisma.marketingImportRow.findMany({
    where: { batchId },
    orderBy: { rowNumber: 'asc' },
    take: 200
  });

  return sendJson(res, 200, { success: true, data: { batch, rows } });
}

function assertBatchManagement(authUser) {
  return authUser.role === 'super_admin'
    ? null
    : { status: 403, code: 'MARKETING_FORBIDDEN', message: 'Only Super Admin can manage upload batches.' };
}

async function updateUpload(req, res, authUser, batchId) {
  const authorization = assertBatchManagement(authUser);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const payload = await readJson(req);
  const source = String(payload.source || '').trim();
  if (!source) return failure(res, 400, 'MARKETING_SOURCE_REQUIRED', 'A source is required.');

  const prisma = getPrisma();
  const batch = await prisma.marketingImportBatch.findFirst({ where: { id: batchId, company: companyOf(authUser) } });
  if (!batch) return failure(res, 404, 'BATCH_NOT_FOUND', 'Upload batch not found.');

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.marketingImportBatch.update({
      where: { id: batch.id },
      data: { source, sourceGroupName: String(payload.sourceGroupName || '').trim() || null }
    });
    await tx.marketingAuditLog.create({
      data: { id: id(), company: batch.company, actorId: authUser.id, action: 'marketing_import_batch_updated', entityType: 'MarketingImportBatch', entityId: batch.id }
    });
    return result;
  });
  return sendJson(res, 200, { success: true, data: updated });
}

async function deleteUpload(req, res, authUser, batchId) {
  const authorization = assertBatchManagement(authUser);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const prisma = getPrisma();
  const batch = await prisma.marketingImportBatch.findFirst({ where: { id: batchId, company: companyOf(authUser) } });
  if (!batch) return failure(res, 404, 'BATCH_NOT_FOUND', 'Upload batch not found.');

  await prisma.$transaction(async tx => {
    await tx.marketingImportRow.deleteMany({ where: { batchId: batch.id } });
    await tx.marketingContactContribution.deleteMany({ where: { batchId: batch.id } });
    await tx.marketingLeadConversion.updateMany({ where: { sourceBatchId: batch.id }, data: { sourceBatchId: null } });
    await tx.marketingImportBatch.delete({ where: { id: batch.id } });
    await tx.marketingAuditLog.create({
      data: { id: id(), company: batch.company, actorId: authUser.id, action: 'marketing_import_batch_deleted', entityType: 'MarketingImportBatch', entityId: batch.id }
    });
  });
  return sendJson(res, 200, { success: true, data: { id: batch.id } });
}

// -------------------------------------------------------------
// 4. ASSIGNMENT ENGINE
// -------------------------------------------------------------
function uniqueIds(value) {
  return [...new Set((Array.isArray(value) ? value : []).filter(id => typeof id === 'string' && id))];
}

async function resolveAssignmentContacts(prisma, authUser, payload, { allowAssigned = false } = {}) {
  const requestedIds = uniqueIds(payload.contactIds);
  let contactIds = requestedIds;
  if (payload.batchId) {
    const batch = await prisma.marketingImportBatch.findFirst({ where: { id: String(payload.batchId), company: companyOf(authUser) }, select: { id: true } });
    if (!batch) throw Object.assign(new Error('Marketing batch not found.'), { status: 404, code: 'BATCH_NOT_FOUND' });
    const rows = await prisma.marketingImportRow.findMany({ where: { batchId: batch.id, contactId: { not: null } }, select: { contactId: true } });
    contactIds = rows.map(row => row.contactId).filter(Boolean);
  }
  const where = {
    company: companyOf(authUser),
    ...(allowAssigned ? {} : { currentOwnerId: null }),
    ...(payload.allUnassigned ? {} : { id: { in: contactIds } })
  };
  const contacts = await prisma.marketingContact.findMany({
    where,
    select: { id: true, company: true, currentOwnerId: true, lifecycleStatus: true },
    orderBy: { createdAt: 'asc' }
  });
  return { contacts, requested: contactIds.length, excluded: contactIds.length ? Math.max(contactIds.length - contacts.length, 0) : 0 };
}

async function getAssignmentPreview(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.assign);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const payload = await readJson(req);
  const officerIds = uniqueIds(payload.officerIds || payload.assigneeIds);
  if (!officerIds.length) return failure(res, 400, 'ASSIGNMENT_SELECTION_REQUIRED', 'Select at least one authorized staff member.');
  const prisma = getPrisma();
  const { contacts, requested, excluded } = await resolveAssignmentContacts(prisma, authUser, payload, { allowAssigned: Boolean(payload.allowReassign) });
  const officers = await prisma.user.findMany({
    where: { id: { in: officerIds }, active: true, marketingAccess: true, role: { in: ['coordinator', 'marketing_officer', 'leads_officer'] }, OR: [{ company: companyOf(authUser) }, { company: null }] },
    select: { id: true, fullName: true, role: true }
  });
  if (officers.length !== officerIds.length) return failure(res, 400, 'ASSIGNEE_UNAVAILABLE', 'One or more selected staff members are inactive, unauthorized, or outside this company.');
  const allocation = officers.map((officer, index) => ({ ...officer, allocated: contacts.filter((_, contactIndex) => contactIndex % officers.length === index).length }));
  return sendJson(res, 200, { success: true, data: { totalContacts: contacts.length, requested, excluded, unassignedCount: contacts.length, staff: allocation } });
}

async function updateMarketingAccess(req, res, authUser, userId) {
  if (authUser.role !== 'super_admin') return failure(res, 403, 'MARKETING_FORBIDDEN', 'Only Super Admin can change marketing access.');
  const payload = await readJson(req);
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({ where: { id: userId, active: true, role: { in: ['coordinator', 'marketing_officer', 'leads_officer'] }, OR: [{ company: companyOf(authUser) }, { company: null }] } });
  if (!user) return failure(res, 404, 'MARKETING_STAFF_NOT_FOUND', 'Active staff member not found in this company.');
  const updated = await prisma.user.update({ where: { id: user.id }, data: { marketingAccess: Boolean(payload.authorized) }, select: { id: true, fullName: true, role: true, marketingAccess: true } });
  return sendJson(res, 200, { success: true, data: updated });
}

async function listAssignable(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.assign);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const prisma = getPrisma();
  const [contacts, officers, batches, workload, staff] = await Promise.all([
    prisma.marketingContact.findMany({
      where: { company: companyOf(authUser), currentOwnerId: null },
      orderBy: { createdAt: 'asc' },
      take: 500
    }),
    prisma.user.findMany({
      where: {
        active: true,
        marketingAccess: true,
        OR: [{ company: companyOf(authUser) }, { company: null }],
        role: { in: ['coordinator', 'marketing_officer', 'leads_officer'] }
      },
      select: { id: true, fullName: true, email: true, role: true, company: true, marketingAccess: true }
    }),
    prisma.marketingImportBatch.findMany({ where: { company: companyOf(authUser) }, select: { id: true, batchNumber: true, source: true, savedCount: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.marketingContact.groupBy({ by: ['currentOwnerId', 'lifecycleStatus'], where: { company: companyOf(authUser), currentOwnerId: { not: null } }, _count: { _all: true } }),
    prisma.user.findMany({ where: { active: true, role: { in: ['coordinator', 'marketing_officer', 'leads_officer'] }, OR: [{ company: companyOf(authUser) }, { company: null }] }, select: { id: true, fullName: true, email: true, role: true, marketingAccess: true }, orderBy: { fullName: 'asc' } })
  ]);

  const workloads = officers.map(officer => ({
    userId: officer.id,
    total: workload.filter(row => row.currentOwnerId === officer.id).reduce((sum, row) => sum + row._count._all, 0),
    statuses: Object.fromEntries(workload.filter(row => row.currentOwnerId === officer.id).map(row => [row.lifecycleStatus, row._count._all]))
  }));
  return sendJson(res, 200, { success: true, data: { contacts, officers, batches, workloads, staff } });
}

async function assignContacts(req, res, authUser, targetContactId = null, isExplicitReassign = false) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.assign);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const payload = await readJson(req);
  const singleContactId = targetContactId || payload.contactId;
  const isReassignment = isExplicitReassign || Boolean(payload.isReassignment || payload.reassign);

  let contactIds = Array.isArray(payload.contactIds)
    ? payload.contactIds
    : singleContactId
    ? [singleContactId]
    : [];

  const officerIds = uniqueIds(Array.isArray(payload.officerIds)
    ? payload.officerIds
    : Array.isArray(payload.assigneeIds)
    ? payload.assigneeIds
    : payload.assignedToId
    ? [payload.assignedToId]
    : payload.coordinatorId
    ? [payload.coordinatorId]
    : payload.officerId
    ? [payload.officerId]
    : []);

  if ((!contactIds.length && !payload.allUnassigned && !payload.batchId) || !officerIds.length) {
    return failure(res, 400, 'ASSIGNMENT_SELECTION_REQUIRED', 'Select contacts and at least one coordinator/officer.');
  }

  const prisma = getPrisma();
  try {
    const result = await prisma.$transaction(async tx => {
      const selection = await resolveAssignmentContacts(tx, authUser, { ...payload, contactIds }, { allowAssigned: isReassignment || Boolean(payload.allowReassign) });
      const contacts = selection.contacts;
      contactIds = contacts.map(contact => contact.id);

      if (!contacts.length || selection.excluded) {
        throw Object.assign(new Error('Some contacts are already assigned or unavailable.'), { status: 409 });
      }

      const officers = await tx.user.findMany({
        where: {
          id: { in: officerIds },
          active: true,
          marketingAccess: true,
          role: { in: ['coordinator', 'marketing_officer', 'leads_officer'] },
          OR: [{ company: companyOf(authUser) }, { company: null }]
        },
        select: { id: true, fullName: true, company: true, role: true }
      });

      if (officers.length !== officerIds.length) {
        throw Object.assign(new Error('One or more officers are unavailable or inactive.'), { status: 400 });
      }

      // Enforce strict Company Isolation on assigned coordinators
      for (const contact of contacts) {
        for (const officer of officers) {
          if (
            officer.company &&
            officer.company !== 'ALL' &&
            officer.company !== contact.company &&
            officer.role !== 'super_admin' &&
            officer.role !== 'leads_officer'
          ) {
            throw Object.assign(
              new Error(`Cannot assign contact to coordinator (${officer.fullName}) from company ${officer.company}. Contact belongs to ${contact.company}.`),
              { status: 400, code: 'COMPANY_MISMATCH' }
            );
          }
        }
      }

      const assignments = [];
      for (let index = 0; index < contacts.length; index++) {
        const ownerId = officerIds[index % officerIds.length];
        const contact = contacts[index];
        const contactId = contact.id;
        const previousOwnerId = contact.currentOwnerId || null;
        const isReassign = Boolean(previousOwnerId && previousOwnerId !== ownerId);
        const officer = officers.find(o => o.id === ownerId);

        const claim = await tx.marketingContact.updateMany({
          where: { id: contactId, company: companyOf(authUser), ...(isReassign || payload.allowReassign ? { currentOwnerId: previousOwnerId } : { currentOwnerId: null }) },
          data: {
            currentOwnerId: ownerId,
            assignedById: authUser.id,
            assignedAt: new Date(),
            lifecycleStatus: contact.lifecycleStatus === 'new' ? 'assigned' : contact.lifecycleStatus,
            lastUpdatedById: authUser.id,
            lastActivityAt: new Date()
          }
        });
        if (claim.count !== 1) throw Object.assign(new Error('Contact was assigned by another request. Refresh and try again.'), { status: 409, code: 'ASSIGNMENT_CONFLICT' });

        await tx.marketingAssignmentHistory.create({
          data: {
            id: id(),
            contactId,
            previousOwnerId,
            newOwnerId: ownerId,
            assignedById: authUser.id,
            reason: payload.reason || (isReassign ? 'Coordinator Reassignment' : (payload.mode === 'round_robin' ? 'Round-Robin Assignment' : 'Direct Assignment')),
            createdAt: new Date(),
          }
        });

        if (previousOwnerId && previousOwnerId !== ownerId) {
          await tx.marketingTask.updateMany({
            where: { contactId, ownerId: previousOwnerId, status: 'pending' },
            data: {
              status: 'completed',
              notes: `Task closed: Reassigned to ${officer?.fullName || 'coordinator'}${payload.reason ? ` (${payload.reason})` : ''}`
            }
          });
        }

        await tx.marketingTask.upsert({
          where: { contactId_ownerId: { contactId, ownerId } },
          create: { id: id(), contactId, ownerId, status: 'pending' },
          update: { status: 'pending' }
        });

        await tx.marketingContactActivity.create({
          data: {
            id: id(),
            contactId,
            actorId: authUser.id,
            type: isReassign ? 'CONTACT_REASSIGNED' : 'CONTACT_ASSIGNED',
            note: isReassign
              ? `Reassigned to ${officer?.fullName || 'coordinator'}${payload.reason ? ` (Reason: ${payload.reason})` : ''}`
              : `Assigned to ${officer?.fullName || 'coordinator'}`,
            metadata: { previousOwnerId, newOwnerId: ownerId, reason: payload.reason, mode: payload.mode || 'single' }
          }
        });

        await tx.marketingNotification.create({
          data: {
            id: id(),
            userId: ownerId,
            type: isReassign ? 'marketing_reassignment' : 'marketing_assignment',
            payload: { contactId, assignedById: authUser.id, previousOwnerId }
          }
        });

        assignments.push({
          contactId,
          ownerId,
          assignedOwner: {
            id: officer?.id,
            fullName: officer?.fullName,
            roleTitle: officer?.role
          },
          assignedById: authUser.id,
          assignedByName: authUser.fullName,
          assignedAt: new Date().toISOString()
        });
      }

      return assignments;
    });

    return sendJson(res, 201, {
      success: true,
      data: {
        requested: contactIds.length,
        successfullyAssigned: result.length,
        assigned: result.length,
        assignments: result,
        assignedById: authUser.id,
        assignedByName: authUser.fullName
      }
    });
  } catch (err) {
    const status = err.status || 400;
    const code = err.code || 'ASSIGNMENT_ERROR';
    return failure(res, status, code, err.message);
  }
}

// -------------------------------------------------------------
// 5. COORDINATOR TASKS & WORKSPACE
// -------------------------------------------------------------
async function listTasks(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.viewAssignedTasks);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const prisma = getPrisma();
  const company = companyOf(authUser);
  const url = new URL(req.url, 'http://localhost');
  const filter = url.searchParams.get('filter') || 'all';

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const companyContacts = await prisma.marketingContact.findMany({ where: { company }, select: { id: true } });
  const companyContactIds = companyContacts.map(c => c.id);

  const isStaff = authUser.role === 'coordinator' || authUser.role === 'marketing_officer';
  const ownerWhere = isStaff ? { ownerId: authUser.id } : {};

  const baseTaskWhere = {
    ...ownerWhere,
    contactId: { in: companyContactIds }
  };

  const [totalAssigned, dueToday, overdue, interested, completed] = await Promise.all([
    prisma.marketingTask.count({ where: { ...baseTaskWhere, status: { not: 'completed' } } }),
    prisma.marketingTask.count({
      where: {
        ...baseTaskWhere,
        followUpAt: { gte: startOfDay, lte: endOfDay },
        status: { not: 'completed' }
      }
    }),
    prisma.marketingTask.count({
      where: {
        ...baseTaskWhere,
        followUpAt: { lt: startOfDay },
        status: { not: 'completed' }
      }
    }),
    prisma.marketingTask.count({
      where: {
        ...baseTaskWhere,
        status: 'interested'
      }
    }),
    prisma.marketingTask.count({
      where: {
        ...baseTaskWhere,
        status: 'completed'
      }
    })
  ]);

  let taskFilter = {};
  if (filter === 'due_today') {
    taskFilter = { followUpAt: { gte: startOfDay, lte: endOfDay }, status: { not: 'completed' } };
  } else if (filter === 'overdue') {
    taskFilter = { followUpAt: { lt: startOfDay }, status: { not: 'completed' } };
  } else if (filter === 'interested') {
    taskFilter = { status: 'interested' };
  } else if (filter === 'completed') {
    taskFilter = { status: 'completed' };
  }

  const rawTasks = await prisma.marketingTask.findMany({
    where: {
      ...baseTaskWhere,
      ...taskFilter
    },
    orderBy: [{ followUpAt: 'asc' }, { updatedAt: 'desc' }],
    take: 500
  });

  const contacts = await prisma.marketingContact.findMany({
    where: { id: { in: rawTasks.map(t => t.contactId) } }
  });
  const contactMap = new Map(contacts.map(c => [c.id, c]));
  const tasks = rawTasks.map(t => ({ ...t, contact: contactMap.get(t.contactId) || null }));

  return sendJson(res, 200, {
    success: true,
    data: tasks,
    counts: {
      totalAssigned,
      dueToday,
      overdue,
      interested,
      completed
    }
  });
}

async function updateTask(req, res, authUser, taskId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const payload = await readJson(req);
  const prisma = getPrisma();
  const task = await prisma.marketingTask.findFirst({
    where: {
      id: taskId,
      ...(authUser.role === 'coordinator' || authUser.role === 'marketing_officer' ? { ownerId: authUser.id } : {})
    }
  });

  if (!task) return failure(res, 404, 'TASK_NOT_FOUND', 'Marketing task not found.');
  const contact = await prisma.marketingContact.findUnique({ where: { id: task.contactId } });

  // Recheck suppression before allowing task updates that progress outreach
  const suppression = await prisma.marketingSuppression.findUnique({ where: { contactId: task.contactId } });
  if (suppression || contact?.lifecycleStatus === 'do_not_contact') {
    if (payload.status && payload.status !== 'completed') {
      return failure(res, 409, 'CONTACT_SUPPRESSED', 'Suppressed contacts cannot progress through marketing outreach.');
    }
  }

  const status = ['pending', 'contacted', 'interested', 'not_interested', 'follow_up', 'completed'].includes(
    payload.status
  )
    ? payload.status
    : task.status;

  const followUpAt = payload.followUpAt !== undefined
    ? (payload.followUpAt ? new Date(payload.followUpAt) : null)
    : task.followUpAt;

  const notes = payload.notes ?? task.notes;

  const result = await prisma.$transaction(async tx => {
    const updatedTask = await tx.marketingTask.update({
      where: { id: task.id },
      data: {
        status,
        notes,
        followUpAt,
        closedAt: status === 'completed' ? new Date() : null
      }
    });

    const statusMap = {
      pending: 'assigned',
      contacted: 'contacted',
      interested: 'interested',
      not_interested: 'not_interested',
      follow_up: 'follow_up_pending',
      completed: 'contacted'
    };
    const newLifecycle = statusMap[status] || task.contact?.lifecycleStatus || 'assigned';

    await tx.marketingContact.update({
      where: { id: task.contactId },
      data: {
        lifecycleStatus: newLifecycle,
        qualificationNote: notes || task.contact?.qualificationNote,
        lastActivityAt: new Date(),
        lastUpdatedById: authUser.id
      }
    });

    await tx.marketingContactActivity.create({
      data: {
        id: id(),
        contactId: task.contactId,
        actorId: authUser.id,
        type: status === 'interested' ? 'STATUS_CHANGED' : (followUpAt ? 'FOLLOW_UP_SCHEDULED' : 'STATUS_CHANGED'),
        note: notes || `Task updated to ${status}`,
        metadata: { from: task.status, to: status, followUpAt }
      }
    });

    return updatedTask;
  });

  return sendJson(res, 200, { success: true, data: result });
}

async function updateTaskByContactId(req, res, authUser, contactId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const prisma = getPrisma();
  const task = await prisma.marketingTask.findFirst({
    where: {
      contactId,
      ...(authUser.role === 'coordinator' || authUser.role === 'marketing_officer' ? { ownerId: authUser.id } : {})
    }
  });

  if (!task) return failure(res, 404, 'TASK_NOT_FOUND', 'Marketing task for contact not found.');
  return updateTask(req, res, authUser, task.id);
}

// -------------------------------------------------------------
// 6. CRM LEAD CONVERSION
// -------------------------------------------------------------
async function convertContact(req, res, authUser, contactId) {
  const canUpdate = hasMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
  const canAssign = hasMarketingCapability(authUser, CAPABILITIES.assign);
  if (!canUpdate && !canAssign) {
    return failure(res, 403, 'MARKETING_FORBIDDEN', 'Not authorized to convert marketing contact.');
  }

  const payload = await readJson(req);
  const prisma = getPrisma();
  const contact = await prisma.marketingContact.findFirst({
    where: {
      id: contactId,
      company: companyOf(authUser),
      ...(authUser.role === 'coordinator' || authUser.role === 'marketing_officer' ? { currentOwnerId: authUser.id } : {})
    }
  });
  if (!contact) return failure(res, 404, 'MARKETING_CONTACT_NOT_FOUND', 'Marketing contact not found.');

  const isPrivileged = authUser.role === 'super_admin' || authUser.role === 'marketing_admin';
  const reqRecord = await requestConversion(prisma, contact, authUser, payload.note || payload.qualificationNote);

  if (isPrivileged || payload.autoApprove) {
    const approved = await approveConversion(prisma, reqRecord.id, authUser, { linkExisting: payload.linkExisting });
    return sendJson(res, 200, { success: true, data: approved });
  }

  return sendJson(res, 201, { success: true, data: reqRecord });
}

async function conversionRequests(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.assign);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const prisma = getPrisma();
  const rows = await prisma.marketingLeadConversion.findMany({
    where: {
      company: companyOf(authUser),
      ...(req.url.includes('pending=1') ? { status: 'pending' } : {})
    },
    orderBy: { requestedAt: 'desc' },
    take: 200
  });

  return sendJson(res, 200, { success: true, data: rows });
}

// -------------------------------------------------------------
// 7. CAMPAIGNS & CONTENT
// -------------------------------------------------------------
async function campaigns(req, res, authUser) {
  const prisma = getPrisma();
  if (req.method === 'GET') {
    const authorization = assertMarketingCapability(authUser, CAPABILITIES.dashboard);
    if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
    const data = await prisma.marketingCampaign.findMany({
      where: { company: companyOf(authUser) },

      orderBy: { createdAt: 'desc' }
    });
    return sendJson(res, 200, { success: true, data });
  }

  const authorization = assertMarketingCapability(authUser, CAPABILITIES.manageCampaignDrafts);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const payload = await readJson(req);
  if (!String(payload.title || '').trim()) return failure(res, 400, 'CAMPAIGN_TITLE_REQUIRED', 'Campaign title is required.');

  const campaign = await prisma.marketingCampaign.create({
    data: {
      id: id(),
      company: companyOf(authUser),
      title: payload.title.trim(),
      description: payload.description || null,
      targetAudience: payload.targetAudience || null,
      instructions: payload.instructions || null,
      approvedText: payload.approvedText || null,
      startDate: payload.startDate ? new Date(payload.startDate) : null,
      endDate: payload.endDate ? new Date(payload.endDate) : null,
      createdById: authUser.id
    }
  });

  return sendJson(res, 201, { success: true, data: campaign });
}

// -------------------------------------------------------------
// 8. REPORTS & EXPORTS
// -------------------------------------------------------------
async function reports(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.viewReports);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);

  const prisma = getPrisma();
  const company = companyOf(authUser);
  const url = new URL(req.url, 'http://localhost');
  const range = url.searchParams.get('range') || 'last30days';
  const customStart = url.searchParams.get('startDate');
  const customEnd = url.searchParams.get('endDate');
  const isExport = url.searchParams.get('export') === 'csv';
  if (isExport) {
    const exportAuthorization = assertMarketingCapability(authUser, CAPABILITIES.export);
    if (exportAuthorization) return failure(res, exportAuthorization.status, exportAuthorization.code, exportAuthorization.message);
  }

  const { start, end } = getDateBounds(range, customStart, customEnd);

  const companyContacts = await prisma.marketingContact.findMany({ where: { company }, select: { id: true } });
  const companyContactIds = companyContacts.map(c => c.id);

  const [contacts, batches, tasks, assigned, converted, verifiedConsent, users] = await Promise.all([
    prisma.marketingContact.count({ where: { company, createdAt: { gte: start, lte: end } } }),
    prisma.marketingImportBatch.aggregate({
      where: { company, createdAt: { gte: start, lte: end } },
      _sum: { totalSubmitted: true, duplicateCount: true, invalidCount: true, savedCount: true }
    }),
    prisma.marketingTask.groupBy({
      by: ['status'],
      where: { contactId: { in: companyContactIds }, updatedAt: { gte: start, lte: end } },
      _count: { _all: true }
    }),
    prisma.marketingContact.count({ where: { company, currentOwnerId: { not: null }, createdAt: { gte: start, lte: end } } }),
    prisma.marketingContact.count({ where: { company, lifecycleStatus: 'converted', updatedAt: { gte: start, lte: end } } }),
    prisma.marketingContact.count({ where: { company, consentStatus: 'verified' } }),
    prisma.user.findMany({
      where: {
        active: true,
        OR: [{ company }, { company: null }],
        role: { in: ['coordinator', 'leads_officer', 'marketing_officer'] }
      },
      select: {
        id: true,
        fullName: true,
        role: true
      }
    })
  ]);

  const allUserTasks = await prisma.marketingTask.findMany({
    where: {
      ownerId: { in: users.map(u => u.id) },
      contactId: { in: companyContactIds },
      updatedAt: { gte: start, lte: end }
    },
    select: {
      ownerId: true,
      status: true
    }
  });

  const officerStats = users.map(user => {
    const userTasks = allUserTasks.filter(t => t.ownerId === user.id);
    const total = userTasks.length;
    const contacted = userTasks.filter(t => t.status === 'contacted').length;
    const interested = userTasks.filter(t => t.status === 'interested').length;
    const completed = userTasks.filter(t => t.status === 'completed').length;
    return {
      id: user.id,
      name: user.fullName,
      role: user.role,
      assigned: total,
      contacted,
      interested,
      completed
    };
  });

  if (isExport) {
    const csvRows = [
      ['Metric', 'Value'],
      ['Reporting Range', range],
      ['From', start.toISOString()],
      ['To', end.toISOString()],
      ['Total Contacts Imported', String(contacts)],
      ['Assigned Contacts', String(assigned)],
      ['Unassigned Contacts', String(contacts - assigned)],
      ['Converted CRM Leads', String(converted)],
      ['Verified Consent Contacts', String(verifiedConsent)],
      [],
      ['Coordinator Name', 'Role', 'Assigned', 'Contacted', 'Interested', 'Completed'],
      ...officerStats.map(o => [o.name, o.role, String(o.assigned), String(o.contacted), String(o.interested), String(o.completed)])
    ];

    const csvContent = csvRows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="marketing-report-${company}-${range}.csv"`
    });
    return res.end(csvContent);
  }

  return sendJson(res, 200, {
    success: true,
    data: {
      range,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      contacts,
      assigned,
      unassigned: Math.max(0, contacts - assigned),
      converted,
      verifiedConsent,
      imports: batches._sum,
      tasks,
      coordinatorPerformance: officerStats
    }
  });
}

// -------------------------------------------------------------
// 9. MAIN ROUTE DISPATCHER
// -------------------------------------------------------------
export async function handleMarketingRoutes(req, res, pathname, authUser) {
  if (!pathname.startsWith('/api/marketing')) return false;

  // Health & capability check
  if (req.method === 'GET' && pathname === '/api/marketing/health') {
    const authorization = assertMarketingCapability(authUser, CAPABILITIES.dashboard);
    if (authorization) return sendJson(res, authorization.status, { success: false, error: authorization });

    return sendJson(res, 200, {
      success: true,
      data: {
        module: 'public-contact-marketing',
        phase: 'production',
        company: authUser.company || null,
        ...marketingRoleSummary(authUser)
      }
    });
  }

  try {
    // Dashboard
    if (req.method === 'GET' && pathname === '/api/marketing/dashboard') {
      return await getMarketingDashboard(req, res, authUser);
    }

    // Contacts
    if (req.method === 'GET' && pathname === '/api/marketing/contacts') {
      return await listContacts(req, res, authUser);
    }
    if (req.method === 'POST' && pathname === '/api/marketing/contacts') {
      return await createContact(req, res, authUser);
    }
    if (req.method === 'POST' && pathname === '/api/marketing/contacts/bulk-update') {
      return await bulkUpdateContacts(req, res, authUser);
    }
    if (req.method === 'POST' && pathname === '/api/marketing/contacts/bulk-delete') {
      return await bulkDeleteContacts(req, res, authUser);
    }

    // Imports & Batches
    if (req.method === 'POST' && (pathname === '/api/marketing/imports' || pathname === '/api/marketing/import')) {
      return await createImport(req, res, authUser);
    }
    if (req.method === 'GET' && (pathname === '/api/marketing/uploads' || pathname === '/api/marketing/imports')) {
      return await listUploads(req, res, authUser);
    }
    const uploadMatch = pathname.match(/^\/api\/marketing\/(?:uploads|imports)\/([^/]+)$/);
    if (uploadMatch && req.method === 'GET') {
      return await getUploadDetail(req, res, authUser, uploadMatch[1]);
    }
    if (uploadMatch && req.method === 'PATCH') return await updateUpload(req, res, authUser, uploadMatch[1]);
    if (uploadMatch && req.method === 'DELETE') return await deleteUpload(req, res, authUser, uploadMatch[1]);

    // Assignments
    if (req.method === 'GET' && (pathname === '/api/marketing/assignable' || pathname === '/api/marketing/assignments/unassigned')) {
      return await listAssignable(req, res, authUser);
    }
    if (req.method === 'POST' && pathname === '/api/marketing/assignments') {
      return await assignContacts(req, res, authUser);
    }
    if (req.method === 'POST' && pathname === '/api/marketing/assignments/preview') {
      return await getAssignmentPreview(req, res, authUser);
    }
    const marketingAccessMatch = pathname.match(/^\/api\/marketing\/staff\/([^/]+)\/access$/);
    if (marketingAccessMatch && req.method === 'PATCH') return await updateMarketingAccess(req, res, authUser, marketingAccessMatch[1]);
    const assignSingleMatch = pathname.match(/^\/api\/marketing\/contacts\/([^/]+)\/(assign|reassign)$/);
    if (assignSingleMatch && req.method === 'POST') {
      return await assignContacts(req, res, authUser, assignSingleMatch[1], assignSingleMatch[2] === 'reassign');
    }

    // Tasks
    if (req.method === 'GET' && pathname === '/api/marketing/tasks') {
      return await listTasks(req, res, authUser);
    }
    const taskStatusMatch = pathname.match(/^\/api\/marketing\/tasks\/([^/]+)\/status$/);
    if (taskStatusMatch && req.method === 'PATCH') {
      return await updateTaskByContactId(req, res, authUser, taskStatusMatch[1]);
    }
    const taskMatch = pathname.match(/^\/api\/marketing\/tasks\/([^/]+)$/);
    if (taskMatch && req.method === 'PATCH') {
      return await updateTask(req, res, authUser, taskMatch[1]);
    }

    // Single Contact Operations & Drawer Sub-routes
    const contactMatch = pathname.match(/^\/api\/marketing\/contacts\/([^/]+)$/);
    if (contactMatch && req.method === 'GET') return await contactDetail(req, res, authUser, contactMatch[1]);
    if (contactMatch && req.method === 'PATCH') return await updateContactStatus(req, res, authUser, contactMatch[1]);
    if (contactMatch && req.method === 'DELETE') return await deleteContact(req, res, authUser, contactMatch[1]);

    const activityMatch = pathname.match(/^\/api\/marketing\/contacts\/([^/]+)\/activities$/);
    if (activityMatch && req.method === 'POST') return await addContactActivity(req, res, authUser, activityMatch[1]);

    const noteMatch = pathname.match(/^\/api\/marketing\/contacts\/([^/]+)\/notes$/);
    if (noteMatch && req.method === 'POST') return await addContactNote(req, res, authUser, noteMatch[1]);

    const suppressMatch = pathname.match(/^\/api\/marketing\/contacts\/([^/]+)\/suppress$/);
    if (suppressMatch && req.method === 'POST') return await suppressContact(req, res, authUser, suppressMatch[1]);

    const consentMatch = pathname.match(/^\/api\/marketing\/contacts\/([^/]+)\/consent$/);
    if (consentMatch && req.method === 'GET') {
      try {
        const statusData = await getConsentStatus(consentMatch[1]);
        if (!statusData) return failure(res, 404, 'MARKETING_CONTACT_NOT_FOUND', 'Marketing contact not found.');
        return sendJson(res, 200, { success: true, data: statusData });
      } catch (err) {
        return failure(res, err.status || 500, err.code || 'CONSENT_ERROR', err.message);
      }
    }
    if (consentMatch && req.method === 'POST') return await recordConsent(req, res, authUser, consentMatch[1]);

    // Conversion
    const directConvertMatch = pathname.match(/^\/api\/marketing\/contacts\/([^/]+)\/convert$/);
    if (directConvertMatch && req.method === 'POST') return await convertContact(req, res, authUser, directConvertMatch[1]);

    const requestMatch = pathname.match(/^\/api\/marketing\/contacts\/([^/]+)\/conversion-request$/);
    if (requestMatch && req.method === 'POST') {
      const authorization = assertMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
      if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
      const payload = await readJson(req);
      const prisma = getPrisma();
      const contact = await prisma.marketingContact.findFirst({
        where: {
          id: requestMatch[1],
          company: companyOf(authUser),
          ...(authUser.role === 'coordinator' || authUser.role === 'marketing_officer' ? { currentOwnerId: authUser.id } : {})
        }
      });
      if (!contact) return failure(res, 404, 'MARKETING_CONTACT_NOT_FOUND', 'Marketing contact not found.');
      const reqRecord = await requestConversion(prisma, contact, authUser, payload.note);
      if (payload.autoApprove && (authUser.role === 'super_admin' || authUser.role === 'marketing_admin')) {
        const approved = await approveConversion(prisma, reqRecord.id, authUser, { linkExisting: payload.linkExisting });
        return sendJson(res, 201, { success: true, data: approved });
      }
      return sendJson(res, 201, { success: true, data: reqRecord });
    }

    if (req.method === 'GET' && pathname === '/api/marketing/conversion-requests') {
      return await conversionRequests(req, res, authUser);
    }
    const approveMatch = pathname.match(/^\/api\/marketing\/conversion-requests\/([^/]+)\/approve$/);
    if (approveMatch && req.method === 'POST') {
      const authorization = assertMarketingCapability(authUser, CAPABILITIES.assign);
      if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
      const result = await approveConversion(getPrisma(), approveMatch[1], authUser);
      return sendJson(res, 200, { success: true, data: result });
    }
    const linkMatch = pathname.match(/^\/api\/marketing\/conversion-requests\/([^/]+)\/link-existing$/);
    if (linkMatch && req.method === 'POST') {
      const authorization = assertMarketingCapability(authUser, CAPABILITIES.assign);
      if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
      const result = await approveConversion(getPrisma(), linkMatch[1], authUser, { linkExisting: true });
      return sendJson(res, 200, { success: true, data: result });
    }

    // Campaigns & Reports
    if (req.method === 'GET' && pathname === '/api/marketing/campaigns') return await campaigns(req, res, authUser);
    if (req.method === 'POST' && pathname === '/api/marketing/campaigns') return await campaigns(req, res, authUser);
    if (req.method === 'GET' && pathname === '/api/marketing/reports') return await reports(req, res, authUser);
  } catch (error) {
    console.error('[Marketing] request failed:', error);
    return failure(res, error.status || 500, error.code || 'MARKETING_REQUEST_FAILED', error?.message || 'The marketing request could not be completed.');
  }

  return sendJson(res, 404, {
    success: false,
    error: { code: 'MARKETING_ROUTE_NOT_FOUND', message: 'Marketing route not found.' }
  });
}
