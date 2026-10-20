import assert from 'assert';
import { formatWindowTimestamp, formatWindowCountdown, getWindowStatus, getLatestCustomerMessageTime } from './src/whatsappWindow.js';

console.log('🧪 Starting WhatsApp 24-Hour Window Verification Suite...\n');

// 1. Status rule tests
const H = 60 * 60 * 1000;
const M = 60 * 1000;

assert.strictEqual(getWindowStatus(22 * H, true).status, 'active');
assert.strictEqual(getWindowStatus(6.1 * H, true).status, 'active');
assert.strictEqual(getWindowStatus(6 * H, true).status, 'expiring_soon');
assert.strictEqual(getWindowStatus(3 * H, true).status, 'expiring_soon');
assert.strictEqual(getWindowStatus(1 * H, true).status, 'expiring_soon');
assert.strictEqual(getWindowStatus(0.9 * H, true).status, 'urgent');
assert.strictEqual(getWindowStatus(30 * M, true).status, 'urgent');
assert.strictEqual(getWindowStatus(1000, true).status, 'urgent');
assert.strictEqual(getWindowStatus(0, true).status, 'expired');
assert.strictEqual(getWindowStatus(-1000, true).status, 'expired');
assert.strictEqual(getWindowStatus(22 * H, false).status, 'expired');
console.log('✅ Test 1 Passed: Status transitions (Active > 6h, Expiring Soon 1-6h, Urgent < 1h, Expired 0h)');

// 2. Countdown formatting
assert.strictEqual(formatWindowCountdown(22 * H + 15 * M + 42 * 1000), '22h 15m 42s');
assert.strictEqual(formatWindowCountdown(4 * H + 5 * M + 6 * 1000), '04h 05m 06s');
assert.strictEqual(formatWindowCountdown(0), '00h 00m 00s');
assert.strictEqual(formatWindowCountdown(-5000), '00h 00m 00s');
console.log('✅ Test 2 Passed: Countdown string format ("22h 15m 42s" and "00h 00m 00s")');

// 3. Staff replies never reset timer
const customerMsgTime = Date.now() - (2 * H); // 2 hours ago
const messages = [
  { id: 'm1', direction: 'inbound', createdAt: new Date(customerMsgTime).toISOString() },
  { id: 'm2', direction: 'outbound', createdAt: new Date(customerMsgTime + 10 * M).toISOString() }, // staff reply
  { id: 'm3', direction: 'outbound', createdAt: new Date(customerMsgTime + 20 * M).toISOString() }  // another staff reply
];

const lead = { id: 'lead-1', lastCustomerMessageAt: new Date(customerMsgTime).toISOString() };

const calculatedTime = getLatestCustomerMessageTime(lead, messages);
assert.strictEqual(calculatedTime, customerMsgTime);
console.log('✅ Test 3 Passed: Staff outbound replies strictly do not reset timer');

// 4. Inbound customer message updates timer
const newCustomerMsgTime = Date.now() - (5 * M);
messages.push({ id: 'm4', direction: 'inbound', createdAt: new Date(newCustomerMsgTime).toISOString() });
const updatedTime = getLatestCustomerMessageTime(lead, messages);
assert.strictEqual(updatedTime, newCustomerMsgTime);
console.log('✅ Test 4 Passed: Incoming customer message correctly resets timer');

// 5. Date formatting
const sampleDate = new Date('2026-10-13T22:50:18');
const formatted = formatWindowTimestamp(sampleDate);
assert.ok(formatted.includes('13 Oct 2026'), `Date was: ${formatted}`);
console.log('✅ Test 5 Passed: Date formatting matches screenshot');

console.log('\n🎉 ALL WHATSAPP 24-HOUR WINDOW TESTS PASSED SUCCESSFULLY!');
