import crypto from 'node:crypto';
import { ExamStore } from './examStore.js';
import { StudentAccess } from './studentAccess.js';
import { getPrisma } from './db.js';
import { JWT_SECRET } from './runtimeConfig.js';
import { readExamJson, examJson } from './examOperationsRoutes.js';
import { ExamError, requireValue } from './examPolicy.js';
import { handleStudentAssessmentRoutes } from './studentAssessment.js';

function cookies(req) {
  const values = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0) values[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  }
  return values;
}
function cookie(name, value, maxAge) {
  return name + '=' + value + '; HttpOnly; SameSite=Lax; Path=/api/student; Max-Age=' + maxAge + (process.env.NODE_ENV === 'production' ? '; Secure' : '');
}
export async function handleStudentRoutes(req, res, pathname) {
  if (!pathname.startsWith('/api/student/')) return false;
  try {
    const state = cookies(req);
    const browser = /^[A-Za-z0-9_-]{40,100}$/.test(state.exam_browser || '') ? state.exam_browser : crypto.randomBytes(32).toString('base64url');
    if (await handleStudentAssessmentRoutes(req, res, pathname, browser, state)) return true;
    const service = new StudentAccess(new ExamStore(getPrisma()), JWT_SECRET);
    let result;
    if (req.method !== 'GET') {
      const allowed = process.env.STUDENT_PORTAL_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5174';
      requireValue(req.headers.origin === new URL(allowed).origin, 'ORIGIN_DENIED', 'Request origin is not permitted.', 403);
    }
    if (pathname === '/api/student/activate' && req.method === 'POST') {
      const body = await readExamJson(req);
      result = await service.activate(body.token, body.password, browser);
    } else if (pathname === '/api/student/login' && req.method === 'POST') {
      const body = await readExamJson(req);
      // Do not trust spoofable X-Forwarded-For as the primary limiter identity.
      result = await service.login(body.email, body.password, browser, req.socket.remoteAddress || 'unknown');
    } else if (pathname === '/api/student/verify-device' && req.method === 'POST') {
      const body = await readExamJson(req);
      result = await service.verifyDevice(body.challengeId, body.code, browser);
    } else if (pathname === '/api/student/me' && req.method === 'GET') {
      result = await service.portal(state.exam_session, browser);
    } else if (pathname === '/api/student/logout' && req.method === 'POST') {
      result = await service.logout(state.exam_session, browser);
      res.setHeader('Set-Cookie', cookie('exam_session', '', 0));
    } else if (pathname.startsWith('/api/student/materials/') && req.method === 'GET') {
      const assetId = pathname.slice('/api/student/materials/'.length);
      result = await service.store.transaction(async tx => {
        const student = await service.authenticate(tx, state.exam_session, browser, true);
        const accesses = await tx.list('entitlement', student.id);
        requireValue(accesses.some(a => a.status === 'ACTIVE' && Date.parse(a.startsAt) <= Date.now() && Date.parse(a.endsAt) > Date.now() && a.materialIds?.includes(assetId)), 'NO_ACCESS', 'Material access is unavailable.', 403);
        const asset = await tx.get('asset', assetId);
        requireValue(asset?.status === 'PUBLISHED', 'NOT_FOUND', 'Material unavailable.', 404);
        await tx.audit(student.id, 'student.material.viewed', assetId);
        return { id: asset.id, title: asset.title, version: asset.version, text: asset.text, watermark: student.id.slice(0, 12) + ' • ' + student.email.replace(/(^.).*(@.*$)/, '$1***$2') + ' • ' + new Date().toISOString() };
      });
    } else if (pathname === '/api/student/support' && req.method === 'POST') {
      const body = await readExamJson(req);
      result = await service.store.transaction(async tx => {
        const student = await service.authenticate(tx, state.exam_session, browser, true);
        requireValue(typeof body.message === 'string' && body.message.trim().length >= 5 && body.message.length <= 5000, 'INVALID_MESSAGE', 'Enter a support message of 5–5000 characters.');
        await service.limit(tx, 'support:' + student.id, 10, 3600000);
        const id = crypto.randomUUID();
        await tx.put('support', id, { id, ownerId: student.id, message: body.message.trim(), status: 'OPEN', createdAt: new Date().toISOString() });
        await tx.audit(student.id, 'student.support.created', id);
        return { id, status: 'OPEN' };
      });
    } else throw new ExamError(404, 'NOT_FOUND', 'Route not found.');
    if (result?.token) {
      res.setHeader('Set-Cookie', [cookie('exam_session', result.token, 86400), cookie('exam_browser', browser, 31536000)]);
      delete result.token;
    } else if (!state.exam_browser) res.setHeader('Set-Cookie', cookie('exam_browser', browser, 31536000));
    examJson(res, 200, { success: true, data: result });
  } catch (error) {
    examJson(res, error instanceof ExamError ? error.status : 500, { success: false, code: error.code || 'INTERNAL_ERROR', error: error instanceof ExamError ? error.message : 'Student service is unavailable.' });
  }
  return true;
}
