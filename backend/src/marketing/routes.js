import { CAPABILITIES, assertMarketingCapability, marketingRoleSummary } from './permissions.js';
import { getPrisma } from '../db.js';
import { normalizeE164, normalizeMany } from './normalization.js';
import crypto from 'node:crypto';
import { requestConversion, approveConversion } from './conversion.js';

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 5_000_000) req.destroy(new Error('Request too large')); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON body')); } });
    req.on('error', reject);
  });
}

function id() { return crypto.randomUUID(); }
function companyOf(user) { return user.company || 'RWC'; }
function failure(res, status, code, message) { return sendJson(res, status, { success: false, error: { code, message } }); }

async function createImport(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.collect);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const payload = await readJson(req);
  const source = String(payload.source || '').trim();
  const sourceGroupName = String(payload.sourceGroupName || '').trim() || null;
  const values = Array.isArray(payload.numbers) ? payload.numbers : String(payload.text || '').split(/[\n,;\t]+/);
  if (!source) return failure(res, 400, 'MARKETING_SOURCE_REQUIRED', 'Contact source is required.');
  if (!values.length || values.length > 10000) return failure(res, 400, 'MARKETING_IMPORT_SIZE_INVALID', 'Import must contain between 1 and 10,000 numbers.');
  const prisma = getPrisma();
  if (!prisma) return failure(res, 503, 'DATABASE_UNAVAILABLE', 'Marketing database is unavailable.');
  const rows = normalizeMany(values, payload.region);
  const batchId = id();
  const batchNumber = `MKT-B-${Date.now()}-${batchId.slice(0, 6).toUpperCase()}`;
  const created = await prisma.marketingImportBatch.create({ data: {
    id: batchId, batchNumber, company: companyOf(authUser), uploadedById: authUser.id,
    source, sourceGroupName, fileName: payload.fileName || null,
    idempotencyKey: String(payload.idempotencyKey || batchId), totalSubmitted: rows.length,
    status: 'processing', startedAt: new Date()
  }});
  let validNewCount = 0, duplicateCount = 0, invalidCount = 0, savedCount = 0;
  for (const row of rows) {
    if (!row.normalizedPhone) { invalidCount++; await prisma.marketingImportRow.create({ data: { id: id(), batchId, rowNumber: row.rowNumber, rawPhone: row.rawPhone, status: 'invalid', errorCode: 'INVALID_PHONE', errorMessage: 'Not a valid international phone number.', processedAt: new Date() } }); continue; }
    const existing = await prisma.marketingContact.findUnique({ where: { normalizedPhone: row.normalizedPhone } });
    if (existing) { duplicateCount++; await prisma.marketingImportRow.create({ data: { id: id(), batchId, rowNumber: row.rowNumber, rawPhone: row.rawPhone, normalizedPhone: row.normalizedPhone, status: 'duplicate', contactId: existing.id, processedAt: new Date() } }); continue; }
    try {
      const serialResult = await prisma.$queryRawUnsafe('SELECT public.next_marketing_contact_serial() AS serial');
      const contact = await prisma.marketingContact.create({ data: { id: id(), serialNumber: serialResult[0].serial, normalizedPhone: row.normalizedPhone, company: companyOf(authUser), originalSource: source, sourceGroupName, firstAddedById: authUser.id } });
      validNewCount++; savedCount++;
      await prisma.marketingImportRow.create({ data: { id: id(), batchId, rowNumber: row.rowNumber, rawPhone: row.rawPhone, normalizedPhone: row.normalizedPhone, status: 'saved', contactId: contact.id, processedAt: new Date() } });
      await prisma.marketingContactContribution.create({ data: { id: id(), contactId: contact.id, batchId, contributedById: authUser.id, company: companyOf(authUser), source, sourceGroupName, outcome: 'saved' } });
    } catch (error) {
      if (error?.code === 'P2002') duplicateCount++;
      else throw error;
    }
  }
  const status = invalidCount || duplicateCount ? (savedCount ? 'partially_completed' : 'failed') : 'completed';
  const summary = await prisma.marketingImportBatch.update({ where: { id: batchId }, data: { validNewCount, duplicateCount, invalidCount, savedCount, status, completedAt: new Date() } });
  return sendJson(res, 201, { success: true, data: summary });
}

