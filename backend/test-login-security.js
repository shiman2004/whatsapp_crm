process.env.NODE_ENV = 'test';

import assert from 'assert';
import http from 'http';
import {
  server,
  signAuthToken,
  verifyAuthToken,
  hashSecret,
  verifySecret,
  checkLoginRateLimit,
  recordLoginFailure,
  recordLoginSuccess,
  resetLoginRateLimits,
  dummyVerify,
  CANONICAL_USERS
} from './server.js';

console.log('🔒 Starting Login Credential Validation & Security Test Suite...\n');

// Start test server on an ephemeral port
const testPort = 39482;

server.listen(testPort, '127.0.0.1', async () => {
  const baseUrl = `http://127.0.0.1:${testPort}`;

  try {
    resetLoginRateLimits();

    // =========================================================================
    // SECTION 1: Missing Credentials Rejection (400 Bad Request)
    // =========================================================================
    console.log('📦 SECTION 1: Missing Credentials Rejection (No Default Tokens or Bypasses)');

    // 1.1 Empty payload
    const res1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res1.status, 400, 'Empty payload must return 400 Bad Request');
    const data1 = await res1.json();
    assert.strictEqual(data1.success, false);
    assert(data1.error.includes('required'), 'Must indicate credentials required');
    console.log('  ✅ 1.1 Empty payload correctly rejected with 400 Bad Request');

    // 1.2 Missing password/PIN (CRITICAL VULNERABILITY CHECK: previously granted super_admin)
    const res2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'user-admin-1' })
    });
    assert.strictEqual(res2.status, 400, 'Missing password/PIN must return 400 and NOT issue a token');
    const data2 = await res2.json();
    assert.strictEqual(data2.success, false);
    assert.strictEqual(data2.token, undefined, 'No token must ever be issued without password/PIN');
    console.log('  ✅ 1.2 Missing password/PIN correctly rejected with 400 (Vulnerability completely closed)');

    // 1.3 Missing identifier
    const res3 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin' })
    });
    assert.strictEqual(res3.status, 400, 'Missing identifier must return 400');
    const data3 = await res3.json();
    assert.strictEqual(data3.success, false);
    console.log('  ✅ 1.3 Missing identifier correctly rejected with 400');

    // 1.4 Whitespace-only fields
    const res4 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '   ', password: '   ' })
    });
    assert.strictEqual(res4.status, 400, 'Whitespace credentials must return 400');
    console.log('  ✅ 1.4 Whitespace-only credentials rejected with 400');

    // =========================================================================
    // SECTION 2: Incorrect Credentials & Account Enumeration Prevention (Generic 401)
    // =========================================================================
    console.log('\n📦 SECTION 2: Incorrect Credentials & Generic 401 Responses (Anti-Enumeration)');

    resetLoginRateLimits();

    // 2.1 Existing account with wrong password
    const resWrongPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'user-admin-1', password: 'incorrect_password' })
    });
    assert.strictEqual(resWrongPass.status, 401, 'Wrong password must return 401');
    const dataWrongPass = await resWrongPass.json();
    assert.strictEqual(dataWrongPass.success, false);
    assert.strictEqual(dataWrongPass.error, 'Invalid credentials.');
    console.log('  ✅ 2.1 Existing user with wrong password receives generic 401 "Invalid credentials."');

    // 2.2 Existing account with wrong PIN
    const resWrongPin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@royalwellness.lk', pin: '9999' })
    });
    assert.strictEqual(resWrongPin.status, 401, 'Wrong PIN must return 401');
    const dataWrongPin = await resWrongPin.json();
    assert.strictEqual(dataWrongPin.success, false);
    assert.strictEqual(dataWrongPin.error, 'Invalid credentials.');
    console.log('  ✅ 2.2 Existing user with wrong PIN receives generic 401 "Invalid credentials."');

    // 2.3 Non-existent user
    const resGhost = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'ghost@nonexistent.lk', password: 'randompassword123' })
    });
    assert.strictEqual(resGhost.status, 401, 'Non-existent account must return 401');
    const dataGhost = await resGhost.json();
    assert.strictEqual(dataGhost.success, false);
    assert.strictEqual(dataGhost.error, 'Invalid credentials.');
    console.log('  ✅ 2.3 Non-existent user receives identical generic 401 "Invalid credentials."');

    // 2.4 Comparison to confirm no user enumeration leakage
    assert.strictEqual(
      dataWrongPass.error,
      dataGhost.error,
      'Error message for bad password and non-existent user must be identical to prevent enumeration'
    );
    console.log('  ✅ 2.4 Error response messages are strictly identical (Account enumeration prevented)');

    // =========================================================================
    // SECTION 3: Deactivated / Disabled Account Protection
    // =========================================================================
    console.log('\n📦 SECTION 3: Disabled Account Protection');

    // Temporarily create a disabled user in CANONICAL_USERS
    const disabledUser = {
      id: 'user-disabled-test',
      fullName: 'Disabled Staff',
      email: 'disabled@royalwellness.lk',
      password: hashSecret('secret123'),
      pin: hashSecret('1111'),
      role: 'coordinator',
      active: false
    };
    CANONICAL_USERS.push(disabledUser);

    resetLoginRateLimits();
    const resDisabled = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'disabled@royalwellness.lk', password: 'secret123' })
    });
    assert.strictEqual(resDisabled.status, 401, 'Disabled account must return 401');
    const dataDisabled = await resDisabled.json();
    assert.strictEqual(dataDisabled.success, false);
    assert.strictEqual(
      dataDisabled.error,
      'Invalid credentials.',
      'Disabled account must not disclose status to prevent account enumeration'
    );
    console.log('  ✅ 3.1 Disabled account returns identical generic 401 without disclosing account status');

    // Clean up test entry
    const idx = CANONICAL_USERS.findIndex(u => u.id === 'user-disabled-test');
    if (idx !== -1) CANONICAL_USERS.splice(idx, 1);

    // =========================================================================
    // SECTION 4: Legitimate Authentication & Token Issuance (200 OK)
    // =========================================================================
    console.log('\n📦 SECTION 4: Legitimate Authentication & Cryptographic Token Issuance');

    resetLoginRateLimits();

    // 4.1 Super Admin login with password
    const resAdminPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'user-admin-1', password: 'admin' })
    });
    assert.strictEqual(resAdminPass.status, 200, 'Super admin password login must succeed');
    const dataAdminPass = await resAdminPass.json();
    assert.strictEqual(dataAdminPass.success, true);
    assert(dataAdminPass.token, 'Must return token');
    assert.strictEqual(dataAdminPass.user.role, 'super_admin');
    assert.strictEqual(dataAdminPass.user.password, undefined, 'Must not return password');
    assert.strictEqual(dataAdminPass.user.pin, undefined, 'Must not return PIN');

    const verifiedAdmin = verifyAuthToken(dataAdminPass.token);
    assert.strictEqual(verifiedAdmin.valid, true);
    assert.strictEqual(verifiedAdmin.payload.role, 'super_admin');
    console.log('  ✅ 4.1 Super Admin password authentication succeeds and issues verified HMAC token');

    // 4.2 Super Admin login with PIN
    const resAdminPin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@royalwellness.lk', pin: '1234' })
    });
    assert.strictEqual(resAdminPin.status, 200, 'Super admin PIN login must succeed');
    const dataAdminPin = await resAdminPin.json();
    assert.strictEqual(dataAdminPin.success, true);
    assert(dataAdminPin.token, 'Must return token');
    console.log('  ✅ 4.2 Super Admin 4-digit PIN authentication succeeds');

    // 4.3 Coordinator login with PIN
    const resCoordPin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'faiha@royalwellness.lk', pin: '2026' })
    });
    assert.strictEqual(resCoordPin.status, 200, 'Coordinator PIN login must succeed');
    const dataCoordPin = await resCoordPin.json();
    assert.strictEqual(dataCoordPin.success, true);
    assert.strictEqual(dataCoordPin.user.role, 'coordinator');
    console.log('  ✅ 4.3 Coordinator PIN authentication succeeds with coordinator role');

    // 4.4 Coordinator login with password
    const resCoordPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'user-hasini-1', password: 'staff' })
    });
    assert.strictEqual(resCoordPass.status, 200, 'Coordinator password login must succeed');
    const dataCoordPass = await resCoordPass.json();
    assert.strictEqual(dataCoordPass.success, true);
    console.log('  ✅ 4.4 Coordinator password authentication succeeds');

    // 4.5 Leads Officer login with email and password
    const resOfficer = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'SARAH@ROYALWELLNESS.LK', password: 'staff' })
    });
    assert.strictEqual(resOfficer.status, 200, 'Leads officer login must succeed');
    const dataOfficer = await resOfficer.json();
    assert.strictEqual(dataOfficer.success, true);
    assert.strictEqual(dataOfficer.user.role, 'leads_officer');
    console.log('  ✅ 4.5 Leads Officer login with case-insensitive email succeeds');

    // 4.6 Frontend CrmContext payload format ({ identifier, pin, password })
    const resCrmContextFormat = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'user-zeenath-1', pin: '2026', password: '2026' })
    });
    assert.strictEqual(resCrmContextFormat.status, 200);
    const dataCrmContext = await resCrmContextFormat.json();
    assert.strictEqual(dataCrmContext.success, true);
    console.log('  ✅ 4.6 Frontend CrmContext dual-payload format ({ identifier, pin, password }) verified');

    // =========================================================================
    // SECTION 5: Login Rate Limiting & Abuse Protection (429 Too Many Requests)
    // =========================================================================
    console.log('\n📦 SECTION 5: Progressive Abuse Protection & Rate Limiting');

    resetLoginRateLimits();

    const bruteForceTarget = 'attacker_test_user@royalwellness.lk';

    // Send 5 failed login attempts
    for (let i = 1; i <= 5; i++) {
      const failRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: bruteForceTarget, password: `wrong_${i}` })
      });
      assert.strictEqual(failRes.status, 401, `Attempt ${i} must fail with 401`);
    }
    console.log('  ✅ 5.1 5 consecutive failed login attempts tracked');

    // 6th attempt should be blocked with 429 Too Many Requests
    const blockedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: bruteForceTarget, password: 'attempt_6' })
    });
    assert.strictEqual(blockedRes.status, 429, '6th attempt must be blocked with HTTP 429');
    const retryHeader = blockedRes.headers.get('retry-after');
    assert(retryHeader, 'Retry-After header must be set');
    const blockedData = await blockedRes.json();
    assert.strictEqual(blockedData.success, false);
    assert(blockedData.error.includes('Too many failed login attempts'), 'Must indicate rate limit lockout');
    console.log(`  ✅ 5.2 6th attempt blocked with 429 Too Many Requests (Retry-After: ${retryHeader}s)`);

    // Reset rate limits and verify immediate recovery
    resetLoginRateLimits();
    const recoveredRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'user-admin-1', password: 'admin' })
    });
    assert.strictEqual(recoveredRes.status, 200, 'Must allow login after rate limit reset');
    console.log('  ✅ 5.3 Legitimate login succeeds once rate limit resets');

    // =========================================================================
    // SECTION 6: Password & PIN Cryptographic Hashing and Migration
    // =========================================================================
    console.log('\n📦 SECTION 6: Password/PIN Cryptographic Hashing & Migration');

    // 6.1 hashSecret generates salted scrypt hash
    const testSecret = 'SuperSecret2026!';
    const hashed = hashSecret(testSecret);
    assert(hashed.startsWith('scrypt:'), 'Hash must start with scrypt: scheme');
    const hashParts = hashed.split(':');
    assert.strictEqual(hashParts.length, 3, 'Hash must contain scheme:salt:hash');
    assert(hashParts[1].length >= 32, 'Salt must be at least 16 bytes hex');
    assert(hashParts[2].length >= 64, 'Hash must be keylength 64 hex');
    console.log('  ✅ 6.1 hashSecret creates salted scrypt hashes formatted as scrypt:<salt>:<hash>');

    // 6.2 verifySecret validates scrypt hash
    const validVerify = verifySecret(testSecret, hashed);
    assert.strictEqual(validVerify.match, true, 'Matching secret must verify');
    assert.strictEqual(validVerify.needsRehash, false, 'Scrypt hash does not need rehash');

    const wrongVerify = verifySecret('WrongSecret!', hashed);
    assert.strictEqual(wrongVerify.match, false, 'Mismatched secret must fail');
    console.log('  ✅ 6.2 verifySecret performs constant-time cryptographic verification');

    // 6.3 Safe migration: legacy plaintext is matched and flags needsRehash
    const legacyPlaintext = 'legacy_staff_password';
    const legacyVerify = verifySecret('legacy_staff_password', legacyPlaintext);
    assert.strictEqual(legacyVerify.match, true, 'Legacy plaintext must match');
    assert.strictEqual(legacyVerify.needsRehash, true, 'Legacy plaintext must flag needsRehash for upgrade');
    console.log('  ✅ 6.3 Safe migration: legacy plaintext matches and triggers needsRehash transparently');

    // 6.4 Canonical users pre-hashed verification
    for (const u of CANONICAL_USERS) {
      assert(u.password.startsWith('scrypt:'), `User ${u.id} password must be scrypt hashed`);
      assert(u.pin.startsWith('scrypt:'), `User ${u.id} PIN must be scrypt hashed`);
    }
    console.log('  ✅ 6.4 All CANONICAL_USERS credentials are pre-hashed with scrypt (no plaintext stored)');

    // =========================================================================
    // SECTION 7: API Credential Leakage Prevention
    // =========================================================================
    console.log('\n📦 SECTION 7: API Credential Leakage Prevention');

    const adminToken = signAuthToken({
      userId: 'user-admin-1',
      email: 'admin@royalwellness.lk',
      role: 'super_admin',
      fullName: 'Super Admin'
    });

    const coordsRes = await fetch(`${baseUrl}/api/coordinators`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(coordsRes.status, 200);
    const coordsList = await coordsRes.json();
    assert(Array.isArray(coordsList));
    for (const staff of coordsList) {
      assert.strictEqual(staff.password, undefined, `Password must not leak in staff response for ${staff.id}`);
      assert.strictEqual(staff.pin, undefined, `PIN must not leak in staff response for ${staff.id}`);
    }
    console.log('  ✅ 7.1 /api/coordinators response completely omits passwords and PINs');

    console.log('\n🎉 ALL LOGIN CREDENTIAL VALIDATION & SECURITY TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Login Security Test Failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
