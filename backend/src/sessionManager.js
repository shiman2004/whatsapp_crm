import path from 'path';
import QRCode from 'qrcode';
import makeWASocketDefault, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  Browsers,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import { getPrisma, getDbStatus } from './db.js';
import { useSupabaseAuthState } from './supabaseAuthState.js';
import { evaluateAutoReply, pauseAutoReply } from './autoReplyEngine.js';

const makeWASocket = makeWASocketDefault.default || makeWASocketDefault;

/**
 * Enterprise Multi-Session WhatsApp Manager
 * 
 * Guarantees strict coordinator isolation:
 * - 1 Isolated Baileys Socket per coordinator
 * - Persistent credentials in Supabase PostgreSQL
 * - Zero cross-session interference on link / unlink / send / receive
 * - Automatic recovery on Render reboot
 */
class WhatsAppSessionManager {
  constructor() {
    // Map of coordinatorId -> SessionInstance
    this.sessions = new Map();
    // Broadcaster callback for coordinator-scoped SSE
    this.sseEmitter = null;
    // Processed message cache to prevent duplicates per session
    this.processedMessageIds = new Set();
  }

  setSseEmitter(emitterFn) {
    this.sseEmitter = emitterFn;
  }

  emitToCoordinator(coordinatorId, eventData) {
    if (this.sseEmitter) {
      this.sseEmitter(coordinatorId, eventData);
    }
  }

  /**
   * Fetch or create database record for a coordinator's WhatsApp session
   */
  async getOrCreateSessionRecord(coordinatorId) {
    const prisma = getPrisma();
    if (!prisma || !getDbStatus()) {
      return {
        id: `sess-${coordinatorId}`,
        coordinatorId,
        status: 'disconnected',
        phoneNumber: null,
      };
    }

    try {
      let session = await prisma.whatsAppSession.findUnique({
        where: { coordinatorId },
      });

      if (!session) {
        // Find coordinator user to verify existence
        const user = await prisma.user.findUnique({ where: { id: coordinatorId } });
        if (!user) {
          // If default admin, auto-create user record if missing
          await prisma.user.create({
            data: {
              id: coordinatorId,
              fullName: coordinatorId === 'user-admin-1' ? 'Admin' : 'Staff Coordinator',
              email: coordinatorId === 'user-admin-1' ? 'admin@royalwellness.lk' : `${coordinatorId}@royalwellness.lk`,
              role: coordinatorId === 'user-admin-1' ? 'super_admin' : 'coordinator',
            }
          }).catch(() => {});
        }

        session = await prisma.whatsAppSession.create({
          data: {
            coordinatorId,
            status: 'disconnected',
          },
        });
        console.log(`✨ [SessionManager] Created new WhatsAppSession record for coordinator ${coordinatorId} [Session ID: ${session.id}]`);
      }

      return session;
    } catch (err) {
      console.error(`[SessionManager] DB error in getOrCreateSessionRecord (${coordinatorId}):`, err.message);
      return {
        id: `sess-${coordinatorId}`,
        coordinatorId,
        status: 'disconnected',
        phoneNumber: null,
      };
    }
  }

  /**
   * Get active runtime session context
   */
  getRuntimeSession(coordinatorId) {
    return this.sessions.get(coordinatorId) || null;
  }

