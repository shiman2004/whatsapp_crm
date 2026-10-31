import { getExamMonitorStatus } from './examMonitor.js';
import { ExamStore } from './examStore.js';
import { ExamOperations } from './examOperations.js';
import { getPrisma } from './db.js';
import { ExamError } from './examPolicy.js';
import { canManageExam, requireValue } from './examPolicy.js';
import { StudentAccess } from './studentAccess.js';
import { JWT_SECRET } from './runtimeConfig.js';
import { handleExamAcademicDrafts } from './examAcademicRoutes.js';
import crypto from 'node:crypto';

export async function readExamJson(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 100000) throw new ExamError(413, 'BODY_TOO_LARGE', 'Request too large.');
  }
  try { const value = JSON.parse(text || '{}'); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; }
  catch { throw new ExamError(400, 'INVALID_JSON', 'A JSON object is required.'); }
}
export function examJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
export async function handleExamOperations(req, res, pathname, user) {
  if (!pathname.startsWith('/api/exam-ops')) return false;
  if (await handleExamAcademicDrafts(req, res, pathname, user)) return true;
  try {
    if (!user?.id) throw new ExamError(401, 'UNAUTHORIZED', 'Sign in first.');
    const service = new ExamOperations(new ExamStore(getPrisma()));
    if (pathname === '/api/exam-ops/monitor' && req.method === 'GET') {
      requireValue(canManageExam(user), 'FORBIDDEN', 'Administrator access required.', 403);
      examJson(res, 200, { success: true, data: getExamMonitorStatus() });
    } else if (pathname === '/api/exam-ops/resources' && req.method === 'GET') {
      requireValue(canManageExam(user), 'FORBIDDEN', 'Academic administrator permission required.', 403);
      const params = new URL(req.url, 'http://localhost').searchParams;
      const courseId = params.get('courseId');
      const serviceId = params.get('serviceId');
      requireValue(courseId && serviceId, 'FILTER_REQUIRED', 'Select a course and service.');
      const records = await service.store.transaction(tx => tx.list('course-resource', courseId));
      examJson(res, 200, {success:true,data:records.filter(r=>r.serviceId===serviceId)});
    } else if (pathname === '/api/exam-ops/resources' && req.method === 'POST') {
      requireValue(canManageExam(user), 'FORBIDDEN', 'Academic administrator permission required.', 403);
      const body = await readExamJson(req);
      const allowed = ['reference-books','clinical-cases','past-questions','study-plans','revision-notes','flashcards','application-assistance','licensing-assistance'];
      requireValue(typeof body.courseId==='string' && body.courseId.length<=150 && allowed.includes(body.serviceId),'INVALID_SERVICE','Select a valid course service.');
      requireValue(typeof body.title==='string' && body.title.trim().length>=3 && body.title.length<=300 && typeof body.content==='string' && body.content.trim().length>=3 && body.content.length<=30000,'CONTENT_REQUIRED','Provide a title and resource content.');
      if(body.url) requireValue(typeof body.url==='string' && body.url.length<=2000 && /^https:\/\//.test(body.url),'INVALID_URL','Reference links must use HTTPS.');
      if(body.serviceId==='past-questions') requireValue(body.rightsConfirmed===true && body.url,'PROVENANCE_REQUIRED','Confirm permission and provide the official or authorized source.');
      const id=crypto.randomUUID();
      const record=await service.store.transaction(async tx=>{
        const data={id,ownerId:body.courseId,courseId:body.courseId,serviceId:body.serviceId,title:body.title.trim(),text:body.content.trim(),url:body.url||'',status:'DRAFT',authorId:user.id,version:1,createdAt:new Date().toISOString(),rightsConfirmed:body.rightsConfirmed===true};
        await tx.put('course-resource',id,data); await tx.audit(user.id,'academic.resource.drafted',id); return data;
      });
      examJson(res,201,{success:true,data:record});
    } else if (/^\/api\/exam-ops\/resources\/[a-f0-9-]+\/publish$/.test(pathname) && req.method==='POST') {
      requireValue(canManageExam(user),'FORBIDDEN','Academic reviewer permission required.',403);
      const id=pathname.split('/')[4];
      const record=await service.store.transaction(async tx=>{
        const resource=await tx.get('course-resource',id,true);
        requireValue(resource,'NOT_FOUND','Resource not found.',404);
        requireValue(resource.authorId!==user.id,'INDEPENDENT_REVIEW','Another administrator must review and publish this resource.',403);
        requireValue(resource.status==='DRAFT','INVALID_STATUS','Resource is not awaiting publication.',409);
        resource.status='PUBLISHED';resource.reviewerId=user.id;resource.approvedAt=new Date().toISOString();
        await tx.put('asset',id,{...resource,title:resource.title,text:resource.text});
        await tx.audit(user.id,'academic.resource.published',id);
        return tx.put('course-resource',id,resource);
      });
      examJson(res,200,{success:true,data:record});
    } else if (/^\/api\/exam-ops\/students\/[a-f0-9]{64}\/invite$/.test(pathname) && req.method==='POST') {
      requireValue(process.env.STUDENT_EMAIL_ENABLED==='true','EMAIL_NOT_CONFIGURED','Email provider is not configured. No activation email has been sent.',503);
      const id=pathname.split('/')[4];
      const result=await new StudentAccess(service.store,JWT_SECRET).invite(user,id,process.env.STUDENT_PORTAL_ORIGIN||process.env.FRONTEND_URL||'http://localhost:5173');
      examJson(res,200,{success:true,data:result});
    } else if (/^\/api\/exam-ops\/students\/([a-zA-Z0-9_-]{1,100})\/status$/.test(pathname) && (req.method === 'PATCH' || req.method === 'POST')) {
      requireValue(canManageExam(user), 'FORBIDDEN', 'Administrator access required.', 403);
      const id = pathname.split('/')[4];
      const body = await readExamJson(req);
      requireValue(body.status, 'STATUS_REQUIRED', 'Status is required.');
      const access = new StudentAccess(service.store, JWT_SECRET);
      const result = await access.setStatus(user, id, body.status, body.reason);
      examJson(res, 200, { success: true, data: result });
    } else if (pathname === '/api/exam-ops/notifications' && req.method === 'GET') {
      examJson(res, 200, { success: true, data: await service.listNotifications(user) });
    } else if (pathname === '/api/exam-ops/handoffs' && req.method === 'GET') {
      examJson(res, 200, { success: true, data: await service.listHandoffs(user) });
    } else if (pathname === '/api/exam-ops/handoffs' && req.method === 'POST') {
      examJson(res, 201, { success: true, data: await service.submitHandoff(user, await readExamJson(req)) });
    } else if (/^\/api\/exam-ops\/handoffs\/[a-zA-Z0-9_-]+$/.test(pathname) && req.method === 'GET') {
      const id = pathname.split('/')[4];
      examJson(res, 200, { success: true, data: await service.getHandoff(user, id) });
    } else if (/^\/api\/exam-ops\/handoffs\/[a-zA-Z0-9_-]+\/notes$/.test(pathname) && req.method === 'POST') {
      const id = pathname.split('/')[4];
      examJson(res, 200, { success: true, data: await service.updateHandoff(user, id, 'add-note', await readExamJson(req)) });
    } else if (/^\/api\/exam-ops\/handoffs\/[a-zA-Z0-9_-]+\/[a-z-]+$/.test(pathname) && req.method === 'POST') {
      const [, , , , id, action] = pathname.split('/');
      examJson(res, 200, { success: true, data: await service.updateHandoff(user, id, action, await readExamJson(req)) });
    } else if (pathname === '/api/exam-ops/requirements' && req.method === 'GET') {
      examJson(res, 200, { success: true, data: await service.list(user) });
    } else if (pathname === '/api/exam-ops/requirements' && req.method === 'POST') {
      const record = await service.submit(user, await readExamJson(req));
      examJson(res, record.duplicate ? 200 : 201, { success: true, data: record });
    } else if (/^\/api\/exam-ops\/requirements\/([a-zA-Z0-9_-]{1,120})\/([a-z-]+)$/.test(pathname) && req.method === 'POST') {
      const match = pathname.match(/^\/api\/exam-ops\/requirements\/([a-zA-Z0-9_-]{1,120})\/([a-z-]+)$/);
      const [, id, action] = match;
      examJson(res, 200, { success: true, data: await service.update(user, id, action, await readExamJson(req)) });
    } else if (pathname === '/api/exam-ops/health' && req.method === 'GET') {
      examJson(res, 200, { success: true, data: await service.health(user) });
    } else {
      examJson(res, 404, { success: false, error: 'Route not found.' });
    }
  } catch (error) {
    examJson(res, error instanceof ExamError ? error.status : 500, { success: false, code: error.code || 'INTERNAL_ERROR', error: error instanceof ExamError ? error.message : 'Unable to complete exam operation.' });
  }
  return true;
}
