import crypto from 'node:crypto';
import { ExamStore } from './examStore.js';
import { StudentAccess, DevicePolicyManager } from './studentAccess.js';
import { orderKey } from './examOperations.js';
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

function verifyStaffToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  if (signature.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload || (!payload.userId && !payload.id) || (payload.exp && Date.now() > payload.exp)) return null;
    return { ...payload, id: payload.userId || payload.id };
  } catch {
    return null;
  }
}

export async function handleStudentRoutes(req, res, pathname, authUser = null) {
  if (!pathname.startsWith('/api/student/')) return false;
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Allow-Credentials': 'true'
    });
    res.end();
    return true;
  }
  try {
    const state = cookies(req);
    const authHeader = req.headers.authorization;
    const bearerToken = (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer '))
      ? authHeader.slice(7).trim()
      : null;
    const sessionToken = bearerToken || state.exam_session;
    state.exam_session = sessionToken;

    const browser = /^[A-Za-z0-9_-]{40,100}$/.test(state.exam_browser || '') ? state.exam_browser : crypto.randomBytes(32).toString('base64url');
    if (await handleStudentAssessmentRoutes(req, res, pathname, browser, state)) return true;

    const service = new StudentAccess(new ExamStore(getPrisma()), JWT_SECRET);
    let result;

    if (req.method !== 'GET' && req.headers.origin) {
      const allowed = process.env.STUDENT_PORTAL_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173';
      const allowedOrigin = new URL(allowed).origin;
      const reqOrigin = req.headers.origin;
      const isLocal = reqOrigin.startsWith('http://localhost') || reqOrigin.startsWith('http://127.0.0.1');
      if (reqOrigin !== allowedOrigin && !isLocal) {
        throw new ExamError(403, 'ORIGIN_DENIED', 'Request origin is not permitted.');
      }
    }

    if (pathname === '/api/student/activate' && req.method === 'POST') {
      const body = await readExamJson(req);
      result = await service.activate(body.token, body.password, browser);
    } else if (pathname === '/api/student/login' && req.method === 'POST') {
      const body = await readExamJson(req);
      const clientDevice = {
        deviceId: body.deviceId || null,
        deviceType: body.deviceType || (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(req.headers['user-agent'] || '') ? 'mobile' : 'desktop'),
        userAgent: body.userAgent || req.headers['user-agent'] || browser,
        browserName: body.browserName || null
      };
      // Do not trust spoofable X-Forwarded-For as the primary limiter identity.
      result = await service.login(body.email, body.password, browser, req.socket.remoteAddress || 'unknown', clientDevice);
    } else if (pathname === '/api/student/verify-device' && req.method === 'POST') {
      const body = await readExamJson(req);
      const clientDevice = {
        deviceId: body.deviceId || null,
        deviceType: body.deviceType || (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(req.headers['user-agent'] || '') ? 'mobile' : 'desktop'),
        userAgent: body.userAgent || req.headers['user-agent'] || browser,
        browserName: body.browserName || null
      };
      result = await service.verifyDevice(body.challengeId, body.code, browser, clientDevice);
    } else if (pathname === '/api/student/me' && req.method === 'GET') {
      requireValue(sessionToken, 'UNAUTHORIZED', 'Sign in to continue.', 401);
      result = await service.portal(sessionToken, browser);
    } else if (pathname === '/api/student/logout' && req.method === 'POST') {
      requireValue(sessionToken, 'UNAUTHORIZED', 'Sign in to continue.', 401);
      result = await service.logout(sessionToken, browser);
      res.setHeader('Set-Cookie', cookie('exam_session', '', 0));
    } else if (pathname === '/api/student/devices' && req.method === 'GET') {
      requireValue(sessionToken, 'UNAUTHORIZED', 'Sign in to continue.', 401);
      result = await service.store.transaction(async tx => {
        const student = await service.authenticate(tx, sessionToken, browser, true);
        return { devices: student.registeredDevices || [] };
      });
    } else if (pathname === '/api/student/devices/register' && req.method === 'POST') {
      requireValue(sessionToken, 'UNAUTHORIZED', 'Sign in to continue.', 401);
      const body = await readExamJson(req);
      result = await service.store.transaction(async tx => {
        const student = await service.authenticate(tx, sessionToken, browser, true);
        requireValue(body.deviceId && body.deviceType, 'DEVICE_DETAILS_REQUIRED', 'Device ID and type are required.');
        return service.devicePolicy.registerDevice(student.id, {
          deviceId: body.deviceId,
          deviceType: body.deviceType,
          userAgent: body.userAgent || req.headers['user-agent'] || 'Mozilla/5.0',
          browserName: body.browserName || 'Browser'
        }, tx);
      });
    } else if ((pathname === '/api/student/replace-device/request' || pathname === '/api/student/devices/replacement/request') && req.method === 'POST') {
      const body = await readExamJson(req);
      let studentId = null;
      if (sessionToken) {
        try {
          const authStudent = await service.store.transaction(tx => service.authenticate(tx, sessionToken, browser, false));
          studentId = authStudent.id;
        } catch {}
      }
      if (!studentId) {
        requireValue(typeof body.email === 'string' && body.email.includes('@'), 'EMAIL_REQUIRED', 'Student email is required.');
        studentId = orderKey(body.email.trim().toLowerCase());
      }
      requireValue(body.targetDeviceId, 'DEVICE_ID_REQUIRED', 'Target device ID is required.');
      const detectedType = /mobile|android|iphone|ipad|ipod/i.test(req.headers['user-agent'] || '') ? 'mobile' : 'desktop';
      const targetDeviceType = body.targetDeviceType || detectedType;
      result = await service.devicePolicy.requestDeviceReplacement(studentId, {
        targetDeviceId: body.targetDeviceId,
        targetDeviceType
      });
    } else if ((pathname === '/api/student/replace-device/verify-otp' || pathname === '/api/student/devices/replacement/verify') && req.method === 'POST') {
      const body = await readExamJson(req);
      requireValue(body.challengeId && body.code, 'CHALLENGE_DATA_REQUIRED', 'Challenge ID and OTP code are required.');
      result = await service.devicePolicy.verifyReplacementOtp(body.challengeId, String(body.code).trim());
    } else if ((pathname === '/api/student/replace-device/status' || pathname === '/api/student/devices/replacement/status') && req.method === 'GET') {
      const challengeId = new URL(req.url, 'http://localhost').searchParams.get('challengeId');
      requireValue(challengeId, 'CHALLENGE_ID_REQUIRED', 'Challenge ID is required.');
      result = await service.store.transaction(async tx => {
        const challenge = await tx.get('device_challenge', challengeId);
        requireValue(challenge, 'NOT_FOUND', 'Challenge not found.', 404);
        return {
          id: challenge.id,
          status: challenge.status,
          failures: challenge.failures || 0,
          targetDeviceType: challenge.targetDeviceType,
          expiresAt: challenge.expiresAt
        };
      });
    } else if (pathname === '/api/student/device-info' && req.method === 'GET') {
      const ua = String(req.headers['user-agent'] || '');
      const isMobile = /mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua);
      result = {
        detectedType: isMobile ? 'mobile' : 'desktop',
        userAgent: ua,
        browserDigest: browser
      };
    } else if (pathname.startsWith('/api/student/materials/') && req.method === 'GET') {
      requireValue(sessionToken, 'UNAUTHORIZED', 'Sign in to continue.', 401);
      const assetId = pathname.slice('/api/student/materials/'.length);
      result = await service.store.transaction(async tx => {
        const student = await service.authenticate(tx, sessionToken, browser, true);
        const accesses = await tx.list('entitlement', student.id);
        requireValue(accesses.some(a => a.status === 'ACTIVE' && Date.parse(a.startsAt) <= Date.now() && Date.parse(a.endsAt) > Date.now() && a.materialIds?.includes(assetId)), 'NO_ACCESS', 'Material access is unavailable.', 403);
        const asset = await tx.get('asset', assetId);
        requireValue(asset?.status === 'PUBLISHED', 'NOT_FOUND', 'Material unavailable.', 404);
        await tx.audit(student.id, 'student.material.viewed', assetId);
        return { id: asset.id, title: asset.title, version: asset.version, text: asset.text, watermark: student.id.slice(0, 12) + ' • ' + student.email.replace(/(^.).*(@.*$)/, '$1***$2') + ' • ' + new Date().toISOString() };
      });
    } else if (pathname === '/api/student/support' && req.method === 'POST') {
      requireValue(sessionToken, 'UNAUTHORIZED', 'Sign in to continue.', 401);
      const body = await readExamJson(req);
      result = await service.store.transaction(async tx => {
        const student = await service.authenticate(tx, sessionToken, browser, true);
        requireValue(typeof body.message === 'string' && body.message.trim().length >= 5 && body.message.length <= 5000, 'INVALID_MESSAGE', 'Enter a support message of 5–5000 characters.');
        await service.limit(tx, 'support:' + student.id, 10, 3600000);
        const id = crypto.randomUUID();
        await tx.put('support', id, { id, ownerId: student.id, message: body.message.trim(), status: 'OPEN', createdAt: new Date().toISOString() });
        await tx.audit(student.id, 'student.support.created', id);
        return { id, status: 'OPEN' };
      });
    } else if (pathname.startsWith('/api/student/admin/') && pathname.endsWith('/status') && (req.method === 'PATCH' || req.method === 'POST')) {
      const targetStudentId = pathname.slice('/api/student/admin/'.length).replace(/\/status$/, '');
      const staffUser = authUser || verifyStaffToken(bearerToken);
      requireValue(staffUser && (staffUser.role === 'super_admin' || staffUser.role === 'exam_department_manager'), 'FORBIDDEN', 'Administrative access required.', 403);
      const body = await readExamJson(req);
      requireValue(body.status, 'STATUS_REQUIRED', 'Status is required.');
      result = await service.setStatus(staffUser, targetStudentId, body.status, body.reason);
    } else throw new ExamError(404, 'NOT_FOUND', 'Route not found.');

    if (result?.token) {
      if (typeof res.setHeader === 'function') res.setHeader('Set-Cookie', [cookie('exam_session', result.token, 86400), cookie('exam_browser', browser, 31536000)]);
    } else if (!state.exam_browser) {
      if (typeof res.setHeader === 'function') res.setHeader('Set-Cookie', cookie('exam_browser', browser, 31536000));
    }
    examJson(res, 200, { success: true, data: result });
  } catch (error) {
    const status = error instanceof ExamError ? error.status : (error.status || (error.code === 'FORBIDDEN' || error.code === 'THIRD_DEVICE_BLOCKED' || error.code === 'DEVICE_LIMIT_EXCEEDED' ? 403 : error.code === 'SESSION_EXPIRED' || error.code === 'UNAUTHORIZED' || error.code === 'INVALID_LOGIN' ? 401 : error.code === 'NOT_FOUND' || error.code === 'STUDENT_NOT_FOUND' || error.code === 'CHALLENGE_NOT_FOUND' ? 404 : 400));
    examJson(res, status, { success: false, code: error.code || 'INTERNAL_ERROR', error: error.message || 'Student service is unavailable.' });
  }
  return true;
}
