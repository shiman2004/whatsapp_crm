// Scoped academic draft workflow for the Exam Department.
//
// Legacy /api/exam/* CRUD stays manager-only because it exposes shared question
// keys and global records. These endpoints let coordinators and officers work on
// their own drafts while managers keep review, publication and deletion.
import crypto from 'node:crypto';
import { getPrisma } from './db.js';
import { ExamError, hasExamCapability, requireValue } from './examPolicy.js';
import { getProfile } from './securityStore.js';

const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};

async function readJson(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 100000) throw new ExamError(413, 'BODY_TOO_LARGE', 'Request too large.');
  }
  try {
    const value = JSON.parse(text || '{}');
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch {
    throw new ExamError(400, 'INVALID_JSON', 'A JSON object is required.');
  }
}

const DRAFT_STATUSES = ['Draft', 'Changes_Requested', 'Pending_Review', 'Approved'];
const PUBLISHABLE = ['Pending_Review', 'Approved'];

const KINDS = Object.freeze({
  course: {
    table: 'exam_courses', createCap: 'exam.course.create_draft',
    owner: 'created_by', title: 'course_name',
  },
  material: {
    table: 'exam_study_materials', createCap: 'exam.material.create_draft',
    owner: 'COALESCE(created_by, uploaded_by)', title: 'title',
  },
  question: {
    table: 'exam_mcq_questions', createCap: 'exam.question.create_draft',
    owner: 'created_by', title: 'title',
  },
  mock_test: {
    table: 'exam_mock_tests', createCap: 'exam.mock_test.create_draft',
    owner: 'created_by', title: 'title',
  },
});

const FIELDS = Object.freeze({
  course: [
    { key: 'courseCode', column: 'course_code', max: 50, required: true },
    { key: 'courseName', column: 'course_name', max: 255, required: true },
    { key: 'examAuthority', column: 'exam_authority', max: 100, required: true },
    { key: 'profession', column: 'profession', max: 100, required: true },
    { key: 'country', column: 'country', max: 100 },
    { key: 'description', column: 'description', max: 5000 },
    { key: 'accessType', column: 'access_type', max: 50 },
  ],
  material: [
    { key: 'courseId', column: 'course_id', max: 100 },
    { key: 'subjectId', column: 'subject_id', max: 100 },
    { key: 'topic', column: 'topic', max: 150 },
    { key: 'title', column: 'title', max: 255, required: true },
    { key: 'description', column: 'description', max: 5000 },
    { key: 'materialType', column: 'material_type', max: 50 },
    { key: 'fileUrl', column: 'file_url', max: 2000 },
    { key: 'externalUrl', column: 'external_url', max: 2000 },
    { key: 'thumbnail', column: 'thumbnail', max: 2000 },
    { key: 'allowDownload', column: 'allow_download', type: 'bool' },
  ],
  question: [
    { key: 'title', column: 'title', max: 255, required: true },
    { key: 'questionText', column: 'question_text', max: 20000, required: true },
    { key: 'courseId', column: 'course_id', max: 100 },
    { key: 'subjectId', column: 'subject_id', max: 100 },
    { key: 'topic', column: 'topic', max: 150 },
    { key: 'subject', column: 'subject', max: 150 },
    { key: 'questionType', column: 'question_type', max: 50 },
    { key: 'optionA', column: 'option_a', max: 2000 },
    { key: 'optionB', column: 'option_b', max: 2000 },
    { key: 'optionC', column: 'option_c', max: 2000 },
    { key: 'optionD', column: 'option_d', max: 2000 },
    { key: 'optionE', column: 'option_e', max: 2000 },
    { key: 'correctAnswer', column: 'correct_answer', max: 5 },
    { key: 'explanation', column: 'explanation', max: 20000 },
    { key: 'difficulty', column: 'difficulty', max: 20 },
  ],
  mock_test: [
    { key: 'title', column: 'title', max: 255, required: true },
    { key: 'categoryId', column: 'category_id', max: 100 },
    { key: 'categoryName', column: 'category_name', max: 100 },
    { key: 'targetProfession', column: 'target_profession', max: 100 },
    { key: 'totalQuestions', column: 'total_questions', type: 'int', min: 1, max: 500 },
    { key: 'durationMinutes', column: 'duration_minutes', type: 'int', min: 1, max: 600 },
    { key: 'passingScore', column: 'passing_score', type: 'int', min: 0, max: 100 },
    { key: 'difficulty', column: 'difficulty', max: 20 },
    { key: 'questionPaperUrl', column: 'question_paper_url', max: 2000 },
    { key: 'answerKeyUrl', column: 'answer_key_url', max: 2000 },
    { key: 'explanationUrl', column: 'explanation_url', max: 2000 },
  ],
});

