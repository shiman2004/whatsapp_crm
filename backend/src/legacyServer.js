import { startExamMonitor } from './examMonitor.js';
import { handleExamOperations } from './examOperationsRoutes.js';
import { handleStudentDatabaseRoutes } from './studentDatabaseRoutes.js';
import { handleClinicalRoutes } from './clinicalRoutes.js';
import { handleStudentRoutes } from './studentRoutes.js';
import { handleExamRoutes } from './examRoutes.js';
import { JWT_SECRET } from './runtimeConfig.js';
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { getPrisma, checkDbConnection, getDbStatus, getSystemSetting, setSystemSetting, allocateCompanyLeadSerial as allocatePersistedCompanyLeadSerial, waitForSchemaBootstrap } from './db.js';
import { resolveCompany, resolveLeadCompany, COMPANIES } from './companyConfig.js';
import { saveMediaToSupabase, getMediaFromSupabase, deleteMediaFromSupabase, deleteMediaBatchFromSupabase } from './supabaseMedia.js';
import { convertAudioToWhatsAppOggOpus } from './audioConverter.js';
import { handleAppointmentRoutes } from './appointmentRoutes.js';
import { handleMarketingRoutes } from './marketing/routes.js';
import { handleSecurityRoutes } from './securityRoutes.js';
import { handleUserManagementRoutes } from './userManagementRoutes.js';
import { hashSecret, verifySecret, encryptReversible, decryptReversible } from './secretHash.js';
import { createCorrelationId, auditSecurityEvent, sendApiError } from './securityAudit.js';
import { canSendWhatsApp } from './modules/marketing/services/consent.service.js';
import { processMarketingInboundMessage } from './modules/marketing/services/marketingConsentAutomation.service.js';
import { Server as SocketIOServer } from 'socket.io';

dotenv.config();
if (fs.existsSync(path.join(process.cwd(), 'backend', '.env'))) {
  dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });
}

const PORT = process.env.PORT || 3000;
const IS_TEST_ENV = process.env.NODE_ENV === 'test' || (process.argv[1] && process.argv[1].includes('test'));
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before starting the backend.');
}

const DEFAULT_TRUSTED_ORIGINS = [
  'https://royal-wellness-crm.onrender.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
];

const TRUSTED_ORIGINS = [
  ...DEFAULT_TRUSTED_ORIGINS,
  ...String(process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  const clean = String(origin).trim().replace(/\/+$/, '');
  if (TRUSTED_ORIGINS.includes(clean)) return true;
  try {
    const { hostname } = new URL(clean);
    if (
      hostname.endsWith('.onrender.com') ||
      hostname.endsWith('.vercel.app') ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    ) {
      return true;
    }
  } catch (_) {}
  return false;
}
const TRUST_PROXY = String(process.env.TRUST_PROXY || '').toLowerCase() === 'true';
const META_APP_SECRET = String(process.env.META_APP_SECRET || '').trim();
const REQUEST_BODY_LIMITS = {
  default: 2 * 1024 * 1024,
  upload: 25 * 1024 * 1024,
  webhook: 2 * 1024 * 1024,
  login: 32 * 1024
};
const MEDIA_URL_TTL_MS = 15 * 60 * 1000;
const SSE_TICKET_TTL_MS = 15 * 60 * 1000;
const sseTickets = new Map();

// Bounded, self-expiring stores. Both hold per-request state that would otherwise
// grow without limit on a long-running process.
const MAX_SSE_TICKETS = 5000;
const MAX_LOGIN_ATTEMPT_ENTRIES = 10000;
// Contact creation can fall back to memory while the database is unavailable.
// Keep a process-local normalized index so that fallback mode still rejects a
// second manual contact for the same WhatsApp number.
const inMemoryContactNumbers = new Map();

function sweepExpiredSseTickets() {
  const cutoff = Date.now() - SSE_TICKET_TTL_MS;
  for (const [ticket, record] of sseTickets) {
    if (record.issuedAt < cutoff) sseTickets.delete(ticket);
  }
}

setInterval(sweepExpiredSseTickets, SSE_TICKET_TTL_MS).unref();

function getBodyLimit(pathname) {
  if (pathname === '/api/upload') return REQUEST_BODY_LIMITS.upload;
  if (pathname === '/api/auth/login') return REQUEST_BODY_LIMITS.login;
  if (pathname === '/api/webhook' || pathname === '/webhook' || pathname === '/api/meta/webhook' || pathname === '/meta/webhook') {
    return REQUEST_BODY_LIMITS.webhook;
  }
  return REQUEST_BODY_LIMITS.default;
}

function issueSseTicket(user) {
  const ticket = crypto.randomBytes(32).toString('base64url');
  // Only the identity needed to open the stream is retained; the full user object is not.
  sseTickets.set(ticket, {
    user: { id: user.id, role: user.role, fullName: user.fullName, branch: user.branch, company: user.company },
    issuedAt: Date.now()
  });
  // Bound memory: drop expired tickets first, then refuse to grow past the cap.
  sweepExpiredSseTickets();
  if (sseTickets.size > MAX_SSE_TICKETS) {
    const oldest = sseTickets.keys().next().value;
    if (oldest !== undefined) sseTickets.delete(oldest);
  }
  return ticket;
}

function consumeSseTicket(ticket) {
  const record = sseTickets.get(ticket);
  if (!record || Date.now() - record.issuedAt > SSE_TICKET_TTL_MS) {
    if (record) sseTickets.delete(ticket);
    return null;
  }
  // Allow ticket reuse during its active TTL window so automatic browser EventSource reconnections succeed seamlessly
  return record.user;
}

function verifyMetaSignature(rawBody, signatureHeader) {
  const appSecret = String(process.env.META_APP_SECRET || (typeof metaConfig !== 'undefined' ? metaConfig?.appSecret : '') || META_APP_SECRET || '').trim();
  if (!appSecret) {
    return true;
  }
  if (!signatureHeader || typeof signatureHeader !== 'string') return false;
  const provided = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : '';
  if (!/^[a-f0-9]{64}$/i.test(provided)) return false;
  const expectedBuf = Buffer.from(crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex'), 'hex');
  const providedBuf = Buffer.from(provided, 'hex');
  // Length check first: timingSafeEqual throws on mismatched buffer sizes.
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.from(String(a || ''));
  const bBuf = Buffer.from(String(b || ''));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

// Media URLs are short-lived bearer links for browser media elements; authenticated
// callers can still access files after a link expires.
function signMediaFile(fileName, expires) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`media:${fileName}:${expires}`).digest('base64url');
}

function createPrivateMediaUrl(fileName, ttlMs = MEDIA_URL_TTL_MS) {
  const expires = Date.now() + ttlMs;
  const signature = signMediaFile(fileName, expires);
  return `/uploads/${encodeURIComponent(fileName)}?exp=${expires}&sig=${signature}`;
}

function verifyPrivateMediaUrl(fileName, expires, signature) {
  const expiry = Number(expires);
  if (!fileName || !Number.isSafeInteger(expiry) || expiry < Date.now() || typeof signature !== 'string' || !signature) return false;
  const expected = signMediaFile(fileName, expiry);
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// Allocation must be atomic. The previous numeric-scan fallback raced under concurrent
// lead creation and produced duplicate serials. Retry the atomic allocator a few times
// and then fail loudly rather than invent an unverifiable number.
async function allocateCompanyLeadSerial(prisma, company) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const serial = await allocatePersistedCompanyLeadSerial(prisma, company);
      if (serial) return serial;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Unable to allocate a unique lead serial number after 3 attempts${lastError ? `: ${lastError.message}` : ''}`);
}

// Cryptographic Token Helpers (HMAC-SHA256 with Expiration Support)
function signAuthToken(payload, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
  const tokenPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    fullName: payload.fullName,
    ...(payload.sid ? { sid: payload.sid } : {}),
    sv: Number(payload.sv || 0),
    iat: payload.iat || Date.now(),
    exp: payload.exp !== undefined ? payload.exp : (Date.now() + expiresInMs)
  };
  const data = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Missing or empty token string' };
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed token structure: expected header.signature format' };
  }
  const [data, signature] = parts;
  if (!data || !signature) {
    return { valid: false, error: 'Malformed token components' };
  }
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  if (!timingSafeStringEqual(signature, expectedSig)) {
    return { valid: false, error: 'Cryptographic signature mismatch' };
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Invalid token payload' };
    }
    if (payload.exp && Date.now() > payload.exp) {
      return { valid: false, expired: true, error: 'Token has expired' };
    }
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: 'Failed to decode token JSON' };
  }
}

// =============================================================================
// Cryptographic Password & PIN Hashing (shared with user administration)
// =============================================================================

// Dummy salt & hash for constant-time comparisons when account doesn't exist or is deactivated
const DUMMY_TIMING_HASH = hashSecret('dummy_timing_protection_secret_2026');
function dummyVerify(candidate) {
  try {
    verifySecret(candidate || 'dummy_secret', DUMMY_TIMING_HASH);
  } catch (e) {}
}

// Default Pre-Hashed Credentials for Canonical Users (scrypt salted hashes)
const DEFAULT_ADMIN_PASSWORD_HASH = hashSecret('admin');
const DEFAULT_ADMIN_PIN_HASH = hashSecret('1234');
const DEFAULT_STAFF_PASSWORD_HASH = hashSecret('staff');
const DEFAULT_STAFF_PIN_HASH = hashSecret('2026');
const SHIMAN_PIN_HASH = hashSecret('7777');

// =============================================================================
// Progressive Abuse Protection & Rate Limiting for Login Attempts
// =============================================================================
const LOGIN_RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes window
  MAX_ATTEMPTS: 5,           // 5 failed attempts before lockout
  LOCKOUT_MS: 15 * 60 * 1000  // 15 minutes lockout duration
};

const loginAttemptStore = new Map();

function getClientIp(req) {
  const xForwarded = req.headers['x-forwarded-for'];
  if (TRUST_PROXY && xForwarded) {
    return String(xForwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

function checkLoginRateLimit(ip, identifier) {
  const now = Date.now();
  const keys = [ip];
  if (identifier) keys.push(`${ip}:${identifier.toLowerCase()}`);

  for (const key of keys) {
    const entry = loginAttemptStore.get(key);
    if (entry && entry.lockedUntil && now < entry.lockedUntil) {
      const retryAfterSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
      return { limited: true, retryAfter: Math.max(1, retryAfterSeconds) };
    }
  }
  return { limited: false, retryAfter: 0 };
}

// Drop entries whose window and lockout have both lapsed, then enforce a hard cap by
// evicting the oldest entries. Prevents unbounded growth under sustained attack.
function sweepLoginAttemptStore() {
  const now = Date.now();
  for (const [key, entry] of loginAttemptStore) {
    const windowExpired = now - entry.firstAttempt > LOGIN_RATE_LIMIT.WINDOW_MS;
    const lockoutExpired = !entry.lockedUntil || now > entry.lockedUntil;
    if (windowExpired && lockoutExpired) loginAttemptStore.delete(key);
  }
  if (loginAttemptStore.size > MAX_LOGIN_ATTEMPT_ENTRIES) {
    const excess = loginAttemptStore.size - MAX_LOGIN_ATTEMPT_ENTRIES;
    let removed = 0;
    for (const key of loginAttemptStore.keys()) {
      if (removed >= excess) break;
      loginAttemptStore.delete(key);
      removed += 1;
    }
  }
}

setInterval(sweepLoginAttemptStore, LOGIN_RATE_LIMIT.WINDOW_MS).unref();

function recordLoginFailure(ip, identifier) {
  const now = Date.now();
  const keys = [ip];
  if (identifier) keys.push(`${ip}:${identifier.toLowerCase()}`);

  if (loginAttemptStore.size >= MAX_LOGIN_ATTEMPT_ENTRIES) sweepLoginAttemptStore();

  for (const key of keys) {
    let entry = loginAttemptStore.get(key);
    if (!entry || (now - entry.firstAttempt > LOGIN_RATE_LIMIT.WINDOW_MS)) {
      entry = { count: 1, firstAttempt: now, lockedUntil: 0 };
    } else {
      entry.count += 1;
    }

    if (entry.count >= LOGIN_RATE_LIMIT.MAX_ATTEMPTS) {
      entry.lockedUntil = now + LOGIN_RATE_LIMIT.LOCKOUT_MS;
    }
    loginAttemptStore.set(key, entry);
  }
}

function recordLoginSuccess(ip, identifier) {
  loginAttemptStore.delete(ip);
  if (identifier) {
    loginAttemptStore.delete(`${ip}:${identifier.toLowerCase()}`);
  }
}

function resetLoginRateLimits() {
  loginAttemptStore.clear();
}

function sharedRateLimitKeys(ip, identifier) {
  const keys = [String(ip || 'unknown')];
  if (identifier) keys.push(`${ip}:${String(identifier).toLowerCase()}`);
  return keys;
}

async function checkSharedLoginRateLimit(ip, identifier) {
  if (IS_TEST_ENV) return checkLoginRateLimit(ip, identifier);
  const prisma = getPrisma();
  // A database outage is not a login lockout. Returning `limited: true` here
  // made every local login attempt look like a brute-force block and prevented
  // the client from reporting the actual dependency failure.
  if (!prisma || !getDbStatus()) return { limited: false, retryAfter: 0, unavailable: true };
  try {
    for (const key of sharedRateLimitKeys(ip, identifier)) {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT EXTRACT(EPOCH FROM (locked_until - NOW())) AS retry_after
        FROM public.auth_rate_limits
        WHERE rate_key = $1 AND locked_until IS NOT NULL AND locked_until > NOW()
        LIMIT 1;
      `, key);
      if (rows[0]?.retry_after > 0) {
        return { limited: true, retryAfter: Math.max(1, Math.ceil(Number(rows[0].retry_after))) };
      }
    }
    return { limited: false, retryAfter: 0 };
  } catch (error) {
    console.error('[Security] Shared login limiter unavailable:', error.message);
    return { limited: false, retryAfter: 0, unavailable: true };
  }
}

async function recordSharedLoginFailure(ip, identifier) {
  if (IS_TEST_ENV) return recordLoginFailure(ip, identifier);
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) return false;
  try {
    for (const key of sharedRateLimitKeys(ip, identifier)) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO public.auth_rate_limits (rate_key, attempt_count, first_attempt_at, updated_at)
        VALUES ($1, 1, NOW(), NOW())
        ON CONFLICT (rate_key) DO UPDATE SET
          attempt_count = CASE
            WHEN auth_rate_limits.updated_at < NOW() - INTERVAL '15 minutes' THEN 1
            ELSE auth_rate_limits.attempt_count + 1
          END,
          first_attempt_at = CASE
            WHEN auth_rate_limits.updated_at < NOW() - INTERVAL '15 minutes' THEN NOW()
            ELSE auth_rate_limits.first_attempt_at
          END,
          locked_until = CASE
            WHEN auth_rate_limits.updated_at < NOW() - INTERVAL '15 minutes' THEN NULL
            WHEN auth_rate_limits.attempt_count + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
            ELSE auth_rate_limits.locked_until
          END,
          updated_at = NOW();
      `, key);
    }
    return true;
  } catch (error) {
    console.error('[Security] Could not persist login failure:', error.message);
    return false;
  }
}

async function recordSharedLoginSuccess(ip, identifier) {
  if (IS_TEST_ENV) return recordLoginSuccess(ip, identifier);
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) return false;
  try {
    for (const key of sharedRateLimitKeys(ip, identifier)) {
      await prisma.$executeRawUnsafe(`DELETE FROM public.auth_rate_limits WHERE rate_key = $1`, key);
    }
    return true;
  } catch (error) {
    console.error('[Security] Could not clear login limiter state:', error.message);
    return false;
  }
}


// Multi-Client SSE Hub with Coordinator Channel Isolation
let sseClients = [];

// Meta Cloud API Shared Server Configuration (Loaded securely from environment variables)
let metaConfig = {
  accessToken: (process.env.META_ACCESS_TOKEN || process.env.META_TOKEN || '').trim(),
  phoneNumberId: (process.env.META_PHONE_NUMBER_ID || '1358157244046701').trim(),
  phoneNumberIdRwc: (process.env.META_PHONE_NUMBER_ID_RWC || '1358157244046701').trim(),
  phoneNumberIdCras: (process.env.META_PHONE_NUMBER_ID_CRAS || '1378201582041705').trim(),
  phoneNumberIdAhc: (process.env.META_PHONE_NUMBER_ID_AHC || '1408148915714830').trim(),
  wabaId: (process.env.META_WABA_ID || '2332922997481634').trim(),
  wabaIdAhc: (process.env.META_WABA_ID_AHC || '1691829932493235').trim(),
  appSecret: (process.env.META_APP_SECRET || '').trim(),
  verifyToken: (process.env.META_VERIFY_TOKEN || 'royal_wellness_token_2026').trim()
};

// Validate Meta Cloud API secret configuration without exposing or printing value
if (metaConfig.accessToken) {
  console.log('🔒 [Security] Meta Graph API access token loaded from environment.');
} else {
  console.warn('⚠️ [Security Warning] META_ACCESS_TOKEN is not set in environment variables. Meta Cloud API dispatches will require token injection.');
}

/**
 * Validate & normalize phone numbers to international E.164 standard
 */
function normalizeE164(phone) {
  if (!phone) return { valid: false, phone: '', clean: '', canonical: '' };
  let clean = String(phone).replace(/[^0-9]/g, '');
  if (clean.startsWith('0') && clean.length === 10) {
    clean = '94' + clean.slice(1);
  } else if (clean.length === 9 && (clean.startsWith('7') || clean.startsWith('1'))) {
    clean = '94' + clean;
  }
  const valid = clean.length >= 10 && clean.length <= 15;
  return {
    valid,
    clean, // '94706373353' (for Meta API parameter "to")
    canonical: `+${clean}` // '+94706373353' (for CRM database)
  };
}

/**
 * Human-friendly error mapping for Meta WhatsApp Cloud API codes
 */
function getMetaErrorExplanation(code, rawMsg) {
  const c = Number(code);
  switch (c) {
    case 131047:
      return '24-hour customer care window is closed. More than 24 hours have passed since the customer last replied. An approved WhatsApp Message Template is required to re-engage.';
    case 131026:
      return 'Message undeliverable. The phone number is not registered on WhatsApp or has blocked business messaging.';
    case 131056:
      return 'Message template not found or not approved by Meta.';
    case 131058:
      return 'Sample/test template cannot be sent from live verified phone numbers.';
    case 131051:
      return 'Unsupported message type or media parameter.';
    case 131052:
      return 'Media download or upload failure on WhatsApp servers.';
    case 131053:
      return 'Media format or upload size exceeds WhatsApp limit.';
    case 130429:
      return 'Rate limit hit. Too many messages sent in a short period.';
    case 100:
      return `Invalid parameters: ${rawMsg || 'Please check template parameters or message format.'}`;
    case 190:
      return 'Meta API access token is expired or invalid. Please update credentials.';
    default:
      return rawMsg || `Meta Cloud API error (Code ${code})`;
  }
}


// Periodic SSE Keep-Alive Heartbeat (Prevents proxy/Render timeout drops).
// unref()'d like the other sweepers: a live keep-alive timer must never keep the
// process alive after the listener closes (it trips a libuv assertion on exit on
// Windows and blocks graceful shutdown).
setInterval(() => {
  const keepAlive = ': keepalive\n\n';
  sseClients.forEach(client => {
    try {
      client.res.write(keepAlive);
      if (typeof client.res.flush === 'function') client.res.flush();
    } catch (e) {}
  });
}, 10000).unref();

/**
 * Isolated SSE Dispatcher
 * Guarantees Coordinator A NEVER receives events belonging to Coordinator B
 * Strictly enforces Super Admin ONLY visibility for message sender audit trail
 */
function broadcastScopedSSE(targetCoordinatorId, data) {
  sseClients.forEach(client => {
    try {
      const isSuperAdmin = client.userRole === 'super_admin';
      // Super Admin and Leads Officer receive all events
      const hasFullVisibility = isSuperAdmin || client.userRole === 'leads_officer';
      
      // For message events, Coordinators receive ONLY events for leads specifically assigned to them
      const isMessageEvent = data.type === 'INBOUND_WHATSAPP_MESSAGE' || data.type === 'OUTBOUND_WHATSAPP_MESSAGE';
      const isTargetCoordinator = isMessageEvent 
        ? Boolean(targetCoordinatorId && client.coordinatorId === targetCoordinatorId)
        : (!targetCoordinatorId || client.coordinatorId === targetCoordinatorId);

      if (hasFullVisibility || isTargetCoordinator) {
        let clientData = data;
        // Strictly sanitize sender audit metadata for non-Super-Admins
        if (!isSuperAdmin && isMessageEvent) {
          const { senderName, senderRole, messageSource, sentAt, audit, ...stripped } = data;
          clientData = stripped;
        }
        client.res.write(`data: ${JSON.stringify(clientData)}\n\n`);
        if (typeof client.res.flush === 'function') client.res.flush();
      }
    } catch (e) {}
  });
}

/**
 * Safe Diagnostic Logger (No sensitive tokens, credentials, or QR data)
 */
function logWaSessionDebug(endpoint, authUser, targetCoordinatorId, sessionCtx, dbRecord) {
  console.log(`[WA SESSION DEBUG] authenticatedUserId: ${authUser?.id || 'anonymous'} | coordinatorId: ${targetCoordinatorId} | sessionId: ${sessionCtx?.sessionId || dbRecord?.id || 'none'} | phoneNumber: ${sessionCtx?.connectedPhoneNumber || dbRecord?.phoneNumber || 'none'} | socketInstanceId: ${sessionCtx?.instanceCounter || 0} | endpoint: ${endpoint} | timestamp: ${new Date().toISOString()}`);
}

/**
 * Save Base64 or DataURL media to local storage (/uploads/)
 */
function saveBase64MediaLocally(dataUrl, type = 'image', customFilename = null) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl ? { mediaUrl: dataUrl, buffer: null, mimeType: '', fileName: customFilename } : null;
  try {
    const [mimePart, base64Part] = dataUrl.split(';base64,');
    let mimeType = mimePart.replace('data:', '');
    let buffer = Buffer.from(base64Part, 'base64');
    let ext = 'bin';

    if (type === 'audio' || mimeType.includes('audio/')) {
      let inExt = 'webm';
      if (customFilename && customFilename.includes('.')) {
        inExt = customFilename.split('.').pop() || 'webm';
      } else if (mimeType.includes('ogg')) {
        inExt = 'ogg';
      } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
        inExt = 'mp4';
      } else if (mimeType.includes('wav')) {
        inExt = 'wav';
      } else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
        inExt = 'mp3';
      }

      // Convert any audio format to WhatsApp-compliant OGG Opus (48kHz mono libopus)
      const converted = convertAudioToWhatsAppOggOpus(buffer, inExt);
      if (converted && converted.length > 0) {
        buffer = converted;
        mimeType = 'audio/ogg; codecs=opus';
        ext = 'ogg';
      } else {
        ext = inExt;
      }
    } else if (customFilename && customFilename.includes('.')) {
      ext = customFilename.split('.').pop();
    } else if (type === 'image' || mimeType.includes('image/')) {
      ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    } else if (type === 'video' || mimeType.includes('video/')) {
      ext = 'mp4';
    } else if (mimeType.includes('pdf')) {
      ext = 'pdf';
    }

    const fileName = `out_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);
    saveMediaToSupabase(fileName, mimeType, buffer).catch(() => null);
    console.log(`💾 [Media Stored] Saved to: ${fileName} (${(buffer.length / 1024).toFixed(1)} KB, MIME: ${mimeType})`);
    return {
      mediaUrl: createPrivateMediaUrl(fileName),
      buffer,
      mimeType,
      fileName: (type === 'audio' || mimeType.includes('audio/')) ? `voice_note_${Date.now()}.${ext}` : (customFilename || fileName)
    };
  } catch (err) {
    console.warn('⚠️ Error saving base64 media locally:', err.message);
    return null;
  }
}

/**
 * Download Media from Meta Cloud API Graph endpoint to /uploads/
 */
async function downloadMetaMedia(mediaId, metaToken, mimeType = '', customFilename = null) {
  if (!mediaId || !metaToken) return null;
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${metaToken}` }
    });
    if (!metaRes.ok) {
      console.warn(`⚠️ Meta Media fetch failed for ID ${mediaId}:`, await metaRes.text().catch(() => ''));
      return null;
    }
    const metaData = await metaRes.json().catch(() => ({}));
    const downloadUrl = metaData.url;
    const mediaMime = metaData.mime_type || mimeType || '';

    if (!downloadUrl) return null;

    const binRes = await fetch(downloadUrl, {
      headers: { 'Authorization': `Bearer ${metaToken}` }
    });
    if (!binRes.ok) return null;

    const arrayBuffer = await binRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let ext = 'bin';
    if (customFilename && customFilename.includes('.')) {
      ext = customFilename.split('.').pop();
    } else if (mediaMime.includes('image/jpeg') || mediaMime.includes('image/jpg')) {
      ext = 'jpg';
    } else if (mediaMime.includes('image/png')) {
      ext = 'png';
    } else if (mediaMime.includes('image/webp')) {
      ext = 'webp';
    } else if (mediaMime.includes('audio/ogg') || mediaMime.includes('opus')) {
      ext = 'ogg';
    } else if (mediaMime.includes('audio/mp4') || mediaMime.includes('audio/m4a') || mediaMime.includes('audio/aac')) {
      ext = 'm4a';
    } else if (mediaMime.includes('audio/mpeg') || mediaMime.includes('audio/mp3')) {
      ext = 'mp3';
    } else if (mediaMime.includes('video/mp4')) {
      ext = 'mp4';
    } else if (mediaMime.includes('pdf')) {
      ext = 'pdf';
    } else if (mediaMime.includes('word') || mediaMime.includes('document')) {
      ext = 'docx';
    }

    const fileName = `meta_${mediaId}_${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);
    saveMediaToSupabase(fileName, mediaMime || mimeType || 'image/jpeg', buffer).catch(() => null);
    console.log(`📥 [Meta Media Downloaded] File saved to: ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return createPrivateMediaUrl(fileName);
  } catch (err) {
    console.error('❌ Error downloading Meta media:', err.message);
    return null;
  }
}

/**
 * Upload Media Buffer to Meta Cloud API to obtain media ID for dispatching
 */
async function uploadMetaMedia(phoneId, metaToken, buffer, mimeType, filename) {
  try {
    let effectiveMime = mimeType || 'application/octet-stream';
    let effectiveFilename = filename || 'file.bin';

    // Normalize audio mime types for Meta Cloud API requirements
    if (effectiveMime.includes('audio/') || effectiveFilename.endsWith('.ogg') || effectiveFilename.endsWith('.webm') || effectiveFilename.endsWith('.mp3') || effectiveFilename.endsWith('.wav') || effectiveFilename.endsWith('.m4a')) {
      if (effectiveMime.includes('ogg') || effectiveMime.includes('opus') || effectiveFilename.endsWith('.ogg') || effectiveFilename.includes('voice_note')) {
        effectiveMime = 'audio/ogg; codecs=opus';
        if (!effectiveFilename.endsWith('.ogg')) {
          effectiveFilename = effectiveFilename.replace(/\.[^/.]+$/, '') + '.ogg';
        }
      } else if (effectiveMime.includes('mp4') || effectiveMime.includes('m4a') || effectiveMime.includes('aac')) {
        effectiveMime = 'audio/mp4';
        if (!effectiveFilename.endsWith('.m4a') && !effectiveFilename.endsWith('.mp4')) {
          effectiveFilename = effectiveFilename.replace(/\.[^/.]+$/, '') + '.mp4';
        }
      } else if (effectiveMime.includes('mpeg') || effectiveMime.includes('mp3') || effectiveFilename.endsWith('.mp3')) {
        effectiveMime = 'audio/mpeg';
        if (!effectiveFilename.endsWith('.mp3')) {
          effectiveFilename = effectiveFilename.replace(/\.[^/.]+$/, '') + '.mp3';
        }
      } else {
        effectiveMime = 'audio/ogg; codecs=opus';
        effectiveFilename = 'voice_note.ogg';
      }
    }

    const formData = new FormData();
    const fileBlob = new Blob([buffer], { type: effectiveMime });
    formData.append('file', fileBlob, effectiveFilename);
    formData.append('messaging_product', 'whatsapp');

    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${metaToken}`
      },
      body: formData
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) {
      console.log(`📤 [Meta Media Uploaded] Media ID: ${data.id} (MIME: ${effectiveMime}, File: ${effectiveFilename})`);
      return data.id;
    } else {
      console.warn('⚠️ Meta Media Upload response error:', JSON.stringify(data));
      return null;
    }
  } catch (e) {
    console.error('❌ Error uploading to Meta Media API:', e.message);
    return null;
  }
}

/**
 * Canonical System Users (Used when database is unseeded or temporarily offline)
 */
const CANONICAL_USERS = [
  {
    id: 'user-admin-1',
    fullName: 'Jahan',
    email: 'admin@royalwellness.lk',
    branch: 'Colombo (Head Office)',
    password: DEFAULT_ADMIN_PASSWORD_HASH,
    pin: DEFAULT_ADMIN_PIN_HASH,
    role: 'super_admin',
    active: true
  },
  {
    id: '1124d646-210c-4a6a-8a62-4d408212e1f6',
    fullName: 'Shiman',
    email: 'mnmshiman@gmail.com',
    branch: 'Colombo (Head Office)',
    password: DEFAULT_ADMIN_PASSWORD_HASH,
    pin: SHIMAN_PIN_HASH,
    role: 'super_admin',
    active: true
  },
  {
    id: 'c0129458-4141-4b77-aeab-4cb72afdb816',
    fullName: 'Afrij',
    email: 'afrij@royalwellness.lk',
    branch: 'Colombo (Head Office)',
    password: DEFAULT_ADMIN_PASSWORD_HASH,
    pin: DEFAULT_ADMIN_PIN_HASH,
    role: 'super_admin',
    active: true
  },
  {
    id: 'user-rwcc-admin-1',
    fullName: 'RWCC',
    email: 'rwcc@royalwellness.lk',
    branch: 'Colombo (Head Office)',
    password: hashSecret('1234'),
    pin: DEFAULT_ADMIN_PIN_HASH,  // PIN: 1234
    role: 'super_admin',
    active: true
  },
  {
    id: 'user-student-1',
    fullName: 'Demo Student',
    email: 'student@royalwellness.lk',
    branch: 'Colombo',
    company: 'CRAS',
    roleTitle: 'Student',
    password: hashSecret('student'),
    pin: hashSecret('1234'),
    role: 'student',
    active: true
  },
  {
    id: 'user-faiha-1',
    fullName: 'Faiha',
    email: 'faiha@royalwellness.lk',
    branch: 'Colombo',
    company: 'RWC',
    roleTitle: 'Patient Coordinator',
    password: DEFAULT_STAFF_PASSWORD_HASH,
    pin: DEFAULT_STAFF_PIN_HASH,
    role: 'coordinator',
    active: true
  },
  {
    id: 'user-hasini-1',
    fullName: 'Hasini',
    email: 'hasini@royalwellness.lk',
    branch: 'Colombo',
    company: 'RWC',
    roleTitle: 'Patient Coordinator',
    password: DEFAULT_STAFF_PASSWORD_HASH,
    pin: DEFAULT_STAFF_PIN_HASH,
    role: 'coordinator',
    active: true
  },
  {
    id: 'user-zeenath-1',
    fullName: 'Dr. Zeenath',
    email: 'zeenath@royalwellness.lk',
    branch: 'Colombo',
    company: 'CRAS',
    roleTitle: 'Education Counsellor',
    password: DEFAULT_STAFF_PASSWORD_HASH,
    pin: DEFAULT_STAFF_PIN_HASH,
    role: 'coordinator',
    active: true
  },
  {
    id: 'user-officer-1',
    fullName: 'Sarah Fernando',
    email: 'sarah@royalwellness.lk',
    branch: 'Colombo',
    roleTitle: 'Leads Officer',
    password: DEFAULT_STAFF_PASSWORD_HASH,
    pin: DEFAULT_STAFF_PIN_HASH,
    role: 'leads_officer',
    active: true
  }
];

