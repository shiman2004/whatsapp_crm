/**
 * Controlled Remediation Procedure for Privileged Accounts
 *
 * Requirements:
 * 1. Identify potentially affected privileged accounts (e.g., matching known default secrets or legacy enc formats).
 * 2. Support secure password/PIN resets with scrypt hashing.
 * 3. Revoke existing authentication sessions and increment session_version (invalidating bearer tokens across HTTP and Socket.IO).
 * 4. Preserve audit history without logging passwords or token values.
 * 5. Production rollout protection: dry-run by default; explicit confirmation required for mutations.
 *
 * Usage:
 *   node scripts/remediate-privileged-credentials.js [--dry-run] [--apply] [--confirm-production]
 */

import crypto from 'node:crypto';
import { getPrisma } from '../src/db.js';
import { hashSecret, verifySecret, isValidCredentialHash } from '../src/secretHash.js';
import { auditSecurityEvent } from '../src/securityAudit.js';

// Known legacy and default secrets that were previously accepted by fallback verifiers
const KNOWN_DEFAULT_SECRETS = Object.freeze([
  'admin',
  '1234',
  'staff',
  '2026',
  '7777',
  '5226',
  '8722',
  '3488',
  '9312'
]);

/**
 * Scan database for privileged accounts and assess credential exposure.
 * Does NOT mutate database records. Never exposes secret strings.
 */
export async function identifyAffectedPrivilegedAccounts(prismaClient = null) {
  const prisma = prismaClient || getPrisma();
  if (!prisma) {
    throw new Error('Database client unavailable. Ensure DATABASE_URL is set.');
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      password: true,
      pin: true,
      active: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });

  const affectedAccounts = [];
  const secureAccounts = [];

  for (const user of users) {
    const isPrivileged = ['super_admin', 'leads_officer', 'coordinator', 'exam_department_manager'].includes(user.role);
    if (!isPrivileged) continue;

    const reasons = [];

    // Check password
    if (!user.password || !isValidCredentialHash(user.password)) {
      reasons.push('MISSING_OR_INVALID_PASSWORD_HASH');
    } else {
      for (const known of KNOWN_DEFAULT_SECRETS) {
        if (verifySecret(known, user.password).match) {
          reasons.push(`PASSWORD_MATCHES_KNOWN_DEFAULT`);
          break;
        }
      }
      if (user.password.startsWith('enc:v1:')) {
        reasons.push('REVERSIBLE_ENCRYPTION_NEEDS_UPGRADE');
      }
    }

    // Check PIN
    if (!user.pin || !isValidCredentialHash(user.pin)) {
      reasons.push('MISSING_OR_INVALID_PIN_HASH');
    } else {
      for (const known of KNOWN_DEFAULT_SECRETS) {
        if (verifySecret(known, user.pin).match) {
          reasons.push(`PIN_MATCHES_KNOWN_DEFAULT`);
          break;
        }
      }
      if (user.pin.startsWith('enc:v1:')) {
        reasons.push('PIN_REVERSIBLE_ENCRYPTION_NEEDS_UPGRADE');
      }
    }

    const assessment = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      active: user.active,
      reasons,
      requiresRemediation: reasons.length > 0
    };

    if (assessment.requiresRemediation) {
      affectedAccounts.push(assessment);
    } else {
      secureAccounts.push(assessment);
    }
  }

  return {
    totalPrivilegedScanned: affectedAccounts.length + secureAccounts.length,
    affectedCount: affectedAccounts.length,
    secureCount: secureAccounts.length,
    affectedAccounts,
    secureAccounts
  };
}

/**
 * Executes credential reset and session revocation for specified accounts.
 *
 * @param {Object} options
 * @param {boolean} [options.dryRun=true]
 * @param {boolean} [options.confirmProduction=false]
 * @param {string[]} [options.accountIds] List of user IDs to remediate. If omitted, remediates all affected.
 * @param {PrismaClient} [options.prismaClient]
 * @param {string} [options.actorId='remediation-script']
 */
