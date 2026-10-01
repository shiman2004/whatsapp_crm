import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function consolidate() {
  console.log('🧹 Starting Database Consolidation & Deduplication...');

  // 1. Delete blank/empty protocol messages
  const deletedEmpty = await prisma.message.deleteMany({
    where: {
      content: '',
      mediaUrl: null
    }
  });
  console.log(`🗑️ Deleted ${deletedEmpty.count} empty protocol messages.`);

  // 2. Fetch all customers with leads and messages
  const customers = await prisma.customer.findMany({
    include: {
      leads: {
        include: {
          messages: true,
          notes: true,
          stageHistories: true,
          followups: true,
        }
      }
    }
  });

  console.log(`Found ${customers.length} total customer records in DB.`);

  // Group customers by similarity:
  // - Clean whatsappId
  // - Clean whatsappNumber (last 9 digits if available)
  // - Clean displayName
  const clusters = [];

  function getClusterKey(c) {
    const waId = (c.whatsappId || '').trim();
    const name = (c.displayName || '').trim().toLowerCase();
    const phone = (c.whatsappNumber || '').replace(/[^0-9]/g, '');
    const phoneSuffix = phone.length >= 9 ? phone.slice(-9) : phone;
    return { waId, name, phoneSuffix, fullPhone: phone };
  }

  const processedCustIds = new Set();

  for (let i = 0; i < customers.length; i++) {
    const c1 = customers[i];
    if (processedCustIds.has(c1.id)) continue;

    const group = [c1];
    processedCustIds.add(c1.id);
    const k1 = getClusterKey(c1);

    for (let j = i + 1; j < customers.length; j++) {
      const c2 = customers[j];
      if (processedCustIds.has(c2.id)) continue;
      const k2 = getClusterKey(c2);

      let isMatch = false;
      if (k1.waId && k2.waId && k1.waId === k2.waId) isMatch = true;
      else if (k1.phoneSuffix && k2.phoneSuffix && k1.phoneSuffix === k2.phoneSuffix) isMatch = true;
      else if (
        k1.name && k2.name &&
        k1.name === k2.name &&
        !k1.name.startsWith('+') &&
        k1.name !== 'whatsapp contact' &&
        k1.name !== 'you (staff)'
      ) {
        isMatch = true;
      }

      if (isMatch) {
        group.push(c2);
        processedCustIds.add(c2.id);
      }
    }

    clusters.push(group);
  }

  console.log(`Identified ${clusters.length} distinct customer clusters.`);

  for (const group of clusters) {
    if (group.length === 1 && group[0].leads.length <= 1) {
      // Clean single customer
      continue;
    }

    console.log(`\nMerging cluster of ${group.length} customers:`, group.map(c => `${c.displayName} (${c.whatsappNumber} / ${c.whatsappId})`).join(', '));

    // Choose canonical customer: prefer one with real phone number (e.g. +94... or length <= 15) and real displayName
    let canonical = group[0];
    for (const c of group) {
      const isBetterPhone = c.whatsappNumber && !c.whatsappNumber.startsWith('+1820') && !c.whatsappNumber.startsWith('+2001') && !c.whatsappNumber.startsWith('+1980') && !c.whatsappNumber.startsWith('+2226') && !c.whatsappNumber.startsWith('+2520') && !c.whatsappNumber.startsWith('+7328') && !c.whatsappNumber.startsWith('+1766');
      const isBetterName = c.displayName && !c.displayName.startsWith('+') && c.displayName !== 'WhatsApp Contact';
      if (isBetterPhone || (isBetterName && (!canonical.displayName || canonical.displayName.startsWith('+')))) {
        canonical = c;
      }
    }

    // Merge metadata
    let bestName = canonical.displayName;
    let bestPhone = canonical.whatsappNumber;
    let bestWaId = canonical.whatsappId;

    for (const c of group) {
      if (c.displayName && !c.displayName.startsWith('+') && c.displayName !== 'WhatsApp Contact') {
        bestName = c.displayName;
      }
      if (c.whatsappNumber && c.whatsappNumber.length <= 15 && (!bestPhone || bestPhone.length > 15)) {
        bestPhone = c.whatsappNumber;
      }
      if (c.whatsappId && (!bestWaId || bestWaId.length < c.whatsappId.length)) {
        bestWaId = c.whatsappId;
      }
    }

    // Update canonical customer
    await prisma.customer.update({
      where: { id: canonical.id },
      data: {
        displayName: bestName,
        whatsappNumber: bestPhone,
        whatsappId: bestWaId
      }
    });

    // Find or pick a single primary lead for canonical customer
    const allLeads = group.flatMap(c => c.leads);
    let primaryLead = allLeads.find(l => l.customerId === canonical.id) || allLeads[0];

    if (!primaryLead && allLeads.length > 0) {
      primaryLead = allLeads[0];
    }

    if (primaryLead) {
      await prisma.lead.update({
        where: { id: primaryLead.id },
        data: { customerId: canonical.id }
      });

      // Move all messages, notes, followups from other leads to primaryLead
      for (const lead of allLeads) {
        if (lead.id === primaryLead.id) continue;

        // Move messages
        await prisma.message.updateMany({
          where: { leadId: lead.id },
          data: { leadId: primaryLead.id, customerId: canonical.id }
        });

        // Move notes
        await prisma.leadNote.updateMany({
          where: { leadId: lead.id },
          data: { leadId: primaryLead.id }
        });

        // Move followups
        await prisma.followup.updateMany({
          where: { leadId: lead.id },
          data: { leadId: primaryLead.id }
        });

        // Delete other lead
        await prisma.lead.delete({
          where: { id: lead.id }
        });
      }
    }

    // Delete non-canonical customers
    for (const c of group) {
      if (c.id === canonical.id) continue;
      await prisma.customer.delete({
        where: { id: c.id }
      }).catch(err => console.warn('Could not delete duplicate customer:', err.message));
    }
  }

  // Deduplicate any identical messages under same lead
  const allMessages = await prisma.message.findMany({
    orderBy: { timestamp: 'asc' }
  });

  const seenMsgs = new Map();
  let deletedDups = 0;

  for (const m of allMessages) {
    const key = `${m.leadId}|${m.direction}|${m.content}|${Math.floor(new Date(m.timestamp).getTime() / 2000)}`;
    if (seenMsgs.has(key)) {
      await prisma.message.delete({ where: { id: m.id } });
      deletedDups++;
    } else {
      seenMsgs.set(key, m.id);
    }
  }

  console.log(`✨ Consolidation complete! Removed ${deletedDups} duplicate messages.`);
  const remainingCusts = await prisma.customer.count();
  const remainingLeads = await prisma.lead.count();
  const remainingMsgs = await prisma.message.count();
  console.log(`📊 DB Summary: ${remainingCusts} Customers, ${remainingLeads} Leads, ${remainingMsgs} Messages.`);
  process.exit(0);
}

consolidate().catch(e => {
  console.error('Error consolidating:', e);
  process.exit(1);
});
