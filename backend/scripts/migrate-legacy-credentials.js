import { getPrisma } from '../src/db.js';
import { decryptReversible, hashSecret, verifySecret } from '../src/secretHash.js';

/**
 * Migration utility for converting legacy reversible encrypted (`enc:v1:`) credentials
 * into modern salted one-way scrypt hashes (`scrypt:salt:hash`).
 */

export async function verifyCredentialFormats(prismaClient) {
  const prisma = prismaClient || getPrisma();
  if (!prisma) {
    throw new Error('Database connection not available. Check DATABASE_URL in environment.');
  }

  try {
    const users = await prisma.user.findMany({
    select: { id: true, email: true, fullName: true, role: true, password: true, pin: true }
  });

    const report = {
      totalUsers: users.length,
      passwordStats: { scrypt: 0, encV1: 0, empty: 0, unrecognized: 0 },
      pinStats: { scrypt: 0, encV1: 0, empty: 0, unrecognized: 0 },
      legacyRecords: [],
      unrecognizedRecords: [],
    };

    for (const u of users) {
      let hasLegacy = false;
      let hasUnrecognized = false;

      // Inspect Password
      if (!u.password) {
        report.passwordStats.empty++;
      } else if (u.password.startsWith('scrypt:')) {
        report.passwordStats.scrypt++;
      } else if (u.password.startsWith('enc:v1:')) {
        report.passwordStats.encV1++;
        hasLegacy = true;
      } else {
        report.passwordStats.unrecognized++;
        hasUnrecognized = true;
      }

      // Inspect PIN
      if (!u.pin) {
        report.pinStats.empty++;
      } else if (u.pin.startsWith('scrypt:')) {
        report.pinStats.scrypt++;
      } else if (u.pin.startsWith('enc:v1:')) {
        report.pinStats.encV1++;
        hasLegacy = true;
      } else {
        report.pinStats.unrecognized++;
        hasUnrecognized = true;
      }

      if (hasLegacy) {
        report.legacyRecords.push({
          id: u.id,
          email: u.email,
          role: u.role,
          hasLegacyPassword: Boolean(u.password?.startsWith('enc:v1:')),
          hasLegacyPin: Boolean(u.pin?.startsWith('enc:v1:')),
        });
      }

      if (hasUnrecognized) {
        report.unrecognizedRecords.push({
          id: u.id,
          email: u.email,
          role: u.role,
        });
      }
    }

    return report;
  } finally {
    // If external caller didn't pass client, db.js manages lifecycle
  }
}

/**
 * Safely migrate legacy `enc:v1:` credentials to salted `scrypt:`.
 *
 * @param {Object} options
 * @param {boolean} [options.dryRun=true] - If true, evaluates without database mutations.
 * @param {PrismaClient} [options.prismaClient] - Optional injected Prisma client.
 * @param {boolean} [options.confirmProduction=false] - Explicit flag required if NODE_ENV===production.
 * @returns {Promise<Object>} Aggregate summary of migration results.
 */
