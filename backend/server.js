import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import makeWASocketDefault, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  Browsers,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import pino from 'pino';
import dotenv from 'dotenv';
import { getPrisma, checkDbConnection, getDbStatus } from './src/db.js';
import { evaluateAutoReply, pauseAutoReply } from './src/autoReplyEngine.js';

dotenv.config();

// Support both ESM default and named export
const makeWASocket = makeWASocketDefault.default || makeWASocketDefault;

const PORT = process.env.PORT || 3001;
const AUTH_FOLDER = path.join(process.cwd(), 'auth_info_baileys');

let sock = null;
let currentQrDataUrl = null;
let connectionState = 'connecting'; // 'connecting' | 'qr_ready' | 'connected' | 'disconnected'
let connectedPhoneNumber = null;
let sseClients = [];
const processedMessageIds = new Set();
// Map clean phone/ID to original rawJid (handles @lid and @s.whatsapp.net)
const jidMap = new Map();

// Initialize database connection on start
checkDbConnection().then(res => {
  if (res.connected) {
    console.log('📦 [Cloud Database Storage] Active and ready for persistence (Supabase PostgreSQL).');
  } else {
    console.log('ℹ️ [Storage Mode] Running in memory / SSE mode (Configure DATABASE_URL in backend/.env for Cloud storage).');
  }
});

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(payload);
    } catch (e) {}
  });
}

function setConnectionState(newState, extra = {}) {
  const oldState = connectionState;
  connectionState = newState;
  console.log(`📡 [WHATSAPP STATUS] Connection state changed: ${oldState} -> ${newState}`);
  broadcastSSE({
    type: 'CONNECTION_STATUS',
    status: connectionState,
    phone: connectedPhoneNumber,
    ...extra
  });
}

// Maps for contact resolution
const lidToPhoneMap = new Map();
const lidToNameMap = new Map();
const phoneToNameMap = new Map();
const nameToPhoneMap = new Map();

// Helper: Preload all WhatsApp multi-device reverse LID mappings stored on disk
function loadAllLidMappingsFromAuthFolder() {
  if (!fs.existsSync(AUTH_FOLDER)) return;
  try {
    const files = fs.readdirSync(AUTH_FOLDER);
    let count = 0;
    for (const f of files) {
      if (f.startsWith('lid-mapping-') && f.endsWith('_reverse.json')) {
        const lidUser = f.replace('lid-mapping-', '').replace('_reverse.json', '');
        try {
          const content = fs.readFileSync(path.join(AUTH_FOLDER, f), 'utf-8');
          const pn = JSON.parse(content);
          if (pn && typeof pn === 'string') {
            const cleanPn = pn.replace(/[^0-9]/g, '');
            if (cleanPn) {
              lidToPhoneMap.set(lidUser, cleanPn);
              jidMap.set(cleanPn, `${cleanPn}@s.whatsapp.net`);
              jidMap.set(`+${cleanPn}`, `${cleanPn}@s.whatsapp.net`);
              jidMap.set(lidUser, `${lidUser}@lid`);
              count++;
            }
          }
        } catch (e) {}
      } else if (f.startsWith('lid-mapping-') && f.endsWith('.json') && !f.includes('_reverse')) {
        const pnUser = f.replace('lid-mapping-', '').replace('.json', '');
        try {
          const content = fs.readFileSync(path.join(AUTH_FOLDER, f), 'utf-8');
          const lid = JSON.parse(content);
          if (lid && typeof lid === 'string') {
            const cleanLid = lid.replace(/[^0-9]/g, '');
            const cleanPn = pnUser.replace(/[^0-9]/g, '');
            if (cleanLid && cleanPn) {
              lidToPhoneMap.set(cleanLid, cleanPn);
              jidMap.set(cleanPn, `${cleanPn}@s.whatsapp.net`);
              jidMap.set(`+${cleanPn}`, `${cleanPn}@s.whatsapp.net`);
              jidMap.set(cleanLid, `${cleanLid}@lid`);
              count++;
            }
          }
        } catch (e) {}
      }
    }
    if (count > 0) {
      console.log(`📇 [LID STORE] Preloaded ${count} WhatsApp LID-to-Phone reverse mappings.`);
    }
  } catch (err) {
    console.warn('⚠️ Could not load LID mappings from disk:', err.message);
  }
}

// Initial load on startup
loadAllLidMappingsFromAuthFolder();

async function resolveRealPhoneNumber(rawJid, msg = null) {
  if (!rawJid) return null;
  const digits = rawJid.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/[^0-9]/g, '');

  if (rawJid.endsWith('@s.whatsapp.net')) {
    return digits;
  }

  // 1. Check in-memory map
  if (lidToPhoneMap.has(digits)) {
    return lidToPhoneMap.get(digits);
  }

  // 2. Check message metadata
  if (msg) {
    if (msg.key?.participant && msg.key.participant.endsWith('@s.whatsapp.net')) {
      const p = msg.key.participant.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
      if (p) {
        lidToPhoneMap.set(digits, p);
        return p;
      }
    }
    if (msg.key?.participantPn) {
      const p = String(msg.key.participantPn).replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
      if (p) {
        lidToPhoneMap.set(digits, p);
        return p;
      }
    }
    if (msg.key?.remoteJidAlt && msg.key.remoteJidAlt.endsWith('@s.whatsapp.net')) {
      const p = msg.key.remoteJidAlt.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
      if (p) {
        lidToPhoneMap.set(digits, p);
        return p;
      }
    }
  }

  // 3. Check auth folder on disk
  const reverseFilePath = path.join(AUTH_FOLDER, `lid-mapping-${digits}_reverse.json`);
  if (fs.existsSync(reverseFilePath)) {
    try {
      const content = fs.readFileSync(reverseFilePath, 'utf-8');
      const pn = JSON.parse(content);
      if (pn && typeof pn === 'string') {
        const cleanPn = pn.replace(/[^0-9]/g, '');
        if (cleanPn) {
          lidToPhoneMap.set(digits, cleanPn);
          console.log(`🔗 [DISK RESOLVED] LID ${digits} -> Real Phone: +${cleanPn}`);
          return cleanPn;
        }
      }
    } catch (e) {}
  }

  // 4. Query Baileys Signal lidMapping store
  if (sock?.signalRepository?.lidMapping?.getPNForLID) {
    try {
      const pnJid = await sock.signalRepository.lidMapping.getPNForLID(`${digits}@lid`);
      if (pnJid) {
        const cleanPn = String(pnJid).replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
        if (cleanPn && cleanPn.length >= 7) {
          lidToPhoneMap.set(digits, cleanPn);
          console.log(`🔗 [BAILEYS RESOLVED] LID ${digits} -> Real Phone: +${cleanPn}`);
          return cleanPn;
        }
      }
    } catch (e) {}
  }

  return null;
}

