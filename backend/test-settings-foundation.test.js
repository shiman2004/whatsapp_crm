import assert from 'assert';
import http from 'http';
import { server, signAuthToken } from './server.js';
import { checkDbConnection, getPrisma } from './src/db.js';

console.log('🧪 Starting System Settings Foundation Test Suite...\n');

const testPort = 5999;
let baseUrl;

async function runTests() {
  await checkDbConnection();
  const prisma = getPrisma();
  if (!prisma) {
    console.error('Database connection failed');
    process.exit(1);
  }

  // Ensure test users exist in test DB
  await prisma.user.upsert({
    where: { id: 'jahan-admin-id' },
    update: { role: 'super_admin', active: true },
    create: {
      id: 'jahan-admin-id',
      email: 'jahan@alphatsm.com',
      fullName: 'Mohamed Jahankeer',
      role: 'super_admin',
      active: true,
      company: 'RWC'
    }
  }).catch(() => {});

  await prisma.user.upsert({
    where: { id: 'test-coord-1' },
    update: { role: 'coordinator', active: true },
    create: {
      id: 'test-coord-1',
      email: 'coord1@test.com',
      fullName: 'Coordinator One',
      role: 'coordinator',
      active: true,
      company: 'RWC'
    }
  }).catch(() => {});

  // Tokens using real existing database user IDs
  const adminToken = signAuthToken({
    userId: 'jahan-admin-id',
    email: 'jahan@alphatsm.com',
    fullName: 'Mohamed Jahankeer',
    role: 'super_admin'
  });

  const coordinatorToken = signAuthToken({
    userId: 'test-coord-1',
    email: 'coord1@test.com',
    fullName: 'Coordinator One',
    role: 'coordinator'
  });

  // Start server
  await new Promise((resolve) => {
    server.listen(testPort, () => {
      baseUrl = `http://127.0.0.1:${testPort}`;
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // Test 1: Unauthenticated request to /api/settings/sections returns 401
    // -------------------------------------------------------------
    console.log('📦 SECTION 1: Authentication & RBAC Access Control');
    const resNoAuth = await fetch(`${baseUrl}/api/settings/sections`);
    assert.strictEqual(resNoAuth.status, 401, 'Unauthenticated request should return 401');
    console.log('  ✅ 1.1 Unauthenticated request rejected with 401 Unauthorized');

    // Test 2: Non-admin role (coordinator) returns 403 Forbidden
    const resForbidden = await fetch(`${baseUrl}/api/settings/sections`, {
      headers: { Authorization: `Bearer ${coordinatorToken}` }
    });
    assert.strictEqual(resForbidden.status, 403, 'Non-admin request should return 403');
    console.log('  ✅ 1.2 Non-admin coordinator rejected with 403 Forbidden');

    // Test 3: Super Admin gets 200 OK with 17 sections catalog
    const resCatalog = await fetch(`${baseUrl}/api/settings/sections`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(resCatalog.status, 200, 'Admin request should return 200 OK');
    const catalogData = await resCatalog.json();
    assert.strictEqual(catalogData.success, true);
    assert.strictEqual(catalogData.sections.length, 17, 'Should catalog all 17 modules');
    assert.strictEqual(
      catalogData.sections.find((section) => section.id === 'academic')?.label,
      'Exam Department',
      'Exam Department settings must appear in the Super Admin catalog'
    );
    console.log('  ✅ 1.3 Super Admin receives 200 OK with full 17-module catalog');

    // -------------------------------------------------------------
    // Test 2: Read Default Configuration
    // -------------------------------------------------------------
    console.log('\n📦 SECTION 2: Scoped Settings & Default Fallback');
    const resGetCompany = await fetch(`${baseUrl}/api/settings/company`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(resGetCompany.status, 200);
    const companyData = await resGetCompany.json();
    assert.strictEqual(companyData.success, true);
    assert.strictEqual(companyData.data.name, 'Alpha Health Group');
    assert.strictEqual(companyData.version, 1);
    console.log('  ✅ 2.1 Default company settings cleanly retrieved at version 1');

    // -------------------------------------------------------------
    // Test 3: Update Setting with Version Check (Optimistic Locking)
    // -------------------------------------------------------------
    console.log('\n📦 SECTION 3: Optimistic Locking & Audit Logging');
    const resUpdate = await fetch(`${baseUrl}/api/settings/company`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        version: 1,
        data: {
          ...companyData.data,
          name: 'Alpha Health Group International',
          currency: 'USD'
        }
      })
    });
    assert.strictEqual(resUpdate.status, 200);
    const updateResult = await resUpdate.json();
    assert.strictEqual(updateResult.version, 2, 'Version should increment to 2');
    assert.strictEqual(updateResult.data.name, 'Alpha Health Group International');
    console.log('  ✅ 3.1 Company setting updated successfully, bumping version to 2');

    // -------------------------------------------------------------
    // Test 4: Concurrency Conflict (Stale Version = 409 Conflict)
    // -------------------------------------------------------------
    const resConflict = await fetch(`${baseUrl}/api/settings/company`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        version: 1, // Stale version! Current version is now 2
        data: {
          ...companyData.data,
          name: 'Conflicting Overwrite Attempt'
        }
      })
    });
    assert.strictEqual(resConflict.status, 409, 'Stale version update must return 409 Conflict');
    const conflictData = await resConflict.json();
    assert.strictEqual(conflictData.error, 'VERSION_CONFLICT');
    assert.strictEqual(conflictData.currentVersion, 2);
    assert.strictEqual(conflictData.serverData.name, 'Alpha Health Group International');
    console.log('  ✅ 3.2 Stale version update rejected with 409 Conflict and server diff payload');

    // -------------------------------------------------------------
    // Test 5: Secret Encryption at Rest & Response Masking
    // -------------------------------------------------------------
    console.log('\n📦 SECTION 4: Zero-Knowledge Secret Encryption & Masking');
    const testSecret = 'super-secret-smtp-password-2026';
    const resSaveEmail = await fetch(`${baseUrl}/api/settings/email_notifications`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        version: 1,
        data: {
          smtpHost: 'smtp.sendgrid.net',
          smtpPort: 587,
          smtpUser: 'apikey',
          smtpPassword: testSecret,
          senderName: 'Alpha Health Group CRM',
          senderEmail: 'notifications@royalwellness.lk'
        }
      })
    });
    assert.strictEqual(resSaveEmail.status, 200);
    const emailResult = await resSaveEmail.json();
    assert.strictEqual(emailResult.data.smtpPassword, '••••••••', 'Response must mask secret');

    // Verify in database that secret is stored with enc:v1: AES-256-GCM encryption
    const dbRow = await prisma.systemSetting.findFirst({
      where: { section: 'email_notifications', scope: 'global' }
    });
    assert.ok(dbRow, 'DB row must exist');
    assert.ok(
      String(dbRow.payload.smtpPassword).startsWith('enc:v1:'),
      'Secret in database must be encrypted with AES-256-GCM enc:v1: prefix'
    );
    console.log('  ✅ 4.1 SMTP password encrypted with AES-256-GCM at rest and masked in API responses');

    // -------------------------------------------------------------
    // Test 6: Transactional Audit Log Entry
    // -------------------------------------------------------------
    console.log('\n📦 SECTION 5: Transaction-Bound Audit Log Verification');
    const resAudit = await fetch(`${baseUrl}/api/settings/audit-logs?section=company`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(resAudit.status, 200);
    const auditData = await resAudit.json();
    assert.ok(auditData.items.length > 0, 'Audit entries must be recorded');
    const latestAudit = auditData.items[0];
    assert.strictEqual(latestAudit.action, 'settings.update');
    assert.strictEqual(latestAudit.performedByName, 'Mohamed Jahankeer');
    console.log('  ✅ 5.1 Settings mutation created a transactional audit record with actor details');

    // -------------------------------------------------------------
    // Test 7: User-Scoped Preferences Endpoint
    // -------------------------------------------------------------
    console.log('\n📦 SECTION 6: User-Scoped Preferences');
    const resUserPref = await fetch(`${baseUrl}/api/users/me/preferences`, {
      headers: { Authorization: `Bearer ${coordinatorToken}` }
    });
    assert.strictEqual(resUserPref.status, 200);
    const userPrefData = await resUserPref.json();
    assert.strictEqual(userPrefData.success, true);

    const resUpdateUserPref = await fetch(`${baseUrl}/api/users/me/preferences`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({
        data: {
          theme: 'light',
          density: 'compact',
          language: 'ta',
          timezone: 'Asia/Colombo'
        }
      })
    });
    assert.strictEqual(resUpdateUserPref.status, 200);
    const updatedPref = await resUpdateUserPref.json();
    assert.strictEqual(updatedPref.data.language, 'ta');
    console.log('  ✅ 6.1 User preferences persisted under user-specific scope');

    console.log('\n🎉 ALL SETTINGS FOUNDATION TESTS PASSED CLEANLY!\n');
  } finally {
    // Cleanup test records
    await prisma.systemSetting.deleteMany({
      where: {
        section: { in: ['company', 'email_notifications', 'appearance'] }
      }
    }).catch(() => {});
    await prisma.auditLog.deleteMany({
      where: { entityType: 'SystemSetting' }
    }).catch(() => {});
    await prisma.$disconnect();
    server.close();
  }
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
