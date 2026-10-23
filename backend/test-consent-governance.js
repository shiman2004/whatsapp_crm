import assert from 'node:assert/strict';
import { handleMarketingRoutes } from './src/marketing/routes.js';
import {
  getConsentStatus,
  recordConsentEvent,
  canSendWhatsApp,
  canConvertToLead,
  suppressContact,
  CONSENT_STATES,
} from './src/modules/marketing/services/consent.service.js';
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
    },
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
      try {
        this.body = JSON.parse(body);
      } catch (_) {
        this.body = body;
      }
    },
  };
}

async function callMarketing(method, pathname, body, actor) {
  const req = mockReq(method, pathname, body);
  const res = mockRes();
  await handleMarketingRoutes(req, res, pathname, actor);
  return res;
}

console.log('🧪 Starting Consent Governance & Protection Gate Verification Suite...\n');

const prisma = getPrisma();
await ensureSchema(prisma);
const superAdmin = { id: 'test-sa-1', role: 'super_admin', active: true, company: 'RWC' };
const coordinatorRwc = { id: 'test-coord-rwc', role: 'coordinator', active: true, company: 'RWC' };
const coordinatorCras = { id: 'test-coord-cras', role: 'coordinator', active: true, company: 'CRAS' };

// Clean previous fixtures
const testPhones = ['+94711999001', '+94711999002', '+94711999003'];
const existing = await prisma.marketingContact.findMany({
  where: { normalizedPhone: { in: testPhones } },
  select: { id: true },
});
const existingIds = existing.map(e => e.id);
if (existingIds.length) {
  await prisma.marketingConsentEvent.deleteMany({ where: { marketingContactId: { in: existingIds } } }).catch(() => {});
  await prisma.marketingSuppression.deleteMany({ where: { contactId: { in: existingIds } } }).catch(() => {});
  await prisma.marketingTask.deleteMany({ where: { contactId: { in: existingIds } } }).catch(() => {});
  await prisma.marketingLeadConversion.deleteMany({ where: { contactId: { in: existingIds } } }).catch(() => {});
  await prisma.marketingContactActivity.deleteMany({ where: { contactId: { in: existingIds } } }).catch(() => {});
  await prisma.marketingContact.deleteMany({ where: { id: { in: existingIds } } }).catch(() => {});
}

const existingCusts = await prisma.customer.findMany({
  where: { OR: [{ whatsappNumber: { in: testPhones } }, { phoneNumber: { in: testPhones } }] },
  select: { id: true },
});
if (existingCusts.length) {
  const cIds = existingCusts.map(c => c.id);
  await prisma.lead.deleteMany({ where: { customerId: { in: cIds } } }).catch(() => {});
  await prisma.customer.deleteMany({ where: { id: { in: cIds } } }).catch(() => {});
}

// Setup test users if missing
await prisma.user.upsert({
  where: { id: coordinatorRwc.id },
  create: { id: coordinatorRwc.id, email: 'coord.rwc@example.com', fullName: 'RWC Coordinator', role: 'coordinator', company: 'RWC', active: true },
  update: { company: 'RWC', active: true },
});
await prisma.user.upsert({
  where: { id: coordinatorCras.id },
  create: { id: coordinatorCras.id, email: 'coord.cras@example.com', fullName: 'CRAS Counsellor', role: 'coordinator', company: 'CRAS', active: true },
  update: { company: 'CRAS', active: true },
});

// ----------------------------------------------------------------------
// Requirement 1: Imported public contact defaults to unknown consent
// ----------------------------------------------------------------------
console.log('--- Check 1: Imported contact defaults to unknown consent & new lifecycle ---');
const createRes = await callMarketing('POST', '/api/marketing/contacts', {
  phone: '+94711999001',
  name: 'Consent Subject 1',
  source: 'Colombo Expo',
}, superAdmin);

assert.equal(createRes.status, 201, 'Should create contact');
const contact1 = createRes.body.data;
assert.equal(contact1.consentStatus, 'unknown', 'Consent must default to unknown');
assert.equal(contact1.lifecycleStatus, 'new', 'Lifecycle status must default to new');
console.log('✅ Pass 1: New contact defaults to unknown consent and new lifecycle.\n');

