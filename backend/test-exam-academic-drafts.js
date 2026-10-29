import assert from 'node:assert/strict';
import { server, signAuthToken } from './server.js';
import { checkDbConnection, getPrisma, waitForSchemaBootstrap } from './src/db.js';

const PORT = 5995;
const suffix = Date.now().toString(36);

const MANAGER = { id: `exm-mgr-${suffix}`, email: `exm-mgr-${suffix}@test.local`, role: 'exam_department_manager', fullName: 'Head of Exam' };
const COORDINATOR = { id: `exm-coord-${suffix}`, email: `exm-coord-${suffix}@test.local`, role: 'exam_coordinator', fullName: 'Exam Coordinator' };
const OFFICER = { id: `exm-officer-${suffix}`, email: `exm-officer-${suffix}@test.local`, role: 'exam_providing_officer', fullName: 'Exam Officer' };
const NURSE = { id: `exm-nurse-${suffix}`, email: `exm-nurse-${suffix}@test.local`, role: 'clinical_nurse', fullName: 'Clinical Nurse' };
const USER_FIXTURES = [MANAGER, COORDINATOR, OFFICER, NURSE];

// The operational exam tables ship as reviewed SQL migrations, not Prisma models.
// Recreate the same shape here so the suite runs on the isolated Prisma database.
const EXAM_DDL = [
  `CREATE TABLE IF NOT EXISTS public.exam_courses (
     id VARCHAR(100) PRIMARY KEY, course_code VARCHAR(50) UNIQUE NOT NULL, course_name VARCHAR(255) NOT NULL,
     exam_authority VARCHAR(100) NOT NULL, profession VARCHAR(100) NOT NULL, country VARCHAR(100) DEFAULT 'UAE',
     description TEXT, thumbnail TEXT, status VARCHAR(50) DEFAULT 'Active', access_type VARCHAR(50) DEFAULT 'Free',
     created_by VARCHAR(100), reviewer_id VARCHAR(100), review_comments TEXT, published_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());`,
  `CREATE TABLE IF NOT EXISTS public.exam_study_materials (
     id VARCHAR(100) PRIMARY KEY, course_id VARCHAR(100), subject_id VARCHAR(100), topic VARCHAR(150),
     title VARCHAR(255) NOT NULL, description TEXT, material_type VARCHAR(50) DEFAULT 'PDF', file_url TEXT,
     external_url TEXT, thumbnail TEXT, allow_download BOOLEAN DEFAULT TRUE, status VARCHAR(50) DEFAULT 'Active',
     uploaded_by VARCHAR(100), uploaded_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
     created_by VARCHAR(100), reviewer_id VARCHAR(100), review_comments TEXT, published_at TIMESTAMPTZ);`,
  `CREATE TABLE IF NOT EXISTS public.exam_mcq_questions (
     id VARCHAR(100) PRIMARY KEY, title VARCHAR(255) NOT NULL, question_text TEXT NOT NULL,
     category_id VARCHAR(100), category_name VARCHAR(100), subject VARCHAR(150), image_url TEXT,
     option_a TEXT NOT NULL, option_b TEXT NOT NULL, option_c TEXT NOT NULL, option_d TEXT NOT NULL, option_e TEXT NOT NULL,
     correct_answer VARCHAR(5) NOT NULL, remember_note_1 TEXT NOT NULL, remember_note_2 TEXT NOT NULL, remember_note_3 TEXT NOT NULL,
     explanation TEXT, difficulty VARCHAR(20), display_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT TRUE,
     question_code VARCHAR(50), course_id VARCHAR(100), subject_id VARCHAR(100), topic VARCHAR(150),
     question_type VARCHAR(50) DEFAULT 'Both', status VARCHAR(50) DEFAULT 'Active', created_by VARCHAR(100),
     updated_by VARCHAR(100), reviewer_id VARCHAR(100), review_comments TEXT, published_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());`,
  `CREATE TABLE IF NOT EXISTS public.exam_mock_tests (
     id VARCHAR(100) PRIMARY KEY, title VARCHAR(255) NOT NULL, category_id VARCHAR(100), category_name VARCHAR(100),
     target_profession VARCHAR(100), total_questions INTEGER DEFAULT 50, duration_minutes INTEGER DEFAULT 60,
     passing_score INTEGER DEFAULT 70, difficulty VARCHAR(20) DEFAULT 'Medium', question_paper_url TEXT,
     answer_key_url TEXT, explanation_url TEXT, is_active BOOLEAN DEFAULT TRUE, status VARCHAR(50) DEFAULT 'Draft',
     created_by VARCHAR(100), reviewer_id VARCHAR(100), review_comments TEXT, published_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());`,
];

