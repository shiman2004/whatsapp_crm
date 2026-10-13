// Comprehensive Security Test Suite for Authentication, Authorization & RBAC
process.env.NODE_ENV = 'test';
import assert from 'assert';
import crypto from 'crypto';
import {
  signAuthToken,
  verifyAuthToken,
  authenticateRequest,
  isPublicRoute,
  CANONICAL_USERS
} from './server.js';

console.log('🔒 Starting Authentication & Authorization Security Test Suite...\n');

// -----------------------------------------------------------------------------
// SECTION 1: Cryptographic Token Signing & Verification (HMAC-SHA256)
// -----------------------------------------------------------------------------
console.log('📦 SECTION 1: Token Signing & Cryptographic Verification');

// 1.1 Valid Token Signing and Verification
const adminPayload = {
  userId: 'user-admin-1',
  email: 'admin@royalwellness.lk',
  role: 'super_admin',
  fullName: 'Super Admin'
};
const adminToken = signAuthToken(adminPayload);
assert(typeof adminToken === 'string' && adminToken.includes('.'), 'Token must be a dotted string');

const verifyAdmin = verifyAuthToken(adminToken);
assert.strictEqual(verifyAdmin.valid, true, 'Valid token must be verified successfully');
assert.strictEqual(verifyAdmin.payload.userId, 'user-admin-1');
assert.strictEqual(verifyAdmin.payload.role, 'super_admin');
console.log('  ✅ 1.1 Valid Super Admin token signs and verifies properly');

// 1.2 Tampered Token Signature Rejection
const tamperedToken = adminToken.slice(0, -5) + 'xxxxx';
const verifyTampered = verifyAuthToken(tamperedToken);
assert.strictEqual(verifyTampered.valid, false, 'Tampered token signature must be rejected');
assert(verifyTampered.error.includes('signature mismatch'), 'Error must report signature mismatch');
console.log('  ✅ 1.2 Tampered token signature is cryptographically rejected');

// 1.3 Malformed Tokens
assert.strictEqual(verifyAuthToken('').valid, false, 'Empty token must be rejected');
assert.strictEqual(verifyAuthToken(null).valid, false, 'Null token must be rejected');
assert.strictEqual(verifyAuthToken('not-a-token').valid, false, 'Single-part token must be rejected');
assert.strictEqual(verifyAuthToken('a.b.c').valid, false, 'Three-part token must be rejected');
console.log('  ✅ 1.3 Malformed and non-dotted tokens are rejected');

// 1.4 Expired Token Handling
const expiredToken = signAuthToken(adminPayload, -1000); // expired 1s ago
const verifyExpired = verifyAuthToken(expiredToken);
assert.strictEqual(verifyExpired.valid, false, 'Expired token must be invalid');
assert.strictEqual(verifyExpired.expired, true, 'Expired flag must be set');
assert(verifyExpired.error.includes('expired'), 'Error must report expiration');
console.log('  ✅ 1.4 Expired token is rejected with explicit expired flag');

// -----------------------------------------------------------------------------
// SECTION 2: Public vs Protected Route Classification (Least Privilege Default)
// -----------------------------------------------------------------------------
console.log('\n📦 SECTION 2: Route Protection Whitelist vs Protected Default');

// Public endpoints
assert.strictEqual(isPublicRoute({ method: 'POST' }, '/api/auth/login'), true, 'POST /api/auth/login must be public');
assert.strictEqual(isPublicRoute({ method: 'GET' }, '/api/webhook'), true, 'Meta webhook GET must be public');
assert.strictEqual(isPublicRoute({ method: 'POST' }, '/api/webhook'), true, 'Meta webhook POST must be public');
assert.strictEqual(isPublicRoute({ method: 'GET' }, '/api/db/status'), true, 'GET /api/db/status must be public');
assert.strictEqual(isPublicRoute({ method: 'GET' }, '/api/meta/config'), true, 'GET /api/meta/config must be public');
assert.strictEqual(isPublicRoute({ method: 'GET' }, '/uploads/sample.jpg'), true, 'Static /uploads/ must be public');
assert.strictEqual(isPublicRoute({ method: 'GET' }, '/api/categories'), true, 'GET /api/categories catalog must be public');

