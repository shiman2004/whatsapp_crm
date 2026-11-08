// Regression tests for inbound WhatsApp media: descriptor extraction, durable
// metadata, private-bucket transport, signed API URLs, retries, and access rules.
// Pure logic + fake storage/Graph; no live database or bucket required.
process.env.NODE_ENV = 'test';

import assert from 'assert';
import fs from 'fs';
import {
  extractMediaDescriptor,
  buildMediaStorageKey,
  extensionForMedia,
  retryDelayMs,
  sha256Hex,
  createSignedMediaApiUrl,
  verifySignedMediaApiUrl,
  canAccessMediaRecord,
  persistInboundMediaMetadata,
  processMediaRecord,
  getMediaRecordById,
  downloadMediaObject,
  __private
} from './src/whatsappMedia.js';

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ❌ ${name}\n     ${error.message}`);
  }
}

function baseRecord(overrides = {}) {
  return {
    id: 'media-record-1',
    message_id: 'wamid.TEST1',
    media_id: '123456789',
    company: 'RWC',
    lead_id: 'lead-1',
    customer_id: 'cust-1',
    direction: 'inbound',
    media_type: 'image',
    mime_type: 'image/jpeg',
    file_name: 'photo.jpg',
    caption: 'hello',
    checksum_sha256: null,
    storage_bucket: 'whatsapp-media',
    storage_key: 'RWC/lead-1/123456789.jpg',
    size_bytes: null,
    status: 'pending',
    attempts: 0,
    last_error: null,
    ...overrides
  };
}

// Minimal Prisma double that tracks the media state machine.
function makePrisma(initial) {
  const calls = [];
  let record = initial ? { ...initial } : null;
  return {
    calls,
    getRecord: () => record,
    async $queryRawUnsafe(sql, ...args) {
      calls.push({ sql, args });
      if (sql.includes("SET status = 'processing'")) {
        if (record.status === 'ready') return [];
        record = { ...record, status: 'processing', attempts: (record.attempts || 0) + 1, locked_at: new Date() };
        return [record];
      }
      if (sql.includes("SET status = 'ready'")) {
        record = {
          ...record,
          status: 'ready',
          size_bytes: args[1],
          checksum_sha256: args[2],
          storage_bucket: args[3],
          storage_key: args[4]
        };
        return [record];
      }
      if (sql.includes("SET status = 'failed'")) {
        record = { ...record, status: 'failed', last_error: args[1], attempts: record.attempts || 1 };
        return [];
      }
      if (sql.includes('INSERT INTO public.whatsapp_media')) {
        return [{ ...record, status: 'pending' }];
      }
      if (sql.includes('SELECT * FROM public.whatsapp_media WHERE id = $1')) {
        return record ? [record] : [];
      }
      if (sql.includes('FROM public.media_files')) {
        return [{ mime_type: 'image/jpeg', data: Buffer.from('stored-bytes') }];
      }
      return [];
    },
    async $executeRawUnsafe(sql, ...args) {
      calls.push({ sql, args });
      if (sql.includes("SET status = 'failed'")) {
        record = { ...record, status: 'failed', last_error: args[1], attempts: record.attempts || 1 };
      }
      if (sql.includes('INSERT INTO public.media_files')) {
        record = { ...record, db_media: true };
      }
      if (sql.includes('UPDATE public.messages')) {
        record = { ...record, message_media_url: args[1] };
      }
      return 1;
    }
  };
}

function makeStorage({ failFirstUpload = false, alwaysFailUpload = false, uploadError = 'Bucket not found' } = {}) {
  const uploads = [];
  const createdBuckets = [];
  let attempts = 0;
  return {
    uploads,
    createdBuckets,
    storage: {
      async createBucket(bucket, options) {
        createdBuckets.push({ bucket, options });
        return { data: {}, error: null };
      },
      from(bucket) {
        return {
          async upload(key, buffer, options) {
            attempts += 1;
            uploads.push({ bucket, key, buffer, options });
            if ((failFirstUpload && attempts === 1) || alwaysFailUpload) {
              return { error: { message: uploadError } };
            }
            return { error: null };
          },
          async download(key) {
            return { data: { arrayBuffer: async () => Buffer.from('stored-bytes') }, error: null, key };
          }
        };
      }
    }
  };
}

function makeFetch(buffer, { sha256, declaredSize, failDownload = false } = {}) {
  return async (url) => {
    if (url.includes('graph.facebook.com')) {
      return {
        ok: true,
        async json() {
          return {
            url: 'https://cdn.example.test/media',
            sha256,
            mime_type: 'image/jpeg',
            file_size: buffer.length
          };
        }
      };
    }
    if (failDownload) return { ok: false, status: 500 };
    return {
      ok: true,
      headers: { get: () => String(declaredSize ?? buffer.length) },
      async arrayBuffer() {
        return buffer;
      }
    };
  };
}

console.log('\n📦 SECTION 1: Webhook media descriptors');

await check('1.1 Image descriptors keep id, caption, filename, MIME and checksum', () => {
  const checksum = 'a'.repeat(64);
  const descriptor = extractMediaDescriptor({
    type: 'image',
    image: { id: 'media-1', caption: 'Look', filename: 'photo.JPG', mime_type: 'IMAGE/JPEG', sha256: checksum }
  });
  assert.deepStrictEqual(descriptor, {
    mediaId: 'media-1',
    mediaType: 'image',
    isVoice: false,
    caption: 'Look',
    fileName: 'photo.JPG',
    mimeType: 'image/jpeg',
    checksumSha256: checksum,
    animated: false
  });
});

await check('1.2 Voice notes arrive as audio with voice=true', () => {
  const descriptor = extractMediaDescriptor({ type: 'audio', audio: { id: 'media-2', voice: true, mime_type: 'audio/ogg' } });
  assert.strictEqual(descriptor.mediaType, 'audio');
  assert.strictEqual(descriptor.isVoice, true);
});

await check('1.3 Legacy voice message type still resolves to audio', () => {
  const descriptor = extractMediaDescriptor({ type: 'voice', audio: { id: 'media-3' } });
  assert.strictEqual(descriptor.mediaType, 'audio');
  assert.strictEqual(descriptor.isVoice, true);
});

await check('1.4 Sticker, video and document payloads are supported', () => {
  assert.strictEqual(extractMediaDescriptor({ type: 'sticker', sticker: { id: 's1', animated: true } }).mediaType, 'sticker');
  assert.strictEqual(extractMediaDescriptor({ type: 'video', video: { id: 'v1' } }).mediaType, 'video');
  const document = extractMediaDescriptor({ type: 'document', document: { id: 'd1', filename: 'report.pdf', mime_type: 'application/pdf' } });
  assert.strictEqual(document.mediaType, 'document');
  assert.strictEqual(document.fileName, 'report.pdf');
});

await check('1.5 Text and malformed payloads yield no descriptor', () => {
  assert.strictEqual(extractMediaDescriptor({ type: 'text', text: { body: 'hi' } }), null);
  assert.strictEqual(extractMediaDescriptor({ type: 'image', image: {} }), null);
  assert.strictEqual(extractMediaDescriptor(null), null);
});

console.log('\n📦 SECTION 2: Storage keys and retry policy');

await check('2.1 Storage keys are stable and tenant/lead scoped', () => {
  assert.strictEqual(
    buildMediaStorageKey({ company: 'RWC', leadId: 'lead-1', mediaId: '123', mimeType: 'image/jpeg' }),
    'RWC/lead-1/123.jpg'
  );
  assert.strictEqual(
    buildMediaStorageKey({ company: 'cras', leadId: 'lead/../../x', mediaId: '../../../1', mimeType: 'application/pdf' }),
    'CRAS/leadx/1.pdf'
  );
});

await check('2.2 Extensions prefer the supplied filename, then MIME, then .bin', () => {
  assert.strictEqual(extensionForMedia('image/jpeg', 'scan.WEBP'), 'webp');
  assert.strictEqual(extensionForMedia('audio/ogg', null), 'ogg');
  assert.strictEqual(extensionForMedia('application/octet-stream', 'no-extension'), 'bin');
});

await check('2.3 Retry delays back off and cap at six hours', () => {
  assert.strictEqual(retryDelayMs(1), __private.RETRY_DELAYS_MS[0]);
  assert.strictEqual(retryDelayMs(3), __private.RETRY_DELAYS_MS[2]);
  assert.strictEqual(retryDelayMs(99), __private.RETRY_DELAYS_MS[4]);
  assert.strictEqual(retryDelayMs(0), __private.RETRY_DELAYS_MS[0]);
});

console.log('\n📦 SECTION 3: Signed media API URLs');

await check('3.1 A fresh signed URL verifies', () => {
  const url = createSignedMediaApiUrl('media-record-1');
  const parsed = new URL(url, 'http://localhost');
  assert.strictEqual(decodeURIComponent(parsed.pathname.split('/').pop()), 'media-record-1');
  assert.strictEqual(
    verifySignedMediaApiUrl('media-record-1', parsed.searchParams.get('exp'), parsed.searchParams.get('sig')),
    true
  );
});

await check('3.2 Expired and tampered signed URLs are rejected', () => {
  const expired = createSignedMediaApiUrl('media-record-1', -1);
  const parsed = new URL(expired, 'http://localhost');
  assert.strictEqual(
    verifySignedMediaApiUrl('media-record-1', parsed.searchParams.get('exp'), parsed.searchParams.get('sig')),
    false
  );
  const valid = new URL(createSignedMediaApiUrl('media-record-1'), 'http://localhost');
  assert.strictEqual(
    verifySignedMediaApiUrl('media-record-2', valid.searchParams.get('exp'), valid.searchParams.get('sig')),
    false
  );
  assert.strictEqual(verifySignedMediaApiUrl('media-record-1', null, 'nope'), false);
});

console.log('\n📦 SECTION 4: Record authorization');

await check('4.1 Super admin and leads officers can access any media', () => {
  const record = baseRecord();
  assert.strictEqual(canAccessMediaRecord({ id: 'u1', role: 'super_admin' }, record, null), true);
  assert.strictEqual(canAccessMediaRecord({ id: 'u1', role: 'leads_officer' }, record, null), true);
});

await check('4.2 Assigned staff can access their own lead media', () => {
  const record = baseRecord();
  const lead = { assignedTo: 'user-1', company: 'RWC' };
  assert.strictEqual(canAccessMediaRecord({ id: 'user-1', role: 'coordinator', company: 'CRAS' }, record, lead), true);
  assert.strictEqual(canAccessMediaRecord({ id: 'user-1', role: 'clinical_nurse', company: 'RWC' }, record, lead), true);
});

await check('4.3 Unassigned coordinators are denied even within the same company', () => {
  const record = baseRecord();
  assert.strictEqual(
    canAccessMediaRecord({ id: 'user-2', role: 'coordinator', company: 'RWC' }, record, { assignedTo: 'user-1', company: 'RWC' }),
    false
  );
});

await check('4.4 Company isolation applies to non-assignment roles', () => {
  const record = baseRecord({ company: 'RWC' });
  assert.strictEqual(canAccessMediaRecord({ id: 'u2', role: 'marketing_officer', company: 'RWC' }, record, null), true);
  assert.strictEqual(canAccessMediaRecord({ id: 'u3', role: 'marketing_officer', company: 'CRAS' }, record, null), false);
  assert.strictEqual(canAccessMediaRecord({ id: 'u4', role: 'report_analyst', company: undefined }, record, null), false);
});

console.log('\n📦 SECTION 5: Durable metadata and private-bucket transport');

await check('5.1 Metadata persists with duplicate-webhook idempotency before upload', async () => {
  const prisma = makePrisma(baseRecord());
  await persistInboundMediaMetadata(prisma, {
    messageId: 'wamid.TEST1',
    company: 'RWC',
    leadId: 'lead-1',
    customerId: 'cust-1',
    descriptor: extractMediaDescriptor({ type: 'image', image: { id: '123456789', mime_type: 'image/jpeg' } })
  });
  const insert = prisma.calls.find(call => call.sql.includes('INSERT INTO public.whatsapp_media'));
  assert(insert, 'metadata insert must run');
  assert(insert.sql.includes('ON CONFLICT (message_id)'), 'duplicate webhooks must not duplicate rows');
  assert.strictEqual(insert.args[2], '123456789');
  assert.strictEqual(insert.args[3], 'RWC');
});

await check('5.2 A stored media record is uploaded and marked ready with a canonical pointer', async () => {
  const buffer = Buffer.from('image-bytes');
  const prisma = makePrisma(baseRecord());
  const storage = makeStorage();
  const result = await processMediaRecord(prisma, prisma.getRecord(), {
    metaToken: 'token',
    storage,
    bucket: 'whatsapp-media',
    fetchImpl: makeFetch(buffer, { sha256: sha256Hex(buffer) })
  });

  assert.strictEqual(result.status, 'ready');
  assert.strictEqual(storage.uploads.length, 1);
  assert.strictEqual(storage.uploads[0].bucket, 'whatsapp-media');
  assert.strictEqual(storage.uploads[0].key, 'RWC/lead-1/123456789.jpg');
  assert.deepStrictEqual(storage.uploads[0].buffer, buffer);
  const pointer = prisma.calls.find(call => call.sql.includes('UPDATE public.messages'));
  assert(pointer, 'message must receive the canonical media pointer');
  assert.strictEqual(pointer.args[1], '/api/media/media-record-1');
});

await check('5.3 A checksum mismatch fails the record and never uploads', async () => {
  const buffer = Buffer.from('tampered');
  const prisma = makePrisma(baseRecord());
  const storage = makeStorage();
  const result = await processMediaRecord(prisma, prisma.getRecord(), {
    metaToken: 'token',
    storage,
    fetchImpl: makeFetch(buffer, { sha256: 'b'.repeat(64) })
  });
  assert.strictEqual(result, null);
  assert.strictEqual(storage.uploads.length, 0);
  assert.strictEqual(prisma.getRecord().status, 'failed');
  assert(prisma.getRecord().last_error.includes('checksum'));
});

await check('5.4 Oversized media is rejected before download completes', async () => {
  const buffer = Buffer.from('big');
  const prisma = makePrisma(baseRecord());
  const storage = makeStorage();
  const result = await processMediaRecord(prisma, prisma.getRecord(), {
    metaToken: 'token',
    storage,
    fetchImpl: makeFetch(buffer, { declaredSize: __private.MAX_MEDIA_BYTES + 1 })
  });
  assert.strictEqual(result, null);
  assert.strictEqual(storage.uploads.length, 0);
  assert(prisma.getRecord().last_error.includes('maximum'));
});

await check('5.5 Duplicate webhooks reuse an already-ready media record', async () => {
  const ready = baseRecord({ status: 'ready' });
  const prisma = makePrisma(ready);
  let fetches = 0;
  const result = await processMediaRecord(prisma, ready, {
    metaToken: 'token',
    storage: makeStorage().storage,
    fetchImpl: async () => { fetches += 1; return { ok: true, json: async () => ({}) }; }
  });
  assert.strictEqual(result.status, 'ready');
  assert.strictEqual(fetches, 0);
  assert.strictEqual(prisma.calls.length, 0);
});

await check('5.6 A processing failure is recorded for the retry worker', async () => {
  const buffer = Buffer.from('x');
  const prisma = makePrisma(baseRecord());
  const result = await processMediaRecord(prisma, prisma.getRecord(), {
    metaToken: 'token',
    storage: makeStorage().storage,
    fetchImpl: makeFetch(buffer, { failDownload: true })
  });
  assert.strictEqual(result, null);
  assert.strictEqual(prisma.getRecord().status, 'failed');
  assert(prisma.getRecord().last_error.includes('download'));
  const failedUpdate = prisma.calls.find(call => call.sql.includes("SET status = 'failed'"));
  assert(failedUpdate.sql.includes('next_retry_at'), 'failure must schedule a retry');
});

await check('5.7 Metadata lookup returns nothing for an unknown id', async () => {
  const prisma = makePrisma(null);
  assert.strictEqual(await getMediaRecordById(prisma, 'missing'), null);
});

await check('5.8 A missing bucket is created once and the upload retried', async () => {
  const buffer = Buffer.from('image-bytes');
  const prisma = makePrisma(baseRecord());
  const storage = makeStorage({ failFirstUpload: true });
  const result = await processMediaRecord(prisma, prisma.getRecord(), {
    metaToken: 'token',
    storage,
    bucket: 'whatsapp-media',
    fetchImpl: makeFetch(buffer, { sha256: sha256Hex(buffer) })
  });

  assert.strictEqual(result.status, 'ready');
  assert.strictEqual(storage.createdBuckets.length, 1);
  assert.strictEqual(storage.createdBuckets[0].bucket, 'whatsapp-media');
  assert.strictEqual(storage.createdBuckets[0].options.public, false);
  assert.strictEqual(storage.uploads.length, 2);
});

await check('5.9 A failed upload falls back to the media_files table and still marks the record ready', async () => {
  const buffer = Buffer.from('image-bytes');
  const prisma = makePrisma(baseRecord());
  const storage = makeStorage({ alwaysFailUpload: true, uploadError: 'storage unavailable' });
  const result = await processMediaRecord(prisma, prisma.getRecord(), {
    metaToken: 'token',
    storage,
    bucket: 'whatsapp-media',
    fetchImpl: makeFetch(buffer, { sha256: sha256Hex(buffer) })
  });

  assert.strictEqual(result.status, 'ready');
  assert.strictEqual(storage.createdBuckets.length, 0, 'only a bucket-not-found error creates a bucket');
  const insert = prisma.calls.find(call => call.sql.includes('INSERT INTO public.media_files'));
  assert(insert, 'binary must be persisted to media_files');
  assert.strictEqual(insert.args[1], '123456789.jpg');
  assert.deepStrictEqual(insert.args[3], buffer);
});

await check('5.10 Downloads fall back to media_files when the bucket is unavailable', async () => {
  const prisma = makePrisma(baseRecord({ status: 'ready' }));
  const result = await downloadMediaObject(prisma.getRecord(), {
    storage: { storage: { from: () => ({ download: async () => ({ data: null, error: { message: 'Bucket not found' } }) }) } },
    bucket: 'whatsapp-media',
    prisma
  });

  assert(result, 'fallback must return the stored binary');
  assert.strictEqual(result.buffer.toString(), 'stored-bytes');
  assert.strictEqual(result.mimeType, 'image/jpeg');
});

console.log('\n📦 SECTION 6: Webhook ordering guard');

await check('6.1 The webhook persists metadata before any media download', () => {
  const source = fs.readFileSync(new URL('./src/legacyServer.js', import.meta.url), 'utf8');
  const start = source.indexOf('// 12. Meta WhatsApp Cloud API Webhook Handlers');
  const end = source.indexOf('// 12b. Handle Outbound Message Status Tracking');
  assert(start > 0 && end > start, 'webhook section must be identifiable');
  const webhook = source.slice(start, end);
  const persistIndex = webhook.indexOf('await persistInboundMediaMetadata');
  const processIndex = webhook.indexOf('await processMediaRecord');
  assert(persistIndex > 0, 'webhook must persist media metadata');
  assert(processIndex > persistIndex, 'metadata persistence must precede the download');
  assert(!webhook.includes('await downloadMetaMedia('), 'webhook must not download before persistence');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`Inbound media checks: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