let prisma;
const created = [];

function token(user) {
  return signAuthToken({ userId: user.id, email: user.email, role: user.role, fullName: user.fullName });
}

async function call(baseUrl, path, { method = 'GET', as, body } = {}) {
  const headers = { Authorization: `Bearer ${token(as)}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let parsed = {};
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { status: response.status, body: parsed };
}

async function cleanup() {
  if (created.length) {
    for (const table of ['exam_courses', 'exam_study_materials', 'exam_mcq_questions', 'exam_mock_tests']) {
      await prisma.$executeRawUnsafe(`DELETE FROM public.${table} WHERE id = ANY($1::text[])`, created).catch(() => null);
    }
  }
  await prisma.$executeRawUnsafe("DELETE FROM public.exam_academic_audit WHERE actor_id = ANY($1::text[])", USER_FIXTURES.map(user => user.id)).catch(() => null);
  await prisma.$executeRawUnsafe("DELETE FROM public.security_permission_profiles WHERE subject_id = ANY($1::text[])", USER_FIXTURES.map(user => user.id)).catch(() => null);
  await prisma.user.deleteMany({ where: { id: { in: USER_FIXTURES.map(user => user.id) } } }).catch(() => null);
}

async function main() {
  await checkDbConnection();
  await waitForSchemaBootstrap();
  prisma = getPrisma();
  assert.ok(prisma, 'test database must be available');

  for (const sql of EXAM_DDL) await prisma.$executeRawUnsafe(sql);
  await cleanup();
  for (const fixture of USER_FIXTURES) {
    await prisma.user.create({ data: { id: fixture.id, fullName: fixture.fullName, email: fixture.email, role: fixture.role, active: true } });
  }

  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // Coordinator can create the permitted draft kinds.
    const course = await call(baseUrl, '/api/exam-ops/academic-drafts', {
      method: 'POST', as: COORDINATOR,
      body: { kind: 'course', courseCode: `TC-${suffix}`, courseName: 'Test Course', examAuthority: 'DHA', profession: 'Nursing' },
    });
    assert.equal(course.status, 201, JSON.stringify(course.body));
    created.push(course.body.data.id);
    assert.equal(course.body.data.status, 'Draft');
    assert.equal(course.body.data.created_by, COORDINATOR.id);
    console.log('  ✅ coordinator creates course draft');

    // Providing Officer is denied course drafts but allowed material drafts.
    const officerCourse = await call(baseUrl, '/api/exam-ops/academic-drafts', {
      method: 'POST', as: OFFICER,
      body: { kind: 'course', courseCode: `OC-${suffix}`, courseName: 'Denied Course', examAuthority: 'DHA', profession: 'Nursing' },
    });
    assert.equal(officerCourse.status, 403);

    const material = await call(baseUrl, '/api/exam-ops/academic-drafts', {
      method: 'POST', as: OFFICER,
      body: { kind: 'material', title: 'Officer Material', description: 'Draft notes' },
    });
    assert.equal(material.status, 201, JSON.stringify(material.body));
    created.push(material.body.data.id);
    assert.equal(material.body.data.status, 'Draft');
    console.log('  ✅ officer denied course, allowed material draft');

    const question = await call(baseUrl, '/api/exam-ops/academic-drafts', {
      method: 'POST', as: OFFICER,
      body: { kind: 'question', title: 'Officer Question', questionText: 'What is 2+2?', optionA: '4', optionB: '5', correctAnswer: 'A' },
    });
    assert.equal(question.status, 201, JSON.stringify(question.body));
    created.push(question.body.data.id);

    const nurseDraft = await call(baseUrl, '/api/exam-ops/academic-drafts', {
      method: 'POST', as: NURSE,
      body: { kind: 'material', title: 'Nurse Material' },
    });
    assert.equal(nurseDraft.status, 403);
    console.log('  ✅ module isolation for clinical roles');

    // Ownership: another lower role cannot edit the officer's draft.
    const foreignEdit = await call(baseUrl, `/api/exam-ops/academic-drafts/material/${material.body.data.id}`, {
      method: 'PATCH', as: COORDINATOR, body: { title: 'Hijacked' },
    });
    assert.equal(foreignEdit.status, 403);

    const ownEdit = await call(baseUrl, `/api/exam-ops/academic-drafts/material/${material.body.data.id}`, {
      method: 'PATCH', as: OFFICER, body: { title: 'Officer Material v2' },
    });
    assert.equal(ownEdit.status, 200, JSON.stringify(ownEdit.body));
    assert.equal(ownEdit.body.data.title, 'Officer Material v2');
    console.log('  ✅ own-draft editing only');

    // Submit for review, then lower roles cannot publish or delete.
    const submit = await call(baseUrl, `/api/exam-ops/academic-drafts/material/${material.body.data.id}/submit`, {
      method: 'POST', as: OFFICER, body: {},
    });
    assert.equal(submit.status, 200);
    assert.equal(submit.body.data.status, 'Pending_Review');

    const lowerPublish = await call(baseUrl, `/api/exam-ops/academic-drafts/material/${material.body.data.id}/publish`, {
      method: 'POST', as: OFFICER, body: {},
    });
    assert.equal(lowerPublish.status, 403);

    const lowerDelete = await call(baseUrl, `/api/exam-ops/academic-drafts/material/${material.body.data.id}`, {
      method: 'DELETE', as: OFFICER,
    });
    assert.equal(lowerDelete.status, 403);
    console.log('  ✅ publish/delete restricted to the Head of Exam Department');

    // Manager review and publication.
    const review = await call(baseUrl, `/api/exam-ops/academic-drafts/material/${material.body.data.id}/review`, {
      method: 'POST', as: MANAGER, body: { action: 'approve', comments: 'Looks good' },
    });
    assert.equal(review.status, 200);
    assert.equal(review.body.data.status, 'Approved');

    const publish = await call(baseUrl, `/api/exam-ops/academic-drafts/material/${material.body.data.id}/publish`, {
      method: 'POST', as: MANAGER, body: {},
    });
    assert.equal(publish.status, 200);
    assert.equal(publish.body.data.status, 'Active');

    const publishCourse = await call(baseUrl, `/api/exam-ops/academic-drafts/course/${course.body.data.id}/submit`, {
      method: 'POST', as: COORDINATOR, body: {},
    });
    assert.equal(publishCourse.status, 200);
    const managerPublish = await call(baseUrl, `/api/exam-ops/academic-drafts/course/${course.body.data.id}/publish`, {
      method: 'POST', as: MANAGER, body: {},
    });
    assert.equal(managerPublish.status, 200);
    console.log('  ✅ manager review and publication');

    // Published content is immutable through the draft edit path.
    const editPublished = await call(baseUrl, `/api/exam-ops/academic-drafts/material/${material.body.data.id}`, {
      method: 'PATCH', as: MANAGER, body: { title: 'Edited after publish' },
    });
    assert.equal(editPublished.status, 409);

    // Listing: officer sees own drafts plus published content, not another user's draft.
    const otherCourse = await call(baseUrl, '/api/exam-ops/academic-drafts', {
      method: 'POST', as: COORDINATOR,
      body: { kind: 'course', courseCode: `UC-${suffix}`, courseName: 'Unpublished Course', examAuthority: 'DHA', profession: 'Nursing' },
    });
    created.push(otherCourse.body.data.id);
    const list = await call(baseUrl, '/api/exam-ops/academic-drafts?kind=course', { as: OFFICER });
    assert.equal(list.status, 200);
    const ids = list.body.data.map(item => item.id);
    assert.ok(ids.includes(course.body.data.id), 'published course visible');
    assert.ok(!ids.includes(otherCourse.body.data.id), 'unpublished draft of another user hidden');
    console.log('  ✅ draft listing respects ownership and publication');

    // Audit trail is written.
    const audit = await prisma.$queryRawUnsafe(
      "SELECT action FROM public.exam_academic_audit WHERE entity_id = $1 ORDER BY created_at", material.body.data.id
    );
    const actions = audit.map(row => row.action);
    for (const expected of ['created', 'updated', 'submitted', 'approved', 'published']) {
      assert.ok(actions.includes(expected), `missing audit action ${expected}`);
    }
    console.log('  ✅ academic workflow audited');

    console.log('\n✅ Exam academic draft suite passed.');
  } finally {
    await cleanup();
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('❌ Exam academic draft suite failed:', error);
  process.exitCode = 1;
});
