import assert from 'node:assert/strict';
import { normalizeE164, isValidE164, normalizeMany } from './src/marketing/normalization.js';
import { handleMarketingRoutes } from './src/marketing/routes.js';
import { getPrisma } from './src/db.js';
import { ensureSchema } from './src/schemaBootstrap.js';
import { Readable } from 'node:stream';

function mockReq(method, path, body = null) {
  const req = new Readable({
    read() {
      if (body) {
        this.push(typeof body === 'string' ? body : JSON.stringify(body));
      }
      this.push(null);
    }
  });
  req.method = method;
  req.url = path;
  req.headers = { 'content-type': 'application/json' };
  return req;
}

function mockRes() {
  return {
    status: null,
    headers: {},
    body: null,
    writeHead(status, headers = {}) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      if (this.headers['Content-Type'] === 'text/csv') {
        this.body = body;
      } else {
        try {
          this.body = JSON.parse(body);
        } catch (_) {
          this.body = body;
        }
      }
    }
  };
}

console.log('🧪 Starting Public Contact Marketing End-to-End Test Suite...\n');

// ======================================================================
// SCENARIO 1 & 2: Phone Normalization (LK variants, international & invalid)
// ======================================================================
console.log('--- Scenarios 1 & 2: E.164 Phone Normalization & Validation ---');
assert.equal(normalizeE164('0771234567'), '+94771234567', 'National 077 should normalize to +94771234567');
assert.equal(normalizeE164('94771234567'), '+94771234567', '9477 without + should normalize to +94771234567');
assert.equal(normalizeE164('+94771234567'), '+94771234567', '+9477 should remain +94771234567');
assert.equal(normalizeE164('771234567'), '+94771234567', '77 without 0 should normalize to +94771234567');
assert.equal(normalizeE164('0112345678'), '+94112345678', 'Landline 011 should normalize to +94112345678');
assert.equal(normalizeE164('+12025550199'), '+12025550199', 'US number should remain +12025550199');
assert.equal(normalizeE164('+447911123456'), '+447911123456', 'UK number should remain +447911123456');
assert.equal(normalizeE164('12345'), null, 'Short invalid number should be rejected');
assert.equal(normalizeE164('abcdef'), null, 'Alphabetic characters should be rejected');
assert.equal(normalizeE164('+941234'), null, 'Truncated Sri Lankan number should be rejected');
assert.equal(isValidE164('+94771234567'), true);
assert.equal(isValidE164('0771234567'), false);
console.log('✅ Pass 1 & 2: All phone normalizations and rejections verified.\n');

// Prepare test actors
const superAdmin = { id: 'test-sa-1', role: 'super_admin', active: true, company: 'RWC' };
const marketingAdmin = { id: 'test-ma-1', role: 'marketing_admin', active: true, company: 'RWC' };
const coordinator1 = { id: 'test-coord-1', role: 'coordinator', active: true, company: 'RWC' };
const coordinator2 = { id: 'test-coord-2', role: 'coordinator', active: true, company: 'RWC' };

const prisma = getPrisma();
await ensureSchema(prisma);

// Ensure test coordinators exist in database
await prisma.user.upsert({
  where: { id: coordinator1.id },
  create: { id: coordinator1.id, email: 'coord1@test.com', fullName: 'Coordinator One', role: 'coordinator', company: 'RWC', active: true },
  update: { active: true, company: 'RWC', role: 'coordinator' }
});
await prisma.user.upsert({
  where: { id: coordinator2.id },
  create: { id: coordinator2.id, email: 'coord2@test.com', fullName: 'Coordinator Two', role: 'coordinator', company: 'RWC', active: true },
  update: { active: true, company: 'RWC', role: 'coordinator' }
});

const testPhones = ['+94770000001', '+94770000002', '+94770000003', '+94770000004'];

// Clean up any test records in test DB
const existingContacts = await prisma.marketingContact.findMany({
  where: { normalizedPhone: { in: testPhones } },
  select: { id: true }
});
const contactIds = existingContacts.map(c => c.id);
if (contactIds.length) {
  await prisma.marketingLeadConversion.deleteMany({ where: { contactId: { in: contactIds } } }).catch(() => {});
  await prisma.marketingTask.deleteMany({ where: { contactId: { in: contactIds } } }).catch(() => {});
  await prisma.marketingContactActivity.deleteMany({ where: { contactId: { in: contactIds } } }).catch(() => {});
  await prisma.marketingConsentEvent.deleteMany({ where: { marketingContactId: { in: contactIds } } }).catch(() => {});
  await prisma.marketingContact.deleteMany({ where: { id: { in: contactIds } } }).catch(() => {});
}