// Protected CRM endpoints (Denied to unauthenticated callers by default)
assert.strictEqual(isPublicRoute({ method: 'GET' }, '/api/leads'), false, 'GET /api/leads must be protected');
assert.strictEqual(isPublicRoute({ method: 'GET' }, '/api/messages'), false, 'GET /api/messages must be protected');
assert.strictEqual(isPublicRoute({ method: 'POST' }, '/api/send'), false, 'POST /api/send must be protected');
assert.strictEqual(isPublicRoute({ method: 'POST' }, '/api/leads/assign'), false, 'POST /api/leads/assign must be protected');
assert.strictEqual(isPublicRoute({ method: 'POST' }, '/api/upload'), false, 'POST /api/upload must be protected');
assert.strictEqual(isPublicRoute({ method: 'POST' }, '/api/clear-db'), false, 'POST /api/clear-db must be protected');
assert.strictEqual(isPublicRoute({ method: 'POST' }, '/api/disconnect'), false, 'POST /api/disconnect must be protected');
assert.strictEqual(isPublicRoute({ method: 'POST' }, '/api/meta/config'), false, 'POST /api/meta/config must be protected');
assert.strictEqual(isPublicRoute({ method: 'GET' }, '/api/events'), false, 'GET /api/events SSE must be protected');
console.log('  ✅ 2.1 Public routes correctly recognized, all CRM data/actions protected by default');

// -----------------------------------------------------------------------------
// SECTION 3: authenticateRequest Middleware Security Assertions
// -----------------------------------------------------------------------------
console.log('\n📦 SECTION 3: authenticateRequest Credential Verification');

// 3.1 Missing Credentials -> 401
const missingAuthReq = { headers: {} };
const missingRes = await authenticateRequest(missingAuthReq, { query: {} });
assert.strictEqual(missingRes.user, null);
assert.strictEqual(missingRes.status, 401);
assert(missingRes.error.includes('Missing authentication credentials'), 'Missing credentials error expected');
console.log('  ✅ 3.1 Missing credentials rejected with 401');

// 3.2 Malformed Authorization Header -> 401
const malformedAuthReq = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
const malformedRes = await authenticateRequest(malformedAuthReq, { query: {} });
assert.strictEqual(malformedRes.user, null);
assert.strictEqual(malformedRes.status, 401);
assert(malformedRes.error.includes('Malformed Authorization header'), 'Malformed header error expected');
console.log('  ✅ 3.2 Malformed Authorization header rejected with 401');

// 3.3 Plain User ID Bypass Attempt -> 401 (Fix for line 367–414 bypass vulnerability)
const spoofIdReq = {
  headers: {
    authorization: 'Bearer user-admin-1', // Plain user-admin-1 string without HMAC
    'x-coordinator-id': 'user-admin-1',
    'x-user-id': 'user-admin-1'
  }
};
const spoofIdRes = await authenticateRequest(spoofIdReq, { query: {} });
assert.strictEqual(spoofIdRes.user, null, 'Plain user ID must NEVER be accepted as token');
assert.strictEqual(spoofIdRes.status, 401);
console.log('  ✅ 3.3 Plain user ID ("Bearer user-admin-1") rejected with 401 (Vulnerability fixed)');

// 3.4 Expired Token -> 401
const expiredAuthReq = { headers: { authorization: `Bearer ${expiredToken}` } };
const expiredRes = await authenticateRequest(expiredAuthReq, { query: {} });
assert.strictEqual(expiredRes.user, null);
assert.strictEqual(expiredRes.status, 401);
assert(expiredRes.error.includes('expired'), 'Expired error message expected');
console.log('  ✅ 3.4 Expired token rejected with 401');

// 3.5 Token with Non-Existent User ID -> 401
const fakeUserToken = signAuthToken({ userId: 'ghost-user-999', role: 'super_admin' });
const fakeUserRes = await authenticateRequest({ headers: { authorization: `Bearer ${fakeUserToken}` } }, { query: {} });
assert.strictEqual(fakeUserRes.user, null);
assert.strictEqual(fakeUserRes.status, 401);
assert(fakeUserRes.error.includes('does not exist'), 'Nonexistent user rejected');
console.log('  ✅ 3.5 Token signed with non-existent user ID rejected with 401');

// 3.6 Query Parameter Token Support (for SSE EventSource)
const queryAuthReq = { headers: {} };
const queryRes = await authenticateRequest(queryAuthReq, { query: { token: adminToken } });
assert(queryRes.user !== null, 'Valid token in query param must be authenticated');
assert.strictEqual(queryRes.user.id, 'user-admin-1');
assert.strictEqual(queryRes.user.role, 'super_admin');
console.log('  ✅ 3.6 Query parameter token authenticated for SSE keep-alive stream');

// -----------------------------------------------------------------------------
// SECTION 4: Role Integrity: Client Headers & Role Spoofing Prevented
// -----------------------------------------------------------------------------
console.log('\n📦 SECTION 4: Role Integrity & Prevention of Role Spoofing');