// Set of permanently deleted staff IDs to ensure they never reappear on reload
const DELETED_USER_IDS = new Set();

/**
 * Helper: Resolve and Authenticate CRM User from request.
 * Enforces strict cryptographic validation, expiration checks, and database verification.
 * Denies access by default and NEVER assigns super_admin or trusts client-supplied headers.
 */
async function authenticateRequest(req, parsedUrl) {
  const authHeader = req.headers['authorization'] || '';
  let rawToken = '';

  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      rawToken = match[1].trim();
    } else {
      return { user: null, error: 'Malformed Authorization header. Format must be Bearer <token>', status: 401 };
    }
  } else if (parsedUrl && parsedUrl.query && parsedUrl.query.token) {
    rawToken = String(parsedUrl.query.token).trim();
  }

  // Reject missing credentials immediately. Identity headers are never authentication.
  if (!rawToken) {
    return { user: null, error: 'Missing authentication credentials. Authorization Bearer token required.', status: 401 };
  }

  // Cryptographically verify token signature and validity
  const verification = verifyAuthToken(rawToken);
  if (!verification || !verification.valid) {
    if (verification && verification.expired) {
      return { user: null, error: 'Authentication token has expired. Please log in again.', status: 401 };
    }
    return { user: null, error: verification?.error || 'Invalid or malformed authentication token.', status: 401 };
  }

  const payload = verification.payload;
  if (!payload || !payload.userId) {
    return { user: null, error: 'Invalid token claims: missing user ID claim.', status: 401 };
  }

  // Verify identity and roles against the actual database schema
  const prisma = getPrisma();
  let dbUser = null;
  let sessionVersion = 0;
  let lockedUntil = null;
  if (prisma && getDbStatus()) {
    try {
      // Raw select so the additive session columns are read even before a
      // generated Prisma client that knows about them is deployed.
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, "fullName", email, role, branch, company, active,
                marketing_access AS "marketingAccess", session_version, locked_until
           FROM public.users WHERE id = $1 LIMIT 1`,
        payload.userId
      );
      dbUser = rows?.[0] || null;
      sessionVersion = Number(dbUser?.session_version || 0);
      lockedUntil = dbUser?.locked_until || null;
    } catch (e) {
      console.warn('Database error while validating user identity:', e.message);
      try {
        dbUser = await prisma.user.findUnique({ where: { id: payload.userId } });
      } catch {}
    }
  }

  // Test fixtures may use canonical users; production must use the database.
  if (!dbUser && IS_TEST_ENV) {
    dbUser = CANONICAL_USERS.find(u => u.id === payload.userId);
  }

  if (!dbUser) {
    return { user: null, error: 'Authenticated user does not exist in the system.', status: 401 };
  }

  if (dbUser.active === false) {
    return { user: null, error: 'Account has been deactivated. Access denied.', status: 401 };
  }

  if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
    return { user: null, error: 'Account is temporarily locked. An administrator must unlock it.', status: 401 };
  }

  // Revoking sessions increments session_version; tokens issued before the bump
  // (or issued with no version, treated as 0) stop working immediately.
  if (Number(payload.sv ?? 0) !== sessionVersion) {
    return { user: null, error: 'This session was revoked. Please sign in again.', status: 401 };
  }

  // Per-device revocation. Older tokens have no sid and remain bound to the
  // account-wide session_version check above.
  if (payload.sid) {
    try {
      const sessions = await prisma.$queryRawUnsafe(
        `SELECT id, revoked_at FROM public.user_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
        String(payload.sid), payload.userId
      );
      if (!sessions?.length || sessions[0].revoked_at) {
        return { user: null, error: 'This session was revoked. Please sign in again.', status: 401 };
      }
    } catch {}
  }

  // Enforce least privilege: role is ALWAYS derived strictly from the verified database record,
  // NEVER trusting any client-supplied role or client-supplied headers (e.g. x-coordinator-id, x-user-id).
  return {
    user: {
      id: dbUser.id,
      role: dbUser.role, // strictly 'super_admin' | 'leads_officer' | 'coordinator'
      email: dbUser.email,
      fullName: dbUser.fullName,
      branch: dbUser.branch || 'Colombo',
      company: dbUser.company || 'RWC',
      marketingAccess: dbUser.marketingAccess
    }
  };
}

/**
 * Helper: Identify whether an endpoint is public and exempt from staff Bearer authentication.
 * All other routes are protected by default and require valid credentials.
 */
function isPublicRoute(req, pathname) {
  // Media is authenticated in the static handler and must not be public.
  // 2. Staff Login & Token Issuance
  if (req.method === 'POST' && pathname === '/api/auth/login') return true;
  // 2b. One-time, explicitly authorized initial administrator bootstrap
  if (req.method === 'POST' && pathname === '/api/auth/setup') return true;
  // 2c. Public invitation preview and acceptance (the token is the credential).
  if (req.method === 'POST' && pathname === '/api/auth/accept-invitation') return true;
  if (req.method === 'GET' && pathname === '/api/auth/invitation') return true;
  // 3. Meta WhatsApp Cloud API Webhook (authenticated via hub.verify_token / Meta signatures)
  if (
    pathname === '/api/webhook' || 
    pathname === '/webhook' || 
    pathname === '/api/meta/webhook' || 
    pathname === '/meta/webhook'
  ) return true;
  // 4. Database Connection Health Check
  if (req.method === 'GET' && pathname === '/api/db/status') return true;
  // 5. Read-only treatment/course/stage catalogs. Patient, lead, appointment,
  // room, doctor and availability data remain authenticated.
  if (req.method === 'GET' && (
    pathname === '/api/categories' || 
    pathname === '/api/treatments' || 
    pathname === '/api/courses' || 
    pathname === '/api/stages' ||
    pathname === '/api/coordinators'
  )) return true;
  // 6. Student Portal & Controlled Device Security API Routes
  if (pathname.startsWith('/api/student/')) return true;

  return false;
}

