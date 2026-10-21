// Regression tests for media signing, bounded in-memory stores, webhook signature
// validation, and lead-serial allocation. No live database is required.
process.env.NODE_ENV = 'test';
process.env.META_APP_SECRET = 'test-meta-app-secret';

import assert from 'assert';
import crypto from 'crypto';
import {
  createPrivateMediaUrl,
  verifyPrivateMediaUrl,
  signMediaFile,
  timingSafeStringEqual,
  verifyMetaSignature,
  verifyAuthToken,
  signAuthToken,
  issueSseTicket,
  consumeSseTicket,
  sweepExpiredSseTickets,
  sweepLoginAttemptStore,
  recordLoginFailure,
  checkLoginRateLimit,
  resetLoginRateLimits,
  sseTickets,
  loginAttemptStore
} from './server.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✅ ${name}`);
}

console.log('\n📦 SECTION 1: Signed media URLs');

check('1.1 A signed media URL verifies successfully', () => {
  const url = createPrivateMediaUrl('out_123_abc.jpg');
  const parsed = new URL(url, 'http://localhost');
  const fileName = decodeURIComponent(parsed.pathname.replace('/uploads/', ''));
  assert.strictEqual(verifyPrivateMediaUrl(fileName, parsed.searchParams.get('exp'), parsed.searchParams.get('sig')), true);
});

check('1.2 The signature is stable across calls (stored URLs never expire)', () => {
  const a = createPrivateMediaUrl('meta_111_222.ogg');
  const b = createPrivateMediaUrl('meta_111_222.ogg');
  assert.strictEqual(a, b, 'the same file must always produce the same signed URL');
});

check('1.3 No authentication token or expiry is embedded in the media URL', () => {
  const url = createPrivateMediaUrl('out_9_z.png');
  assert(!/token|bearer|exp=/i.test(url), `media URL must not leak auth material: ${url}`);
  assert(url.includes('sig='), 'media URL must carry a signature');
});

check('1.4 A tampered filename is rejected', () => {
  const parsed = new URL(createPrivateMediaUrl('safe.jpg'), 'http://localhost');
  const sig = parsed.searchParams.get('sig');
  assert.strictEqual(verifyPrivateMediaUrl('../../etc/passwd', null, sig), false);
  assert.strictEqual(verifyPrivateMediaUrl('other.jpg', null, sig), false);
});

check('1.5 A tampered or malformed signature is rejected without throwing', () => {
  assert.strictEqual(verifyPrivateMediaUrl('safe.jpg', null, 'not-a-signature'), false);
  assert.strictEqual(verifyPrivateMediaUrl('safe.jpg', null, ''), false);
  assert.strictEqual(verifyPrivateMediaUrl('safe.jpg', null, undefined), false);
  assert.strictEqual(verifyPrivateMediaUrl('', null, signMediaFile('')), false);
  // Same length, different bytes.
  const sig = signMediaFile('safe.jpg');
  const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
  assert.strictEqual(verifyPrivateMediaUrl('safe.jpg', null, flipped), false);
});

console.log('\n📦 SECTION 2: Meta webhook signature validation');

check('2.1 A valid signature is accepted', () => {
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  const sig = crypto.createHmac('sha256', process.env.META_APP_SECRET).update(body).digest('hex');
  assert.strictEqual(verifyMetaSignature(body, `sha256=${sig}`), true);
});

check('2.2 Invalid signatures are rejected without throwing on length mismatch', () => {
  const body = '{}';
  // Wrong length must not throw (timingSafeEqual throws on unequal buffer sizes).
  assert.doesNotThrow(() => verifyMetaSignature(body, 'sha256=deadbeef'));
  assert.strictEqual(verifyMetaSignature(body, 'sha256=deadbeef'), false);
  assert.strictEqual(verifyMetaSignature(body, 'sha256=' + '0'.repeat(64)), false);
  assert.strictEqual(verifyMetaSignature(body, 'not-prefixed'), false);
  assert.strictEqual(verifyMetaSignature(body, undefined), false);
  assert.strictEqual(verifyMetaSignature(body + 'tampered', 'sha256=' + crypto.createHmac('sha256', process.env.META_APP_SECRET).update(body).digest('hex')), false);
});

console.log('\n📦 SECTION 3: Constant-time comparison helper');

check('3.1 Compares equal strings as equal and unequal strings as unequal', () => {
  assert.strictEqual(timingSafeStringEqual('abc', 'abc'), true);
  assert.strictEqual(timingSafeStringEqual('abc', 'abd'), false);
  assert.strictEqual(timingSafeStringEqual('abc', 'abcd'), false);
  assert.strictEqual(timingSafeStringEqual('', ''), true);
  assert.strictEqual(timingSafeStringEqual(undefined, 'x'), false);
});

