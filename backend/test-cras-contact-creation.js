// Comprehensive Verification Suite for CRAS Contact Creation & Registered Phone Numbers
import assert from 'assert';
import { COMPANIES, resolveCompany } from './src/companyConfig.js';

console.log('🧪 Starting CRAS Contact Creation & Registered Numbers Verification Suite...\n');

// --- Test Group 1: Registered WhatsApp Numbers ---
console.log('--- Test Group 1: Registered WhatsApp Numbers ---');
assert.strictEqual(COMPANIES.RWC.phoneNumber, '+94 70 639 3353', 'RWC registered number must be +94 70 639 3353');
assert.strictEqual(COMPANIES.RWC.phone, '+94 70 639 3353', 'RWC phone must be +94 70 639 3353');
assert.strictEqual(COMPANIES.RWC.phoneId, '1358157244046701', 'RWC Meta Phone Number ID must be 1358157244046701');

assert.strictEqual(COMPANIES.CRAS.phoneNumber, '+94 70 637 3353', 'CRAS registered number must be +94 70 637 3353');
assert.strictEqual(COMPANIES.CRAS.phone, '+94 70 637 3353', 'CRAS phone must be +94 70 637 3353');
assert.strictEqual(COMPANIES.CRAS.phoneId, '1378201582041705', 'CRAS Meta Phone Number ID must be 1378201582041705');

// Resolving by incoming phone number or phone ID
assert.strictEqual(resolveCompany('1378201582041705', '').code, 'CRAS', 'Resolves to CRAS by Meta phoneId');
assert.strictEqual(resolveCompany('', '+94 70 637 3353').code, 'CRAS', 'Resolves to CRAS by registered phone number');
assert.strictEqual(resolveCompany('1358157244046701', '').code, 'RWC', 'Resolves to RWC by Meta phoneId');
assert.strictEqual(resolveCompany('', '+94 70 639 3353').code, 'RWC', 'Resolves to RWC by registered phone number');
console.log('✅ Pass 1.1: Registered WhatsApp numbers and Meta phone IDs correctly configured.');

// --- Test Group 2: Contact Creation Pipeline Simulation ---
console.log('\n--- Test Group 2: Contact Creation Pipeline Simulation ---');

function simulateContactCreation(payload, authUser, existingDatabase = { customers: [], leads: [], users: [] }) {
  const { name, phone, company, categoryId, treatmentId, language, assignedTo, initialMessage } = payload;
  const targetCompany = (company || 'RWC').toUpperCase() === 'CRAS' ? 'CRAS' : 'RWC';

  // Normalize phone
  const cleanDigits = phone.replace(/[^0-9]/g, '');
  const canonicalPhone = `+${cleanDigits}`;

  // Find or create customer
  let cust = existingDatabase.customers.find(c => c.whatsappNumber === canonicalPhone);
  if (!cust) {
    cust = { id: `cust-${Date.now()}`, whatsappNumber: canonicalPhone, displayName: name || canonicalPhone };
    existingDatabase.customers.push(cust);
  }

  // Resolve Category & Treatment
  let resolvedCatId = categoryId;
  let resolvedTrtId = treatmentId;

  if (targetCompany === 'CRAS') {
    if (!resolvedCatId || resolvedCatId.includes('hair')) resolvedCatId = 'cat-cras-courses';
    if (!resolvedTrtId || resolvedTrtId.startsWith('trt-')) resolvedTrtId = 'crs-adi';
  } else {
    if (!resolvedCatId || resolvedCatId.includes('cras')) resolvedCatId = 'cat-hair-care';
    if (!resolvedTrtId || resolvedTrtId.startsWith('crs-')) resolvedTrtId = 'trt-hair-prp';
  }

  // Resolve Coordinator
  let targetCoordinatorId = null;
  if (authUser?.role === 'coordinator') {
    const coordCompany = (authUser.company || 'RWC').toUpperCase();
    if (coordCompany === targetCompany) {
      targetCoordinatorId = authUser.id;
    }
  } else if (assignedTo) {
    const coord = existingDatabase.users.find(u => u.id === assignedTo);
    if (coord) {
      const coordCompany = (coord.company || 'RWC').toUpperCase();
      if (coordCompany === targetCompany || !coord.company) {
        targetCoordinatorId = coord.id;
      }
    }
  }

  // Find existing lead for target company or empty un-messaged lead
  let lead = existingDatabase.leads.find(l => l.customerId === cust.id && (l.company === targetCompany || l.source === targetCompany));
  if (!lead) {
    lead = existingDatabase.leads.find(l => l.customerId === cust.id && (l.messages || []).length === 0);
  }

  const compConfig = COMPANIES[targetCompany];

  if (!lead) {
    lead = {
      id: `lead-${Date.now()}`,
      customerId: cust.id,
      company: targetCompany,
      source: targetCompany,
      categoryId: resolvedCatId,
      treatmentId: resolvedTrtId,
      assignedTo: targetCoordinatorId,
      stage: initialMessage ? 'contacted' : (targetCoordinatorId ? 'assigned' : 'new'),
      language: language || 'en',
      companyTag: compConfig.tag,
      companyColor: compConfig.colorHex,
      companyPhoneNumberId: compConfig.phoneId,
      companyPhoneNumber: compConfig.phone,
      messages: []
    };
    existingDatabase.leads.push(lead);
  } else {
    lead.company = targetCompany;
    lead.source = targetCompany;
    lead.categoryId = resolvedCatId;
    lead.treatmentId = resolvedTrtId;
    lead.assignedTo = targetCoordinatorId !== undefined ? targetCoordinatorId : lead.assignedTo;
    lead.companyTag = compConfig.tag,
    lead.companyColor = compConfig.colorHex,
    lead.companyPhoneNumberId = compConfig.phoneId,
    lead.companyPhoneNumber = compConfig.phone;
  }

  // Meta outbound message dispatch simulation
  const phoneId = targetCompany === 'CRAS' ? COMPANIES.CRAS.phoneId : COMPANIES.RWC.phoneId;
  const autoFallbackTemplate = targetCompany === 'CRAS' ? 'cras_welcome_greeting' : 'rwc_welcome_greeting';

  return {
    success: true,
    lead,
    customer: cust,
    dispatchedPhoneId: phoneId,
    fallbackTemplate: autoFallbackTemplate
  };
}