// Start HTTP REST & SSE Gateway Server
const server = http.createServer(async (req, res) => {
// Socket.io will be attached after this file is imported
  const correlationId = createCorrelationId(req.headers['x-request-id']);
  res.setHeader('X-Correlation-Id', correlationId);
  // CORS Headers
  const requestOrigin = req.headers.origin;
  if (requestOrigin && isAllowedOrigin(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Hub-Signature-256, x-coordinator-id, x-user-id');
  res.setHeader('Access-Control-Max-Age', '86400');

  const requestLimit = getBodyLimit(new URL(req.url || '/', 'http://localhost').pathname || '/');
  const declaredLength = Number(req.headers['content-length'] || 0);
  if (declaredLength > requestLimit) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Request body too large.' }));
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const rawParsedUrl = new URL(req.url || '/', 'http://localhost');
  const parsedUrl = {
    pathname: rawParsedUrl.pathname,
    query: Object.fromEntries(rawParsedUrl.searchParams.entries()),
    searchParams: rawParsedUrl.searchParams
  };
  // Older/cached frontend bundles may still send `/api/api/...` when their
  // configured API URL already includes `/api`. Collapse duplicate prefixes
  // before public-route and authentication checks so login remains reachable.
  const pathname = String(parsedUrl.pathname || '/').replace(/^\/api(?:\/api)+(?=\/|$)/i, '/api');
  parsedUrl.pathname = pathname;

  // 0. Static Uploads File Serving with Supabase Persistent Recovery & Disk Cache
  if (pathname.startsWith('/uploads/')) {
    // path.basename() guarantees the decoded name cannot escape the uploads directory.
    const filename = path.basename(decodeURIComponent(pathname));
    const signedAccess = verifyPrivateMediaUrl(filename, parsedUrl.query.exp, parsedUrl.query.sig);

    // Browsers load <img>/<audio>/<video> without an Authorization header, so a valid
    // per-file signature is the primary mechanism for rendering historical media.
    // Bearer auth remains a supported alternative for programmatic clients.
    if (!signedAccess) {
      const mediaAuth = await authenticateRequest(req, parsedUrl);
      if (!mediaAuth.user) {
        await auditSecurityEvent({ correlationId, actorId: null, action: 'media.access', resource: filename, outcome: 'denied' });
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'A valid signed media URL or Bearer authentication is required.' }));
        return;
      }
      if (mediaAuth.user.role === 'coordinator') {
        const prisma = getPrisma();
        const allowed = prisma && getDbStatus()
          ? await prisma.message.findFirst({
              where: {
                mediaUrl: { contains: filename },
                lead: { assignedTo: mediaAuth.user.id }
              },
              select: { id: true }
            }).catch(() => null)
          : null;
        if (!allowed) {
          await auditSecurityEvent({ correlationId, actorId: mediaAuth.user.id, action: 'media.access', resource: filename, outcome: 'denied' });
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'You are not authorized to access this media.' }));
          return;
        }
      }
      await auditSecurityEvent({ correlationId, actorId: mediaAuth.user.id, action: 'media.access', resource: filename, outcome: 'success' });
    }
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const filePath = path.join(uploadDir, filename);

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'audio/ogg',
      '.opus': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    let contentType = mimeTypes[ext] || 'application/octet-stream';

    // 1. Check local disk cache first
    if (fs.existsSync(filePath)) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.size > 0) {
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stat.size,
            'Cache-Control': 'public, max-age=31536000, immutable'
          });
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      } catch (e) {}
    }

    // 2. Fallback to Supabase Database (Persistent cloud storage)
    try {
      const mediaRecord = await getMediaFromSupabase(filename);
      if (mediaRecord && mediaRecord.buffer && mediaRecord.buffer.length > 0) {
        // Asynchronously write to local disk cache for fast future requests
        try {
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
          fs.writeFile(filePath, mediaRecord.buffer, () => {});
        } catch (cacheErr) {}

        const finalMime = mediaRecord.mimeType || contentType;
        res.writeHead(200, {
          'Content-Type': finalMime,
          'Content-Length': mediaRecord.buffer.length,
          'Cache-Control': 'public, max-age=31536000, immutable'
        });
        res.end(mediaRecord.buffer);
        return;
      }
    } catch (dbErr) {
      console.warn(`⚠️ [Uploads] Supabase lookup error for ${filename}:`, dbErr.message);
    }

    // 3. Ultimate Fallback: Re-download on-demand from Meta Graph API if it's an inbound Meta media ID
    if (filename.startsWith('meta_') && metaConfig.accessToken) {
      try {
        const parts = filename.split('_');
        const mediaId = parts[1];
        if (mediaId) {
          console.log(`⏳ [Uploads] Re-fetching Meta media ${mediaId} on-demand...`);
          const metaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${metaConfig.accessToken}` }
          });
          if (metaRes.ok) {
            const metaData = await metaRes.json().catch(() => ({}));
            if (metaData.url) {
              const binRes = await fetch(metaData.url, {
                headers: { 'Authorization': `Bearer ${metaConfig.accessToken}` }
              });
              if (binRes.ok) {
                const arrayBuffer = await binRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const fetchedMime = metaData.mime_type || contentType;

                // Save to local disk cache & Supabase
                try {
                  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
                  fs.writeFileSync(filePath, buffer);
                } catch (e) {}
                saveMediaToSupabase(filename, fetchedMime, buffer).catch(() => null);

                res.writeHead(200, {
                  'Content-Type': fetchedMime,
                  'Content-Length': buffer.length,
                  'Cache-Control': 'public, max-age=31536000, immutable'
                });
                res.end(buffer);
                return;
              }
            }
          }
        }
      } catch (metaErr) {
        console.warn(`⚠️ [Uploads] Meta fallback error for ${filename}:`, metaErr.message);
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'File not found' }));
    return;
  }

  // 0b. Explicit one-time initial administrator bootstrap
  if (req.method === 'POST' && pathname === '/api/auth/setup') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const setupToken = String(payload.setupToken || '');
        const configuredSetupToken = String(process.env.INITIAL_ADMIN_SETUP_TOKEN || '');
        const prisma = getPrisma();
        const used = await getSystemSetting('INITIAL_ADMIN_SETUP_USED').catch(() => '');
        const existingAdmin = prisma && getDbStatus() ? await prisma.user.findFirst({ where: { role: 'super_admin', active: true } }).catch(() => null) : null;
        if (!configuredSetupToken || used === 'true' || existingAdmin || setupToken !== configuredSetupToken) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Initial administrator setup is unavailable.' }));
          return;
        }
        const fullName = String(payload.fullName || '').trim();
        const email = String(payload.email || '').trim().toLowerCase();
        const password = String(payload.password || '');
        if (!fullName || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12 || !prisma || !getDbStatus()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Provide a valid name, email, 12-character password, and a connected database.' }));
          return;
        }
        const created = await prisma.user.create({
          data: { fullName, email, password: hashSecret(password), role: 'super_admin', active: true }
        });
        await setSystemSetting('INITIAL_ADMIN_SETUP_USED', 'true');
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, user: { id: created.id, fullName: created.fullName, email: created.email, role: created.role } }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Malformed or invalid setup request.' }));
      }
    });
    return;
  }

  // 0c. User Login & Token Issuer Endpoint
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const identifier = (payload.identifier || payload.email || payload.username || '').trim().toLowerCase();
        
        // Extract credentials: password, pin, or secret
        const passwordCandidate = payload.password !== undefined ? String(payload.password).trim() : '';
        const pinCandidate = payload.pin !== undefined ? String(payload.pin).trim() : '';
        const secretCandidate = payload.secret !== undefined ? String(payload.secret).trim() : '';

        const ip = getClientIp(req);

        // Missing credentials check (reject empty/missing identifier or empty/missing secrets)
        const candidates = [passwordCandidate, pinCandidate, secretCandidate].filter(Boolean);
        if (!identifier || candidates.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Identifier and password or PIN are required.' }));
          return;
        }

        // Rate limit check
        const rateCheck = await checkSharedLoginRateLimit(ip, identifier);
        if (rateCheck.limited) {
          res.writeHead(429, { 
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.retryAfter)
          });
          res.end(JSON.stringify({ 
            success: false, 
            error: 'Too many failed login attempts. Please try again later.' 
          }));
          return;
        }
        if (rateCheck.unavailable) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Authentication service is unavailable because the database cannot be reached.'
          }));
          return;
        }

        // Authoritative user resolution
        const prisma = getPrisma();
        let user = null;
        let isDbUser = false;
        const adminAliases = ['admin', 'superadmin', 'super_admin'];
        if (prisma && getDbStatus()) {
          try {
            const targetIds = adminAliases.includes(identifier) ? [identifier, 'user-admin-1'] : [identifier];
            const targetEmails = adminAliases.includes(identifier) ? [identifier, 'admin@royalwellness.lk'] : [identifier];
            user = await prisma.user.findFirst({
              where: {
                OR: [
                  { id: { in: targetIds } },
                  { email: { in: targetEmails, mode: 'insensitive' } }
                ]
              }
            });
            if (user) isDbUser = true;
          } catch (e) {}
        }

        // Canonical users exist only as isolated test fixtures. Production authentication
        // must succeed against the database and must never silently fall back offline.
        if (!user && IS_TEST_ENV) {
          user = CANONICAL_USERS.find(u => 
            u.id.toLowerCase() === identifier || 
            u.email.toLowerCase() === identifier ||
            (adminAliases.includes(identifier) && u.role === 'super_admin')
          );
        }

        // Generic authentication failure helper (constant response & status to prevent account enumeration)
        const sendAuthFailure = async () => {
          await recordSharedLoginFailure(ip, identifier);
          auditSecurityEvent({ correlationId, action: 'auth.login', resource: identifier || 'unknown', outcome: 'failure', metadata: { ip } });
          dummyVerify(candidates[0]); // Constant-time side-channel mitigation
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid credentials.' }));
        };

        // User not found -> generic failure
        if (!user) {
          return await sendAuthFailure();
        }

        // Deactivated account -> generic failure (do not disclose account existence or status)
        if (user.active === false) {
          return await sendAuthFailure();
        }

        // Account lock and session version are read defensively so login still
        // works while the additive schema bootstrap is finishing.
        let sessionVersion = 0;
        let lockedUntil = null;
        if (isDbUser && prisma && getDbStatus()) {
          try {
            const state = await prisma.$queryRawUnsafe(
              `SELECT session_version, locked_until FROM public.users WHERE id = $1 LIMIT 1`,
              user.id
            );
            sessionVersion = Number(state?.[0]?.session_version || 0);
            lockedUntil = state?.[0]?.locked_until || null;
          } catch {}
        }
        if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
          return await sendAuthFailure();
        }

        // Credential resolution with default fallbacks
        const expectedPassword = user.password || (IS_TEST_ENV ? (user.role === 'super_admin' ? DEFAULT_ADMIN_PASSWORD_HASH : DEFAULT_STAFF_PASSWORD_HASH) : '');
        const expectedPin = user.pin || (IS_TEST_ENV ? (user.role === 'super_admin' ? DEFAULT_ADMIN_PIN_HASH : DEFAULT_STAFF_PIN_HASH) : '');

        // Verify candidates
        let matched = false;
        let matchedField = null;
        let needsMigration = false;
        let plainSecretUsed = '';

        for (const candidate of candidates) {
          // Check against password
          const passResult = verifySecret(candidate, expectedPassword);
          if (passResult.match) {
            matched = true;
            matchedField = 'password';
            needsMigration = passResult.needsRehash;
            plainSecretUsed = candidate;
            break;
          }
          // Check against PIN
          const pinResult = verifySecret(candidate, expectedPin);
          if (pinResult.match) {
            matched = true;
            matchedField = 'pin';
            needsMigration = pinResult.needsRehash;
            plainSecretUsed = candidate;
            break;
          }

          // Backward-compatibility: if Super Admin with pre-migration cached pin '2026' or 'staff'
          if (IS_TEST_ENV && (user.role === 'super_admin' || user.id === 'user-admin-1')) {
            const adminFallbackPass = verifySecret(candidate, DEFAULT_STAFF_PASSWORD_HASH);
            const adminFallbackPin = verifySecret(candidate, DEFAULT_STAFF_PIN_HASH);
            if (adminFallbackPass.match || adminFallbackPin.match || ['admin', '1234', 'staff', '2026'].includes(candidate)) {
              matched = true;
              matchedField = 'password';
              needsMigration = true;
              plainSecretUsed = 'admin';
              break;
            }
          } else if (IS_TEST_ENV) {
            // Coordinator / Leads Officer fallback
            const staffFallbackPass = verifySecret(candidate, DEFAULT_STAFF_PASSWORD_HASH);
            const staffFallbackPin = verifySecret(candidate, DEFAULT_STAFF_PIN_HASH);
            if (staffFallbackPass.match || staffFallbackPin.match || ['staff', '2026'].includes(candidate)) {
              matched = true;
              matchedField = 'password';
              needsMigration = true;
              plainSecretUsed = 'staff';
              break;
            }
          }
        }

        if (!matched) {
          return await sendAuthFailure();
        }

        // Safe Transparent Migration:
        // If legacy plaintext was matched, seamlessly upgrade stored hash in database to scrypt
        if (needsMigration && plainSecretUsed) {
          const newHash = hashSecret(plainSecretUsed);
          if (isDbUser && prisma && getDbStatus()) {
            prisma.user.update({
              where: { id: user.id },
              data: { [matchedField]: newHash }
            }).catch(err => {
              console.warn(`[Auth Migration] Background hash migration failed for ${user.id}:`, err.message);
            });
          } else if (!isDbUser) {
            user[matchedField] = newHash;
          }
        }

        // Reset rate limit counters on successful authentication
        await recordSharedLoginSuccess(ip, identifier);

        // Record a server-side session so revocation can be real and per-device.
        let sessionId = null;
        if (isDbUser && prisma && getDbStatus()) {
          try {
            sessionId = crypto.randomUUID();
            const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);
            await prisma.$executeRawUnsafe(
              `INSERT INTO public.user_sessions (id, user_id, token_version, ip, user_agent)
               VALUES ($1, $2, $3, $4, $5)`,
              sessionId, user.id, sessionVersion, String(ip || '').slice(0, 100), userAgent
            );
            await prisma.$executeRawUnsafe(
              `UPDATE public.users SET last_login_at = NOW(), locked_until = NULL WHERE id = $1`,
              user.id
            );
          } catch (sessionError) {
            sessionId = null;
            console.warn('[Auth] Session record could not be stored:', sessionError.message);
          }
        }

        await auditSecurityEvent({
          correlationId, actorId: user.id, action: 'auth.login', resource: user.id, outcome: 'success',
          metadata: { ip, method: matchedField, sessionId, userAgent: String(req.headers['user-agent'] || '').slice(0, 160) },
        });

        const token = signAuthToken({
          userId: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
          sid: sessionId,
          sv: sessionVersion,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role
          }
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Malformed request payload.' }));
      }
    });
    return;
  }

  // 0d. Public invitation acceptance (one-time token, stored hashed).
  if (
    (req.method === 'POST' && pathname === '/api/auth/accept-invitation') ||
    (req.method === 'GET' && pathname === '/api/auth/invitation')
  ) {
    const prisma = getPrisma();
    if (!prisma || !getDbStatus()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invitation service is unavailable.' }));
      return;
    }
    const hashInviteToken = value => crypto.createHash('sha256').update(String(value)).digest('hex');

    if (req.method === 'GET') {
      const token = String(parsedUrl.query.token || '');
      if (!token) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'An invitation token is required.' }));
        return;
      }
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT email, full_name, role, expires_at, accepted_at, revoked_at
             FROM public.user_invitations WHERE token_hash = $1 LIMIT 1`,
          hashInviteToken(token)
        );
        const invite = rows?.[0];
        if (!invite || invite.accepted_at || invite.revoked_at || new Date(invite.expires_at) < new Date()) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'This invitation is invalid or has expired.' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          invitation: { email: invite.email, fullName: invite.full_name, role: invite.role, expiresAt: invite.expires_at },
        }));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invitation could not be loaded.' }));
      }
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const token = String(payload.token || '').trim();
        const password = String(payload.password || '');
        const pin = String(payload.pin || '').trim();
        if (!token || password.length < 12 || (pin && pin.length < 4)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Provide the invitation token and a password of at least 12 characters.' }));
          return;
        }
        const rows = await prisma.$queryRawUnsafe(
          `SELECT * FROM public.user_invitations WHERE token_hash = $1 LIMIT 1`,
          hashInviteToken(token)
        );
        const invite = rows?.[0];
        if (!invite || invite.accepted_at || invite.revoked_at || new Date(invite.expires_at) < new Date()) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'This invitation is invalid or has expired.' }));
          return;
        }
        const existing = await prisma.user.findUnique({ where: { email: invite.email } }).catch(() => null);
        if (existing) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'An account already exists for this email. Sign in instead.' }));
          return;
        }
        const created = await prisma.user.create({
          data: {
            fullName: invite.full_name,
            email: invite.email,
            role: invite.role,
            company: invite.company,
            branch: invite.branch || 'Colombo',
            password: hashSecret(password),
            ...(pin ? { pin: hashSecret(pin) } : {}),
            active: true,
          },
        });
        if (invite.department_id) {
          await prisma.$executeRawUnsafe(
            `UPDATE public.users SET department_id = $1 WHERE id = $2`,
            invite.department_id, created.id
          ).catch(() => {});
        }
        await prisma.$executeRawUnsafe(
          `UPDATE public.user_invitations SET accepted_at = NOW() WHERE id = $1`,
          invite.id
        );
        await prisma.$executeRawUnsafe(
          `UPDATE public.user_invitations SET revoked_at = NOW()
            WHERE LOWER(email) = LOWER($1) AND id <> $2 AND accepted_at IS NULL AND revoked_at IS NULL`,
          invite.email, invite.id
        );
        await auditSecurityEvent({
          correlationId, actorId: created.id, action: 'user.invitation.accept',
          resource: `user:${created.id}`, outcome: 'success', metadata: { invitationId: invite.id },
        });
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          user: { id: created.id, email: created.email, fullName: created.fullName, role: created.role },
        }));
      } catch (err) {
        console.error('[Invitation] Acceptance failed:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'The invitation could not be accepted.' }));
      }
    });
    return;
  }


  // Strict Authentication Enforcement for All Protected CRM Routes (Deny by default)
  let authUser = null;

  // Milestone 2: Student Portal & Controlled Device Security Routes
  if (await handleStudentRoutes(req, res, pathname, authUser)) return;

  if (!isPublicRoute(req, pathname)) {
    if (req.method === 'GET' && pathname === '/api/events') {
      if (parsedUrl.query.ticket) {
        authUser = consumeSseTicket(String(parsedUrl.query.ticket));
      } else if (parsedUrl.query.token) {
        const verified = verifyAuthToken(String(parsedUrl.query.token));
        if (verified.valid) {
          authUser = verified.payload;
        }
      }
    }
    if (!authUser) {
      const authResult = await authenticateRequest(req, parsedUrl);
      if (!authResult.user) {
        sendApiError(res, authResult.status || 401, 'UNAUTHORIZED', authResult.error || 'Unauthorized: Valid authentication credentials required.', correlationId);
        return;
      }
      authUser = authResult.user;
    }
    const auditAction = pathname.startsWith('/api/leads') ? 'lead.access' :
      pathname.startsWith('/api/appointments') ? 'appointment.access' :
      pathname.startsWith('/api/messages') || pathname.startsWith('/api/send') ? 'whatsapp.operation' :
      pathname.startsWith('/api/coordinators') || pathname.startsWith('/api/users') ? 'staff.change' :
      pathname.startsWith('/api/admin') ? 'admin.configuration' : 'api.request';
    await auditSecurityEvent({ correlationId, actorId: authUser.id, action: auditAction, resource: pathname, outcome: 'authorized', metadata: { method: req.method } });
  }

  // The frontend must bind its session to this server-resolved identity.  Do not
  // return token claims here: authenticateRequest has already verified the bearer
  // token and loaded the active user record from the database.
  if (req.method === 'GET' && pathname === '/api/auth/session') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, user: authUser }));
    return;
  }

  if (await handleExamOperations(req, res, pathname, authUser)) return;
  if (await handleSecurityRoutes(req, res, pathname, authUser, correlationId)) return;
  if (await handleUserManagementRoutes(req, res, pathname, authUser, correlationId)) return;
  if (await handleStudentDatabaseRoutes(req, res, pathname, authUser)) return;
  if (await handleClinicalRoutes(req, res, pathname, authUser)) return;
  if (await handleExamRoutes(req, res, pathname, authUser)) return;

  // 0. Appointment Booking & Room Scheduling Module
  const handledAppointmentRoute = await handleAppointmentRoutes(req, res, pathname, authUser);
  if (handledAppointmentRoute !== false) {
    return;
  }

  // Public Contact Marketing is a separate protected domain. Its route module
  // owns capability checks and must never fall through into lead/contact handlers.
  const handledMarketingRoute = await handleMarketingRoutes(req, res, pathname, authUser);
  if (handledMarketingRoute !== false) {
    return;
  }

  // 0a. File Upload Endpoint (Authenticated staff base64 or DataURL upload for Images, Audio, Voice Notes, PDFs)
  if (req.method === 'POST' && pathname === '/api/upload') {
    if (!authUser?.id) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Sign in first.' }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const dataUrl = payload.dataUrl || payload.url || payload.base64 || '';
        const type = payload.type || 'document';
        const fileName = payload.fileName || payload.filename || null;

        if (!dataUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing dataUrl payload' }));
          return;
        }

        const saved = saveBase64MediaLocally(dataUrl, type, fileName);
        if (saved && saved.mediaUrl) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, url: saved.mediaUrl, mediaUrl: saved.mediaUrl, type, fileName: saved.fileName }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Could not process media upload' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Central Clinic WhatsApp Master Session ID
  const masterLineId = 'user-admin-1';

  // 1. Health & Central Clinic WhatsApp Status (Meta Cloud API Native)
  if (req.method === 'GET' && (pathname === '/api/status' || pathname === '/api/whatsapp/status')) {
    const hasMeta = Boolean((metaConfig.accessToken || process.env.META_ACCESS_TOKEN || '').trim());
    const status = hasMeta ? 'connected' : 'disconnected';
    const phone = '94706393353';

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status,
      phone,
      hasQr: false,
      provider: 'meta_cloud_api',
      coordinatorId: masterLineId,
      authenticatedUserId: authUser.id,
      sessionId: 'meta-cloud-api-session',
      db: {
        connected: getDbStatus(),
      }
    }));
    return;
  }

  // 2. Database Status Check
  if (req.method === 'GET' && pathname === '/api/db/status') {
    const dbRes = await checkDbConnection();
    // Surface the schema-bootstrap outcome. A failed delta leaves the app running against
    // a stale schema with no other signal, so the health check reports it. Only counts and
    // the failing statement are exposed — never row data or credentials.
    let schema = null;
    if (dbRes.connected) {
      try {
        const boot = await waitForSchemaBootstrap();
        schema = boot && boot.ok !== undefined
          ? { ok: Boolean(boot.ok), failures: (boot.failures || []).length, failedStatements: (boot.failures || []).map(f => f.sql).slice(0, 10) }
          : null;
      } catch (e) {
        schema = { ok: false, failures: 1, failedStatements: ['(bootstrap)'] };
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(schema ? { ...dbRes, schema } : dbRes));
    return;
  }

  // 3. Central Clinic WhatsApp QR Code Endpoint (Not needed under Meta Cloud API)
  if (req.method === 'GET' && (pathname === '/api/qr' || pathname === '/api/whatsapp/qr')) {
    const hasMeta = Boolean((metaConfig.accessToken || process.env.META_ACCESS_TOKEN || '').trim());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      qr: null,
      status: hasMeta ? 'connected' : 'disconnected',
      phone: '94706393353',
      provider: 'meta_cloud_api',
      message: 'Meta WhatsApp Cloud API is active. QR code pairing is not required.',
      coordinatorId: masterLineId,
      authenticatedUserId: authUser.id,
      sessionId: 'meta-cloud-api-session'
    }));
    return;
  }

  // 3b. Reconnect / Refresh Status
  if (req.method === 'POST' && (pathname === '/api/reconnect' || pathname === '/api/connect' || pathname === '/api/whatsapp/reconnect')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      status: 'connected',
      provider: 'meta_cloud_api',
      message: 'Meta WhatsApp Cloud API connection active.',
      coordinatorId: masterLineId,
      authenticatedUserId: authUser.id
    }));
    return;
  }

  // 4. Isolated Server-Sent Events (SSE) Live Feed
  if (req.method === 'POST' && pathname === '/api/events/ticket') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: true, ticket: issueSseTicket(authUser) }));
    return;
  }

  if (req.method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const clientObj = {
      res,
      coordinatorId: authUser.id,
      userRole: authUser.role,
    };

    sseClients.push(clientObj);

    const hasMeta = Boolean((metaConfig.accessToken || process.env.META_ACCESS_TOKEN || '').trim());

    res.write(`data: ${JSON.stringify({
      type: 'INIT',
      status: hasMeta ? 'connected' : 'disconnected',
      phone: '94706393353',
      qrDataUrl: null,
      provider: 'meta_cloud_api',
      coordinatorId: authUser.id,
      authenticatedUserId: authUser.id,
      sessionId: 'meta-cloud-api-session',
      dbConnected: getDbStatus(),
    })}\n\n`);

    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== clientObj);
    });
    return;
  }

  // 5. Send Outbound WhatsApp Message (Dispatched via Coordinator's Socket)
  if (req.method === 'POST' && (pathname === '/api/send' || pathname === '/api/send-message' || pathname === '/api/whatsapp/send')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const to = payload.to || payload.phone || '';
        const whatsappId = payload.whatsappId || payload.waId || '';
        const msgContent = payload.message || payload.text || payload.content || '';
        const media = payload.media;
        const leadId = payload.leadId;
        const customerId = payload.customerId;
        const targetCoordinatorId = payload.coordinatorId || authUser?.id || masterLineId;

        if (!to && !whatsappId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing recipient "to" or "whatsappId" field' }));
          return;
        }

        if (!msgContent && !media) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing message text or media content' }));
          return;
        }

        // RBAC: Check coordinator authorization for this specific lead or contact
        if (authUser.role === 'coordinator') {
          const prisma = getPrisma();
          if (prisma && getDbStatus()) {
            let checkLead = null;
            if (leadId) {
              checkLead = await prisma.lead.findUnique({ where: { id: leadId } }).catch(() => null);
            }
            if (!checkLead && (to || whatsappId)) {
              const cleanDigits = String(to || whatsappId).replace(/[^0-9]/g, '');
              if (cleanDigits.length >= 7) {
                checkLead = await prisma.lead.findFirst({
                  where: {
                    OR: [
                      { customer: { whatsappNumber: { contains: cleanDigits.slice(-9) } } },
                      { customer: { phoneNumber: { contains: cleanDigits.slice(-9) } } },
                      { customer: { whatsappId: { contains: cleanDigits.slice(-9) } } }
                    ]
                  }
                }).catch(() => null);
              }
            }
            if (checkLead && checkLead.assignedTo && checkLead.assignedTo !== authUser.id) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Forbidden: You can only message leads assigned to you.' }));
              return;
            }
          }
        }

        let sendResult = null;

        // Meta Cloud API token resolution (server configured or payload supplied)
        const metaToken = (metaConfig.accessToken || process.env.META_ACCESS_TOKEN || process.env.META_TOKEN || '').trim();
        
        // 1. Phone validation in international format
        const norm = normalizeE164(to || whatsappId);
        if (!norm.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: `Invalid phone number format: "${to || whatsappId}". International E.164 format required (10-15 digits, e.g. 94706373353 or +94706373353).`
          }));
          return;
        }
        const cleanTo = norm.clean;
        const formattedTo = norm.canonical;

        // Consent Governance & Suppression Gate Check
        const msgType = payload.templateName || payload.type === 'template' ? 'template' : (media ? 'media' : 'text');
        try {
          const gateCheck = await canSendWhatsApp(formattedTo, msgType, {
            templateName: payload.templateName,
            check24hWindow: false
          });
          if (!gateCheck.allowed) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              code: gateCheck.code || 'MESSAGING_CONSENT_DENIED',
              error: gateCheck.reason
            }));
            return;
          }
        } catch (e) {
          // If gate check fails unexpectedly, be conservative for marketing contacts is handled inside; otherwise allow CRM flow
          console.warn('[ConsentGate] /api/send check failed:', e?.message);
        }

        // 2. Resolve company & correct Meta Cloud API Phone Number ID
        const prisma = getPrisma();
        let resolvedCompany = payload.company;
        if (!resolvedCompany && leadId && prisma && getDbStatus()) {
          const checkLead = await prisma.lead.findUnique({ where: { id: leadId } }).catch(() => null);
          if (checkLead?.company === 'AHC' || checkLead?.source === 'AHC') {
            resolvedCompany = 'AHC';
          } else if (checkLead?.company === 'CRAS' || checkLead?.source === 'CRAS') {
            resolvedCompany = 'CRAS';
          }
        }
        let targetPhoneId = payload.phoneNumberId;
        if (!targetPhoneId) {
          targetPhoneId = resolvedCompany === 'AHC'
            ? (metaConfig.phoneNumberIdAhc || COMPANIES.AHC.phoneId)
            : (resolvedCompany === 'CRAS' ? (metaConfig.phoneNumberIdCras || COMPANIES.CRAS.phoneId) : (metaConfig.phoneNumberIdRwc || metaConfig.phoneNumberId));
        }
        const phoneId = (targetPhoneId || metaConfig.phoneNumberId || '1358157244046701').trim();

        let savedMediaUrl = null;
        let localMediaInfo = null;

        if (media && (media.dataUrl || media.url)) {
          const rawUrl = media.dataUrl || media.url;
          if (rawUrl.startsWith('data:')) {
            localMediaInfo = saveBase64MediaLocally(rawUrl, media.type, media.fileName);
            if (localMediaInfo) {
              savedMediaUrl = localMediaInfo.mediaUrl;
            }
          } else if (rawUrl.startsWith('/uploads/')) {
            savedMediaUrl = rawUrl;
          }
        }

        // 3. Dispatch directly via Meta Cloud API using the clinic's official numbers (CRAS +94 70 637 3353 / RWC +94 70 639 3353)
        if (metaToken) {
          console.log(`🚀 [Meta Graph API] Dispatching message to ${cleanTo} via Phone ID ${phoneId} (${resolvedCompany || 'RWC'})...`);
          let metaPayload = null;

          if (media && localMediaInfo) {
            const metaMediaId = await uploadMetaMedia(phoneId, metaToken, localMediaInfo.buffer, localMediaInfo.mimeType, localMediaInfo.fileName);
            if (metaMediaId) {
              if (media.type === 'image') {
                metaPayload = {
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: cleanTo,
                  type: 'image',
                  image: { id: metaMediaId, caption: msgContent || undefined }
                };
              } else if (media.type === 'audio') {
                metaPayload = {
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: cleanTo,
                  type: 'audio',
                  audio: { id: metaMediaId }
                };
              } else if (media.type === 'video') {
                metaPayload = {
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: cleanTo,
                  type: 'video',
                  video: { id: metaMediaId, caption: msgContent || undefined }
                };
              } else {
                metaPayload = {
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: cleanTo,
                  type: 'document',
                  document: { id: metaMediaId, filename: media.fileName || 'document.pdf', caption: msgContent || undefined }
                };
              }
            }
          }

          if (!metaPayload) {
            metaPayload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanTo,
              type: 'text',
              text: { body: msgContent || (media ? `[${media.type?.toUpperCase()} Attachment]` : '') }
            };
          }

          const metaRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${metaToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(metaPayload)
          });
          const metaData = await metaRes.json().catch(() => ({}));

          // If Meta rejects the message, DO NOT display success or false delivery status!
          if (!metaRes.ok) {
            console.error('❌ [Meta Graph API Error]:', JSON.stringify(metaData));
            const errCode = metaData.error?.code || 500;
            const rawMsg = metaData.error?.message || metaData.error?.error_user_msg || (metaData.error ? JSON.stringify(metaData.error) : 'Meta Cloud API dispatch failed');

            // 24-hour customer care window closed error (131047) - Auto-fallback to official Meta approved template
            if (errCode === 131047) {
              console.log(`⚠️ [24h Window Closed] Meta error 131047 for ${cleanTo}. Attempting auto-fallback to approved Meta template...`);
              const fallbackTplName = (resolvedCompany === 'AHC') ? 'ahc_welcome_greeting' : ((resolvedCompany === 'CRAS') ? 'cras_welcome_greeting' : 'rwc_welcome_greeting');
              let recipientName = resolvedCompany === 'CRAS' ? 'Dr. Perera' : 'Valued Client';
              if (prisma && getDbStatus()) {
                try {
                  const checkCust = customerId ? await prisma.customer.findUnique({ where: { id: customerId } }).catch(() => null) : null;
                  if (checkCust?.displayName) recipientName = checkCust.displayName;
                } catch (e) {}
              }

              const fallbackPayload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanTo,
                type: 'template',
                template: {
                  name: fallbackTplName,
                  language: { code: 'en_US' },
                  components: [
                    {
                      type: 'body',
                      parameters: [
                        { type: 'text', text: recipientName }
                      ]
                    }
                  ]
                }
              };

              console.log(`🚀 [24h Auto-Fallback] Dispatching "${fallbackTplName}" to ${cleanTo} via Phone ID ${phoneId}...`);
              const fallbackRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${metaToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(fallbackPayload)
              });

              const fallbackData = await fallbackRes.json().catch(() => ({}));
              if (fallbackRes.ok && fallbackData.messages?.[0]?.id) {
                const fbMsgId = fallbackData.messages[0].id;
                console.log(`✅ [24h Auto-Fallback Success] Meta template "${fallbackTplName}" dispatched! Message ID: ${fbMsgId}`);
                
                msgContent = fallbackTplName === 'ahc_welcome_greeting'
                  ? `Hello ${recipientName}, thank you for reaching out to Alpha Health Consultancy. We are delighted to assist you with our health consultancy services. How may our team assist you today?`
                  : fallbackTplName === 'cras_welcome_greeting'
                  ? `Hello ${recipientName}, thank you for reaching out to the College of Royal Aesthetic of Sri Lanka (CRAS). We are delighted to assist you with our diploma programs and aesthetic training courses. How may our team assist you today?`
                  : `Hello ${recipientName}, thank you for reaching out to Royal Wellness Center. We are delighted to assist you with our medical and aesthetic treatments. How may our team assist you today?`;

                sendResult = {
                  success: true,
                  messageId: fbMsgId,
                  status: 'sent',
                  to: cleanTo,
                  meta: fallbackData,
                  fallbackTemplateUsed: true,
                  templateName: fallbackTplName
                };
              } else {
                console.warn('❌ [24h Fallback Dispatch Failed]:', JSON.stringify(fallbackData));
              }
            }

            if (!sendResult) {
              const explanation = getMetaErrorExplanation(errCode, rawMsg);

              // Save failed message to database so it appears with error details in CRM
              const failedMsgId = payload.retryMessageId || `failed-${Date.now()}`;
              const actualSenderId = authUser?.id || payload.senderId || null;
              const actualSenderName = authUser?.fullName || payload.senderName || 'Staff';
              const actualSenderRole = authUser?.role === 'super_admin' ? 'Super Admin' : (authUser?.roleTitle || payload.senderRole || (authUser?.role === 'leads_officer' ? 'Sales Officer' : 'Sales Officer'));
              const actualSource = payload.messageSource || (authUser ? 'CRM User' : 'System');
              const sentAtUtc = new Date();

              if (prisma && getDbStatus() && leadId) {
                try {
                  let cust = customerId ? await prisma.customer.findUnique({ where: { id: customerId } }).catch(() => null) : null;
                  if (!cust && cleanTo) {
                    cust = await prisma.customer.findFirst({
                      where: { OR: [{ whatsappNumber: formattedTo }, { whatsappNumber: cleanTo }, { whatsappId: cleanTo }] }
                    }).catch(() => null);
                  }

                  await prisma.message.upsert({
                    where: { id: failedMsgId },
                    update: {
                      status: 'failed',
                      errorCode: errCode,
                      errorMessage: explanation,
                      content: msgContent || (media ? `[${media.type?.toUpperCase()}]` : ''),
                      senderName: actualSenderName,
                      senderRole: actualSenderRole,
                      messageSource: actualSource,
                      sentAt: sentAtUtc
                    },
                    create: {
                      id: failedMsgId,
                      leadId,
                      customerId: cust?.id || customerId || 'temp-cust',
                      direction: 'outbound',
                      senderType: 'coordinator',
                      coordinatorId: targetCoordinatorId || authUser?.id || null,
                      senderName: actualSenderName,
                      senderRole: actualSenderRole,
                      messageSource: actualSource,
                      sentAt: sentAtUtc,
                      content: msgContent || (media ? `[${media.type?.toUpperCase()}]` : ''),
                      status: 'failed',
                      errorCode: errCode,
                      errorMessage: explanation,
                      timestamp: sentAtUtc
                    }
                  }).catch(() => {});

                  // Save protected message audit record for failed delivery attempt
                  await prisma.messageAudit.upsert({
                    where: { messageId: failedMsgId },
                    update: {
                      deliveryStatus: 'failed',
                      senderId: actualSenderId,
                      senderName: actualSenderName,
                      senderRole: actualSenderRole,
                      messageSource: actualSource,
                      sentAt: sentAtUtc
                    },
                    create: {
                      messageId: failedMsgId,
                      leadId,
                      customerId: cust?.id || customerId || 'temp-cust',
                      company: resolvedCompany || 'RWC',
                      whatsappNumber: formattedTo,
                      senderId: actualSenderId,
                      senderName: actualSenderName,
                      senderRole: actualSenderRole,
                      messageSource: actualSource,
                      deliveryStatus: 'failed',
                      sentAt: sentAtUtc
                    }
                  }).catch(err => console.warn('[MessageAudit Failed Log Warning]:', err.message));
                } catch (e) {}
              }

              // Broadcast failed SSE status
              broadcastScopedSSE(targetCoordinatorId || null, {
                type: 'MESSAGE_STATUS_UPDATE',
                messageId: failedMsgId,
                leadId,
                status: 'failed',
                errorCode: errCode,
                errorMessage: explanation,
                recipientPhone: formattedTo,
                senderId: actualSenderId,
                senderName: actualSenderName,
                senderRole: actualSenderRole,
                messageSource: actualSource,
                sentAt: sentAtUtc.toISOString(),
                timestamp: sentAtUtc.toISOString()
              });

              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: false,
                status: 'failed',
                messageId: failedMsgId,
                errorCode: errCode,
                error: explanation,
                rawError: rawMsg
              }));
              return;
            }
          }

          const messageId = sendResult?.messageId || metaData.messages?.[0]?.id || `wamid-${Date.now()}`;
          console.log(`✅ [Meta Graph API] Dispatched! Message ID (wamid): ${messageId}`);
          sendResult = {
            success: true,
            messageId,
            status: 'sent',
            to: cleanTo,
            meta: sendResult?.meta || metaData,
            fallbackTemplateUsed: sendResult?.fallbackTemplateUsed || false
          };

          // Save message to Prisma database
          if (prisma && getDbStatus()) {
            try {
              // 1. Resolve Customer
              let cust = customerId ? await prisma.customer.findUnique({ where: { id: customerId } }).catch(() => null) : null;
              if (!cust && cleanTo) {
                cust = await prisma.customer.findFirst({
                  where: {
                    OR: [
                      { whatsappNumber: formattedTo },
                      { whatsappNumber: cleanTo },
                      { whatsappId: cleanTo }
                    ]
                  }
                }).catch(() => null);
                if (!cust) {
                  cust = await prisma.customer.create({
                    data: {
                      whatsappNumber: formattedTo,
                      whatsappId: cleanTo,
                      displayName: formattedTo,
                      preferredLanguage: 'en'
                    }
                  }).catch(() => null);
                }
              }

              // 2. Resolve Lead
              let lead = leadId ? await prisma.lead.findUnique({ where: { id: leadId } }).catch(() => null) : null;
              if (!lead && cust) {
                lead = await prisma.lead.findFirst({
                  where: { customerId: cust.id },
                  orderBy: { updatedAt: 'desc' }
                }).catch(() => null);

                if (!lead) {
                  const firstCat = await prisma.treatmentCategory.findFirst().catch(() => null);
                  const firstTrt = await prisma.treatment.findFirst().catch(() => null);
                  lead = await prisma.lead.create({
                    data: {
                      serialNumber: await allocateCompanyLeadSerial(prisma, resolvedCompany),
                      customerId: cust.id,
                      categoryId: firstCat?.id || (resolvedCompany === 'CRAS' ? 'cat-cras-courses' : 'cat-hair-care'),
                      treatmentId: firstTrt?.id || (resolvedCompany === 'CRAS' ? 'crs-adi' : 'trt-prp'),
                      stage: 'contacted',
                      source: resolvedCompany || 'RWC',
                      language: 'en'
                    }
                  }).catch(() => null);
                }
              }

              if (cust && lead) {
                let validCoordinatorId = null;
                if (targetCoordinatorId) {
                  const coordExists = await prisma.user.findUnique({ where: { id: targetCoordinatorId } }).catch(() => null);
                  if (coordExists) validCoordinatorId = coordExists.id;
                }

                // If retrying a previous failed message, delete or update the old failed message
                if (payload.retryMessageId && payload.retryMessageId !== messageId) {
                  await prisma.message.delete({ where: { id: payload.retryMessageId } }).catch(() => {});
                }

                const actualSenderId = authUser?.id || payload.senderId || null;
                const actualSenderName = authUser?.fullName || payload.senderName || 'Staff';
                const actualSenderRole = authUser?.role === 'super_admin' ? 'Super Admin' : (authUser?.roleTitle || payload.senderRole || (authUser?.role === 'leads_officer' ? 'Sales Officer' : 'Sales Officer'));
                const actualSource = payload.messageSource || (authUser ? 'CRM User' : 'System');
                const sentAtUtc = new Date();

                await prisma.message.upsert({
                  where: { id: messageId },
                  update: {
                    status: 'sent',
                    content: msgContent || (media ? (media.type === 'audio' ? 'Voice note' : `[${media.type.toUpperCase()}]`) : ''),
                    senderName: actualSenderName,
                    senderRole: actualSenderRole,
                    messageSource: actualSource,
                    sentAt: sentAtUtc,
                    mediaType: media ? media.type : null,
                    mediaUrl: savedMediaUrl || null,
                    errorCode: null,
                    errorMessage: null
                  },
                  create: {
                    id: messageId,
                    leadId: lead.id,
                    customerId: cust.id,
                    whatsappSessionId: null,
                    coordinatorId: validCoordinatorId,
                    direction: 'outbound',
                    senderType: 'coordinator',
                    senderName: actualSenderName,
                    senderRole: actualSenderRole,
                    messageSource: actualSource,
                    sentAt: sentAtUtc,
                    content: msgContent || (media ? (media.type === 'audio' ? 'Voice note' : `[${media.type.toUpperCase()}]`) : ''),
                    status: 'sent',
                    timestamp: sentAtUtc,
                    mediaType: media ? media.type : null,
                    mediaUrl: savedMediaUrl || null,
                  }
                });
                console.log(`✅ [Meta Send] Outbound message ${messageId} saved to database for Lead ${lead.id} with Sender Audit: ${actualSenderName} (${actualSenderRole})`);

                // Save permanent protected message audit record for Super Admin
                await prisma.messageAudit.upsert({
                  where: { messageId },
                  update: {
                    deliveryStatus: 'sent',
                    senderId: actualSenderId,
                    senderName: actualSenderName,
                    senderRole: actualSenderRole,
                    messageSource: actualSource,
                    sentAt: sentAtUtc
                  },
                  create: {
                    messageId,
                    leadId: lead.id,
                    customerId: cust.id,
                    company: resolvedCompany || lead.source || 'RWC',
                    whatsappNumber: formattedTo,
                    senderId: actualSenderId,
                    senderName: actualSenderName,
                    senderRole: actualSenderRole,
                    messageSource: actualSource,
                    deliveryStatus: 'sent',
                    sentAt: sentAtUtc
                  }
                }).catch(err => console.warn('[MessageAudit Log Warning]:', err.message));

                // Real-time Screen Sync across all Super Admins & Assigned Coordinators
                broadcastScopedSSE(targetCoordinatorId || null, {
                  type: 'OUTBOUND_WHATSAPP_MESSAGE',
                  messageId,
                  leadId: lead.id,
                  customerId: cust.id,
                  phone: formattedTo,
                  realPhone: formattedTo,
                  whatsappId: cleanTo,
                  name: cust.displayName || 'Client',
                  text: msgContent,
                  media: media ? {
                    type: media.type,
                    url: savedMediaUrl || media.url,
                    fileName: media.fileName || (media.type === 'audio' ? 'voice_note.mp3' : 'attachment')
                  } : null,
                  status: 'sent',
                  direction: 'outbound',
                  senderType: 'coordinator',
                  senderId: actualSenderId,
                  senderName: actualSenderName,
                  senderRole: actualSenderRole,
                  messageSource: actualSource,
                  sentAt: sentAtUtc.toISOString(),
                  timestamp: sentAtUtc.toISOString(),
                  source: 'live'
                });
              }
            } catch (dbErr) {
              console.warn('[DB Error saving Meta message]:', dbErr.message);
            }
          }
        }

        if (!sendResult) {
          throw new Error('Meta WhatsApp Cloud API token not configured or message transmission failed.');
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          messageId: sendResult.messageId,
          status: 'sent',
          to: formattedTo,
          coordinatorId: targetCoordinatorId,
          authenticatedUserId: authUser.id
        }));
      } catch (err) {
        const errorCoordinatorId = authUser?.id || masterLineId;
        console.error(`❌ [Send Error] Coordinator [${errorCoordinatorId}]:`, err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message, coordinatorId: errorCoordinatorId }));
      }
    });
    return;
  }

  // 5b. Send WhatsApp Message Template (Meta Pre-Approved HSM Templates)
  if (req.method === 'POST' && (pathname === '/api/send-template' || pathname === '/api/templates/send')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { leadId, customerId, templateName, language = 'en_US', parameters = [], retryMessageId } = payload;
        const to = payload.to || payload.phone || '';
        const norm = normalizeE164(to);

        if (!norm.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: `Invalid phone number format: "${to}". International format required (e.g. 94706373353).`
          }));
          return;
        }

        if (!templateName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing required "templateName" parameter.' }));
          return;
        }

        // RBAC: Check coordinator authorization for this specific lead or contact
        if (authUser.role === 'coordinator') {
          const prisma = getPrisma();
          if (prisma && getDbStatus()) {
            let checkLead = null;
            if (leadId) {
              checkLead = await prisma.lead.findUnique({ where: { id: leadId } }).catch(() => null);
            }
            if (!checkLead && to) {
              const cleanDigits = String(to).replace(/[^0-9]/g, '');
              if (cleanDigits.length >= 7) {
                checkLead = await prisma.lead.findFirst({
                  where: {
                    OR: [
                      { customer: { whatsappNumber: { contains: cleanDigits.slice(-9) } } },
                      { customer: { phoneNumber: { contains: cleanDigits.slice(-9) } } },
                      { customer: { whatsappId: { contains: cleanDigits.slice(-9) } } }
                    ]
                  }
                }).catch(() => null);
              }
            }
            if (checkLead && checkLead.assignedTo && checkLead.assignedTo !== authUser.id) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Forbidden: You can only message leads assigned to you.' }));
              return;
            }
          }
        }

        const prisma = getPrisma();
        let resolvedCompany = payload.company;
        if (!resolvedCompany && leadId && prisma && getDbStatus()) {
          const checkLead = await prisma.lead.findUnique({ where: { id: leadId } }).catch(() => null);
          if (checkLead?.company === 'AHC' || checkLead?.source === 'AHC') resolvedCompany = 'AHC';
          else if (checkLead?.company === 'CRAS' || checkLead?.source === 'CRAS') resolvedCompany = 'CRAS';
        }

        if (templateName.startsWith('ahc_')) {
          resolvedCompany = 'AHC';
        } else if (templateName === 'cras_welcome_greeting' || templateName.startsWith('cras_')) {
          resolvedCompany = 'CRAS';
        } else if (templateName.startsWith('rwc_')) {
          resolvedCompany = 'RWC';
        }

        const phoneId = (payload.phoneNumberId || (resolvedCompany === 'AHC' ? (metaConfig.phoneNumberIdAhc || COMPANIES.AHC.phoneId) : (resolvedCompany === 'CRAS' ? (metaConfig.phoneNumberIdCras || COMPANIES.CRAS.phoneId) : (metaConfig.phoneNumberIdRwc || metaConfig.phoneNumberId))) || '1358157244046701').trim();
        const metaToken = (metaConfig.accessToken || process.env.META_ACCESS_TOKEN || process.env.META_TOKEN || '').trim();

        if (!metaToken) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Meta API token not configured on server.' }));
          return;
        }

        const cleanTo = norm.clean;
        const formattedTo = norm.canonical;

        // Consent gate for templates too
        try {
          const gateCheck = await canSendWhatsApp(formattedTo, 'template', {
            templateName,
            check24hWindow: false
          });
          if (!gateCheck.allowed) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              code: gateCheck.code || 'MESSAGING_CONSENT_DENIED',
              error: gateCheck.reason
            }));
            return;
          }
        } catch (e) {
          console.warn('[ConsentGate] /api/send-template check failed:', e?.message);
        }

        let effectiveLanguage = language;
        if (
          templateName === 'rwc_welcome_greeting_ta' || 
          templateName === 'rwc_followup_discussion_ta' || 
          effectiveLanguage === 'ta' || 
          effectiveLanguage === 'tamil'
        ) {
          effectiveLanguage = 'ta';
        } else if (
          templateName.startsWith('rwc_welcome_greeting') || 
          templateName.startsWith('rwc_followup_discussion') || 
          templateName.startsWith('cras_course_followup') || 
          templateName === 'cras_welcome_greeting' || 
          effectiveLanguage === 'en' || 
          effectiveLanguage === 'si'
        ) {
          effectiveLanguage = 'en_US';
        }

        let effectiveParams = Array.isArray(parameters) ? [...parameters] : [];
        if (templateName.startsWith('rwc_welcome_greeting')) {
          effectiveParams = [effectiveParams[0] || 'Valued Client'];
        } else if (templateName === 'cras_welcome_greeting') {
          effectiveParams = [effectiveParams[0] || 'Dr. Perera'];
        } else if (templateName.startsWith('rwc_followup_discussion') || templateName.startsWith('cras_course_followup')) {
          effectiveParams = [];
        }

        const templatePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'template',
          template: {
            name: templateName,
            language: { code: effectiveLanguage },
            components: effectiveParams.length > 0 ? [
              {
                type: 'body',
                parameters: effectiveParams.map(p => ({ type: 'text', text: String(p) }))
              }
            ] : undefined
          }
        };

        console.log(`🚀 [Meta Send Template] Sending template "${templateName}" to ${cleanTo} via Phone ID ${phoneId}...`);
        const metaRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${metaToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(templatePayload)
        });

        const metaData = await metaRes.json().catch(() => ({}));
        if (!metaRes.ok) {
          console.error('❌ [Meta Send Template Error]:', JSON.stringify(metaData));
          const errCode = metaData.error?.code || 500;
          const rawMsg = metaData.error?.message || metaData.error?.error_user_msg || 'Template dispatch failed';
          const explanation = getMetaErrorExplanation(errCode, rawMsg);

          const failedMsgId = retryMessageId || `failed-${Date.now()}`;
          const actualSenderId = authUser?.id || payload.senderId || null;
          const actualSenderName = authUser?.fullName || payload.senderName || 'Staff';
          const actualSenderRole = authUser?.role === 'super_admin' ? 'Super Admin' : (authUser?.roleTitle || payload.senderRole || (authUser?.role === 'leads_officer' ? 'Sales Officer' : 'Sales Officer'));
          const actualSource = payload.messageSource || (authUser ? 'CRM User' : 'System');
          const sentAtUtc = new Date();

          if (prisma && getDbStatus() && leadId) {
            try {
              await prisma.message.upsert({
                where: { id: failedMsgId },
                update: {
                  status: 'failed',
                  errorCode: errCode,
                  errorMessage: explanation,
                  content: `[Template: ${templateName}]`,
                  senderName: actualSenderName,
                  senderRole: actualSenderRole,
                  messageSource: actualSource,
                  sentAt: sentAtUtc
                },
                create: {
                  id: failedMsgId,
                  leadId,
                  customerId: customerId || 'temp-cust',
                  direction: 'outbound',
                  senderType: 'coordinator',
                  coordinatorId: authUser?.id || null,
                  senderName: actualSenderName,
                  senderRole: actualSenderRole,
                  messageSource: actualSource,
                  sentAt: sentAtUtc,
                  content: `[Template: ${templateName}]`,
                  status: 'failed',
                  errorCode: errCode,
                  errorMessage: explanation,
                  timestamp: sentAtUtc
                }
              }).catch(() => {});

              await prisma.messageAudit.upsert({
                where: { messageId: failedMsgId },
                update: {
                  deliveryStatus: 'failed',
                  senderId: actualSenderId,
                  senderName: actualSenderName,
                  senderRole: actualSenderRole,
                  messageSource: actualSource,
                  sentAt: sentAtUtc
                },
                create: {
                  messageId: failedMsgId,
                  leadId,
                  customerId: customerId || 'temp-cust',
                  company: resolvedCompany || 'RWC',
                  whatsappNumber: formattedTo,
                  senderId: actualSenderId,
                  senderName: actualSenderName,
                  senderRole: actualSenderRole,
                  messageSource: actualSource,
                  deliveryStatus: 'failed',
                  sentAt: sentAtUtc
                }
              }).catch(err => console.warn('[MessageAudit Failed Template Log Warning]:', err.message));
            } catch (e) {}
          }

          broadcastScopedSSE(null, {
            type: 'MESSAGE_STATUS_UPDATE',
            messageId: failedMsgId,
            leadId,
            status: 'failed',
            errorCode: errCode,
            errorMessage: explanation,
            recipientPhone: formattedTo,
            senderId: actualSenderId,
            senderName: actualSenderName,
            senderRole: actualSenderRole,
            messageSource: actualSource,
            sentAt: sentAtUtc.toISOString(),
            timestamp: sentAtUtc.toISOString()
          });

          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            status: 'failed',
            errorCode: errCode,
            error: explanation,
            rawError: rawMsg
          }));
          return;
        }

        const messageId = metaData.messages?.[0]?.id || `wamid-${Date.now()}`;
        console.log(`✅ [Meta Send Template] Template dispatched! Message ID: ${messageId}`);

        // Compute readable content to display in CRM chat
        let renderedContent = `[Template: ${templateName}]`;
        if (templateName === 'rwc_welcome_greeting') {
          renderedContent = `Hello ${effectiveParams[0] || 'Valued Client'}, thank you for reaching out to Royal Wellness Center. We are delighted to assist you with our medical and aesthetic treatments. How may our team assist you today?`;
        } else if (templateName === 'cras_welcome_greeting') {
          renderedContent = `Hello ${effectiveParams[0] || 'Dr. Perera'}, thank you for reaching out to the College of Royal Aesthetic of Sri Lanka (CRAS). We are delighted to assist you with our diploma programs and aesthetic training courses. How may our team assist you today?`;
        } else if (templateName === 'rwc_followup_discussion_en') {
          renderedContent = `Greetings from Royal Wellness Center! \n\nWe are following up on our previous discussion regarding your treatment.\nWould this be a convenient time to speak, or is there a better time to contact you?\n\nThank you!`;
        } else if (templateName === 'rwc_followup_discussion_si') {
          renderedContent = `Royal Wellness Center වෙතින් සුහද සුබ පැතුම්! \n\n\nඔබගේ ප්රතිකාරය සම්බන්ධයෙන් අප මීට පෙර කළ සාකච්ඡාව පිළිබඳව නැවත ඔබව සම්බන්ධ කරගනිමු.\n\nදැන් ඔබ සමඟ කතා කිරීමට පහසුද? නැතහොත් ඔබව සම්බන්ධ කරගැනීමට වඩාත් සුදුසු වෙනත් වේලාවක් තිබේද?\n\nස්තුතියි!`;
        } else if (templateName === 'rwc_followup_discussion_ta') {
          renderedContent = `Royal Wellness Center-இலிருந்து அன்பான வணக்கங்கள்! \n\nஉங்களின் சிகிச்சை தொடர்பான எமது முந்தைய உரையாடலைத் தொடர்ந்து உங்களைத் தொடர்புகொள்கிறோம்.\n\nஇப்போது உங்களுடன் பேசுவதற்கு வசதியாக இருக்கிறதா? அல்லது வேறு ஏதேனும் நேரத்தில் உங்களைத் தொடர்புகொள்ளலாமா?\n\nநன்றி!`;
        } else if (templateName === 'cras_course_followup_en') {
          renderedContent = `Greetings from College of Royal Aesthetic Studies! 🎓\n\nWe are following up on our previous discussion regarding your course inquiry.\nWould this be a convenient time to speak, or is there a better time to contact you?\n\nThank you!`;
        } else if (payload.templateBody) {
          let tb = payload.templateBody;
          effectiveParams.forEach((p, idx) => {
            tb = tb.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), String(p));
          });
          renderedContent = tb;
        }

        // Persist to DB
        if (prisma && getDbStatus() && leadId) {
          try {
            if (retryMessageId && retryMessageId !== messageId) {
              await prisma.message.delete({ where: { id: retryMessageId } }).catch(() => {});
            }

            const actualSenderId = authUser?.id || payload.senderId || null;
            const actualSenderName = authUser?.fullName || payload.senderName || 'Staff';
            const actualSenderRole = authUser?.role === 'super_admin' ? 'Super Admin' : (authUser?.roleTitle || payload.senderRole || (authUser?.role === 'leads_officer' ? 'Sales Officer' : 'Sales Officer'));
            const actualSource = payload.messageSource || (authUser ? 'CRM User' : 'System');
            const sentAtUtc = new Date();

            await prisma.message.upsert({
              where: { id: messageId },
              update: {
                status: 'sent',
                content: renderedContent,
                senderName: actualSenderName,
                senderRole: actualSenderRole,
                messageSource: actualSource,
                sentAt: sentAtUtc,
                errorCode: null,
                errorMessage: null
              },
              create: {
                id: messageId,
                leadId,
                customerId: customerId || 'temp-cust',
                direction: 'outbound',
                senderType: 'coordinator',
                coordinatorId: authUser?.id || null,
                senderName: actualSenderName,
                senderRole: actualSenderRole,
                messageSource: actualSource,
                sentAt: sentAtUtc,
                content: renderedContent,
                status: 'sent',
                timestamp: sentAtUtc
              }
            });

            // Save permanent protected message audit record for Super Admin
            await prisma.messageAudit.upsert({
              where: { messageId },
              update: {
                deliveryStatus: 'sent',
                senderId: actualSenderId,
                senderName: actualSenderName,
                senderRole: actualSenderRole,
                messageSource: actualSource,
                sentAt: sentAtUtc
              },
              create: {
                messageId,
                leadId,
                customerId: customerId || 'temp-cust',
                company: resolvedCompany || 'RWC',
                whatsappNumber: formattedTo,
                senderId: actualSenderId,
                senderName: actualSenderName,
                senderRole: actualSenderRole,
                messageSource: actualSource,
                deliveryStatus: 'sent',
                sentAt: sentAtUtc
              }
            }).catch(err => console.warn('[MessageAudit Template Log Warning]:', err.message));

            // Broadcast outbound message to UI
            broadcastScopedSSE(null, {
              type: 'OUTBOUND_WHATSAPP_MESSAGE',
              messageId,
              leadId,
              customerId,
              phone: formattedTo,
              realPhone: formattedTo,
              whatsappId: cleanTo,
              text: renderedContent,
              status: 'sent',
              direction: 'outbound',
              senderType: 'coordinator',
              senderId: actualSenderId,
              senderName: actualSenderName,
              senderRole: actualSenderRole,
              messageSource: actualSource,
              sentAt: sentAtUtc.toISOString(),
              timestamp: sentAtUtc.toISOString()
            });
          } catch (dbE) {
            console.warn('[DB Error saving template msg]:', dbE.message);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          messageId,
          status: 'sent',
          to: formattedTo,
          templateName,
          template: templateName,
          content: renderedContent
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 5c. GET Available WhatsApp Templates from Meta Cloud API
  if (req.method === 'GET' && (pathname === '/api/templates' || pathname === '/api/whatsapp/templates')) {
    try {
      const metaToken = (metaConfig.accessToken || process.env.META_ACCESS_TOKEN || process.env.META_TOKEN || '').trim();
      const wabaId = (metaConfig.wabaId || process.env.META_WABA_ID || '2332922997481634').trim();

      let metaTemplates = [];
      if (metaToken && wabaId) {
        try {
          const resMeta = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates?limit=50`, {
            headers: { 'Authorization': `Bearer ${metaToken}` }
          });
          const dataMeta = await resMeta.json().catch(() => ({}));
          if (Array.isArray(dataMeta?.data)) {
            metaTemplates = dataMeta.data;
          }
        } catch (e) {
          console.warn('⚠️ [Meta Templates Fetch Warning]:', e.message);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, templates: metaTemplates }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 6. Disconnect / Unlink Central Clinic WhatsApp Line (Super Admin Only)
  if (req.method === 'POST' && (pathname === '/api/disconnect' || pathname === '/api/logout' || pathname === '/api/unlink' || pathname === '/api/whatsapp/disconnect')) {
    if (authUser.role !== 'super_admin') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Forbidden: Only Super Admin can modify clinic WhatsApp configuration.' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      message: 'Meta WhatsApp Cloud API is active; physical device unlinking is not required.', 
      coordinatorId: masterLineId, 
      authenticatedUserId: authUser.id 
    }));
    return;
  }

  // Helper for Super Admin Authorization
  function requireSuperAdmin(authUser, res) {
    if (!authUser || authUser.role !== 'super_admin') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        errorCode: 'FORBIDDEN_SUPER_ADMIN_REQUIRED',
        error: 'Forbidden: Super Admin privileges required.' 
      }));
      return false;
    }
    return true;
  }

  // 6b. REST: Super Admin Accounts Management (/api/admin/super-admins)
  // GET: Fetch list of Super Admin accounts
  if (req.method === 'GET' && pathname === '/api/admin/super-admins') {
    if (!requireSuperAdmin(authUser, res)) return;
    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const admins = await prisma.user.findMany({
          where: { role: 'super_admin' },
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            branch: true,
            company: true,
            role: true,
            active: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { createdAt: 'asc' }
        });
        if (admins && admins.length > 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, superAdmins: admins }));
          return;
        }
      } catch (e) {
        console.warn('DB error fetching super admins:', e.message);
      }
    }
    const memoryAdmins = IS_TEST_ENV ? CANONICAL_USERS.filter(u => u.role === 'super_admin').map(u => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone || null,
      branch: u.branch || 'Colombo (Head Office)',
      company: u.company || 'RWC',
      role: u.role,
      active: u.active !== false,
      createdAt: u.createdAt || new Date().toISOString()
    })) : [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, superAdmins: memoryAdmins }));
    return;
  }

  // POST: Create new Super Admin account
  if (req.method === 'POST' && pathname === '/api/admin/super-admins') {
    if (!requireSuperAdmin(authUser, res)) return;
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const fullName = String(payload.fullName || payload.name || '').trim();
        const email = String(payload.email || '').trim().toLowerCase();
        const phone = payload.phone ? String(payload.phone).trim() : null;
        const branch = payload.branch ? String(payload.branch).trim() : 'Colombo (Head Office)';
        const passwordPlain = payload.password ? String(payload.password).trim() : '';
        const cleanPin = String(payload.pin || '').trim().slice(0, 10);

        if (!fullName || !email) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Full Name and Email are required.' }));
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid email address format.' }));
          return;
        }

        const prisma = getPrisma();
        if (!prisma || !getDbStatus()) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Database is unavailable. Super Admin accounts cannot be created right now.' }));
          return;
        }

        const existingUser = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } }
        }).catch(() => null);

        if (existingUser) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: `An account with email "${email}" already exists.`
          }));
          return;
        }

        // Credential policy is checked after identity/conflict so a duplicate email always reports 409,
        // never a misleading 400 about password strength.
        if (passwordPlain.length < 12 || (cleanPin && cleanPin.length < 4)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'A password of at least 12 characters is required.' }));
          return;
        }

        let newAdmin;
        try {
          newAdmin = await prisma.user.create({
            data: {
              fullName,
              email,
              phone,
              branch,
              role: 'super_admin',
              password: hashSecret(passwordPlain),
              pin: hashSecret(cleanPin),
              active: true
            },
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              branch: true,
              role: true,
              active: true,
              createdAt: true
            }
          });
        } catch (dbErr) {
          // Unique-constraint race: another request created the same email between the check above and this insert.
          if (dbErr?.code === 'P2002') {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: `An account with email "${email}" already exists.` }));
            return;
          }
          console.error('DB error creating super admin:', dbErr.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Could not create the Super Admin account. Please try again.' }));
          return;
        }

        console.log(`🛡️ [Super Admin Created] Added by ${authUser.fullName}: ${newAdmin.fullName} (${newAdmin.email})`);

        broadcastScopedSSE(null, {
          type: 'SUPER_ADMIN_CONFIG_UPDATED',
          action: 'created',
          user: newAdmin
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          user: newAdmin,
          superAdmin: newAdmin,
          message: `Super Admin account for ${newAdmin.fullName} created successfully.`
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // PATCH / PUT / POST: Update Super Admin Account (Full Name, Active Status, Last Admin Guard)
  if ((req.method === 'PATCH' || req.method === 'PUT' || req.method === 'POST') && pathname.startsWith('/api/admin/super-admins/')) {
    if (!requireSuperAdmin(authUser, res)) return;
    const adminId = pathname.replace('/api/admin/super-admins/', '').split('/')[0];
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const prisma = getPrisma();

        if (prisma && getDbStatus()) {
          const targetUser = await prisma.user.findUnique({
            where: { id: adminId }
          }).catch(() => null);

          if (!targetUser || targetUser.role !== 'super_admin') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Super Admin account not found.' }));
            return;
          }

          // Guard: Cannot deactivate last active super admin
          if (payload.active === false && targetUser.active === true) {
            const activeAdminCount = await prisma.user.count({
              where: { role: 'super_admin', active: true }
            }).catch(() => 1);

            if (activeAdminCount <= 1) {
              console.warn(`⛔ [Lockout Prevented] Prevented deactivating last active Super Admin (${targetUser.email})`);
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                success: false, 
                errorCode: 'LAST_ADMIN_LOCKOUT_PREVENTED',
                error: 'Cannot deactivate the last active Super Admin account. At least one Super Admin must remain active.' 
              }));
              return;
            }
          }

          const updateData = {};
          if (typeof payload.fullName === 'string' && payload.fullName.trim()) {
            updateData.fullName = payload.fullName.trim();
          }
          if (payload.phone !== undefined) {
            updateData.phone = payload.phone ? String(payload.phone).trim() : null;
          }
          if (payload.branch) {
            updateData.branch = String(payload.branch).trim();
          }
          if (typeof payload.active === 'boolean') {
            updateData.active = payload.active;
          }
          if (payload.password) {
            updateData.password = hashSecret(String(payload.password).trim());
          }
          if (payload.pin) {
            updateData.pin = hashSecret(String(payload.pin).trim().slice(0, 10));
          }

          let updated = null;
          try {
            updated = await prisma.user.update({
              where: { id: adminId },
              data: updateData,
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                branch: true,
                role: true,
                active: true,
                createdAt: true,
                updatedAt: true
              }
            });
          } catch (dbErr) {
            // Never fall through to the memory path or a 200: the caller asked for a
            // persisted change. A unique-email race is the only client-visible conflict.
            console.error('DB error updating super admin:', dbErr.message);
            if (dbErr?.code === 'P2002') {
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Another account already uses that email address.' }));
              return;
            }
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Could not update the Super Admin account. Please try again.' }));
            return;
          }

          if (updated) {
            broadcastScopedSSE(null, {
              type: 'SUPER_ADMIN_CONFIG_UPDATED',
              action: 'updated',
              user: updated
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: true, 
              user: updated,
              superAdmin: updated,
              message: `Super Admin account "${updated.fullName}" updated successfully.`
            }));
            return;
          }
        }

        // Memory fallback
        const memIdx = CANONICAL_USERS.findIndex(u => u.id === adminId);
        if (memIdx !== -1) {
          const updateData = {};
          if (typeof payload.fullName === 'string' && payload.fullName.trim()) updateData.fullName = payload.fullName.trim();
          if (typeof payload.active === 'boolean') updateData.active = payload.active;
          CANONICAL_USERS[memIdx] = { ...CANONICAL_USERS[memIdx], ...updateData };
          const updated = CANONICAL_USERS[memIdx];

          broadcastScopedSSE(null, {
            type: 'SUPER_ADMIN_CONFIG_UPDATED',
            action: 'updated',
            user: updated
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, user: updated, superAdmin: updated }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Super Admin account not found.' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // DELETE: Delete Super Admin Account (/api/admin/super-admins/:id)
  if (req.method === 'DELETE' && pathname.startsWith('/api/admin/super-admins/')) {
    if (!requireSuperAdmin(authUser, res)) return;
    const adminId = pathname.replace('/api/admin/super-admins/', '').split('/')[0];

    if (adminId === authUser.id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Cannot delete the currently logged in Super Admin account.' }));
      return;
    }

    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      const activeAdminCount = await prisma.user.count({
        where: { role: 'super_admin', active: true }
      }).catch(() => 1);

      if (activeAdminCount <= 1) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Cannot delete the last remaining Super Admin account.' 
        }));
        return;
      }

      try {
        await prisma.user.delete({ where: { id: adminId } });
      } catch (dbErr) {
        console.error('DB error deleting super admin:', dbErr.message);
        if (dbErr?.code === 'P2025') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Super Admin account not found.' }));
          return;
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Could not delete the Super Admin account. Please try again.' }));
        return;
      }
    }

    const memIdx = CANONICAL_USERS.findIndex(u => u.id === adminId);
    if (memIdx !== -1) {
      CANONICAL_USERS.splice(memIdx, 1);
    }

    broadcastScopedSSE(null, {
      type: 'SUPER_ADMIN_CONFIG_UPDATED',
      action: 'deleted',
      deletedId: adminId
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, deletedId: adminId }));
    return;
  }

  // 7. REST: Get Treatment Categories from Supabase
  if (req.method === 'GET' && pathname === '/api/categories') {
    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const categories = await prisma.treatmentCategory.findMany({ where: { active: true } });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(categories));
        return;
      } catch (e) {}
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return;
  }

  // =============================================================================
  // 8. REST: Lead Stages Management (Dynamic Configuration & Workflow Protection)
  // =============================================================================

  // 8a. GET /api/stages & GET /api/admin/stages (Fetch configured lead stages)
  if (req.method === 'GET' && (pathname === '/api/stages' || pathname === '/api/admin/stages')) {
    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const stages = await prisma.leadStageConfig.findMany({
          orderBy: { orderIndex: 'asc' }
        });
        if (stages && stages.length > 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, stages }));
          return;
        }
      } catch (e) {
        // Fallback to raw SQL if model mapping issue
        try {
          const rawStages = await prisma.$queryRawUnsafe(`
            SELECT id, key, label, description, color, order_index as "orderIndex", 
                   is_active as "isActive", is_system as "isSystem", company,
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM public.lead_stages
            ORDER BY order_index ASC;
          `);
          if (Array.isArray(rawStages) && rawStages.length > 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, stages: rawStages }));
            return;
          }
        } catch (rawErr) {}
      }
    }
    // Canonical fallback if DB offline
    const defaultStages = [
      { id: 'stage-new', key: 'new', label: 'New Inquiry', description: 'Fresh uncontacted inbound lead', color: '#f43f5e', orderIndex: 0, isActive: true, isSystem: true, company: 'ALL' },
      { id: 'stage-assigned', key: 'assigned', label: 'Assigned', description: 'Lead assigned to coordinator or education counsellor', color: '#f59e0b', orderIndex: 1, isActive: true, isSystem: false, company: 'ALL' },
      { id: 'stage-contacted', key: 'contacted', label: 'Contacted', description: 'Initial outreach made via WhatsApp or call', color: '#10b981', orderIndex: 2, isActive: true, isSystem: false, company: 'ALL' },
      { id: 'stage-potential', key: 'potential', label: 'Potential', description: 'Qualified prospect showing active interest', color: '#8b5cf6', orderIndex: 3, isActive: true, isSystem: false, company: 'ALL' },
      { id: 'stage-under-discussion', key: 'under_discussion', label: 'Under Discussion', description: 'Ongoing treatment / course consultation & quotation', color: '#0ea5e9', orderIndex: 4, isActive: true, isSystem: false, company: 'ALL' },
      { id: 'stage-forwarded-exam', key: 'forwarded_to_exam_department', label: 'Forwarded to Exam Department', description: 'Lead handed over to the healthcare exam preparation team.', color: '#06b6d4', orderIndex: 5, isActive: true, isSystem: false, company: 'ALL' },
      { id: 'stage-forwarded-processing', key: 'forwarded_to_processing_department', label: 'Forwarded to Processing Department', description: 'Lead handed over to the document and application processing team.', color: '#f97316', orderIndex: 6, isActive: true, isSystem: false, company: 'ALL' },
      { id: 'stage-not-relevant', key: 'not_relevant', label: 'Not Relevant Inquiry', description: 'Wrong inquiry or service not offered', color: '#64748b', orderIndex: 7, isActive: true, isSystem: false, company: 'ALL' },
      { id: 'stage-not-eligible', key: 'not_eligible', label: 'Not Eligible', description: 'Client medically or academically ineligible', color: '#71717a', orderIndex: 8, isActive: true, isSystem: false, company: 'ALL' },
      { id: 'stage-converted', key: 'converted', label: 'Converted (Closed Won)', description: 'Patient booked appointment or student enrolled', color: '#0d9488', orderIndex: 9, isActive: true, isSystem: true, company: 'ALL' },
      { id: 'stage-lost', key: 'lost', label: 'Lost', description: 'Lead discontinued, unresponsive, or declined', color: '#ef4444', orderIndex: 10, isActive: true, isSystem: true, company: 'ALL' }
    ];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, stages: defaultStages }));
    return;
  }

  // 8b. POST /api/admin/stages (Super Admin: Add new lead stage)
  if (req.method === 'POST' && pathname === '/api/admin/stages') {
    if (!requireSuperAdmin(authUser, res)) return;
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const rawKey = String(payload.key || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (!/^[a-z][a-z0-9_]{0,49}$/.test(rawKey)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid stage key.' }));
          return;
        }
        const label = String(payload.label || '').trim();
        const description = payload.description ? String(payload.description).trim() : '';
        const color = payload.color ? String(payload.color).trim() : 'teal';
        const company = payload.company || 'ALL';

        if (!rawKey || !label) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Stage key and label are required.' }));
          return;
        }

        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          // Check for duplicate key or duplicate label
          const existing = await prisma.$queryRawUnsafe(
            `SELECT id, key, label FROM public.lead_stages WHERE LOWER(key) = $1 OR LOWER(label) = $2 LIMIT 1;`,
            rawKey, label.toLowerCase()
          ).catch(() => []);

          if (existing && existing.length > 0) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false, 
              error: `A lead stage with key "${rawKey}" or label "${label}" already exists.` 
            }));
            return;
          }

          // Compute next order index
          const maxOrderRes = await prisma.$queryRawUnsafe(`SELECT COALESCE(MAX(order_index), 0) + 1 as "nextOrder" FROM public.lead_stages;`).catch(() => [{ nextOrder: 10 }]);
          const nextOrder = Number(maxOrderRes[0]?.nextOrder || 10);

          const stageId = `stage-${rawKey}-${Date.now()}`;
          await prisma.$executeRawUnsafe(`
            INSERT INTO public.lead_stages (id, key, label, description, color, order_index, is_active, is_system, company, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE, $7, NOW(), NOW());
          `, stageId, rawKey, label, description, color, nextOrder, company);

          // Ensure LeadStage enum in Postgres accepts the new key
          await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS '${rawKey}';`).catch(() => null);

          const newStage = {
            id: stageId,
            key: rawKey,
            label,
            description,
            color,
            orderIndex: nextOrder,
            isActive: true,
            isSystem: false,
            company
          };

          broadcastScopedSSE(null, {
            type: 'STAGE_CONFIG_UPDATED',
            action: 'created',
            stage: newStage
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, stage: newStage }));
          return;
        }

        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Database offline' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 8c. PATCH /api/admin/stages/reorder (Super Admin: Reorder display sequence)
  if ((req.method === 'PATCH' || req.method === 'POST') && pathname === '/api/admin/stages/reorder') {
    if (!requireSuperAdmin(authUser, res)) return;
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const stageIds = Array.isArray(payload.stageIds) && payload.stageIds.length > 0
          ? payload.stageIds
          : Array.isArray(payload.order) && payload.order.length > 0
            ? payload.order.map(item => typeof item === 'string' ? item : item.id)
            : [];

        if (stageIds.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'stageIds or order array is required for reordering.' }));
          return;
        }

        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          for (let index = 0; index < stageIds.length; index++) {
            const sid = stageIds[index];
            await prisma.$executeRawUnsafe(
              `UPDATE public.lead_stages SET order_index = $1, updated_at = NOW() WHERE id = $2 OR key = $2;`,
              index, sid
            ).catch(() => null);
          }

          broadcastScopedSSE(null, {
            type: 'STAGE_CONFIG_UPDATED',
            action: 'reordered',
            stageIds
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Stages reordered successfully.' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Stages reordered (memory).' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 8d. PUT/PATCH /api/admin/stages/:id (Super Admin: Edit stage details)
  if ((req.method === 'PUT' || req.method === 'PATCH') && pathname.startsWith('/api/admin/stages/') && !pathname.endsWith('/reorder') && !pathname.endsWith('/status')) {
    if (!requireSuperAdmin(authUser, res)) return;
    const stageId = pathname.split('/')[4];
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const label = payload.label ? String(payload.label).trim() : null;
        const description = payload.description !== undefined ? String(payload.description).trim() : undefined;
        const color = payload.color ? String(payload.color).trim() : undefined;
        const company = payload.company !== undefined ? String(payload.company).trim() : undefined;

        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          // Check existence
          const existing = await prisma.$queryRawUnsafe(`SELECT * FROM public.lead_stages WHERE id = $1 OR key = $1 LIMIT 1;`, stageId).catch(() => []);
          if (!existing || existing.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Stage not found' }));
            return;
          }

          const current = existing[0];
          const newLabel = label || current.label;
          const newDesc = description !== undefined ? description : current.description;
          const newColor = color || current.color;
          const newCompany = company !== undefined ? company : (current.company || 'ALL');

          await prisma.$executeRawUnsafe(`
            UPDATE public.lead_stages 
            SET label = $1, description = $2, color = $3, company = $4, updated_at = NOW()
            WHERE id = $5 OR key = $5;
          `, newLabel, newDesc, newColor, newCompany, stageId);

          broadcastScopedSSE(null, {
            type: 'STAGE_CONFIG_UPDATED',
            action: 'updated',
            stageId: current.id,
            stageKey: current.key,
            label: newLabel,
            color: newColor,
            company: newCompany
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, stage: { ...current, label: newLabel, description: newDesc, color: newColor, company: newCompany } }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 8e. PATCH /api/admin/stages/:id/status (Super Admin: Activate/Deactivate stage with System Protection)
  if ((req.method === 'PATCH' || req.method === 'POST') && pathname.startsWith('/api/admin/stages/') && pathname.endsWith('/status')) {
    if (!requireSuperAdmin(authUser, res)) return;
    const parts = pathname.split('/');
    const stageId = parts[4];

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          const existing = await prisma.$queryRawUnsafe(`SELECT * FROM public.lead_stages WHERE id = $1 OR key = $1 LIMIT 1;`, stageId).catch(() => []);
          if (!existing || existing.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Stage not found' }));
            return;
          }

          const current = existing[0];

          // SYSTEM STAGES PROTECTION: Never allow deactivation of 'new', 'converted', 'lost' or is_system
          const systemProtectedKeys = ['new', 'converted', 'lost'];
          if (systemProtectedKeys.includes(current.key) || current.is_system) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false, 
              error: `System-required stage "${current.label}" cannot be deactivated. Essential CRM workflows rely on it.` 
            }));
            return;
          }

          const targetActive = payload.active !== undefined ? Boolean(payload.active) : !current.is_active;

          await prisma.$executeRawUnsafe(
            `UPDATE public.lead_stages SET is_active = $1, updated_at = NOW() WHERE id = $2 OR key = $2;`,
            targetActive, stageId
          );

          broadcastScopedSSE(null, {
            type: 'STAGE_CONFIG_UPDATED',
            action: 'status_changed',
            stageId: current.id,
            stageKey: current.key,
            isActive: targetActive
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            stageId: current.id, 
            stageKey: current.key, 
            isActive: targetActive,
            message: `Stage "${current.label}" is now ${targetActive ? 'active' : 'inactive'}. Existing historical leads are preserved.`
          }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, isActive: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 8f. DELETE /api/admin/stages/:id (Super Admin: Delete/Remove custom stage)
  if (req.method === 'DELETE' && pathname.startsWith('/api/admin/stages/')) {
    if (!requireSuperAdmin(authUser, res)) return;
    const parts = pathname.split('/');
    const stageId = parts[4];

    try {
      const prisma = getPrisma();
      if (prisma && getDbStatus()) {
        const existing = await prisma.$queryRawUnsafe(`SELECT * FROM public.lead_stages WHERE id = $1 OR key = $1 LIMIT 1;`, stageId).catch(() => []);
        if (!existing || existing.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Stage not found' }));
          return;
        }

        const current = existing[0];
        const systemProtectedKeys = ['new', 'converted', 'lost'];
        if (systemProtectedKeys.includes(current.key) || current.is_system) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            error: `System-required stage "${current.label}" cannot be deleted.` 
          }));
          return;
        }

        // Reassign any leads currently in this stage to 'new'
        await prisma.$executeRawUnsafe(
          `UPDATE public.leads SET stage = 'new', updated_at = NOW() WHERE stage = $1::text::"LeadStage";`,
          current.key
        ).catch(() => null);

        // Delete from lead_stages in Supabase
        await prisma.$executeRawUnsafe(
          `DELETE FROM public.lead_stages WHERE id = $1 OR key = $1;`,
          current.id
        );

        broadcastScopedSSE(null, {
          type: 'STAGE_CONFIG_UPDATED',
          action: 'deleted',
          stageId: current.id,
          stageKey: current.key
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: `Stage "${current.label}" has been permanently removed.` 
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Stage removed (memory)' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // =============================================================================
  // 9. REST: Course Management (CRAS Academic Programs)
  // =============================================================================

  // 9a. GET /api/courses & GET /api/admin/courses
  if (req.method === 'GET' && (pathname === '/api/courses' || pathname === '/api/admin/courses')) {
    const isSuperAdminReq = pathname === '/api/admin/courses';
    if (isSuperAdminReq && !requireSuperAdmin(authUser, res)) return;

    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const whereClause = {
          OR: [
            { company: 'CRAS' },
            { categoryId: 'cat-cras-courses' },
            { id: { startsWith: 'crs-' } }
          ],
          ...(isSuperAdminReq ? {} : { active: true })
        };
        const courses = await prisma.treatment.findMany({
          where: whereClause,
          orderBy: { name: 'asc' }
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, courses }));
        return;
      } catch (e) {}
    }

    const filtered = CRAS_COURSES.map(c => ({
      ...c,
      company: 'CRAS',
      active: true,
      durationMinutes: 60,
      startingPrice: 0
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, courses: filtered }));
    return;
  }

  // 9b. POST /api/admin/courses (Super Admin: Add new course)
  if (req.method === 'POST' && pathname === '/api/admin/courses') {
    if (!requireSuperAdmin(authUser, res)) return;
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const name = String(payload.name || payload.nameEn || '').trim();
        const code = String(payload.code || '').trim().toUpperCase();
        const categoryId = payload.categoryId || 'cat-cras-courses';
        const durationMinutes = Number(payload.durationMinutes || payload.duration || 60);
        const startingPrice = Number(payload.startingPrice || payload.price || 0);
        const description = payload.description ? String(payload.description).trim() : null;
        const benefits = payload.benefits ? String(payload.benefits).trim() : null;

        if (!name || !code) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Course name and course code are required.' }));
          return;
        }

        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          // Uniqueness check for code & name among CRAS courses
          const existing = await prisma.treatment.findFirst({
            where: {
              OR: [
                { code: { equals: code, mode: 'insensitive' } },
                { name: { equals: name, mode: 'insensitive' } }
              ],
              AND: [
                { OR: [{ company: 'CRAS' }, { categoryId: 'cat-cras-courses' }] }
              ]
            }
          }).catch(() => null);

          if (existing) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false, 
              error: `A course with code "${code}" or name "${name}" already exists.` 
            }));
            return;
          }

          const courseId = `crs-${code.toLowerCase()}-${Date.now().toString().slice(-4)}`;
          const createdCourse = await prisma.treatment.create({
            data: {
              id: courseId,
              categoryId,
              code,
              company: 'CRAS',
              name,
              nameEn: name,
              nameSi: payload.nameSi || name,
              nameTa: payload.nameTa || name,
              startingPrice,
              durationMinutes,
              active: true,
              description,
              benefits
            }
          });

          broadcastScopedSSE(null, {
            type: 'COURSE_CONFIG_UPDATED',
            action: 'created',
            course: createdCourse
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, course: createdCourse }));
          return;
        }

        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Database unavailable' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 9c. PUT/PATCH /api/admin/courses/:id (Super Admin: Edit course)
  if ((req.method === 'PUT' || req.method === 'PATCH') && pathname.startsWith('/api/admin/courses/') && !pathname.endsWith('/status')) {
    if (!requireSuperAdmin(authUser, res)) return;
    const courseId = pathname.split('/')[4];
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          const current = await prisma.treatment.findUnique({ where: { id: courseId } });
          if (!current) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Course not found' }));
            return;
          }

          const updateData = {};
          if (payload.name) {
            updateData.name = String(payload.name).trim();
            updateData.nameEn = updateData.name;
          }
          if (payload.code) {
            const newCode = String(payload.code).trim().toUpperCase();
            // Duplicate code check excluding self
            const dup = await prisma.treatment.findFirst({
              where: {
                id: { not: courseId },
                code: { equals: newCode, mode: 'insensitive' },
                OR: [{ company: 'CRAS' }, { categoryId: 'cat-cras-courses' }]
              }
            });
            if (dup) {
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: `Course code "${newCode}" is already in use.` }));
              return;
            }
            updateData.code = newCode;
          }
          if (payload.durationMinutes !== undefined) updateData.durationMinutes = Number(payload.durationMinutes);
          if (payload.startingPrice !== undefined) updateData.startingPrice = Number(payload.startingPrice);
          if (payload.description !== undefined) updateData.description = payload.description;
          if (payload.benefits !== undefined) updateData.benefits = payload.benefits;

          const updatedCourse = await prisma.treatment.update({
            where: { id: courseId },
            data: updateData
          });

          broadcastScopedSSE(null, {
            type: 'COURSE_CONFIG_UPDATED',
            action: 'updated',
            course: updatedCourse
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, course: updatedCourse }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 9d. PATCH /api/admin/courses/:id/status (Super Admin: Activate/Deactivate course)
  if ((req.method === 'PATCH' || req.method === 'POST') && pathname.startsWith('/api/admin/courses/') && pathname.endsWith('/status')) {
    if (!requireSuperAdmin(authUser, res)) return;
    const courseId = pathname.split('/')[4];
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          const current = await prisma.treatment.findUnique({ where: { id: courseId } });
          if (!current) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Course not found' }));
            return;
          }

          const targetActive = payload.active !== undefined ? Boolean(payload.active) : !current.active;

          const updatedCourse = await prisma.treatment.update({
            where: { id: courseId },
            data: { active: targetActive }
          });

          broadcastScopedSSE(null, {
            type: 'COURSE_CONFIG_UPDATED',
            action: 'status_changed',
            course: updatedCourse
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            course: updatedCourse,
            message: `Course "${updatedCourse.name}" is now ${targetActive ? 'active' : 'inactive'}. Historical student records preserved.`
          }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // =============================================================================
  // 10. REST: Treatment Management (RWC Clinical Treatments)
  // =============================================================================

  // 10a. GET /api/treatments (Active Treatments & Courses) & GET /api/admin/treatments (All RWC Treatments)
  if (req.method === 'GET' && (pathname === '/api/treatments' || pathname === '/api/admin/treatments')) {
    const isAdminView = pathname === '/api/admin/treatments';
    if (isAdminView && !requireSuperAdmin(authUser, res)) return;

    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const whereClause = isAdminView
          ? { OR: [{ company: 'RWC' }, { company: null }] }
          : { active: true };

        const treatments = await prisma.treatment.findMany({
          where: whereClause,
          orderBy: { name: 'asc' }
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(treatments));
        return;
      } catch (e) {}
    }

    const fallbackList = CLINIC_TREATMENTS.map(t => ({
      ...t,
      company: 'RWC',
      active: true,
      durationMinutes: 45,
      startingPrice: 0
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(fallbackList));
    return;
  }

  // 10b. POST /api/admin/treatments (Super Admin: Add new treatment)
  if (req.method === 'POST' && pathname === '/api/admin/treatments') {
    if (!requireSuperAdmin(authUser, res)) return;
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const name = String(payload.name || payload.nameEn || '').trim();
        const code = String(payload.code || '').trim().toUpperCase();
        const categoryId = payload.categoryId || 'cat-skin-care';
        const startingPrice = Number(payload.startingPrice || payload.price || 0);
        const durationMinutes = Number(payload.durationMinutes || payload.duration || 45);
        const description = payload.description ? String(payload.description).trim() : null;
        const benefits = payload.benefits ? String(payload.benefits).trim() : null;

        if (!name || !code) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Treatment name and treatment code are required.' }));
          return;
        }

        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          // Uniqueness check for code & name among RWC treatments
          const existing = await prisma.treatment.findFirst({
            where: {
              OR: [
                { code: { equals: code, mode: 'insensitive' } },
                { name: { equals: name, mode: 'insensitive' } }
              ],
              AND: [
                { OR: [{ company: 'RWC' }, { company: null }] }
              ]
            }
          }).catch(() => null);

          if (existing) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false, 
              error: `A treatment with code "${code}" or name "${name}" already exists.` 
            }));
            return;
          }

          const treatmentId = `trt-${code.toLowerCase()}-${Date.now().toString().slice(-4)}`;
          const createdTreatment = await prisma.treatment.create({
            data: {
              id: treatmentId,
              categoryId,
              code,
              company: 'RWC',
              name,
              nameEn: name,
              nameSi: payload.nameSi || name,
              nameTa: payload.nameTa || name,
              startingPrice,
              durationMinutes,
              active: true,
              description,
              benefits
            }
          });

          broadcastScopedSSE(null, {
            type: 'TREATMENT_CONFIG_UPDATED',
            action: 'created',
            treatment: createdTreatment
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, treatment: createdTreatment }));
          return;
        }

        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Database unavailable' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10c. PUT/PATCH /api/admin/treatments/:id (Super Admin: Edit treatment)
  if ((req.method === 'PUT' || req.method === 'PATCH') && pathname.startsWith('/api/admin/treatments/') && !pathname.endsWith('/status')) {
    if (!requireSuperAdmin(authUser, res)) return;
    const treatmentId = pathname.split('/')[4];
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          const current = await prisma.treatment.findUnique({ where: { id: treatmentId } });
          if (!current) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Treatment not found' }));
            return;
          }

          const updateData = {};
          if (payload.name) {
            updateData.name = String(payload.name).trim();
            updateData.nameEn = updateData.name;
          }
          if (payload.code) {
            const newCode = String(payload.code).trim().toUpperCase();
            const dup = await prisma.treatment.findFirst({
              where: {
                id: { not: treatmentId },
                code: { equals: newCode, mode: 'insensitive' },
                OR: [{ company: 'RWC' }, { company: null }]
              }
            });
            if (dup) {
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: `Treatment code "${newCode}" is already in use.` }));
              return;
            }
            updateData.code = newCode;
          }
          if (payload.categoryId) updateData.categoryId = payload.categoryId;
          if (payload.durationMinutes !== undefined) updateData.durationMinutes = Number(payload.durationMinutes);
          if (payload.startingPrice !== undefined) updateData.startingPrice = Number(payload.startingPrice);
          if (payload.description !== undefined) updateData.description = payload.description;
          if (payload.benefits !== undefined) updateData.benefits = payload.benefits;

          const updatedTreatment = await prisma.treatment.update({
            where: { id: treatmentId },
            data: updateData
          });

          broadcastScopedSSE(null, {
            type: 'TREATMENT_CONFIG_UPDATED',
            action: 'updated',
            treatment: updatedTreatment
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, treatment: updatedTreatment }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10d. PATCH /api/admin/treatments/:id/status (Super Admin: Activate/Deactivate treatment)
  if ((req.method === 'PATCH' || req.method === 'POST') && pathname.startsWith('/api/admin/treatments/') && pathname.endsWith('/status')) {
    if (!requireSuperAdmin(authUser, res)) return;
    const treatmentId = pathname.split('/')[4];
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          const current = await prisma.treatment.findUnique({ where: { id: treatmentId } });
          if (!current) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Treatment not found' }));
            return;
          }

          const targetActive = payload.active !== undefined ? Boolean(payload.active) : !current.active;

          const updatedTreatment = await prisma.treatment.update({
            where: { id: treatmentId },
            data: { active: targetActive }
          });

          broadcastScopedSSE(null, {
            type: 'TREATMENT_CONFIG_UPDATED',
            action: 'status_changed',
            treatment: updatedTreatment
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            treatment: updatedTreatment,
            message: `Treatment "${updatedTreatment.name}" is now ${targetActive ? 'active' : 'inactive'}. Historical patient records preserved.`
          }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }


  // 9. REST: Get Messages with RBAC & Coordinator Isolation
  if (req.method === 'GET' && pathname === '/api/messages') {
    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const queryLeadId = parsedUrl.query.leadId;
        const whereClause = {};

        if (queryLeadId) {
          whereClause.leadId = String(queryLeadId);
        }

        // Coordinators and Clinical Nurses can only query messages from their assigned leads
        if (authUser.role === 'coordinator' || authUser.role === 'clinical_nurse') {
          whereClause.lead = {
            assignedTo: authUser.id
          };
        }

        const isSuperAdmin = authUser?.role === 'super_admin';
        const paginate = parsedUrl.query.paginate === '1';
        const before = parsedUrl.query.before;
        // Legacy (non-paginated) callers keep receiving a chronological window, but never
        // an unbounded one. Paginated callers get `limit` (default 50, max 200) per page.
        const defaultLimit = paginate ? 50 : 500;
        const hardCap = paginate ? 200 : 2000;
        const MESSAGE_PAGE_SIZE = Math.min(Math.max(Number(parsedUrl.query.limit) || defaultLimit, 1), hardCap);

        // Cursor pagination: load the newest page first, then walk backwards using the
        // `before` cursor. Unlimited retrieval is no longer possible on this endpoint.
        //
        // The cursor is `timestamp|id`. A timestamp alone is NOT unique — a webhook burst
        // or bulk import writes many rows within the same millisecond — and a
        // `timestamp < cursor` bound would silently drop every message sharing that
        // millisecond. The id is the tiebreaker, so the boundary is exact. A bare
        // timestamp (the previous format) is still accepted.
        if (before) {
          const raw = String(before);
          const separator = raw.lastIndexOf('|');
          const cursorTimestamp = separator === -1 ? raw : raw.slice(0, separator);
          const cursorId = separator === -1 ? null : raw.slice(separator + 1);
          const cursorDate = new Date(cursorTimestamp);
          if (!Number.isNaN(cursorDate.getTime())) {
            whereClause.AND = cursorId
              ? [{
                  OR: [
                    { timestamp: { lt: cursorDate } },
                    { timestamp: cursorDate, id: { lt: cursorId } }
                  ]
                }]
              : [{ timestamp: { lt: cursorDate } }];
          }
        }

        // Newest-first query so the cursor always walks towards older messages, then
        // reverse into chronological order for the client. `id` is the stable tiebreaker
        // that keeps pages non-overlapping and complete when timestamps collide.
        const page = await prisma.message.findMany({
          where: whereClause,
          orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
          take: MESSAGE_PAGE_SIZE + 1,
        });

        const hasMore = page.length > MESSAGE_PAGE_SIZE;
        const pageRows = hasMore ? page.slice(0, MESSAGE_PAGE_SIZE) : page;
        const messages = pageRows.reverse();

        // Backend RBAC: Never expose audit metadata through normal staff API responses
        const sanitizedMessages = isSuperAdmin
          ? messages
          : messages.map(m => {
              const { senderName, senderRole, messageSource, sentAt, ...clean } = m;
              return clean;
            });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (paginate) {
          const oldest = messages[0];
          res.end(JSON.stringify({
            messages: sanitizedMessages,
            hasMore,
            // Cursor is the oldest message returned; pass it back as `before` for older pages.
            nextCursor: hasMore && oldest
              ? `${new Date(oldest.timestamp).toISOString()}|${oldest.id}`
              : null
          }));
        } else {
          res.end(JSON.stringify(sanitizedMessages));
        }
        return;
      } catch (e) {
        console.error('Error fetching messages from DB:', e);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return;
  }

  // 10. REST: Get Leads with RBAC & Coordinator Isolation
  if (req.method === 'GET' && pathname === '/api/leads') {
    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const whereClause = {};
        const isSuperAdmin = authUser?.role === 'super_admin';
        
        // Coordinators and Clinical Nurses can only see leads assigned directly to them; Super Admin and Leads Officer see all leads
        if (authUser.role === 'coordinator' || authUser.role === 'clinical_nurse') {
          whereClause.assignedTo = authUser.id;
        }

        // Pagination. `page`/`pageSize` are clamped so the server can never be asked to
        // serialize the entire lead table (which previously pulled every nested message).
        const paginate = parsedUrl.query.paginate === '1';
        const pageSize = Math.min(Math.max(Number(parsedUrl.query.pageSize) || 50, 1), 200);
        const page = Math.max(Number(parsedUrl.query.page) || 1, 1);

        // Optional server-side filters (preserve existing UI behaviour, push work to SQL).
        const search = String(parsedUrl.query.search || '').trim();
        if (search) {
          whereClause.OR = [
            { serialNumber: { contains: search, mode: 'insensitive' } },
            { customer: { displayName: { contains: search, mode: 'insensitive' } } },
            { customer: { whatsappNumber: { contains: search } } }
          ];
        }
        if (parsedUrl.query.stage) {
          whereClause.stage = String(parsedUrl.query.stage);
        }

        // Lead summaries only: the conversation is fetched separately via
        // GET /api/messages?leadId=... so this query stays bounded regardless of history size.
        // `notes` and `stageHistories` are deliberately NOT included: the client never reads
        // either (stage history comes from its own store, notes are fetched per-lead) and
        // both grow without bound. `assignmentHistories` is only ever read at index 0, so
        // exactly one row is fetched; `_count.notes` keeps the notes badge working.
        const includeSpec = {
          customer: true,
          category: true,
          treatment: true,
          assignedCoordinator: true,
          whatsappSession: true,
          assignmentHistories: { orderBy: { assignedAt: 'desc' }, take: 1 },
          _count: { select: { messages: true, notes: true } }
        };

        const [total, leads] = paginate
          ? await Promise.all([
              prisma.lead.count({ where: whereClause }),
              prisma.lead.findMany({
                where: whereClause,
                include: includeSpec,
                orderBy: { updatedAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize
              })
            ])
          : [
              null,
              await prisma.lead.findMany({
                where: whereClause,
                include: includeSpec,
                orderBy: { updatedAt: 'desc' },
                take: 500
              })
            ];

        const enrichedLeads = leads.map(l => {
          const compCode = resolveLeadCompany(l);
          const comp = COMPANIES[compCode] || COMPANIES.RWC;
          const { _count, ...leadFields } = l;

          return {
            ...leadFields,
            messageCount: _count?.messages ?? 0,
            // The notes badge must survive a reload, so the count is supplied by the server
            // even though the note bodies themselves are loaded on demand.
            notesCount: _count?.notes ?? 0,
            lastCustomerMessageAt: l.lastCustomerMessageAt ? new Date(l.lastCustomerMessageAt).toISOString() : null,
            company: comp.code,
            companyTag: comp.tag,
            companyColor: comp.colorHex,
            companyPhoneNumberId: comp.phoneId,
            companyPhoneNumber: comp.phoneNumber
          };
        });

        // Enforce Company-Level Pipeline Isolation:
        // Super Admin and Leads Officer can see all leads, or filter by query param: ?company=RWC or ?company=CRAS
        // Other staff (Coordinators, Education Counsellors) strictly only see their company's pipeline,
        // plus any lead assigned directly to them.
        const isLeadsOfficer = authUser?.role === 'leads_officer';
        const isSuperOrOfficer = isSuperAdmin || isLeadsOfficer;
        let finalLeads = enrichedLeads;

        if (!isSuperOrOfficer) {
          const isStrictAssignedOnly = authUser?.role === 'coordinator' || authUser?.role === 'clinical_nurse';
          if (isStrictAssignedOnly) {
            finalLeads = finalLeads.filter(l => l.assignedTo && l.assignedTo === authUser.id);
          } else {
            const userCompany = (authUser?.company || 'RWC').toUpperCase();
            finalLeads = finalLeads.filter(l => {
              // Directly assigned coordinator or counsellor ALWAYS has access to their assigned lead
              if (l.assignedTo && l.assignedTo === authUser.id) return true;
              return (l.company || 'RWC').toUpperCase() === userCompany;
            });
          }
        } else {
          const queryCompany = parsedUrl.query.company;
          if (queryCompany && ['RWC', 'CRAS', 'AHC'].includes(String(queryCompany).toUpperCase())) {
            finalLeads = finalLeads.filter(l => (l.company || 'RWC').toUpperCase() === String(queryCompany).toUpperCase());
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (paginate) {
          // Company filtering above is applied in-memory for coordinator-scoped access
          // (assignedTo OR company), so the count is only exact for unfiltered roles.
          res.end(JSON.stringify({
            leads: finalLeads,
            page,
            pageSize,
            total: total ?? finalLeads.length,
            hasMore: total !== null ? page * pageSize < total : finalLeads.length === pageSize
          }));
        } else {
          res.end(JSON.stringify(finalLeads));
        }
        return;
      } catch (e) {
        console.error('Error fetching leads from DB:', e);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return;
  }

  // 10b. REST: Assign Lead to Coordinator (Admin or Leads Officer Dispatches to Coordinator)
  // 10b. REST: Assign Lead to Coordinator (Strict Role-Based Locking & Permission Enforcement)
  if (req.method === 'POST' && (pathname === '/api/leads/assign' || pathname === '/api/assign')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        if (!authUser || !authUser.id) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Unauthorized: Authentication required.' }));
          return;
        }

        // 1. RBAC: Coordinators can NEVER assign, reassign, or unassign leads
        if (authUser.role === 'coordinator') {
          console.warn(`⛔ [Forbidden Assignment] Coordinator [${authUser.id}] attempted assignment operation.`);
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            errorCode: 'FORBIDDEN_COORDINATOR',
            error: 'Forbidden: Coordinators cannot assign, reassign, or unassign leads.'
          }));
          return;
        }

        const payload = JSON.parse(body || '{}');
        const { leadId, coordinatorId, coordinatorName, customerId, phone, whatsappId, unassign } = payload;
        const assignerId = authUser.id;
        const assignerName = authUser.fullName || 'Admin';
        const assignmentDate = payload.assignedAt ? new Date(payload.assignedAt) : new Date();

        const prisma = getPrisma();
        let updatedLead = null;

        // 2. Handle Unassignment (Strictly Super Admin only)
        if (unassign || !coordinatorId) {
          if (authUser.role !== 'super_admin') {
            console.warn(`⛔ [Forbidden Unassign] User ${authUser.fullName} (${authUser.role}) attempted to unassign Lead ${leadId}`);
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              errorCode: 'UNASSIGN_FORBIDDEN',
              error: 'Forbidden: Leads Officers cannot unassign leads. Only Super Admin can modify or remove assignments.'
            }));
            return;
          }

          if (prisma && getDbStatus() && leadId) {
            const currentLead = await prisma.lead.findUnique({ where: { id: leadId } }).catch(() => null);
            const prevCoord = currentLead?.assignedTo || null;

            updatedLead = await prisma.lead.update({
              where: { id: leadId },
              data: {
                assignedTo: null,
                assignedById: assignerId,
                assignedByName: assignerName,
                assignedAt: assignmentDate,
                acceptedAt: null,
                stage: 'new',
                updatedAt: new Date()
              },
              include: {
                customer: true,
                category: true,
                treatment: true,
                assignedCoordinator: true,
                assignmentHistories: { orderBy: { assignedAt: 'desc' } },
                messages: { orderBy: { timestamp: 'asc' } }
              }
            }).catch(() => null);

            await prisma.leadAssignmentHistory.create({
              data: {
                leadId: leadId,
                assignedToId: null,
                assignedToName: 'Unassigned',
                assignedById: assignerId,
                assignedByName: assignerName,
                assignedAt: assignmentDate
              }
            }).catch(() => null);

            // Notify previously assigned coordinator that they lost access
            if (prevCoord) {
              broadcastScopedSSE(prevCoord, {
                type: 'LEAD_UNASSIGNED',
                leadId,
                previousCoordinatorId: prevCoord,
                reassignedTo: null,
                lead: updatedLead
              });
            }
          }

          broadcastScopedSSE(null, {
            type: 'LEAD_ASSIGNED',
            leadId,
            clientLeadId: leadId,
            coordinatorId: null,
            lead: updatedLead
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, unassigned: true, lead: updatedLead }));
          return;
        }

        // 3. Handle Assignment / Reassignment
        if (!leadId && !customerId && !phone && !whatsappId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing lead identifier or coordinatorId' }));
          return;
        }

        if (prisma && getDbStatus()) {
          // Ensure target coordinator user exists in DB
          let coordUser = await prisma.user.findUnique({ where: { id: coordinatorId } });
          if (!coordUser || coordUser.active === false || !['coordinator', 'leads_officer'].includes(coordUser.role)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Assigned staff account does not exist or is inactive.' }));
            return;
          }

          // Find lead by leadId, customerId, or phone
          let targetLead = null;
          if (leadId) {
            targetLead = await prisma.lead.findUnique({
              where: { id: leadId },
              include: { assignedCoordinator: true }
            });
          }

          if (!targetLead && customerId) {
            targetLead = await prisma.lead.findFirst({
              where: { customerId: customerId },
              include: { assignedCoordinator: true },
              orderBy: { updatedAt: 'desc' }
            });
          }

          if (!targetLead && (phone || whatsappId)) {
            const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
            const cleanWaId = (whatsappId || '').replace(/[^0-9]/g, '');
            const cust = await prisma.customer.findFirst({
              where: {
                OR: [
                  ...(cleanPhone ? [{ whatsappNumber: `+${cleanPhone}` }, { whatsappNumber: cleanPhone }] : []),
                  ...(cleanWaId ? [{ whatsappId: cleanWaId }] : [])
                ]
              }
            });
            if (cust) {
              targetLead = await prisma.lead.findFirst({
                where: { customerId: cust.id },
                include: { assignedCoordinator: true },
                orderBy: { updatedAt: 'desc' }
              });
            }
          }

          if (targetLead) {
            const prevCoordinatorId = targetLead.assignedTo;

            // CHECK: Is the lead already assigned to a coordinator?
            if (targetLead.assignedTo) {
              if (targetLead.assignedTo === coordinatorId) {
                // Idempotent: already assigned to this exact coordinator
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, lead: targetLead, message: 'Lead already assigned to this coordinator.' }));
                return;
              }

              // REASSIGNMENT: Only Super Admin can change an existing coordinator assignment
              if (authUser.role !== 'super_admin') {
                console.warn(`⛔ [Forbidden Reassign] User ${authUser.fullName} (${authUser.role}) attempted to reassign locked Lead ${targetLead.id} from ${targetLead.assignedTo} to ${coordinatorId}`);
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  errorCode: 'ASSIGNMENT_LOCKED',
                  error: `Forbidden: Lead assignment is locked to ${targetLead.assignedCoordinator?.fullName || 'the assigned coordinator'}. Once assigned, only Super Admin can change or reassign this lead.`
                }));
                return;
              }
            }

            // Leads Officer assigning an UNASSIGNED lead:
            // Use database atomic conditional check to prevent concurrent race condition (Scenario 7)
            if (authUser.role === 'leads_officer') {
              const updateResult = await prisma.lead.updateMany({
                where: {
                  id: targetLead.id,
                  assignedTo: null // Must be unassigned at the exact atomic execution moment
                },
                data: {
                  assignedTo: coordinatorId,
                  assignedById: assignerId,
                  assignedByName: assignerName,
                  assignedAt: assignmentDate,
                  acceptedAt: targetLead.stage === 'new' ? assignmentDate : targetLead.acceptedAt,
                  stage: targetLead.stage === 'new' ? 'assigned' : targetLead.stage,
                  updatedAt: new Date()
                }
              });

              if (updateResult.count === 0) {
                // Another Leads Officer or Admin assigned it simultaneously!
                console.warn(`⚠️ [Assignment Race Conflict] Lead ${targetLead.id} was already assigned by another officer.`);
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  errorCode: 'ASSIGNMENT_CONFLICT',
                  error: 'Conflict: This lead was already assigned by another user while processing your request. Assignment is now locked.'
                }));
                return;
              }

              updatedLead = await prisma.lead.findUnique({
                where: { id: targetLead.id },
                include: {
                  customer: true,
                  category: true,
                  treatment: true,
                  assignedCoordinator: true,
                  assignmentHistories: { orderBy: { assignedAt: 'desc' } },
                  messages: { orderBy: { timestamp: 'asc' } }
                }
              });
            } else {
              // Super Admin assigning or reassigning
              updatedLead = await prisma.lead.update({
                where: { id: targetLead.id },
                data: {
                  assignedTo: coordinatorId,
                  assignedById: assignerId,
                  assignedByName: assignerName,
                  assignedAt: assignmentDate,
                  acceptedAt: targetLead.stage === 'new' ? assignmentDate : targetLead.acceptedAt,
                  stage: targetLead.stage === 'new' ? 'assigned' : targetLead.stage,
                  updatedAt: new Date()
                },
                include: {
                  customer: true,
                  category: true,
                  treatment: true,
                  assignedCoordinator: true,
                  assignmentHistories: { orderBy: { assignedAt: 'desc' } },
                  messages: { orderBy: { timestamp: 'asc' } }
                }
              });
            }

            // Create assignment audit history entry
            await prisma.leadAssignmentHistory.create({
              data: {
                leadId: targetLead.id,
                assignedToId: coordinatorId,
                assignedToName: coordUser?.fullName || coordinatorName || 'Staff',
                assignedById: assignerId,
                assignedByName: assignerName,
                assignedAt: assignmentDate
              }
            }).catch(err => console.warn('[Assignment History Error]:', err.message));

            // Notify previous coordinator that they lost access (Scenario 8)
            if (prevCoordinatorId && prevCoordinatorId !== coordinatorId) {
              broadcastScopedSSE(prevCoordinatorId, {
                type: 'LEAD_UNASSIGNED',
                leadId: targetLead.id,
                previousCoordinatorId: prevCoordinatorId,
                reassignedTo: coordinatorId,
                lead: updatedLead
              });
            }
          } else {
            // Lead does not exist yet; creating a new lead with initial assignment
            let cust = customerId ? await prisma.customer.findUnique({ where: { id: customerId } }) : null;
            if (!cust && (phone || whatsappId)) {
              const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
              const cleanWaId = (whatsappId || '').replace(/[^0-9]/g, '');
              cust = await prisma.customer.create({
                data: {
                  whatsappNumber: cleanPhone ? (cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`) : cleanWaId,
                  whatsappId: cleanWaId || cleanPhone,
                  displayName: 'WhatsApp Contact',
                  preferredLanguage: 'en'
                }
              }).catch(() => null);
            }
            if (cust) {
              const firstCat = await prisma.treatmentCategory.findFirst();
              const firstTrt = await prisma.treatment.findFirst();
              updatedLead = await prisma.lead.create({
                data: {
                  serialNumber: await allocateCompanyLeadSerial(prisma, 'RWC'),
                  id: leadId && !leadId.startsWith('lead-') ? leadId : undefined,
                  customerId: cust.id,
                  categoryId: firstCat?.id || 'cat-hair-care',
                  treatmentId: firstTrt?.id || 'trt-prp-hair',
                  assignedTo: coordinatorId,
                  assignedById: assignerId,
                  assignedByName: assignerName,
                  assignedAt: assignmentDate,
                  stage: 'assigned',
                  source: 'whatsapp',
                  language: 'en'
                },
                include: {
                  customer: true,
                  category: true,
                  treatment: true,
                  assignedCoordinator: true,
                  assignmentHistories: { orderBy: { assignedAt: 'desc' } },
                  messages: { orderBy: { timestamp: 'asc' } }
                }
              }).catch(() => null);

              if (updatedLead) {
                await prisma.leadAssignmentHistory.create({
                  data: {
                    leadId: updatedLead.id,
                    assignedToId: coordinatorId,
                    assignedToName: coordUser?.fullName || coordinatorName || 'Staff',
                    assignedById: assignerId,
                    assignedByName: assignerName,
                    assignedAt: assignmentDate
                  }
                }).catch(() => null);
              }
            }
          }
        }

        // Broadcast to new coordinator, super admin, and leads officers
        if (coordinatorId) {
          broadcastScopedSSE(coordinatorId, {
            type: 'LEAD_ASSIGNED',
            leadId: updatedLead ? updatedLead.id : leadId,
            clientLeadId: leadId,
            coordinatorId,
            lead: updatedLead
          });
        }

        broadcastScopedSSE('user-admin-1', {
          type: 'LEAD_ASSIGNED',
          leadId: updatedLead ? updatedLead.id : leadId,
          clientLeadId: leadId,
          coordinatorId,
          lead: updatedLead
        });

        broadcastScopedSSE(null, {
          type: 'LEAD_ASSIGNED',
          leadId: updatedLead ? updatedLead.id : leadId,
          clientLeadId: leadId,
          coordinatorId,
          lead: updatedLead
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, lead: updatedLead }));
      } catch (err) {
        console.error('❌ [Assign Error]:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10b2. REST: Update Lead Treatment & Serial Number & Stage
  const isLeadsUpdateRoute = (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') && (pathname === '/api/leads/update' || (pathname.startsWith('/api/leads/') && pathname !== '/api/leads/create' && pathname !== '/api/leads/assign' && pathname !== '/api/leads/delete' && !pathname.startsWith('/api/leads/delete/')));
  if (isLeadsUpdateRoute) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const urlLeadId = pathname.startsWith('/api/leads/') && pathname !== '/api/leads/assign' && pathname !== '/api/leads/update' && pathname !== '/api/leads/create' ? pathname.split('/')[3] : null;
        const leadId = payload.leadId || payload.id || urlLeadId;
        const { treatmentId, categoryId, serialNumber, stage, language, customerId, phone, whatsappId, reason, acceptedAt } = payload;

        if (!leadId && !customerId && !phone && !whatsappId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing leadId or customer identifier' }));
          return;
        }

        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          // Robust Lead Resolution
          let targetLead = null;
          if (leadId) {
            targetLead = await prisma.lead.findUnique({ 
              where: { id: leadId },
              include: { assignedCoordinator: true }
            }).catch(() => null);
          }

          if (!targetLead && (customerId || phone || whatsappId)) {
            const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
            const cleanWaId = (whatsappId || '').replace(/[^0-9]/g, '');
            targetLead = await prisma.lead.findFirst({
              where: {
                OR: [
                  ...(customerId ? [{ customerId }] : []),
                  ...(cleanPhone ? [{ customer: { whatsappNumber: `+${cleanPhone}` } }, { customer: { whatsappNumber: cleanPhone } }] : []),
                  ...(cleanWaId ? [{ customer: { whatsappId: cleanWaId } }] : [])
                ]
              },
              include: { assignedCoordinator: true },
              orderBy: { updatedAt: 'desc' }
            }).catch(() => null);
          }

          const actualLeadId = targetLead ? targetLead.id : leadId;
          const prevStage = targetLead?.stage || null;

          if (payload.assignedTo !== undefined && payload.assignedTo !== targetLead?.assignedTo) {
            if (authUser.role !== 'super_admin' && authUser.role !== 'leads_officer') {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: false,
                errorCode: 'ASSIGNMENT_LOCKED',
                error: 'Forbidden: Lead assignment cannot be modified via update endpoint. Only Super Admin and Leads Officer can change assignments.'
              }));
              return;
            }
          }

          // Resource-level authorization: coordinators can only update leads assigned directly to them
          if (authUser.role === 'coordinator' && targetLead && targetLead.assignedTo && targetLead.assignedTo !== authUser.id) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              errorCode: 'FORBIDDEN_LEAD_ACCESS',
              error: 'Forbidden: You can only update leads assigned directly to you.'
            }));
            return;
          }

          // Company change authorization: Only Super Admin and Leads Officer can change company
          const isExplicitCompanyChange = payload.company !== undefined || 
            (payload.source !== undefined && ['CRAS', 'RWC', 'AHC'].includes(String(payload.source).toUpperCase()));
          if (isExplicitCompanyChange) {
            const isAuthorized = authUser.role === 'super_admin' || authUser.role === 'leads_officer';
            if (!isAuthorized) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: false,
                errorCode: 'FORBIDDEN_COMPANY_CHANGE',
                error: 'Forbidden: Only Super Admin and Leads Officer can change the company affiliation.'
              }));
              return;
            }
          }

          const updateData = {};
          if (treatmentId !== undefined) updateData.treatmentId = treatmentId || null;
          if (categoryId !== undefined) updateData.categoryId = categoryId || null;
          if (serialNumber !== undefined) updateData.serialNumber = serialNumber || null;
          if (stage !== undefined) updateData.stage = stage;
          if (acceptedAt !== undefined) updateData.acceptedAt = acceptedAt ? new Date(acceptedAt) : null;
          if (language !== undefined) updateData.language = language;
          if (payload.lastCustomerMessageAt !== undefined) {
            updateData.lastCustomerMessageAt = payload.lastCustomerMessageAt ? new Date(payload.lastCustomerMessageAt) : null;
          }

          if (payload.company !== undefined) {
            const rawComp = String(payload.company).toUpperCase();
            const companyCode = rawComp === 'AHC' ? 'AHC' : (rawComp === 'CRAS' ? 'CRAS' : 'RWC');
            updateData.company = companyCode;

            // When company changes, reset treatment/course and unassign coordinator if they belong to another company
            const prevCompany = resolveLeadCompany(targetLead);
            if (prevCompany !== companyCode) {
              updateData.treatmentId = null;
              updateData.categoryId = null;
              updateData.serialNumber = null;

              if (targetLead?.assignedCoordinator) {
                const coordComp = (targetLead.assignedCoordinator.company || 'RWC').toUpperCase();
                if (coordComp !== companyCode) {
                  updateData.assignedTo = null;
                  updateData.assignedById = null;
                  updateData.assignedByName = null;
                  updateData.assignedAt = null;
                  updateData.stage = 'new';
                }
              }
            }
          }

          if (payload.source !== undefined) {
            const rawSrc = String(payload.source).trim();
            const srcUpper = rawSrc.toUpperCase();
            if (srcUpper === 'CRAS' || srcUpper === 'RWC' || srcUpper === 'AHC') {
              updateData.source = srcUpper;
              if (payload.company === undefined) {
                updateData.company = srcUpper;
                const prevCompany = resolveLeadCompany(targetLead);
                if (prevCompany !== srcUpper) {
                  updateData.treatmentId = null;
                  updateData.categoryId = null;
                  updateData.serialNumber = null;
                  if (targetLead?.assignedCoordinator) {
                    const coordComp = (targetLead.assignedCoordinator.company || 'RWC').toUpperCase();
                    if (coordComp !== srcUpper) {
                      updateData.assignedTo = null;
                      updateData.assignedById = null;
                      updateData.assignedByName = null;
                      updateData.assignedAt = null;
                      updateData.stage = 'new';
                    }
                  }
                }
              }
            } else {
              // Acquisition channel: facebook, instagram, whatsapp, website, etc.
              updateData.source = rawSrc.toLowerCase();
            }
          }
          updateData.updatedAt = new Date();

          const updated = await prisma.lead.update({
            where: { id: actualLeadId },
            data: updateData,
            include: {
              customer: true,
              category: true,
              treatment: true,
              assignedCoordinator: true,
              messages: { orderBy: { timestamp: 'asc' } }
            }
          });

          // Record Stage History in DB
          if (stage && prevStage && prevStage !== stage) {
            await prisma.leadStageHistory.create({
              data: {
                leadId: actualLeadId,
                fromStage: prevStage,
                toStage: stage,
                changedById: authUser?.id || 'user-admin-1',
                changedByName: authUser?.fullName || 'Super Admin',
                reason: reason || `Stage changed from ${prevStage} to ${stage}`
              }
            }).catch(() => {});
          }

          if (language && updated.customer?.id) {
            await prisma.customer.update({
              where: { id: updated.customer.id },
              data: { preferredLanguage: language }
            }).catch(() => {});
          }

          const compCode = resolveLeadCompany(updated);
          const compConfig = COMPANIES[compCode] || COMPANIES.RWC;
          const enrichedLead = {
            ...updated,
            company: compCode,
            companyTag: compConfig.tag,
            companyColor: compConfig.color,
            companyPhoneNumberId: compConfig.phoneId,
            companyPhoneNumber: compConfig.phone
          };

          console.log(`✅ [Lead Updated] ID: ${actualLeadId}, Stage: ${stage || 'unchanged'}, Treatment: ${treatmentId || 'unchanged'}, Company: ${compCode}`);

          broadcastScopedSSE(null, {
            type: 'LEAD_UPDATED',
            leadId: actualLeadId,
            lead: enrichedLead
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, lead: enrichedLead }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10b3. REST: Update Customer Details (Name, Phone, WhatsApp ID)
  if ((req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') && (pathname === '/api/customer/update' || pathname === '/api/customers/update' || pathname.startsWith('/api/customers/'))) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const urlCustId = pathname.startsWith('/api/customers/') && pathname !== '/api/customers/update' ? pathname.split('/')[3] : null;
        const customerId = payload.customerId || payload.id || urlCustId;
        const { displayName, whatsappNumber, phoneNumber, whatsappId } = payload;

        if (!customerId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing customerId' }));
          return;
        }

        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          const updateData = {};
          if (displayName !== undefined) updateData.displayName = displayName;
          if (whatsappNumber !== undefined) updateData.whatsappNumber = whatsappNumber;
          if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
          if (whatsappId !== undefined) updateData.whatsappId = whatsappId;
          updateData.updatedAt = new Date();

          const updatedCust = await prisma.customer.update({
            where: { id: customerId },
            data: updateData
          }).catch(err => {
            console.warn('Prisma customer update error:', err.message);
            return null;
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, customer: updatedCust }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Updated locally' }));
      } catch (err) {
        console.error('❌ [Customer Update Error]:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10b4. REST: Add New Contact & Lead directly into Supabase PostgreSQL
  if (req.method === 'POST' && (pathname === '/api/contacts' || pathname === '/api/contacts/create' || pathname === '/api/leads/create')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { name, phone, whatsappNumber, categoryId, treatmentId, language, assignedTo, initialMessage, templateName, templateParams, company } = payload;
        const compRaw = (company || 'RWC').toUpperCase();
        const targetCompany = compRaw === 'AHC' ? 'AHC' : (compRaw === 'CRAS' ? 'CRAS' : 'RWC');

        const rawPhone = (phone || whatsappNumber || '').trim();
        const norm = normalizeE164(rawPhone);
        if (!norm.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: `Invalid phone number format: "${rawPhone}". International E.164 format required (10-15 digits, e.g. 94706373353 or +94706373353).`
          }));
          return;
        }

        const cleanDigits = norm.clean;
        const canonicalPhone = norm.canonical;
        // Keep newly created contact names compact for the CRM list while preserving the phone fallback.
        const contactName = ((name || '').trim().slice(0, 10)) || canonicalPhone;

        const prisma = getPrisma();
        let savedCustomer = null;
        let savedLead = null;
        let savedMessage = null;
        let dispatchSuccess = null;
        let dispatchErrorMessage = null;

        if (prisma && getDbStatus()) {
          // Contact numbers are globally unique in the CRM. Do not silently
          // update an existing customer or create another company lead from
          // the Add Contact form; return a clear conflict instead.
          const duplicateCustomer = await prisma.customer.findFirst({
            where: {
              OR: [
                { whatsappNumber: canonicalPhone },
                { whatsappNumber: cleanDigits },
                { whatsappId: cleanDigits },
                ...(cleanDigits.length >= 9 ? [{ whatsappNumber: { contains: cleanDigits.slice(-9) } }] : [])
              ]
            },
            select: {
              id: true,
              displayName: true,
              whatsappNumber: true,
              leads: {
                select: { company: true, source: true, assignedById: true, assignedByName: true, createdAt: true },
                orderBy: { createdAt: 'asc' },
                take: 1
              }
            }
          });

          if (duplicateCustomer) {
            const existingLead = duplicateCustomer.leads?.[0];
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              duplicate: true,
              errorCode: 'DUPLICATE_CONTACT',
              error: `Duplicate contact: this WhatsApp number is already registered. Added by ${existingLead?.assignedByName || 'not recorded for this existing CRM record'}. The contact was not added.`,
              existingContact: {
                id: duplicateCustomer.id,
                displayName: duplicateCustomer.displayName,
                whatsappNumber: duplicateCustomer.whatsappNumber,
                company: existingLead?.company || existingLead?.source || null,
                addedById: existingLead?.assignedById || null,
                addedByName: existingLead?.assignedByName || null,
                addedAt: existingLead?.createdAt || null
              }
            }));
            return;
          }

          // The Customer model also has a unique WhatsApp-number constraint.
          // It protects against two simultaneous requests passing the check
          // above; map that race to the same user-facing conflict response.
          try {
            savedCustomer = await prisma.customer.create({
              data: {
                whatsappNumber: canonicalPhone,
                phoneNumber: canonicalPhone,
                whatsappId: cleanDigits,
                displayName: contactName,
                preferredLanguage: language || 'en'
              }
            });
          } catch (createError) {
            if (createError?.code === 'P2002') {
              const existingCustomer = await prisma.customer.findFirst({
                where: {
                  OR: [
                    { whatsappNumber: canonicalPhone },
                    { whatsappNumber: cleanDigits },
                    { whatsappId: cleanDigits },
                    ...(cleanDigits.length >= 9 ? [{ whatsappNumber: { contains: cleanDigits.slice(-9) } }] : [])
                  ]
                },
                select: {
                  id: true,
                  displayName: true,
                  whatsappNumber: true,
                  leads: {
                    select: { company: true, source: true, assignedById: true, assignedByName: true, createdAt: true },
                    orderBy: { createdAt: 'asc' },
                    take: 1
                  }
                }
              }).catch(() => null);
              const existingLead = existingCustomer?.leads?.[0];
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: false,
                duplicate: true,
                errorCode: 'DUPLICATE_CONTACT',
                error: `Duplicate contact: this WhatsApp number is already registered. Added by ${existingLead?.assignedByName || 'not recorded for this existing CRM record'}. The contact was not added.`,
                existingContact: existingCustomer ? {
                  id: existingCustomer.id,
                  displayName: existingCustomer.displayName,
                  whatsappNumber: existingCustomer.whatsappNumber,
                  company: existingLead?.company || existingLead?.source || null,
                  addedById: existingLead?.assignedById || null,
                  addedByName: existingLead?.assignedByName || null,
                  addedAt: existingLead?.createdAt || null
                } : undefined
              }));
              return;
            }
            throw createError;
          }

          // 2. Resolve or create Category & Treatment based on targetCompany
          let firstCat = null;
          let firstTrt = null;

          if (targetCompany === 'CRAS') {
            if (categoryId) {
              firstCat = await prisma.treatmentCategory.findFirst({
                where: {
                  id: categoryId,
                  OR: [
                    { id: 'cat-cras-courses' },
                    { id: { contains: 'cras' } },
                    { name: { contains: 'CRAS' } },
                    { name: { contains: 'Course' } },
                    { name: { contains: 'Academic' } }
                  ]
                }
              }).catch(() => null);
            }
            if (!firstCat) {
              firstCat = await prisma.treatmentCategory.findFirst({
                where: {
                  OR: [
                    { id: 'cat-cras-courses' },
                    { id: { contains: 'cras' } },
                    { name: { contains: 'CRAS' } },
                    { name: { contains: 'Course' } },
                    { name: { contains: 'Academic' } }
                  ]
                }
              }).catch(() => null);
            }

            if (treatmentId) {
              firstTrt = await prisma.treatment.findFirst({
                where: {
                  id: treatmentId,
                  ...(firstCat ? { categoryId: firstCat.id } : {})
                }
              }).catch(() => null);
            }
            if (!firstTrt && firstCat) {
              firstTrt = await prisma.treatment.findFirst({ where: { categoryId: firstCat.id } }).catch(() => null);
            }
            if (!firstTrt) {
              firstTrt = await prisma.treatment.findFirst({
                where: {
                  OR: [
                    { id: 'crs-adi' },
                    { id: 'crs-fam' },
                    { id: 'crs-fac' },
                    { name: { contains: 'Injectables' } },
                    { name: { contains: 'Aesthetic' } }
                  ]
                }
              }).catch(() => null);
            }
          } else {
            // RWC Category & Treatment
            if (categoryId) {
              firstCat = await prisma.treatmentCategory.findFirst({
                where: {
                  id: categoryId,
                  NOT: {
                    OR: [
                      { id: 'cat-cras-courses' },
                      { id: { contains: 'cras' } },
                      { name: { contains: 'CRAS' } }
                    ]
                  }
                }
              }).catch(() => null);
            }
            if (!firstCat) {
              firstCat = await prisma.treatmentCategory.findFirst({
                where: {
                  NOT: {
                    OR: [
                      { id: 'cat-cras-courses' },
                      { id: { contains: 'cras' } },
                      { name: { contains: 'CRAS' } }
                    ]
                  }
                }
              }).catch(() => null);
            }

            if (treatmentId) {
              firstTrt = await prisma.treatment.findFirst({
                where: {
                  id: treatmentId,
                  ...(firstCat ? { categoryId: firstCat.id } : {})
                }
              }).catch(() => null);
            }
            if (!firstTrt && firstCat) {
              firstTrt = await prisma.treatment.findFirst({ where: { categoryId: firstCat.id } }).catch(() => null);
            }
          }

          // 3. Resolve assigned coordinator (filter by company)
          let targetCoordinatorId = null;
          if (authUser?.role === 'coordinator') {
            const coordCompany = (authUser.company || 'RWC').toUpperCase();
            if (coordCompany === targetCompany) {
              targetCoordinatorId = authUser.id;
            }
          } else if (assignedTo) {
            const coord = await prisma.user.findUnique({ where: { id: assignedTo } }).catch(() => null);
            if (coord) {
              const coordCompany = (coord.company || 'RWC').toUpperCase();
              if (coordCompany === targetCompany || !coord.company) {
                targetCoordinatorId = coord.id;
              }
            }
          }

          // 4. Find existing or create new Lead
          // First check if there is an existing lead specifically for targetCompany
          savedLead = await prisma.lead.findFirst({
            where: {
              customerId: savedCustomer.id,
              OR: [
                { company: targetCompany },
                { source: targetCompany }
              ]
            },
            orderBy: { updatedAt: 'desc' }
          });

          // If no company-specific lead exists, check if customer has an un-messaged empty lead
          if (!savedLead) {
            const existingLeads = await prisma.lead.findMany({
              where: { customerId: savedCustomer.id },
              include: { messages: true },
              orderBy: { updatedAt: 'desc' }
            });
            const emptyLead = existingLeads.find(l => (l.messages || []).length === 0);
            if (emptyLead) {
              savedLead = emptyLead;
            }
          }

          const leadStage = initialMessage ? 'contacted' : (targetCoordinatorId ? 'assigned' : 'new');

          if (!savedLead) {
            const companySerial = await allocateCompanyLeadSerial(prisma, targetCompany);
            savedLead = await prisma.lead.create({
              data: {
                customerId: savedCustomer.id,
                company: targetCompany,
                source: targetCompany,
                serialNumber: companySerial,
                categoryId: firstCat?.id || (targetCompany === 'CRAS' ? 'cat-cras-courses' : 'cat-hair-care'),
                treatmentId: firstTrt?.id || (targetCompany === 'CRAS' ? 'crs-adi' : 'trt-prp'),
                stage: leadStage,
                assignedTo: targetCoordinatorId,
                // Preserve who created the original contact so duplicate attempts
                // can explain where the existing CRM record came from.
                assignedById: authUser?.id || null,
                assignedByName: authUser?.fullName || 'System',
                assignedAt: targetCoordinatorId ? new Date() : null,
                language: language || 'en',
                lastCustomerMessageAt: null
              },
              include: {
                customer: true,
                category: true,
                treatment: true,
                assignedCoordinator: true,
                assignmentHistories: { orderBy: { assignedAt: 'desc' } },
                messages: true
              }
            });

            if (targetCoordinatorId) {
              const coordUser = await prisma.user.findUnique({ where: { id: targetCoordinatorId } }).catch(() => null);
              await prisma.leadAssignmentHistory.create({
                data: {
                  leadId: savedLead.id,
                  assignedToId: targetCoordinatorId,
                  assignedToName: coordUser?.fullName || 'Staff',
                  assignedById: authUser?.id || null,
                  assignedByName: authUser?.fullName || 'Admin',
                  assignedAt: new Date()
                }
              }).catch(() => null);
            }
          } else {
            // If lead already exists and is already assigned, reject reassignment attempt if not super_admin or leads_officer
            if (savedLead.assignedTo && targetCoordinatorId && targetCoordinatorId !== savedLead.assignedTo) {
              if (authUser?.role !== 'super_admin' && authUser?.role !== 'leads_officer') {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  errorCode: 'ASSIGNMENT_LOCKED',
                  error: 'Forbidden: Lead is already assigned to a coordinator. Only Super Admin or Leads Officer can change assignments.'
                }));
                return;
              }
            }

            savedLead = await prisma.lead.update({
              where: { id: savedLead.id },
              data: {
                company: targetCompany,
                source: targetCompany,
                categoryId: firstCat?.id || (targetCompany === 'CRAS' ? 'cat-cras-courses' : savedLead.categoryId),
                treatmentId: firstTrt?.id || (targetCompany === 'CRAS' ? 'crs-adi' : savedLead.treatmentId),
                assignedTo: targetCoordinatorId !== undefined ? targetCoordinatorId : savedLead.assignedTo,
                ...(targetCoordinatorId && targetCoordinatorId !== savedLead.assignedTo ? {
                  assignedById: authUser?.id || null,
                  assignedByName: authUser?.fullName || 'Admin',
                  assignedAt: new Date(),
                } : {}),
                ...(!savedLead.assignedByName ? {
                  assignedById: authUser?.id || savedLead.assignedById || null,
                  assignedByName: authUser?.fullName || savedLead.assignedByName || 'System'
                } : {}),
                stage: initialMessage ? 'contacted' : savedLead.stage,
                language: language || savedLead.language,
                updatedAt: new Date()
              },
              include: {
                customer: true,
                category: true,
                treatment: true,
                assignedCoordinator: true,
                assignmentHistories: { orderBy: { assignedAt: 'desc' } },
                messages: true
              }
            });

            if (targetCoordinatorId && targetCoordinatorId !== savedLead.assignedTo) {
              const coordUser = await prisma.user.findUnique({ where: { id: targetCoordinatorId } }).catch(() => null);
              await prisma.leadAssignmentHistory.create({
                data: {
                  leadId: savedLead.id,
                  assignedToId: targetCoordinatorId,
                  assignedToName: coordUser?.fullName || 'Staff',
                  assignedById: authUser?.id || null,
                  assignedByName: authUser?.fullName || 'Admin',
                  assignedAt: new Date()
                }
              }).catch(() => null);
            }
          }

          // 5. Send initial message or approved template via official company number
          let dispatchPayload = null;
          let msgContent = '';
          if (templateName && templateName.trim()) {
            msgContent = `[Template: ${templateName.trim()}]`;
            dispatchPayload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanDigits,
              type: 'template',
              template: {
                name: templateName.trim(),
                language: { code: language || 'en_US' },
                components: Array.isArray(templateParams) && templateParams.length > 0 ? [
                  {
                    type: 'body',
                    parameters: templateParams.map(p => ({ type: 'text', text: String(p) }))
                  }
                ] : undefined
              }
            };
          } else if (initialMessage && initialMessage.trim()) {
            msgContent = initialMessage.trim();
            dispatchPayload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanDigits,
              type: 'text',
              text: { body: msgContent }
            };
          }

          let metaMessageId = null;
          dispatchSuccess = false;
          let dispatchErrorCode = null;
          dispatchErrorMessage = null;

          if (dispatchPayload) {
            const metaToken = (metaConfig.accessToken || process.env.META_ACCESS_TOKEN || process.env.META_TOKEN || '').trim();
            const phoneId = targetCompany === 'AHC'
              ? (metaConfig.phoneNumberIdAhc || process.env.META_PHONE_NUMBER_ID_AHC || '1408148915714830').trim()
              : targetCompany === 'CRAS'
              ? (metaConfig.phoneNumberIdCras || process.env.META_PHONE_NUMBER_ID_CRAS || '1378201582041705').trim()
              : (metaConfig.phoneNumberIdRwc || metaConfig.phoneNumberId || process.env.META_PHONE_NUMBER_ID_RWC || '1358157244046701').trim();

            if (metaToken) {
              try {
                console.log(`🚀 [Add Contact Dispatch] Sending to ${cleanDigits} via Phone ID ${phoneId} (${targetCompany})...`);
                const metaRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${metaToken}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(dispatchPayload)
                });
                const metaData = await metaRes.json().catch(() => ({}));
                if (!metaRes.ok && metaData.error?.code === 131047 && dispatchPayload.type === 'text') {
                  // Automatic fallback to approved Meta greeting template
                  console.log(`ℹ️ [Add Contact] 24h window closed. Automatically dispatching approved Meta greeting template...`);
                  let autoTplName = 'rwc_welcome_greeting';
                  let autoTplLang = 'en_US';
                  if (targetCompany === 'AHC') {
                    autoTplName = 'ahc_welcome_greeting';
                    autoTplLang = 'en_US';
                  } else if (targetCompany === 'CRAS') {
                    autoTplName = 'cras_welcome_greeting';
                    autoTplLang = 'en_US';
                  } else if (language === 'ta' || language === 'tamil') {
                    autoTplName = 'rwc_welcome_greeting';
                    autoTplLang = 'ta';
                  } else {
                    autoTplName = 'rwc_welcome_greeting';
                    autoTplLang = 'en_US';
                  }

                  const fallbackTplPayload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: cleanDigits,
                    type: 'template',
                    template: {
                      name: autoTplName,
                      language: { code: autoTplLang },
                      components: [
                        {
                          type: 'body',
                          parameters: [{ type: 'text', text: contactName || 'Valued Client' }]
                        }
                      ]
                    }
                  };

                  const fallbackRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${metaToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(fallbackTplPayload)
                  });
                  const fallbackData = await fallbackRes.json().catch(() => ({}));
                  if (fallbackRes.ok) {
                    metaMessageId = fallbackData?.messages?.[0]?.id;
                    dispatchSuccess = true;
                    msgContent = `[Welcome Greeting: ${autoTplName}]`;
                    console.log(`✅ [Add Contact Fallback Success] Delivered via template ${autoTplName}: wamid:`, metaMessageId);
                  } else {
                    dispatchErrorCode = fallbackData.error?.code || metaData.error?.code;
                    const rawMsg = fallbackData.error?.message || metaData.error?.message;
                    dispatchErrorMessage = getMetaErrorExplanation(dispatchErrorCode, rawMsg);
                  }
                } else if (metaRes.ok) {
                  metaMessageId = metaData?.messages?.[0]?.id;
                  dispatchSuccess = true;
                  console.log(`✅ [Add Contact Dispatch Success] (${targetCompany} ${phoneId}): wamid:`, metaMessageId);
                } else {
                  dispatchErrorCode = metaData.error?.code || 400;
                  const rawMsg = metaData.error?.message || metaData.error?.error_user_msg || 'Meta Cloud API rejected dispatch';
                  dispatchErrorMessage = getMetaErrorExplanation(dispatchErrorCode, rawMsg);
                  console.warn(`❌ [Add Contact Dispatch Failed] Code ${dispatchErrorCode}: ${dispatchErrorMessage}`);
                }
              } catch (e) {
                dispatchErrorCode = 500;
                dispatchErrorMessage = e.message;
                console.warn('[Initial message Meta API dispatch warning]:', e.message);
              }
            }

            const actualSenderId = authUser?.id || null;
            const actualSenderName = authUser?.fullName || 'Staff';
            const actualSenderRole = authUser?.role === 'super_admin' ? 'Super Admin' : (authUser?.roleTitle || (authUser?.role === 'leads_officer' ? 'Sales Officer' : 'Sales Officer'));
            const actualSource = 'CRM User';
            const sentAtUtc = new Date();

            savedMessage = await prisma.message.create({
              data: {
                id: metaMessageId || `msg-${Date.now()}`,
                leadId: savedLead.id,
                customerId: savedCustomer.id,
                direction: 'outbound',
                senderType: 'coordinator',
                coordinatorId: targetCoordinatorId || authUser?.id || null,
                senderName: actualSenderName,
                senderRole: actualSenderRole,
                messageSource: actualSource,
                sentAt: sentAtUtc,
                content: msgContent,
                status: dispatchSuccess ? 'sent' : 'failed',
                errorCode: dispatchErrorCode || null,
                errorMessage: dispatchErrorMessage || null,
                timestamp: sentAtUtc
              }
            }).catch(() => null);

            if (savedMessage) {
                  const targetCompUpper = (targetCompany || savedLead.source || 'RWC').toUpperCase();
                  const auditComp = targetCompUpper === 'AHC' ? 'AHC' : (targetCompUpper === 'CRAS' ? 'CRAS' : 'RWC');
                  await prisma.messageAudit.create({
                    data: {
                      messageId: savedMessage.id,
                      leadId: savedLead.id,
                      customerId: savedCustomer.id,
                      company: auditComp,
                  whatsappNumber: canonicalPhone,
                  senderId: actualSenderId,
                  senderName: actualSenderName,
                  senderRole: actualSenderRole,
                  messageSource: actualSource,
                  deliveryStatus: dispatchSuccess ? 'sent' : 'failed',
                  sentAt: sentAtUtc
                }
              }).catch(() => null);
            }

            // Broadcast real-time outbound SSE with truthful status
            broadcastScopedSSE(targetCoordinatorId || null, {
              type: 'OUTBOUND_WHATSAPP_MESSAGE',
              messageId: savedMessage?.id || metaMessageId || `msg-${Date.now()}`,
              leadId: savedLead.id,
              customerId: savedCustomer.id,
              phone: canonicalPhone,
              realPhone: canonicalPhone,
              whatsappId: cleanDigits,
              name: contactName,
              text: msgContent,
              status: dispatchSuccess ? 'sent' : 'failed',
              errorCode: dispatchErrorCode || null,
              errorMessage: dispatchErrorMessage || null,
              direction: 'outbound',
              senderType: 'coordinator',
              senderId: actualSenderId,
              senderName: actualSenderName,
              senderRole: actualSenderRole,
              messageSource: actualSource,
              sentAt: sentAtUtc.toISOString(),
              timestamp: sentAtUtc.toISOString(),
              source: 'live'
            });
          }

          // Broadcast Lead Created/Assigned SSE with company metadata
          const compCodeRaw = (targetCompany || savedLead.source || '').toUpperCase();
          const compCode = compCodeRaw === 'AHC' ? 'AHC' : (compCodeRaw === 'CRAS' ? 'CRAS' : 'RWC');
          const compConfig = COMPANIES[compCode] || COMPANIES.RWC;
          const enrichedLead = {
            ...savedLead,
            company: compCode,
            source: compCode,
            companyTag: compConfig.tag,
            companyColor: compConfig.color,
            companyPhoneNumberId: compConfig.phoneId,
            companyPhoneNumber: compConfig.phone
          };

          broadcastScopedSSE(targetCoordinatorId || null, {
            type: 'LEAD_ASSIGNED',
            leadId: savedLead.id,
            clientLeadId: savedLead.id,
            coordinatorId: targetCoordinatorId,
            lead: enrichedLead
          });

          console.log(`✅ [Contact Created] ${contactName} (${canonicalPhone}) saved to Supabase PostgreSQL. Lead ID: ${savedLead.id}, Company: ${compCode}`);
        } else {
          // In-memory fallback. This is still protected against duplicates
          // created during the current process lifetime.
          const existingMemoryContact = inMemoryContactNumbers.get(cleanDigits);
          if (existingMemoryContact) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              duplicate: true,
              errorCode: 'DUPLICATE_CONTACT',
              error: `Duplicate contact: this WhatsApp number is already registered. Added by ${existingMemoryContact.addedByName || 'not recorded for this existing CRM record'}. The contact was not added.`,
              existingContact: existingMemoryContact
            }));
            return;
          }
          savedCustomer = {
            id: 'cust-' + Date.now(),
            whatsappNumber: canonicalPhone,
            whatsappId: cleanDigits,
            displayName: contactName,
            preferredLanguage: language || 'en'
          };
          inMemoryContactNumbers.set(cleanDigits, {
            id: savedCustomer.id,
            displayName: savedCustomer.displayName,
            whatsappNumber: savedCustomer.whatsappNumber,
            company: targetCompany,
            addedById: authUser?.id || null,
            addedByName: authUser?.fullName || 'System',
            addedAt: new Date().toISOString()
          });
          const compConfig = COMPANIES[targetCompany] || COMPANIES.RWC;
          savedLead = {
            id: 'lead-' + Date.now(),
            customerId: savedCustomer.id,
            customer: savedCustomer,
            categoryId: categoryId || (targetCompany === 'CRAS' ? 'cat-cras-courses' : 'cat-hair-care'),
            treatmentId: treatmentId || (targetCompany === 'CRAS' ? 'crs-adi' : 'trt-prp'),
            stage: initialMessage ? 'contacted' : 'new',
            source: targetCompany,
            company: targetCompany,
            companyTag: compConfig.tag,
            companyColor: compConfig.color,
            companyPhoneNumberId: compConfig.phoneId,
            companyPhoneNumber: compConfig.phone,
            assignedById: authUser?.id || null,
            assignedByName: authUser?.fullName || 'System',
            language: language || 'en',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        }

        const compCodeFinalUpper = (savedLead?.company || savedLead?.source || targetCompany).toUpperCase();
        const compCodeFinal = compCodeFinalUpper === 'AHC' ? 'AHC' : (compCodeFinalUpper === 'CRAS' ? 'CRAS' : 'RWC');
        const finalCompConfig = COMPANIES[compCodeFinal] || COMPANIES.RWC;
        const finalEnrichedLead = {
          ...savedLead,
          company: compCodeFinal,
          source: compCodeFinal,
          companyTag: finalCompConfig.tag,
          companyColor: finalCompConfig.color,
          companyPhoneNumberId: finalCompConfig.phoneId,
          companyPhoneNumber: finalCompConfig.phone
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          customer: savedCustomer,
          lead: finalEnrichedLead,
          message: savedMessage,
          leadId: savedLead?.id,
          messageSent: dispatchSuccess,
          messageError: dispatchErrorMessage
        }));
      } catch (err) {
        console.error('❌ [Add Contact Error]:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10b5. REST: Clear Chat Messages (Supabase PostgreSQL)
  if (req.method === 'POST' && (pathname === '/api/chats/clear' || pathname === '/api/messages/clear')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { leadId, customerId } = payload;

        // Resource-level authorization: coordinators can only clear messages for leads assigned to them
        if (authUser.role === 'coordinator') {
          const prisma = getPrisma();
          if (prisma && getDbStatus()) {
            let checkLead = null;
            if (leadId) {
              checkLead = await prisma.lead.findUnique({ where: { id: leadId } }).catch(() => null);
            } else if (customerId) {
              checkLead = await prisma.lead.findFirst({ where: { customerId } }).catch(() => null);
            }
            if (checkLead && checkLead.assignedTo && checkLead.assignedTo !== authUser.id) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Forbidden: You can only clear messages for leads assigned to you.' }));
              return;
            }
          }
        }

        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          const whereClause = [];
          if (leadId) whereClause.push({ leadId });
          if (customerId) whereClause.push({ customerId });

          if (whereClause.length > 0) {
            await prisma.message.deleteMany({
              where: { OR: whereClause }
            }).catch(e => console.warn('Could not clear messages in DB:', e.message));
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Chat messages cleared successfully.' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10b5b. REST: Edit Message (Supabase PostgreSQL)
  if (req.method === 'POST' && pathname === '/api/messages/edit') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { messageId, content } = payload;
        if (!messageId || !content) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'messageId and content are required' }));
          return;
        }

        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          // Resource-level check for coordinators
          if (authUser.role === 'coordinator') {
            const checkMsg = await prisma.message.findUnique({
              where: { id: messageId },
              include: { lead: true }
            }).catch(() => null);
            if (checkMsg && checkMsg.lead && checkMsg.lead.assignedTo && checkMsg.lead.assignedTo !== authUser.id) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Forbidden: You can only edit messages in leads assigned to you.' }));
              return;
            }
          }

          await prisma.message.update({
            where: { id: messageId },
            data: { content: content.trim() }
          }).catch(e => console.warn('Could not update message in DB:', e.message));
        }

        broadcastScopedSSE(null, {
          type: 'MESSAGE_EDITED',
          messageId,
          content: content.trim()
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Message edited successfully.' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10b6. REST: Delete Chat / Lead (Super Admin Only)
  if ((req.method === 'POST' || req.method === 'DELETE') && (pathname === '/api/chats/delete' || pathname === '/api/leads/delete' || pathname.startsWith('/api/leads/delete/'))) {
    if (authUser.role !== 'super_admin') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Forbidden: Only Super Admin can delete leads and chat histories.' }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const urlLeadId = pathname.startsWith('/api/leads/delete/') ? pathname.split('/')[4] : null;
        const leadId = payload.leadId || payload.id || urlLeadId;
        const customerId = payload.customerId;

        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          if (leadId) {
            // Remove associated media files from Supabase
            const msgs = await prisma.message.findMany({
              where: { leadId, mediaUrl: { not: null } },
              select: { mediaUrl: true }
            }).catch(() => []);
            const fileNames = msgs.map(m => m.mediaUrl?.replace('/uploads/', '')).filter(Boolean);
            if (fileNames.length > 0) {
              deleteMediaBatchFromSupabase(fileNames).catch(() => null);
            }

            await prisma.message.deleteMany({ where: { leadId } }).catch(() => {});
            await prisma.leadNote.deleteMany({ where: { leadId } }).catch(() => {});
            await prisma.leadStageHistory.deleteMany({ where: { leadId } }).catch(() => {});
            await prisma.followup.deleteMany({ where: { leadId } }).catch(() => {});
            await prisma.lead.deleteMany({ where: { id: leadId } }).catch(() => {});
          } else if (customerId) {
            const msgs = await prisma.message.findMany({
              where: { customerId, mediaUrl: { not: null } },
              select: { mediaUrl: true }
            }).catch(() => []);
            const fileNames = msgs.map(m => m.mediaUrl?.replace('/uploads/', '')).filter(Boolean);
            if (fileNames.length > 0) {
              deleteMediaBatchFromSupabase(fileNames).catch(() => null);
            }

            await prisma.message.deleteMany({ where: { customerId } }).catch(() => {});
            await prisma.lead.deleteMany({ where: { customerId } }).catch(() => {});
          }
        }

        // Broadcast lead deleted SSE
        broadcastScopedSSE(null, {
          type: 'LEAD_DELETED',
          leadId,
          customerId
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Chat deleted successfully.' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10c. REST: Get/Create Coordinators
  if (pathname === '/api/coordinators') {
    const isSuperAdmin = authUser && authUser.role === 'super_admin';
    const defaultCoordinators = (IS_TEST_ENV ? CANONICAL_USERS : [])
      .filter(u => !DELETED_USER_IDS.has(u.id) && u.active !== false)
      .map(u => {
        const { password, pin, ...safeUser } = u;
        return {
          ...safeUser,
          pinConfigured: Boolean(pin),
          branch: safeUser.branch || 'Colombo',
          company: safeUser.company !== undefined ? safeUser.company : (['leads_officer'].includes(safeUser.role) ? null : 'RWC'),
          createdAt: '2026-01-01T08:00:00Z',
          activeLeadsCount: 0,
        };
      });

    const prisma = getPrisma();
    if (req.method === 'GET') {
      if (prisma && getDbStatus()) {
        try {
          const users = await prisma.user.findMany({
            where: { active: true },
            orderBy: { createdAt: 'asc' }
          });
          if (users && users.length > 0) {
            const mappedUsers = users
              .filter(u => !DELETED_USER_IDS.has(u.id) && u.active !== false)
              .map(u => {
                const { password, pin, ...safeUser } = u;
                const revealedPin = isSuperAdmin ? (pin?.startsWith('enc:v1:') ? decryptReversible(pin) : (!pin?.startsWith('scrypt:') ? pin : null)) : undefined;
                const revealedPassword = isSuperAdmin ? (password?.startsWith('enc:v1:') ? decryptReversible(password) : (!password?.startsWith('scrypt:') ? password : null)) : undefined;
                return {
                  ...safeUser,
                  ...(isSuperAdmin ? { pin: revealedPin, password: revealedPassword } : {}),
                  pinConfigured: Boolean(pin),
                  branch: safeUser.branch || 'Colombo',
                  company: safeUser.company || (['leads_officer'].includes(safeUser.role) ? null : 'RWC'),
                };
              });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(mappedUsers));
            return;
          }
        } catch (e) {}
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(defaultCoordinators));
      return;
    }

    if (req.method === 'POST') {
      if (authUser.role !== 'super_admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Forbidden: Only Super Admin can register staff.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const fullName = (payload.fullName || payload.name || '').trim();
          let baseEmail = (payload.email || `${fullName.toLowerCase().replace(/[^a-z0-9]/g, '')}@royalwellness.lk`).trim();
          const cleanPin = String(payload.pin || '').trim().slice(0, 10);
          const cleanPassword = String(payload.password || 'staff').trim() || 'staff';
          const phone = payload.phone || null;
          const allowedStaffRoles = ['leads_officer', 'coordinator', 'sales_coordinator', 'exam_department_manager', 'exam_coordinator', 'exam_providing_officer', 'clinical_nurse', 'clinical_doctor', 'report_analyst', 'marketing_officer', 'marketing_admin'];
          const role = allowedStaffRoles.includes(payload.role) ? payload.role : 'coordinator';
          const branch = (payload.branch || 'Colombo').trim();
          const company = payload.company === 'ALL' || (!payload.company && role === 'leads_officer')
            ? null
            : (payload.company || (role === 'leads_officer' ? null : 'RWC'))?.trim();

          if (!fullName || cleanPassword.length < 4 || (cleanPin && cleanPin.length < 4)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Full name, a valid PIN, and password of at least 4 characters are required.' }));
            return;
          }

          let newUser = null;
          let safeEmail = baseEmail;
          if (prisma && getDbStatus()) {
            // Check for duplicate email in Supabase and append random suffix if needed
            const existingEmail = await prisma.user.findUnique({ where: { email: safeEmail } }).catch(() => null);
            if (existingEmail) {
              const [userPart, domainPart] = safeEmail.split('@');
              safeEmail = `${userPart}_${Math.floor(100 + Math.random() * 900)}@${domainPart || 'royalwellness.lk'}`;
            }

            const desiredId = (payload.id && typeof payload.id === 'string' && payload.id.length <= 36) ? payload.id : undefined;

            try {
              newUser = await prisma.user.create({
                data: {
                  id: desiredId,
                  fullName,
                  email: safeEmail,
                  ...(cleanPin ? { pin: encryptReversible(cleanPin) } : {}),
                  phone,
                  role: role,
                  branch: branch,
                  company: company,
                  password: encryptReversible(cleanPassword),
                  active: true
                }
              });
              console.log(`✅ [Staff Created in Supabase] ID: ${newUser.id}, Name: ${newUser.fullName}, Role: ${newUser.role}`);
            } catch (createErr) {
              // Retry without the caller-supplied id/email only for identifier conflicts (P2002).
              // Any other failure is a real defect and must surface instead of being hidden by a fallback.
              if (createErr?.code !== 'P2002') {
                console.error('DB error creating staff member:', createErr.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Could not create the staff account. Please try again.' }));
                return;
              }
              console.warn('⚠️ [Staff Create] Identifier already in use, retrying with a unique email.');
              newUser = await prisma.user.create({
                data: {
                  fullName,
                  email: `${safeEmail.split('@')[0]}_${Date.now()}@${safeEmail.split('@')[1] || 'royalwellness.lk'}`,
                  ...(cleanPin ? { pin: encryptReversible(cleanPin) } : {}),
                  phone,
                  role: role,
                  branch: branch,
                  company: company,
                  password: encryptReversible(cleanPassword),
                  active: true
                }
              });
              console.log(`✅ [Staff Created in Supabase Fallback] ID: ${newUser.id}, Name: ${newUser.fullName}`);
            }
          }

          const safeUserPayload = newUser ? {
            id: newUser.id,
            fullName: newUser.fullName,
            email: newUser.email,
            phone: newUser.phone,
            role: newUser.role,
            branch: newUser.branch,
            company: newUser.company,
            pin: cleanPin,
            pinConfigured: Boolean(cleanPin),
            active: newUser.active ?? true,
            createdAt: newUser.createdAt ? newUser.createdAt.toISOString() : new Date().toISOString()
          } : {
            id: payload.id || `staff-${Date.now()}`,
            fullName,
            email: safeEmail,
            phone,
            role,
            branch,
            company,
            pin: cleanPin,
            pinConfigured: Boolean(cleanPin),
            active: true,
            createdAt: new Date().toISOString()
          };

          // Broadcast staff created event via SSE
          broadcastScopedSSE(null, {
            type: 'STAFF_CREATED',
            user: { ...safeUserPayload, pin: undefined }
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            user: safeUserPayload 
          }));
        } catch (err) {
          console.error('❌ [Staff Create Error]:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  // 10c-2. REST: Update Coordinator / Staff (Super Admin Only) - Name & Branch
  if ((req.method === 'PUT' || req.method === 'PATCH' || (req.method === 'POST' && pathname.includes('/update'))) && 
      (pathname.startsWith('/api/coordinators') || pathname.startsWith('/api/users/'))) {
    if (authUser.role !== 'super_admin') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Forbidden: Only Super Admin can edit staff.' }));
      return;
    }

    const urlParts = pathname.split('/');
    const coordId = urlParts[3] || parsedUrl.query.id || parsedUrl.query.coordinatorId;

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const targetId = coordId || payload.id || payload.coordinatorId;

        if (!targetId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing coordinator ID' }));
          return;
        }

        const updateData = {};
        if (payload.fullName !== undefined) updateData.fullName = String(payload.fullName).trim();
        if (payload.name !== undefined && !payload.fullName) updateData.fullName = String(payload.name).trim();
        if (payload.branch !== undefined) updateData.branch = String(payload.branch).trim();
        if (payload.pin !== undefined && String(payload.pin).trim()) {
          updateData.pin = hashSecret(String(payload.pin).trim());
        }
        if (payload.password !== undefined && String(payload.password).trim()) {
          updateData.password = hashSecret(String(payload.password).trim());
        }

        if (Object.keys(updateData).length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'No fields to update provided' }));
          return;
        }

        const prisma = getPrisma();
        let updatedUser = null;
        if (prisma && getDbStatus()) {
          updatedUser = await prisma.user.update({
            where: { id: targetId },
            data: updateData
          }).catch(err => {
            console.warn(`Prisma user update failed for ${targetId}:`, err.message);
            return null;
          });
        }

        console.log(`✅ [Staff Updated in Supabase] ID: ${targetId}, Name: ${updateData.fullName}, Branch: ${updateData.branch}`);

        // Broadcast SSE update event to all connected clients
        broadcastScopedSSE('user-admin-1', {
          type: 'COORDINATOR_UPDATED',
          coordinator: updatedUser || { id: targetId, ...updateData }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          user: updatedUser || { id: targetId, ...updateData } 
        }));
      } catch (err) {
        console.error('❌ [Update Coordinator Error]:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10d. REST: Delete Coordinator (Super Admin Only)
  if (req.method === 'DELETE' && (pathname.startsWith('/api/coordinators') || pathname.startsWith('/api/users/'))) {
    try {
      if (authUser.role !== 'super_admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Forbidden: Only Super Admin can delete staff.' }));
        return;
      }

      // Extract ID from URL path or query safely
      const cleanParts = pathname.split('/').filter(Boolean);
      const coordId = (cleanParts.length >= 3 ? cleanParts[cleanParts.length - 1] : null) || parsedUrl.query.id || parsedUrl.query.coordinatorId;

      if (!coordId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Missing coordinator ID' }));
        return;
      }

      if (coordId === 'user-admin-1') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Super Admin cannot be deleted.' }));
        return;
      }

      if (coordId === authUser.id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'You cannot deactivate your own account.' }));
        return;
      }

      // Track in memory so a removed coordinator is never returned on subsequent queries
      DELETED_USER_IDS.add(coordId);

      const prisma = getPrisma();
      if (prisma && getDbStatus() && !IS_TEST_ENV) {
        // Never hard-delete an identity that owns business records. Deactivate,
        // bump the session version and mark every device session revoked.
        await prisma.user.updateMany({
          where: { id: coordId },
          data: { active: false }
        }).catch(e => console.warn('Could not deactivate staff account:', e.message));
        await prisma.$executeRawUnsafe(
          `UPDATE public.users SET session_version = session_version + 1 WHERE id = $1`,
          coordId
        ).catch(() => {});
        await prisma.$executeRawUnsafe(
          `UPDATE public.user_sessions SET revoked_at = NOW(), revoked_by = $2, revoke_reason = 'Staff account deactivated'
            WHERE user_id = $1 AND revoked_at IS NULL`,
          coordId, authUser.id
        ).catch(() => {});
        await auditSecurityEvent({
          correlationId, actorId: authUser.id, action: 'user.deactivate',
          resource: `user:${coordId}`, outcome: 'success', metadata: { source: 'legacy-coordinators' },
        });
      } else if (prisma && getDbStatus()) {
        // Test fixtures: no linked records to preserve.
        await prisma.$executeRawUnsafe('DELETE FROM public.user_sessions WHERE user_id = $1', coordId).catch(() => {});
        await prisma.user.deleteMany({ where: { id: coordId } }).catch(() => {});
      }

      // 4. Broadcast SSE deletion event to all connected clients
      broadcastScopedSSE('user-admin-1', {
        type: 'COORDINATOR_DELETED',
        coordinatorId: coordId
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deletedId: coordId }));
    } catch (err) {
      console.error('❌ [Delete Coordinator Error]:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 10d-2. REST: Team Broadcast Messages (Super Admin & Leads Officer Channel)
  if (pathname === '/api/broadcasts' || pathname.startsWith('/api/broadcasts/')) {
    const prisma = getPrisma();

    // GET /api/broadcasts
    if (req.method === 'GET') {
      try {
        let broadcasts = [];
        if (prisma && getDbStatus()) {
          try {
            const rawRows = await prisma.$queryRawUnsafe(`
              SELECT 
                id, 
                sender_id as "senderId", 
                sender_name as "senderName", 
                sender_role as "senderRole", 
                company, 
                title, 
                content, 
                media_type as "mediaType", 
                media_url as "mediaUrl", 
                file_name as "fileName", 
                file_size as "fileSize", 
                is_pinned as "isPinned", 
                target_staff_id as "targetStaffId",
                target_staff_name as "targetStaffName",
                created_at as "createdAt"
              FROM public.team_broadcasts 
              ORDER BY is_pinned DESC, created_at DESC 
              LIMIT 100;
            `);
            if (Array.isArray(rawRows)) {
              broadcasts = rawRows;
            }
          } catch (dbErr) {
            console.warn('⚠️ [Team Broadcasts DB Query Fallback]:', dbErr.message);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, broadcasts }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message, broadcasts: [] }));
      }
      return;
    }

    // POST /api/broadcasts (Super Admin & Leads Officer only)
    if (req.method === 'POST') {
      if (authUser.role !== 'super_admin' && authUser.role !== 'leads_officer') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Forbidden: Only Super Admin and Leads Officers can send team broadcasts.' 
        }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const content = String(payload.content || '').trim();
          const title = payload.title ? String(payload.title).trim() : null;
          const mediaType = payload.mediaType || null; // 'image' | 'video' | 'document' | 'audio'
          const mediaUrl = payload.mediaUrl || null;
          const fileName = payload.fileName || null;
          const fileSize = payload.fileSize ? Number(payload.fileSize) : null;
          const isPinned = Boolean(payload.isPinned);
          const company = payload.company || 'ALL'; // 'ALL', 'RWC', 'CRAS'
          const targetStaffId = payload.targetStaffId ? String(payload.targetStaffId).trim() : null;
          const targetStaffName = payload.targetStaffName ? String(payload.targetStaffName).trim() : null;

          if (!content && !mediaUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Broadcast message content or media is required.' }));
            return;
          }

          const broadcastId = `tb-${Date.now()}`;
          const newBroadcast = {
            id: broadcastId,
            senderId: authUser.id,
            senderName: authUser.fullName || 'Management',
            senderRole: authUser.role,
            company,
            title,
            content,
            mediaType,
            mediaUrl,
            fileName,
            fileSize,
            isPinned,
            targetStaffId,
            targetStaffName,
            createdAt: new Date().toISOString()
          };

          if (prisma && getDbStatus()) {
            await prisma.$executeRawUnsafe(`
              INSERT INTO public.team_broadcasts (
                id, sender_id, sender_name, sender_role, company, title, content, 
                media_type, media_url, file_name, file_size, is_pinned, target_staff_id, target_staff_name, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW());
            `, 
              newBroadcast.id, 
              newBroadcast.senderId, 
              newBroadcast.senderName, 
              newBroadcast.senderRole, 
              newBroadcast.company, 
              newBroadcast.title, 
              newBroadcast.content, 
              newBroadcast.mediaType, 
              newBroadcast.mediaUrl, 
              newBroadcast.fileName, 
              newBroadcast.fileSize, 
              newBroadcast.isPinned,
              newBroadcast.targetStaffId,
              newBroadcast.targetStaffName
            ).catch(e => console.warn('⚠️ Could not insert broadcast into Supabase:', e.message));
          }

          // Broadcast SSE event to all connected team members in real-time
          broadcastScopedSSE(null, {
            type: 'TEAM_BROADCAST_CREATED',
            broadcast: newBroadcast
          });

          console.log(`📢 [Team Broadcast Posted] By: ${authUser.fullName} (${authUser.role}), Title: ${title || 'Notice'}`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, broadcast: newBroadcast }));
        } catch (err) {
          console.error('❌ [Broadcast Create Error]:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // DELETE /api/broadcasts/:id (Super Admin only or author)
    if (req.method === 'DELETE') {
      const urlParts = pathname.split('/');
      const broadcastId = urlParts[3] || parsedUrl.query.id;

      if (!broadcastId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Missing broadcast ID' }));
        return;
      }

      if (authUser.role !== 'super_admin' && authUser.role !== 'leads_officer') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Forbidden: Cannot delete broadcasts.' }));
        return;
      }

      if (prisma && getDbStatus()) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM public.team_broadcasts WHERE id = $1;`, 
          broadcastId
        ).catch(() => null);
      }

      broadcastScopedSSE(null, {
        type: 'TEAM_BROADCAST_DELETED',
        broadcastId
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deletedId: broadcastId }));
      return;
    }
  }

  // 10e. REST: Get/Save Meta Cloud API Configuration
  if (pathname === '/api/meta/config' || pathname === '/api/meta/token') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        hasToken: Boolean(metaConfig.accessToken || process.env.META_ACCESS_TOKEN || process.env.META_TOKEN),
        phoneNumberId: metaConfig.phoneNumberId,
        wabaId: metaConfig.wabaId
      }));
      return;
    }

    if (req.method === 'POST') {
      if (authUser.role !== 'super_admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Forbidden: Only Super Admin can configure Meta Cloud API settings.' }));
        return;
      }
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (payload.accessToken !== undefined) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Meta access tokens must be configured through the server environment or secret manager.' }));
            return;
          }
          if (payload.phoneNumberId) {
            metaConfig.phoneNumberId = String(payload.phoneNumberId).trim();
            await setSystemSetting('META_PHONE_NUMBER_ID', metaConfig.phoneNumberId).catch(() => {});
          }
          if (payload.wabaId) {
            metaConfig.wabaId = String(payload.wabaId).trim();
            await setSystemSetting('META_WABA_ID', metaConfig.wabaId).catch(() => {});
          }
          if (payload.appSecret !== undefined) {
            metaConfig.appSecret = String(payload.appSecret || '').trim();
            await setSystemSetting('META_APP_SECRET', metaConfig.appSecret).catch(() => {});
          }
          if (payload.verifyToken !== undefined) {
            metaConfig.verifyToken = String(payload.verifyToken || '').trim();
            await setSystemSetting('META_VERIFY_TOKEN', metaConfig.verifyToken).catch(() => {});
          }

          console.log(`🔑 [Meta Config Updated] Phone ID: ${metaConfig.phoneNumberId}, Token configured: ${Boolean(metaConfig.accessToken)}`);

          // Broadcast to all active staff connections via SSE so every staff interface syncs immediately
          broadcastScopedSSE(null, {
            type: 'META_CONFIG_UPDATED',
            hasToken: Boolean(metaConfig.accessToken),
            phoneNumberId: metaConfig.phoneNumberId,
            wabaId: metaConfig.wabaId
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            hasToken: Boolean(metaConfig.accessToken),
            phoneNumberId: metaConfig.phoneNumberId,
            wabaId: metaConfig.wabaId
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  // 11. Clear Data Endpoint
  if (req.method === 'POST' && pathname === '/api/clear-db') {
    if (authUser.role !== 'super_admin') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden. Super Admin access required.' }));
      return;
    }

    // This destructive development utility must never be available to a
    // production runtime, even to a privileged application account.
    if (String(process.env.DB_ENVIRONMENT || '').toLowerCase() === 'production') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Database clearing is disabled in production.' }));
      return;
    }

    const prisma = getPrisma();
    if (!prisma || !getDbStatus()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Database is unavailable; no records were changed.' }));
      return;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.message.deleteMany({});
        await tx.leadNote.deleteMany({});
        await tx.leadStageHistory.deleteMany({});
        await tx.followup.deleteMany({});
        await tx.lead.deleteMany({});
        await tx.customer.deleteMany({});
      });
    } catch (error) {
      console.error('Database clear failed:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Database clear failed; the transaction was rolled back.' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Database cleared successfully.' }));
    return;
  }

  // 12. Meta WhatsApp Cloud API Webhook Handlers
  if (
    pathname === '/api/webhook' || 
    pathname === '/webhook' || 
    pathname === '/api/meta/webhook' || 
    pathname === '/meta/webhook'
  ) {
    if (req.method === 'GET') {
      const mode = parsedUrl.query['hub.mode'];
      const token = parsedUrl.query['hub.verify_token'];
      const challenge = parsedUrl.query['hub.challenge'];
      const configuredToken = String(process.env.META_VERIFY_TOKEN || (typeof metaConfig !== 'undefined' ? metaConfig?.verifyToken : '') || '').trim();
      const defaultToken = 'royal_wellness_token_2026';

      console.log(`🔍 [Meta Webhook Verification] Mode: ${mode}, Token provided: ${token ? 'YES' : 'NO'}`);
      const matchesConfigured = configuredToken && timingSafeStringEqual(token, configuredToken);
      const matchesDefault = timingSafeStringEqual(token, defaultToken);

      if (mode === 'subscribe' && (matchesConfigured || matchesDefault)) {
        console.log('✅ [Meta Webhook Verification] Verified successfully!');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(challenge);
      } else {
        console.warn('⚠️ [Meta Webhook Verification] Token mismatch or invalid mode.');
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden. Invalid verification token.' }));
      }
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const signature = req.headers['x-hub-signature-256'];
          if (!verifyMetaSignature(body, signature)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid webhook signature.' }));
            return;
          }
          console.log(`[Meta Webhook POST] Verified payload received on ${pathname}`);
          if (payload.object === 'whatsapp_business_account' && Array.isArray(payload.entry)) {
            for (const entry of payload.entry) {
              for (const change of entry.changes || []) {
                if (change.field === 'messages' && change.value) {
                  const val = change.value;
                  const metadata = val.metadata;
                  const incomingPhoneId = metadata?.phone_number_id;
                  const incomingDisplayPhone = metadata?.display_phone_number;
                  const companyInfo = resolveCompany(incomingPhoneId, incomingDisplayPhone);

                  // Process all incoming messages in the payload
                  const incomingMessages = Array.isArray(val.messages) ? val.messages : [];
                  for (const message of incomingMessages) {
                    const contact = val.contacts?.find(c => c.wa_id === message.from) || val.contacts?.[0];
                    const phone = contact?.wa_id || message.from;
                    const name = contact?.profile?.name || (phone ? `+${phone}` : 'Meta Direct Contact');
                    const msgType = message.type || 'text';
                    const messageId = message.id;

                    console.log(`📩 [Meta Webhook Event] Inbound on Phone ID: ${incomingPhoneId || 'none'} (${incomingDisplayPhone || 'none'}) -> Company: ${companyInfo.code} (${companyInfo.tag}) | MsgId: ${messageId}`);

                    let mediaType = null;
                    let mediaUrl = null;
                    let mediaFileName = null;
                    let text = message.text?.body || 
                      message.button?.text || 
                      message.interactive?.button_reply?.title || 
                      message.interactive?.list_reply?.title || 
                      '';

                    const metaToken = (metaConfig.accessToken || process.env.META_ACCESS_TOKEN || process.env.META_TOKEN || '').trim();

                    if (['image', 'audio', 'voice', 'video', 'document'].includes(msgType)) {
                      mediaType = msgType === 'voice' ? 'audio' : msgType;
                      const mediaObj = message.image || message.audio || message.voice || message.video || message.document;
                      const mediaId = mediaObj?.id;
                      const mimeType = mediaObj?.mime_type || '';
                      mediaFileName = mediaObj?.filename || null;

                      if (mediaObj?.caption) {
                        text = mediaObj.caption;
                      } else if (!text) {
                        text = mediaFileName || (mediaType === 'audio' ? 'Voice note' : `[${mediaType.toUpperCase()}]`);
                      }

                      if (mediaId && metaToken) {
                        mediaUrl = await downloadMetaMedia(mediaId, metaToken, mimeType, mediaFileName);
                      }
                    }

                    if (!text && !mediaType) {
                      text = '[Message]';
                    }

                    let savedLeadId = null;
                    let savedCustomerId = null;
                    let cust = null;
                    let lead = null;

                    // Persist to Supabase / PostgreSQL database
                    const prisma = getPrisma();
                    const marketingInbound = prisma && getDbStatus() && phone
                      ? await processMarketingInboundMessage({ prisma, company: companyInfo.code, phone, text, messageId, receivedAt: new Date() }).catch(error => {
                          console.error('[Marketing inbound automation]', error.message);
                          return null;
                        })
                      : null;
                    if (marketingInbound) continue;

                    if (prisma && getDbStatus() && phone) {
                      try {
                        const rawClean = String(phone).replace(/[^0-9]/g, '');
                        const canonicalPhone = rawClean.startsWith('+') ? rawClean : `+${rawClean}`;
                        const localClean = rawClean.startsWith('94') ? '0' + rawClean.slice(2) : rawClean;
                        const formattedWithSpaces = rawClean.startsWith('94')
                          ? `+94 ${rawClean.slice(2, 4)} ${rawClean.slice(4, 7)} ${rawClean.slice(7)}`
                          : canonicalPhone;

                        // 1. Find or create Customer
                        cust = await prisma.customer.findFirst({
                          where: {
                            OR: [
                              { whatsappNumber: canonicalPhone },
                              { whatsappNumber: rawClean },
                              { whatsappNumber: formattedWithSpaces },
                              { whatsappNumber: localClean },
                              { whatsappNumber: { contains: rawClean.slice(-9) } },
                              { whatsappId: rawClean },
                              { whatsappId: phone },
                              { phoneNumber: { contains: rawClean.slice(-9) } }
                            ]
                          }
                        });

                        if (!cust) {
                          cust = await prisma.customer.create({
                            data: {
                              whatsappNumber: canonicalPhone,
                              whatsappId: rawClean,
                              displayName: name || canonicalPhone,
                              preferredLanguage: 'en'
                            }
                          });
                        } else if (name && name !== canonicalPhone && name !== rawClean && (!cust.displayName || cust.displayName.startsWith('+'))) {
                          cust = await prisma.customer.update({
                            where: { id: cust.id },
                            data: { displayName: name }
                          }).catch(() => cust);
                        }

                        savedCustomerId = cust?.id || null;

                        // 2. Find or create Lead for this company
                        lead = await prisma.lead.findFirst({
                          where: {
                            customerId: cust.id,
                            OR: [
                              { company: companyInfo.code },
                              { source: companyInfo.code }
                            ]
                          },
                          orderBy: { updatedAt: 'desc' }
                        });

                        // Only adopt legacy unassigned leads that do not belong to another company
                        if (!lead) {
                          lead = await prisma.lead.findFirst({
                            where: {
                              customerId: cust.id,
                              company: null
                            },
                            orderBy: { updatedAt: 'desc' }
                          });
                        }

                        if (!lead) {
                          const firstCat = await prisma.treatmentCategory.findFirst().catch(() => null);
                          const firstTrt = await prisma.treatment.findFirst().catch(() => null);

                          lead = await prisma.lead.create({
                            data: {
                              serialNumber: await allocateCompanyLeadSerial(prisma, companyInfo.code),
                              customerId: cust.id,
                              categoryId: firstCat?.id || null,
                              treatmentId: firstTrt?.id || null,
                              stage: 'new',
                              company: companyInfo.code,
                              source: companyInfo.code,
                              language: 'en',
                              lastCustomerMessageAt: new Date()
                            }
                          });
                        } else {
                          await prisma.lead.update({
                            where: { id: lead.id },
                            data: {
                              company: companyInfo.code,
                              source: companyInfo.code,
                              lastCustomerMessageAt: new Date(),
                              updatedAt: new Date()
                            }
                          }).catch(() => {});
                        }

                        savedLeadId = lead?.id || null;

                        // 3. Save Message to DB with Media Details & Company
                        await prisma.message.upsert({
                          where: { id: messageId },
                          update: {
                            content: text,
                            mediaType: mediaType || undefined,
                            mediaUrl: mediaUrl || undefined,
                            status: 'delivered'
                          },
                          create: {
                            id: messageId,
                            leadId: lead.id,
                            customerId: cust.id,
                            direction: 'inbound',
                            senderType: 'customer',
                            content: text,
                            status: 'delivered',
                            mediaType: mediaType || null,
                            mediaUrl: mediaUrl || null,
                            timestamp: new Date()
                          }
                        });
                        console.log(`✅ [Meta Webhook] Inbound message saved to DB [${companyInfo.code}]: ID ${messageId}, Lead ${lead.id}, Customer ${cust.id}`);
                      } catch (e) {
                        console.error('❌ [DB Error saving inbound Meta message]:', e);
                      }
                    }

                    // 4. Broadcast SSE with Company Tags (RWC / CRAS)
                    broadcastScopedSSE(lead?.assignedTo || null, {
                      type: 'INBOUND_WHATSAPP_MESSAGE',
                      phone: phone ? (phone.startsWith('+') ? phone : `+${phone}`) : '',
                      whatsappId: phone,
                      realPhone: phone ? (phone.startsWith('+') ? phone : `+${phone}`) : '',
                      name,
                      text,
                      media: mediaType ? {
                        type: mediaType,
                        url: mediaUrl,
                        fileName: mediaFileName || (mediaType === 'audio' ? 'Voice Note' : 'Attachment')
                      } : null,
                      messageId,
                      leadId: savedLeadId,
                      customerId: savedCustomerId,
                      coordinatorId: lead?.assignedTo || null,
                      company: companyInfo.code,
                      companyTag: companyInfo.tag,
                      companyColor: companyInfo.colorHex,
                      companyPhoneNumberId: companyInfo.phoneId,
                      companyPhoneNumber: companyInfo.phoneNumber,
                      timestamp: new Date().toISOString()
                    });
                  }

                  // 12b. Handle Outbound Message Status Tracking (sent, delivered, read, failed)
                  if (Array.isArray(val.statuses) && val.statuses.length > 0) {
                    for (const statusItem of val.statuses) {
                      const wamid = statusItem.id;
                      const incomingStatus = statusItem.status; // 'sent' | 'delivered' | 'read' | 'failed'
                      const recipientPhone = statusItem.recipient_id;
                      const statusTimestamp = statusItem.timestamp ? new Date(Number(statusItem.timestamp) * 1000) : new Date();
                      let errorCode = null;
                      let errorMessage = null;

                      if (Array.isArray(statusItem.errors) && statusItem.errors.length > 0) {
                        errorCode = statusItem.errors[0].code;
                        const rawMsg = statusItem.errors[0].message || statusItem.errors[0].title;
                        errorMessage = getMetaErrorExplanation(errorCode, rawMsg);
                      }

                      console.log(`📩 [Meta Webhook Status] Message ${wamid} -> ${incomingStatus}${errorCode ? ` [Code ${errorCode}: ${errorMessage}]` : ''} at ${statusTimestamp.toISOString()} (Recipient: ${recipientPhone})`);

                      const prisma = getPrisma();
                      let leadId = null;
                      let customerId = null;
                      let finalStatus = incomingStatus;
                      let deliveredAtUtc = null;
                      let readAtUtc = null;

                      if (prisma && getDbStatus() && wamid) {
                        try {
                          let existingMsg = await prisma.message.findUnique({ where: { id: wamid } });
                          
                          // If not found by wamid, check if message is stored under a temporary ID for this recipient
                          if (!existingMsg && recipientPhone) {
                            const cleanRecip = recipientPhone.replace(/[^0-9]/g, '');
                            const matchedCust = await prisma.customer.findFirst({
                              where: {
                                OR: [
                                  { whatsappNumber: `+${cleanRecip}` },
                                  { whatsappNumber: cleanRecip },
                                  { whatsappId: cleanRecip }
                                ]
                              }
                            });
                            if (matchedCust) {
                              const recentOutbound = await prisma.message.findFirst({
                                where: { customerId: matchedCust.id, direction: 'outbound' },
                                orderBy: { timestamp: 'desc' }
                              });
                              if (recentOutbound && recentOutbound.id.startsWith('msg-')) {
                                existingMsg = recentOutbound;
                              }
                            }
                          }

                          if (existingMsg) {
                            leadId = existingMsg.leadId;
                            customerId = existingMsg.customerId;
                            deliveredAtUtc = existingMsg.deliveredAt;
                            readAtUtc = existingMsg.readAt;

                            // Strict Status Progression Guard (Hierarchy: pending: 0 < sent: 1 < delivered: 2 < read: 3)
                            const STATUS_RANKS = {
                              pending: 0,
                              sent: 1,
                              delivered: 2,
                              read: 3,
                              failed: 0
                            };
                            const currentRank = STATUS_RANKS[existingMsg.status] || 0;
                            const incomingRank = STATUS_RANKS[incomingStatus] || 0;

                            const updateFields = {};

                            if (incomingStatus === 'failed') {
                              // If already confirmed delivered or read, never downgrade to failed
                              if (currentRank >= 2) {
                                console.warn(`⚠️ [Status Guard] Ignored late 'failed' for already confirmed message ${wamid} (current status: ${existingMsg.status})`);
                                finalStatus = existingMsg.status;
                              } else {
                                finalStatus = 'failed';
                                updateFields.status = 'failed';
                                updateFields.errorCode = errorCode || existingMsg.errorCode || undefined;
                                updateFields.errorMessage = errorMessage || existingMsg.errorMessage || undefined;
                              }
                            } else if (incomingStatus === 'read') {
                              finalStatus = 'read';
                              readAtUtc = readAtUtc || statusTimestamp;
                              deliveredAtUtc = deliveredAtUtc || statusTimestamp;
                              updateFields.status = 'read';
                              updateFields.readAt = readAtUtc;
                              if (!existingMsg.deliveredAt) updateFields.deliveredAt = deliveredAtUtc;
                            } else if (incomingStatus === 'delivered') {
                              deliveredAtUtc = deliveredAtUtc || statusTimestamp;
                              updateFields.deliveredAt = deliveredAtUtc;
                              // Do not downgrade if already confirmed read
                              if (currentRank >= 3) {
                                finalStatus = 'read';
                              } else {
                                finalStatus = 'delivered';
                                updateFields.status = 'delivered';
                              }
                            } else if (incomingStatus === 'sent') {
                              // Do not downgrade if already delivered or read
                              if (currentRank >= 2) {
                                finalStatus = existingMsg.status;
                              } else {
                                finalStatus = 'sent';
                                updateFields.status = 'sent';
                                if (!existingMsg.sentAt) updateFields.sentAt = statusTimestamp;
                              }
                            }

                            // If id was temporary, promote it to official wamid
                            if (existingMsg.id !== wamid) {
                              updateFields.id = wamid;
                            }

                            if (Object.keys(updateFields).length > 0) {
                              await prisma.message.update({
                                where: { id: existingMsg.id },
                                data: updateFields
                              });
                            }

                            // Also sync status and timestamps to message_audits for Super Admin audit trail
                            await prisma.messageAudit.updateMany({
                              where: { messageId: existingMsg.id },
                              data: {
                                deliveryStatus: finalStatus,
                                ...(deliveredAtUtc ? { deliveredAt: deliveredAtUtc } : {}),
                                ...(readAtUtc ? { readAt: readAtUtc } : {})
                              }
                            }).catch(() => {});
                          }
                        } catch (stErr) {
                          console.warn('⚠️ [Webhook Status DB Error]:', stErr.message);
                        }
                      }

                      // Real-time broadcast to all connected staff (Coordinator, Leads Officer, Super Admin)
                      broadcastScopedSSE(null, {
                        type: 'MESSAGE_STATUS_UPDATE',
                        messageId: wamid,
                        status: finalStatus,
                        errorCode: errorCode || null,
                        errorMessage: errorMessage || null,
                        recipientPhone,
                        leadId,
                        customerId,
                        sentAt: statusTimestamp.toISOString(),
                        deliveredAt: deliveredAtUtc ? deliveredAtUtc.toISOString() : (finalStatus === 'delivered' || finalStatus === 'read' ? statusTimestamp.toISOString() : undefined),
                        readAt: readAtUtc ? readAtUtc.toISOString() : (finalStatus === 'read' ? statusTimestamp.toISOString() : undefined),
                        timestamp: statusTimestamp.toISOString()
                      });
                    }
                  }
                }
              }
            }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'EVENT_RECEIVED' }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
        }
      });
      return;
    }
  }

  sendApiError(res, 404, 'NOT_FOUND', 'Endpoint not found.', correlationId);
});

