import http from 'http';
import url from 'url';
import https from 'https';

const PORT = 3001;
let VERIFY_TOKEN = 'royal_wellness_token_2026';
let META_ACCESS_TOKEN = '';
let META_PHONE_NUMBER_ID = '1302468252956177';
let META_WABA_ID = '1715869669491270';

// Connected SSE clients (React CRM browsers)
let sseClients = [];

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-hub-signature-256, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 1. Server-Sent Events for real-time frontend syncing
  if (req.method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Connected to WhatsApp Live Stream' })}\n\n`);
    sseClients.push(res);

    req.on('close', () => {
      sseClients = sseClients.filter(client => client !== res);
    });
    return;
  }

  // 2. Meta Webhook Verification (GET request)
  if (req.method === 'GET' && (pathname === '/api/webhook' || pathname === '/webhook' || pathname === '/')) {
    const mode = parsedUrl.query['hub.mode'];
    const token = parsedUrl.query['hub.verify_token'];
    const challenge = parsedUrl.query['hub.challenge'];

    console.log(`\n[WEBHOOK GET] Meta verification handshake:`);
    console.log(`- Mode: ${mode}`);
    console.log(`- Token: ${token}`);
    console.log(`- Challenge: ${challenge}`);

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook Verified Successfully!');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(challenge);
      return;
    } else {
      console.error('❌ Verification failed: Token mismatch.');
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
  }

  // 3. Inbound Messages & Events from Meta (POST request)
  if (req.method === 'POST' && (pathname === '/api/webhook' || pathname === '/webhook' || pathname === '/')) {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const json = JSON.parse(body);
        console.log('\n📩 [WEBHOOK POST] WhatsApp Inbound Payload:');

        const entry = json.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const contacts = value?.contacts;
        const messages = value?.messages;

        if (messages && messages.length > 0) {
          const msg = messages[0];
          const contact = contacts?.[0];
          
          // TASK 1 & TASK 8: Customer's real WhatsApp sender number
          const senderPhone = msg.from; // e.g. "94771234567"
          const waId = contact?.wa_id || senderPhone; // e.g. "94771234567"
          const senderName = contact?.profile?.name || (senderPhone ? `+${senderPhone}` : 'WhatsApp Customer');
          const text = msg.text?.body || (msg.interactive?.button_reply?.title) || `[${msg.type} message]`;

          // TASK 9: Safe development logging
          console.log(`\n[WhatsApp Webhook]`);
          console.log(`- Customer WhatsApp ID: ${waId}`);
          console.log(`- Customer phone: ${senderPhone}`);
          console.log(`- Customer name: ${senderName}`);
          console.log(`- Message text: "${text}"`);

          const normalizedPhone = senderPhone ? (senderPhone.startsWith('+') ? senderPhone : `+${senderPhone}`) : '';

          // Broadcast to connected CRM browser clients
          const eventPayload = {
            type: 'INBOUND_WHATSAPP_MESSAGE',
            phone: normalizedPhone,
            whatsappId: waId,
            name: senderName,
            text: text,
            messageId: msg.id,
            timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString()
          };

          sseClients.forEach(client => {
            client.write(`data: ${JSON.stringify(eventPayload)}\n\n`);
          });
        }
      } catch (err) {
        console.error('Error parsing webhook payload:', err);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'EVENT_RECEIVED' }));
    });
    return;
  }

  // 4. API to send outbound WhatsApp Message via Meta Cloud API
  if (req.method === 'POST' && pathname === '/api/send-message') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { to, text, token, phoneNumberId } = data;

        const activeToken = token || META_ACCESS_TOKEN;
        const activePhoneId = phoneNumberId || META_PHONE_NUMBER_ID;

        if (!activeToken) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Meta Access Token is required' }));
          return;
        }

        const postData = JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to.replace(/[^0-9]/g, ''),
          type: 'text',
          text: { preview_url: false, body: text }
        });

        const options = {
          hostname: 'graph.facebook.com',
          port: 443,
          path: `/v20.0/${activePhoneId}/messages`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${activeToken}`,
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const metaReq = https.request(options, metaRes => {
          let responseBody = '';
          metaRes.on('data', d => {
            responseBody += d;
          });

          metaRes.on('end', () => {
            res.writeHead(metaRes.statusCode || 200, { 'Content-Type': 'application/json' });
            res.end(responseBody);
          });
        });

        metaReq.on('error', e => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        });

        metaReq.write(postData);
        metaReq.end();
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n🚀 Royal Wellness Meta Webhook & API Bridge Server running at http://localhost:${PORT}`);
  console.log(`- Webhook Endpoint: /api/webhook`);
  console.log(`- Realtime Stream:  /api/events`);
  console.log(`- Outbound Sender:  /api/send-message`);
});
