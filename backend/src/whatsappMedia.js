import crypto from 'crypto';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getPrisma } from './db.js';
import { JWT_SECRET } from './runtimeConfig.js';

export const MEDIA_API_TTL_MS = 15 * 60 * 1000;
export const DEFAULT_MEDIA_BUCKET = 'whatsapp-media';
const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
const PROCESSING_LOCK_MS = 15 * 60 * 1000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
const MEDIA_TYPES = new Set(['image', 'audio', 'voice', 'video', 'document', 'sticker']);

let storageClient = null;
let retryWorker = null;

export function getMediaBucket() {
  return process.env.SUPABASE_MEDIA_BUCKET || DEFAULT_MEDIA_BUCKET;
}

export function getMediaStorageClient() {
  if (storageClient) return storageClient;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  storageClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  return storageClient;
}

// Test hook: env/config can change between suites.
export function resetMediaStorageClient() {
  storageClient = null;
}

const MIME_EXTENSIONS = [
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['audio/ogg', 'ogg'],
  ['audio/opus', 'opus'],
  ['audio/mp4', 'm4a'],
  ['audio/m4a', 'm4a'],
  ['audio/aac', 'm4a'],
  ['audio/mpeg', 'mp3'],
  ['audio/mp3', 'mp3'],
  ['audio/wav', 'wav'],
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
  ['video/3gpp', '3gp'],
  ['application/pdf', 'pdf'],
  ['application/msword', 'doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.ms-excel', 'xls'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx']
];

function safeFileName(value) {
  const name = path.basename(String(value || '')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return name.slice(0, 255) || null;
}

function safeSegment(value, fallback) {
  const clean = String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
  return clean || fallback;
}

export function extensionForMedia(mimeType, fileName) {
  const supplied = safeFileName(fileName);
  const suppliedExt = supplied && supplied.includes('.') ? supplied.split('.').pop() : '';
  if (/^[A-Za-z0-9]{1,10}$/.test(suppliedExt)) return suppliedExt.toLowerCase();
  const mime = String(mimeType || '').toLowerCase();
  for (const [prefix, ext] of MIME_EXTENSIONS) {
    if (mime.startsWith(prefix)) return ext;
  }
  return 'bin';
}

/**
 * Extract the durable media descriptor from a WhatsApp Cloud API message.
 * Cloud API sends voice notes as `audio` with `voice: true`; `voice` is also
 * accepted because older payloads used it as the message type.
 */
export function extractMediaDescriptor(message) {
  if (!message || typeof message !== 'object') return null;
  const kind = String(message.type || '');
  if (!MEDIA_TYPES.has(kind)) return null;
  const payload = message[kind] || (kind === 'voice' ? message.audio : null);
  if (!payload || !payload.id) return null;
  return {
    mediaId: String(payload.id),
    mediaType: kind === 'voice' ? 'audio' : kind,
    isVoice: kind === 'voice' || Boolean(payload.voice),
    caption: typeof payload.caption === 'string' ? payload.caption : '',
    fileName: safeFileName(payload.filename),
    mimeType: String(payload.mime_type || '').toLowerCase().slice(0, 100),
    checksumSha256: typeof payload.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(payload.sha256)
      ? payload.sha256.toLowerCase()
      : null,
    animated: Boolean(payload.animated)
  };
}

export function buildMediaStorageKey({ company, leadId, mediaId, mimeType, fileName }) {
  const extension = extensionForMedia(mimeType, fileName);
  const tenant = safeSegment(company || 'RWC', 'RWC').toUpperCase();
  const lead = safeSegment(leadId, 'unassigned');
  const media = safeSegment(mediaId, 'media');
  return `${tenant}/${lead}/${media}.${extension}`;
}

export function retryDelayMs(attempts) {
  const index = Math.min(Math.max(Number(attempts) || 1, 1), RETRY_DELAYS_MS.length) - 1;
  return RETRY_DELAYS_MS[index];
}

export function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function signMediaApiToken(mediaRecordId, expires) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`whatsapp-media:${mediaRecordId}:${expires}`).digest('base64url');
}

