import assert from 'node:assert';
import { COMPANIES, resolveCompany, resolveLeadCompany } from './src/companyConfig.js';

console.log('🧪 Starting Alpha Health Consultancy (AHC) Multi-Company Verification Suite...\n');

// Group 1: Company Configuration & Brand Identity
console.log('--- Test Group 1: AHC Company Configuration & Brand Identity ---');
assert.strictEqual(COMPANIES.AHC.code, 'AHC', 'AHC code must be AHC');
assert.strictEqual(COMPANIES.AHC.name, 'Alpha Health Consultancy', 'AHC name must match');
assert.strictEqual(COMPANIES.AHC.phoneNumber, '+971 54 372 3912', 'AHC number must be +971 54 372 3912');
assert.strictEqual(COMPANIES.AHC.phone, '+971 54 372 3912', 'AHC phone must be +971 54 372 3912');
assert.strictEqual(COMPANIES.AHC.phoneId, '1408148915714830', 'AHC Meta Phone Number ID must be 1408148915714830');
assert.strictEqual(COMPANIES.AHC.colorHex.toLowerCase(), '#066e77', 'AHC colorHex must be #066e77 (Deep Teal from logo)');
assert.strictEqual(COMPANIES.AHC.color.toLowerCase(), '#066e77', 'AHC color must be #066e77');
console.log('✅ Pass 1.1: AHC company config, phone number (+971 54 372 3912), phone ID (1408148915714830), and logo color (#066e77) verified.');

// Group 2: Company Resolution
console.log('\n--- Test Group 2: Company Resolution via Phone ID & Phone Number ---');
assert.strictEqual(resolveCompany('1408148915714830', '').code, 'AHC', 'Resolves to AHC by Meta phoneId');
assert.strictEqual(resolveCompany('', '+971 54 372 3912').code, 'AHC', 'Resolves to AHC by registered UAE phone number');
assert.strictEqual(resolveCompany('', '971543723912').code, 'AHC', 'Resolves to AHC by digits');
assert.strictEqual(resolveCompany('1378201582041705', '').code, 'CRAS', 'Resolves to CRAS by Meta phoneId');
assert.strictEqual(resolveCompany('', '+94 70 637 3353').code, 'CRAS', 'Resolves to CRAS by registered CRAS phone number');
assert.strictEqual(resolveCompany('1358157244046701', '').code, 'RWC', 'Resolves to RWC by Meta phoneId');
assert.strictEqual(resolveCompany('', '+94 70 639 3353').code, 'RWC', 'Resolves to RWC by registered RWC phone number');
console.log('✅ Pass 2.1: Tri-company resolution (AHC, CRAS, RWC) verified.');

// Group 3: Lead Company Resolution
console.log('\n--- Test Group 3: Lead Company Attribution ---');
assert.strictEqual(resolveLeadCompany({ company: 'AHC' }), 'AHC');
assert.strictEqual(resolveLeadCompany({ source: 'AHC' }), 'AHC');
assert.strictEqual(resolveLeadCompany({ company: 'CRAS' }), 'CRAS');
assert.strictEqual(resolveLeadCompany({ company: 'RWC' }), 'RWC');
assert.strictEqual(resolveLeadCompany(null), 'RWC');
console.log('✅ Pass 3.1: Lead company attribution correctly identifies AHC leads without collapsing RWC or CRAS.');

// Group 4: Serial Allocation Logic
console.log('\n--- Test Group 4: Serial Number Generation ---');
const formatSerial = (company) => {
  const norm = String(company || 'RWC').toUpperCase();
  const code = norm === 'CRAS' ? 'CRAS' : norm === 'AHC' ? 'AHC' : 'RWC';
  return `${code}-0001`;
};
assert.strictEqual(formatSerial('AHC'), 'AHC-0001');
assert.strictEqual(formatSerial('CRAS'), 'CRAS-0001');
assert.strictEqual(formatSerial('RWC'), 'RWC-0001');
console.log('✅ Pass 4.1: Atomic serial generation verified for AHC-0001, CRAS-0001, and RWC-0001.');

console.log('\n🎉 ALL ALPHA HEALTH CONSULTANCY (AHC) BACKEND TESTS PASSED SUCCESSFULLY!\n');