function registerContact(c) {
  if (!c) return;
  const jid = c.id || '';
  const lid = c.lid || (jid.endsWith('@lid') ? jid : '');
  const rawPn = c.phoneNumber || c.phone || c.pn || (jid.endsWith('@s.whatsapp.net') ? jid : '');
  const name = c.name || c.notify || c.verifiedName || '';

  let phone = '';
  let cleanLid = '';

  if (rawPn) {
    phone = String(rawPn).replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
    if (phone) {
      jidMap.set(phone, `${phone}@s.whatsapp.net`);
      jidMap.set(`+${phone}`, `${phone}@s.whatsapp.net`);
    }
  }

  if (lid) {
    cleanLid = String(lid).replace('@lid', '').replace(/[^0-9]/g, '');
    if (cleanLid) {
      jidMap.set(cleanLid, `${cleanLid}@lid`);
      jidMap.set(`+${cleanLid}`, `${cleanLid}@lid`);
    }
  }

  if (cleanLid && phone) {
    lidToPhoneMap.set(cleanLid, phone);
    console.log(`🔗 [LID RESOLVED] Linked LID ${cleanLid} -> Real Phone: +${phone} (${name || 'Contact'})`);
  }

  if (name && name.trim().length > 0 && !name.startsWith('+') && name !== 'WhatsApp Contact') {
    const cleanKey = name.trim().toLowerCase();
    if (phone) {
      phoneToNameMap.set(phone, name);
      nameToPhoneMap.set(cleanKey, phone);
    }
    if (cleanLid) lidToNameMap.set(cleanLid, name);
  }
}

// Helper: Deeply unwrap message content across various WhatsApp wrappers
function unwrapMessageContent(rawMessage) {
  if (!rawMessage) return null;
  let m = rawMessage;
  if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
  if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
  if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
  if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;
  if (m.editedMessage?.message?.protocolMessage?.editedMessage) m = m.editedMessage.message.protocolMessage.editedMessage;
  if (m.templateMessage?.hydratedTemplate) m = m.templateMessage.hydratedTemplate;
  return m;
}