async function listUploads(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.viewOwnUploads);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const prisma = getPrisma();
  if (!prisma) return failure(res, 503, 'DATABASE_UNAVAILABLE', 'Marketing database is unavailable.');
  const rows = await prisma.marketingImportBatch.findMany({ where: { company: companyOf(authUser), uploadedById: authUser.id }, orderBy: { createdAt: 'desc' }, take: 200 });
  return sendJson(res, 200, { success: true, data: rows });
}

async function listContacts(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.dashboard);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const prisma = getPrisma();
  if (!prisma) return failure(res, 503, 'DATABASE_UNAVAILABLE', 'Marketing database is unavailable.');
  const url = new URL(req.url, 'http://localhost');
  const take = Math.min(Number(url.searchParams.get('pageSize') || 50), 200);
  const skip = Math.max(Number(url.searchParams.get('page') || 1) - 1, 0) * take;
  const search = (url.searchParams.get('search') || '').trim();
  const consent = (url.searchParams.get('consentStatus') || '').trim();
  const status = (url.searchParams.get('lifecycleStatus') || '').trim();
  const assigned = url.searchParams.get('assigned');

  const where = {
    company: companyOf(authUser),
    ...(authUser.role === 'marketing_officer' ? { currentOwnerId: authUser.id } : {}),
    ...(consent && consent !== 'all' ? { consentStatus: consent } : {}),
    ...(status && status !== 'all' ? { lifecycleStatus: status } : {}),
    ...(assigned === 'true' ? { currentOwnerId: { not: null } } : assigned === 'false' ? { currentOwnerId: null } : {}),
    ...(search ? {
      OR: [
        { normalizedPhone: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { originalSource: { contains: search, mode: 'insensitive' } },
        { sourceGroupName: { contains: search, mode: 'insensitive' } }
      ]
    } : {})
  };
  const [data, total] = await Promise.all([prisma.marketingContact.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }), prisma.marketingContact.count({ where })]);
  return sendJson(res, 200, { success: true, data, pagination: { total, page: Math.floor(skip / take) + 1, pageSize: take, hasMore: skip + data.length < total } });
}

async function listAssignable(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.assign);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const prisma = getPrisma();
  const [contacts, officers] = await Promise.all([
    prisma.marketingContact.findMany({ where: { company: companyOf(authUser), currentOwnerId: null }, orderBy: { createdAt: 'asc' }, take: 500 }),
    prisma.user.findMany({ where: { active: true, role: 'marketing_officer', company: companyOf(authUser) }, select: { id: true, fullName: true, email: true } })
  ]);
  return sendJson(res, 200, { success: true, data: { contacts, officers } });
}

async function assignContacts(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.assign);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const payload = await readJson(req);
  const contactIds = Array.isArray(payload.contactIds) ? payload.contactIds : [];
  const officerIds = Array.isArray(payload.officerIds) ? payload.officerIds : [];
  if (!contactIds.length || !officerIds.length) return failure(res, 400, 'ASSIGNMENT_SELECTION_REQUIRED', 'Select contacts and at least one marketing officer.');
  const prisma = getPrisma();
  const result = await prisma.$transaction(async tx => {
    const contacts = await tx.marketingContact.findMany({ where: { id: { in: contactIds }, company: companyOf(authUser), currentOwnerId: null }, select: { id: true } });
    if (contacts.length !== contactIds.length) throw Object.assign(new Error('Some contacts are already assigned or unavailable.'), { status: 409 });
    const officers = await tx.user.findMany({ where: { id: { in: officerIds }, role: 'marketing_officer', active: true, company: companyOf(authUser) }, select: { id: true } });
    if (officers.length !== officerIds.length) throw Object.assign(new Error('One or more officers are unavailable.'), { status: 400 });
    const assignments = [];
    for (let index = 0; index < contacts.length; index++) {
      const ownerId = officerIds[index % officerIds.length];
      const contactId = contacts[index].id;
      await tx.marketingContact.updateMany({ where: { id: contactId, currentOwnerId: null }, data: { currentOwnerId: ownerId, assignedById: authUser.id, assignedAt: new Date(), lastUpdatedById: authUser.id } });
      await tx.marketingAssignmentHistory.create({ data: { id: id(), contactId, newOwnerId: ownerId, assignedById: authUser.id, reason: payload.reason || 'Bulk assignment' } });
      await tx.marketingTask.upsert({ where: { contactId_ownerId: { contactId, ownerId } }, create: { id: id(), contactId, ownerId }, update: {} });
      await tx.marketingNotification.create({ data: { id: id(), userId: ownerId, type: 'marketing_assignment', payload: { contactId, assignedById: authUser.id } } });
      assignments.push({ contactId, ownerId });
    }
    return assignments;
  }).catch(error => { if (error.status) throw error; throw error; });
  return sendJson(res, 201, { success: true, data: { assigned: result.length, assignments: result } });
}

