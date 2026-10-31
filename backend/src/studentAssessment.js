import crypto from 'node:crypto';
import { ExamError, requireValue } from './examPolicy.js';
import { ExamStore } from './examStore.js';
import { StudentAccess } from './studentAccess.js';
import { getPrisma } from './db.js';
import { JWT_SECRET } from './runtimeConfig.js';
import { readExamJson, examJson } from './examOperationsRoutes.js';

const allowedServices = new Set(['practice-questions', 'practice-mcqs', 'mock-tests', 'subject-tests']);
const allowedModes = new Set(['practice', 'mock']);
const safeQuestion = row => ({ id: row.id, code: row.question_code || row.id, title: row.title, questionText: row.question_text, subject: row.subject, topic: row.topic, difficulty: row.difficulty, options: { A: row.option_a, B: row.option_b, C: row.option_c, D: row.option_d, E: row.option_e } });
function errorJson(res, error) { examJson(res, error instanceof ExamError ? error.status : 500, { success: false, code: error.code || 'ASSESSMENT_ERROR', error: error instanceof ExamError ? error.message : 'Unable to complete assessment.' }); }

export async function handleStudentAssessmentRoutes(req, res, pathname, browser, cookies) {
  if (!pathname.startsWith('/api/student/assessments')) return false;
  try {
    const store = new ExamStore(getPrisma());
    const access = new StudentAccess(store, JWT_SECRET);
    const session = cookies.exam_session;
    if (req.method !== 'GET') requireValue(req.headers.origin === new URL(process.env.STUDENT_PORTAL_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173').origin, 'ORIGIN_DENIED', 'Request origin is not permitted.', 403);
    if (pathname === '/api/student/assessments' && req.method === 'GET') {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const courseId = params.get('courseId'); const mode = params.get('mode') || 'practice';
      requireValue(courseId && /^[A-Za-z0-9_-]{1,120}$/.test(courseId) && allowedModes.has(mode), 'ASSESSMENT_NOT_AVAILABLE', 'Select an available assessment.');
      const result = await store.transaction(async tx => {
        const student = await access.authenticate(tx, session, browser, true);
        const entitlements = (await tx.list('entitlement', student.id)).filter(item => item.status === 'ACTIVE' && item.courseId === courseId && Date.parse(item.startsAt || '') <= Date.now() && Date.parse(item.endsAt || '') > Date.now() && (item.services || []).some(s => allowedServices.has(String(s))));
        requireValue(entitlements.length > 0, 'NO_ACCESS', 'This practice course is not included in your active access.', 403);
        const typeFilter = mode === 'mock' ? "('Mock Test','Both')" : "('Practice','Both')";
        const rows = await tx.query("SELECT id,question_code,title,question_text,subject,topic,difficulty,option_a,option_b,option_c,option_d,option_e FROM public.exam_mcq_questions WHERE is_active=TRUE AND COALESCE(status,'Active')='Active' AND (question_type IN " + typeFilter + " OR question_type IS NULL) AND (course_id=$1 OR course_id IS NULL) ORDER BY display_order ASC, created_at ASC LIMIT 100", courseId);
        return { courseId, mode, questions: rows.map(safeQuestion), attemptAllowance: Math.max(...entitlements.map(e => Number(e.attemptAllowance || 0))), attemptsUsed: (await tx.list('assessment-attempt', student.id)).filter(a => a.courseId === courseId && a.mode === mode).length };
      });
      examJson(res, 200, { success: true, data: result }); return true;
    }
    if (pathname === '/api/student/assessments/attempts' && req.method === 'POST') {
      const body = await readExamJson(req);
      requireValue(typeof body.courseId === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(body.courseId) && allowedModes.has(body.mode), 'INVALID_ASSESSMENT', 'Invalid assessment.');
      requireValue(Array.isArray(body.answers) && body.answers.length <= 100, 'INVALID_ANSWERS', 'Answers are invalid.');
      const result = await store.transaction(async tx => {
        const student = await access.authenticate(tx, session, browser, true);
        const entitlements = (await tx.list('entitlement', student.id)).filter(item => item.status === 'ACTIVE' && item.courseId === body.courseId && Date.parse(item.startsAt || '') <= Date.now() && Date.parse(item.endsAt || '') > Date.now() && (item.services || []).some(s => allowedServices.has(String(s))));
        requireValue(entitlements.length > 0, 'NO_ACCESS', 'This practice course is not included in your active access.', 403);
        const previous = (await tx.list('assessment-attempt', student.id)).filter(a => a.courseId === body.courseId && a.mode === body.mode);
        const allowance = Math.max(...entitlements.map(e => Number(e.attemptAllowance || 0)));
        requireValue(allowance <= 0 || previous.length < allowance, 'ATTEMPTS_EXHAUSTED', 'Your practice attempt allowance has been used.', 403);
        const ids = [...new Set(body.answers.map(a => a?.questionId).filter(x => typeof x === 'string' && x.length <= 120))];
        requireValue(ids.length > 0, 'INVALID_ANSWERS', 'Submit at least one answer.');
        requireValue(ids.length === body.answers.length, 'INVALID_ANSWERS', 'Each question can only be answered once.');
        const placeholders = ids.map((_, index) => '$' + (index + 1)).join(',');
        const typeFilter = body.mode === 'mock' ? "('Mock Test','Both')" : "('Practice','Both')";
        const rows = await tx.query("SELECT id,correct_answer FROM public.exam_mcq_questions WHERE id IN (" + placeholders + ") AND is_active=TRUE AND COALESCE(status,'Active')='Active' AND (question_type IN " + typeFilter + " OR question_type IS NULL) AND (course_id=$" + (ids.length + 1) + " OR course_id IS NULL)", ...ids, body.courseId);
        requireValue(rows.length === ids.length, 'INVALID_ANSWERS', 'Answers include questions outside this assessment.');
        const correct = new Map(rows.map(row => [row.id, String(row.correct_answer || '').toUpperCase()]));
        let answered = 0; let score = 0;
        const evaluated = body.answers.map(answer => { const expected = correct.get(answer?.questionId); const selected = typeof answer?.answer === 'string' ? answer.answer.toUpperCase() : ''; const valid = Boolean(expected && ['A','B','C','D','E'].includes(selected)); if (valid) answered++; const isCorrect = valid && selected === expected; if (isCorrect) score++; return { questionId: answer?.questionId, selected: valid ? selected : null, correct: isCorrect }; });
        const record = { id: crypto.randomUUID(), ownerId: student.id, studentId: student.id, courseId: body.courseId, mode: body.mode, answered, score, total: evaluated.length, percentage: evaluated.length ? Math.round(score / evaluated.length * 10000) / 100 : 0, answers: evaluated, elapsedSeconds: Number.isInteger(body.elapsedSeconds) ? Math.max(0, Math.min(body.elapsedSeconds, 86400)) : null, submittedAt: new Date().toISOString() };
        await tx.put('assessment-attempt', record.id, record); await tx.audit(student.id, 'student.assessment.submitted', record.id, { courseId: body.courseId, mode: body.mode });
        return record;
      });
      examJson(res, 201, { success: true, data: result }); return true;
    }
    throw new ExamError(404, 'NOT_FOUND', 'Assessment route not found.');
  } catch (error) { errorJson(res, error); return true; }
}