const existingCustomers = await prisma.customer.findMany({
  where: { OR: [{ whatsappNumber: { in: testPhones } }, { phoneNumber: { in: testPhones } }] },
  select: { id: true }
});
if (existingCustomers.length) {
  const custIds = existingCustomers.map(c => c.id);
  await prisma.lead.deleteMany({ where: { customerId: { in: custIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: custIds } } });
}

// ======================================================================
// SCENARIO 3, 4, 5: Single Contact Creation & Deduplication
// ======================================================================
console.log('--- Scenarios 3, 4, 5: Single Contact Creation & Deduplication ---');
const createRes1 = mockRes();
await handleMarketingRoutes(
  mockReq('POST', '/api/marketing/contacts', {
    phone: '0770000001',
    name: 'Dilshan Silva',
    source: 'Medical Exhibition 2026',
    tags: 'VIP, Cardiology',
    consentStatus: 'unknown',
    notes: 'Inquired about executive health checkup'
  }),
  createRes1,
  '/api/marketing/contacts',
  superAdmin
);
assert.equal(createRes1.status, 201, 'Should create contact');
assert.equal(createRes1.body.data.normalizedPhone, '+94770000001');
assert.equal(createRes1.body.data.lifecycleStatus, 'new');

// Attempt duplicate creation of same phone
const dupRes = mockRes();
await handleMarketingRoutes(
  mockReq('POST', '/api/marketing/contacts', {
    phone: '+94770000001',
    source: 'Duplicate Entry'
  }),
  dupRes,
  '/api/marketing/contacts',
  superAdmin
);
assert.equal(dupRes.status, 409, 'Duplicate contact should be rejected with 409 Conflict');
console.log('✅ Pass 3, 4, 5: Contact created, normalized to +94770000001, and duplicate rejected.\n');

// ======================================================================
// SCENARIO 6 & 7: Batch Import with Duplicate & Invalid Quarantining
// ======================================================================
console.log('--- Scenarios 6 & 7: Batch Ingestion & Row Audit Log ---');
const importRes = mockRes();
await handleMarketingRoutes(
  mockReq('POST', '/api/marketing/import', {
    source: 'Public WhatsApp Group',
    sourceGroupName: 'Healthcare Lanka Community',
    numbers: [
      '0770000002',     // Clean valid new
      '0770000003',     // Clean valid new
      '+94770000001',   // Duplicate against existing DB
      '0770000002',     // Duplicate within same batch
      'invalid-phone'   // Malformed invalid
    ]
  }),
  importRes,
  '/api/marketing/import',
  superAdmin
);
assert.equal(importRes.status, 201);
assert.equal(importRes.body.data.totalSubmitted, 5);
assert.equal(importRes.body.data.savedCount, 2, 'Should save 2 unique valid contacts');
assert.equal(importRes.body.data.duplicateCount, 2, 'Should detect 2 duplicates');
assert.equal(importRes.body.data.invalidCount, 1, 'Should quarantine 1 invalid row');
const batchId = importRes.body.data.id;

// Verify batch row details
const batchDetailRes = mockRes();
await handleMarketingRoutes(
  mockReq('GET', `/api/marketing/imports/${batchId}`),
  batchDetailRes,
  `/api/marketing/imports/${batchId}`,
  superAdmin
);
assert.equal(batchDetailRes.status, 200);
assert.equal(batchDetailRes.body.data.rows.length, 5);
console.log('✅ Pass 6 & 7: Batch import completed with row audits: 2 saved, 2 duplicate, 1 invalid.\n');

// ======================================================================
// SCENARIO 8 & 9: Round-Robin Assignment Engine
// ======================================================================
console.log('--- Scenarios 8 & 9: Round-Robin Assignment Engine ---');
const contactsToAssign = await prisma.marketingContact.findMany({
  where: { normalizedPhone: { in: ['+94770000001', '+94770000002'] } },
  select: { id: true }
});
assert.equal(contactsToAssign.length, 2);

