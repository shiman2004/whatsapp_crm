import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import makeWASocketDefault, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import pino from 'pino';
import dotenv from 'dotenv';
import { getPrisma, checkDbConnection, getDbStatus } from './src/db.js';

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
    console.log('📦 [MySQL Database Storage] Active and ready for persistence.');
  } else {
    console.log('ℹ️ [Storage Mode] Running in memory / SSE mode (Configure DATABASE_URL in backend/.env for MySQL storage).');
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

// Map of LID to Phone number
const lidToPhoneMap = new Map();

function registerContact(c) {
  if (!c) return;
  const jid = c.id || '';
  const lid = c.lid || '';
  if (jid && jid.endsWith('@s.whatsapp.net')) {
    const phone = jid.replace('@s.whatsapp.net', '');
    if (lid && lid.endsWith('@lid')) {
      const cleanLid = lid.replace('@lid', '');
      lidToPhoneMap.set(cleanLid, phone);
    }
    jidMap.set(phone, jid);
    jidMap.set(`+${phone}`, jid);
  }
}

// Unified Core: Process and Persist WhatsApp Message (Idempotent)
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

  // Determine phone number and clean ID
  let senderPhone = rawJid.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/[^0-9]/g, '');
  let realPhone = null;

  if (rawJid.endsWith('@s.whatsapp.net')) {
    realPhone = senderPhone;
  } else if (rawJid.endsWith('@lid') && lidToPhoneMap.has(senderPhone)) {
    realPhone = lidToPhoneMap.get(senderPhone);
  } else if (msg.key.participant && msg.key.participant.endsWith('@s.whatsapp.net')) {
    realPhone = msg.key.participant.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
  }

  if (senderPhone.length > 15 && !realPhone) {
    return null;
  }

  const effectivePhone = realPhone || senderPhone;
  const canonicalPhone = effectivePhone.startsWith('+') ? effectivePhone : `+${effectivePhone}`;

  // Remember mapping from phone and LID to original JID for sending replies
  jidMap.set(senderPhone, rawJid);
  jidMap.set(`+${senderPhone}`, rawJid);
  if (realPhone) {
    jidMap.set(realPhone, rawJid);
    jidMap.set(`+${realPhone}`, rawJid);
  }

  const pushName = msg.pushName && msg.pushName.trim().length > 0
    ? msg.pushName
    : (isFromMe ? 'You (Staff)' : canonicalPhone);

  // Original timestamp from WhatsApp message (seconds -> ms), fallback to current date
  const rawTimestamp = msg.messageTimestamp;
  const timestampDate = rawTimestamp
    ? new Date(typeof rawTimestamp === 'number' ? rawTimestamp * 1000 : (Number(rawTimestamp) * 1000 || Date.now()))
    : new Date();
  const timestampIso = timestampDate.toISOString();

  // Check for Reaction message
  if (msg.message.reactionMessage) {
    const reaction = msg.message.reactionMessage;
    const targetMessageId = reaction.key?.id;
    const emoji = reaction.text || '';

    console.log(`❤️ [WHATSAPP REACTION] ${pushName} reacted "${emoji}" to message ${targetMessageId}`);

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
    return null;
  }

  // Extract text and media
  let mediaType = null;
  let mediaUrl = null;
  let fileName = null;

  if (msg.message.imageMessage) {
    mediaType = 'image';
  } else if (msg.message.videoMessage) {
    mediaType = 'video';
  } else if (msg.message.documentMessage) {
    mediaType = 'document';
    fileName = msg.message.documentMessage.fileName || 'document.pdf';
  } else if (msg.message.audioMessage) {
    mediaType = 'audio';
  }

  // Attempt media download if present and live
  if (mediaType && sock && source === 'live') {
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
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    msg.message.documentMessage?.caption ||
    (mediaType ? (mediaType === 'image' ? 'Photo' : mediaType === 'video' ? 'Video' : mediaType === 'audio' ? 'Voice note' : 'Document') : (msg.message.interactiveResponseMessage ? 'Interactive Response' : ''));

  // Database Persistence (MySQL)
  const prisma = getPrisma();
  let lead = null;
  let customer = null;

  if (prisma && getDbStatus()) {
    try {
      // 1. Upsert Customer
      customer = await prisma.customer.upsert({
        where: { whatsappNumber: canonicalPhone },
        update: {
          displayName: !isFromMe && pushName && !pushName.startsWith('+') ? pushName : undefined,
          whatsappId: effectivePhone,
        },
        create: {
          whatsappNumber: canonicalPhone,
          whatsappId: effectivePhone,
          displayName: !isFromMe && pushName ? pushName : canonicalPhone,
          preferredLanguage: 'en',
        },
      });

      // 2. Find or Create Lead
      lead = await prisma.lead.findFirst({
        where: { customerId: customer.id, stage: { notIn: ['converted', 'lost'] } },
        orderBy: { createdAt: 'desc' },
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
      } else {
        if (!isFromMe) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { lastCustomerMessageAt: timestampDate },
          });
        }
      }

      // 3. Idempotent Message Upsert
      await prisma.message.upsert({
        where: { id: messageId },
        update: {
          content: messageText || '',
          status: isFromMe ? 'sent' : 'delivered',
          mediaUrl: mediaUrl || undefined,
          mediaType: mediaType || undefined,
        },
        create: {
          id: messageId,
          leadId: lead.id,
          customerId: customer.id,
          direction: isFromMe ? 'outbound' : 'inbound',
          senderType: isFromMe ? 'coordinator' : 'customer',
          content: messageText || '',
          status: isFromMe ? 'sent' : 'delivered',
          timestamp: timestampDate,
          mediaUrl: mediaUrl || null,
          mediaType: mediaType || null,
        },
      });
    } catch (err) {
      console.warn(`⚠️ [MySQL Sync Error]:`, err.message);
    }
  }

  // Structured Logging
  if (source === 'history_sync') {
    // History sync logging
  } else if (isFromMe) {
    console.log(`📱 [PHONE OUTBOUND] Staff replied to (${canonicalPhone}): "${messageText}" [ID: ${messageId}]`);
  } else {
    console.log(`💬 [WHATSAPP INBOUND] ${pushName} (${canonicalPhone}): "${messageText}" [ID: ${messageId}]`);
  }

  // Real-time broadcast
  const messagePayload = {
    type: isFromMe ? 'OUTBOUND_WHATSAPP_MESSAGE' : 'INBOUND_WHATSAPP_MESSAGE',
    phone: canonicalPhone,
    whatsappId: effectivePhone,
    name: pushName,
    text: messageText,
    messageId: messageId,
    timestamp: timestampIso,
    direction: isFromMe ? 'outbound' : 'inbound',
    senderType: isFromMe ? 'coordinator' : 'customer',
    leadId: lead?.id,
    customerId: customer?.id,
    source: source,
    media: mediaUrl ? {
      type: mediaType,
      url: mediaUrl,
      caption: messageText,
      fileName: fileName
    } : undefined
  };

  broadcastSSE(messagePayload);
  return messagePayload;
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