// Unified Core: Process and Persist WhatsApp Message (Idempotent & Multi-Directional)
async function processAndPersistWhatsAppMessage(msg, source = 'live') {
  if (!msg || !msg.message) return null;

  const messageId = msg.key?.id;
  if (!messageId) return null;

  const isFromMe = Boolean(msg.key.fromMe);
  const rawJid = msg.key.remoteJid || '';

  // Ignore group chats, channels, broadcasts, status updates
  if (
    !rawJid ||
    rawJid.endsWith('@g.us') ||
    rawJid.includes('@newsletter') ||
    rawJid.includes('@broadcast') ||
    rawJid.startsWith('120363') ||
    rawJid === 'status@broadcast'
  ) {
    return null;
  }

  const unwrapped = unwrapMessageContent(msg.message) || msg.message;

  // Determine phone number and clean ID
  let senderPhone = rawJid.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/[^0-9]/g, '');
  const isLid = rawJid.endsWith('@lid') || (senderPhone.length >= 13 && (senderPhone.startsWith('1820') || senderPhone.startsWith('1857') || senderPhone.startsWith('2001') || senderPhone.startsWith('1766') || senderPhone.startsWith('1605') || senderPhone.startsWith('1980') || senderPhone.startsWith('2226') || senderPhone.startsWith('2520') || senderPhone.startsWith('7328') || senderPhone.startsWith('9304') || senderPhone.startsWith('2304') || senderPhone.startsWith('5218')));
  
  let realPhone = await resolveRealPhoneNumber(rawJid, msg);

  // Determine Customer Display Name
  let contactName = null;
  if (!isFromMe) {
    contactName = (msg.pushName && !msg.pushName.startsWith('+') && msg.pushName.trim().length > 0) ? msg.pushName : null;
  }
  if (!contactName && realPhone && phoneToNameMap.has(realPhone)) {
    contactName = phoneToNameMap.get(realPhone);
  }
  if (!contactName && lidToNameMap.has(senderPhone)) {
    contactName = lidToNameMap.get(senderPhone);
  }

  // Cross-reference by name to find phone number if LID did not provide one directly
  if (!realPhone && contactName && nameToPhoneMap.has(contactName.trim().toLowerCase())) {
    realPhone = nameToPhoneMap.get(contactName.trim().toLowerCase());
    if (realPhone) {
      lidToPhoneMap.set(senderPhone, realPhone);
      console.log(`🔗 [AUTO-MATCHED BY NAME] Linked LID ${senderPhone} -> Real Phone: +${realPhone} (${contactName})`);
    }
  }

  const effectivePhone = realPhone || senderPhone;
  const canonicalPhone = realPhone ? (realPhone.startsWith('+') ? realPhone : `+${realPhone}`) : (isLid ? '' : `+${senderPhone}`);

  // Original timestamp from WhatsApp message (seconds -> ms), fallback to current date
  const rawTimestamp = msg.messageTimestamp;
  const timestampDate = rawTimestamp
    ? new Date(typeof rawTimestamp === 'number' ? rawTimestamp * 1000 : (Number(rawTimestamp) * 1000 || Date.now()))
    : new Date();
  const timestampIso = timestampDate.toISOString();

  // Debug event logging
  console.log(`\n================== [WA EVENT] ==================`);
  console.log(`Source: ${source}`);
  console.log(`Message ID: ${messageId}`);
  console.log(`Direction: ${isFromMe ? 'OUTBOUND (Staff Phone/CRM)' : 'INBOUND (Customer)'}`);
  console.log(`Remote JID: ${rawJid}`);
  console.log(`Phone: ${canonicalPhone || effectivePhone} (Effective: ${effectivePhone})`);
  console.log(`Push Name: ${msg.pushName || 'N/A'}`);
  console.log(`Timestamp: ${timestampIso}`);
  console.log(`Message Types: ${Object.keys(unwrapped).join(', ')}`);
  console.log(`================================================`);

  // Check for Reaction message
  if (unwrapped.reactionMessage) {
    const reaction = unwrapped.reactionMessage;
    const targetMessageId = reaction.key?.id;
    const emoji = reaction.text || '';

    console.log(`❤️ [WHATSAPP REACTION] ${contactName || msg.pushName || 'User'} reacted "${emoji}" to message ${targetMessageId}`);

    broadcastSSE({
      type: 'INBOUND_REACTION',
      phone: canonicalPhone,
      targetMessageId: targetMessageId,
      emoji: emoji,
      timestamp: timestampIso
    });

    const prisma = getPrisma();
    if (prisma && getDbStatus() && targetMessageId) {
      await prisma.message.update({
        where: { id: targetMessageId },
        data: { reaction: emoji },
      }).catch(() => {});
    }
    return { isNew: false, targetMessageId, reaction: emoji };
  }

  // Extract text and media
  let mediaType = null;
  let mediaUrl = null;
  let fileName = null;

  if (unwrapped.imageMessage) {
    mediaType = 'image';
  } else if (unwrapped.videoMessage) {
    mediaType = 'video';
  } else if (unwrapped.documentMessage) {
    mediaType = 'document';
    fileName = unwrapped.documentMessage.fileName || 'document.pdf';
  } else if (unwrapped.audioMessage) {
    mediaType = 'audio';
  }

  // Attempt media download if present and live
  if (mediaType && sock && (source === 'live' || source === 'catch_up')) {
    try {
      const buffer = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        {
          logger: pino({ level: 'silent' }),
          reuploadRequest: sock.updateMediaMessage
        }
      );
      if (buffer && buffer.length > 0) {
        const ext = mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'ogg' : (fileName ? path.extname(fileName).replace('.', '') || 'pdf' : 'pdf');
        const safeName = `media_${messageId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.${ext}`;
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(uploadsDir, safeName), buffer);
        mediaUrl = `http://localhost:3001/uploads/${safeName}`;
      }
    } catch (e) {
      // Gracefully fallback
    }
  }

  const messageText =
    unwrapped.conversation ||
    unwrapped.extendedTextMessage?.text ||
    unwrapped.imageMessage?.caption ||
    unwrapped.videoMessage?.caption ||
    unwrapped.documentMessage?.caption ||
    unwrapped.templateButtonReplyMessage?.selectedDisplayText ||
    unwrapped.buttonsResponseMessage?.selectedButtonId ||
    unwrapped.listResponseMessage?.title ||
    unwrapped.interactiveResponseMessage?.body?.text ||
    (mediaType ? (mediaType === 'image' ? 'Photo' : mediaType === 'video' ? 'Video' : mediaType === 'audio' ? 'Voice note' : 'Document') : '');

  // Filter out internal protocol/status messages that have no text or media
  const hasContent = (messageText && messageText.trim().length > 0) || Boolean(mediaType);
  if (!hasContent) {
    return null;
  }

  // Database Persistence (MySQL)
  const prisma = getPrisma();
  let lead = null;
  let customer = null;
  let isNew = true;

  if (prisma && getDbStatus()) {
    try {
      // 1. Find or Upsert Customer (Search flexibly across phone formats, LIDs, and push names)
      const candidatePhones = [canonicalPhone, effectivePhone, realPhone].filter(Boolean).map(p => p.startsWith('+') ? p : `+${p}`);
      const candidateWaIds = [effectivePhone, senderPhone].filter(Boolean);

      customer = await prisma.customer.findFirst({
        where: {
          OR: [
            ...candidatePhones.map(p => ({ whatsappNumber: p })),
            ...candidateWaIds.map(w => ({ whatsappId: w })),
            ...candidateWaIds.map(w => ({ whatsappNumber: `+${w}` })),
            ...(!isFromMe && contactName && !contactName.startsWith('+') && contactName !== 'WhatsApp Contact' && contactName !== 'You (Staff)' ? [{ displayName: contactName }] : [])
          ]
        }
      });

      const resolvedCustomerName = contactName || (customer ? customer.displayName : null) || (realPhone ? `+${realPhone}` : 'WhatsApp Contact');

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            whatsappNumber: canonicalPhone || `+${senderPhone}`,
            whatsappId: senderPhone,
            displayName: resolvedCustomerName,
            preferredLanguage: 'en',
          }
        });
        console.log(`[CRM SYNC] New customer created: ${customer.displayName} (${customer.whatsappNumber}) [ID: ${customer.id}]`);
      } else {
        const updateData = {};
        if (realPhone && (!customer.whatsappNumber || customer.whatsappNumber.length > 15 || customer.whatsappNumber.startsWith('+1820') || customer.whatsappNumber.startsWith('+2001') || customer.whatsappNumber.startsWith('+1980') || customer.whatsappNumber.startsWith('+2226') || customer.whatsappNumber.startsWith('+2520') || customer.whatsappNumber.startsWith('+7328') || customer.whatsappNumber.startsWith('+1766'))) {
          updateData.whatsappNumber = realPhone.startsWith('+') ? realPhone : `+${realPhone}`;
        }
        if (senderPhone && !customer.whatsappId) {
          updateData.whatsappId = senderPhone;
        }
        if (!isFromMe && contactName && (!customer.displayName || customer.displayName.startsWith('+') || customer.displayName === 'WhatsApp Contact')) {
          updateData.displayName = contactName;
        }
        if (Object.keys(updateData).length > 0) {
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: updateData
          }).catch(() => customer);
        }
      }

      // 2. Find or Create Lead (Always 1 primary lead per customer)
      lead = await prisma.lead.findFirst({
        where: { customerId: customer.id },
        orderBy: { updatedAt: 'desc' },
      });

      if (!lead) {
        const firstCategory = await prisma.treatmentCategory.findFirst();
        const firstTreatment = await prisma.treatment.findFirst();

        lead = await prisma.lead.create({
          data: {
            customerId: customer.id,
            categoryId: firstCategory ? firstCategory.id : 'cat-hair-care',
            treatmentId: firstTreatment ? firstTreatment.id : 'trt-hair-prp',
            stage: isFromMe ? 'contacted' : 'new',
            source: 'whatsapp',
            language: 'en',
            lastCustomerMessageAt: timestampDate,
          },
        });
        console.log(`[CRM SYNC] New conversation lead created: Lead ID ${lead.id} for Customer ${customer.displayName}`);
      } else {
        // Always update lastCustomerMessageAt and updatedAt
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            lastCustomerMessageAt: timestampDate,
            updatedAt: new Date()
          },
        });
      }

      // 3. Check if message already exists in DB
      const existing = await prisma.message.findUnique({
        where: { id: messageId }
      });

      if (existing) {
        isNew = false;
        console.log(`[CRM SYNC] Duplicate skipped: Message ${messageId} already stored in DB.`);
        if (mediaUrl && !existing.mediaUrl) {
          await prisma.message.update({
            where: { id: messageId },
            data: { mediaUrl, mediaType }
          }).catch(() => {});
        }
      } else {
        // Insert message
        await prisma.message.create({
          data: {
            id: messageId,
            leadId: lead.id,
            customerId: customer.id,
            direction: isFromMe ? 'outbound' : 'inbound',
            senderType: isFromMe ? 'coordinator' : 'customer',
            content: messageText || (mediaType ? `[${mediaType.toUpperCase()}]` : ''),
            status: isFromMe ? 'sent' : 'delivered',
            timestamp: timestampDate,
            mediaUrl: mediaUrl || null,
            mediaType: mediaType || null,
          },
        });
        console.log(`[CRM SYNC] Database insert success: Message ${messageId} saved to Lead ${lead.id} (${isFromMe ? 'Staff Phone Outbound' : 'Customer Inbound'}).`);
      }
    } catch (err) {
      console.warn(`⚠️ [MySQL Sync Error]:`, err.message);
    }
  }

  // Structured Logging
  const finalDisplayName = customer ? customer.displayName : (contactName || (realPhone ? `+${realPhone}` : 'WhatsApp Contact'));
  const finalDisplayPhone = realPhone ? (realPhone.startsWith('+') ? realPhone : `+${realPhone}`) : (customer?.whatsappNumber || (isLid ? '' : `+${senderPhone}`));

  if (source === 'history_sync') {
    // Suppress individual logs during bulk sync
  } else if (isFromMe) {
    console.log(`📱 [PHONE OUTBOUND] Staff replied to ${finalDisplayName} (${finalDisplayPhone || senderPhone}): "${messageText}" [ID: ${messageId}]`);
  } else {
    console.log(`💬 [WHATSAPP INBOUND] ${finalDisplayName} (${finalDisplayPhone || senderPhone}): "${messageText}" [ID: ${messageId}]`);
  }

  // Real-time broadcast to all connected frontend clients
  const messagePayload = {
    type: isFromMe ? 'OUTBOUND_WHATSAPP_MESSAGE' : 'INBOUND_WHATSAPP_MESSAGE',
    phone: finalDisplayPhone || customer?.whatsappNumber || senderPhone,
    whatsappId: senderPhone,
    realPhone: finalDisplayPhone || customer?.whatsappNumber || '',
    name: finalDisplayName,
    text: messageText || (mediaType ? `[${mediaType.toUpperCase()}]` : ''),
    messageId: messageId,
    timestamp: timestampIso,
    direction: isFromMe ? 'outbound' : 'inbound',
    senderType: isFromMe ? 'coordinator' : 'customer',
    leadId: lead?.id,
    customerId: customer?.id,
    source: source,
    isNew: isNew,
    media: mediaUrl ? {
      type: mediaType,
      url: mediaUrl,
      caption: messageText,
      fileName: fileName
    } : undefined
  };

  broadcastSSE(messagePayload);
  console.log(`[CRM SYNC] Frontend SSE broadcast sent for ${messageId} (${messagePayload.type}).`);

  // Auto-Reply Concierge Intake Funnel Dispatch
  if (!isFromMe && source === 'live' && sock && (messageText || mediaType)) {
    setTimeout(async () => {
      try {
        const autoReply = await evaluateAutoReply({
          senderPhone: effectivePhone || realPhone || senderPhone,
          messageText: messageText || '',
          customer: customer,
          lead: lead
        });

        if (autoReply && autoReply.shouldReply && autoReply.replyText) {
          const targetJid = rawJid || jidMap.get(senderPhone) || (isLid ? `${senderPhone}@lid` : `${senderPhone}@s.whatsapp.net`);
          console.log(`🤖 [AUTO-REPLY TRIGGER] Sending auto-reply to JID: ${targetJid}...`);
          
          // Realistic typing simulation on WhatsApp
          try {
            await sock.sendPresenceUpdate('composing', targetJid);
          } catch (e) {}

          await new Promise(r => setTimeout(r, 1200));

          const sent = await sock.sendMessage(targetJid, { text: autoReply.replyText });
          const replyId = sent?.key?.id || `bot-${Date.now()}`;

          if (replyId) {
            processedMessageIds.add(replyId);
          }

          // Persist bot reply in Supabase PostgreSQL
          persistOutboundMessage({
            leadId: lead?.id,
            customerId: customer?.id,
            content: autoReply.replyText,
            messageId: replyId,
            senderType: 'system',
            mediaUrl: null,
            mediaType: null
          });

          // Broadcast to CRM screen in real time
          broadcastSSE({
            type: 'OUTBOUND_WHATSAPP_MESSAGE',
            phone: finalDisplayPhone || customer?.whatsappNumber || senderPhone,
            whatsappId: senderPhone,
            realPhone: finalDisplayPhone || customer?.whatsappNumber || '',
            name: 'Royal Wellness Concierge (Auto-Reply)',
            text: autoReply.replyText,
            messageId: replyId,
            timestamp: new Date().toISOString(),
            direction: 'outbound',
            senderType: 'system',
            leadId: lead?.id,
            customerId: customer?.id,
            source: 'auto_reply'
          });

          console.log(`🤖 [CONCIERGE BOT DISPATCH] Sent auto-reply to ${finalDisplayName} [Msg ID: ${replyId}]`);
        }
      } catch (botErr) {
        console.warn('⚠️ Auto-reply dispatch error:', botErr.message);
      }
    }, 600);
  } else if (isFromMe) {
    // If staff/coordinator replied manually, pause bot for this customer
    pauseAutoReply(effectivePhone || realPhone || senderPhone);
  }

  return { isNew, leadId: lead?.id, customerId: customer?.id, messageId };
}