export async function migrateLegacyCredentials(options = {}) {
  const dryRun = options.dryRun !== false; // default true for safety
  const confirmProduction = Boolean(options.confirmProduction);
  const prisma = options.prismaClient || getPrisma();
  if (!prisma) {
    throw new Error('Database connection not available. Check DATABASE_URL in environment.');
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !dryRun && !confirmProduction) {
    throw new Error(
      'PRODUCTION SAFETY GUARD: Explicit --confirm-production flag is required to apply credential migration in production.'
    );
  }

  const startTime = Date.now();
  const summary = {
    mode: dryRun ? 'dry-run' : 'apply',
    scanned: 0,
    legacyFound: 0,
    passwordsMigrated: 0,
    pinsMigrated: 0,
    concurrencyConflicts: 0,
    failures: [],
    migratedUsers: [],
    durationMs: 0,
  };

  try {
    // 1. Query records containing enc:v1: in password or pin
    const legacyUsers = await prisma.$queryRawUnsafe(`
      SELECT id, email, role, password, pin
      FROM public.users
      WHERE password LIKE 'enc:v1:%' OR pin LIKE 'enc:v1:%'
      ORDER BY "createdAt" ASC
    `);

    summary.legacyFound = legacyUsers.length;
    summary.scanned = legacyUsers.length;

    for (const row of legacyUsers) {
      const userRef = { id: row.id, email: row.email, role: row.role };
      let userUpdated = false;

      // Handle password migration
      if (row.password && row.password.startsWith('enc:v1:')) {
        const plainPassword = decryptReversible(row.password);
        if (plainPassword === null) {
          summary.failures.push({
            ...userRef,
            field: 'password',
            reason: 'DECRYPTION_FAILED',
            remedy: 'Account password must be reset by Super Admin or via password reset token.'
          });
        } else {
          const newPasswordHash = hashSecret(plainPassword);
          // Verify newly computed hash before writing
          const testVerify = verifySecret(plainPassword, newPasswordHash);
          if (!testVerify.match) {
            summary.failures.push({
              ...userRef,
              field: 'password',
              reason: 'HASH_VERIFICATION_FAILED',
              remedy: 'Computed scrypt hash did not match decrypted candidate. Record untouched.'
            });
          } else if (!dryRun) {
            // Conditional atomic update: only update if password has not changed concurrently
            const updatedRows = await prisma.$executeRawUnsafe(`
              UPDATE public.users
              SET password = $1, "updatedAt" = NOW()
              WHERE id = $2 AND password = $3
            `, newPasswordHash, row.id, row.password);

            if (updatedRows > 0) {
              summary.passwordsMigrated++;
              userUpdated = true;
            } else {
              summary.concurrencyConflicts++;
            }
          } else {
            // Dry run
            summary.passwordsMigrated++;
            userUpdated = true;
          }
        }
      }

      // Handle PIN migration
      if (row.pin && row.pin.startsWith('enc:v1:')) {
        const plainPin = decryptReversible(row.pin);
        if (plainPin === null) {
          summary.failures.push({
            ...userRef,
            field: 'pin',
            reason: 'DECRYPTION_FAILED',
            remedy: 'Account PIN must be reset by Super Admin.'
          });
        } else {
          const newPinHash = hashSecret(plainPin);
          // Verify newly computed hash before writing
          const testVerify = verifySecret(plainPin, newPinHash);
          if (!testVerify.match) {
            summary.failures.push({
              ...userRef,
              field: 'pin',
              reason: 'HASH_VERIFICATION_FAILED',
              remedy: 'Computed scrypt hash did not match decrypted candidate. Record untouched.'
            });
          } else if (!dryRun) {
            // Conditional atomic update: only update if pin has not changed concurrently
            const updatedRows = await prisma.$executeRawUnsafe(`
              UPDATE public.users
              SET pin = $1, "updatedAt" = NOW()
              WHERE id = $2 AND pin = $3
            `, newPinHash, row.id, row.pin);

            if (updatedRows > 0) {
              summary.pinsMigrated++;
              userUpdated = true;
            } else {
              summary.concurrencyConflicts++;
            }
          } else {
            // Dry run
            summary.pinsMigrated++;
            userUpdated = true;
          }
        }
      }

      if (userUpdated) {
        summary.migratedUsers.push(userRef);
      }
    }

    summary.durationMs = Date.now() - startTime;
    return summary;
  } finally {
    // getPrisma manages client lifecycle
  }
}

import path from 'path';
import { fileURLToPath } from 'url';

// CLI runner when executed directly
const isDirectCli = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isDirectCli) {
  const args = process.argv.slice(2);
  const isVerify = args.includes('--verify');
  const isApply = args.includes('--apply');
  const isConfirmProd = args.includes('--confirm-production');

  (async () => {
    try {
      if (isVerify) {
        console.log('🔍 [Credential Audit] Verifying credential formats in database...');
        const report = await verifyCredentialFormats();
        console.log('\n--- Credential Verification Report ---');
        console.log(`Total Users: ${report.totalUsers}`);
        console.log(`Passwords: ${report.passwordStats.scrypt} scrypt, ${report.passwordStats.encV1} enc:v1, ${report.passwordStats.empty} empty, ${report.passwordStats.unrecognized} unrecognized`);
        console.log(`PINs:      ${report.pinStats.scrypt} scrypt, ${report.pinStats.encV1} enc:v1, ${report.pinStats.empty} empty, ${report.pinStats.unrecognized} unrecognized`);
        if (report.legacyRecords.length > 0) {
          console.log(`\nLegacy records requiring migration (${report.legacyRecords.length}):`);
          report.legacyRecords.forEach(r => console.log(`  - [${r.role}] ${r.email} (id: ${r.id})`));
        } else {
          console.log('\n✅ No legacy enc:v1: records detected.');
        }
        process.exit(0);
      }

      const dryRun = !isApply;
      console.log(`⚙️ [Credential Migration] Starting in ${dryRun ? 'DRY-RUN' : 'APPLY'} mode...`);
      const summary = await migrateLegacyCredentials({ dryRun, confirmProduction: isConfirmProd });

      console.log('\n--- Migration Summary ---');
      console.log(`Mode:                  ${summary.mode}`);
      console.log(`Legacy records found:  ${summary.legacyFound}`);
      console.log(`Passwords migrated:    ${summary.passwordsMigrated}`);
      console.log(`PINs migrated:         ${summary.pinsMigrated}`);
      console.log(`Concurrency conflicts: ${summary.concurrencyConflicts}`);
      console.log(`Failures:              ${summary.failures.length}`);
      console.log(`Duration:              ${summary.durationMs}ms`);

      if (summary.failures.length > 0) {
        console.warn('\n⚠️ Migration Failures (Requires Admin Reset):');
        summary.failures.forEach(f => console.warn(`  - [${f.email}] ${f.field}: ${f.reason} -> ${f.remedy}`));
      }

      if (dryRun && summary.legacyFound > 0) {
        console.log('\nℹ️ This was a dry run. To execute migration, run:');
        console.log('   node backend/scripts/migrate-legacy-credentials.js --apply');
      } else if (!dryRun) {
        console.log('\n✅ Migration completed successfully.');
      }
      process.exit(0);
    } catch (err) {
      console.error('\n❌ Migration error:', err.message);
      process.exit(1);
    }
  })();
}