async function startWhatsAppSocket() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`\n📱 Starting WhatsApp Web Socket (Baileys v${version.join('.')}, isLatest: ${isLatest})...`);

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    browser: ['Royal Wellness CRM', 'Chrome', '1.0.0'],
    syncFullHistory: true, // Request full history sync on connection
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📸 New WhatsApp QR Code generated! Ready to scan on screen.');
      connectionState = 'qr_ready';
      try {
        currentQrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
        broadcastSSE({
          type: 'QR_CODE',
          qrDataUrl: currentQrDataUrl
        });
      } catch (err) {
        console.error('Error generating QR data URL:', err);
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`⚠️ WhatsApp connection closed. StatusCode: ${statusCode} , Reconnecting: ${shouldReconnect}`);
      connectionState = 'disconnected';
      connectedPhoneNumber = null;
      currentQrDataUrl = null;

      broadcastSSE({
        type: 'CONNECTION_STATUS',
        status: 'disconnected'
      });

      if (shouldReconnect) {
        setTimeout(startWhatsAppSocket, 3000);
      } else {
        console.log('🔒 Logged out from WhatsApp. Clear auth_info_baileys to re-scan.');
      }
    } else if (connection === 'open') {
      console.log('\n🎉 WhatsApp Linked Successfully via QR Code!');
      connectionState = 'connected';
      currentQrDataUrl = null;
      
      const rawUser = sock.user?.id || '';
      connectedPhoneNumber = rawUser.split(':')[0].replace(/[^0-9]/g, '');
      console.log(`✅ Connected Phone Number: +${connectedPhoneNumber}`);

      broadcastSSE({
        type: 'CONNECTION_STATUS',
        status: connectionState,
        phone: connectedPhoneNumber,
        name: sock.user?.name || 'Royal Wellness Center'
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
    console.log(`\n⏳ [HISTORY SYNC STARTED] WhatsApp history received: ${contacts?.length || 0} contacts, ${chats?.length || 0} chats, ${messages?.length || 0} messages (isLatest: ${isLatest}).`);
    
    if (Array.isArray(contacts)) {
      contacts.forEach(registerContact);
    }

    if (Array.isArray(messages) && messages.length > 0) {
      let syncedCount = 0;
      for (const msg of messages) {
        try {
          const res = await processAndPersistWhatsAppMessage(msg, 'history_sync');
          if (res) syncedCount++;
        } catch (e) {
          // ignore individual sync errors
        }
      }
      console.log(`✅ [HISTORY SYNC COMPLETED] Successfully synchronized ${syncedCount} historical messages into CRM database.`);
      broadcastSSE({ type: 'HISTORY_SYNC_COMPLETED', count: syncedCount });
    }
  });

  // Handle live and catch-up messages (both notify & append)
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    const isCatchUp = type === 'append';
    for (const msg of messages) {
      const messageId = msg.key?.id;
      if (!messageId) continue;

      if (processedMessageIds.has(messageId)) {
        // Skip duplicate
        continue;
      }
      processedMessageIds.add(messageId);
      if (processedMessageIds.size > 1000) {
        const first = processedMessageIds.values().next().value;
        processedMessageIds.delete(first);
      }

      await processAndPersistWhatsAppMessage(msg, isCatchUp ? 'catch_up' : 'live');
    }
  });
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

  // 3. QR Code Endpoint
  if (req.method === 'GET' && pathname === '/api/qr') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      qr: currentQrDataUrl,
      status: connectionState
    }));
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
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'WhatsApp is not linked yet.' }));
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

        // Save outbound message to MySQL
        persistOutboundMessage({
          leadId,
          customerId,
          content: msgContent || (media ? `[${media.type.toUpperCase()}]` : ''),
          messageId: outboundMsgId,
          senderType: 'coordinator',
          mediaUrl: savedMediaUrl,
          mediaType: media ? media.type : null,
        });

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

  // 6. Disconnect / Logout / Unlink (Preserves Database History)
  if (req.method === 'POST' && (pathname === '/api/disconnect' || pathname === '/api/logout' || pathname === '/api/unlink')) {
    console.log('🔄 [WhatsApp Unlink] Disconnecting session and unlinking device (CRM message history preserved)...');
    try {
      if (sock) {
        try {
          await sock.logout();
        } catch (e) {
          try { sock.end(new Error('User unlinked session')); } catch (e2) {}
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

      connectionState = 'disconnected';
      connectedPhoneNumber = null;
      currentQrDataUrl = null;
      jidMap.clear();

      broadcastSSE({
        type: 'CONNECTION_STATUS',
        status: 'disconnected',
        phone: null,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Unlinked successfully. CRM message history preserved in database.' }));

      setTimeout(() => {
        startWhatsAppSocket().catch(err => console.error('Error restarting WhatsApp socket:', err));
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
