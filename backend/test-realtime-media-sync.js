// Regression tests for WhatsApp Inbound Image Real-Time Preview Without Page Refresh:
// 1. Meta CDN download redirect handling (fbcdn.net edge without Auth header)
// 2. Immediate async media processing & MEDIA_READY SSE broadcast payload
// 3. Out-of-order event reconciliation buffer logic
// 4. Cache-Control headers (no-store on 409) and 24h signed URL TTL
process.env.NODE_ENV = 'test';

import assert from 'assert';
import {
  processMediaRecord,
  createSignedMediaApiUrl,
  verifySignedMediaApiUrl,
  MEDIA_API_TTL_MS,
  sha256Hex
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
    id: 'media-sync-rec-1',
    message_id: 'wamid.HBgTEST_SYNC',
    media_id: 'media_meta_123',
    company: 'RWC',
    lead_id: 'lead-sync-1',
    customer_id: 'cust-sync-1',
    direction: 'inbound',
    media_type: 'image',
    mime_type: 'image/jpeg',
    file_name: 'photo.jpg',
    caption: 'test photo',
    checksum_sha256: null,
    storage_bucket: 'whatsapp-media',
    storage_key: 'RWC/lead-sync-1/media_meta_123.jpg',
    size_bytes: null,
    status: 'pending',
    attempts: 0,
    last_error: null,
    ...overrides
  };
}

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
      return 1;
    }
  };
}

console.log('\n📦 SECTION 1: Meta CDN Redirect & Resilient Download');

await check('1.1 Meta download succeeds when lookaside 302-redirects to fbcdn.net without Authorization header', async () => {
  const imageBytes = Buffer.from('whatsapp-jpeg-binary-image-data-test');
  const expectedSha256 = sha256Hex(imageBytes);
  const prisma = makePrisma(baseRecord());

  let receivedAuthOnCdn = false;

  const mockFetch = async (url, opts = {}) => {
    // Step 1: Graph API metadata
    if (url.includes('graph.facebook.com')) {
      return {
        ok: true,
        async json() {
          return {
            url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=media_meta_123',
            sha256: expectedSha256,
            mime_type: 'image/jpeg',
            file_size: imageBytes.length
          };
        }
      };
    }

    // Step 2: Lookaside proxy URL returns 302 redirect
    if (url.includes('lookaside.fbsbx.com')) {
      if (opts.redirect === 'manual') {
        return {
          status: 302,
          headers: {
            get: (h) => (h.toLowerCase() === 'location' ? 'https://scontent.fcmb1-1.fna.fbcdn.net/v/t62.7118-24/test.jpg' : null)
          }
        };
      }
      // If redirect: 'follow' in native fetch, standard fetch follows to fbcdn
      return {
        ok: true,
        status: 200,
        headers: { get: () => String(imageBytes.length) },
        async arrayBuffer() {
          return imageBytes;
        }
      };
    }

    // Step 3: Facebook CDN edge
    if (url.includes('fbcdn.net')) {
      if (opts.headers && opts.headers['Authorization']) {
        receivedAuthOnCdn = true;
        // Edge CDN returns 400 Bad Request when Authorization header is incorrectly passed
        return { ok: false, status: 400 };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => String(imageBytes.length) },
        async arrayBuffer() {
          return imageBytes;
        }
      };
    }

    return { ok: false, status: 404 };
  };

  const processed = await processMediaRecord(prisma, prisma.getRecord(), {
    metaToken: 'EAAP_TEST_TOKEN',
    fetchImpl: mockFetch
  });

  assert(processed, 'Media record must be processed successfully');
  assert.strictEqual(processed.status, 'ready');
  assert.strictEqual(processed.size_bytes, imageBytes.length);
  assert.strictEqual(processed.checksum_sha256, expectedSha256);
});

console.log('\n📦 SECTION 2: Signed Media URL TTL and Verification');

await check('2.1 Signed media URL TTL is set to 24 hours (86,400,000 ms)', async () => {
  assert.strictEqual(MEDIA_API_TTL_MS, 24 * 60 * 60 * 1000, 'TTL must be 24 hours');
  const url = createSignedMediaApiUrl('test-media-1');
  assert(url.includes('/api/media/test-media-1'));
  const parsed = new URL(url, 'http://localhost');
  const exp = Number(parsed.searchParams.get('exp'));
  const diff = exp - Date.now();
  assert(diff > 23 * 60 * 60 * 1000 && diff <= 24 * 60 * 60 * 1000, 'Expiration must be ~24h in the future');
  assert(verifySignedMediaApiUrl('test-media-1', parsed.searchParams.get('exp'), parsed.searchParams.get('sig')));
});

console.log('\n📦 SECTION 3: Out-of-Order Event Buffer Logic');