async function listTasks(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.viewAssignedTasks);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const prisma = getPrisma();
  const contactIds = (await prisma.marketingContact.findMany({ where: { company: companyOf(authUser) }, select: { id: true } })).map(row => row.id);
  const tasks = await prisma.marketingTask.findMany({ where: { ownerId: authUser.id, contactId: { in: contactIds } }, orderBy: { updatedAt: 'desc' }, take: 500 });
  const contacts = await prisma.marketingContact.findMany({ where: { id: { in: tasks.map(t => t.contactId) } } });
  const contactMap = new Map(contacts.map(c => [c.id, c]));
  const enriched = tasks.map(t => ({ ...t, contact: contactMap.get(t.contactId) || null }));
  return sendJson(res, 200, { success: true, data: enriched });
}

async function updateTask(req, res, authUser, taskId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const payload = await readJson(req);
  const prisma = getPrisma();
  const task = await prisma.marketingTask.findFirst({ where: { id: taskId, ownerId: authUser.id } });
  if (!task) return failure(res, 404, 'TASK_NOT_FOUND', 'Marketing task not found.');
  const status = ['pending', 'contacted', 'interested', 'not_interested', 'follow_up', 'completed'].includes(payload.status) ? payload.status : task.status;
  const updated = await prisma.marketingTask.update({ where: { id: task.id }, data: { status, notes: payload.notes ?? task.notes, followUpAt: payload.followUpAt ? new Date(payload.followUpAt) : task.followUpAt, closedAt: status === 'completed' ? new Date() : null } });
  return sendJson(res, 200, { success: true, data: updated });
}

async function campaigns(req, res, authUser) {
  const prisma = getPrisma();
  if (req.method === 'GET') {
    const authorization = assertMarketingCapability(authUser, CAPABILITIES.dashboard);
    if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
    const data = await prisma.marketingCampaign.findMany({ where: { company: companyOf(authUser) }, include: { officers: true }, orderBy: { createdAt: 'desc' } });
    return sendJson(res, 200, { success: true, data });
  }
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.manageCampaignDrafts);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const payload = await readJson(req);
  if (!String(payload.title || '').trim()) return failure(res, 400, 'CAMPAIGN_TITLE_REQUIRED', 'Campaign title is required.');
  const campaign = await prisma.marketingCampaign.create({ data: { id: id(), company: companyOf(authUser), title: payload.title.trim(), description: payload.description || null, targetAudience: payload.targetAudience || null, instructions: payload.instructions || null, approvedText: payload.approvedText || null, startDate: payload.startDate ? new Date(payload.startDate) : null, endDate: payload.endDate ? new Date(payload.endDate) : null, createdById: authUser.id } });
  return sendJson(res, 201, { success: true, data: campaign });
}

async function reports(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.viewReports);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const prisma = getPrisma();
  const company = companyOf(authUser);
  const [contacts, batches, tasks, assigned, converted, verifiedConsent] = await Promise.all([
    prisma.marketingContact.count({ where: { company } }),
    prisma.marketingImportBatch.aggregate({ where: { company }, _sum: { totalSubmitted: true, duplicateCount: true, invalidCount: true, savedCount: true } }),
    prisma.marketingTask.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.marketingContact.count({ where: { company, currentOwnerId: { not: null } } }),
    prisma.marketingContact.count({ where: { company, lifecycleStatus: 'converted' } }),
    prisma.marketingContact.count({ where: { company, consentStatus: 'verified' } })
  ]);
  return sendJson(res, 200, { success: true, data: { contacts, assigned, unassigned: contacts - assigned, converted, verifiedConsent, imports: batches._sum, tasks } });
}