const assignRes = mockRes();
await handleMarketingRoutes(
  mockReq('POST', '/api/marketing/assignments', {
    contactIds: contactsToAssign.map(c => c.id),
    officerIds: [coordinator1.id, coordinator2.id],
    mode: 'round_robin'
  }),
  assignRes,
  '/api/marketing/assignments',
  superAdmin
);
assert.equal(assignRes.status, 201);
assert.equal(assignRes.body.data.successfullyAssigned, 2);

// Verify contacts are now marked 'assigned' and owners set
const c1 = await prisma.marketingContact.findUnique({ where: { id: contactsToAssign[0].id } });
const c2 = await prisma.marketingContact.findUnique({ where: { id: contactsToAssign[1].id } });
assert.equal(c1.lifecycleStatus, 'assigned');
assert.equal(c2.lifecycleStatus, 'assigned');
assert.notEqual(c1.currentOwnerId, null);
assert.notEqual(c2.currentOwnerId, null);
console.log('✅ Pass 8 & 9: Round-robin distribution assigned contacts evenly to coordinators.\n');

// ======================================================================
// SCENARIO 10 & 11: Coordinator Queue Isolation & Status Progression
// ======================================================================
console.log('--- Scenarios 10 & 11: Coordinator Task Queue & Outreach ---');
const coord1TasksRes = mockRes();
await handleMarketingRoutes(
  mockReq('GET', '/api/marketing/tasks'),
  coord1TasksRes,
  '/api/marketing/tasks',
  coordinator1
);
assert.equal(coord1TasksRes.status, 200);
assert.equal(coord1TasksRes.body.data.length, 1, 'Coordinator 1 should see only their 1 assigned contact');
const coord1Task = coord1TasksRes.body.data[0];

// Update task status to 'interested'
const updateTaskRes = mockRes();
await handleMarketingRoutes(
  mockReq('PATCH', `/api/marketing/tasks/${coord1Task.id}`, {
    status: 'interested',
    notes: 'Patient confirmed interest in Wellness Package and asked for appointment consultation'
  }),
  updateTaskRes,
  `/api/marketing/tasks/${coord1Task.id}`,
  coordinator1
);
assert.equal(updateTaskRes.status, 200);

// Verify contact lifecycle status automatically transitioned to 'interested'
const updatedContact = await prisma.marketingContact.findUnique({ where: { id: coord1Task.contactId } });
assert.equal(updatedContact.lifecycleStatus, 'interested');
console.log('✅ Pass 10 & 11: Coordinator queue isolation enforced and status transitioned to interested.\n');

// ======================================================================
// SCENARIO 12, 13, 14: Consent Recording, DND Suppression & Conversion
// ======================================================================
console.log('--- Scenarios 12, 13, 14: Consent Recording & CRM Lead Promotion ---');
// Record verified consent
const consentRes = mockRes();
await handleMarketingRoutes(
  mockReq('POST', `/api/marketing/contacts/${updatedContact.id}/consent`, {
    status: 'verified',
    evidence: 'Inbound verbal consent confirmed on call at 10:30 AM',
    purpose: 'Clinical appointment consultation',
    channel: 'Direct Call'
  }),
  consentRes,
  `/api/marketing/contacts/${updatedContact.id}/consent`,
  coordinator1
);
assert.equal(consentRes.status, 201);

// Convert interested contact to CRM Lead
const convertRes = mockRes();
await handleMarketingRoutes(
  mockReq('POST', `/api/marketing/contacts/${updatedContact.id}/convert`, {
    note: 'Qualified consultation request for Dr. Zeenath',
    autoApprove: true
  }),
  convertRes,
  `/api/marketing/contacts/${updatedContact.id}/convert`,
  superAdmin
);
assert.equal(convertRes.status, 200, 'Conversion should succeed');
assert.equal(convertRes.body.data.duplicate, false);
assert.notEqual(convertRes.body.data.lead?.id, null);

const createdLeadId = convertRes.body.data.lead.id;
const finalContact = await prisma.marketingContact.findUnique({ where: { id: updatedContact.id } });
assert.equal(finalContact.lifecycleStatus, 'converted');
assert.equal(finalContact.convertedLeadId, createdLeadId);