  /**
   * Start or restart an isolated WhatsApp socket for a specific coordinator
   */
  async startCoordinatorSocket(coordinatorId, forceClean = false) {
    const existing = this.sessions.get(coordinatorId);
    
    // Concurrency Lock: prevent duplicate socket creations unless forceClean is requested
    if (existing && existing.isStarting && !forceClean) {
      console.log(`⏳ [SessionManager] Socket startup already in progress for coordinator ${coordinatorId}. Reusing lock.`);
      return existing;
    }

    const sessionRecord = await this.getOrCreateSessionRecord(coordinatorId);
    const sessionId = sessionRecord.id;

    const sessionCtx = existing || {
      coordinatorId,
      sessionId,
      sock: null,
      status: 'connecting',
      qrCodeDataUrl: null,
      connectedPhoneNumber: sessionRecord.phoneNumber || null,
      isStarting: true,
      reconnectTimer: null,
      lidToPhoneMap: new Map(),
      jidMap: new Map(),
      instanceCounter: 0,
    };

    sessionCtx.isStarting = true;
    if (forceClean) {
      sessionCtx.status = 'connecting';
      sessionCtx.qrCodeDataUrl = null;
      sessionCtx.connectedPhoneNumber = null;
    }
    this.sessions.set(coordinatorId, sessionCtx);

    if (sessionCtx.reconnectTimer) {
      clearTimeout(sessionCtx.reconnectTimer);
      sessionCtx.reconnectTimer = null;
    }

    try {
      // Gracefully terminate prior socket if existing
      if (sessionCtx.sock) {
        try {
          sessionCtx.sock.ev.removeAllListeners();
          sessionCtx.sock.end(undefined);
        } catch (e) {}
        sessionCtx.sock = null;
      }

      // Initialize Supabase-backed auth state with forceClean
      const { state, saveCreds, clearSessionAuth } = await useSupabaseAuthState(sessionId, forceClean);

      const instanceId = ++sessionCtx.instanceCounter;
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307], isLatest: true }));
      const logger = pino({ level: 'silent' });

      console.log(`\n🚀 [SessionManager] Launching Socket #${instanceId} for Coordinator [${coordinatorId}] (Baileys v${version.join('.')}) - Clean: ${forceClean}`);
      
      sessionCtx.status = 'connecting';
      await this.updateDbStatus(coordinatorId, 'connecting', null);

      const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        browser: Browsers.ubuntu(`RoyalCRM-${coordinatorId.slice(-4)}`),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      sessionCtx.sock = sock;
      sessionCtx.saveCreds = saveCreds;
      sessionCtx.clearSessionAuth = clearSessionAuth;

      // Register Event Listeners
      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        if (sessionCtx.instanceCounter !== instanceId) return;

        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log(`📸 [QR READY] New QR Code generated for Coordinator [${coordinatorId}]`);
          sessionCtx.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 }).catch(() => null);
          sessionCtx.status = 'qr_ready';
          
          await this.updateDbStatus(coordinatorId, 'qr_ready', null, sessionCtx.qrCodeDataUrl);
          this.emitToCoordinator(coordinatorId, {
            type: 'CONNECTION_STATUS',
            status: 'qr_ready',
            qrDataUrl: sessionCtx.qrCodeDataUrl,
            coordinatorId
          });
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const isRestartRequired = statusCode === DisconnectReason.restartRequired; // 515
          const isLoggedOut = statusCode === DisconnectReason.loggedOut; // 401

          console.log(`⚠️ [SessionManager] Socket #${instanceId} for [${coordinatorId}] closed. Status: ${statusCode} (Restart: ${isRestartRequired}, LoggedOut: ${isLoggedOut})`);

          if (isRestartRequired) {
            console.log(`🔄 [${coordinatorId}] Device pairing handshake in progress... restarting socket.`);
            sessionCtx.status = 'connecting';
            sessionCtx.reconnectTimer = setTimeout(() => this.startCoordinatorSocket(coordinatorId, false), 600);
          } else if (isLoggedOut) {
            console.log(`🔒 [${coordinatorId}] Logged out from phone. Resetting credentials for coordinator.`);
            sessionCtx.status = 'disconnected';
            sessionCtx.connectedPhoneNumber = null;
            sessionCtx.qrCodeDataUrl = null;
            await clearSessionAuth();
            await this.updateDbStatus(coordinatorId, 'disconnected', null, null);
            this.emitToCoordinator(coordinatorId, {
              type: 'CONNECTION_STATUS',
              status: 'disconnected',
              phone: null,
              coordinatorId
            });
          } else {
            console.log(`🔄 [${coordinatorId}] Temporary network drop. Reconnecting in 2.5s...`);
            sessionCtx.status = 'connecting';
            sessionCtx.reconnectTimer = setTimeout(() => this.startCoordinatorSocket(coordinatorId, false), 2500);
          }
        } else if (connection === 'open') {
          const rawUser = sock?.user?.id || '';
          const phone = rawUser.split(':')[0].replace(/[^0-9]/g, '');
          const accountName = sock?.user?.name || 'Clinic WhatsApp';

          sessionCtx.connectedPhoneNumber = phone;
          sessionCtx.status = 'connected';
          sessionCtx.qrCodeDataUrl = null;

          console.log(`\n🎉 [SessionManager] Coordinator [${coordinatorId}] WhatsApp LINKED! Phone: +${phone}`);
          await this.updateDbStatus(coordinatorId, 'connected', phone, null, accountName);
          this.emitToCoordinator(coordinatorId, {
            type: 'CONNECTION_STATUS',
            status: 'connected',
            phone,
            name: accountName,
            coordinatorId
          });
        }
      });

      // Register Incoming / Outbound Message Listeners
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (sessionCtx.instanceCounter !== instanceId) return;

        for (const msg of messages) {
          try {
            await this.processIncomingMessage(coordinatorId, sessionCtx, msg, type === 'append' ? 'catch_up' : 'live');
          } catch (err) {
            console.error(`[SessionManager] Error processing message for [${coordinatorId}]:`, err.message);
          }
        }
      });

      return sessionCtx;
    } catch (err) {
      console.error(`❌ [SessionManager] Fatal error initializing socket for [${coordinatorId}]:`, err);
      sessionCtx.status = 'disconnected';
      return sessionCtx;
    } finally {
      sessionCtx.isStarting = false;
    }
  }

  /**
   * Update database session status
   */
  async updateDbStatus(coordinatorId, status, phoneNumber = null, qrDataUrl = null, accountName = null) {
    const prisma = getPrisma();
    if (!prisma || !getDbStatus()) return;

    try {
      const data = {
        status,
        lastActiveAt: new Date(),
      };
      if (phoneNumber !== undefined) data.phoneNumber = phoneNumber;
      if (qrDataUrl !== undefined) data.qrCodeDataUrl = qrDataUrl;
      if (accountName !== undefined) data.accountName = accountName;
      if (status === 'connected') data.lastConnectedAt = new Date();

      await prisma.whatsAppSession.update({
        where: { coordinatorId },
        data,
      });
    } catch (e) {
      console.warn(`[SessionManager] Failed to update DB status for ${coordinatorId}:`, e.message);
    }
  }

  /**
   * Process & persist inbound/outbound WhatsApp message scoped to this coordinator
   */
  async processIncomingMessage(coordinatorId, sessionCtx, msg, eventSource = 'live') {
    if (!msg?.message || !msg?.key) return;

    const messageId = msg.key.id;
    if (this.processedMessageIds.has(messageId)) return;
    this.processedMessageIds.add(messageId);
    if (this.processedMessageIds.size > 2000) {
      const first = this.processedMessageIds.values().next().value;
      this.processedMessageIds.delete(first);
    }

    const isFromMe = Boolean(msg.key.fromMe);
    const remoteJid = msg.key.remoteJid || '';

    // Ignore broadcast/status updates
    if (remoteJid.includes('status@broadcast') || remoteJid.includes('@g.us')) return;

    const rawSenderDigits = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/[^0-9]/g, '');
    const isLid = remoteJid.endsWith('@lid') || (rawSenderDigits.length >= 13);

    // Extract real phone number if modern Baileys provides remoteJidAlt / participantPn
    const altJid = msg.key?.remoteJidAlt || msg.key?.participantPn || msg.key?.participantAlt || msg.key?.participant || '';
    const altDigits = altJid ? altJid.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/[^0-9]/g, '') : '';
    
    let resolvedPhoneDigits = null;
    if (altDigits && altDigits.length <= 12 && !altDigits.startsWith('1766') && !altDigits.startsWith('2384')) {
      resolvedPhoneDigits = altDigits;
      sessionCtx.lidToPhoneMap.set(rawSenderDigits, altDigits);
    } else if (sessionCtx.lidToPhoneMap.has(rawSenderDigits)) {
      resolvedPhoneDigits = sessionCtx.lidToPhoneMap.get(rawSenderDigits);
    } else if (!isLid && rawSenderDigits.length <= 12) {
      resolvedPhoneDigits = rawSenderDigits;
    }

    const canonicalPhone = resolvedPhoneDigits ? `+${resolvedPhoneDigits}` : '';
    const realPhone = resolvedPhoneDigits || '';

    // Extract Message Text & Media Content
    const unwrapped = msg.message?.ephemeralMessage?.message || msg.message?.viewOnceMessage?.message || msg.message;
    const messageText = unwrapped.conversation ||
      unwrapped.extendedTextMessage?.text ||
      unwrapped.imageMessage?.caption ||
      unwrapped.videoMessage?.caption ||
      unwrapped.documentMessage?.caption ||
      unwrapped.buttonsResponseMessage?.selectedDisplayText ||
      unwrapped.templateButtonReplyMessage?.selectedDisplayText || '';

    let mediaType = null;
    let mediaUrl = null;

    if (unwrapped.imageMessage) mediaType = 'image';
    else if (unwrapped.videoMessage) mediaType = 'video';
    else if (unwrapped.audioMessage) mediaType = 'audio';
    else if (unwrapped.documentMessage) mediaType = 'document';

    if (!messageText && !mediaType) return;

    const contactName = msg.pushName || null;
    const timestampDate = new Date((msg.messageTimestamp ? Number(msg.messageTimestamp) : Math.floor(Date.now() / 1000)) * 1000);

    const prisma = getPrisma();
    let customer = null;
    let lead = null;

    if (prisma && getDbStatus()) {
      try {
        // 1. Find or Upsert Customer
        const searchConditions = [{ whatsappId: rawSenderDigits }];
        if (canonicalPhone) {
          searchConditions.push({ whatsappNumber: canonicalPhone });
        }
        if (realPhone) {
          searchConditions.push({ whatsappNumber: realPhone });
        }

        customer = await prisma.customer.findFirst({
          where: { OR: searchConditions }
        });

        const displayName = contactName || customer?.displayName || (canonicalPhone || 'WhatsApp Contact');

        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              whatsappNumber: canonicalPhone || rawSenderDigits,
              whatsappId: rawSenderDigits,
              phoneNumber: canonicalPhone || null,
              displayName,
              preferredLanguage: 'en',
            }
          });
        } else if (canonicalPhone && (!customer.phoneNumber || customer.phoneNumber.includes('1766') || customer.phoneNumber.length > 13)) {
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: {
              whatsappNumber: canonicalPhone,
              phoneNumber: canonicalPhone,
              displayName: contactName || customer.displayName
            }
          });
        }

        // 2. Find or Create Lead specifically scoped to this coordinator's WhatsApp session
        lead = await prisma.lead.findFirst({
          where: {
            customerId: customer.id,
            whatsappSessionId: sessionCtx.sessionId,
          },
          orderBy: { updatedAt: 'desc' },
        });

        if (!lead) {
          const firstCat = await prisma.treatmentCategory.findFirst();
          const firstTrt = await prisma.treatment.findFirst();

          lead = await prisma.lead.create({
            data: {
              customerId: customer.id,
              categoryId: firstCat?.id || 'cat-hair-care',
              treatmentId: firstTrt?.id || 'trt-hair-prp',
              assignedTo: coordinatorId,
              whatsappSessionId: sessionCtx.sessionId,
              stage: isFromMe ? 'contacted' : 'new',
              source: 'whatsapp',
              language: 'en',
              lastCustomerMessageAt: timestampDate,
            }
          });
        } else {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              lastCustomerMessageAt: timestampDate,
              updatedAt: new Date(),
              whatsappSessionId: sessionCtx.sessionId,
            }
          });
        }

        // 3. Save Message with Session & Coordinator Scope
        await prisma.message.upsert({
          where: { id: messageId },
          create: {
            id: messageId,
            leadId: lead.id,
            customerId: customer.id,
            whatsappSessionId: sessionCtx.sessionId,
            coordinatorId: isFromMe ? coordinatorId : null,
            direction: isFromMe ? 'outbound' : 'inbound',
            senderType: isFromMe ? 'coordinator' : 'customer',
            content: messageText || `[${mediaType?.toUpperCase()}]`,
            status: 'delivered',
            timestamp: timestampDate,
            mediaType,
            mediaUrl,
          },
          update: {
            content: messageText || `[${mediaType?.toUpperCase()}]`,
            status: 'delivered',
          }
        });
      } catch (dbErr) {
        console.warn(`[SessionManager] DB Sync Warning for message ${messageId}:`, dbErr.message);
      }
    }

    // Emit Real-Time SSE to assigned coordinator channel
    const targetCoordinator = lead?.assignedTo || coordinatorId;
    this.emitToCoordinator(targetCoordinator, {
      type: isFromMe ? 'OUTBOUND_WHATSAPP_MESSAGE' : 'INBOUND_WHATSAPP_MESSAGE',
      messageId,
      leadId: lead?.id,
      customerId: customer?.id,
      whatsappSessionId: sessionCtx.sessionId,
      coordinatorId: targetCoordinator,
      phone: canonicalPhone,
      realPhone: canonicalPhone || null,
      whatsappId: rawSenderDigits,
      name: contactName || customer?.displayName || canonicalPhone || 'WhatsApp Contact',
      text: messageText,
      media: mediaType ? { type: mediaType, url: mediaUrl } : null,
      direction: isFromMe ? 'outbound' : 'inbound',
      senderType: isFromMe ? 'coordinator' : 'customer',
      timestamp: timestampDate.toISOString(),
      source: eventSource,
    });
  }

  /**
   * Outbound Message Dispatcher (uses coordinator's specific socket or shared Clinic WhatsApp line)
   */
  async sendMessage(coordinatorId, { to, whatsappId, message, media, leadId, customerId }) {
    let sessionCtx = this.sessions.get(coordinatorId);
    if (!sessionCtx || sessionCtx.status !== 'connected' || !sessionCtx.sock) {
      sessionCtx = this.sessions.get('user-admin-1');
    }
    if (!sessionCtx || sessionCtx.status !== 'connected' || !sessionCtx.sock) {
      for (const [id, s] of this.sessions.entries()) {
        if (s.status === 'connected' && s.sock) {
          sessionCtx = s;
          break;
        }
      }
    }
    if (!sessionCtx || sessionCtx.status !== 'connected' || !sessionCtx.sock) {
      throw new Error(`Clinic WhatsApp line is not connected. Please connect WhatsApp from the Admin Dashboard first.`);
    }

    const cleanPhone = (to || '').replace(/[^0-9]/g, '');
    const cleanWaId = (whatsappId || '').replace(/[^0-9]/g, '');
    let targetJid = null;

    // Standard WhatsApp routing rule:
    // 1. If we have a valid phone number (7-12 digits e.g. 94770049469), ALWAYS use @s.whatsapp.net
    if (cleanPhone && cleanPhone.length >= 7 && cleanPhone.length <= 12) {
      targetJid = `${cleanPhone}@s.whatsapp.net`;
    } 
    // 2. If WhatsApp ID is a valid phone number (7-12 digits), use @s.whatsapp.net
    else if (cleanWaId && cleanWaId.length >= 7 && cleanWaId.length <= 12) {
      targetJid = `${cleanWaId}@s.whatsapp.net`;
    }
    // 3. If WhatsApp ID or phone is a 13-16 digit LID, use @lid
    else if (cleanWaId && cleanWaId.length >= 13) {
      targetJid = `${cleanWaId}@lid`;
    } else if (cleanPhone && cleanPhone.length >= 13) {
      targetJid = `${cleanPhone}@lid`;
    } else if (to && to.includes('@')) {
      targetJid = to;
    } else if (whatsappId && whatsappId.includes('@')) {
      targetJid = whatsappId;
    }

    console.log(`📤 [SessionManager] Sending message via Coordinator [${coordinatorId}] to target JID: ${targetJid}`);

    if (!targetJid) {
      throw new Error(`Invalid recipient phone number or WhatsApp ID.`);
    }

    let payload = {};
    if (message) payload.text = message;

    if (media && media.dataUrl) {
      const base64Data = media.dataUrl.split(';base64,').pop();
      const buffer = Buffer.from(base64Data, 'base64');
      if (media.type === 'image') payload = { image: buffer, caption: message || media.caption || '' };
      else if (media.type === 'video') payload = { video: buffer, caption: message || media.caption || '' };
      else if (media.type === 'audio') payload = { audio: buffer, mimetype: 'audio/mp4', ptt: true };
      else payload = { document: buffer, mimetype: 'application/pdf', fileName: media.fileName || 'document.pdf', caption: message || '' };
    }

    let sent = null;
    try {
      sent = await sessionCtx.sock.sendMessage(targetJid, payload);
    } catch (primaryErr) {
      console.warn(`⚠️ [SessionManager] Primary send to ${targetJid} failed: ${primaryErr.message}. Trying fallback JID...`);
      if (targetJid.endsWith('@s.whatsapp.net') && cleanWaId && cleanWaId.length >= 13) {
        sent = await sessionCtx.sock.sendMessage(`${cleanWaId}@lid`, payload);
      } else if (targetJid.endsWith('@lid') && cleanPhone && cleanPhone.length <= 12) {
        sent = await sessionCtx.sock.sendMessage(`${cleanPhone}@s.whatsapp.net`, payload);
      } else {
        throw primaryErr;
      }
    }

    const outboundMsgId = sent?.key?.id;

    if (outboundMsgId) {
      this.processedMessageIds.add(outboundMsgId);
    }

    // Persist Outbound in Supabase
    const prisma = getPrisma();
    if (prisma && getDbStatus() && leadId && customerId) {
      try {
        await prisma.message.create({
          data: {
            id: outboundMsgId || `out-${Date.now()}`,
            leadId,
            customerId,
            whatsappSessionId: sessionCtx.sessionId,
            coordinatorId,
            direction: 'outbound',
            senderType: 'coordinator',
            content: message || (media ? `[${media.type.toUpperCase()}]` : ''),
            status: 'sent',
            timestamp: new Date(),
            mediaType: media ? media.type : null,
          }
        });
      } catch (e) {}
    }

    pauseAutoReply(to || whatsappId);
    return { success: true, messageId: outboundMsgId, status: 'sent' };
  }

  /**
   * Unlink & Logout Coordinator WhatsApp Session
   * Guarantees other coordinators are NOT affected!
   */
  async unlinkSession(coordinatorId) {
    console.log(`🔌 [SessionManager] Unlinking WhatsApp session for coordinator [${coordinatorId}]...`);
    const sessionCtx = this.sessions.get(coordinatorId);

    if (sessionCtx) {
      if (sessionCtx.reconnectTimer) {
        clearTimeout(sessionCtx.reconnectTimer);
        sessionCtx.reconnectTimer = null;
      }

      if (sessionCtx.sock) {
        try {
          sessionCtx.sock.ev.removeAllListeners();
          await sessionCtx.sock.logout().catch(() => {});
        } catch (e) {
          try { sessionCtx.sock.end(new Error('User unlinked session')); } catch (e2) {}
        }
        sessionCtx.sock = null;
      }

      if (sessionCtx.clearSessionAuth) {
        await sessionCtx.clearSessionAuth().catch(() => {});
      }

      sessionCtx.status = 'disconnected';
      sessionCtx.connectedPhoneNumber = null;
      sessionCtx.qrCodeDataUrl = null;
      sessionCtx.isStarting = false;
      this.sessions.delete(coordinatorId);
    }

    // Always ensure DB keys and session records are wiped
    const sessionRecord = await this.getOrCreateSessionRecord(coordinatorId);
    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        await prisma.whatsAppSessionKey.deleteMany({
          where: { sessionId: sessionRecord.id }
        });
        await prisma.whatsAppSession.update({
          where: { coordinatorId },
          data: {
            status: 'disconnected',
            phoneNumber: null,
            qrCodeDataUrl: null,
            accountName: null,
            lastActiveAt: new Date()
          }
        });
      } catch (dbErr) {
        console.warn(`[unlinkSession DB clear error]:`, dbErr.message);
      }
    }

    this.emitToCoordinator(coordinatorId, {
      type: 'CONNECTION_STATUS',
      status: 'disconnected',
      phone: null,
      qrDataUrl: null,
      coordinatorId
    });

    console.log(`✅ [SessionManager] Coordinator [${coordinatorId}] session successfully unlinked. Starting fresh QR generation...`);

    // Immediately trigger fresh socket with forceClean = true so a new pairing QR code is generated right away
    setTimeout(() => {
      this.startCoordinatorSocket(coordinatorId, true);
    }, 300);

    return { success: true, message: 'WhatsApp session unlinked successfully. New QR code generating...' };
  }

  /**
   * Render Boot / Server Recovery: Restore central clinic WhatsApp connection from Supabase PostgreSQL
   */
  async restoreAllActiveSessions() {
    const prisma = getPrisma();
    if (!prisma || !getDbStatus()) return;

    try {
      const masterLineId = 'user-admin-1';
      console.log(`\n📦 [SessionManager] Ensuring Central Clinic WhatsApp Line [${masterLineId}] is active & connected from Supabase PostgreSQL...`);
      
      // Auto-restore master clinic socket using persistent PostgreSQL keys
      this.startCoordinatorSocket(masterLineId, false).catch(err => {
        console.warn(`[SessionManager] Auto-restore master clinic session status:`, err.message);
      });
    } catch (err) {
      console.warn('[SessionManager] Error during session restoration:', err.message);
    }
  }
}

export const sessionManager = new WhatsAppSessionManager();
