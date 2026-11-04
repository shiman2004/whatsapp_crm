import assert from 'node:assert/strict';
import { hashSecret, verifySecret, decryptReversible, encryptReversible } from './src/secretHash.js';

console.log('Running user credential hashing tests...');

// 1. Password hashing produces scrypt: format
const plainPassword = 'CorrectHorseBatteryStaple123!';
const plainPin = '8492';

const hashedPassword = hashSecret(plainPassword);
const hashedPin = hashSecret(plainPin);

assert.match(hashedPassword, /^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/, 'Password must be hashed with scrypt format');
assert.match(hashedPin, /^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/, 'PIN must be hashed with scrypt format');

// 2. Verification succeeds with correct secret
assert.equal(verifySecret(plainPassword, hashedPassword).match, true, 'Valid password must verify');
assert.equal(verifySecret(plainPin, hashedPin).match, true, 'Valid PIN must verify');

// 3. Verification fails with incorrect secret
assert.equal(verifySecret('WrongPassword123!', hashedPassword).match, false, 'Invalid password must not verify');
assert.equal(verifySecret('0000', hashedPin).match, false, 'Invalid PIN must not verify');

// 4. Verification fails with empty secret
assert.equal(verifySecret('', hashedPassword).match, false);
assert.equal(verifySecret(plainPassword, '').match, false);

// 5. One-way property: It cannot be reversibly decrypted
assert.notEqual(decryptReversible(hashedPassword), plainPassword, 'Scrypt hashed password must not be reversibly decrypted');
assert.notEqual(decryptReversible(hashedPin), plainPin, 'Scrypt hashed PIN must not be reversibly decrypted');

// 6. Backward compatibility: Reversible legacy credentials still verify
const legacyEncrypted = encryptReversible(plainPassword);
assert.equal(verifySecret(plainPassword, legacyEncrypted).match, true, 'Legacy reversible encryption must remain verifiable');

console.log('✅ All user credential hashing tests passed successfully!');