async function contactDetail(req, res, authUser, contactId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.dashboard);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const prisma = getPrisma();
  const contact = await prisma.marketingContact.findFirst({ where: { id: contactId, company: companyOf(authUser), ...(authUser.role === 'marketing_officer' ? { currentOwnerId: authUser.id } : {}) } });
  if (!contact) return failure(res, 404, 'MARKETING_CONTACT_NOT_FOUND', 'Marketing contact not found.');
  const [activities, assignments, consent, conversion] = await Promise.all([
    prisma.marketingContactActivity.findMany({ where: { contactId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.marketingAssignmentHistory.findMany({ where: { contactId }, orderBy: { createdAt: 'desc' } }),
    prisma.marketingConsentEvent.findMany({ where: { contactId }, orderBy: { recordedAt: 'desc' } }),
    prisma.marketingLeadConversion.findUnique({ where: { contactId } })
  ]);
  return sendJson(res, 200, { success: true, data: { contact, activities, assignments, consent, conversion } });
}

async function updateContactStatus(req, res, authUser, contactId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const payload = await readJson(req);
  const allowed = ['new', 'assigned', 'follow_up_pending', 'contacted', 'interested', 'not_interested', 'no_response', 'do_not_contact'];
  if (!allowed.includes(payload.status)) return failure(res, 400, 'MARKETING_STATUS_INVALID', 'Invalid marketing contact status.');
  const prisma = getPrisma();
  const contact = await prisma.marketingContact.findFirst({ where: { id: contactId, company: companyOf(authUser), ...(authUser.role === 'marketing_officer' ? { currentOwnerId: authUser.id } : {}) } });
  if (!contact) return failure(res, 404, 'MARKETING_CONTACT_NOT_FOUND', 'Assigned marketing contact not found.');
  const updated = await prisma.$transaction(async tx => {
    const row = await tx.marketingContact.update({ where: { id: contact.id }, data: { lifecycleStatus: payload.status, qualificationNote: payload.note || contact.qualificationNote, lastUpdatedById: authUser.id, lastActivityAt: new Date() } });
    await tx.marketingContactActivity.create({ data: { id: id(), contactId, actorId: authUser.id, type: 'status_changed', note: payload.note || null, metadata: { from: contact.lifecycleStatus, to: payload.status } } });
    return row;
  });
  return sendJson(res, 200, { success: true, data: updated });
}

async function addContactNote(req, res, authUser, contactId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const payload = await readJson(req);
  if (!String(payload.note || '').trim()) return failure(res, 400, 'MARKETING_NOTE_REQUIRED', 'A note is required.');
  const prisma = getPrisma();
  const contact = await prisma.marketingContact.findFirst({ where: { id: contactId, company: companyOf(authUser), ...(authUser.role === 'marketing_officer' ? { currentOwnerId: authUser.id } : {}) } });
  if (!contact) return failure(res, 404, 'MARKETING_CONTACT_NOT_FOUND', 'Assigned marketing contact not found.');
  const activity = await prisma.$transaction(async tx => {
    const row = await tx.marketingContactActivity.create({ data: { id: id(), contactId, actorId: authUser.id, type: 'note_added', note: String(payload.note).trim() } });
    await tx.marketingContact.update({ where: { id: contactId }, data: { lastActivityAt: new Date(), lastUpdatedById: authUser.id } });
    return row;
  });
  return sendJson(res, 201, { success: true, data: activity });
}

async function recordConsent(req, res, authUser, contactId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const payload = await readJson(req);
  const allowed = ['unknown', 'verified', 'denied', 'opted_out'];
  if (!allowed.includes(payload.status) || !String(payload.evidence || '').trim()) return failure(res, 400, 'CONSENT_EVIDENCE_REQUIRED', 'Consent status and evidence are required.');
  const prisma = getPrisma();
  const contact = await prisma.marketingContact.findFirst({ where: { id: contactId, company: companyOf(authUser), ...(authUser.role === 'marketing_officer' ? { currentOwnerId: authUser.id } : {}) } });
  if (!contact) return failure(res, 404, 'MARKETING_CONTACT_NOT_FOUND', 'Assigned marketing contact not found.');
  const updated = await prisma.$transaction(async tx => {
    const event = await tx.marketingConsentEvent.create({ data: { id: id(), contactId, status: payload.status, purpose: payload.purpose || 'marketing follow-up', channel: payload.channel || 'CRM', evidence: String(payload.evidence).trim(), recordedById: authUser.id } });
    const row = await tx.marketingContact.update({ where: { id: contactId }, data: { consentStatus: payload.status, lastUpdatedById: authUser.id, lastActivityAt: new Date(), lifecycleStatus: payload.status === 'opted_out' || payload.status === 'denied' ? 'do_not_contact' : contact.lifecycleStatus } });
    return { contact: row, event };
  });
  return sendJson(res, 201, { success: true, data: updated });
}

async function conversionRequests(req, res, authUser) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.assign);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const prisma = getPrisma();
  const rows = await prisma.marketingLeadConversion.findMany({ where: { company: companyOf(authUser), ...(req.url.includes('pending=1') ? { status: 'pending' } : {}) }, orderBy: { requestedAt: 'desc' }, take: 200 });
  return sendJson(res, 200, { success: true, data: rows });
}