export function createSignedMediaApiUrl(mediaRecordId, ttlMs = MEDIA_API_TTL_MS) {
  const expires = Date.now() + ttlMs;
  const signature = signMediaApiToken(mediaRecordId, expires);
  return `/api/media/${encodeURIComponent(mediaRecordId)}?exp=${expires}&sig=${signature}`;
}

export function verifySignedMediaApiUrl(mediaRecordId, expires, signature) {
  const expiry = Number(expires);
  if (!mediaRecordId || !Number.isSafeInteger(expiry) || expiry < Date.now()) return false;
  if (typeof signature !== 'string' || !signature) return false;
  const expected = signMediaApiToken(mediaRecordId, expiry);
  return signature.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

const ASSIGNED_ONLY_ROLES = new Set(['coordinator', 'clinical_nurse', 'sales_coordinator']);

/**
 * Record-level authorization for inbound media. `lead` may be null when the
 * media is not attached to a lead; company isolation still applies.
 */
export function canAccessMediaRecord(user, record, lead) {
  if (!user || !record) return false;
  if (user.role === 'super_admin' || user.role === 'leads_officer') return true;
  if (lead?.assignedTo && lead.assignedTo === user.id) return true;
  if (ASSIGNED_ONLY_ROLES.has(user.role)) return false;
  const company = String((lead?.company || record.company) || '').toUpperCase();
  return Boolean(company) && company === String(user.company || '').toUpperCase();
}

export async function persistInboundMediaMetadata(prisma, {
  messageId,
  company,
  leadId,
  customerId,
  direction = 'inbound',
  descriptor
}) {
  if (!prisma || !messageId || !descriptor?.mediaId) return null;
  const storageKey = buildMediaStorageKey({
    company,
    leadId,
    mediaId: descriptor.mediaId,
    mimeType: descriptor.mimeType,
    fileName: descriptor.fileName
  });
  const rows = await prisma.$queryRawUnsafe(`
    INSERT INTO public.whatsapp_media (
      id, message_id, media_id, company, lead_id, customer_id, direction,
      media_type, mime_type, file_name, caption, checksum_sha256,
      storage_bucket, storage_key, status, attempts, next_retry_at, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12,
      $13, $14, 'pending', 0, NOW(), NOW(), NOW()
    )
    ON CONFLICT (message_id) DO UPDATE SET
      media_type = EXCLUDED.media_type,
      mime_type = EXCLUDED.mime_type,
      file_name = COALESCE(EXCLUDED.file_name, whatsapp_media.file_name),
      caption = EXCLUDED.caption,
      checksum_sha256 = COALESCE(EXCLUDED.checksum_sha256, whatsapp_media.checksum_sha256),
      updated_at = NOW()
    RETURNING *;
  `,
  crypto.randomUUID(),
  String(messageId),
  descriptor.mediaId,
  safeSegment(company || 'RWC', 'RWC').toUpperCase(),
  leadId || null,
  customerId || null,
  direction,
  descriptor.mediaType,
  descriptor.mimeType || null,
  descriptor.fileName,
  descriptor.caption || null,
  descriptor.checksumSha256,
  getMediaBucket(),
  storageKey
  );
  return rows?.[0] || null;
}

export async function getMediaRecordById(prisma, mediaRecordId) {
  if (!prisma || !mediaRecordId) return null;
  const rows = await prisma.$queryRawUnsafe(
    'SELECT * FROM public.whatsapp_media WHERE id = $1 LIMIT 1;',
    String(mediaRecordId)
  );
  return rows?.[0] || null;
}

export async function listMediaRecordsForMessages(prisma, messageIds) {
  if (!prisma || !Array.isArray(messageIds) || messageIds.length === 0) return [];
  return prisma.$queryRawUnsafe(
    'SELECT * FROM public.whatsapp_media WHERE message_id = ANY($1::text[]);',
    messageIds.map(String)
  );
}

async function claimMediaRecordForProcessing(prisma, mediaRecordId) {
  const rows = await prisma.$queryRawUnsafe(`
    UPDATE public.whatsapp_media
    SET status = 'processing',
        attempts = attempts + 1,
        locked_at = NOW(),
        next_retry_at = NOW() + INTERVAL '15 minutes',
        updated_at = NOW()
    WHERE id = $1
      AND status <> 'ready'
      AND (status <> 'processing' OR locked_at IS NULL OR locked_at < NOW() - INTERVAL '15 minutes')
    RETURNING *;
  `, String(mediaRecordId));
  return rows?.[0] || null;
}

async function markMediaReady(prisma, mediaRecordId, { sizeBytes, checksumSha256, storageBucket, storageKey }) {
  const rows = await prisma.$queryRawUnsafe(`
    UPDATE public.whatsapp_media
    SET status = 'ready',
        size_bytes = $2,
        checksum_sha256 = $3,
        storage_bucket = $4,
        storage_key = $5,
        downloaded_at = NOW(),
        next_retry_at = NULL,
        locked_at = NULL,
        last_error = NULL,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `, String(mediaRecordId), Number(sizeBytes) || 0, checksumSha256, storageBucket, storageKey);
  const record = rows?.[0] || null;
  if (record) {
    // Messages keep a canonical, non-expiring pointer. Fresh signed URLs are
    // generated by GET /api/messages and GET /api/media/:id.
    await prisma.$executeRawUnsafe(
      'UPDATE public.messages SET "mediaUrl" = $2 WHERE id = $1;',
      String(record.message_id),
      `/api/media/${record.id}`
    ).catch(() => null);
  }
  return record;
}

async function markMediaFailed(prisma, mediaRecordId, message, attempts) {
  const delay = retryDelayMs(attempts);
  await prisma.$executeRawUnsafe(`
    UPDATE public.whatsapp_media
    SET status = 'failed',
        last_error = $2,
        next_retry_at = NOW() + ($3::int * INTERVAL '1 millisecond'),
        locked_at = NULL,
        updated_at = NOW()
    WHERE id = $1;
  `, String(mediaRecordId), String(message || 'Media processing failed').slice(0, 500), delay);
}

/**
 * Meta's two-step media retrieval: resolve the media ID to a short-lived CDN
 * URL, then download the binary. The binary is uploaded to the private bucket
 * and never written to Render's local filesystem or PostgreSQL BYTEA.
 */
export async function processMediaRecord(prisma, mediaRecord, {
  metaToken = '',
  storage = getMediaStorageClient(),
  bucket = getMediaBucket(),
  fetchImpl = fetch
} = {}) {
  if (!prisma || !mediaRecord) return null;
  if (mediaRecord.status === 'ready') return mediaRecord;

  const token = String(metaToken || '').trim();
  const claimed = await claimMediaRecordForProcessing(prisma, mediaRecord.id);
  if (!claimed) {
    return getMediaRecordById(prisma, mediaRecord.id).catch(() => null);
  }

  try {
    if (!token) throw new Error('Meta access token is not configured');
    if (!storage) throw new Error('Supabase Storage is not configured');

    const metaRes = await fetchImpl(`https://graph.facebook.com/v20.0/${encodeURIComponent(claimed.media_id)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!metaRes.ok) throw new Error(`Meta media metadata request failed (${metaRes.status})`);
    const meta = await metaRes.json().catch(() => ({}));
    if (!meta?.url) throw new Error('Meta media metadata did not include a download URL');

    const binRes = await fetchImpl(meta.url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!binRes.ok) throw new Error(`Meta media download failed (${binRes.status})`);
    const declaredSize = Number(binRes.headers?.get?.('content-length') || 0);
    if (declaredSize > MAX_MEDIA_BYTES) throw new Error('Media exceeds the maximum allowed size');

    const buffer = Buffer.from(await binRes.arrayBuffer());
    if (!buffer.length) throw new Error('Meta media download returned an empty body');
    if (buffer.length > MAX_MEDIA_BYTES) throw new Error('Media exceeds the maximum allowed size');

    const checksum = sha256Hex(buffer);
    const expected = String(meta.sha256 || claimed.checksum_sha256 || '').toLowerCase();
    if (expected && expected !== checksum) throw new Error('Media checksum verification failed');

    const mimeType = String(meta.mime_type || claimed.mime_type || 'application/octet-stream').slice(0, 100);
    const storageKey = claimed.storage_key || buildMediaStorageKey({
      company: claimed.company,
      leadId: claimed.lead_id,
      mediaId: claimed.media_id,
      mimeType,
      fileName: claimed.file_name
    });

    const { error } = await storage.storage.from(bucket).upload(storageKey, buffer, {
      contentType: mimeType,
      upsert: true,
      cacheControl: '3600'
    });
    if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);

    return await markMediaReady(prisma, claimed.id, {
      sizeBytes: Number(meta.file_size) || buffer.length,
      checksumSha256: checksum,
      storageBucket: bucket,
      storageKey
    });
  } catch (error) {
    await markMediaFailed(prisma, claimed.id, error.message, claimed.attempts).catch(() => null);
    return null;
  }
}

export async function downloadMediaObject(mediaRecord, {
  storage = getMediaStorageClient(),
  bucket = mediaRecord?.storage_bucket || getMediaBucket()
} = {}) {
  if (!mediaRecord || mediaRecord.status !== 'ready' || !mediaRecord.storage_key) return null;
  if (!storage) return null;
  const { data, error } = await storage.storage.from(bucket).download(mediaRecord.storage_key);
  if (error || !data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  if (!buffer.length) return null;
  return {
    buffer,
    mimeType: mediaRecord.mime_type || data.type || 'application/octet-stream'
  };
}

export async function retryDueMedia({
  prisma = getPrisma(),
  metaToken = '',
  storage = getMediaStorageClient(),
  bucket = getMediaBucket(),
  limit = 5,
  fetchImpl = fetch
} = {}) {
  if (!prisma) return [];
  const rows = await prisma.$queryRawUnsafe(`
    SELECT * FROM public.whatsapp_media
    WHERE status <> 'ready'
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      AND (status <> 'processing' OR locked_at IS NULL OR locked_at < NOW() - INTERVAL '15 minutes')
    ORDER BY created_at ASC
    LIMIT $1;
  `, Math.min(Math.max(Number(limit) || 5, 1), 50));

  const results = [];
  for (const row of rows || []) {
    const processed = await processMediaRecord(prisma, row, { metaToken, storage, bucket, fetchImpl });
    if (processed) results.push(processed);
  }
  return results;
}

export function startInboundMediaRetryWorker({
  getMetaToken = () => process.env.META_ACCESS_TOKEN || process.env.META_TOKEN || '',
  intervalMs = 60_000,
  logger = console
} = {}) {
  if (retryWorker) return retryWorker;

  const run = async () => {
    try {
      const processed = await retryDueMedia({ metaToken: getMetaToken() });
      if (processed.length > 0) {
        logger.log(`[Inbound media] Recovered ${processed.length} media record(s).`);
      }
    } catch (error) {
      logger.warn(`[Inbound media] Retry worker error: ${error.message}`);
    }
  };

  run();
  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  retryWorker = {
    stop() {
      clearInterval(timer);
      retryWorker = null;
    },
    runOnce: run
  };
  return retryWorker;
}

export const __private = {
  MAX_MEDIA_BYTES,
  PROCESSING_LOCK_MS,
  RETRY_DELAYS_MS
};