export async function remediatePrivilegedAccounts(options = {}) {
  const dryRun = options.dryRun !== false;
  const confirmProduction = Boolean(options.confirmProduction);
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !dryRun && !confirmProduction) {
    throw new Error('PRODUCTION SAFETY GUARD: Explicit confirmProduction=true is required to execute credential resets in production.');
  }

  const prisma = options.prismaClient || getPrisma();
  if (!prisma) {
    throw new Error('Database client unavailable.');
  }

  const scan = await identifyAffectedPrivilegedAccounts(prisma);
  const targetIds = options.accountIds || scan.affectedAccounts.map(a => a.id);
  const targets = scan.affectedAccounts.filter(a => targetIds.includes(a.id));

  const results = {
    mode: dryRun ? 'dry-run' : 'apply',
    targetedCount: targets.length,
    remediatedAccounts: [],
    errors: []
  };

  for (const account of targets) {
    try {
      if (dryRun) {
        results.remediatedAccounts.push({
          id: account.id,
          email: account.email,
          role: account.role,
          reasons: account.reasons,
          action: 'WOULD_RESET_CREDENTIALS_AND_REVOKE_SESSIONS'
        });
        continue;
      }

      // Generate secure high-entropy random password (32 hex bytes = 64 chars) and PIN (8 random digits)
      const freshPassword = crypto.randomBytes(24).toString('base64url');
      const freshPin = String(Math.floor(10000000 + Math.random() * 90000000));

      const newPasswordHash = hashSecret(freshPassword);
      const newPinHash = hashSecret(freshPin);

      // Atomic update of user credentials + session_version bump
      await prisma.$executeRawUnsafe(
        `UPDATE public.users 
            SET password = $1, 
                pin = $2, 
                session_version = session_version + 1,
                "updatedAt" = NOW() 
          WHERE id = $3`,
        newPasswordHash,
        newPinHash,
        account.id
      );

      // Invalidate all active user sessions in database
      await prisma.$executeRawUnsafe(
        `UPDATE public.user_sessions
            SET revoked_at = NOW(),
                revoked_by = $2,
                revoke_reason = 'Privileged credential security remediation'
          WHERE user_id = $1 AND revoked_at IS NULL`,
        account.id,
        options.actorId || 'system-remediation'
      );

      // Audit the remediation event without logging credentials or token values
      await auditSecurityEvent({
        correlationId: crypto.randomUUID(),
        actorId: options.actorId || 'system-remediation',
        action: 'user.security_remediation',
        resource: `user:${account.id}`,
        outcome: 'success',
        metadata: {
          role: account.role,
          reasons: account.reasons,
          sessionsRevoked: true,
          sessionVersionIncremented: true
        }
      });

      results.remediatedAccounts.push({
        id: account.id,
        email: account.email,
        role: account.role,
        reasons: account.reasons,
        action: 'CREDENTIALS_RESET_AND_SESSIONS_REVOKED',
        // Ephemeral credentials delivered securely for administrative re-distribution
        temporaryCredentials: {
          password: freshPassword,
          pin: freshPin
        }
      });
    } catch (err) {
      results.errors.push({
        id: account.id,
        email: account.email,
        error: err.message
      });
    }
  }

  return results;
}

// CLI Execution entry point
if (process.argv[1] && process.argv[1].endsWith('remediate-privileged-credentials.js')) {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const confirmProd = args.includes('--confirm-production');

  console.log('🔒 Privileged Account Credential & Session Remediation Tool');
  console.log(`   Mode: ${isApply ? 'APPLY' : 'DRY-RUN (Inspection only)'}\n`);

  try {
    const scan = await identifyAffectedPrivilegedAccounts();
    console.log(`📊 Scanned ${scan.totalPrivilegedScanned} privileged accounts:`);
    console.log(`   - Affected / exposed accounts: ${scan.affectedCount}`);
    console.log(`   - Secure accounts: ${scan.secureCount}\n`);

    if (scan.affectedAccounts.length > 0) {
      console.log('⚠️  Affected Accounts:');
      for (const a of scan.affectedAccounts) {
        console.log(`   • [${a.role}] ${a.email} (${a.id}) - Findings: ${a.reasons.join(', ')}`);
      }
      console.log('');
    }

    if (isApply) {
      console.log('⚡ Executing remediation...');
      const result = await remediatePrivilegedAccounts({
        dryRun: false,
        confirmProduction: confirmProd
      });
      console.log(`✅ Remediated ${result.remediatedAccounts.length} accounts.`);
      if (result.errors.length > 0) {
        console.error('❌ Errors encountered:', result.errors);
      }
    } else {
      console.log('ℹ️  To apply remediation and rotate credentials, run with --apply [--confirm-production]');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Remediation error:', err.message);
    process.exit(1);
  }
}
