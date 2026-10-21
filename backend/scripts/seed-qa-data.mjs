/**
 * Seeds a deterministic fixture into the ISOLATED TEST DATABASE for manual/automated
 * browser QA. Creates:
 *   - a super admin and a coordinator (so role-based access can be exercised)
 *   - 2 companies' worth of leads
 *   - one lead with 600 messages spread over only 6 distinct timestamps, which is what
 *     exercises the composite-cursor fix (a timestamp-only cursor would drop messages)
 *   - notes on that lead, to verify the notes badge survives a reload
 *
 * Every row is tagged with a `qa-` prefix so it can be removed again.
 *
 * Usage: node scripts/seed-qa-data.mjs
 *        node scripts/seed-qa-data.mjs --clear
 */
process.env.NODE_ENV = 'test';

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

// Load .env.test explicitly so this utility can never target production, regardless of
// how it is invoked (the DB guard in src/db.js also enforces this independently).
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendDir, '.env.test'), override: true, quiet: true });

const { checkDbConnection, getPrisma, waitForSchemaBootstrap } = await import('../src/db.js');
const { describeTestDatabase } = await import('../src/testDbGuard.js');
const { hashSecret } = await import('../src/legacyServer.js');

const conn = await checkDbConnection();
if (!conn.connected) {
  console.error('Database unavailable:', conn.message);
  process.exit(1);
}
await waitForSchemaBootstrap();
const prisma = getPrisma();
console.log('target:', describeTestDatabase());

const LEAD_WITH_MESSAGES = 'qa-lead-conversation';
const CUSTOMER_WITH_MESSAGES = 'qa-customer-conversation';
const MESSAGE_COUNT = 600;
// 600 messages across 6 instants = 100 messages sharing each millisecond. A bare-timestamp
// cursor drops all but the boundary row; the composite cursor must return every one.
const DISTINCT_TIMESTAMPS = 6;

async function clear() {
  await prisma.message.deleteMany({ where: { id: { startsWith: 'qa-msg-' } } });
  await prisma.leadNote.deleteMany({ where: { id: { startsWith: 'qa-note-' } } });
  await prisma.leadAssignmentHistory.deleteMany({ where: { leadId: { startsWith: 'qa-lead-' } } });
  await prisma.leadStageHistory.deleteMany({ where: { leadId: { startsWith: 'qa-lead-' } } });
  await prisma.lead.deleteMany({ where: { id: { startsWith: 'qa-lead-' } } });
  await prisma.customer.deleteMany({ where: { id: { startsWith: 'qa-customer-' } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: 'qa-user-' } } });
}

await clear();