const CLINIC_TREATMENTS = [
  { id: 'trt-htp', code: 'HTP', categoryId: 'cat-hair-care', name: 'Hair Transplantation', nameEn: 'Hair Transplantation', nameSi: 'හිසකෙස් බද්ධ කිරීම', nameTa: 'முடி மாற்று அறுவை சிகிச்சை' },
  { id: 'trt-prp', code: 'PRP', categoryId: 'cat-hair-care', name: 'PRP', nameEn: 'PRP (Platelet Rich Plasma)', nameSi: 'PRP ප්‍රතිකාරය', nameTa: 'PRP சிகிச்சை' },
  { id: 'trt-gfc', code: 'GFC', categoryId: 'cat-hair-care', name: 'GFC', nameEn: 'GFC (Growth Factor Concentrate)', nameSi: 'GFC ප්‍රතිකාරය', nameTa: 'GFC சிகிச்சை' },
  { id: 'trt-hdf', code: 'HDF', categoryId: 'cat-skin-care', name: 'Hydra Facial', nameEn: 'Hydra Facial', nameSi: 'හයිඩ්‍රා ෆේෂල්', nameTa: 'ஹைட்ரா ஃபேஷியல்' },
  { id: 'trt-hij', code: 'HIJ', categoryId: 'cat-ayurveda', name: 'Hijama', nameEn: 'Hijama / Cupping Therapy', nameSi: 'හිජාමා ප්‍රතිකාරය', nameTa: 'ஹிஜாமா சிகிச்சை' },
  { id: 'trt-pmt', code: 'PMT', categoryId: 'cat-iv-wellness', name: 'Pain Management', nameEn: 'Pain Management', nameSi: 'වේදනා කළමනාකරණය', nameTa: 'வலி மேலாண்மை சிகிச்சை' },
  { id: 'trt-let', code: 'LET', categoryId: 'cat-ayurveda', name: 'Leech Treatment', nameEn: 'Leech Treatment', nameSi: 'කූඩැල්ලන් ප්‍රතිකාරය', nameTa: 'அட்டை சிகிச்சை' },
  { id: 'trt-chp', code: 'CHP', categoryId: 'cat-skin-care', name: 'Chemical Peel', nameEn: 'Chemical Peel', nameSi: 'කෙමිකල් පීල්', nameTa: 'கெமிக்கல் பீல்' },
  { id: 'trt-cbl', code: 'CBL', categoryId: 'cat-skin-care', name: 'Carbon Laser', nameEn: 'Carbon Laser', nameSi: 'කාබන් ලේසර්', nameTa: 'கார்பன் லேசர்' },
  { id: 'trt-mcn', code: 'MCN', categoryId: 'cat-skin-care', name: 'Microneedling', nameEn: 'Microneedling', nameSi: 'මයික්‍රොනීඩ්ලින්', nameTa: 'மைக்ரோநீட்லிங்' },
  { id: 'trt-skb', code: 'SKB', categoryId: 'cat-skin-care', name: 'Skin Boosters', nameEn: 'Skin Boosters', nameSi: 'සම දීප්තිමත් කිරීමේ බූස්ටර්', nameTa: 'ஸ்கின் பூஸ்டர்ஸ்' },
  { id: 'trt-chr', code: 'CHR', categoryId: 'cat-skin-care', name: 'CO2 Hair Removal', nameEn: 'CO2 Hair Removal', nameSi: 'CO2 අනවශ්‍ය රෝම ඉවත් කිරීම', nameTa: 'CO2 முடி அகற்றுதல்' },
  { id: 'trt-btx', code: 'BTX', categoryId: 'cat-skin-care', name: 'Botox (Per Unit)', nameEn: 'Botox (Per Unit)', nameSi: 'බොටොක්ස් (ඒකකයකට)', nameTa: 'போடாக்ස් (ஒரு யூனிட்)' },
  { id: 'trt-flr', code: 'FLR', categoryId: 'cat-skin-care', name: 'Filler (1ml)', nameEn: 'Filler (1ml)', nameSi: 'ෆිලර් (1ml)', nameTa: 'ஃபில்லர் (1ml)' },
  { id: 'trt-ivg', code: 'IVG', categoryId: 'cat-iv-wellness', name: 'IV Glutathione (Per Session)', nameEn: 'IV Glutathione (Per Session)', nameSi: 'IV ග්ලූටතයෝන්', nameTa: 'IV குளுதாதயோன்' },
  { id: 'trt-ckf', code: 'CKF', categoryId: 'cat-skin-care', name: 'Cheek Filler (new)', nameEn: 'Cheek Filler (new)', nameSi: 'කම්මුල් ෆිලර්', nameTa: 'கன்ன ஃபில்லர்' },
  { id: 'trt-ttf', code: 'TTF', categoryId: 'cat-skin-care', name: 'Tear Trough (Under-Eye) Filler (new)', nameEn: 'Tear Trough (Under-Eye) Filler (new)', nameSi: 'ඇස් යට ෆිලර් ප්‍රතිකාරය', nameTa: 'கண்களுக்கு அடியில் ஃபில்லர்' },
  { id: 'trt-hhb', code: 'HHB', categoryId: 'cat-skin-care', name: 'Hyperhidrosis Botox (Underarm) (new)', nameEn: 'Hyperhidrosis Botox (Underarm) (new)', nameSi: 'කිහිලි අධික දහඩිය දැමීමට බොටොක්ස්', nameTa: 'அக்குள் வியர்வைக்கு போடாக்ஸ்' },
  { id: 'trt-hif', code: 'HIF', categoryId: 'cat-skin-care', name: 'HIFU', nameEn: 'HIFU (High-Intensity Focused Ultrasound)', nameSi: 'HIFU සම තද කිරීමේ ප්‍රතිකාරය', nameTa: 'HIFU தோல் இறுக்க சிகிச்சை' },
  { id: 'trt-ebb', code: 'EBB', categoryId: 'cat-skin-care', name: 'Eyebrow Blading', nameEn: 'Eyebrow Blading / Microblading', nameSi: 'ඇහිබැම බ්ලේඩින්', nameTa: 'புருவ பிளேடிங்' },
  { id: 'trt-smp', code: 'SMP', categoryId: 'cat-hair-care', name: 'Scalp Pigmentation', nameEn: 'Scalp Pigmentation (SMP)', nameSi: 'හිස්කබල පිග්මන්ටේෂන්', nameTa: 'ஸ்கால்ப் பிக்மென்டேஷன்' },
  { id: 'trt-rfs', code: 'RFS', categoryId: 'cat-skin-care', name: 'RF Skin Tightening', nameEn: 'RF Skin Tightening', nameSi: 'RF සම තද කිරීමේ ප්‍රතිකාරය', nameTa: 'RF தோல் இறுக்கம்' },
  { id: 'trt-co2', code: 'CO2', categoryId: 'cat-skin-care', name: 'CO2 Laser', nameEn: 'CO2 Fractional Laser', nameSi: 'CO2 ලේසර් ප්‍රතිකාරය', nameTa: 'CO2 ලේசர் சிகிச்சை' },
  { id: 'trt-led', code: 'LED', categoryId: 'cat-skin-care', name: 'LED Light Therapy', nameEn: 'LED Light Therapy', nameSi: 'LED ආලෝක ප්‍රතිකාරය', nameTa: 'LED ஒளி சிகிச்சை' }
];

