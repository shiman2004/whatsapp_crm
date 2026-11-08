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
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  storageClient = createClient(url, key, {
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

export const signMediaApiUrl = createSignedMediaApiUrl;

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
    if (prisma?.message?.update) {
      await prisma.message.update({
        where: { id: String(record.message_id) },
        data: { mediaUrl: `/api/media/${record.id}` }
      }).catch(() => null);
    }
    await prisma.$executeRawUnsafe(
      'UPDATE public.messages SET "mediaUrl" = $2 WHERE id = $1;',
      String(record.message_id),
      `/api/media/${record.id}`
    ).catch(async () => {
      await prisma.$executeRawUnsafe(
        'UPDATE public."Message" SET "mediaUrl" = $2 WHERE id = $1;',
        String(record.message_id),
        `/api/media/${record.id}`
      ).catch(() => null);
    });
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

async function uploadMediaObject(storage, bucket, storageKey, buffer, contentType) {
  const upload = () => storage.storage.from(bucket).upload(storageKey, buffer, {
    contentType,
    upsert: true,
    cacheControl: '3600'
  });

  let { error } = await upload();
  if (error && /bucket not found|does not exist/i.test(error.message || '')) {
    await storage.storage.createBucket(bucket, { public: false }).catch(() => null);
    ({ error } = await upload());
  }
  return error || null;
}

/**
 * Binary fallback when the private bucket is not configured or rejects the
 * upload. The message still renders, at the cost of PostgreSQL egress.
 */
async function saveMediaToDatabase(prisma, storageKey, mimeType, buffer) {
  await prisma.$executeRawUnsafe(`
    INSERT INTO public.media_files (id, file_name, mime_type, data, size, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (file_name)
    DO UPDATE SET data = EXCLUDED.data, size = EXCLUDED.size, mime_type = EXCLUDED.mime_type;
  `, crypto.randomUUID(), path.basename(storageKey), mimeType, buffer, buffer.length);
}

/**
 * Meta's two-step media retrieval: resolve the media ID to a short-lived CDN
 * URL, then download the binary. The binary is uploaded to the private bucket,
 * with the PostgreSQL media_files table as a fallback when the bucket is missing.
 */
export async function processMediaRecord(prisma, mediaRecord, {
  metaToken = '',
  storage = null,
  bucket = getMediaBucket(),
  fetchImpl = fetch
} = {}) {
  if (!prisma || !mediaRecord) return null;
  if (mediaRecord.status === 'ready') return mediaRecord;

  let token = String(metaToken || '').trim();
  if (!token) {
    token = String(process.env.META_ACCESS_TOKEN || process.env.META_TOKEN || '').trim();
  }
  if (!token && prisma?.$queryRawUnsafe) {
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT value FROM public.system_settings WHERE key = 'META_ACCESS_TOKEN' LIMIT 1;`);
      if (rows && rows[0]?.value) {
        token = String(rows[0].value).trim();
      }
    } catch {}
  }

  let activeStorage = storage || getMediaStorageClient();
  if (!activeStorage && prisma?.$queryRawUnsafe) {
    try {
      const urlRow = await prisma.$queryRawUnsafe(`SELECT value FROM public.system_settings WHERE key = 'SUPABASE_URL' LIMIT 1;`);
      const keyRow = await prisma.$queryRawUnsafe(`SELECT value FROM public.system_settings WHERE key = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;`);
      if (urlRow?.[0]?.value && keyRow?.[0]?.value) {
        activeStorage = createClient(urlRow[0].value.trim(), keyRow[0].value.trim(), { auth: { persistSession: false } });
        // Reuse the settings-backed client for downloads too, not just uploads.
        storageClient = activeStorage;
      }
    } catch {}
  }

  const claimed = await claimMediaRecordForProcessing(prisma, mediaRecord.id);
  if (!claimed) {
    return getMediaRecordById(prisma, mediaRecord.id).catch(() => null);
  }

  try {
    if (!token) throw new Error('Meta access token is not configured');

    const downloadHeaders = {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    };

    const metaRes = await fetchImpl(`https://graph.facebook.com/v20.0/${encodeURIComponent(claimed.media_id)}`, {
      headers: downloadHeaders
    });
    if (!metaRes.ok) throw new Error(`Meta media metadata request failed (${metaRes.status})`);
    const meta = await metaRes.json().catch(() => ({}));
    if (!meta?.url) throw new Error('Meta media metadata did not include a download URL');

    // Download binary from Meta CDN. Some Meta CDN hosts require User-Agent and Authorization.
    let downloadUrl = meta.url;
    let binRes = null;

    // Follow manual redirect if provided so headers are never stripped across domains
    for (let r = 0; r < 3; r++) {
      binRes = await fetchImpl(downloadUrl, {
        headers: downloadHeaders,
        redirect: 'manual'
      }).catch(() => null);

      if (binRes && binRes.status >= 300 && binRes.status < 400 && binRes.headers?.get?.('location')) {
        downloadUrl = binRes.headers.get('location');
        continue;
      }
      break;
    }

    // Direct fallback if manual redirect was not handled or failed
    if (!binRes || !binRes.ok) {
      binRes = await fetchImpl(downloadUrl, {
        headers: downloadHeaders
      });
    }

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

    const storageError = activeStorage
      ? await uploadMediaObject(activeStorage, bucket, storageKey, buffer, mimeType)
      : new Error('Supabase Storage is not configured');
    if (storageError) {
      // Storage is optional. Without the bucket config or bucket itself the binary
      // goes to the legacy media_files table so the image still previews.
      await saveMediaToDatabase(prisma, storageKey, mimeType, buffer);
    }

    return await markMediaReady(prisma, claimed.id, {
      sizeBytes: Number(meta.file_size) || buffer.length,
      checksumSha256: checksum,
      storageBucket: bucket,
      storageKey
    });
  } catch (error) {
    console.error(`❌ [Inbound media] Failed to process media ${claimed.id} (Media ID: ${claimed.media_id}):`, error.message);
    await markMediaFailed(prisma, claimed.id, error.message, claimed.attempts).catch(() => null);
    return null;
  }
}