async function getUploadDetail(req, res, authUser, batchId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.viewOwnUploads);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const prisma = getPrisma();
  const batch = await prisma.marketingImportBatch.findFirst({ where: { id: batchId, company: companyOf(authUser) } });
  if (!batch) return failure(res, 404, 'BATCH_NOT_FOUND', 'Upload batch not found.');
  const rows = await prisma.marketingImportRow.findMany({ where: { batchId }, orderBy: { rowNumber: 'asc' }, take: 100 });
  return sendJson(res, 200, { success: true, data: { batch, rows } });
}

async function suppressContact(req, res, authUser, contactId) {
  const authorization = assertMarketingCapability(authUser, CAPABILITIES.dashboard);
  if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
  const payload = await readJson(req);
  const prisma = getPrisma();
  const contact = await prisma.marketingContact.findFirst({ where: { id: contactId, company: companyOf(authUser) } });
  if (!contact) return failure(res, 404, 'MARKETING_CONTACT_NOT_FOUND', 'Marketing contact not found.');
  const result = await prisma.$transaction(async tx => {
    const sup = await tx.marketingSuppression.upsert({
      where: { contactId },
      create: { id: id(), contactId, reason: payload.reason || 'Requested DND', recordedById: authUser.id },
      update: { reason: payload.reason || 'Requested DND', recordedById: authUser.id }
    });
    const updated = await tx.marketingContact.update({
      where: { id: contactId },
      data: { lifecycleStatus: 'do_not_contact', consentStatus: 'opted_out', lastUpdatedById: authUser.id, lastActivityAt: new Date() }
    });
    await tx.marketingContactActivity.create({
      data: { id: id(), contactId, actorId: authUser.id, type: 'suppressed_dnd', note: payload.reason || 'Marked as Do Not Contact' }
    });
    return { contact: updated, suppression: sup };
  });
  return sendJson(res, 200, { success: true, data: result });
}