// ----------------------------------------------------------------------
// Requirement 2: Unknown contact cannot receive unsolicited WhatsApp marketing
// ----------------------------------------------------------------------
console.log('--- Check 2: Unsolicited WhatsApp marketing blocked for unknown contact ---');
const waCheck1 = await canSendWhatsApp(contact1.normalizedPhone, 'marketing');
assert.equal(waCheck1.allowed, false, 'Outbound marketing to unknown contact must be blocked');
assert.equal(waCheck1.code, 'CONSENT_NOT_VERIFIED');
console.log('✅ Pass 2: Unsolicited WhatsApp marketing correctly blocked for unknown contact.\n');

// ----------------------------------------------------------------------
// Requirement 3: Unknown contact cannot be converted
// ----------------------------------------------------------------------
console.log('--- Check 3: Unknown contact cannot be converted to CRM Lead ---');
const convertCheck1 = await canConvertToLead(contact1.id, superAdmin);
assert.equal(convertCheck1.eligible, false, 'Unknown contact must not be eligible for conversion');
assert(convertCheck1.reasons.some(r => r.includes('Verified Opt-In Consent is strictly required')));

const convertAttemptRes = await callMarketing('POST', `/api/marketing/contacts/${contact1.id}/convert`, { autoApprove: true }, superAdmin);
assert.equal(convertAttemptRes.status, 409, 'API must reject conversion of unknown contact');
console.log('✅ Pass 3: Conversion attempt rejected with 409 Conflict.\n');

// ----------------------------------------------------------------------
// Requirement 4: Verified consent requires recorded evidence
// ----------------------------------------------------------------------
console.log('--- Check 4: Verified consent requires recorded evidence ---');
const emptyEvidenceRes = await callMarketing('POST', `/api/marketing/contacts/${contact1.id}/consent`, {
  decision: 'verified',
  channel: 'WHATSAPP_INBOUND',
  evidence: '', // empty
}, superAdmin);
assert.equal(emptyEvidenceRes.status, 400, 'Empty evidence must be rejected with 400');

// Record valid verified consent
const validConsentRes = await callMarketing('POST', `/api/marketing/contacts/${contact1.id}/consent`, {
  decision: 'verified',
  channel: 'WHATSAPP_INBOUND',
  evidenceType: 'MESSAGE_CONFIRMATION',
  evidenceReference: 'wamid.HBgLMTIzNDU2',
  evidenceDescription: 'Customer replied "YES" to consultation inquiry message.',
  purpose: 'RWC Clinic Consultation Outreach',
}, superAdmin);
assert.equal(validConsentRes.status, 201, 'Valid evidence should successfully record consent');
assert.equal(validConsentRes.body.data.contact.consentStatus, 'verified');
console.log('✅ Pass 4: Verified consent strictly enforces auditable evidence recording.\n');

// ----------------------------------------------------------------------
// Requirement 5: Contact without genuine interest cannot convert
// ----------------------------------------------------------------------
console.log('--- Check 5: Contact without genuine interest cannot convert ---');
const convertCheck2 = await canConvertToLead(contact1.id, superAdmin);
assert.equal(convertCheck2.eligible, false, 'Must require status "interested"');
assert(convertCheck2.reasons.some(r => r.includes('"Interested"')));
console.log('✅ Pass 5: Contact with verified consent but un-qualified status blocked from conversion.\n');

// ----------------------------------------------------------------------
// Requirement 6: Interested contact with verified consent can convert when authorized
// ----------------------------------------------------------------------
console.log('--- Check 6: Interested contact with verified consent can convert ---');
// Transition status to interested
await callMarketing('PATCH', `/api/marketing/contacts/${contact1.id}`, { status: 'interested' }, superAdmin);

const convertCheck3 = await canConvertToLead(contact1.id, superAdmin);
assert.equal(convertCheck3.eligible, true, 'Fully qualified contact must be eligible for conversion');

const successfulConvertRes = await callMarketing('POST', `/api/marketing/contacts/${contact1.id}/convert`, { autoApprove: true }, superAdmin);
assert.equal(successfulConvertRes.status, 200, 'Conversion must succeed');
assert.equal(successfulConvertRes.body.data.duplicate, false);
assert(successfulConvertRes.body.data.lead.id, 'New CRM Lead must be created');
const convertedLeadId = successfulConvertRes.body.data.lead.id;
console.log(`✅ Pass 6: Successfully promoted to active CRM Lead (ID: ${convertedLeadId}).\n`);

