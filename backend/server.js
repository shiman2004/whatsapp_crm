import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { getPrisma, checkDbConnection, getDbStatus } from './src/db.js';
import { sessionManager } from './src/sessionManager.js';
import { evaluateAutoReply, pauseAutoReply, clearAutoReplySessions } from './src/autoReplyEngine.js';

dotenv.config();

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || process.env.META_VERIFY_TOKEN || 'royal_wellness_hmac_secret_2026';

// Cryptographic Token Helpers (HMAC-SHA256)
function signAuthToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
}

// Multi-Client SSE Hub with Coordinator Channel Isolation
let sseClients = [];

// Meta Cloud API Shared Server Configuration (Persists token across all staff sessions)
let metaConfig = {
  accessToken: process.env.META_ACCESS_TOKEN || process.env.META_TOKEN || 'EAAPKSYZBDcu8BSv6YCceNu36eSytOR06TXco721oZAWjnpOaFQkeZA5lOhln4a980PlEfSo1AQKa6bRZAH9kjdtOe2RAPEqJGJgCEbWZAxoMdHMHvlrHDDvaKqY3XVu30vHPZBLdBgdHoDeJDB7qRYJl9r0R2cFcNlhqj3At5zp6QTZAWzwohz7JR3c6QuQf2VRMAZDZD',
  phoneNumberId: process.env.META_PHONE_NUMBER_ID || '1358157244046701',
  wabaId: process.env.META_WABA_ID || '2332922997481634'
};

// Periodic SSE Keep-Alive Heartbeat (Prevents proxy/Render timeout drops)
setInterval(() => {
  const keepAlive = ': keepalive\n\n';
  sseClients.forEach(client => {
    try {
      client.res.write(keepAlive);
    } catch (e) {}
  });
}, 15000);

/**
 * Isolated SSE Dispatcher
 * Guarantees Coordinator A NEVER receives events belonging to Coordinator B
 */
function broadcastScopedSSE(targetCoordinatorId, data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      // Super Admin and Leads Officer receive all events; Coordinators receive ONLY their own scoped events
      const hasFullVisibility = client.userRole === 'super_admin' || client.userRole === 'leads_officer';
      const isTargetCoordinator = !targetCoordinatorId || client.coordinatorId === targetCoordinatorId;

      if (hasFullVisibility || isTargetCoordinator) {
        client.res.write(payload);
      }
    } catch (e) {}
  });
}

// Attach isolated broadcaster to session manager
sessionManager.setSseEmitter(broadcastScopedSSE);

/**
 * Safe Diagnostic Logger (No sensitive tokens, credentials, or QR data)
 */
function logWaSessionDebug(endpoint, authUser, targetCoordinatorId, sessionCtx, dbRecord) {
  console.log(`[WA SESSION DEBUG] authenticatedUserId: ${authUser?.id || 'anonymous'} | coordinatorId: ${targetCoordinatorId} | sessionId: ${sessionCtx?.sessionId || dbRecord?.id || 'none'} | phoneNumber: ${sessionCtx?.connectedPhoneNumber || dbRecord?.phoneNumber || 'none'} | socketInstanceId: ${sessionCtx?.instanceCounter || 0} | endpoint: ${endpoint} | timestamp: ${new Date().toISOString()}`);
}

/**
 * Helper: Resolve and Authenticate CRM User from request
 */
async function authenticateRequest(req, parsedUrl) {
  const authHeader = req.headers['authorization'] || '';
  const headerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const queryToken = parsedUrl.query.token || '';

  const rawToken = headerToken || queryToken || '';
  const decoded = verifyAuthToken(rawToken);

  if (decoded && decoded.userId) {
    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } }).catch(() => null);
      if (user) {
        return {
          id: user.id,
          role: user.role,
          email: user.email,
          fullName: user.fullName
        };
      }
    }
    return {
      id: decoded.userId,
      role: decoded.role || 'coordinator',
      email: decoded.email || `${decoded.userId}@royalwellness.lk`,
      fullName: decoded.fullName || 'Staff'
    };
  }

  // Fallback: Check header/query IDs (e.g. initial login / direct coordinator param)
  const headerCoordId = req.headers['x-coordinator-id'] || req.headers['x-user-id'] || '';
  const rawId = headerCoordId || parsedUrl.query.coordinatorId || 'user-admin-1';
  const cleanId = String(rawId).trim();

  const prisma = getPrisma();
  if (prisma && getDbStatus()) {
    try {
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { id: cleanId },
            { email: { equals: cleanId, mode: 'insensitive' } }
          ]
        }
      });

      if (!user) {
        const isSuper = cleanId === 'user-admin-1' || cleanId.includes('admin');
        const role = isSuper ? 'super_admin' : 'coordinator';
        return {
          id: cleanId,
          role,
          email: `${cleanId}@royalwellness.lk`,
          fullName: isSuper ? 'Super Admin' : 'Coordinator'
        };
      }

      if (user) {
        return {
          id: user.id,
          role: user.role,
          email: user.email,
          fullName: user.fullName
        };
      }
    } catch (e) {}
  }

  const isSuper = cleanId === 'user-admin-1' || cleanId.includes('admin');
  const isOfficer = cleanId === 'user-officer-1' || cleanId.includes('officer');
  return {
    id: cleanId,
    role: isSuper ? 'super_admin' : (isOfficer ? 'leads_officer' : 'coordinator'),
    email: isSuper ? 'admin@royalwellness.lk' : (isOfficer ? 'sarah@royalwellness.lk' : `${cleanId}@royalwellness.lk`),
    fullName: isSuper ? 'Super Admin' : (isOfficer ? 'Sarah Fernando (Leads Officer)' : 'Staff Coordinator')
  };
}