const CREATE_DEFAULTS = Object.freeze({
  question: { option_a: '', option_b: '', option_c: '', option_d: '', option_e: '', correct_answer: '', remember_note_1: '', remember_note_2: '', remember_note_3: '' },
  mock_test: { total_questions: 50, duration_minutes: 60, passing_score: 70 },
  material: { material_type: 'PDF', allow_download: true },
  course: { country: 'UAE', access_type: 'Free' },
});

function config(kind) {
  const found = KINDS[String(kind || '')];
  if (!found) throw new ExamError(404, 'UNKNOWN_KIND', 'Unknown academic draft kind.');
  return found;
}

/** Stored role and user overrides are part of the enforced decision, not only the UI. */
async function permissionContext(prisma, user) {
  const [roleProfile, userProfile] = await Promise.all([
    getProfile(prisma, 'role', user.role),
    getProfile(prisma, 'user', user.id),
  ]);
  return {
    roleOverrides: roleProfile?.overrides || {},
    userOverrides: userProfile?.overrides || {},
    scope: userProfile?.scope || undefined,
  };
}

function normalizeStatus(value) {
  return String(value || 'Draft').trim().replace(/\s+/g, '_');
}

function toPublic(row, kind) {
  if (!row) return null;
  return { kind, ...row };
}

function coerce(field, value) {
  if (field.type === 'bool') return value === true || value === 'true';
  if (field.type === 'int') {
    const number = Number(value);
    requireValue(Number.isInteger(number) && number >= (field.min ?? 0) && number <= (field.max ?? Number.MAX_SAFE_INTEGER), 'INVALID_VALUE', `${field.key} is out of range.`);
    return number;
  }
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  requireValue(text.length <= field.max, 'INVALID_VALUE', `${field.key} is too long.`);
  return text;
}

function collect(fields, body, { requireAll }) {
  const columns = [];
  const values = [];
  for (const field of fields) {
    const provided = body[field.key] !== undefined;
    if (!provided && !(requireAll && field.required)) continue;
    const value = coerce(field, body[field.key]);
    if (requireAll && field.required) requireValue(typeof value === 'string' ? value.length > 0 : value !== null, 'REQUIRED', `${field.key} is required.`);
    if (value === null) continue;
    columns.push(field.column);
    values.push(value);
  }
  return { columns, values };
}