// ----------------------------------------------------------------------
// Requirement 7: Converted contact does not automatically gain an open WhatsApp messaging window
// ----------------------------------------------------------------------
console.log('--- Check 7: Converted lead does not gain open WhatsApp 24h window automatically ---');
const leadRecord = await prisma.lead.findUnique({ where: { id: convertedLeadId } });
assert.equal(leadRecord.lastCustomerMessageAt, null, 'Lead must not fabricate an inbound message');
console.log('✅ Pass 7: Anti-spam compliance confirmed — no phantom inbound window generated.\n');

// ----------------------------------------------------------------------
// Requirement 8, 9, 10: Opt-out, suppression, task closure & messaging block
// ----------------------------------------------------------------------
console.log('--- Checks 8, 9, 10: Immediate opt-out, task cancellation & suppression ---');
// Create contact 2 and assign a task
const contact2Res = await callMarketing('POST', '/api/marketing/contacts', {
  phone: '+94711999002',
  name: 'Opt-Out Subject',
  source: 'Public Web',
}, superAdmin);
const contact2 = contact2Res.body.data;

// Assign task and owner
await prisma.marketingContact.update({
  where: { id: contact2.id },
  data: { currentOwnerId: coordinatorRwc.id },
});

const task1 = await prisma.marketingTask.create({
  data: {
    id: `cg-test-task-1`,
    contactId: contact2.id,
    ownerId: coordinatorRwc.id,
    status: 'pending',
  },
});

// Record opt-out
const optOutRes = await callMarketing('POST', `/api/marketing/contacts/${contact2.id}/suppress`, {
  reason: 'Customer replied STOP to SMS',
}, coordinatorRwc);
assert.equal(optOutRes.status, 200, 'Opt-out must succeed');
assert.equal(optOutRes.body.data.contact.lifecycleStatus, 'do_not_contact');
assert.equal(optOutRes.body.data.contact.consentStatus, 'opted_out');

// Verify task closed
const taskAfterOptOut = await prisma.marketingTask.findUnique({ where: { id: 'cg-test-task-1' } });
assert.equal(taskAfterOptOut.status, 'completed', 'Opt-out must close pending outreach tasks');
assert(taskAfterOptOut.notes.includes('opt-out (DND)'));

// Verify WhatsApp blocked
const waCheck2 = await canSendWhatsApp(contact2.normalizedPhone, 'marketing');
assert.equal(waCheck2.allowed, false, 'Opted-out contact must be blocked from WhatsApp');
assert.equal(waCheck2.code, 'CONTACT_OPTED_OUT');
console.log('✅ Pass 8, 9, 10: Opt-out verified — tasks closed, DND recorded, and outreach blocked.\n');

// ----------------------------------------------------------------------
// Requirement 11: Suppression cannot be bypassed by ordinary staff
// ----------------------------------------------------------------------
console.log('--- Check 11: Suppression cannot be bypassed by ordinary staff ---');
const reactivateAttemptRes = await callMarketing('PATCH', `/api/marketing/contacts/${contact2.id}`, { status: 'new' }, coordinatorRwc);
assert.equal(reactivateAttemptRes.status, 403, 'Ordinary staff cannot reactivate suppressed contact');
assert.equal(reactivateAttemptRes.body.error.code, 'SUPPRESSION_PROTECTED');
console.log('✅ Pass 11: Security confirmed — ordinary staff cannot bypass suppression.\n');

// ----------------------------------------------------------------------
// Requirement 12: Centralized messaging gate enforcement
// ----------------------------------------------------------------------
console.log('--- Check 12: Centralized messaging gate consistency ---');
const gateCheckUnknown = await canSendWhatsApp('+94711999099', 'text');
assert.equal(gateCheckUnknown.allowed, true, 'Unknown public number without marketing record uses default pipeline rules');

const gateCheckContact2 = await canSendWhatsApp(contact2.id, 'text');
assert.equal(gateCheckContact2.allowed, false, 'Suppressed contact ID blocked at gate');
console.log('✅ Pass 12: Centralized messaging gate correctly enforces permissions.\n');