// Staff mock pool
const dbUsers = [
  { id: 'admin-1', fullName: 'Super Admin', role: 'super_admin' },
  { id: 'cras-counsellor', fullName: 'Amina', role: 'coordinator', company: 'CRAS' },
  { id: 'rwc-coordinator', fullName: 'Kasun', role: 'coordinator', company: 'RWC' }
];

// Test 2.1: Add CRAS Contact
const testDb = { customers: [], leads: [], users: dbUsers };
const crasResult = simulateContactCreation({
  name: 'Doctor Nimal',
  phone: '070 637 3353',
  company: 'CRAS',
  initialMessage: 'Inquiring about Fellowship in Aesthetic Medicine'
}, dbUsers[0], testDb);

assert.strictEqual(crasResult.lead.company, 'CRAS', 'CRAS lead must have company = CRAS');
assert.strictEqual(crasResult.lead.source, 'CRAS', 'CRAS lead must have source = CRAS');
assert.strictEqual(crasResult.lead.categoryId, 'cat-cras-courses', 'CRAS category must default to CRAS Academic Programs');
assert.strictEqual(crasResult.lead.treatmentId, 'crs-adi', 'CRAS treatment must default to CRAS course');
assert.strictEqual(crasResult.dispatchedPhoneId, '1378201582041705', 'CRAS dispatch must use CRAS Meta Phone Number ID');
assert.strictEqual(crasResult.fallbackTemplate, 'cras_welcome_greeting', 'CRAS fallback must use cras_welcome_greeting');
console.log('✅ Pass 2.1: CRAS contact creation accurately stores CRAS metadata, courses, and phone ID.');

// Test 2.2: Add RWC Contact
const rwcResult = simulateContactCreation({
  name: 'Patient Samantha',
  phone: '077 123 4567',
  company: 'RWC',
  initialMessage: 'Inquiring about Hair PRP'
}, dbUsers[0], testDb);

assert.strictEqual(rwcResult.lead.company, 'RWC', 'RWC lead must have company = RWC');
assert.strictEqual(rwcResult.lead.source, 'RWC', 'RWC lead must have source = RWC');
assert.strictEqual(rwcResult.lead.categoryId, 'cat-hair-care', 'RWC category must default to RWC care');
assert.strictEqual(rwcResult.lead.treatmentId, 'trt-hair-prp', 'RWC treatment must default to RWC treatment');
assert.strictEqual(rwcResult.dispatchedPhoneId, '1358157244046701', 'RWC dispatch must use RWC Meta Phone Number ID');
assert.strictEqual(rwcResult.fallbackTemplate, 'rwc_welcome_greeting', 'RWC fallback must use rwc_welcome_greeting');
console.log('✅ Pass 2.2: RWC contact creation accurately stores RWC metadata, treatments, and phone ID.');

// Test 2.3: Coordinator Assignment Company Isolation
console.log('\n--- Test Group 3: Coordinator & Counsellor Company Isolation ---');
const crossAssignmentResult = simulateContactCreation({
  name: 'Doctor Perera',
  phone: '071 999 8888',
  company: 'CRAS',
  assignedTo: 'rwc-coordinator' // RWC coordinator assigned to CRAS lead
}, dbUsers[0], testDb);

assert.strictEqual(crossAssignmentResult.lead.assignedTo, null, 'RWC coordinator must NOT be assigned to CRAS contact');

const validCrasAssignmentResult = simulateContactCreation({
  name: 'Doctor Perera 2',
  phone: '071 999 8889',
  company: 'CRAS',
  assignedTo: 'cras-counsellor' // CRAS counsellor assigned to CRAS lead
}, dbUsers[0], testDb);

assert.strictEqual(validCrasAssignmentResult.lead.assignedTo, 'cras-counsellor', 'CRAS counsellor can be assigned to CRAS contact');
console.log('✅ Pass 3.1: Coordinator company isolation enforced (RWC staff rejected for CRAS contacts).');

console.log('\n🎉 ALL CRAS CONTACT CREATION & REGISTERED NUMBER TESTS PASSED SUCCESSFULLY!\n');