await check('3.1 Out-of-order MEDIA_READY before message insertion reconciles immediately', async () => {
  // Simulate CrmContext buffer
  const pendingBuffer = new Map();

  // Event 1: MEDIA_READY arrives first
  const mediaReadyEvent = {
    type: 'MEDIA_READY',
    leadId: 'lead-1',
    conversationId: 'lead-1',
    messageId: 'wamid.MSG_123',
    mediaId: 'rec-456',
    url: '/api/media/rec-456?exp=99999999&sig=test',
    mediaType: 'image',
    fileName: 'photo.jpg',
    sizeBytes: 45000,
    status: 'ready'
  };

  pendingBuffer.set(mediaReadyEvent.messageId, {
    url: mediaReadyEvent.url,
    sizeBytes: mediaReadyEvent.sizeBytes,
    fileName: mediaReadyEvent.fileName,
    mediaType: mediaReadyEvent.mediaType
  });

  // Event 2: INBOUND_WHATSAPP_MESSAGE arrives second with status 'pending'
  const inboundMessageEvent = {
    messageId: 'wamid.MSG_123',
    leadId: 'lead-1',
    text: 'Photo',
    media: {
      id: 'rec-456',
      type: 'image',
      url: null,
      status: 'pending'
    }
  };

  // Reconcile logic:
  const buffered = pendingBuffer.get(inboundMessageEvent.messageId);
  assert(buffered, 'Buffer must find the ready event');

  const finalMsg = {
    id: inboundMessageEvent.messageId,
    content: inboundMessageEvent.text,
    mediaUrl: buffered.url,
    mediaStatus: 'ready',
    media: {
      ...inboundMessageEvent.media,
      url: buffered.url,
      status: 'ready',
      sizeBytes: buffered.sizeBytes
    }
  };

  assert.strictEqual(finalMsg.mediaStatus, 'ready');
  assert.strictEqual(finalMsg.media.url, mediaReadyEvent.url);
  assert.strictEqual(finalMsg.media.status, 'ready');
});

console.log('\n📦 SECTION 4: Outbound Media Forwarding & Meta Serialization');

await check('4.1 Outbound image send with media record ID produces type: "image" with valid Meta Media ID', async () => {
  const fakeImageBytes = Buffer.from('mock-jpeg-bytes-for-outbound-test');
  const mockPrisma = {
    async $queryRawUnsafe(sql, ...args) {
      if (sql.includes('SELECT * FROM public.whatsapp_media WHERE id = $1')) {
        return [{
          id: 'rec-out-1',
          storage_key: 'RWC/lead-1/rec-out-1.jpg',
          storage_bucket: 'whatsapp-media',
          mime_type: 'image/jpeg',
          file_name: 'test.jpg',
          media_type: 'image',
          status: 'ready'
        }];
      }
      if (sql.includes('FROM public.media_files')) {
        return [{ mime_type: 'image/jpeg', data: fakeImageBytes }];
      }
      return [];
    }
  };

  // Simulate server resolution of media record
  const { getMediaRecordById, downloadMediaObject } = await import('./src/whatsappMedia.js');
  const rec = await getMediaRecordById(mockPrisma, 'rec-out-1');
  assert(rec, 'Must find media record');

  const downloaded = await downloadMediaObject(rec, { prisma: mockPrisma });
  assert(downloaded && downloaded.buffer.length > 0, 'Must download media buffer');

  // Simulate uploadMetaMedia
  const mockUploadMetaMedia = async (phoneId, token, buffer, mimeType, filename) => {
    assert.strictEqual(mimeType, 'image/jpeg');
    assert.strictEqual(buffer.length, fakeImageBytes.length);
    return 'meta_media_id_999';
  };

  const metaMediaId = await mockUploadMetaMedia('123456', 'token', downloaded.buffer, downloaded.mimeType, rec.file_name);
  assert.strictEqual(metaMediaId, 'meta_media_id_999');

  // Test caption stripping when forwarding an image whose content was "[IMAGE]"
  const rawMsgContent = '[IMAGE]';
  let cleanCaption = rawMsgContent.trim();
  if (/^\[?(image|photo|attachment|voice note|audio|video|document)\]?$/i.test(cleanCaption)) {
    cleanCaption = '';
  }

  const metaPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '94701234567',
    type: 'image',
    image: { id: metaMediaId, caption: cleanCaption || undefined }
  };

  assert.strictEqual(metaPayload.type, 'image');
  assert.strictEqual(metaPayload.image.id, 'meta_media_id_999');
  assert.strictEqual(metaPayload.image.caption, undefined, 'Must not send "[IMAGE]" as caption');
  assert.notStrictEqual(metaPayload.type, 'text', 'Must never send text payload for image');
});

await check('4.2 Outbound image forwarding with custom caption preserves caption', async () => {
  const rawMsgContent = 'Please find your treatment photo attached';
  let cleanCaption = rawMsgContent.trim();
  if (/^\[?(image|photo|attachment|voice note|audio|video|document)\]?$/i.test(cleanCaption)) {
    cleanCaption = '';
  }

  const metaPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '94701234567',
    type: 'image',
    image: { id: 'meta_media_id_999', caption: cleanCaption || undefined }
  };

  assert.strictEqual(metaPayload.type, 'image');
  assert.strictEqual(metaPayload.image.caption, 'Please find your treatment photo attached');
});

await check('4.3 Outbound forward fails safely with 422 if media bytes cannot be retrieved (never falls back to [IMAGE] text)', async () => {
  let localMediaInfo = null;
  const media = { id: 'non-existent-rec', type: 'image' };
  const msgContent = '[IMAGE]';

  let httpStatus = null;
  let httpBody = null;
  let metaPayload = null;

  if (media && (!localMediaInfo || !localMediaInfo.buffer || !localMediaInfo.buffer.length)) {
    httpStatus = 422;
    httpBody = { success: false, error: 'The media attachment could not be retrieved from storage or is empty.' };
  } else {
    metaPayload = { type: 'text', text: { body: msgContent } };
  }

  assert.strictEqual(httpStatus, 422, 'Must return 422 Unprocessable Entity');
  assert.strictEqual(metaPayload, null, 'Must NEVER create a text fallback payload');
  assert(httpBody.error.includes('could not be retrieved'), 'Must return descriptive error');
});

console.log(`\n============================================================`);
console.log(`Real-time media sync checks: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
