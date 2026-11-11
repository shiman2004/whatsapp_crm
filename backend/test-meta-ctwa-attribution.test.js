import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { getPrisma } from './src/db.js';
import { extractClickToWhatsAppReferral, recordMetaAdReferralNote } from './src/metaAdsHandler.js';

const TEST_PORT = 3022;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function signMetaWebhook(rawBody, secret) {
  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return `sha256=${hmac}`;
}

function postJson(path, bodyObj, headers = {}) {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(bodyObj);
    const url = new URL(path, BASE_URL);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(raw),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data || '{}'), raw: data });
          } catch {
            resolve({ status: res.statusCode, body: data, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log('🧪 Starting Meta Click-to-WhatsApp (CTWA) Attribution Test Suite...\n');

  // 1. Unit tests for extractClickToWhatsAppReferral
  assert.equal(extractClickToWhatsAppReferral({ type: 'text', text: { body: 'Hi' } }), null);
  const extracted = extractClickToWhatsAppReferral({
    id: 'wamid.test',
    referral: {
      source_type: 'ad',
      source_id: '120219999888777',
      source_url: 'https://fb.me/ad/royal-hair',
      headline: 'PRP Hair Restoration Offer',
      body: 'Book your consultation via WhatsApp',
      ctwa_clid: 'ARAkTestClickId123',
      media_type: 'video',
    },
  });
  assert.deepEqual(extracted, {
    sourceType: 'ad',
    sourceId: '120219999888777',
    sourceUrl: 'https://fb.me/ad/royal-hair',
    headline: 'PRP Hair Restoration Offer',
    body: 'Book your consultation via WhatsApp',
    ctwaClid: 'ARAkTestClickId123',
    mediaType: 'video',
  });
  console.log('✅ 1. extractClickToWhatsAppReferral unit checks passed');

  const prisma = getPrisma();
  assert(prisma, 'Prisma must initialize against test DB');

  const salt = `${Date.now().toString().slice(-6)}${crypto.randomBytes(2).toString('hex')}`;
  const digits = `9477${Date.now().toString().slice(-7)}`;
  const metaSecret = process.env.META_APP_SECRET || 'test-meta-app-secret';

  // Ensure an active admin exists so recordMetaAdReferralNote has an authorId
  let createdAdminId = null;
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'super_admin', active: true } });
  if (!existingAdmin) {
    const created = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `ctwa-admin-${salt}@royalwellness.lk`,
        fullName: 'CTWA Admin',
        role: 'super_admin',
        active: true,
      },
    });
    createdAdminId = created.id;
  }

  let serverProcess = null;
  let createdCustomerId = null;
  let createdLeadId = null;

  try {
    const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    serverProcess = spawn('node', ['server.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        NODE_ENV: 'test',
        DATABASE_URL: testDbUrl,
        DIRECT_URL: testDbUrl,
        META_APP_SECRET: metaSecret,
      },
      stdio: 'pipe',
    });

    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`${BASE_URL}/api/db/status`);
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {}
      await sleep(400);
    }
    assert(ready, 'Test server must start cleanly');

    const wamid = `wamid.ctwa.${salt}`;
    const webhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '100000000000001',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '94770000000',
                  phone_number_id: 'rwc-test-phone-id',
                },
                contacts: [
                  {
                    profile: { name: `CTWA Ad Patient ${salt}` },
                    wa_id: digits,
                  },
                ],
                messages: [
                  {
                    from: digits,
                    id: wamid,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'Hi, I saw your PRP ad on Instagram' },
                    referral: {
                      source_type: 'ad',
                      source_id: `ad_${salt}`,
                      source_url: 'https://instagram.com/p/test-ad',
                      headline: 'Hair Loss Consultation — RWC',
                      body: 'Message us on WhatsApp now',
                      ctwa_clid: `ctwa_${salt}`,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const raw = JSON.stringify(webhookPayload);
    const sig = signMetaWebhook(raw, metaSecret);

    // 2. First delivery creates Customer, Lead, Message, and 1 Meta Ads Attribution LeadNote
    const res1 = await postJson('/api/webhook', webhookPayload, { 'x-hub-signature-256': sig });
    assert.equal(res1.status, 200, `Webhook failed: ${res1.raw}`);

    const customer = await prisma.customer.findFirst({ where: { whatsappId: digits } });
    assert(customer, 'Customer must be created from CTWA inbound webhook');
    createdCustomerId = customer.id;

    const lead = await prisma.lead.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
    });
    assert(lead, 'Lead must be created from CTWA inbound webhook');
    createdLeadId = lead.id;

    const notesAfterFirst = await prisma.leadNote.findMany({ where: { leadId: lead.id } });
    assert.equal(notesAfterFirst.length, 1, 'Expected exactly 1 Meta Ads Attribution LeadNote');
    assert(notesAfterFirst[0].note.includes('[Meta Click-to-WhatsApp Ad Referral]'));
    assert(notesAfterFirst[0].note.includes(`ad_${salt}`));
    assert(notesAfterFirst[0].note.includes(`ctwa_${salt}`));
    assert(notesAfterFirst[0].note.includes('Hair Loss Consultation'));
    console.log('✅ 2. Signed CTWA webhook persisted Ad attribution LeadNote cleanly');

    // 3. Duplicate webhook retry with same ctwa_clid / sourceId must NOT duplicate note
    const res2 = await postJson('/api/webhook', webhookPayload, { 'x-hub-signature-256': sig });
    assert.equal(res2.status, 200);
    const notesAfterRetry = await prisma.leadNote.findMany({ where: { leadId: lead.id } });
    assert.equal(notesAfterRetry.length, 1, 'Duplicate CTWA webhook retry must not create duplicate LeadNote');

    // Direct dedupe check on recordMetaAdReferralNote
    await recordMetaAdReferralNote({
      prisma,
      leadId: lead.id,
      referral: extractClickToWhatsAppReferral(webhookPayload.entry[0].changes[0].value.messages[0]),
    });
    const notesAfterDirectCall = await prisma.leadNote.findMany({ where: { leadId: lead.id } });
    assert.equal(notesAfterDirectCall.length, 1);
    console.log('✅ 3. CTWA duplicate note prevention passed\n🎉 ALL META CTWA ATTRIBUTION TESTS PASSED!');
  } finally {
    if (serverProcess) serverProcess.kill('SIGTERM');
    if (createdLeadId) {
      await prisma.message.deleteMany({ where: { leadId: createdLeadId } });
      await prisma.leadNote.deleteMany({ where: { leadId: createdLeadId } });
      await prisma.leadStageHistory.deleteMany({ where: { leadId: createdLeadId } });
      await prisma.leadAssignmentHistory.deleteMany({ where: { leadId: createdLeadId } });
      await prisma.lead.deleteMany({ where: { id: createdLeadId } });
    }
    if (createdCustomerId) {
      await prisma.customer.deleteMany({ where: { id: createdCustomerId } });
    }
    if (createdAdminId) {
      await prisma.user.deleteMany({ where: { id: createdAdminId } });
    }
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