const CRAS_COURSES = [
  { id: 'crs-adi', code: 'ADI', categoryId: 'cat-cras-courses', name: 'Advanced Injectables', nameEn: 'Advanced Injectables', nameSi: 'Advanced Injectables', nameTa: 'Advanced Injectables' },
  { id: 'crs-fac', code: 'FAC', categoryId: 'cat-cras-courses', name: 'Facial Injectables', nameEn: 'Facial Injectables', nameSi: 'Facial Injectables', nameTa: 'Facial Injectables' },
  { id: 'crs-lac', code: 'LAC', categoryId: 'cat-cras-courses', name: 'Laser & Aesthetic Cosmetology', nameEn: 'Laser & Aesthetic Cosmetology', nameSi: 'Laser & Aesthetic Cosmetology', nameTa: 'Laser & Aesthetic Cosmetology' },
  { id: 'crs-aco', code: 'ACO', categoryId: 'cat-cras-courses', name: 'Aesthetic Cosmetology', nameEn: 'Aesthetic Cosmetology', nameSi: 'Aesthetic Cosmetology', nameTa: 'Aesthetic Cosmetology' },
  { id: 'crs-htr', code: 'HTR', categoryId: 'cat-cras-courses', name: 'Hair Transplantation & Restoration', nameEn: 'Hair Transplantation & Restoration', nameSi: 'Hair Transplantation & Restoration', nameTa: 'Hair Transplantation & Restoration' },
  { id: 'crs-htt', code: 'HTT', categoryId: 'cat-cras-courses', name: 'Hair Transplant Technician', nameEn: 'Hair Transplant Technician', nameSi: 'Hair Transplant Technician', nameTa: 'Hair Transplant Technician' },
  { id: 'crs-lbc', code: 'LBC', categoryId: 'cat-cras-courses', name: 'Liposuction & Body Contouring', nameEn: 'Liposuction & Body Contouring', nameSi: 'Liposuction & Body Contouring', nameTa: 'Liposuction & Body Contouring' },
  { id: 'crs-mpm', code: 'MPM', categoryId: 'cat-cras-courses', name: 'Micropigmentation & Permanent Makeup', nameEn: 'Micropigmentation & Permanent Makeup', nameSi: 'Micropigmentation & Permanent Makeup', nameTa: 'Micropigmentation & Permanent Makeup' },
  { id: 'crs-lhr', code: 'LHR', categoryId: 'cat-cras-courses', name: 'Laser & Light-Based Hair Removal', nameEn: 'Laser & Light-Based Hair Removal', nameSi: 'Laser & Light-Based Hair Removal', nameTa: 'Laser & Light-Based Hair Removal' },
  { id: 'crs-alp', code: 'ALP', categoryId: 'cat-cras-courses', name: 'Aesthetic Laser and Light-Based Procedures', nameEn: 'Aesthetic Laser and Light-Based Procedures', nameSi: 'Aesthetic Laser and Light-Based Procedures', nameTa: 'Aesthetic Laser and Light-Based Procedures' },
  { id: 'crs-cfg', code: 'CFG', categoryId: 'cat-cras-courses', name: 'Cosmetic & Functional Gynecology', nameEn: 'Cosmetic & Functional Gynecology', nameSi: 'Cosmetic & Functional Gynecology', nameTa: 'Cosmetic & Functional Gynecology' },
  { id: 'crs-rgm', code: 'RGM', categoryId: 'cat-cras-courses', name: 'Regenerative Medicine', nameEn: 'Regenerative Medicine', nameSi: 'Regenerative Medicine', nameTa: 'Regenerative Medicine' },
  { id: 'crs-hjt', code: 'HJT', categoryId: 'cat-cras-courses', name: 'Hijama Therapy', nameEn: 'Hijama Therapy', nameSi: 'Hijama Therapy', nameTa: 'Hijama Therapy' },
  { id: 'crs-cit', code: 'CIT', categoryId: 'cat-cras-courses', name: 'Certificate in Trichology', nameEn: 'Certificate in Trichology', nameSi: 'Certificate in Trichology', nameTa: 'Certificate in Trichology' },
  { id: 'crs-cot', code: 'COT', categoryId: 'cat-cras-courses', name: 'Certificate of Clinical Observership in HT', nameEn: 'Certificate of Clinical Observership in HT', nameSi: 'Certificate of Clinical Observership in HT', nameTa: 'Certificate of Clinical Observership in HT' }
];

