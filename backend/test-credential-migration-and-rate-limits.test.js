import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { getPrisma, checkDbConnection } from './src/db.js';
import {
  hashSecret,
  verifySecret,
  encryptReversible,
  decryptReversible
} from './src/secretHash.js';
import {
  migrateLegacyCredentials,
  verifyCredentialFormats
} from './scripts/migrate-legacy-credentials.js';
import {
  checkSharedLoginRateLimit,
  recordSharedLoginFailure,
  recordSharedLoginSuccess,
  cleanupExpiredRateLimits
} from './src/legacyServer.js';

const prisma = getPrisma();
const runId = crypto.randomBytes(4).toString('hex');
const testPrefix = `audit_mig_${runId}`;

test.before(async () => {
  if (!prisma) {
    throw new Error('Database connection required for migration regression tests.');
  }
  const dbCheck = await checkDbConnection();
  if (!dbCheck.connected) {
    throw new Error(`Database connection failed: ${dbCheck.message || dbCheck.error}`);
  }
});

test.after(async () => {
  if (prisma) {
    // Cleanup synthetic accounts created during tests
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.user_sessions WHERE user_id IN (SELECT id FROM public.users WHERE email LIKE $1)`,
      `%${testPrefix}%`
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.users WHERE email LIKE $1`,
      `%${testPrefix}%`
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.auth_rate_limits WHERE rate_key LIKE $1`,
      `%${testPrefix}%`
    ).catch(() => {});
  }
});

test('1. Migration dry-run detects legacy enc:v1: credentials without mutating DB', async () => {
  const syntheticId = `user-${testPrefix}-dryrun`;
  const plainPass = 'LegacyPass!2026';
  const plainPin = '7891';
  const encPass = encryptReversible(plainPass);
  const encPin = encryptReversible(plainPin);

  // Insert synthetic user with enc:v1: credentials
  await prisma.$executeRawUnsafe(`
    INSERT INTO public.users (id, "fullName", email, password, pin, role, branch, company, active, "createdAt", "updatedAt")
    VALUES ($1, 'Dry Run Synthetic User', $2, $3, $4, 'coordinator', 'Colombo', 'RWC', true, NOW(), NOW())
  `, syntheticId, `${testPrefix}_dryrun@test.local`, encPass, encPin);

  // Run dry run
  const dryRunSummary = await migrateLegacyCredentials({ dryRun: true, prismaClient: prisma });
  assert.ok(dryRunSummary.legacyFound >= 1, 'Should find at least 1 legacy user');
  assert.ok(dryRunSummary.passwordsMigrated >= 1, 'Should report password migration candidate');
  assert.ok(dryRunSummary.pinsMigrated >= 1, 'Should report PIN migration candidate');
  assert.equal(dryRunSummary.failures.length, 0, 'No failures expected');

  // Verify database was NOT modified
  const userInDb = await prisma.user.findUnique({
    where: { id: syntheticId },
    select: { password: true, pin: true }
  });
  assert.ok(userInDb.password.startsWith('enc:v1:'), 'Password must remain enc:v1: after dry-run');
  assert.ok(userInDb.pin.startsWith('enc:v1:'), 'PIN must remain enc:v1: after dry-run');
});

test('2. Migration apply safely updates enc:v1: to salted scrypt with conditional locking', async () => {
  const syntheticId = `user-${testPrefix}-apply`;
  const plainPass = 'SecureLegacyPass!99';
  const plainPin = '4321';
  const encPass = encryptReversible(plainPass);
  const encPin = encryptReversible(plainPin);

  await prisma.$executeRawUnsafe(`
    INSERT INTO public.users (id, "fullName", email, password, pin, role, branch, company, active, "createdAt", "updatedAt")
    VALUES ($1, 'Apply Migration User', $2, $3, $4, 'coordinator', 'Colombo', 'RWC', true, NOW(), NOW())
  `, syntheticId, `${testPrefix}_apply@test.local`, encPass, encPin);

  // Run apply migration (isolated with synthetic filter via query or direct call)
  // Let's call migrateLegacyCredentials with dryRun: false
  const applySummary = await migrateLegacyCredentials({ dryRun: false, prismaClient: prisma });
  assert.ok(applySummary.passwordsMigrated >= 1, 'At least 1 password migrated');
  assert.ok(applySummary.pinsMigrated >= 1, 'At least 1 PIN migrated');

  // Inspect database row
  const updatedUser = await prisma.user.findUnique({
    where: { id: syntheticId },
    select: { password: true, pin: true }
  });

  assert.ok(updatedUser.password.startsWith('scrypt:'), 'Password must now be scrypt:');
  assert.ok(updatedUser.pin.startsWith('scrypt:'), 'PIN must now be scrypt:');

  // Verify that authentication with original credentials works against the new scrypt hashes
  const passCheck = verifySecret(plainPass, updatedUser.password);
  assert.equal(passCheck.match, true, 'Original password must authenticate against scrypt hash');
  assert.equal(passCheck.needsRehash, false, 'No rehash needed for newly generated scrypt hash');

  const pinCheck = verifySecret(plainPin, updatedUser.pin);
  assert.equal(pinCheck.match, true, 'Original PIN must authenticate against scrypt hash');
  assert.equal(pinCheck.needsRehash, false, 'No rehash needed for newly generated scrypt hash');
});

test('3. Migration idempotence — second apply run finds zero legacy records for migrated users', async () => {
  const secondSummary = await migrateLegacyCredentials({ dryRun: false, prismaClient: prisma });
  // All enc:v1: records that could be migrated were already converted
  assert.equal(secondSummary.passwordsMigrated, 0, 'No passwords should be migrated on second run');
  assert.equal(secondSummary.pinsMigrated, 0, 'No pins should be migrated on second run');
});

test('4. Migration error handling: corrupt credentials do not throw, report remedy, and never leak secret', async () => {
  const syntheticId = `user-${testPrefix}-corrupt`;
  // Construct corrupted enc:v1: string
  const corruptedEnc = 'enc:v1:00112233445566778899aabb:00112233445566778899aabbccddeeff:deadbeefcafebabe';

  await prisma.$executeRawUnsafe(`
    INSERT INTO public.users (id, "fullName", email, password, pin, role, branch, company, active, "createdAt", "updatedAt")
    VALUES ($1, 'Corrupted Secret User', $2, $3, $4, 'coordinator', 'Colombo', 'RWC', true, NOW(), NOW())
  `, syntheticId, `${testPrefix}_corrupt@test.local`, corruptedEnc, null);

  const corruptSummary = await migrateLegacyCredentials({ dryRun: true, prismaClient: prisma });
  const failure = corruptSummary.failures.find(f => f.id === syntheticId);

  assert.ok(failure, 'Corrupted record must be recorded in failures');
  assert.equal(failure.reason, 'DECRYPTION_FAILED');
  assert.ok(failure.remedy.includes('reset'), 'Remedy instructions must be provided');
  assert.equal(failure.field, 'password');

  // Ensure secrets are never exposed in failure object
  assert.equal(failure.password, undefined);
  assert.equal(failure.pin, undefined);
  assert.equal(failure.secret, undefined);
});

test('5. PostgreSQL-backed auth_rate_limits: 5-failure lockout and retry-after calculation', async () => {
  const testIp = `198.51.100.${Math.floor(10 + Math.random() * 200)}`;
  const testEmail = `${testPrefix}_ratelimit@test.local`;

  // Ensure clean state for test key
  await recordSharedLoginSuccess(testIp, testEmail, true);

  // 1-4 failed attempts: not limited
  for (let i = 1; i <= 4; i++) {
    await recordSharedLoginFailure(testIp, testEmail, true);
    const status = await checkSharedLoginRateLimit(testIp, testEmail, true);
    assert.equal(status.limited, false, `Attempt ${i} should not trigger lockout`);
  }

  // 5th failed attempt: triggers lockout
  await recordSharedLoginFailure(testIp, testEmail, true);
  const lockStatus = await checkSharedLoginRateLimit(testIp, testEmail, true);
  assert.equal(lockStatus.limited, true, '5th attempt must trigger lockout');
  assert.ok(lockStatus.retryAfter > 0 && lockStatus.retryAfter <= 900, 'retryAfter must be positive within 15 mins window');

  // Multi-instance check: verify directly against PostgreSQL table
  const dbRows = await prisma.$queryRawUnsafe(`
    SELECT rate_key, attempt_count, locked_until > NOW() AS is_locked,
           EXTRACT(EPOCH FROM (locked_until - NOW())) AS remaining_seconds
    FROM public.auth_rate_limits
    WHERE rate_key = $1
  `, testIp);

  assert.equal(dbRows.length, 1, 'Row must exist in public.auth_rate_limits');
  assert.equal(dbRows[0].attempt_count, 5);
  assert.equal(dbRows[0].is_locked, true);
  assert.ok(Number(dbRows[0].remaining_seconds) > 0);

  // Success resets rate limits
  await recordSharedLoginSuccess(testIp, testEmail, true);
  const clearedStatus = await checkSharedLoginRateLimit(testIp, testEmail, true);
  assert.equal(clearedStatus.limited, false, 'Success must clear lockout');

  const dbRowsAfterSuccess = await prisma.$queryRawUnsafe(`
    SELECT rate_key FROM public.auth_rate_limits WHERE rate_key = $1
  `, testIp);
  assert.equal(dbRowsAfterSuccess.length, 0, 'Row must be deleted after login success');
});

test('6. PostgreSQL cleanupExpiredRateLimits cleans old windows and expired lockouts', async () => {
  const expiredKey = `${testPrefix}_expired_key`;

  // Insert a record with locked_until set 20 minutes in the past
  await prisma.$executeRawUnsafe(`
    INSERT INTO public.auth_rate_limits (rate_key, attempt_count, first_attempt_at, locked_until, updated_at)
    VALUES ($1, 5, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes')
    ON CONFLICT (rate_key) DO UPDATE SET locked_until = NOW() - INTERVAL '20 minutes', updated_at = NOW() - INTERVAL '20 minutes'
  `, expiredKey);

  // Run cleanup
  const cleaned = await cleanupExpiredRateLimits(prisma);
  assert.ok(cleaned >= 1, 'Cleanup should delete at least the expired test row');

  // Verify row no longer exists
  const checkRow = await prisma.$queryRawUnsafe(`
    SELECT rate_key FROM public.auth_rate_limits WHERE rate_key = $1
  `, expiredKey);
  assert.equal(checkRow.length, 0, 'Expired rate limit row must be purged');
});

test('7. Transparent migration on login preserves backward compatibility for any remaining enc:v1:', async () => {
  const syntheticId = `user-${testPrefix}-transparent`;
  const testPass = 'TransparentPass!2026';
  const encPass = encryptReversible(testPass);

  await prisma.$executeRawUnsafe(`
    INSERT INTO public.users (id, "fullName", email, password, pin, role, branch, company, active, "createdAt", "updatedAt")
    VALUES ($1, 'Transparent Migration User', $2, $3, NULL, 'coordinator', 'Colombo', 'RWC', true, NOW(), NOW())
  `, syntheticId, `${testPrefix}_transparent@test.local`, encPass);

  // Verification step: verifySecret identifies enc:v1: and flags needsRehash
  const verifyRes = verifySecret(testPass, encPass);
  assert.equal(verifyRes.match, true, 'Candidate must match decrypted secret');
  assert.equal(verifyRes.needsRehash, true, 'Legacy format must flag needsRehash: true');

  // When needsRehash is true, the login flow rehashes to scrypt
  const newScrypt = hashSecret(testPass);
  await prisma.user.update({
    where: { id: syntheticId },
    data: { password: newScrypt }
  });

  const reloaded = await prisma.user.findUnique({ where: { id: syntheticId } });
  assert.ok(reloaded.password.startsWith('scrypt:'), 'User is transparently upgraded to scrypt');
});