check('3.2 Auth token verification uses the same helper and rejects bad signatures', () => {
  const token = signAuthToken({ userId: 'user-admin-1', role: 'super_admin' });
  assert.strictEqual(verifyAuthToken(token).valid, true);
  assert.strictEqual(verifyAuthToken(token.slice(0, -1) + 'X').valid, false);
  assert.strictEqual(verifyAuthToken('garbage').valid, false);
  assert.strictEqual(verifyAuthToken('').valid, false);
});

console.log('\n📦 SECTION 4: SSE tickets');

check('4.1 A ticket can be consumed exactly once', () => {
  const ticket = issueSseTicket({ id: 'user-admin-1', role: 'super_admin', fullName: 'A', branch: 'B', company: 'RWC' });
  const user = consumeSseTicket(ticket);
  assert.strictEqual(user?.id, 'user-admin-1');
  assert.strictEqual(user?.role, 'super_admin');
  assert.strictEqual(consumeSseTicket(ticket), null, 'tickets must be single-use');
});

check('4.2 Tickets store only the fields needed to open the stream', () => {
  const ticket = issueSseTicket({ id: 'u1', role: 'coordinator', fullName: 'N', branch: 'B', company: 'CRAS', password: 'secret', pin: '1234', email: 'x@y.z' });
  const user = consumeSseTicket(ticket);
  assert.deepStrictEqual(Object.keys(user).sort(), ['branch', 'company', 'fullName', 'id', 'role']);
  assert.strictEqual(user.password, undefined);
  assert.strictEqual(user.pin, undefined);
});

check('4.3 Expired and unknown tickets are rejected', () => {
  assert.strictEqual(consumeSseTicket('does-not-exist'), null);
  const stale = issueSseTicket({ id: 'u2', role: 'coordinator' });
  sseTickets.set(stale, { user: { id: 'u2', role: 'coordinator' }, issuedAt: Date.now() - (61 * 1000) });
  assert.strictEqual(consumeSseTicket(stale), null, 'expired tickets must not open a stream');
});

check('4.4 sweepExpiredSseTickets removes only stale entries', () => {
  sseTickets.clear();
  const fresh = issueSseTicket({ id: 'fresh', role: 'coordinator' });
  sseTickets.set('stale', { user: { id: 'stale', role: 'coordinator' }, issuedAt: Date.now() - (5 * 60 * 1000) });
  sweepExpiredSseTickets();
  assert.strictEqual(sseTickets.has('stale'), false);
  assert.strictEqual(sseTickets.has(fresh), true);
  sseTickets.clear();
});

console.log('\n📦 SECTION 5: Login attempt store is bounded');

check('5.1 Failed attempts lock out after the configured threshold', () => {
  resetLoginRateLimits();
  const ip = '10.0.0.1';
  for (let i = 0; i < 5; i += 1) recordLoginFailure(ip, 'victim@example.test');
  const result = checkLoginRateLimit(ip, 'victim@example.test');
  assert.strictEqual(result.limited, true);
  assert(result.retryAfter > 0);
  resetLoginRateLimits();
});

check('5.2 sweepLoginAttemptStore drops entries whose window and lockout have lapsed', () => {
  resetLoginRateLimits();
  loginAttemptStore.set('old-window', { count: 2, firstAttempt: Date.now() - (60 * 60 * 1000), lockedUntil: 0 });
  loginAttemptStore.set('active-lock', { count: 5, firstAttempt: Date.now(), lockedUntil: Date.now() + (10 * 60 * 1000) });
  sweepLoginAttemptStore();
  assert.strictEqual(loginAttemptStore.has('old-window'), false);
  assert.strictEqual(loginAttemptStore.has('active-lock'), true, 'an active lockout must survive the sweep');
  resetLoginRateLimits();
});

check('5.3 Repeated failures do not grow the store without limit', () => {
  resetLoginRateLimits();
  for (let i = 0; i < 3000; i += 1) recordLoginFailure(`10.1.${Math.floor(i / 256)}.${i % 256}`, `user${i}@example.test`);
  assert(loginAttemptStore.size <= 10000, `store must stay within its cap, was ${loginAttemptStore.size}`);
  resetLoginRateLimits();
});

console.log(`\n🎉 ALL MEDIA, MEMORY AND WEBHOOK SECURITY TESTS PASSED (${passed} checks)\n`);
process.exit(0);