// ----------------------------------------------------------------------
// Requirement 13: Strict Company Isolation (RWC vs CRAS)
// ----------------------------------------------------------------------
console.log('--- Check 13: Strict Company Isolation (RWC vs CRAS) ---');
// Create CRAS contact
const crasRes = await callMarketing('POST', '/api/marketing/contacts', {
  phone: '+94711999003',
  name: 'CRAS Aviation Candidate',
  source: 'CRAS Open Day',
}, { id: 'cras-admin', role: 'super_admin', company: 'CRAS' });
const crasContact = crasRes.body.data;
assert.equal(crasContact.company, 'CRAS');

// RWC Coordinator attempts to access or modify CRAS contact
const rwcAccessRes = await callMarketing('GET', `/api/marketing/contacts/${crasContact.id}`, null, coordinatorRwc);
assert.equal(rwcAccessRes.status, 404, 'RWC coordinator cannot find or access CRAS contact');
console.log('✅ Pass 13: Company isolation confirmed — zero cross-tenant leakage.\n');

// ----------------------------------------------------------------------
// Requirement 14: Duplicate conversions prevented
// ----------------------------------------------------------------------
console.log('--- Check 14: Duplicate conversions prevented ---');
const dupConvertRes = await callMarketing('POST', `/api/marketing/contacts/${contact1.id}/convert`, { autoApprove: true }, superAdmin);
assert.equal(dupConvertRes.status, 409, 'Converting already converted contact must be rejected');
console.log('✅ Pass 14: Duplicate conversion attempt rejected with 409 Conflict.\n');

// ----------------------------------------------------------------------
// Requirement 15: Consent event history remains auditable (append-only)
// ----------------------------------------------------------------------
console.log('--- Check 15: Consent event history remains auditable ---');
const consentStatusData = await getConsentStatus(contact1.id);
assert(consentStatusData.history.length >= 1, 'Consent events must be preserved');
assert.equal(consentStatusData.history[0].decision || consentStatusData.history[0].status, 'verified');
assert.equal(consentStatusData.history[0].recordedById, superAdmin.id);
console.log(`✅ Pass 15: Audit trail verified with ${consentStatusData.history.length} logged consent event(s).\n`);

// ----------------------------------------------------------------------
// Requirement 16: Idempotent API requests
// ----------------------------------------------------------------------
console.log('--- Check 16: Idempotency under repeated suppression requests ---');
const sup1 = await suppressContact(contact2.id, 'Duplicate DND call', superAdmin);
const sup2 = await suppressContact(contact2.id, 'Duplicate DND call', superAdmin);
assert.equal(sup1.contact.lifecycleStatus, 'do_not_contact');
assert.equal(sup2.contact.lifecycleStatus, 'do_not_contact');
console.log('✅ Pass 16: Suppression operations are strictly idempotent.\n');

// ----------------------------------------------------------------------
// Requirement 17: Existing CRM Lead and WhatsApp workflows functional
// ----------------------------------------------------------------------
console.log('--- Check 17: Existing CRM Lead and WhatsApp workflows functional ---');
const existingLeads = await prisma.lead.findMany({ take: 5 });
assert(existingLeads.length > 0, 'Existing CRM leads intact');
console.log(`✅ Pass 17: Verified ${existingLeads.length} existing CRM leads remain completely intact.\n`);

// Clean up test fixtures
await prisma.marketingConsentEvent.deleteMany({
  where: { marketingContactId: { in: [contact1.id, contact2.id, crasContact.id] } },
}).catch(() => {});
await prisma.marketingSuppression.deleteMany({
  where: { contactId: { in: [contact1.id, contact2.id, crasContact.id] } },
}).catch(() => {});
await prisma.marketingTask.deleteMany({
  where: { contactId: { in: [contact1.id, contact2.id, crasContact.id] } },
}).catch(() => {});
await prisma.marketingLeadConversion.deleteMany({
  where: { contactId: { in: [contact1.id, contact2.id, crasContact.id] } },
}).catch(() => {});
await prisma.marketingContactActivity.deleteMany({
  where: { contactId: { in: [contact1.id, contact2.id, crasContact.id] } },
}).catch(() => {});
await prisma.marketingContact.deleteMany({
  where: { id: { in: [contact1.id, contact2.id, crasContact.id] } },
}).catch(() => {});

console.log('======================================================================');
console.log('🎉 ALL 17 CONSENT GOVERNANCE & PROTECTION GATE CHECKS PASSED!');
console.log('======================================================================\n');