export async function downloadMediaObject(mediaRecord, {
  storage = getMediaStorageClient(),
  bucket = mediaRecord?.storage_bucket || getMediaBucket(),
  prisma = getPrisma()
} = {}) {
  if (!mediaRecord || mediaRecord.status !== 'ready' || !mediaRecord.storage_key) return null;

  if (storage) {
    const { data, error } = await storage.storage.from(bucket).download(mediaRecord.storage_key);
    if (!error && data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      if (buffer.length) {
        return {
          buffer,
          mimeType: mediaRecord.mime_type || data.type || 'application/octet-stream'
        };
      }
    }
  }

  // Fallback for binaries saved to public.media_files when the bucket was unavailable.
  if (!prisma) return null;
  const rows = await prisma.$queryRawUnsafe(
    'SELECT mime_type, data FROM public.media_files WHERE file_name = $1 LIMIT 1;',
    path.basename(mediaRecord.storage_key)
  ).catch(() => null);
  const row = rows?.[0];
  if (!row?.data) return null;
  const buffer = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
  if (!buffer.length) return null;
  return {
    buffer,
    mimeType: mediaRecord.mime_type || row.mime_type || 'application/octet-stream'
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
  logger = console,
  onMediaReady = null
} = {}) {
  if (retryWorker) return retryWorker;

  const run = async () => {
    try {
      const resolvedToken = typeof getMetaToken === 'function' ? await getMetaToken() : getMetaToken;
      const processed = await retryDueMedia({ metaToken: resolvedToken });
      if (processed.length > 0) {
        logger.log(`[Inbound media] Recovered ${processed.length} media record(s).`);
        if (typeof onMediaReady === 'function') {
          for (const item of processed) {
            try { onMediaReady(item); } catch {}
          }
        }
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