async function audit(tx, { kind, entityId, action, fromStatus, toStatus, user, comments }) {
  await tx.$executeRawUnsafe(
    `INSERT INTO public.exam_academic_audit
       (id, entity_type, entity_id, action, from_status, to_status, actor_id, actor_name, actor_role, comments)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    crypto.randomUUID(), kind, entityId, action, fromStatus || null, toStatus || null,
    user.id, user.fullName || user.email || user.id, user.role || null, comments || null
  );
}

async function loadDraft(tx, kind, id) {
  const cfg = config(kind);
  const rows = await tx.$queryRawUnsafe(`SELECT * FROM public.${cfg.table} WHERE id = $1 FOR UPDATE`, id);
  requireValue(rows?.[0], 'NOT_FOUND', 'Draft not found.', 404);
  return rows[0];
}

async function listDrafts(user, kind, prisma, ctx) {
  requireValue(hasExamCapability(user, 'exam.academic.view', ctx), 'FORBIDDEN', 'Academic module access required.', 403);
  const kinds = kind ? [String(kind)] : Object.keys(KINDS);
  const result = {};
  for (const current of kinds) {
    const cfg = config(current);
    const manager = hasExamCapability(user, 'exam.content.review', ctx);
    const sql = manager
      ? `SELECT * FROM public.${cfg.table} ORDER BY updated_at DESC NULLS LAST LIMIT 200`
      : `SELECT * FROM public.${cfg.table} WHERE (${cfg.owner} = $1 OR COALESCE(status, 'Active') = 'Active') ORDER BY updated_at DESC NULLS LAST LIMIT 200`;
    const rows = await prisma.$queryRawUnsafe(sql, ...(manager ? [] : [user.id]));
    result[current] = (rows || []).map(row => toPublic(row, current));
  }
  return kind ? result[String(kind)] : result;
}

async function createDraft(user, body, prisma, ctx) {
  const kind = String(body.kind || '');
  const cfg = config(kind);
  requireValue(hasExamCapability(user, cfg.createCap, ctx), 'FORBIDDEN', `The ${user.role} role cannot create this draft kind.`, 403);

  const { columns, values } = collect(FIELDS[kind], body, { requireAll: true });
  const defaults = CREATE_DEFAULTS[kind] || {};
  const allColumns = { ...defaults };
  columns.forEach((column, index) => { allColumns[column] = values[index]; });

  const id = crypto.randomUUID();
  const ownerColumns = kind === 'material' ? ['uploaded_by', 'created_by'] : ['created_by'];
  allColumns.id = id;
  allColumns.status = 'Draft';
  ownerColumns.forEach(column => { allColumns[column] = user.id; });
  if (kind === 'question' || kind === 'mock_test') allColumns.is_active = false;

  const names = Object.keys(allColumns);
  const placeholders = names.map((_, index) => `$${index + 1}`);
  const record = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(
      `INSERT INTO public.${cfg.table} (${names.join(', ')}) VALUES (${placeholders.join(', ')})`,
      ...names.map(name => allColumns[name])
    );
    await audit(tx, { kind, entityId: id, action: 'created', toStatus: 'Draft', user });
    const rows = await tx.$queryRawUnsafe(`SELECT * FROM public.${cfg.table} WHERE id = $1`, id);
    return rows?.[0];
  }, { timeout: 15000 });
  return toPublic(record, kind);
}

async function updateDraft(user, kind, id, body, prisma, ctx) {
  const cfg = config(kind);
  const manager = hasExamCapability(user, 'exam.content.review', ctx);
  const record = await prisma.$transaction(async tx => {
    const current = await loadDraft(tx, kind, id);
    requireValue(manager || hasExamCapability(user, 'exam.draft.edit_own', { ...ctx, resource: current }), 'FORBIDDEN', 'You can only edit your own unpublished drafts.', 403);
    requireValue(DRAFT_STATUSES.includes(normalizeStatus(current.status)), 'INVALID_STATUS', 'Published or in-review content cannot be edited here.', 409);

    const { columns, values } = collect(FIELDS[kind], body, { requireAll: false });
    requireValue(columns.length > 0, 'NO_CHANGES', 'No editable fields were provided.');
    const assignments = columns.map((column, index) => `${column} = $${index + 1}`);
    await tx.$executeRawUnsafe(
      `UPDATE public.${cfg.table} SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $${values.length + 1}`,
      ...values, id
    );
    await audit(tx, { kind, entityId: id, action: 'updated', fromStatus: current.status, toStatus: current.status, user });
    const rows = await tx.$queryRawUnsafe(`SELECT * FROM public.${cfg.table} WHERE id = $1`, id);
    return rows?.[0];
  }, { timeout: 15000 });
  return toPublic(record, kind);
}

async function transition(user, kind, id, action, body, prisma, ctx) {
  const cfg = config(kind);
  const manager = hasExamCapability(user, 'exam.content.review', ctx);
  const record = await prisma.$transaction(async tx => {
    const current = await loadDraft(tx, kind, id);
    const status = normalizeStatus(current.status);

    if (action === 'submit') {
      requireValue(manager || hasExamCapability(user, 'exam.draft.submit', { ...ctx, resource: current }), 'FORBIDDEN', 'You can only submit your own drafts.', 403);
      requireValue(['Draft', 'Changes_Requested'].includes(status), 'INVALID_TRANSITION', 'Only drafts or returned items can be submitted for review.', 409);
      await tx.$executeRawUnsafe(`UPDATE public.${cfg.table} SET status = 'Pending_Review', updated_at = NOW() WHERE id = $1`, id);
      await audit(tx, { kind, entityId: id, action: 'submitted', fromStatus: status, toStatus: 'Pending_Review', user, comments: body.comments });
      return { status: 'Pending_Review' };
    }

    requireValue(manager, 'FORBIDDEN', 'Only the Head of Exam Department can review, publish or delete content.', 403);

    if (action === 'review') {
      const decision = String(body.action || '');
      requireValue(['approve', 'request_changes'].includes(decision), 'INVALID_ACTION', 'Review action must be approve or request_changes.');
      requireValue(status === 'Pending_Review', 'INVALID_TRANSITION', 'Only submissions pending review can be reviewed.', 409);
      const next = decision === 'approve' ? 'Approved' : 'Changes_Requested';
      if (decision === 'request_changes') requireValue(typeof body.comments === 'string' && body.comments.trim().length >= 3, 'COMMENTS_REQUIRED', 'Provide feedback comments for requested changes.');
      await tx.$executeRawUnsafe(
        `UPDATE public.${cfg.table} SET status = $2, reviewer_id = $3, review_comments = $4, updated_at = NOW() WHERE id = $1`,
        id, next, user.id, body.comments || null
      );
      await audit(tx, { kind, entityId: id, action: decision === 'approve' ? 'approved' : 'changes_requested', fromStatus: status, toStatus: next, user, comments: body.comments });
      return { status: next };
    }

    if (action === 'publish') {
      requireValue(hasExamCapability(user, 'exam.content.publish', ctx), 'FORBIDDEN', 'Publication is restricted to the Head of Exam Department.', 403);
      requireValue(PUBLISHABLE.includes(status), 'INVALID_TRANSITION', 'Only approved content can be published.', 409);
      const visibility = kind === 'question' || kind === 'mock_test' ? ', is_active = TRUE' : '';
      await tx.$executeRawUnsafe(
        `UPDATE public.${cfg.table}
         SET status = 'Active'${visibility}, published_at = NOW(), reviewer_id = $2, updated_at = NOW()
         WHERE id = $1`,
        id, user.id
      );
      await audit(tx, { kind, entityId: id, action: 'published', fromStatus: status, toStatus: 'Active', user });
      return { status: 'Active' };
    }

    if (action === 'delete') {
      requireValue(hasExamCapability(user, 'exam.content.delete', ctx), 'FORBIDDEN', 'Deletion is restricted to the Head of Exam Department.', 403);
      await tx.$executeRawUnsafe(`DELETE FROM public.${cfg.table} WHERE id = $1`, id);
      await audit(tx, { kind, entityId: id, action: 'deleted', fromStatus: status, toStatus: null, user, comments: body.comments });
      return { deleted: true };
    }

    throw new ExamError(404, 'UNKNOWN_ACTION', 'Unknown draft action.');
  }, { timeout: 15000 });
  return { id, kind, ...record };
}

export async function handleExamAcademicDrafts(req, res, pathname, user) {
  if (pathname !== '/api/exam-ops/academic-drafts' && !pathname.startsWith('/api/exam-ops/academic-drafts/')) return false;
  try {
    requireValue(user?.id && user.active !== false, 'UNAUTHORIZED', 'Sign in first.', 401);
    const prisma = getPrisma();
    requireValue(prisma, 'DATABASE_UNAVAILABLE', 'Academic drafts require durable database storage.', 503);
    const ctx = await permissionContext(prisma, user);

    if (pathname === '/api/exam-ops/academic-drafts' && req.method === 'GET') {
      const kind = new URL(req.url, 'http://localhost').searchParams.get('kind');
      json(res, 200, { success: true, data: await listDrafts(user, kind, prisma, ctx) });
      return true;
    }
    if (pathname === '/api/exam-ops/academic-drafts' && req.method === 'POST') {
      json(res, 201, { success: true, data: await createDraft(user, await readJson(req), prisma, ctx) });
      return true;
    }

    const match = pathname.match(/^\/api\/exam-ops\/academic-drafts\/([a-z_]+)\/([a-zA-Z0-9_-]{1,100})(?:\/(submit|review|publish))?$/);
    if (match) {
      const [, kind, id, action] = match;
      config(kind);
      if (req.method === 'PATCH' && !action) {
        json(res, 200, { success: true, data: await updateDraft(user, kind, id, await readJson(req), prisma, ctx) });
        return true;
      }
      if (req.method === 'POST' && action) {
        json(res, 200, { success: true, data: await transition(user, kind, id, action, await readJson(req), prisma, ctx) });
        return true;
      }
      if (req.method === 'DELETE' && !action) {
        json(res, 200, { success: true, data: await transition(user, kind, id, 'delete', {}, prisma, ctx) });
        return true;
      }
    }

    json(res, 404, { success: false, error: 'Academic draft route not found.' });
  } catch (error) {
    json(res, error instanceof ExamError ? error.status : 500, {
      success: false,
      code: error.code || 'INTERNAL_ERROR',
      error: error instanceof ExamError ? error.message : 'Unable to complete academic draft operation.',
    });
  }
  return true;
}
