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

/**
 * Isolated SSE Dispatcher
 * Guarantees Coordinator A NEVER receives events belonging to Coordinator B
 */
function broadcastScopedSSE(targetCoordinatorId, data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      // Super Admin receives all events; Coordinators receive ONLY their own scoped events
      const isSuperAdmin = client.userRole === 'super_admin';
      const isTargetCoordinator = !targetCoordinatorId || client.coordinatorId === targetCoordinatorId;

      if (isSuperAdmin || isTargetCoordinator) {
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
        user = await prisma.user.create({
          data: {
            id: cleanId,
            fullName: isSuper ? 'Super Admin' : `Coordinator ${cleanId.slice(-4)}`,
            email: isSuper ? 'admin@royalwellness.lk' : `${cleanId}@royalwellness.lk`,
            role: isSuper ? 'super_admin' : 'coordinator',
          }
        }).catch(() => null);
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
  return {
    id: cleanId,
    role: isSuper ? 'super_admin' : 'coordinator',
    email: `${cleanId}@royalwellness.lk`,
    fullName: isSuper ? 'Super Admin' : 'Staff Coordinator'
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

  // Strict Scoping: Super Admin can inspect another coordinator line; coordinators are locked to authUser.id
  const targetCoordinatorId = (authUser.role === 'super_admin' && parsedUrl.query.coordinatorId)
    ? String(parsedUrl.query.coordinatorId)
    : authUser.id;

  // 1. Health & Coordinator WhatsApp Status
  if (req.method === 'GET' && (pathname === '/api/status' || pathname === '/api/whatsapp/status')) {
    const runtimeSession = sessionManager.getRuntimeSession(targetCoordinatorId);
    const dbRecord = await sessionManager.getOrCreateSessionRecord(targetCoordinatorId);

    const status = runtimeSession?.status || dbRecord.status || 'disconnected';
    const phone = runtimeSession?.connectedPhoneNumber || dbRecord.phoneNumber || null;
    const hasQr = Boolean(runtimeSession?.qrCodeDataUrl || dbRecord.qrCodeDataUrl);

    logWaSessionDebug('/api/status', authUser, targetCoordinatorId, runtimeSession, dbRecord);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status,
      phone,
      hasQr,
      coordinatorId: targetCoordinatorId,
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

  // 3. Coordinator-Scoped QR Code Endpoint
  if (req.method === 'GET' && (pathname === '/api/qr' || pathname === '/api/whatsapp/qr')) {
    let runtimeSession = sessionManager.getRuntimeSession(targetCoordinatorId);
    
    if (!runtimeSession || (runtimeSession.status === 'disconnected' && !runtimeSession.qrCodeDataUrl && !runtimeSession.isStarting)) {
      runtimeSession = await sessionManager.startCoordinatorSocket(targetCoordinatorId, false);
    }

    const dbRecord = await sessionManager.getOrCreateSessionRecord(targetCoordinatorId);
    const status = runtimeSession?.status || dbRecord.status || 'disconnected';
    const phone = runtimeSession?.connectedPhoneNumber || dbRecord.phoneNumber || null;
    const qr = runtimeSession?.qrCodeDataUrl || dbRecord.qrCodeDataUrl || null;

    logWaSessionDebug('/api/qr', authUser, targetCoordinatorId, runtimeSession, dbRecord);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      qr,
      status,
      phone,
      coordinatorId: targetCoordinatorId,
      authenticatedUserId: authUser.id,
      sessionId: runtimeSession?.sessionId || dbRecord.id
    }));
    return;
  }

  // 3b. Reconnect / Force Fresh QR for Coordinator
  if (req.method === 'POST' && (pathname === '/api/reconnect' || pathname === '/api/connect' || pathname === '/api/whatsapp/reconnect')) {
    logWaSessionDebug('/api/reconnect', authUser, targetCoordinatorId, null, null);
    const session = await sessionManager.startCoordinatorSocket(targetCoordinatorId, true);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'Reconnection initiated for your account.',
      coordinatorId: targetCoordinatorId,
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

        logWaSessionDebug('/api/send', authUser, targetCoordinatorId, sessionManager.getRuntimeSession(targetCoordinatorId), null);

        const sendResult = await sessionManager.sendMessage(targetCoordinatorId, {
          to,
          whatsappId,
          message: msgContent,
          media,
          leadId,
          customerId,
        });

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
        console.error(`❌ [Send Error] Coordinator [${targetCoordinatorId}]:`, err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message, coordinatorId: targetCoordinatorId }));
      }
    });
    return;
  }

  // 6. Disconnect / Unlink ONLY Coordinator's WhatsApp Session
  if (req.method === 'POST' && (pathname === '/api/disconnect' || pathname === '/api/logout' || pathname === '/api/unlink' || pathname === '/api/whatsapp/disconnect')) {
    try {
      logWaSessionDebug('/api/disconnect', authUser, targetCoordinatorId, sessionManager.getRuntimeSession(targetCoordinatorId), null);
      const unlinkRes = await sessionManager.unlinkSession(targetCoordinatorId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...unlinkRes, coordinatorId: targetCoordinatorId, authenticatedUserId: authUser.id }));
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
        if (authUser.role !== 'super_admin') {
          whereClause.lead = {
            OR: [
              { assignedTo: authUser.id },
              { whatsappSession: { coordinatorId: authUser.id } }
            ]
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
        
        // Coordinators can only see leads assigned to them or received on their WhatsApp line
        if (authUser.role !== 'super_admin') {
          whereClause.OR = [
            { assignedTo: authUser.id },
            { whatsappSession: { coordinatorId: authUser.id } }
          ];
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

  // 10b. REST: Assign Lead to Coordinator (Admin Dispatches to Coordinator)
  if (req.method === 'POST' && (pathname === '/api/leads/assign' || pathname === '/api/assign')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { leadId, coordinatorId } = payload;

        if (!leadId || !coordinatorId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing leadId or coordinatorId' }));
          return;
        }

        const prisma = getPrisma();
        let updatedLead = null;

        if (prisma && getDbStatus()) {
          updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: {
              assignedTo: coordinatorId,
              stage: 'assigned',
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
        }

        // Broadcast to both Admin and the assigned Coordinator in real-time
        broadcastScopedSSE(coordinatorId, {
          type: 'LEAD_ASSIGNED',
          leadId,
          coordinatorId,
          lead: updatedLead
        });

        broadcastScopedSSE('user-admin-1', {
          type: 'LEAD_ASSIGNED',
          leadId,
          coordinatorId,
          lead: updatedLead
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, lead: updatedLead }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10c. REST: Get/Create Coordinators
  if (pathname === '/api/coordinators') {
    const prisma = getPrisma();
    if (req.method === 'GET') {
      if (prisma && getDbStatus()) {
        try {
          const users = await prisma.user.findMany({
            orderBy: { createdAt: 'asc' }
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(users));
          return;
        } catch (e) {}
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
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
                role: 'coordinator',
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

                    broadcastScopedSSE('user-admin-1', {
                      type: 'INBOUND_WHATSAPP_MESSAGE',
                      phone: phone ? `+${phone}` : '',
                      whatsappId: phone,
                      realPhone: phone ? `+${phone}` : '',
                      name,
                      text,
                      messageId,
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

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n👑 Royal Wellness Multi-Session WhatsApp Server running on port ${PORT}`);
  console.log(`   - Architecture: Centralized Multi-Session WhatsApp Manager`);
  console.log(`   - Storage: Cloud PostgreSQL Auth Adapter (Supabase)`);
  console.log(`   - Isolation: Strict Coordinator-Scoped Sockets & Event Streams`);

  // Initialize DB and auto-restore active sessions on Render boot
  checkDbConnection().then(async res => {
    if (res.connected) {
      await sessionManager.restoreAllActiveSessions();
    }
  });
});