async function autoSeedDbIfEmpty() {
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) return;
  try {
    const defaultCategories = [
      { id: 'cat-hair-care', name: 'Hair Care & Restoration', nameEn: 'Hair Care & Restoration', nameSi: 'හිසකෙස් ප්‍රතිකාර සහ යථා තත්ත්වයට පත්කිරීම', nameTa: 'முடி பராமரிப்பு மற்றும் சீரமைப்பு', active: true, iconName: 'Sparkles', description: 'Advanced PRP, GFC, and FUE hair transplant solutions.' },
      { id: 'cat-skin-care', name: 'Aesthetic Skin Care', nameEn: 'Aesthetic Skin Care', nameSi: 'සම රැකවරණ ප්‍රතිකාර', nameTa: 'அழகியல் தோல் பராமரிப்பு', active: true, iconName: 'Smile', description: 'Clinical dermatological facials and laser therapies.' },
      { id: 'cat-iv-wellness', name: 'IV Drip Therapy & Wellness', nameEn: 'IV Drip Therapy & Wellness', nameSi: 'IV විටමින් ප්‍රතිකාර', nameTa: 'IV டිරිப் மற்றும் ஆரோக்கிய சிகிச்சை', active: true, iconName: 'Zap', description: 'Intravenous wellness blends for rejuvenation.' },
      { id: 'cat-weight-management', name: 'Weight Management', nameEn: 'Weight Management', nameSi: 'බර පාලනය', nameTa: 'உடல் எடை மேலாண்மை', active: true, iconName: 'Activity', description: 'Non-invasive fat reduction and body contouring.' },
      { id: 'cat-dental-aesthetics', name: 'Dental Aesthetics & Smile Design', nameEn: 'Dental Aesthetics & Smile Design', nameSi: 'දන්ත සෞන්දර්ය ප්‍රතිකාර', nameTa: 'பல் அழகியல் மற்றும் புன்னகை வடிவமைப்பு', active: true, iconName: 'Sparkles', description: 'Laser teeth whitening and invisible aligners.' },
      { id: 'cat-ayurveda', name: 'Ayurvedic Rejuvenation', nameEn: 'Ayurvedic Rejuvenation', nameSi: 'ආයුර්වේද ප්‍රතිකාර', nameTa: 'ஆயුර්වේද புத்துணர்ச்சி', active: true, iconName: 'Leaf', description: 'Authentic royal Ceylon herbal detox.' },
      { id: 'cat-cras-courses', name: 'CRAS Academic Programs', nameEn: 'CRAS Academic Programs', nameSi: 'CRAS අධ්‍යයන පාඨමාලා', nameTa: 'CRAS கல்வித் திட்டங்கள்', active: true, iconName: 'GraduationCap', description: 'Clinical aesthetic medicine, cosmetology, and dermatology training programs.' }
    ];
    for (const cat of defaultCategories) {
      await prisma.treatmentCategory.upsert({
        where: { id: cat.id },
        update: cat,
        create: cat
      }).catch(() => {});
    }

    const trtCount = await prisma.treatment.count().catch(() => 0);
    if (trtCount < 35) {
      console.log('🌱 Upserting complete treatment & course catalogs into PostgreSQL...');
      for (const trt of [...CLINIC_TREATMENTS, ...CRAS_COURSES]) {
        await prisma.treatment.upsert({
          where: { id: trt.id },
          update: {
            name: trt.name,
            nameEn: trt.nameEn,
            nameSi: trt.nameSi,
            nameTa: trt.nameTa,
            categoryId: trt.categoryId,
            active: true
          },
          create: {
            id: trt.id,
            categoryId: trt.categoryId,
            name: trt.name,
            nameEn: trt.nameEn,
            nameSi: trt.nameSi,
            nameTa: trt.nameTa,
            active: true,
            startingPrice: 0,
            currency: 'LKR',
            durationMinutes: 45
          }
        }).catch(() => {});
      }
      console.log('✅ Treatments & CRAS courses seeding completed.');
    }
  } catch (e) {
    console.warn('⚠️ Auto-seed check error:', e.message);
  }
}

