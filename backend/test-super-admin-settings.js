import assert from 'assert';
import http from 'http';
import { 
  server, 
  signAuthToken, 
  hashSecret 
} from './server.js';
import { checkDbConnection, getPrisma } from './src/db.js';

console.log('🧪 Starting Super Admin Settings & Dynamic Configuration Test Suite...\n');

const testPort = 5998;

// Resources created by this suite, removed in cleanup so repeated runs stay idempotent
// and never leave the live database with extra admins/stages.
const createdAdminEmails = [];
const createdStageIds = [];
const createdCatalogIds = [];
const deactivatedAdminIds = [];

async function cleanup() {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    if (createdAdminEmails.length) {
      await prisma.user.deleteMany({ where: { email: { in: createdAdminEmails } } });
    }
    if (createdStageIds.length) {
      // lead_stages is written through raw SQL in the API path; delete the rows directly by id.
      await prisma.$executeRawUnsafe(
        'DELETE FROM public.lead_stages WHERE id = ANY($1::text[])',
        createdStageIds
      ).catch(() => {});
    }
    if (deactivatedAdminIds.length) {
      await prisma.user.updateMany({ where: { id: { in: deactivatedAdminIds } }, data: { active: true } });
    }
    if (createdCatalogIds.length) {
      // Courses and treatments both live in public.treatments, keyed by an auto-generated id.
      await prisma.$executeRawUnsafe(
        'DELETE FROM public.treatments WHERE id = ANY($1::text[])',
        createdCatalogIds
      ).catch(() => {});
    }
    if (fixtureAdminIds.length) {
      await prisma.$executeRawUnsafe(
        'DELETE FROM public.users WHERE id = ANY($1::text[])',
        fixtureAdminIds
      ).catch(() => {});
    }
  } catch (cleanupErr) {
    console.warn('⚠️ Test cleanup warning:', cleanupErr.message);
  }
}

// Count active super admins straight from the database so the lockout-guard assertion
// reflects reality instead of assuming the test database has exactly one admin.
async function prismaUserCountActiveAdmins() {
  const prisma = getPrisma();
  if (!prisma) return 0;
  return prisma.user.count({ where: { role: 'super_admin', active: true } });
}

// Deterministic fixtures. The suite previously relied on the live database already
// containing the canonical Super Admins; on a freshly provisioned test database that is
// false, so the last-admin guard fired at the wrong moment and the lockout check then
// 404'd against a user id that only existed in memory. One fixture row is created with
// the SAME id the suite authenticates as (`user-admin-1`), so every assertion targets a
// real database record. It is removed in cleanup, making the suite independent of any
// pre-existing data.
const FIXTURE_ADMIN_ID = 'user-admin-1';
const FIXTURE_ADMIN_EMAIL = 'admin@royalwellness.lk';
const fixtureAdminIds = [FIXTURE_ADMIN_ID];

async function ensureFixtureAdmins() {
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.$executeRawUnsafe(
    `INSERT INTO users (id, "fullName", email, role, active, "createdAt", "updatedAt")
     VALUES ($1, 'Jahan', $2, 'super_admin', true, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET active = true, role = 'super_admin', "updatedAt" = NOW()`,
    FIXTURE_ADMIN_ID,
    FIXTURE_ADMIN_EMAIL
  );
}