// Helper: Save Outbound Message to MySQL (for CRM web client outbound)
async function persistOutboundMessage({ leadId, customerId, content, messageId, senderType, mediaUrl, mediaType }) {
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) return;

  try {
    if (!leadId || !messageId) return;

    await prisma.message.upsert({
      where: { id: messageId },
      update: {
        content: content || '',
        status: 'sent',
        mediaUrl: mediaUrl || undefined,
        mediaType: mediaType || undefined,
      },
      create: {
        id: messageId,
        leadId: leadId,
        customerId: customerId || 'cust-unknown',
        direction: 'outbound',
        senderType: senderType || 'coordinator',
        content: content || '',
        status: 'sent',
        timestamp: new Date(),
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
      },
    });
  } catch (err) {
    console.warn('⚠️ [MySQL Persistence Error - Outbound]:', err.message);
  }
}

let socketInstanceCounter = 0;
let syncSafetyTimeout = null;
let isStartingSocket = false;
let reconnectTimer = null;

async function startWhatsAppSocket(forceClean = false) {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (isStartingSocket) {
    return;
  }
  isStartingSocket = true;

  try {
    // Always cleanly terminate previous socket and listeners
    if (sock) {
      try {
        sock.ev.removeAllListeners();
        sock.end(undefined);
      } catch (e) {}
      sock = null;
    }

    if (forceClean) {
      try {
        if (fs.existsSync(AUTH_FOLDER)) {
          fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        }
      } catch (e) {}
    }

    const instanceId = ++socketInstanceCounter;
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    const logger = pino({ level: 'silent' });

    console.log(`\n[WA SOCKET] Created new socket instance #${instanceId} (Baileys v${version.join('.')}, isLatest: ${isLatest})`);
    if (connectionState !== 'connected') {
      setConnectionState('connecting');
    }

    sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: true,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false, // Prevent socket timeouts on large historical syncs
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      // Guard against events from stale/superseded socket instances
      if (instanceId !== socketInstanceCounter) {
        return;
      }

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n📸 New WhatsApp QR Code generated! Ready to scan on screen.');
        currentQrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 }).catch(() => null);
        setConnectionState('qr_ready', { qrDataUrl: currentQrDataUrl });
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isRestartRequired = statusCode === DisconnectReason.restartRequired; // 515
        const isLoggedOut = statusCode === DisconnectReason.loggedOut; // 401
        
        console.log(`⚠️ [WA SOCKET #${instanceId}] Connection closed. StatusCode: ${statusCode} (${isRestartRequired ? 'Pairing Handshake Restart' : isLoggedOut ? 'Logged Out' : 'Temporary Disconnect'})`);

        if (isRestartRequired) {
          // Handshake after QR scan: Baileys must restart immediately with the saved auth credentials. DO NOT clear auth folder!
          console.log('🔄 QR code successfully scanned on phone! Completing device pairing handshake...');
          setConnectionState('connecting', { message: 'Pairing device...' });
          reconnectTimer = setTimeout(() => startWhatsAppSocket(false), 500);
        } else if (isLoggedOut) {
          console.log('🔒 Logged out from WhatsApp session. Clearing auth and generating fresh QR code for next scan...');
          connectedPhoneNumber = null;
          currentQrDataUrl = null;
          setConnectionState('disconnected', { phone: null });
          try {
            if (fs.existsSync(AUTH_FOLDER)) {
              fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
            }
          } catch (e) {}
          reconnectTimer = setTimeout(() => startWhatsAppSocket(false), 1500);
        } else {
          // Temporary drop / network timeout / stream error
          console.log(`🔄 WhatsApp temporary reconnect (code: ${statusCode}). Reconnecting with existing auth in 2s...`);
          setConnectionState('connecting');
          reconnectTimer = setTimeout(() => startWhatsAppSocket(false), 2000);
        }
      } else if (connection === 'open') {
        const rawUser = sock?.user?.id || '';
        connectedPhoneNumber = rawUser.split(':')[0].replace(/[^0-9]/g, '');
        currentQrDataUrl = null;
        
        console.log(`\n🎉 [WA SOCKET #${instanceId}] WhatsApp Linked Successfully! Phone: +${connectedPhoneNumber}`);
        setConnectionState('connected', {
          phone: connectedPhoneNumber,
          name: sock?.user?.name || 'Royal Wellness Center'
        });
      }
    });

  sock.ev.on('contacts.set', ({ contacts }) => {
    if (Array.isArray(contacts)) {
      contacts.forEach(registerContact);
      console.log(`📇 Synced ${contacts.length} WhatsApp contacts automatically.`);
    }
  });

  sock.ev.on('contacts.upsert', (contacts) => {
    if (Array.isArray(contacts)) {
      contacts.forEach(registerContact);
    }
  });

  sock.ev.on('contacts.update', (contacts) => {
    if (Array.isArray(contacts)) {
      contacts.forEach(registerContact);
    }
  });

  // History Sync Event (Multi-device conversation history)
  sock.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }) => {
    console.log(`\n⏳ [SYNC STARTED] WhatsApp multi-device history set received: ${contacts?.length || 0} contacts, ${chats?.length || 0} chats, ${messages?.length || 0} messages (isLatest: ${isLatest}).`);
    
    if (Array.isArray(contacts)) {
      contacts.forEach(registerContact);
    }

    let found = messages?.length || 0;
    let inserted = 0;
    let skipped = 0;
    let updatedConversations = new Set();

    if (Array.isArray(messages) && messages.length > 0) {
      for (const msg of messages) {
        try {
          const res = await processAndPersistWhatsAppMessage(msg, 'history_sync');
          if (res) {
            if (res.isNew) inserted++;
            else skipped++;
            if (res.leadId) updatedConversations.add(res.leadId);
          }
        } catch (e) {
          // ignore individual sync errors
        }
      }
    }

    console.log(`✅ [SYNC COMPLETED] Full synchronization finished: Total messages found: ${found}, Inserted: ${inserted}, Skipped (duplicates): ${skipped}, Conversations updated: ${updatedConversations.size}.`);
    
    broadcastSSE({
      type: 'HISTORY_SYNC_COMPLETED',
      count: inserted,
      stats: {
        found,
        inserted,
        skipped,
        conversationsUpdated: updatedConversations.size
      }
    });

    if (syncSafetyTimeout) clearTimeout(syncSafetyTimeout);
    setConnectionState('connected', {
      phone: connectedPhoneNumber,
      syncStats: { found, inserted, skipped, conversationsUpdated: updatedConversations.size }
    });
  });

  // Listen for chat deletion from physical phone
  sock.ev.on('chats.delete', async (deletedJids) => {
    console.log(`🗑️ [WA EVENT] chats.delete fired from phone:`, deletedJids);
    if (!Array.isArray(deletedJids)) return;

    for (const rawJid of deletedJids) {
      try {
        const cleanDigits = rawJid.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/[^0-9]/g, '');
        const realPhone = lidToPhoneMap.get(cleanDigits) || cleanDigits;
        const canonicalPhone = realPhone.startsWith('+') ? realPhone : `+${realPhone}`;

        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          const cust = await prisma.customer.findFirst({
            where: {
              OR: [
                { whatsappNumber: canonicalPhone },
                { whatsappNumber: realPhone },
                { whatsappId: cleanDigits },
                { whatsappId: realPhone }
              ]
            },
            include: { leads: true }
          });

          if (cust) {
            for (const l of cust.leads) {
              await prisma.message.deleteMany({ where: { leadId: l.id } }).catch(() => {});
              await prisma.leadNote.deleteMany({ where: { leadId: l.id } }).catch(() => {});
              await prisma.followup.deleteMany({ where: { leadId: l.id } }).catch(() => {});
              await prisma.leadStageHistory.deleteMany({ where: { leadId: l.id } }).catch(() => {});
              await prisma.lead.delete({ where: { id: l.id } }).catch(() => {});
            }
            await prisma.customer.delete({ where: { id: cust.id } }).catch(() => {});
            console.log(`🗑️ [PHONE CHAT DELETED] Customer ${cust.displayName} (${cust.whatsappNumber}) and leads removed.`);

            broadcastSSE({
              type: 'CHAT_DELETED',
              customerId: cust.id,
              phone: cust.whatsappNumber,
              whatsappId: cust.whatsappId
            });
          }
        }
      } catch (err) {
        console.warn('Error handling phone chats.delete:', err.message);
      }
    }
  });

  // Listen for message deletion/revocation from physical phone
  sock.ev.on('messages.delete', async (item) => {
    console.log(`🗑️ [WA EVENT] messages.delete fired:`, item);
    const keys = item?.keys || (Array.isArray(item) ? item : [item]);
    const prisma = getPrisma();
    for (const k of keys) {
      const msgId = k?.id;
      if (msgId) {
        if (prisma && getDbStatus()) {
          await prisma.message.delete({ where: { id: msgId } }).catch(() => {});
        }
        broadcastSSE({ type: 'MESSAGE_DELETED', messageId: msgId });
      }
    }
  });

  // Register messages.upsert listener on the active socket
  console.log(`[WA SOCKET #${instanceId}] Registering messages.upsert listener`);
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (instanceId !== socketInstanceCounter) {
      return;
    }
    console.log(`\n================== [WA DEBUG] messages.upsert FIRED ==================`);
    console.log(`type: ${type}`);
    console.log(`message count: ${messages?.length || 0}`);

    const isCatchUp = type === 'append';
    for (const msg of messages) {
      const messageId = msg.key?.id;
      const unwrapped = unwrapMessageContent(msg.message) || msg.message || {};

      console.log(`\n[WA DEBUG MESSAGE METADATA]`);
      console.log(`messageId: ${messageId}`);
      console.log(`remoteJid: ${msg.key?.remoteJid}`);
      console.log(`participant: ${msg.key?.participant || 'N/A'}`);
      console.log(`fromMe: ${Boolean(msg.key?.fromMe)}`);
      console.log(`pushName: ${msg.pushName || 'N/A'}`);
      console.log(`messageTimestamp: ${msg.messageTimestamp}`);
      console.log(`messageType: ${Object.keys(unwrapped).join(', ')}`);
      console.log(`hasMessage: ${Boolean(msg.message)}`);
      console.log(`hasConversation: ${Boolean(unwrapped.conversation)}`);
      console.log(`hasExtendedText: ${Boolean(unwrapped.extendedTextMessage)}`);
      console.log(`hasEphemeral: ${Boolean(msg.message?.ephemeralMessage)}`);
      console.log(`hasViewOnce: ${Boolean(msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2)}`);

      if (!messageId) continue;

      if (processedMessageIds.has(messageId)) {
        console.log(`[WA DEBUG] In-memory duplicate skipped for message ${messageId}`);
        continue;
      }
      processedMessageIds.add(messageId);
      if (processedMessageIds.size > 1000) {
        const first = processedMessageIds.values().next().value;
        processedMessageIds.delete(first);
      }

      await processAndPersistWhatsAppMessage(msg, isCatchUp ? 'catch_up' : 'live');
    }
    console.log(`=======================================================================\n`);
  });
  } catch (err) {
    console.error('⚠️ [WA SOCKET START ERROR]:', err);
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => startWhatsAppSocket(false), 3000);
    }
  } finally {
    isStartingSocket = false;
  }
}