if (process.argv.includes('--clear')) {
  console.log('QA fixture rows removed.');
  await prisma.$disconnect();
  setTimeout(() => process.exit(0), 200).unref();
} else {
  const password = String(process.env.QA_PASSWORD || 'qa-password');
  const pin = String(process.env.QA_PIN || '4321');

  await prisma.user.createMany({
    data: [
      {
        id: 'qa-user-admin',
        fullName: 'QA Administrator',
        email: 'qa.admin@royalwellness.lk',
        role: 'super_admin',
        active: true,
        password: hashSecret(password),
        pin: hashSecret(pin),
        branch: 'Colombo (Head Office)'
      },
      {
        id: 'qa-user-coordinator',
        fullName: 'QA Coordinator',
        email: 'qa.coordinator@royalwellness.lk',
        role: 'coordinator',
        active: true,
        password: hashSecret(password),
        pin: hashSecret(pin),
        company: 'RWC',
        branch: 'Colombo'
      }
    ],
    skipDuplicates: true
  });

  // The conversation lead: 600 messages, only 6 distinct timestamps.
  await prisma.customer.create({
    data: {
      id: CUSTOMER_WITH_MESSAGES,
      whatsappNumber: '+94700000101',
      whatsappId: '94700000101',
      displayName: 'QA Conversation Customer',
      preferredLanguage: 'en'
    }
  });
  await prisma.lead.create({
    data: {
      id: LEAD_WITH_MESSAGES,
      customerId: CUSTOMER_WITH_MESSAGES,
      stage: 'contacted',
      source: 'RWC',
      company: 'RWC',
      assignedTo: 'qa-user-coordinator',
      lastCustomerMessageAt: new Date()
    }
  });

  const base = Date.now() - 7 * 24 * 3600 * 1000;
  const messages = [];
  for (let i = 0; i < MESSAGE_COUNT; i++) {
    const stamp = new Date(base + Math.floor(i / (MESSAGE_COUNT / DISTINCT_TIMESTAMPS)) * 1000);
    messages.push({
      id: `qa-msg-${String(i).padStart(4, '0')}`,
      leadId: LEAD_WITH_MESSAGES,
      customerId: CUSTOMER_WITH_MESSAGES,
      direction: i % 2 === 0 ? 'inbound' : 'outbound',
      senderType: i % 2 === 0 ? 'customer' : 'coordinator',
      content: `QA message ${i}`,
      status: 'delivered',
      timestamp: stamp
    });
  }
  for (let i = 0; i < messages.length; i += 200) {
    await prisma.message.createMany({ data: messages.slice(i, i + 200), skipDuplicates: true });
  }

  // Notes on the conversation lead: the badge must show this count after a reload.
  await prisma.leadNote.createMany({
    data: Array.from({ length: 3 }, (_, k) => ({
      id: `qa-note-${k}`,
      leadId: LEAD_WITH_MESSAGES,
      authorId: 'qa-user-admin',
      authorName: 'QA Administrator',
      note: `QA note ${k}`
    })),
    skipDuplicates: true
  });

  // A spread of additional leads so the table has pagination and something to search/sort.
  const extra = Array.from({ length: 60 }, (_, i) => ({
    id: `qa-lead-${String(i).padStart(3, '0')}`,
    customerId: `qa-customer-${String(i).padStart(3, '0')}`
  }));
  await prisma.customer.createMany({
    data: extra.map(({ id }, i) => ({
      id: `qa-customer-${String(i).padStart(3, '0')}`,
      whatsappNumber: `+9470001${String(i).padStart(4, '0')}`,
      whatsappId: `9470001${String(i).padStart(4, '0')}`,
      displayName: `QA Patient ${String(i).padStart(3, '0')}`,
      preferredLanguage: 'en'
    })),
    skipDuplicates: true
  });
  await prisma.lead.createMany({
    data: extra.map(({ id }, i) => ({
      id,
      customerId: `qa-customer-${String(i).padStart(3, '0')}`,
      stage: ['new', 'contacted', 'potential', 'converted'][i % 4],
      source: i % 2 === 0 ? 'RWC' : 'CRAS',
      company: i % 2 === 0 ? 'RWC' : 'CRAS',
      assignedTo: i % 3 === 0 ? 'qa-user-coordinator' : null
    })),
    skipDuplicates: true
  });

  // Varied treatments so the table's sort control has something to order by.
  const treatments = await prisma.$queryRawUnsafe('SELECT id FROM treatments ORDER BY name LIMIT 5');
  for (let i = 0; i < extra.length; i++) {
    await prisma.$executeRawUnsafe(
      'UPDATE leads SET "treatmentId"=$1 WHERE id=$2',
      treatments[i % treatments.length].id,
      extra[i].id
    );
  }

  const counts = await prisma.$queryRawUnsafe(
    `SELECT (SELECT COUNT(*)::int FROM leads) AS leads,
            (SELECT COUNT(*)::int FROM messages) AS messages,
            (SELECT COUNT(*)::int FROM lead_notes) AS notes,
            (SELECT COUNT(DISTINCT timestamp)::int FROM messages WHERE id LIKE 'qa-msg-%') AS distinct_timestamps`
  );
  console.log('Seeded QA fixture:', JSON.stringify(counts[0]));
  console.log(`Login: qa.admin@royalwellness.lk / ${password}   qa.coordinator@royalwellness.lk / ${password}`);
  await prisma.$disconnect();
  setTimeout(() => process.exit(0), 200).unref();
}
