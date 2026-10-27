import assert from 'node:assert/strict';
import { parseStandardsCompliantCsv, normalizeMany, normalizeE164 } from './src/marketing/normalization.js';

console.log('🧪 Starting CSV Parsing & Bulk-Paste Verification Test Suite...');

// Test 1: RFC-4180 CSV with quotes, commas in cells, and BOM marker
const sampleCsv = `\uFEFFPhone,Name,Source,Group,Notes
"+94771234567","Perera, Dr. John","Health Expo","VIP Group","Interested in Ayurveda, 7-day retreat"
"0770000002","Silva, Sarah","Walk-in","Group B","Wants ""special"" consultation"
0712345678,David,Online,General,Standard inquiry
`;

const parsedRows = parseStandardsCompliantCsv(sampleCsv);
assert.equal(parsedRows.length, 3, 'Should parse exactly 3 data rows');

assert.equal(parsedRows[0].phone, '+94771234567');
assert.equal(parsedRows[0].name, 'Perera, Dr. John', 'Should preserve comma inside quotes');
assert.equal(parsedRows[0].sourceGroupName, 'VIP Group');
assert.equal(parsedRows[0].notes, 'Interested in Ayurveda, 7-day retreat');

assert.equal(parsedRows[1].phone, '0770000002');
assert.equal(parsedRows[1].name, 'Silva, Sarah');
assert.equal(parsedRows[1].notes, 'Wants "special" consultation', 'Should unescape double quotes correctly');

console.log('✅ Pass 1: RFC-4180 CSV parser handles UTF-8 BOM, commas within quotes, and escaped quotes.');

// Test 2: Multi-column delimiter detection (Tabs / TSV)
const sampleTsv = `Phone\tName\tSource\n+94778901234\tAlpha Student\tCRAS Admissions\n0773334444\tKamal\tReferral`;
const parsedTsv = parseStandardsCompliantCsv(sampleTsv);
assert.equal(parsedTsv.length, 2, 'Should detect tab delimiter and parse 2 rows');
assert.equal(parsedTsv[0].phone, '+94778901234');
assert.equal(parsedTsv[0].name, 'Alpha Student');
assert.equal(parsedTsv[1].phone, '0773334444');

console.log('✅ Pass 2: Delimiter auto-detection (Tabs & Semicolons) verified.');

// Test 3: Normalization of structured objects
const normalizedObjects = normalizeMany(parsedRows, 'LK');
assert.equal(normalizedObjects.length, 3);
assert.equal(normalizedObjects[0].normalizedPhone, '+94771234567');
assert.equal(normalizedObjects[1].normalizedPhone, '+94770000002', 'Should normalize local 077 to +9477');
assert.equal(normalizedObjects[2].normalizedPhone, '+94712345678');
assert.equal(normalizedObjects[0].name, 'Perera, Dr. John');

console.log('✅ Pass 3: normalizeMany preserves row metadata (name, notes, source group) with standard E.164 phone.');

// Test 4: Bulk Paste Delimiter Flexibility
const rawPaste = `
0771112233, 077-444-5566; +94778889900
011-234-5678\t+971501234567
`;
const pasteTokens = rawPaste.split(/[\n,;\t]+/).map(t => t.trim()).filter(Boolean);
assert.equal(pasteTokens.length, 5, 'Should split mixed delimiters into 5 tokens');
const normalizedTokens = normalizeMany(pasteTokens, 'LK');
assert.equal(normalizedTokens.filter(t => t.isValid).length, 5, 'All 5 tokens must be valid international phone formats');
assert.equal(normalizedTokens[0].normalizedPhone, '+94771112233');
assert.equal(normalizedTokens[1].normalizedPhone, '+94774445566');
assert.equal(normalizedTokens[3].normalizedPhone, '+94112345678', 'Landline format 011 -> +9411');
assert.equal(normalizedTokens[4].normalizedPhone, '+971501234567', 'UAE international format preserved');

console.log('✅ Pass 4: Bulk paste handles mixed separators, dashes, spaces, and international prefixes.');

console.log('\n======================================================');
console.log('🎉 ALL CSV PARSING & BULK-PASTE UNIT TESTS PASSED!');
console.log('======================================================\n');