async function runTests() {
  await checkDbConnection();
  await ensureFixtureAdmins();
  await new Promise(resolve => server.listen(testPort, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${testPort}`;

  // Tokens
  const adminToken = signAuthToken({
    userId: 'user-admin-1',
    email: 'admin@royalwellness.lk',
    role: 'super_admin',
    fullName: 'Super Admin'
  });

  const coordinatorToken = signAuthToken({
    userId: 'user-faiha-1',
    email: 'faiha@royalwellness.lk',
    role: 'coordinator',
    fullName: 'Faiha'
  });

  const officerToken = signAuthToken({
    userId: 'user-officer-1',
    email: 'sarah@royalwellness.lk',
    role: 'leads_officer',
    fullName: 'Sarah Fernando'
  });

  try {
    // =========================================================================
    // 1. PUBLIC READ-ONLY CATALOGS
    // =========================================================================
    console.log('--- Test Group 1: Public Read-Only Catalogs ---');
    const resStages = await fetch(`${baseUrl}/api/stages`);
    assert.strictEqual(resStages.status, 200, 'GET /api/stages should be 200 OK');
    const stagesData = await resStages.json();
    assert(stagesData.stages && stagesData.stages.length >= 7, 'Must return initial lead stages');
    console.log('  ✅ 1.1 GET /api/stages returns configured stages without auth header');

    const resCourses = await fetch(`${baseUrl}/api/courses`);
    assert.strictEqual(resCourses.status, 200, 'GET /api/courses should be 200 OK');
    const coursesData = await resCourses.json();
    assert(coursesData.courses && coursesData.courses.length > 0, 'Must return courses');
    console.log('  ✅ 1.2 GET /api/courses returns active courses');

    const resTreatments = await fetch(`${baseUrl}/api/treatments`);
    assert.strictEqual(resTreatments.status, 200, 'GET /api/treatments should be 200 OK');
    console.log('  ✅ 1.3 GET /api/treatments returns active treatments');

    // =========================================================================
    // 2. STRICT RBAC ACCESS CONTROL (NON-ADMINS REJECTED 403)
    // =========================================================================
    console.log('\n--- Test Group 2: Non-Super Admin Access Rejection (403 Forbidden) ---');

    // Coordinator attempting course creation
    const resCoordCourse = await fetch(`${baseUrl}/api/admin/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({ name: 'Hacked Course', code: 'HCK' })
    });
    assert.strictEqual(resCoordCourse.status, 403, 'Coordinator must be rejected with 403');
    console.log('  ✅ 2.1 Coordinator rejected from creating courses (403)');

    // Leads Officer attempting stage creation
    const resOfficerStage = await fetch(`${baseUrl}/api/admin/stages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      },
      body: JSON.stringify({ key: 'fake_stage', label: 'Fake' })
    });
    assert.strictEqual(resOfficerStage.status, 403, 'Leads Officer must be rejected with 403');
    console.log('  ✅ 2.2 Leads Officer rejected from creating stages (403)');

    // Coordinator attempting Super Admin creation
    const resCoordAdmin = await fetch(`${baseUrl}/api/admin/super-admins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({ fullName: 'Rogue Admin', email: 'rogue@crm.lk' })
    });
    assert.strictEqual(resCoordAdmin.status, 403, 'Coordinator rejected from creating Super Admin (403)');
    console.log('  ✅ 2.3 Coordinator rejected from creating Super Admins (403)');

    // =========================================================================
    // 3. COURSE MANAGEMENT (ADD, DUPLICATE CHECK, EDIT, TOGGLE)
    // =========================================================================
    console.log('\n--- Test Group 3: Course Management (CRAS) ---');

    // Full timestamp keeps the generated code unique across runs; the last-4-digits form
    // collided whenever two runs landed on the same trailing millisecond digits.
    const stamp = Date.now().toString();
    const testCourseCode = 'TC' + stamp.slice(-9);
    const testCourseName = 'Clinical Cosmetology Diploma ' + stamp;
    const resAddCourse = await fetch(`${baseUrl}/api/admin/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: testCourseName,
        code: testCourseCode,
        durationMinutes: 120,
        startingPrice: 150000,
        description: 'Comprehensive aesthetic dermatology training'
      })
    });
    const addCourseText = await resAddCourse.text();
    if (resAddCourse.status !== 200 && resAddCourse.status !== 201) {
      console.error('Course add failed with body:', addCourseText);
    }
    assert([200, 201].includes(resAddCourse.status), `Course creation must succeed, got ${resAddCourse.status}: ${addCourseText}`);
    const addCourseData = JSON.parse(addCourseText);
    const createdCourseId = addCourseData.course?.id;
    if (createdCourseId) createdCatalogIds.push(createdCourseId);
    console.log(`  ✅ 3.1 Super Admin creates course: ${addCourseData.course?.name} (${testCourseCode})`);

    // Duplicate check
    const resDupCourse = await fetch(`${baseUrl}/api/admin/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: testCourseName,
        code: testCourseCode
      })
    });
    assert.strictEqual(resDupCourse.status, 409, 'Duplicate course must be rejected with 409 Conflict');
    console.log('  ✅ 3.2 Duplicate course code/name strictly rejected with 409 Conflict');

    // Toggle status
    if (createdCourseId) {
      const resToggleCourse = await fetch(`${baseUrl}/api/admin/courses/${createdCourseId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ active: false })
      });
      assert.strictEqual(resToggleCourse.status, 200, 'Course toggle should succeed');
      const toggleData = await resToggleCourse.json();
      assert.strictEqual(toggleData.course?.active, false, 'Course should be deactivated');
      console.log('  ✅ 3.3 Soft deactivation of course succeeds (preserves historical references)');
    }

    // =========================================================================
    // 4. TREATMENT MANAGEMENT (ADD, DUPLICATE CHECK, EDIT, TOGGLE)
    // =========================================================================
    console.log('\n--- Test Group 4: Treatment Management (RWC) ---');

    const testTrtCode = 'TT' + Date.now().toString().slice(-9);
    const testTrtName = 'Ozone Scalp Revitalization ' + Date.now();
    const resAddTrt = await fetch(`${baseUrl}/api/admin/treatments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: testTrtName,
        code: testTrtCode,
        categoryId: 'cat-hair-care',
        startingPrice: 35000,
        durationMinutes: 60,
        description: 'Advanced scalp oxygenation and nutrient delivery'
      })
    });
    assert([200, 201].includes(resAddTrt.status), `Treatment creation must succeed, got ${resAddTrt.status}`);
    const addTrtData = await resAddTrt.json();
    const createdTrtId = addTrtData.treatment?.id;
    if (createdTrtId) createdCatalogIds.push(createdTrtId);
    console.log(`  ✅ 4.1 Super Admin creates clinical treatment: ${addTrtData.treatment?.name} (${testTrtCode})`);

    // Duplicate check
    const resDupTrt = await fetch(`${baseUrl}/api/admin/treatments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: testTrtName,
        code: testTrtCode
      })
    });
    assert.strictEqual(resDupTrt.status, 409, 'Duplicate treatment must be rejected with 409 Conflict');
    console.log('  ✅ 4.2 Duplicate treatment code/name strictly rejected with 409 Conflict');

    // Toggle status
    if (createdTrtId) {
      const resToggleTrt = await fetch(`${baseUrl}/api/admin/treatments/${createdTrtId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ active: false })
      });
      assert.strictEqual(resToggleTrt.status, 200, 'Treatment toggle should succeed');
      const toggleTrtData = await resToggleTrt.json();
      assert.strictEqual(toggleTrtData.treatment?.active, false, 'Treatment should be deactivated');
      console.log('  ✅ 4.3 Soft deactivation of treatment succeeds (preserves historical inquiries)');
    }

    // =========================================================================
    // 5. LEAD STAGE MANAGEMENT & SYSTEM PROTECTION
    // =========================================================================
    console.log('\n--- Test Group 5: Lead Stage Management & System Protection ---');

    const testStageKey = `med_rev_${Date.now()}`;
    const testStageLabel = `Medical Review ${Date.now().toString().slice(-4)}`;
    const resAddStage = await fetch(`${baseUrl}/api/admin/stages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        key: testStageKey,
        label: testStageLabel,
        description: 'Case undergoing senior consultant trichologist review',
        color: 'indigo'
      })
    });
    assert([200, 201].includes(resAddStage.status), `Stage creation should succeed, got ${resAddStage.status}`);
    const addStageData = await resAddStage.json();
    const createdStageId = addStageData.stage?.id;
    if (createdStageId) createdStageIds.push(createdStageId);
    console.log(`  ✅ 5.1 Super Admin creates custom stage: ${addStageData.stage?.label}`);

    // Reorder stages
    const resReorder = await fetch(`${baseUrl}/api/admin/stages/reorder`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        stageIds: ['stage-new', 'stage-assigned', 'stage-contacted', createdStageId].filter(Boolean)
      })
    });
    assert.strictEqual(resReorder.status, 200, 'Stage reordering should succeed');
    console.log('  ✅ 5.2 Stage display order updated successfully');

    // System Stage Protection: Attempting to deactivate 'new' stage must fail
    const resBlockDeactivate = await fetch(`${baseUrl}/api/admin/stages/stage-new/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ active: false })
    });
    assert.strictEqual(resBlockDeactivate.status, 400, 'System stage deactivation must be rejected with 400');
    const blockData = await resBlockDeactivate.json();
    assert(blockData.error.includes('System-required stage'), 'Must explain system stage protection');
    console.log('  ✅ 5.3 Protected system-required stage (new) cannot be deactivated');

    // Deactivating custom stage succeeds
    if (createdStageId) {
      const resToggleCustom = await fetch(`${baseUrl}/api/admin/stages/${createdStageId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ active: false })
      });
      assert.strictEqual(resToggleCustom.status, 200, 'Custom stage deactivation must succeed');
      console.log('  ✅ 5.4 Custom stage can be deactivated safely');
    }

    // =========================================================================
    // 6. SUPER ADMIN ACCOUNT CREATION & LAST ADMIN GUARD
    // =========================================================================
    console.log('\n--- Test Group 6: Super Admin Management & Last Admin Guard ---');

    // List Super Admins
    const resListAdmins = await fetch(`${baseUrl}/api/admin/super-admins`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(resListAdmins.status, 200, 'Listing super admins should succeed');
    const listData = await resListAdmins.json();
    assert(listData.superAdmins && listData.superAdmins.length >= 1, 'Must have at least one super admin');
    console.log(`  ✅ 6.1 Super Admin accounts listed: ${listData.superAdmins.length} active admins`);

    // Create a 2nd Super Admin
    const secondAdminEmail = `admin_test_${Date.now()}@royalwellness.lk`;
    createdAdminEmails.push(secondAdminEmail);
    const resCreateAdmin2 = await fetch(`${baseUrl}/api/admin/super-admins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        fullName: 'Executive Director Admin',
        email: secondAdminEmail,
        password: 'secureadminpassword2026',
        pin: '8899',
        branch: 'Colombo (Head Office)'
      })
    });
    assert([200, 201].includes(resCreateAdmin2.status), `Admin creation should succeed, got ${resCreateAdmin2.status}`);
    const admin2Data = await resCreateAdmin2.json();
    const admin2Id = admin2Data.superAdmin?.id;
    console.log(`  ✅ 6.2 Second Super Admin created: ${admin2Data.superAdmin?.fullName} (${secondAdminEmail})`);

    // Duplicate email rejection
    const resDupAdmin = await fetch(`${baseUrl}/api/admin/super-admins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        fullName: 'Clone Admin',
        email: secondAdminEmail
      })
    });
    assert.strictEqual(resDupAdmin.status, 409, 'Duplicate admin email must be rejected with 409');
    console.log('  ✅ 6.3 Duplicate Super Admin email rejected with 409 Conflict');

    // Edit Admin Name
    if (admin2Id) {
      const resEditAdmin = await fetch(`${baseUrl}/api/admin/super-admins/${admin2Id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ fullName: 'Executive Director Jahan' })
      });
      assert.strictEqual(resEditAdmin.status, 200, 'Editing admin name should succeed');
      const editAdminData = await resEditAdmin.json();
      assert.strictEqual(editAdminData.superAdmin?.fullName, 'Executive Director Jahan');
      console.log('  ✅ 6.4 Super Admin name edited and verified in CRM response');

      // Deactivate second admin
      const resDeactivate2 = await fetch(`${baseUrl}/api/admin/super-admins/${admin2Id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ active: false })
      });
      assert.strictEqual(resDeactivate2.status, 200, 'Deactivating secondary admin should succeed');
      deactivatedAdminIds.push(admin2Id);
      console.log('  ✅ 6.5 Secondary Super Admin deactivated successfully');
    }

    // Attempt to deactivate primary admin. The guard only applies while it is the LAST active
    // super admin, so assert against the real active count instead of assuming the test DB
    // happens to contain exactly one admin.
    const activeAdminCount = await prismaUserCountActiveAdmins();
    const resLastAdminBlock = await fetch(`${baseUrl}/api/admin/super-admins/user-admin-1`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ active: false })
    });
    if (activeAdminCount <= 1) {
      assert.strictEqual(resLastAdminBlock.status, 400, 'Deactivating last active Super Admin must be blocked with 400');
      const lastAdminData = await resLastAdminBlock.json();
      assert(lastAdminData.error.includes('Cannot deactivate the last active Super Admin account'), 'Must indicate lockout protection');
      console.log('  ✅ 6.6 Last Active Super Admin Lockout Guard successfully blocked account deactivation');
    } else {
      // More than one active admin exists, so deactivation is legitimately permitted.
      assert.strictEqual(resLastAdminBlock.status, 200, 'Deactivating a non-last admin should succeed');
      deactivatedAdminIds.push('user-admin-1');
      console.log(`  ⏭️  6.6 Lockout guard not exercised: ${activeAdminCount} active super admins exist (guard covers only the last one)`);
    }

    console.log('\n🎉 ALL SUPER ADMIN SETTINGS & DYNAMIC CONFIGURATION TESTS PASSED!\n');
    await cleanup();
    server.close();
    process.exit(0);
  } finally {
    server.close();
  }
}

runTests().catch(async err => {
  console.error('\n❌ Super Admin Settings Test Failed:', err);
  await cleanup().catch(() => {});
  server.close();
  process.exit(1);
});