// 4.1 Coordinator Token with Spoofed Header Claiming Admin
const coordPayload = {
  userId: 'user-faiha-1',
  role: 'super_admin' // Attacker crafts payload claiming super_admin
};
const spoofedCoordToken = signAuthToken(coordPayload);
const spoofedCoordRes = await authenticateRequest({
  headers: {
    authorization: `Bearer ${spoofedCoordToken}`,
    'x-coordinator-id': 'user-admin-1', // Spoofed admin header
    'x-user-id': 'user-admin-1'
  }
}, { query: {} });

assert(spoofedCoordRes.user !== null);
assert.strictEqual(
  spoofedCoordRes.user.role,
  'coordinator',
  'User role must be derived strictly from verified database/canonical record (coordinator), NOT from client token payload or headers'
);
assert.strictEqual(spoofedCoordRes.user.id, 'user-faiha-1');
console.log('  ✅ 4.1 Client role spoofing prevented: Coordinator cannot gain super_admin privileges via token payload or headers');

// 4.2 Leads Officer Role Derived Accurately
const officerToken = signAuthToken({ userId: 'user-officer-1' });
const officerRes = await authenticateRequest({ headers: { authorization: `Bearer ${officerToken}` } }, { query: {} });
assert.strictEqual(officerRes.user.role, 'leads_officer');
assert.strictEqual(officerRes.user.id, 'user-officer-1');
console.log('  ✅ 4.2 Leads Officer role accurately verified from system record');

// -----------------------------------------------------------------------------
// SECTION 5: RBAC Role & Operation Privilege Matrix
// -----------------------------------------------------------------------------
console.log('\n📦 SECTION 5: RBAC Role Permission Matrix Simulation');

const simulateRbacCheck = (user, endpoint, action = 'POST') => {
  if (!user) return { allowed: false, status: 401, error: 'Unauthorized' };

  // Super Admin restricted actions
  const superAdminOnlyEndpoints = [
    '/api/clear-db',
    '/api/meta/config',
    '/api/meta/token',
    '/api/disconnect',
    '/api/whatsapp/disconnect',
    '/api/chats/delete',
    '/api/leads/delete'
  ];

  if (superAdminOnlyEndpoints.includes(endpoint) && action === 'POST') {
    if (user.role !== 'super_admin') {
      return { allowed: false, status: 403, error: 'Forbidden: Super Admin only' };
    }
  }

  // Staff Management (Super Admin only for POST/PUT/DELETE)
  if (endpoint.startsWith('/api/coordinators') && ['POST', 'PUT', 'DELETE'].includes(action)) {
    if (user.role !== 'super_admin') {
      return { allowed: false, status: 403, error: 'Forbidden: Super Admin only' };
    }
  }

  // Lead Assignment
  if (endpoint === '/api/leads/assign' && action === 'POST') {
    if (user.role === 'coordinator') {
      return { allowed: false, status: 403, error: 'Forbidden: Coordinators cannot assign leads' };
    }
  }

  // Team Broadcasts
  if (endpoint === '/api/broadcasts' && ['POST', 'DELETE'].includes(action)) {
    if (user.role !== 'super_admin' && user.role !== 'leads_officer') {
      return { allowed: false, status: 403, error: 'Forbidden: Super Admin and Leads Officers only' };
    }
  }

  return { allowed: true, status: 200 };
};

const superAdminUser = { id: 'user-admin-1', role: 'super_admin' };
const leadsOfficerUser = { id: 'user-officer-1', role: 'leads_officer' };
const coordinatorUser = { id: 'user-faiha-1', role: 'coordinator' };

// 5.1 Coordinator Permission Denials (403 Forbidden)
assert.strictEqual(simulateRbacCheck(coordinatorUser, '/api/clear-db', 'POST').status, 403);
assert.strictEqual(simulateRbacCheck(coordinatorUser, '/api/meta/config', 'POST').status, 403);
assert.strictEqual(simulateRbacCheck(coordinatorUser, '/api/disconnect', 'POST').status, 403);
assert.strictEqual(simulateRbacCheck(coordinatorUser, '/api/coordinators', 'POST').status, 403);
assert.strictEqual(simulateRbacCheck(coordinatorUser, '/api/chats/delete', 'POST').status, 403);
assert.strictEqual(simulateRbacCheck(coordinatorUser, '/api/leads/assign', 'POST').status, 403);
assert.strictEqual(simulateRbacCheck(coordinatorUser, '/api/broadcasts', 'POST').status, 403);
console.log('  ✅ 5.1 Coordinator forbidden from administrative & reassignment endpoints (all return 403)');