// Phase 1 only exposes a protected capability discovery endpoint. Contact, import,
// assignment, campaign, and reporting handlers are added in their respective phases.
export async function handleMarketingRoutes(req, res, pathname, authUser) {
  if (!pathname.startsWith('/api/marketing')) return false;

  if (req.method === 'GET' && pathname === '/api/marketing/health') {
    const authorization = assertMarketingCapability(authUser, CAPABILITIES.dashboard);
    if (authorization) return sendJson(res, authorization.status, { success: false, error: authorization });

    return sendJson(res, 200, {
      success: true,
      data: {
        module: 'public-contact-marketing',
        phase: 'foundation',
        company: authUser.company || null,
        ...marketingRoleSummary(authUser)
      }
    });
  }

  try {
    if (req.method === 'POST' && pathname === '/api/marketing/imports') return await createImport(req, res, authUser);
    if (req.method === 'GET' && pathname === '/api/marketing/uploads') return await listUploads(req, res, authUser);
    const uploadMatch = pathname.match(/^\/api\/marketing\/uploads\/([^/]+)$/);
    if (uploadMatch && req.method === 'GET') return await getUploadDetail(req, res, authUser, uploadMatch[1]);
    if (req.method === 'GET' && pathname === '/api/marketing/contacts') return await listContacts(req, res, authUser);
    if (req.method === 'GET' && pathname === '/api/marketing/assignable') return await listAssignable(req, res, authUser);
    if (req.method === 'POST' && pathname === '/api/marketing/assignments') return await assignContacts(req, res, authUser);
    if (req.method === 'GET' && pathname === '/api/marketing/tasks') return await listTasks(req, res, authUser);
    if (req.method === 'GET' && pathname === '/api/marketing/campaigns') return await campaigns(req, res, authUser);
    if (req.method === 'POST' && pathname === '/api/marketing/campaigns') return await campaigns(req, res, authUser);
    if (req.method === 'GET' && pathname === '/api/marketing/reports') return await reports(req, res, authUser);
    if (req.method === 'GET' && pathname === '/api/marketing/conversion-requests') return await conversionRequests(req, res, authUser);
    const contactMatch = pathname.match(/^\/api\/marketing\/contacts\/([^/]+)$/);
    if (contactMatch && req.method === 'GET') return await contactDetail(req, res, authUser, contactMatch[1]);
    if (contactMatch && req.method === 'PATCH') return await updateContactStatus(req, res, authUser, contactMatch[1]);
    const noteMatch = pathname.match(/^\/api\/marketing\/contacts\/([^/]+)\/notes$/);
    if (noteMatch && req.method === 'POST') return await addContactNote(req, res, authUser, noteMatch[1]);
    const suppressMatch = pathname.match(/^\/api\/marketing\/contacts\/([^/]+)\/suppress$/);
    if (suppressMatch && req.method === 'POST') return await suppressContact(req, res, authUser, suppressMatch[1]);
    const consentMatch = pathname.match(/^\/api\/marketing\/contacts\/([^/]+)\/consent$/);
    if (consentMatch && req.method === 'POST') return await recordConsent(req, res, authUser, consentMatch[1]);
    const requestMatch = pathname.match(/^\/api\/marketing\/contacts\/([^/]+)\/conversion-request$/);
    if (requestMatch && req.method === 'POST') {
      const authorization = assertMarketingCapability(authUser, CAPABILITIES.updateAssignedTasks);
      if (authorization) return failure(res, authorization.status, authorization.code, authorization.message);
      const payload = await readJson(req);
      const prisma = getPrisma();
      const contact = await prisma.marketingContact.findFirst({ where: { id: requestMatch[1], company: companyOf(authUser) } });
      if (!contact) return failure(res, 404, 'MARKETING_CONTACT_NOT_FOUND', 'Marketing contact not found.');
      const reqRecord = await requestConversion(prisma, contact, authUser, payload.note);
      if (payload.autoApprove && (authUser.role === 'super_admin' || authUser.role === 'marketing_admin')) {
        const approved = await approveConversion(prisma, reqRecord.id, authUser, { linkExisting: payload.linkExisting });
        return sendJson(res, 201, { success: true, data: approved });
      }
      return sendJson(res, 201, { success: true, data: reqRecord });
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
    const taskMatch = pathname.match(/^\/api\/marketing\/tasks\/([^/]+)$/);
    if (req.method === 'PATCH' && taskMatch) return await updateTask(req, res, authUser, taskMatch[1]);
  } catch (error) {
    console.error('[Marketing] request failed:', error);
    return failure(res, 500, 'MARKETING_REQUEST_FAILED', 'The marketing request could not be completed.');
  }

  return sendJson(res, 404, {
    success: false,
    error: { code: 'MARKETING_ROUTE_NOT_AVAILABLE', message: 'This marketing capability is not available in the current release phase.' }
  });
}
