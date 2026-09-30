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

// Helper: Save Inbound Message to MySQL
async function persistInboundMessage({ phone, whatsappId, name, text, messageId, timestamp, avatarUrl, mediaUrl, mediaType }) {
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) return;

  try {
    const canonicalPhone = phone.startsWith('+') ? phone : `+${phone}`;
    
    // 1. Upsert Customer
    const customer = await prisma.customer.upsert({
      where: { whatsappNumber: canonicalPhone },
      update: {
        displayName: name || canonicalPhone,
        avatarUrl: avatarUrl || undefined,
        whatsappId: whatsappId || undefined,
      },
      create: {
        whatsappNumber: canonicalPhone,
        whatsappId: whatsappId || canonicalPhone.replace(/[^0-9]/g, ''),
        displayName: name || canonicalPhone,
        avatarUrl: avatarUrl || null,
        preferredLanguage: 'en',
      },
    });

    // 2. Find or Create Default Lead for this Customer
    let lead = await prisma.lead.findFirst({
      where: {
        customerId: customer.id,
        stage: { notIn: ['converted', 'lost'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lead) {
      // Find fallback treatment category
      const firstCategory = await prisma.treatmentCategory.findFirst();
      const firstTreatment = await prisma.treatment.findFirst();

      lead = await prisma.lead.create({
        data: {
          customerId: customer.id,
          categoryId: firstCategory ? firstCategory.id : 'cat-hair-care',
          treatmentId: firstTreatment ? firstTreatment.id : 'trt-hair-prp',
          stage: 'new',
          source: 'whatsapp',
          language: 'en',
          lastCustomerMessageAt: new Date(timestamp || Date.now()),
        },
      });
    } else {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { lastCustomerMessageAt: new Date(timestamp || Date.now()) },
      });
    }

    // 3. Save Message Record
    if (messageId) {
      await prisma.message.upsert({
        where: { id: messageId },
        update: {
          content: text || '',
          status: 'delivered',
          mediaUrl: mediaUrl || undefined,
          mediaType: mediaType || undefined,
        },
        create: {
          id: messageId,
          leadId: lead.id,
          customerId: customer.id,
          direction: 'inbound',
          senderType: 'customer',
          content: text || '',
          status: 'delivered',
          timestamp: new Date(timestamp || Date.now()),
          mediaUrl: mediaUrl || null,
          mediaType: mediaType || null,
        },
      });
    }
  } catch (err) {
    console.warn('⚠️ [MySQL Persistence Error - Inbound]:', err.message);
  }
}

// Helper: Save Outbound Message to MySQL
async function persistOutboundMessage({ leadId, customerId, content, messageId, senderType, mediaUrl, mediaType }) {
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) return;

  try {
    if (!leadId || !messageId) return;

    await prisma.message.create({
      data: {
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
    browser: ['Royal Wellness CRM', 'Chrome', '1.0.0']
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

  // Map of LID to Phone number
  const lidToPhoneMap = new Map();

  const registerContact = (c) => {
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
  };

  sock.ev.on('contacts.set', ({ contacts }) => {
    if (Array.isArray(contacts)) {
      contacts.forEach(registerContact);
      console.log(`📇 Synced ${contacts.length} WhatsApp contacts automatically.`);
    }
  });

  sock.ev.on('messaging-history.set', ({ contacts }) => {
    if (Array.isArray(contacts)) {
      contacts.forEach(registerContact);
      console.log(`📇 Synced ${contacts.length} historical contacts automatically.`);
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

  // Handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue; // Skip own outbound messages

      const messageId = msg.key.id;
      if (!messageId || processedMessageIds.has(messageId)) continue; // Deduplicate
      processedMessageIds.add(messageId);

      if (processedMessageIds.size > 500) {
        const first = processedMessageIds.values().next().value;
        processedMessageIds.delete(first);
      }

      const rawJid = msg.key.remoteJid || '';
      // Ignore group chats, channels, newsletters, and status updates
      if (
        rawJid.endsWith('@g.us') || 
        rawJid.includes('@newsletter') || 
        rawJid.includes('@broadcast') || 
        rawJid.startsWith('120363') || 
        rawJid === 'status@broadcast'
      ) {
        continue;
      }

      let senderPhone = rawJid.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/[^0-9]/g, '');
      
      // If JID is an LID, try to find the real phone number from contact mapping
      let realPhone = null;
      if (rawJid.endsWith('@s.whatsapp.net')) {
        realPhone = senderPhone;
      } else if (rawJid.endsWith('@lid') && lidToPhoneMap.has(senderPhone)) {
        realPhone = lidToPhoneMap.get(senderPhone);
      } else if (msg.key.participant && msg.key.participant.endsWith('@s.whatsapp.net')) {
        realPhone = msg.key.participant.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
      }

      if (senderPhone.length > 15) {
        continue;
      }

      // Remember mapping from phone and LID to original JID for sending replies
      jidMap.set(senderPhone, rawJid);
      jidMap.set(`+${senderPhone}`, rawJid);
      if (realPhone) {
        jidMap.set(realPhone, rawJid);
        jidMap.set(`+${realPhone}`, rawJid);
      }

      const pushName = msg.pushName && msg.pushName.trim().length > 0 
        ? msg.pushName 
        : (senderPhone ? `+${senderPhone}` : 'Direct Contact');

      // Check if this is an incoming reaction (e.g. ❤️, 😂, 👍)
      if (msg.message.reactionMessage) {
        const reaction = msg.message.reactionMessage;
        const targetMessageId = reaction.key?.id;
        const emoji = reaction.text || '';
        
        console.log(`\n❤️ [WHATSAPP REACTION] ${pushName} reacted "${emoji}" to message ${targetMessageId}`);
        
        broadcastSSE({
          type: 'INBOUND_REACTION',
          phone: realPhone ? `+${realPhone}` : (rawJid.endsWith('@s.whatsapp.net') ? `+${senderPhone}` : senderPhone),
          targetMessageId: targetMessageId,
          emoji: emoji,
          timestamp: new Date().toISOString()
        });

        // Update reaction in MySQL
        const prisma = getPrisma();
        if (prisma && getDbStatus() && targetMessageId) {
          prisma.message.update({
            where: { id: targetMessageId },
            data: { reaction: emoji },
          }).catch(() => {});
        }
        continue; // Do NOT create a new chat message bubble!
      }

      // Check for Inbound Media (Image, Video, Audio, Document)
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

      if (mediaType) {
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
            const safeName = `media_${(messageId || 'in').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.${ext}`;
            const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }
            fs.writeFileSync(path.join(uploadsDir, safeName), buffer);
            mediaUrl = `http://localhost:3001/uploads/${safeName}`;
            console.log(`📥 [MEDIA DOWNLOADED] Saved ${mediaType} to: ${mediaUrl}`);
          }
        } catch (e) {
          console.warn('Could not download inbound media message:', e.message);
        }
      }

      const messageText = 
        msg.message.conversation || 
        msg.message.extendedTextMessage?.text || 
        msg.message.imageMessage?.caption || 
        msg.message.videoMessage?.caption ||
        msg.message.documentMessage?.caption ||
        (mediaType ? (mediaType === 'image' ? 'Photo' : mediaType === 'video' ? 'Video' : mediaType === 'audio' ? 'Voice note' : 'Document') : (msg.message.interactiveResponseMessage ? 'Interactive Response' : ''));

      console.log(`\n💬 [WHATSAPP INBOUND] ${pushName} (+${senderPhone}): "${messageText}" ${mediaUrl ? `[Media: ${mediaType}]` : ''}`);

      let avatarUrl = null;
      try {
        avatarUrl = await sock.profilePictureUrl(rawJid, 'image');
      } catch (e) {
        avatarUrl = null;
      }

      const timestampIso = new Date().toISOString();
      const phonePayload = realPhone ? `+${realPhone}` : (rawJid.endsWith('@s.whatsapp.net') ? `+${senderPhone}` : senderPhone);

      // Broadcast real-time SSE to open frontend browsers
      broadcastSSE({
        type: 'INBOUND_WHATSAPP_MESSAGE',
        phone: phonePayload,
        whatsappId: senderPhone,
        realPhone: realPhone ? `+${realPhone}` : null,
        isLid: rawJid.endsWith('@lid'),
        name: pushName,
        avatarUrl: avatarUrl,
        text: messageText,
        messageId: messageId,
        timestamp: timestampIso,
        media: mediaUrl ? {
          type: mediaType,
          url: mediaUrl,
          caption: messageText,
          fileName: fileName
        } : undefined
      });

      // Persist directly into MySQL
      persistInboundMessage({
        phone: phonePayload,
        whatsappId: senderPhone,
        name: pushName,
        text: messageText,
        messageId: messageId,
        timestamp: timestampIso,
        avatarUrl: avatarUrl,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
      });
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

  // 6. Disconnect / Logout / Unlink
  if (req.method === 'POST' && (pathname === '/api/disconnect' || pathname === '/api/logout' || pathname === '/api/unlink')) {
    console.log('🔄 [WhatsApp Unlink] Disconnecting session and resetting auth keys...');
    try {
      if (sock) {
        try {
          await sock.logout();
        } catch (e) {
          try { sock.end(new Error('User unlinked session')); } catch (e2) {}
        }
        sock = null;
      }

      // Clean up auth folder
      if (fs.existsSync(AUTH_FOLDER)) {
        try {
          fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        } catch (e) {
          console.warn('⚠️ Could not remove auth folder immediately:', e.message);
        }
      }

      // Clear synced messages and live session data from MySQL
      const prisma = getPrisma();
      if (prisma && getDbStatus()) {
        try {
          await prisma.message.deleteMany({});
          await prisma.leadNote.deleteMany({});
          await prisma.leadStageHistory.deleteMany({});
          await prisma.followup.deleteMany({});
          await prisma.lead.deleteMany({});
          await prisma.customer.deleteMany({});
          console.log('🧹 [MySQL] Cleared database messages & synced leads on WhatsApp logout.');
        } catch (e) {
          console.warn('Could not clear database messages on logout:', e.message);
        }
      }

      connectionState = 'connecting';
      connectedPhoneNumber = null;
      currentQrDataUrl = null;
      jidMap.clear();

      broadcastSSE({
        type: 'INIT',
        status: 'connecting',
        phone: null,
        qrDataUrl: null,
        dbConnected: getDbStatus(),
      });
      broadcastSSE({
        type: 'SESSION_CLEARED'
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Unlinked successfully and data cleared.' }));

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

  // 6b. Clear All Database Data
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
        console.log('🧹 [MySQL] Full database messages and leads cleared.');
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

  // 9. REST: Get Leads from MySQL
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
            messages: { take: 1, orderBy: { timestamp: 'desc' } },
          },
          orderBy: { updatedAt: 'desc' },
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(leads));
        return;
      } catch (e) {}
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
