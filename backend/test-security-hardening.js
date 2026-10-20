// Focused regression tests for production authentication and boundary hardening.
process.env.NODE_ENV = 'test';
process.env.META_APP_SECRET = 'test-meta-app-secret';

import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import {
  authenticateRequest,
  isPublicRoute,
  signAuthToken,
  verifyMetaSignature
} from './server.js';

const adminToken = signAuthToken({
  userId: 'user-admin-1',
  email: 'admin@example.test',
  role: 'super_admin',
  fullName: 'Test Admin'
});

const headerOnly = await authenticateRequest(
  { headers: { 'x-user-id': 'user-admin-1' } },
  { query: {} }
);
assert.strictEqual(headerOnly.user, null, 'identity headers must never authenticate requests');
assert.strictEqual(headerOnly.status, 401);

const valid = await authenticateRequest(
  { headers: { authorization: `Bearer ${adminToken}` } },
  { query: {} }
);
assert.strictEqual(valid.user?.id, 'user-admin-1', 'valid signed token should authenticate test user');

assert.strictEqual(isPublicRoute({ method: 'GET' }, '/api/appointments'), false);
assert.strictEqual(isPublicRoute({ method: 'GET' }, '/api/patients/search'), false);
assert.strictEqual(isPublicRoute({ method: 'GET' }, '/api/availability-blocks'), false);

for (const frontendFile of [
  '../frontend/src/context/CrmContext.tsx',
  '../frontend/src/services/appointmentService.ts',
  '../frontend/src/components/layout/WhatsAppQrModal.tsx'
]) {
  const source = fs.readFileSync(new URL(frontendFile, import.meta.url), 'utf8');
  assert(!/x-user-id|x-coordinator-id/.test(source), `${frontendFile} must not emit legacy identity headers`);
}

const rawBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
const signature = crypto.createHmac('sha256', process.env.META_APP_SECRET).update(rawBody).digest('hex');
assert.strictEqual(verifyMetaSignature(rawBody, `sha256=${signature}`), true);
assert.strictEqual(verifyMetaSignature(rawBody, 'sha256=' + '0'.repeat(64)), false);
assert.strictEqual(verifyMetaSignature(rawBody + 'tampered', `sha256=${signature}`), false);

console.log('Security hardening tests passed.');
process.exit(0);
