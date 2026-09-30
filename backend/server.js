import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import makeWASocketDefault, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';

// Support both ESM default and named export
const makeWASocket = makeWASocketDefault.default || makeWASocketDefault;

const PORT = 3001;
const AUTH_FOLDER = path.join(process.cwd(), 'auth_info_baileys');

let sock = null;
let currentQrDataUrl = null;
let connectionState = 'connecting'; // 'connecting' | 'qr_ready' | 'connected' | 'disconnected'
let connectedPhoneNumber = null;
let sseClients = [];
const processedMessageIds = new Set();
// Map clean phone/ID to original rawJid (handles @lid and @s.whatsapp.net)
const jidMap = new Map();

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(payload);
    } catch (e) {}
  });
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
      } catch (err) {
        console.error('Error creating QR data URL:', err);
      }
      broadcastSSE({
        type: 'QR_CODE_UPDATED',
        qr: currentQrDataUrl,
        status: connectionState
      });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ WhatsApp connection closed. StatusCode:', statusCode, ', Reconnecting:', shouldReconnect);
      connectionState = 'disconnected';
      currentQrDataUrl = null;

      broadcastSSE({
        type: 'CONNECTION_STATUS',
        status: connectionState,
        phone: null
      });

      if (shouldReconnect) {
        setTimeout(startWhatsAppSocket, 3000);
      } else {
        // Logged out - clear session
        if (fs.existsSync(AUTH_FOLDER)) {
          fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        }
        setTimeout(startWhatsAppSocket, 2000);
      }
    } else if (connection === 'open') {
      console.log('🎉 WhatsApp Linked Successfully via QR Code!');
      connectionState = 'connected';
      currentQrDataUrl = null;
      
      const userJid = sock.user?.id || '';
      connectedPhoneNumber = userJid.split(':')[0] || userJid.split('@')[0];
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
        continue; // Do NOT create a new chat message bubble!
      }

      const messageText = 
        msg.message.conversation || 
        msg.message.extendedTextMessage?.text || 
        msg.message.imageMessage?.caption || 
        msg.message.videoMessage?.caption ||
        (msg.message.interactiveResponseMessage ? 'Interactive Response' : '[Media Message]');

      console.log(`\n💬 [WHATSAPP INBOUND] ${pushName} (+${senderPhone}): "${messageText}"`);

      let avatarUrl = null;
      try {
        avatarUrl = await sock.profilePictureUrl(rawJid, 'image');
      } catch (e) {}

      const normalizedPhone = realPhone ? (realPhone.startsWith('+') ? realPhone : `+${realPhone}`) : (senderPhone ? (senderPhone.startsWith('+') ? senderPhone : `+${senderPhone}`) : '');

      broadcastSSE({
        type: 'INBOUND_WHATSAPP_MESSAGE',
        phone: normalizedPhone,
        whatsappId: senderPhone,
        realPhone: realPhone ? `+${realPhone}` : null,
        isLid: rawJid.endsWith('@lid'),
        name: pushName,
        avatarUrl: avatarUrl,
        text: messageText,
        messageId: messageId,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Also listen for dedicated messages.reaction event from Baileys
  sock.ev.on('messages.reaction', (reactions) => {
    if (!Array.isArray(reactions)) return;
    for (const r of reactions) {
      const targetId = r.key?.id;
      const emoji = r.reaction?.text || '';
      console.log(`\n✨ [REACTION EVENT] Reaction "${emoji}" on message ${targetId}`);
      broadcastSSE({
        type: 'INBOUND_REACTION',
        targetMessageId: targetId,
        emoji: emoji,
        timestamp: new Date().toISOString()
      });
    }
  });
}

// Start WhatsApp socket immediately
startWhatsAppSocket();

// HTTP API Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 1. Live SSE Stream
  if (req.method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    res.write(`data: ${JSON.stringify({
      type: 'INIT_STATE',
      status: connectionState,
      qr: currentQrDataUrl,
      phone: connectedPhoneNumber
    })}\n\n`);

    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
    return;
  }

  // 2. Meta WhatsApp Cloud API Webhook Verification (GET /api/webhook)
  if (req.method === 'GET' && (pathname === '/api/webhook' || pathname === '/webhook')) {
    const mode = parsedUrl.query['hub.mode'];
    const token = parsedUrl.query['hub.verify_token'];
    const challenge = parsedUrl.query['hub.challenge'];
    const VERIFY_TOKEN = 'royal_wellness_token_2026';

    console.log(`\n[WEBHOOK GET] Meta verification handshake: mode=${mode}, token=${token}`);

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Meta Webhook Verified Successfully!');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(challenge);
      return;
    } else {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
  }

  // 3. Meta WhatsApp Cloud API Inbound Ingestion (POST /api/webhook)
  if (req.method === 'POST' && (pathname === '/api/webhook' || pathname === '/webhook')) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const json = JSON.parse(body);
        const entry = json.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const contacts = value?.contacts;
        const messages = value?.messages;

        if (messages && messages.length > 0) {
          const msg = messages[0];
          const contact = contacts?.[0];

          // TASK 1 & TASK 8: Real Customer phone & WhatsApp ID from Cloud API
          const senderPhone = msg.from; // e.g. "94770049469"
          const waId = contact?.wa_id || senderPhone; // e.g. "94770049469"
          const senderName = contact?.profile?.name || (senderPhone ? `+${senderPhone}` : 'WhatsApp Customer');
          const text = msg.text?.body || (msg.interactive?.button_reply?.title) || `[${msg.type} message]`;

          // TASK 9: Development trace logging
          console.log(`\n[WhatsApp Webhook]`);
          console.log(`- Customer WhatsApp ID: ${waId}`);
          console.log(`- Customer phone: ${senderPhone}`);
          console.log(`- Customer name: ${senderName}`);
          console.log(`- Message text: "${text}"`);

          const normalizedPhone = senderPhone ? (senderPhone.startsWith('+') ? senderPhone : `+${senderPhone}`) : '';

          broadcastSSE({
            type: 'INBOUND_WHATSAPP_MESSAGE',
            phone: normalizedPhone,
            whatsappId: waId,
            name: senderName,
            text: text,
            messageId: msg.id,
            timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString()
          });
        }
      } catch (err) {
        console.error('Error parsing Meta webhook payload:', err);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'EVENT_RECEIVED' }));
    });
    return;
  }

  // 4. Get QR Code status
  if (req.method === 'GET' && pathname === '/api/qr') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: connectionState,
      qr: currentQrDataUrl,
      phone: connectedPhoneNumber
    }));
    return;
  }

  // 3. Outbound Message Dispatcher (Sends through linked phone via Baileys)
  if (req.method === 'POST' && pathname === '/api/send-message') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { to, text } = JSON.parse(body);
        if (!to || !text) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing "to" or "text"' }));
          return;
        }

        if (!sock || connectionState !== 'connected') {
          console.warn('⚠️ Send attempted but WhatsApp socket is not connected');
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'WhatsApp is not connected. Please scan QR code.' }));
          return;
        }

        const cleanPhone = to.replace(/[^0-9]/g, '');
        
        // Resolve destination JID from known mapping or default standard JID
        let targetJid = jidMap.get(cleanPhone) || jidMap.get(to) || `${cleanPhone}@s.whatsapp.net`;
        
        console.log(`📤 Sending outbound WhatsApp to JID: ${targetJid} (Recipient: "${to}")...`);
        const sent = await sock.sendMessage(targetJid, { text });
        console.log(`✅ Message Delivered to ${to}! (ID: ${sent.key.id})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messageId: sent.key.id }));
      } catch (err) {
        console.error('❌ Error sending WhatsApp message via Baileys:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 4. Disconnect / Logout
  if (req.method === 'POST' && pathname === '/api/logout') {
    try {
      if (sock) {
        await sock.logout();
      }
      if (fs.existsSync(AUTH_FOLDER)) {
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
      }
      connectionState = 'connecting';
      currentQrDataUrl = null;
      connectedPhoneNumber = null;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      setTimeout(startWhatsAppSocket, 1000);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n🚀 Royal Wellness WhatsApp QR Web Bridge running on http://localhost:${PORT}`);
  console.log(`- QR Stream: http://localhost:${PORT}/api/events`);
  console.log(`- Send API:  http://localhost:${PORT}/api/send-message`);
});