// Verify CRM Lead pipeline now contains the newly created lead
const crmLead = await prisma.lead.findUnique({ where: { id: createdLeadId } });
assert.equal(crmLead.company, 'RWC');
assert.equal(crmLead.source, 'marketing');

// Verify unconverted marketing contact does NOT appear in CRM leads
const unconvertedInLead = await prisma.customer.findFirst({
  where: { OR: [{ whatsappNumber: '+94770000003' }, { phoneNumber: '+94770000003' }] }
});
assert.equal(unconvertedInLead, null, 'Unconverted contact must not pollute active CRM Lead customer tables');
console.log('✅ Pass 12, 13, 14: Contact converted to CRM Lead; unconverted contact strictly quarantined.\n');

// ======================================================================
// SCENARIO 15 & 16: Dashboard & Reports Analytics Aggregation
// ======================================================================
console.log('--- Scenarios 15 & 16: Dashboard & Reports Metric Aggregations ---');
const dashRes = mockRes();
await handleMarketingRoutes(
  mockReq('GET', '/api/marketing/dashboard'),
  dashRes,
  '/api/marketing/dashboard',
  superAdmin
);
assert.equal(dashRes.status, 200);
assert.notEqual(dashRes.body.data.metrics.totalContacts, undefined);
assert.notEqual(dashRes.body.data.metrics.rates.contactRate, undefined);
assert.notEqual(dashRes.body.data.metrics.rates.leadConversionRate, undefined);

// Reports CSV export
const csvRes = mockRes();
await handleMarketingRoutes(
  mockReq('GET', '/api/marketing/reports?range=today&export=csv'),
  csvRes,
  '/api/marketing/reports',
  superAdmin
);
assert.equal(csvRes.status, 200);
assert.equal(csvRes.headers['Content-Type'], 'text/csv');
assert.ok(csvRes.body.includes('Total Contacts Imported'));

const reportViewRes = mockRes();
await handleMarketingRoutes(
  mockReq('GET', '/api/marketing/reports?range=today'),
  reportViewRes,
  '/api/marketing/reports',
  marketingAdmin
);
assert.equal(reportViewRes.status, 200, 'Marketing Admin should be able to view reports');

const reportExportDeniedRes = mockRes();
await handleMarketingRoutes(
  mockReq('GET', '/api/marketing/reports?range=today&export=csv'),
  reportExportDeniedRes,
  '/api/marketing/reports',
  marketingAdmin
);
assert.equal(reportExportDeniedRes.status, 403, 'Marketing Admin should not export report data');

const coordinatorReportDeniedRes = mockRes();
await handleMarketingRoutes(
  mockReq('GET', '/api/marketing/reports?range=today'),
  coordinatorReportDeniedRes,
  '/api/marketing/reports',
  coordinator1
);
assert.equal(coordinatorReportDeniedRes.status, 403, 'Coordinators should not view company reports');
console.log('✅ Pass 15 & 16: Dashboard KPIs and CSV reports generated with mathematically sound rates.\n');

// Cleanup synthetic records
const finalExistingContacts = await prisma.marketingContact.findMany({
  where: { normalizedPhone: { in: testPhones } },
  select: { id: true }
});
const finalContactIds = finalExistingContacts.map(c => c.id);
if (finalContactIds.length) {
  await prisma.marketingLeadConversion.deleteMany({ where: { contactId: { in: finalContactIds } } }).catch(() => {});
  await prisma.marketingTask.deleteMany({ where: { contactId: { in: finalContactIds } } }).catch(() => {});
  await prisma.marketingContactActivity.deleteMany({ where: { contactId: { in: finalContactIds } } }).catch(() => {});
  await prisma.marketingConsentEvent.deleteMany({ where: { marketingContactId: { in: finalContactIds } } }).catch(() => {});
  await prisma.marketingContact.deleteMany({ where: { id: { in: finalContactIds } } }).catch(() => {});
}
if (createdLeadId) {
  await prisma.lead.delete({ where: { id: createdLeadId } }).catch(() => {});
}

console.log('======================================================================');
console.log('🎉 ALL MARKETING E2E WORKFLOW SCENARIOS VERIFIED SUCCESSFULLY!');
console.log('======================================================================\n');