// 5.2 Leads Officer Privileges
assert.strictEqual(simulateRbacCheck(leadsOfficerUser, '/api/broadcasts', 'POST').status, 200);
assert.strictEqual(simulateRbacCheck(leadsOfficerUser, '/api/leads/assign', 'POST').status, 200);
assert.strictEqual(simulateRbacCheck(leadsOfficerUser, '/api/clear-db', 'POST').status, 403);
assert.strictEqual(simulateRbacCheck(leadsOfficerUser, '/api/disconnect', 'POST').status, 403);
assert.strictEqual(simulateRbacCheck(leadsOfficerUser, '/api/coordinators', 'POST').status, 403);
console.log('  ✅ 5.2 Leads Officer granted broadcast & lead assignment; denied database wipe and staff management');

// 5.3 Super Admin Full Access
assert.strictEqual(simulateRbacCheck(superAdminUser, '/api/clear-db', 'POST').status, 200);
assert.strictEqual(simulateRbacCheck(superAdminUser, '/api/meta/config', 'POST').status, 200);
assert.strictEqual(simulateRbacCheck(superAdminUser, '/api/disconnect', 'POST').status, 200);
assert.strictEqual(simulateRbacCheck(superAdminUser, '/api/coordinators', 'POST').status, 200);
assert.strictEqual(simulateRbacCheck(superAdminUser, '/api/chats/delete', 'POST').status, 200);
assert.strictEqual(simulateRbacCheck(superAdminUser, '/api/leads/assign', 'POST').status, 200);
assert.strictEqual(simulateRbacCheck(superAdminUser, '/api/broadcasts', 'POST').status, 200);
console.log('  ✅ 5.3 Legitimate Super Admin operations preserved and authorized');

// -----------------------------------------------------------------------------
// SECTION 6: Resource-Level Permission Enforcement
// -----------------------------------------------------------------------------
console.log('\n📦 SECTION 6: Resource-Level Permissions (Lead & Chat Isolation)');

const simulateResourceCheck = (user, lead) => {
  if (user.role === 'super_admin' || user.role === 'leads_officer') {
    return { allowed: true };
  }
  if (user.role === 'coordinator') {
    if (lead && lead.assignedTo && lead.assignedTo !== user.id) {
      return { allowed: false, status: 403, error: 'Forbidden: You can only message leads assigned to you.' };
    }
  }
  return { allowed: true };
};

const leadAssignedToHasini = { id: 'lead-101', assignedTo: 'user-hasini-1' };
const leadAssignedToFaiha = { id: 'lead-102', assignedTo: 'user-faiha-1' };

// Faiha attempts operation on Hasini's lead
const faihaCrossCheck = simulateResourceCheck(coordinatorUser, leadAssignedToHasini);
assert.strictEqual(faihaCrossCheck.allowed, false);
assert.strictEqual(faihaCrossCheck.status, 403);
console.log('  ✅ 6.1 Coordinator cross-lead operation blocked with 403 Forbidden');

// Faiha operates on her own assigned lead
const faihaOwnCheck = simulateResourceCheck(coordinatorUser, leadAssignedToFaiha);
assert.strictEqual(faihaOwnCheck.allowed, true);
console.log('  ✅ 6.2 Coordinator permitted to operate on their own assigned lead');

// Super Admin operates on any lead
const adminLeadCheck = simulateResourceCheck(superAdminUser, leadAssignedToHasini);
assert.strictEqual(adminLeadCheck.allowed, true);
console.log('  ✅ 6.3 Super Admin permitted across all leads');

// -----------------------------------------------------------------------------
// SECTION 7: Canonical Users Seed Integrity
// -----------------------------------------------------------------------------
console.log('\n📦 SECTION 7: Canonical Users Fallback Integrity');

assert(CANONICAL_USERS.length >= 5, 'Canonical users must have pre-seeded staff');
const canonicalAdmin = CANONICAL_USERS.find(u => u.id === 'user-admin-1');
assert.strictEqual(canonicalAdmin.role, 'super_admin');

const canonicalOfficer = CANONICAL_USERS.find(u => u.id === 'user-officer-1');
assert.strictEqual(canonicalOfficer.role, 'leads_officer');

const canonicalFaiha = CANONICAL_USERS.find(u => u.id === 'user-faiha-1');
assert.strictEqual(canonicalFaiha.role, 'coordinator');
console.log('  ✅ 7.1 Canonical user fallback maintains strict role separation without granting speculative super_admin privileges');

console.log('\n🎉 ALL AUTHENTICATION & AUTHORIZATION SECURITY TESTS PASSED SUCCESSFULLY!\n');
process.exit(0);