// Start HTTP REST & SSE Gateway Server
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 0. Static Uploads File Serving
  if (pathname.startsWith('/uploads/')) {
    const filename = path.basename(pathname);
    const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogg': 'audio/ogg',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.pdf': 'application/pdf',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return;
    }
  }

  // 1. Health & Status
  if (req.method === 'GET' && pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: connectionState,
      phone: connectedPhoneNumber,
      hasQr: !!currentQrDataUrl,
      db: {
        connected: getDbStatus(),
      }
    }));
    return;
  }

  // 2. Database Status Check
  if (req.method === 'GET' && pathname === '/api/db/status') {
    const dbRes = await checkDbConnection();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(dbRes));
    return;
  }

  // 3. QR Code Endpoint (Read-only, never deletes auth credentials)
  if (req.method === 'GET' && pathname === '/api/qr') {
    if ((connectionState === 'disconnected' || !sock) && !currentQrDataUrl && !isStartingSocket) {
      startWhatsAppSocket(false);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      qr: currentQrDataUrl,
      status: connectionState,
      phone: connectedPhoneNumber
    }));
    return;
  }

  // 3b. Reconnect / Force New QR Endpoint
  if (req.method === 'POST' && (pathname === '/api/reconnect' || pathname === '/api/connect')) {
    console.log('🔄 Manual reconnect requested. Resetting socket auth and generating fresh QR...');
    currentQrDataUrl = null;
    startWhatsAppSocket(true);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Reconnection initiated.' }));
    return;
  }

  // 4. Server-Sent Events (SSE) Live Feed
  if (req.method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    res.write(`data: ${JSON.stringify({
      type: 'INIT',
      status: connectionState,
      phone: connectedPhoneNumber,
      qrDataUrl: currentQrDataUrl,
      dbConnected: getDbStatus(),
    })}\n\n`);

    sseClients.push(res);

    req.on('close', () => {
      sseClients = sseClients.filter(client => client !== res);
    });
    return;
  }

  // 5. Send Outbound WhatsApp Message & Media
  if (req.method === 'POST' && (pathname === '/api/send' || pathname === '/api/send-message')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const to = payload.to || payload.phone || '';
        const whatsappId = payload.whatsappId || payload.waId || '';
        const msgContent = payload.message || payload.text || payload.content || '';
        const media = payload.media; // { type, url, dataUrl, fileName, caption }
        const leadId = payload.leadId;
        const customerId = payload.customerId;

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

        if (connectionState !== 'connected' || !sock) {
          console.warn(`⛔ [CRM SEND BLOCKED] Attempted to send WhatsApp message while state is "${connectionState}".`);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            error: 'Please link your WhatsApp first to send messages from the CRM.',
            status: connectionState
          }));
          return;
        }

        const cleanPhone = to.replace(/[^0-9]/g, '');
        const cleanWaId = whatsappId.replace(/[^0-9]/g, '');

        // Resolve JID in priority order
        let targetJid = null;
        if (cleanWaId && jidMap.has(cleanWaId)) targetJid = jidMap.get(cleanWaId);
        if (!targetJid && cleanPhone && jidMap.has(cleanPhone)) targetJid = jidMap.get(cleanPhone);
        if (!targetJid && cleanWaId && jidMap.has(`+${cleanWaId}`)) targetJid = jidMap.get(`+${cleanWaId}`);
        if (!targetJid && cleanPhone && jidMap.has(`+${cleanPhone}`)) targetJid = jidMap.get(`+${cleanPhone}`);

        // Fallback resolution
        if (!targetJid) {
          if (cleanWaId && cleanWaId.length > 15) {
            targetJid = `${cleanWaId}@lid`;
          } else if (cleanPhone) {
            targetJid = `${cleanPhone}@s.whatsapp.net`;
          } else if (cleanWaId) {
            targetJid = `${cleanWaId}@s.whatsapp.net`;
          }
        }

        console.log(`📤 Sending outbound WhatsApp to JID: ${targetJid} (Recipient: "${to}", WA ID: "${whatsappId}")...`);
        
        let sentMsg;
        let savedMediaUrl = media ? media.url : null;
        let mediaBuffer = null;

        // Process base64 / dataUrl if provided
        if (media && (media.dataUrl || (media.url && media.url.startsWith('data:')))) {
          const rawData = media.dataUrl || media.url;
          const matches = rawData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            mediaBuffer = Buffer.from(matches[2], 'base64');
            const ext = media.type === 'image' ? 'jpg' : media.type === 'video' ? 'mp4' : media.type === 'audio' ? 'ogg' : 'pdf';
            const safeName = `out_${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`;
            const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }
            fs.writeFileSync(path.join(uploadsDir, safeName), mediaBuffer);
            savedMediaUrl = `http://localhost:3001/uploads/${safeName}`;
          }
        }

        if (media && media.type === 'image') {
          sentMsg = await sock.sendMessage(targetJid, {
            image: mediaBuffer || { url: savedMediaUrl },
            caption: msgContent || media.caption || ''
          });
        } else if (media && media.type === 'video') {
          sentMsg = await sock.sendMessage(targetJid, {
            video: mediaBuffer || { url: savedMediaUrl },
            caption: msgContent || media.caption || ''
          });
        } else if (media && media.type === 'document') {
          sentMsg = await sock.sendMessage(targetJid, {
            document: mediaBuffer || { url: savedMediaUrl },
            mimetype: media.mimetype || 'application/pdf',
            fileName: media.fileName || 'document.pdf',
            caption: msgContent || media.caption || ''
          });
        } else if (media && media.type === 'audio') {
          sentMsg = await sock.sendMessage(targetJid, {
            audio: mediaBuffer || { url: savedMediaUrl },
            ptt: true
          });
        } else {
          sentMsg = await sock.sendMessage(targetJid, { text: msgContent });
        }

        const outboundMsgId = sentMsg?.key?.id || `out-${Date.now()}`;
        console.log(`✅ WhatsApp Outbound Delivered! Msg ID: ${outboundMsgId}`);

        if (outboundMsgId) {
          processedMessageIds.add(outboundMsgId);
          if (processedMessageIds.size > 1000) {
            const first = processedMessageIds.values().next().value;
            processedMessageIds.delete(first);
          }
        }

        // Save outbound message to Supabase
        persistOutboundMessage({
          leadId,
          customerId,
          content: msgContent || (media ? `[${media.type.toUpperCase()}]` : ''),
          messageId: outboundMsgId,
          senderType: 'coordinator',
          mediaUrl: savedMediaUrl,
          mediaType: media ? media.type : null,
        });

        // Pause auto-reply bot for this customer so coordinator has full human control
        pauseAutoReply(to || whatsappId);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          messageId: outboundMsgId,
          status: 'sent',
          to: to,
          mediaUrl: savedMediaUrl
        }));
      } catch (err) {
        console.error('❌ Error sending WhatsApp message:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 5b. Delete Entire Chat from CRM & Physical WhatsApp Phone
  if (req.method === 'POST' && (pathname === '/api/chats/delete' || pathname === '/api/leads/delete')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const leadId = payload.leadId;
        const customerId = payload.customerId;
        const phone = payload.phone || payload.to || '';
        const whatsappId = payload.whatsappId || '';

        console.log(`🗑️ [CRM ACTION] Deleting chat for Lead: "${leadId}", Customer: "${customerId}", Phone: "${phone}"...`);

        // 1. Delete chat on WhatsApp Multi-Device / Physical Phone if connected
        const cleanWaId = String(whatsappId).replace(/[^0-9]/g, '');
        const cleanPhone = String(phone).replace(/[^0-9]/g, '');
        let targetJid = null;
        if (cleanWaId && jidMap.has(cleanWaId)) targetJid = jidMap.get(cleanWaId);
        if (!targetJid && cleanPhone && jidMap.has(cleanPhone)) targetJid = jidMap.get(cleanPhone);
        if (!targetJid && cleanWaId && jidMap.has(`+${cleanWaId}`)) targetJid = jidMap.get(`+${cleanWaId}`);
        if (!targetJid && cleanPhone && jidMap.has(`+${cleanPhone}`)) targetJid = jidMap.get(`+${cleanPhone}`);
        if (!targetJid) {
          if (cleanWaId && cleanWaId.length > 15) targetJid = `${cleanWaId}@lid`;
          else if (cleanPhone) targetJid = `${cleanPhone}@s.whatsapp.net`;
          else if (cleanWaId) targetJid = `${cleanWaId}@s.whatsapp.net`;
        }

        if (sock && targetJid) {
          try {
            await sock.chatModify({ delete: true, lastMessages: [] }, targetJid);
            console.log(`📱 [WA SYNC] Chat delete instruction sent to WhatsApp for JID: ${targetJid}`);
          } catch (e) {
            console.warn(`⚠️ Could not sync chat delete to WhatsApp:`, e.message);
          }
        }

        // 2. Delete from MySQL Database
        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          if (leadId) {
            await prisma.message.deleteMany({ where: { leadId } }).catch(() => {});
            await prisma.leadNote.deleteMany({ where: { leadId } }).catch(() => {});
            await prisma.followup.deleteMany({ where: { leadId } }).catch(() => {});
            await prisma.leadStageHistory.deleteMany({ where: { leadId } }).catch(() => {});
            await prisma.lead.delete({ where: { id: leadId } }).catch(() => {});
          }
          if (customerId) {
            const otherLeads = await prisma.lead.count({ where: { customerId } });
            if (otherLeads === 0) {
              await prisma.message.deleteMany({ where: { customerId } }).catch(() => {});
              await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
            }
          }
          console.log(`📦 [MySQL] Lead ${leadId} and messages successfully removed from DB.`);
        }

        // 3. Broadcast Real-Time SSE to all CRM tabs
        broadcastSSE({
          type: 'CHAT_DELETED',
          leadId,
          customerId,
          phone,
          whatsappId
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Chat deleted from CRM and WhatsApp.' }));
      } catch (err) {
        console.error('❌ Error deleting chat:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 5c. Clear Chat Messages from CRM & Physical WhatsApp Phone
  if (req.method === 'POST' && pathname === '/api/chats/clear') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const leadId = payload.leadId;
        const customerId = payload.customerId;
        const phone = payload.phone || '';
        const whatsappId = payload.whatsappId || '';

        const cleanWaId = String(whatsappId).replace(/[^0-9]/g, '');
        const cleanPhone = String(phone).replace(/[^0-9]/g, '');
        let targetJid = null;
        if (cleanWaId && jidMap.has(cleanWaId)) targetJid = jidMap.get(cleanWaId);
        if (!targetJid && cleanPhone && jidMap.has(cleanPhone)) targetJid = jidMap.get(cleanPhone);
        if (!targetJid && cleanWaId && cleanWaId.length > 15) targetJid = `${cleanWaId}@lid`;
        else if (!targetJid && cleanPhone) targetJid = `${cleanPhone}@s.whatsapp.net`;

        if (sock && targetJid) {
          try {
            await sock.chatModify({ clear: { messages: [] } }, targetJid);
          } catch (e) {}
        }

        const prisma = getPrisma();
        if (prisma && getDbStatus() && leadId) {
          await prisma.message.deleteMany({ where: { leadId } }).catch(() => {});
        }

        broadcastSSE({
          type: 'CHAT_CLEARED',
          leadId,
          customerId
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Chat cleared.' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 6. Disconnect / Logout / Unlink (Preserves Database History)
  if (req.method === 'POST' && (pathname === '/api/disconnect' || pathname === '/api/logout' || pathname === '/api/unlink')) {
    console.log('🔄 [WHATSAPP DISCONNECT] Coordinator unlinked WhatsApp from CRM (Conversation history preserved)...');
    try {
      if (syncSafetyTimeout) clearTimeout(syncSafetyTimeout);
      if (sock) {
        try {
          await sock.logout();
        } catch (e) {
          try { sock.end(new Error('Coordinator unlinked session')); } catch (e2) {}
        }
        sock = null;
      }

      // Clean up auth session files so QR can be scanned afresh
      if (fs.existsSync(AUTH_FOLDER)) {
        try {
          fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        } catch (e) {
          console.warn('⚠️ Could not remove auth folder immediately:', e.message);
        }
      }

      connectedPhoneNumber = null;
      currentQrDataUrl = null;
      jidMap.clear();

      setConnectionState('disconnected', { phone: null });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        status: 'disconnected',
        message: 'Unlinked successfully. CRM conversation history preserved in database.' 
      }));

      setTimeout(() => {
        startWhatsAppSocket().catch(err => {
          console.error('Failed to restart WhatsApp socket after unlink:', err);
        });
      }, 1000);
    } catch (err) {
      console.error('❌ Error during disconnect:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 6b. Clear All Database Data (Explicit Admin Action)
  if (req.method === 'POST' && pathname === '/api/clear-db') {
    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        await prisma.message.deleteMany({});
        await prisma.leadNote.deleteMany({});
        await prisma.leadStageHistory.deleteMany({});
        await prisma.followup.deleteMany({});
        await prisma.lead.deleteMany({});
        await prisma.customer.deleteMany({});
        console.log('🧹 [MySQL] Full database messages and leads cleared by Admin.');
      } catch (e) {
        console.warn('Error clearing database:', e.message);
      }
    }
    broadcastSSE({ type: 'SESSION_CLEARED' });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Database cleared successfully.' }));
    return;
  }

  // 7. REST: Get Treatment Categories from MySQL
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

  // 8. REST: Get Treatments from MySQL
  if (req.method === 'GET' && pathname === '/api/treatments') {
    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const treatments = await prisma.treatment.findMany({ where: { active: true } });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(treatments));
        return;
      } catch (e) {}
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return;
  }

  // 9. REST: Get Messages from MySQL (Persistent History)
  if (req.method === 'GET' && pathname === '/api/messages') {
    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const queryLeadId = parsedUrl.query.leadId;
        const whereClause = queryLeadId ? { leadId: String(queryLeadId) } : {};
        const messages = await prisma.message.findMany({
          where: whereClause,
          orderBy: { timestamp: 'asc' },
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(messages));
        return;
      } catch (e) {
        console.error('Error fetching messages from DB:', e);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return;
  }

  // 10. REST: Get Leads from MySQL
  if (req.method === 'GET' && pathname === '/api/leads') {
    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const leads = await prisma.lead.findMany({
          include: {
            customer: true,
            category: true,
            treatment: true,
            assignedCoordinator: true,
            messages: { orderBy: { timestamp: 'asc' } },
            notes: true,
            stageHistories: true,
          },
          orderBy: { updatedAt: 'desc' },
        });

        // Automatically heal and resolve any LID numbers to real mobile numbers
        for (const l of leads) {
          if (l.customer) {
            const raw = l.customer.whatsappNumber || '';
            const rawWaId = l.customer.whatsappId || '';
            const digits = raw.replace(/[^0-9]/g, '');
            const isLidNum = digits.length >= 13 || digits.startsWith('1820') || digits.startsWith('1857') || digits.startsWith('2001') || digits.startsWith('1766') || digits.startsWith('1605') || digits.startsWith('1980') || digits.startsWith('2226') || digits.startsWith('2520') || digits.startsWith('7328');

            let resolved = await resolveRealPhoneNumber(rawWaId || raw);
            if (!resolved && isLidNum) {
              resolved = await resolveRealPhoneNumber(digits);
            }

            if (resolved) {
              const formattedReal = resolved.startsWith('+') ? resolved : `+${resolved}`;
              if (l.customer.whatsappNumber !== formattedReal) {
                l.customer.whatsappNumber = formattedReal;
                l.customer.phoneNumber = formattedReal;
                // Update in database asynchronously
                prisma.customer.update({
                  where: { id: l.customer.id },
                  data: {
                    whatsappNumber: formattedReal,
                    phoneNumber: formattedReal,
                    whatsappId: rawWaId || digits
                  }
                }).catch(() => {});
              }
            }
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(leads));
        return;
      } catch (e) {
        console.error('Error fetching leads from DB:', e);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return;
  }

  // 10. Meta WhatsApp Cloud API Webhook Handlers
  if (pathname === '/api/webhook') {
    if (req.method === 'GET') {
      const mode = parsedUrl.query['hub.mode'];
      const token = parsedUrl.query['hub.verify_token'];
      const challenge = parsedUrl.query['hub.challenge'];
      const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'royal_wellness_token_2026';

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ [META WEBHOOK] Verified successfully with challenge token.');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(challenge);
      } else {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden. Invalid verification token.' }));
      }
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          if (payload.object === 'whatsapp_business_account' && Array.isArray(payload.entry)) {
            for (const entry of payload.entry) {
              for (const change of entry.changes || []) {
                if (change.field === 'messages' && change.value) {
                  const val = change.value;
                  const contact = val.contacts?.[0];
                  const message = val.messages?.[0];

                  if (message) {
                    const phone = contact?.wa_id || message.from;
                    const name = contact?.profile?.name || (phone ? `+${phone}` : 'Meta Direct Contact');
                    const text = message.text?.body || message.button?.text || '[Media Message]';
                    const messageId = message.id;

                    console.log(`\n💬 [META INBOUND] ${name} (+${phone}): "${text}"`);
                    
                    broadcastSSE({
                      type: 'INBOUND_WHATSAPP_MESSAGE',
                      phone: phone ? `+${phone}` : '',
                      whatsappId: phone,
                      realPhone: phone ? `+${phone}` : '',
                      name: name,
                      text: text,
                      messageId: messageId,
                      timestamp: new Date().toISOString()
                    });

                    persistInboundMessage({
                      phone: `+${phone}`,
                      whatsappId: phone,
                      name: name,
                      text: text,
                      messageId: messageId,
                      timestamp: new Date().toISOString(),
                    });
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

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
});

server.listen(PORT, () => {
  console.log(`\n🚀 Royal Wellness Unified WhatsApp Server running on http://localhost:${PORT}`);
  console.log(`   - WhatsApp Web Socket: Active (Baileys)`);
  console.log(`   - Meta Cloud API Webhook: http://localhost:${PORT}/api/webhook`);
  console.log(`   - Real-Time SSE Hub: http://localhost:${PORT}/api/events`);
  console.log(`   - MySQL Storage Support: Active (Prisma ORM)`);

  startWhatsAppSocket().catch(err => {
    console.error('Failed to initialize WhatsApp socket:', err);
  });
});