async function ensureWabaWebhookSubscriptions() {
  const token = (metaConfig.accessToken || process.env.META_ACCESS_TOKEN || '').trim();
  if (!token || IS_TEST_ENV) return;

  const wabaIds = [
    (metaConfig.wabaId || process.env.META_WABA_ID || '2332922997481634').trim(),
    (metaConfig.wabaIdAhc || process.env.META_WABA_ID_AHC || '1691829932493235').trim()
  ].filter(Boolean);

  const callbackUrl = 'https://royal-wellness-backend.onrender.com/api/webhook';
  const verifyToken = (metaConfig.verifyToken || process.env.META_VERIFY_TOKEN || 'royal_wellness_token_2026').trim();

  for (const wabaId of wabaIds) {
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/subscribed_apps`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          override_callback_uri: callbackUrl,
          verify_token: verifyToken
        })
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        console.log(`✅ [Meta Cloud API] Subscribed WABA ${wabaId} to webhook (${callbackUrl})`);
      }
    } catch (err) {
      console.warn(`⚠️ [Meta Cloud API] Could not auto-subscribe WABA ${wabaId}:`, err.message);
    }
  }
}

export async function initializeServer() {
  // checkDbConnection() applies the idempotent schema delta (see schemaBootstrap.js).
  // Startup itself only verifies connectivity and loads persisted configuration.
  const res = await checkDbConnection();
  if (!res.connected) return res;
  const savedMetaToken = await getSystemSetting('META_ACCESS_TOKEN');
  if (savedMetaToken && savedMetaToken.trim()) metaConfig.accessToken = savedMetaToken.trim();
  const savedPhoneId = await getSystemSetting('META_PHONE_NUMBER_ID');
  if (savedPhoneId && savedPhoneId.trim()) metaConfig.phoneNumberId = savedPhoneId.trim();
  const savedWabaId = await getSystemSetting('META_WABA_ID');
  if (savedWabaId && savedWabaId.trim()) metaConfig.wabaId = savedWabaId.trim();
  const savedAppSecret = await getSystemSetting('META_APP_SECRET');
  if (savedAppSecret && savedAppSecret.trim()) metaConfig.appSecret = savedAppSecret.trim();
  const savedVerifyToken = await getSystemSetting('META_VERIFY_TOKEN');
  if (savedVerifyToken && savedVerifyToken.trim()) metaConfig.verifyToken = savedVerifyToken.trim();
  await autoSeedDbIfEmpty();
  ensureWabaWebhookSubscriptions().catch(() => {});
  return res;
}

export async function startServer() {
  await initializeServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '0.0.0.0', async () => {
      // Initialize Socket.io after server starts listening
      // Legacy exam socket disabled: it trusted client-supplied student identity.
      startExamMonitor();
      resolve(server);
    });
  });
}

export {
  signAuthToken,
  verifyAuthToken,
  authenticateRequest,
  isPublicRoute,
  CANONICAL_USERS,
  hashSecret,
  verifySecret,
  checkLoginRateLimit,
  recordLoginFailure,
  recordLoginSuccess,
  resetLoginRateLimits,
  dummyVerify,
  verifyMetaSignature,
  // Bounded in-memory stores (tested for expiry and growth caps)
  issueSseTicket,
  consumeSseTicket,
  sweepExpiredSseTickets,
  sweepLoginAttemptStore,
  sseTickets,
  loginAttemptStore,
  // Media signing (stable per-file signature; no baked-in expiry)
  createPrivateMediaUrl,
  verifyPrivateMediaUrl,
  signMediaFile,
  timingSafeStringEqual,
  allocateCompanyLeadSerial,
  server
};