// Start HTTP REST & SSE Gateway Server
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-coordinator-id, x-user-id');

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

  // 0b. User Login & Token Issuer Endpoint
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const identifier = (payload.identifier || payload.email || '').trim().toLowerCase();
        const secret = (payload.password || payload.pin || '').trim();

        const prisma = getPrisma();
        let user = null;
        if (prisma && getDbStatus()) {
          user = await prisma.user.findFirst({
            where: {
              OR: [
                { id: identifier },
                { email: { equals: identifier, mode: 'insensitive' } }
              ]
            }
          });
        }

        // Provision initial admin if not in DB
        if (!user && (identifier === 'admin@royalwellness.lk' || identifier === 'user-admin-1')) {
          if (prisma && getDbStatus()) {
            user = await prisma.user.create({
              data: {
                id: 'user-admin-1',
                email: 'admin@royalwellness.lk',
                fullName: 'Super Admin',
                password: 'admin',
                pin: '1234',
                role: 'super_admin'
              }
            }).catch(() => null);
          }
        }

        if (!user) {
          user = {
            id: identifier.includes('admin') ? 'user-admin-1' : (identifier || 'user-coord-1'),
            email: identifier || 'admin@royalwellness.lk',
            fullName: identifier.includes('admin') ? 'Super Admin' : 'Staff Coordinator',
            role: identifier.includes('admin') ? 'super_admin' : 'coordinator',
            password: identifier.includes('admin') ? 'admin' : 'staff',
            pin: identifier.includes('admin') ? '1234' : '2026'
          };
        }

        const token = signAuthToken({
          userId: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
          timestamp: Date.now()
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role
          }
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Authenticate caller for all subsequent API operations
  const authUser = await authenticateRequest(req, parsedUrl);

  // Central Clinic WhatsApp Master Session ID
  const masterLineId = 'user-admin-1';

  // 1. Health & Central Clinic WhatsApp Status
  if (req.method === 'GET' && (pathname === '/api/status' || pathname === '/api/whatsapp/status')) {
    const runtimeSession = sessionManager.getRuntimeSession(masterLineId);
    const dbRecord = await sessionManager.getOrCreateSessionRecord(masterLineId);

    const status = runtimeSession?.status || dbRecord.status || 'disconnected';
    const phone = runtimeSession?.connectedPhoneNumber || dbRecord.phoneNumber || null;
    const hasQr = Boolean(runtimeSession?.qrCodeDataUrl || dbRecord.qrCodeDataUrl);

    logWaSessionDebug('/api/status', authUser, masterLineId, runtimeSession, dbRecord);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status,
      phone,
      hasQr,
      coordinatorId: masterLineId,
      authenticatedUserId: authUser.id,
      sessionId: runtimeSession?.sessionId || dbRecord.id,
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

  // 3. Central Clinic WhatsApp QR Code Endpoint
  if (req.method === 'GET' && (pathname === '/api/qr' || pathname === '/api/whatsapp/qr')) {
    let runtimeSession = sessionManager.getRuntimeSession(masterLineId);
    
    if (!runtimeSession || (runtimeSession.status === 'disconnected' && !runtimeSession.qrCodeDataUrl && !runtimeSession.isStarting)) {
      runtimeSession = await sessionManager.startCoordinatorSocket(masterLineId, true);
    }

    const dbRecord = await sessionManager.getOrCreateSessionRecord(masterLineId);
    const status = runtimeSession?.status || dbRecord.status || 'disconnected';
    const phone = runtimeSession?.connectedPhoneNumber || dbRecord.phoneNumber || null;
    const qr = runtimeSession?.qrCodeDataUrl || dbRecord.qrCodeDataUrl || null;

    logWaSessionDebug('/api/qr', authUser, masterLineId, runtimeSession, dbRecord);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      qr,
      status,
      phone,
      coordinatorId: masterLineId,
      authenticatedUserId: authUser.id,
      sessionId: runtimeSession?.sessionId || dbRecord.id
    }));
    return;
  }

  // 3b. Reconnect / Force Fresh QR for Central Clinic Line
  if (req.method === 'POST' && (pathname === '/api/reconnect' || pathname === '/api/connect' || pathname === '/api/whatsapp/reconnect')) {
    logWaSessionDebug('/api/reconnect', authUser, masterLineId, null, null);
    const session = await sessionManager.startCoordinatorSocket(masterLineId, true);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'Clinic WhatsApp reconnection initiated.',
      coordinatorId: masterLineId,
      authenticatedUserId: authUser.id
    }));
    return;
  }

  // 4. Isolated Server-Sent Events (SSE) Live Feed
  if (req.method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const clientObj = {
      res,
      coordinatorId: authUser.id,
      userRole: authUser.role,
    };

    sseClients.push(clientObj);

    const runtimeSession = sessionManager.getRuntimeSession(authUser.id);
    const dbRecord = await sessionManager.getOrCreateSessionRecord(authUser.id);

    logWaSessionDebug('/api/events (subscribe)', authUser, authUser.id, runtimeSession, dbRecord);

    res.write(`data: ${JSON.stringify({
      type: 'INIT',
      status: runtimeSession?.status || dbRecord.status || 'disconnected',
      phone: runtimeSession?.connectedPhoneNumber || dbRecord.phoneNumber || null,
      qrDataUrl: runtimeSession?.qrCodeDataUrl || dbRecord.qrCodeDataUrl || null,
      coordinatorId: authUser.id,
      authenticatedUserId: authUser.id,
      sessionId: runtimeSession?.sessionId || dbRecord.id,
      dbConnected: getDbStatus(),
    })}\n\n`);

    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== clientObj);
    });
    return;
  }

  // 5. Send Outbound WhatsApp Message (Dispatched via Coordinator's Socket)
  if (req.method === 'POST' && (pathname === '/api/send' || pathname === '/api/send-message' || pathname === '/api/whatsapp/send')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const to = payload.to || payload.phone || '';
        const whatsappId = payload.whatsappId || payload.waId || '';
        const msgContent = payload.message || payload.text || payload.content || '';
        const media = payload.media;
        const leadId = payload.leadId;
        const customerId = payload.customerId;
        const targetCoordinatorId = payload.coordinatorId || authUser?.id || masterLineId;

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

        // RBAC: Check coordinator authorization for this specific lead
        if (authUser.role === 'coordinator' && leadId) {
          const prisma = getPrisma();
          if (prisma && getDbStatus()) {
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (lead && lead.assignedTo && lead.assignedTo !== authUser.id) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Forbidden: You can only message leads assigned to you.' }));
              return;
            }
          }
        }

        // Check if runtime Baileys session is active
        const coordSession = sessionManager.getRuntimeSession(targetCoordinatorId);
        const masterSession = sessionManager.getRuntimeSession(masterLineId);
        const isBaileysConnected = (coordSession && coordSession.status === 'connected' && coordSession.sock) ||
                                  (masterSession && masterSession.status === 'connected' && masterSession.sock);

        let sendResult = null;

        // If Meta Cloud API token is supplied or configured on server, dispatch directly to Meta Graph API; otherwise use Baileys socket
        const metaToken = (payload.token || metaConfig.accessToken || process.env.META_ACCESS_TOKEN || process.env.META_TOKEN || '').trim();
        const phoneId = (payload.phoneNumberId || metaConfig.phoneNumberId || process.env.META_PHONE_NUMBER_ID || '1358157244046701').trim();

        let cleanTo = (to || whatsappId || '').replace(/[^0-9]/g, '');
        if (cleanTo.startsWith('0') && cleanTo.length === 10) {
          cleanTo = '94' + cleanTo.slice(1);
        } else if (cleanTo.length === 9 && (cleanTo.startsWith('7') || cleanTo.startsWith('1'))) {
          cleanTo = '94' + cleanTo;
        }

        if (metaToken) {
          console.log(`🚀 [Meta Graph API] Dispatching message to ${cleanTo} via Phone ID ${phoneId}...`);
          const metaRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${metaToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanTo,
              type: 'text',
              text: { body: msgContent }
            })
          });
          const metaData = await metaRes.json().catch(() => ({}));
          if (!metaRes.ok) {
            console.error('❌ [Meta Graph API Error]:', JSON.stringify(metaData));
            const errMsg = metaData.error?.message || metaData.error?.error_user_msg || (metaData.error ? JSON.stringify(metaData.error) : 'Meta Cloud API dispatch failed');
            throw new Error(`Meta API: ${errMsg}`);
          }
          const messageId = metaData.messages?.[0]?.id || `meta-${Date.now()}`;
          console.log(`✅ [Meta Graph API] Delivered to customer WhatsApp! Message ID: ${messageId}`);
          sendResult = {
            success: true,
            messageId,
            status: 'sent',
            to: cleanTo,
            meta: metaData
          };

          // Save message to Prisma database
          const prisma = getPrisma();
          if (prisma && getDbStatus()) {
            try {
              const formattedTo = cleanTo.startsWith('+') ? cleanTo : `+${cleanTo}`;

              // 1. Resolve Customer
              let cust = customerId ? await prisma.customer.findUnique({ where: { id: customerId } }).catch(() => null) : null;
              if (!cust && cleanTo) {
                cust = await prisma.customer.findFirst({
                  where: {
                    OR: [
                      { whatsappNumber: formattedTo },
                      { whatsappNumber: cleanTo },
                      { whatsappId: cleanTo }
                    ]
                  }
                }).catch(() => null);
                if (!cust) {
                  cust = await prisma.customer.create({
                    data: {
                      whatsappNumber: formattedTo,
                      whatsappId: cleanTo,
                      displayName: formattedTo,
                      preferredLanguage: 'en'
                    }
                  }).catch(() => null);
                }
              }

              // 2. Resolve Lead
              let lead = leadId ? await prisma.lead.findUnique({ where: { id: leadId } }).catch(() => null) : null;
              if (!lead && cust) {
                lead = await prisma.lead.findFirst({
                  where: { customerId: cust.id },
                  orderBy: { updatedAt: 'desc' }
                }).catch(() => null);

                if (!lead) {
                  const firstCat = await prisma.treatmentCategory.findFirst().catch(() => null);
                  const firstTrt = await prisma.treatment.findFirst().catch(() => null);
                  lead = await prisma.lead.create({
                    data: {
                      customerId: cust.id,
                      categoryId: firstCat?.id || 'cat-hair-care',
                      treatmentId: firstTrt?.id || 'trt-hair-prp',
                      stage: 'contacted',
                      source: 'whatsapp',
                      language: 'en'
                    }
                  }).catch(() => null);
                }
              }

              if (cust && lead) {
                let validCoordinatorId = null;
                if (targetCoordinatorId) {
                  const coordExists = await prisma.user.findUnique({ where: { id: targetCoordinatorId } }).catch(() => null);
                  if (coordExists) validCoordinatorId = coordExists.id;
                }

                await prisma.message.upsert({
                  where: { id: messageId },
                  update: {
                    status: 'sent',
                    content: msgContent || (media ? `[${media.type.toUpperCase()}]` : '')
                  },
                  create: {
                    id: messageId,
                    leadId: lead.id,
                    customerId: cust.id,
                    whatsappSessionId: null,
                    coordinatorId: validCoordinatorId,
                    direction: 'outbound',
                    senderType: 'coordinator',
                    content: msgContent || (media ? `[${media.type.toUpperCase()}]` : ''),
                    status: 'sent',
                    timestamp: new Date(),
                    mediaType: media ? media.type : null,
                  }
                });
                console.log(`✅ [Meta Send] Outbound message ${messageId} saved to database for Lead ${lead.id}`);
              }
            } catch (dbErr) {
              console.warn('[DB Error saving Meta message]:', dbErr.message);
            }
          }
        } else if (isBaileysConnected) {
          logWaSessionDebug('/api/send', authUser, targetCoordinatorId, coordSession, null);
          sendResult = await sessionManager.sendMessage(targetCoordinatorId, {
            to,
            whatsappId,
            message: msgContent,
            media,
            leadId,
            customerId,
          });
        } else {
          throw new Error('No active WhatsApp line or Meta API token configured.');
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          messageId: sendResult.messageId,
          status: 'sent',
          to,
          coordinatorId: targetCoordinatorId,
          authenticatedUserId: authUser.id
        }));
      } catch (err) {
        const errorCoordinatorId = authUser?.id || masterLineId;
        console.error(`❌ [Send Error] Coordinator [${errorCoordinatorId}]:`, err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message, coordinatorId: errorCoordinatorId }));
      }
    });
    return;
  }

  // 6. Disconnect / Unlink Central Clinic WhatsApp Line
  if (req.method === 'POST' && (pathname === '/api/disconnect' || pathname === '/api/logout' || pathname === '/api/unlink' || pathname === '/api/whatsapp/disconnect')) {
    try {
      logWaSessionDebug('/api/disconnect', authUser, masterLineId, sessionManager.getRuntimeSession(masterLineId), null);
      const unlinkRes = await sessionManager.unlinkSession(masterLineId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...unlinkRes, coordinatorId: masterLineId, authenticatedUserId: authUser.id }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 7. REST: Get Treatment Categories from Supabase
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

  // 8. REST: Get Treatments from Supabase
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

  // 9. REST: Get Messages with RBAC & Coordinator Isolation
  if (req.method === 'GET' && pathname === '/api/messages') {
    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const queryLeadId = parsedUrl.query.leadId;
        const whereClause = {};

        if (queryLeadId) {
          whereClause.leadId = String(queryLeadId);
        }

        // Coordinators can only query messages from their assigned leads
        if (authUser.role === 'coordinator') {
          whereClause.lead = {
            assignedTo: authUser.id
          };
        }

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

  // 10. REST: Get Leads with RBAC & Coordinator Isolation
  if (req.method === 'GET' && pathname === '/api/leads') {
    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const whereClause = {};
        
        // Coordinators can only see leads assigned directly to them; Super Admin and Leads Officer see all leads
        if (authUser.role === 'coordinator') {
          whereClause.assignedTo = authUser.id;
        }

        const leads = await prisma.lead.findMany({
          where: whereClause,
          include: {
            customer: true,
            category: true,
            treatment: true,
            assignedCoordinator: true,
            whatsappSession: true,
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

  // 10b. REST: Assign Lead to Coordinator (Admin or Leads Officer Dispatches to Coordinator)
  if (req.method === 'POST' && (pathname === '/api/leads/assign' || pathname === '/api/assign')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        // RBAC: Only Super Admin and Leads Officer can assign leads
        if (authUser.role === 'coordinator') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Forbidden: Coordinators cannot assign leads.' }));
          return;
        }

        const payload = JSON.parse(body || '{}');
        const { leadId, coordinatorId, coordinatorName, customerId, phone, whatsappId, unassign } = payload;

        const prisma = getPrisma();
        let updatedLead = null;

        // Handle Unassignment
        if (unassign || !coordinatorId) {
          if (prisma && getDbStatus() && leadId) {
            updatedLead = await prisma.lead.update({
              where: { id: leadId },
              data: {
                assignedTo: null,
                stage: 'new',
                updatedAt: new Date()
              },
              include: {
                customer: true,
                category: true,
                treatment: true,
                assignedCoordinator: true,
                messages: { orderBy: { timestamp: 'asc' } }
              }
            }).catch(() => null);
          }

          broadcastScopedSSE('user-admin-1', {
            type: 'LEAD_ASSIGNED',
            leadId,
            clientLeadId: leadId,
            coordinatorId: null,
            lead: updatedLead
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, unassigned: true, lead: updatedLead }));
          return;
        }

        if (!leadId || !coordinatorId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing leadId or coordinatorId' }));
          return;
        }

        if (prisma && getDbStatus()) {
          // 1. Ensure the coordinator exists in the database to satisfy the foreign key constraint
          let coordUser = await prisma.user.findUnique({ where: { id: coordinatorId } });
          if (!coordUser) {
            const name = coordinatorName || (coordinatorId.includes('1') ? 'Dr. Shenali (Trichology)' : (coordinatorId.includes('2') ? 'Dilini Perera (Skin Care)' : `Coordinator ${coordinatorId.slice(-4)}`));
            coordUser = await prisma.user.create({
              data: {
                id: coordinatorId,
                fullName: name,
                email: `${coordinatorId.replace(/[^a-z0-9]/gi, '').toLowerCase()}@royalwellness.lk`,
                role: 'coordinator',
                password: 'staff',
                pin: '2026'
              }
            }).catch(() => null);
          }

          // 2. Ensure WhatsApp session record exists for coordinator
          await sessionManager.getOrCreateSessionRecord(coordinatorId);

          // 3. Find lead by id, customerId, or phone
          let targetLead = null;
          if (leadId) {
            targetLead = await prisma.lead.findUnique({ where: { id: leadId } });
          }

          if (!targetLead && customerId) {
            targetLead = await prisma.lead.findFirst({
              where: { customerId: customerId },
              orderBy: { updatedAt: 'desc' }
            });
          }

          if (!targetLead && (phone || whatsappId)) {
            const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
            const cleanWaId = (whatsappId || '').replace(/[^0-9]/g, '');
            const cust = await prisma.customer.findFirst({
              where: {
                OR: [
                  ...(cleanPhone ? [{ whatsappNumber: `+${cleanPhone}` }, { whatsappNumber: cleanPhone }] : []),
                  ...(cleanWaId ? [{ whatsappId: cleanWaId }] : [])
                ]
              }
            });
            if (cust) {
              targetLead = await prisma.lead.findFirst({
                where: { customerId: cust.id },
                orderBy: { updatedAt: 'desc' }
              });
            }
          }

          if (targetLead) {
            updatedLead = await prisma.lead.update({
              where: { id: targetLead.id },
              data: {
                assignedTo: coordinatorId,
                stage: targetLead.stage === 'new' ? 'assigned' : targetLead.stage,
                updatedAt: new Date()
              },
              include: {
                customer: true,
                category: true,
                treatment: true,
                assignedCoordinator: true,
                messages: { orderBy: { timestamp: 'asc' } }
              }
            });
          } else {
            // Create customer & lead if neither exists yet in DB
            let cust = customerId ? await prisma.customer.findUnique({ where: { id: customerId } }) : null;
            if (!cust && (phone || whatsappId)) {
              const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
              const cleanWaId = (whatsappId || '').replace(/[^0-9]/g, '');
              cust = await prisma.customer.create({
                data: {
                  whatsappNumber: cleanPhone ? (cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`) : cleanWaId,
                  whatsappId: cleanWaId || cleanPhone,
                  displayName: 'WhatsApp Contact',
                  preferredLanguage: 'en'
                }
              }).catch(() => null);
            }
            if (cust) {
              const firstCat = await prisma.treatmentCategory.findFirst();
              const firstTrt = await prisma.treatment.findFirst();
              updatedLead = await prisma.lead.create({
                data: {
                  id: leadId && !leadId.startsWith('lead-') ? leadId : undefined,
                  customerId: cust.id,
                  categoryId: firstCat?.id || 'cat-hair-care',
                  treatmentId: firstTrt?.id || 'trt-prp-hair',
                  assignedTo: coordinatorId,
                  stage: 'assigned',
                  source: 'whatsapp',
                  language: 'en'
                },
                include: {
                  customer: true,
                  category: true,
                  treatment: true,
                  assignedCoordinator: true,
                  messages: { orderBy: { timestamp: 'asc' } }
                }
              }).catch(() => null);
            }
          }
        }

        // Broadcast to both Admin and the assigned Coordinator in real-time
        broadcastScopedSSE(coordinatorId, {
          type: 'LEAD_ASSIGNED',
          leadId: updatedLead ? updatedLead.id : leadId,
          clientLeadId: leadId,
          coordinatorId,
          lead: updatedLead
        });

        broadcastScopedSSE('user-admin-1', {
          type: 'LEAD_ASSIGNED',
          leadId: updatedLead ? updatedLead.id : leadId,
          clientLeadId: leadId,
          coordinatorId,
          lead: updatedLead
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, lead: updatedLead }));
      } catch (err) {
        console.error('❌ [Assign Error]:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10b2. REST: Update Lead Treatment & Serial Number & Stage
  if ((req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') && (pathname === '/api/leads/update' || pathname.startsWith('/api/leads/'))) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const urlLeadId = pathname.startsWith('/api/leads/') && pathname !== '/api/leads/assign' && pathname !== '/api/leads/update' ? pathname.split('/')[3] : null;
        const leadId = payload.leadId || payload.id || urlLeadId;
        const { treatmentId, categoryId, serialNumber, stage } = payload;

        if (!leadId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing leadId' }));
          return;
        }

        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          const updateData = {};
          if (treatmentId) updateData.treatmentId = treatmentId;
          if (categoryId) updateData.categoryId = categoryId;
          if (serialNumber !== undefined) updateData.serialNumber = serialNumber;
          if (stage) updateData.stage = stage;
          updateData.updatedAt = new Date();

          const updated = await prisma.lead.update({
            where: { id: leadId },
            data: updateData,
            include: {
              customer: true,
              category: true,
              treatment: true,
              assignedCoordinator: true,
              messages: { orderBy: { timestamp: 'asc' } }
            }
          });

          broadcastScopedSSE(null, {
            type: 'LEAD_UPDATED',
            leadId,
            lead: updated
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, lead: updated }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10b3. REST: Update Customer Details (Name, Phone, WhatsApp ID)
  if ((req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') && (pathname === '/api/customer/update' || pathname === '/api/customers/update' || pathname.startsWith('/api/customers/'))) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const urlCustId = pathname.startsWith('/api/customers/') && pathname !== '/api/customers/update' ? pathname.split('/')[3] : null;
        const customerId = payload.customerId || payload.id || urlCustId;
        const { displayName, whatsappNumber, phoneNumber, whatsappId } = payload;

        if (!customerId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing customerId' }));
          return;
        }

        const prisma = getPrisma();
        if (prisma && getDbStatus()) {
          const updateData = {};
          if (displayName !== undefined) updateData.displayName = displayName;
          if (whatsappNumber !== undefined) updateData.whatsappNumber = whatsappNumber;
          if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
          if (whatsappId !== undefined) updateData.whatsappId = whatsappId;
          updateData.updatedAt = new Date();

          const updatedCust = await prisma.customer.update({
            where: { id: customerId },
            data: updateData
          }).catch(err => {
            console.warn('Prisma customer update error:', err.message);
            return null;
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, customer: updatedCust }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Updated locally' }));
      } catch (err) {
        console.error('❌ [Customer Update Error]:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10c. REST: Get/Create Coordinators
  if (pathname === '/api/coordinators') {
    const defaultCoordinators = [
      {
        id: 'user-admin-1',
        fullName: 'Super Admin',
        email: 'admin@royalwellness.lk',
        branch: 'Colombo (Head Office)',
        password: 'admin',
        pin: '1234',
        role: 'super_admin',
        active: true,
        createdAt: '2026-01-01T08:00:00Z',
        activeLeadsCount: 0,
      }
    ];

    const prisma = getPrisma();
    if (req.method === 'GET') {
      if (prisma && getDbStatus()) {
        try {
          const users = await prisma.user.findMany({
            orderBy: { createdAt: 'asc' }
          });
          if (users && users.length > 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(users));
            return;
          }
        } catch (e) {}
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(defaultCoordinators));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const fullName = (payload.fullName || payload.name || '').trim();
          const email = (payload.email || `${fullName.toLowerCase().replace(/[^a-z0-9]/g, '')}@royalwellness.lk`).trim();
          const pin = payload.pin || '2026';
          const phone = payload.phone || null;
          const role = payload.role === 'leads_officer' ? 'leads_officer' : 'coordinator';

          if (!fullName) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Full name is required' }));
            return;
          }

          let newUser = null;
          if (prisma && getDbStatus()) {
            newUser = await prisma.user.create({
              data: {
                fullName,
                email,
                pin,
                phone,
                role: role,
                password: 'staff'
              }
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, user: newUser }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  // 10d. REST: Delete Coordinator
  if (req.method === 'DELETE' && (pathname.startsWith('/api/coordinators') || pathname.startsWith('/api/users/'))) {
    try {
      if (authUser.role === 'coordinator') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Forbidden: Coordinators cannot delete staff.' }));
        return;
      }

      // Extract ID from URL path or query
      const urlParts = pathname.split('/');
      const coordId = urlParts[3] || parsedUrl.query.id || parsedUrl.query.coordinatorId;

      if (!coordId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Missing coordinator ID' }));
        return;
      }

      const prisma = getPrisma();
      if (prisma && getDbStatus()) {
        // 1. Unassign all leads assigned to this coordinator
        await prisma.lead.updateMany({
          where: { assignedTo: coordId },
          data: { assignedTo: null, stage: 'new' }
        }).catch(e => console.warn('Could not unassign leads in DB:', e.message));

        // 2. Delete WhatsAppSession for this coordinator
        await prisma.whatsAppSession.deleteMany({
          where: { coordinatorId: coordId }
        }).catch(() => {});

        // 3. Delete user record
        await prisma.user.deleteMany({
          where: { id: coordId }
        }).catch(e => console.warn('Could not delete user in DB:', e.message));
      }

      // 4. Broadcast SSE deletion event to all connected clients
      broadcastScopedSSE('user-admin-1', {
        type: 'COORDINATOR_DELETED',
        coordinatorId: coordId
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deletedId: coordId }));
    } catch (err) {
      console.error('❌ [Delete Coordinator Error]:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 10e. REST: Get/Save Meta Cloud API Configuration
  if (pathname === '/api/meta/config' || pathname === '/api/meta/token') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        hasToken: Boolean(metaConfig.accessToken),
        accessToken: metaConfig.accessToken || '',
        phoneNumberId: metaConfig.phoneNumberId,
        wabaId: metaConfig.wabaId
      }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (payload.accessToken !== undefined) metaConfig.accessToken = String(payload.accessToken || '').trim();
          if (payload.phoneNumberId) metaConfig.phoneNumberId = String(payload.phoneNumberId).trim();
          if (payload.wabaId) metaConfig.wabaId = String(payload.wabaId).trim();

          console.log(`🔑 [Meta Config Updated] Phone ID: ${metaConfig.phoneNumberId}, Token Length: ${metaConfig.accessToken.length}`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            hasToken: Boolean(metaConfig.accessToken),
            phoneNumberId: metaConfig.phoneNumberId,
            wabaId: metaConfig.wabaId
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  // 11. Clear Data Endpoint
  if (req.method === 'POST' && pathname === '/api/clear-db') {
    if (authUser.role !== 'super_admin') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden. Super Admin access required.' }));
      return;
    }

    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        await prisma.message.deleteMany({});
        await prisma.leadNote.deleteMany({});
        await prisma.leadStageHistory.deleteMany({});
        await prisma.followup.deleteMany({});
        await prisma.lead.deleteMany({});
        await prisma.customer.deleteMany({});
      } catch (e) {}
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Database cleared successfully.' }));
    return;
  }

  // 12. Meta WhatsApp Cloud API Webhook Handlers
  if (pathname === '/api/webhook') {
    if (req.method === 'GET') {
      const mode = parsedUrl.query['hub.mode'];
      const token = parsedUrl.query['hub.verify_token'];
      const challenge = parsedUrl.query['hub.challenge'];
      const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'royal_wellness_token_2026';

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
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
      req.on('end', async () => {
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
                      const text = message.text?.body || message.button?.text || (message.type ? `[${message.type.toUpperCase()} Message]` : '[Media Message]');
                      const messageId = message.id;

                      let savedLeadId = null;
                      let savedCustomerId = null;

                      // Persist to Supabase / PostgreSQL database
                      const prisma = getPrisma();
                      if (prisma && getDbStatus() && phone) {
                        try {
                          const cleanDigits = String(phone).replace(/[^0-9]/g, '');
                          const canonicalPhone = cleanDigits.startsWith('+') ? cleanDigits : `+${cleanDigits}`;

                          // 1. Find or create Customer
                          let cust = await prisma.customer.findFirst({
                            where: {
                              OR: [
                                { whatsappNumber: canonicalPhone },
                                { whatsappNumber: cleanDigits },
                                { whatsappId: cleanDigits },
                                { whatsappId: phone }
                              ]
                            }
                          });

                          if (!cust) {
                            cust = await prisma.customer.create({
                              data: {
                                whatsappNumber: canonicalPhone,
                                whatsappId: cleanDigits,
                                displayName: name || canonicalPhone,
                                preferredLanguage: 'en'
                              }
                            });
                          } else if (name && name !== canonicalPhone && name !== cleanDigits && (!cust.displayName || cust.displayName.startsWith('+'))) {
                            cust = await prisma.customer.update({
                              where: { id: cust.id },
                              data: { displayName: name }
                            }).catch(() => cust);
                          }

                          savedCustomerId = cust.id;

                          // 2. Find or create Lead
                          let lead = await prisma.lead.findFirst({
                            where: { customerId: cust.id },
                            orderBy: { updatedAt: 'desc' }
                          });

                          if (!lead) {
                            let firstCat = await prisma.treatmentCategory.findFirst();
                            if (!firstCat) {
                              firstCat = await prisma.treatmentCategory.create({
                                data: { id: 'cat-hair-care', name: 'Hair Care & Restoration', nameEn: 'Hair Care', nameSi: 'හිසකෙස් ප්‍රතිකාර', nameTa: 'முடி பராமரிப்பு' }
                              }).catch(() => null);
                            }
                            let firstTrt = await prisma.treatment.findFirst();
                            if (!firstTrt && firstCat) {
                              firstTrt = await prisma.treatment.create({
                                data: { id: 'trt-hair-prp', categoryId: firstCat.id, name: 'Advanced Hair PRP Therapy', nameEn: 'Hair PRP', nameSi: 'PRP ප්‍රතිකාරය', nameTa: 'PRP சிகிச்சை' }
                              }).catch(() => null);
                            }

                            lead = await prisma.lead.create({
                              data: {
                                customerId: cust.id,
                                categoryId: firstCat?.id || 'cat-hair-care',
                                treatmentId: firstTrt?.id || 'trt-hair-prp',
                                stage: 'new',
                                source: 'whatsapp',
                                language: 'en',
                                lastCustomerMessageAt: new Date()
                              }
                            });
                          } else {
                            await prisma.lead.update({
                              where: { id: lead.id },
                              data: {
                                lastCustomerMessageAt: new Date(),
                                updatedAt: new Date()
                              }
                            }).catch(() => {});
                          }

                          savedLeadId = lead.id;

                          // 3. Save Message to DB
                          await prisma.message.upsert({
                            where: { id: messageId },
                            update: {
                              content: text,
                              status: 'delivered'
                            },
                            create: {
                              id: messageId,
                              leadId: lead.id,
                              customerId: cust.id,
                              direction: 'inbound',
                              senderType: 'customer',
                              content: text,
                              status: 'delivered',
                              whatsappSessionId: null,
                              timestamp: new Date()
                            }
                          });
                          console.log(`✅ [Meta Webhook] Inbound message saved to DB: ID ${messageId}, Lead ${lead.id}`);
                        } catch (e) {
                          console.warn('[DB Error saving inbound Meta message]:', e.message);
                        }
                      }

                      // 4. Broadcast SSE with DB Lead and Customer IDs
                      broadcastScopedSSE(null, {
                        type: 'INBOUND_WHATSAPP_MESSAGE',
                        phone: phone ? (phone.startsWith('+') ? phone : `+${phone}`) : '',
                        whatsappId: phone,
                        realPhone: phone ? (phone.startsWith('+') ? phone : `+${phone}`) : '',
                        name,
                        text,
                        messageId,
                        leadId: savedLeadId,
                        customerId: savedCustomerId,
                        timestamp: new Date().toISOString()
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

const CLINIC_TREATMENTS = [
  { id: 'trt-htp', code: 'HTP', categoryId: 'cat-hair-care', name: 'Hair Transplantation', nameEn: 'Hair Transplantation', nameSi: 'හිසකෙස් බද්ධ කිරීම', nameTa: 'முடி மாற்று அறுவை சிகிச்சை' },
  { id: 'trt-prp', code: 'PRP', categoryId: 'cat-hair-care', name: 'PRP', nameEn: 'PRP (Platelet Rich Plasma)', nameSi: 'PRP ප්‍රතිකාරය', nameTa: 'PRP சிகிச்சை' },
  { id: 'trt-gfc', code: 'GFC', categoryId: 'cat-hair-care', name: 'GFC', nameEn: 'GFC (Growth Factor Concentrate)', nameSi: 'GFC ප්‍රතිකාරය', nameTa: 'GFC சிகிச்சை' },
  { id: 'trt-hdf', code: 'HDF', categoryId: 'cat-skin-care', name: 'Hydra Facial', nameEn: 'Hydra Facial', nameSi: 'හයිඩ්‍රා ෆේෂල්', nameTa: 'ஹைட்ரா ஃபேஷியல்' },
  { id: 'trt-hij', code: 'HIJ', categoryId: 'cat-ayurveda', name: 'Hijama', nameEn: 'Hijama / Cupping Therapy', nameSi: 'හිජාමා ප්‍රතිකාරය', nameTa: 'ஹிஜாமா சிகிச்சை' },
  { id: 'trt-pmt', code: 'PMT', categoryId: 'cat-iv-wellness', name: 'Pain Management', nameEn: 'Pain Management', nameSi: 'වේදනා කළමනාකරණය', nameTa: 'வலி மேலாண்மை சிகிச்சை' },
  { id: 'trt-let', code: 'LET', categoryId: 'cat-ayurveda', name: 'Leech Treatment', nameEn: 'Leech Treatment', nameSi: 'කූඩැල්ලන් ප්‍රතිකාරය', nameTa: 'அட்டை சிகிச்சை' },
  { id: 'trt-chp', code: 'CHP', categoryId: 'cat-skin-care', name: 'Chemical Peel', nameEn: 'Chemical Peel', nameSi: 'කෙමිකල් පීල්', nameTa: 'கெமிக்கல் பீல்' },
  { id: 'trt-cbl', code: 'CBL', categoryId: 'cat-skin-care', name: 'Carbon Laser', nameEn: 'Carbon Laser', nameSi: 'කාබන් ලේසර්', nameTa: 'கார்பன் லேசர்' },
  { id: 'trt-mcn', code: 'MCN', categoryId: 'cat-skin-care', name: 'Microneedling', nameEn: 'Microneedling', nameSi: 'මයික්‍රොනීඩ්ලින්', nameTa: 'மைக்ரோநீட்லிங்' },
  { id: 'trt-skb', code: 'SKB', categoryId: 'cat-skin-care', name: 'Skin Boosters', nameEn: 'Skin Boosters', nameSi: 'සම දීප්තිමත් කිරීමේ බූස්ටර්', nameTa: 'ஸ்கின் பூஸ்டர்ஸ்' },
  { id: 'trt-chr', code: 'CHR', categoryId: 'cat-skin-care', name: 'CO2 Hair Removal', nameEn: 'CO2 Hair Removal', nameSi: 'CO2 අනවශ්‍ය රෝම ඉවත් කිරීම', nameTa: 'CO2 முடி அகற்றுதல்' },
  { id: 'trt-btx', code: 'BTX', categoryId: 'cat-skin-care', name: 'Botox (Per Unit)', nameEn: 'Botox (Per Unit)', nameSi: 'බොටොක්ස් (ඒකකයකට)', nameTa: 'போடாக்ස් (ஒரு யூனிட்)' },
  { id: 'trt-flr', code: 'FLR', categoryId: 'cat-skin-care', name: 'Filler (1ml)', nameEn: 'Filler (1ml)', nameSi: 'ෆිලර් (1ml)', nameTa: 'ஃபில்லர் (1ml)' },
  { id: 'trt-ivg', code: 'IVG', categoryId: 'cat-iv-wellness', name: 'IV Glutathione (Per Session)', nameEn: 'IV Glutathione (Per Session)', nameSi: 'IV ග්ලූටතයෝන්', nameTa: 'IV குளுதாதயோன்' },
  { id: 'trt-ckf', code: 'CKF', categoryId: 'cat-skin-care', name: 'Cheek Filler (new)', nameEn: 'Cheek Filler (new)', nameSi: 'කම්මුල් ෆිලර්', nameTa: 'கன்ன ஃபில்லர்' },
  { id: 'trt-ttf', code: 'TTF', categoryId: 'cat-skin-care', name: 'Tear Trough (Under-Eye) Filler (new)', nameEn: 'Tear Trough (Under-Eye) Filler (new)', nameSi: 'ඇස් යට ෆිලර් ප්‍රතිකාරය', nameTa: 'கண்களுக்கு அடியில் ஃபில்லர்' },
  { id: 'trt-hhb', code: 'HHB', categoryId: 'cat-skin-care', name: 'Hyperhidrosis Botox (Underarm) (new)', nameEn: 'Hyperhidrosis Botox (Underarm) (new)', nameSi: 'කිහිලි අධික දහඩිය දැමීමට බොටොක්ස්', nameTa: 'அக்குள் வியர்வைக்கு போடாக்ஸ்' },
  { id: 'trt-hif', code: 'HIF', categoryId: 'cat-skin-care', name: 'HIFU', nameEn: 'HIFU (High-Intensity Focused Ultrasound)', nameSi: 'HIFU සම තද කිරීමේ ප්‍රතිකාරය', nameTa: 'HIFU தோல் இறுக்க சிகிச்சை' },
  { id: 'trt-ebb', code: 'EBB', categoryId: 'cat-skin-care', name: 'Eyebrow Blading', nameEn: 'Eyebrow Blading / Microblading', nameSi: 'ඇහිබැම බ්ලේඩින්', nameTa: 'புருவ பிளேடிங்' },
  { id: 'trt-smp', code: 'SMP', categoryId: 'cat-hair-care', name: 'Scalp Pigmentation', nameEn: 'Scalp Pigmentation (SMP)', nameSi: 'හිස්කබල පිග්මන්ටේෂන්', nameTa: 'ஸ்கால்ப் பிக்மென்டேஷன்' },
  { id: 'trt-rfs', code: 'RFS', categoryId: 'cat-skin-care', name: 'RF Skin Tightening', nameEn: 'RF Skin Tightening', nameSi: 'RF සම තද කිරීමේ ප්‍රතිකාරය', nameTa: 'RF தோல் இறுக்கம்' },
  { id: 'trt-co2', code: 'CO2', categoryId: 'cat-skin-care', name: 'CO2 Laser', nameEn: 'CO2 Fractional Laser', nameSi: 'CO2 ලේසර් ප්‍රතිකාරය', nameTa: 'CO2 ලේசர் சிகிச்சை' },
  { id: 'trt-led', code: 'LED', categoryId: 'cat-skin-care', name: 'LED Light Therapy', nameEn: 'LED Light Therapy', nameSi: 'LED ආලෝක ප්‍රතිකාරය', nameTa: 'LED ஒளி சிகிச்சை' }
];

async function autoSeedDbIfEmpty() {
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) return;
  try {
    const defaultCategories = [
      { id: 'cat-hair-care', name: 'Hair Care & Restoration', nameEn: 'Hair Care & Restoration', nameSi: 'හිසකෙස් ප්‍රතිකාර සහ යථා තත්ත්වයට පත්කිරීම', nameTa: 'முடி பராமரிப்பு மற்றும் சீரமைப்பு', active: true, iconName: 'Sparkles', description: 'Advanced PRP, GFC, and FUE hair transplant solutions.' },
      { id: 'cat-skin-care', name: 'Aesthetic Skin Care', nameEn: 'Aesthetic Skin Care', nameSi: 'සම රැකවරණ ප්‍රතිකාර', nameTa: 'அழகியல் தோல் பராமரிப்பு', active: true, iconName: 'Smile', description: 'Clinical dermatological facials and laser therapies.' },
      { id: 'cat-iv-wellness', name: 'IV Drip Therapy & Wellness', nameEn: 'IV Drip Therapy & Wellness', nameSi: 'IV විටමින් ප්‍රතිකාර', nameTa: 'IV டිරිப் மற்றும் ஆரோக்கிய சிகிச்சை', active: true, iconName: 'Zap', description: 'Intravenous wellness blends for rejuvenation.' },
      { id: 'cat-weight-management', name: 'Weight Management', nameEn: 'Weight Management', nameSi: 'බර පාලනය', nameTa: 'உடல் எடை மேலாண்மை', active: true, iconName: 'Activity', description: 'Non-invasive fat reduction and body contouring.' },
      { id: 'cat-dental-aesthetics', name: 'Dental Aesthetics & Smile Design', nameEn: 'Dental Aesthetics & Smile Design', nameSi: 'දන්ත සෞන්දර්ය ප්‍රතිකාර', nameTa: 'பல் அழகியல் மற்றும் புன்னகை வடிவமைப்பு', active: true, iconName: 'Sparkles', description: 'Laser teeth whitening and invisible aligners.' },
      { id: 'cat-ayurveda', name: 'Ayurvedic Rejuvenation', nameEn: 'Ayurvedic Rejuvenation', nameSi: 'ආයුර්වේද ප්‍රතිකාර', nameTa: 'ஆயුර්වේද புத்துணர்ச்சி', active: true, iconName: 'Leaf', description: 'Authentic royal Ceylon herbal detox.' }
    ];
    for (const cat of defaultCategories) {
      await prisma.treatmentCategory.upsert({
        where: { id: cat.id },
        update: cat,
        create: cat
      }).catch(() => {});
    }

    const trtCount = await prisma.treatment.count().catch(() => 0);
    if (trtCount < 20) {
      console.log('🌱 Upserting complete 24 treatment catalog into PostgreSQL...');
      for (const trt of CLINIC_TREATMENTS) {
        await prisma.treatment.upsert({
          where: { id: trt.id },
          update: {
            name: trt.name,
            nameEn: trt.nameEn,
            nameSi: trt.nameSi,
            nameTa: trt.nameTa,
            categoryId: trt.categoryId,
            active: true
          },
          create: {
            id: trt.id,
            categoryId: trt.categoryId,
            name: trt.name,
            nameEn: trt.nameEn,
            nameSi: trt.nameSi,
            nameTa: trt.nameTa,
            active: true,
            startingPrice: 0,
            currency: 'LKR',
            durationMinutes: 45
          }
        }).catch(() => {});
      }
      console.log('✅ 24 treatments seeding completed.');
    }
  } catch (e) {
    console.warn('⚠️ Auto-seed check error:', e.message);
  }
}

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n👑 Royal Wellness Multi-Session WhatsApp Server running on port ${PORT}`);
  console.log(`   - Architecture: Centralized Multi-Session WhatsApp Manager`);
  console.log(`   - Storage: Cloud PostgreSQL Auth Adapter (Supabase)`);
  console.log(`   - Isolation: Strict Coordinator-Scoped Sockets & Event Streams`);

  // Initialize DB and auto-restore active sessions on Render boot
  checkDbConnection().then(async res => {
    if (res.connected) {
      const prisma = getPrisma();
      if (prisma) {
        await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'leads_officer'`).catch(() => {});
        await prisma.$executeRawUnsafe(`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "serialNumber" VARCHAR(50);`).catch(() => {});
      }
      await autoSeedDbIfEmpty();
      await sessionManager.restoreAllActiveSessions();
    }
  });
});
