import { getPrisma, getDbStatus } from './db.js';
import { getMetaAccessToken } from './legacyServer.js';
import { COMPANIES } from './companyConfig.js';
import { auditSecurityEvent } from './securityAudit.js';

// In-flight concurrency lock to prevent duplicate simultaneous reconnect clicks
const activeReconnects = new Set();

// Active rate limiting map for reconnect attempts (e.g. max 1 attempt per 5 seconds per connection)
const lastReconnectTimes = new Map();

/**
 * Return human-safe guidance for Meta API error codes
 */
function getMetaDiagnosticGuidance(error) {
  const code = error?.code || error?.error?.code;
  const subcode = error?.error_subcode || error?.error?.error_subcode;
  const msg = error?.message || error?.error?.message || '';

  if (code === 190 || /access token|session has expired|invalid oauth/i.test(msg)) {
    return {
      status: 'EXPIRED',
      reason: 'Meta Graph API access token has expired or is invalid.',
      action: 'Update META_ACCESS_TOKEN in the Render backend environment variables or server secret manager.'
    };
  }
  if (code === 100 && /does not exist|object with id/i.test(msg)) {
    return {
      status: 'ERROR',
      reason: 'The specified Phone Number ID or WABA ID was not found on Meta.',
      action: 'Verify Phone Number ID and WABA ID inside Meta WhatsApp Business Manager.'
    };
  }
  if (code === 200 || code === 10 || /permission/i.test(msg)) {
    return {
      status: 'ERROR',
      reason: 'Insufficient permissions on Meta System User or System App.',
      action: 'Ensure the System User token has whatsapp_business_messaging and whatsapp_business_management permissions.'
    };
  }
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(msg)) {
    return {
      status: 'DISCONNECTED',
      reason: 'Network connectivity failure connecting to Meta Graph API.',
      action: 'Check server outbound network access and Meta Platform status.'
    };
  }

  return {
    status: 'ERROR',
    reason: msg || 'Meta Cloud API reported an unhandled verification error.',
    action: 'Review Meta App configuration and check server error logs.'
  };
}

/**
 * Fallback static connections derived from companyConfig if database is unreachable
 */
function getFallbackConnections() {
  return [
    {
      id: 'conn-rwc',
      company: 'RWC',
      businessName: 'Royal Wellness Center',
      branch: 'Colombo (Head Office)',
      displayName: 'Royal Wellness Center',
      phoneNumber: '+94 70 639 3353',
      phoneNumberId: COMPANIES.RWC.phoneId,
      wabaId: process.env.META_WABA_ID || '2332922997481634',
      connectionStatus: 'UNKNOWN',
      qualityRating: 'UNKNOWN',
      codeVerificationStatus: 'UNKNOWN',
      webhookStatus: 'UNKNOWN',
      lastCheckedAt: null,
      lastConnectedAt: null,
      lastError: null,
      lastErrorAt: null,
      lastReconnectAttemptAt: null,
      reconnectInProgress: false
    },
    {
      id: 'conn-cras',
      company: 'CRAS',
      businessName: 'College of Royal Aesthetic of Sri Lanka',
      branch: 'Maruthamunai / Colombo',
      displayName: 'CRAS College',
      phoneNumber: '+94 70 637 3353',
      phoneNumberId: COMPANIES.CRAS.phoneId,
      wabaId: process.env.META_WABA_ID || '2332922997481634',
      connectionStatus: 'UNKNOWN',
      qualityRating: 'UNKNOWN',
      codeVerificationStatus: 'UNKNOWN',
      webhookStatus: 'UNKNOWN',
      lastCheckedAt: null,
      lastConnectedAt: null,
      lastError: null,
      lastErrorAt: null,
      lastReconnectAttemptAt: null,
      reconnectInProgress: false
    },
    {
      id: 'conn-ahc',
      company: 'AHC',
      businessName: 'Alpha Health Consultancy',
      branch: 'Dubai / International',
      displayName: 'Alpha Health Consultancy',
      phoneNumber: '+971 54 372 3912',
      phoneNumberId: COMPANIES.AHC.phoneId,
      wabaId: process.env.META_WABA_ID_AHC || '1141190518257266',
      connectionStatus: 'UNKNOWN',
      qualityRating: 'UNKNOWN',
      codeVerificationStatus: 'UNKNOWN',
      webhookStatus: 'UNKNOWN',
      lastCheckedAt: null,
      lastConnectedAt: null,
      lastError: null,
      lastErrorAt: null,
      lastReconnectAttemptAt: null,
      reconnectInProgress: false
    }
  ];
}

/**
 * Get all registered WhatsApp connections
 */
export async function getAllConnections() {
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) {
    return getFallbackConnections();
  }

  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT 
        id, company, business_name, branch, display_name, phone_number,
        phone_number_id, waba_id, connection_status, quality_rating,
        code_verification_status, webhook_status, last_checked_at,
        last_connected_at, last_error, last_error_at, last_reconnect_attempt_at,
        reconnect_in_progress, metadata
      FROM public.whatsapp_connections
      ORDER BY 
        CASE company 
          WHEN 'RWC' THEN 1 
          WHEN 'CRAS' THEN 2 
          WHEN 'AHC' THEN 3 
          ELSE 4 
        END ASC,
        id ASC;
    `);

    if (!rows || rows.length === 0) {
      return getFallbackConnections();
    }

    return rows.map((r) => ({
      id: r.id,
      company: r.company,
      businessName: r.business_name,
      branch: r.branch,
      displayName: r.display_name,
      phoneNumber: r.phone_number,
      phoneNumberId: r.phone_number_id,
      wabaId: r.waba_id,
      connectionStatus: activeReconnects.has(r.id) ? 'RECONNECTING' : (r.connection_status || 'UNKNOWN'),
      qualityRating: r.quality_rating || 'UNKNOWN',
      codeVerificationStatus: r.code_verification_status || 'UNKNOWN',
      webhookStatus: r.webhook_status || 'UNKNOWN',
      lastCheckedAt: r.last_checked_at ? new Date(r.last_checked_at).toISOString() : null,
      lastConnectedAt: r.last_connected_at ? new Date(r.last_connected_at).toISOString() : null,
      lastError: r.last_error || null,
      lastErrorAt: r.last_error_at ? new Date(r.last_error_at).toISOString() : null,
      lastReconnectAttemptAt: r.last_reconnect_attempt_at ? new Date(r.last_reconnect_attempt_at).toISOString() : null,
      reconnectInProgress: activeReconnects.has(r.id) || Boolean(r.reconnect_in_progress)
    }));
  } catch (error) {
    console.error('⚠️ [WhatsAppConnections] Failed to query database:', error.message);
    return getFallbackConnections();
  }
}

/**
 * Get a single connection by ID
 */
export async function getConnectionById(id) {
  const connections = await getAllConnections();
  return connections.find((c) => c.id === id) || null;
}

/**
 * Record a connection health check log
 */
export async function logConnectionEvent({
  connectionId,
  eventType,
  status,
  responseTimeMs,
  performedById,
  performedByName,
  details = {},
  errorMessage = null
}) {
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) return false;

  try {
    const logId = 'walog-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
    await prisma.$executeRawUnsafe(`
      INSERT INTO public.whatsapp_connection_logs 
        (id, connection_id, event_type, status, response_time_ms, performed_by_id, performed_by_name, details, error_message, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, NOW());
    `,
      logId,
      connectionId,
      eventType,
      status,
      responseTimeMs || null,
      performedById || null,
      performedByName || null,
      JSON.stringify(details),
      errorMessage || null
    );
    return true;
  } catch (err) {
    console.warn(`⚠️ [WhatsAppConnections] Failed to persist connection log:`, err.message);
    return false;
  }
}

/**
 * Fetch connection history logs
 */
export async function getConnectionHistory(connectionId, limit = 20) {
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) return [];

  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT 
        id, connection_id, event_type, status, response_time_ms,
        performed_by_id, performed_by_name, details, error_message, created_at
      FROM public.whatsapp_connection_logs
      WHERE connection_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `, connectionId, Math.min(Number(limit) || 20, 100));

    return rows.map((r) => ({
      id: r.id,
      connectionId: r.connection_id,
      eventType: r.event_type,
      status: r.status,
      responseTimeMs: r.response_time_ms,
      performedById: r.performed_by_id,
      performedByName: r.performed_by_name,
      details: typeof r.details === 'string' ? JSON.parse(r.details || '{}') : (r.details || {}),
      errorMessage: r.error_message,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null
    }));
  } catch (err) {
    console.warn(`⚠️ [WhatsAppConnections] Failed to query history logs:`, err.message);
    return [];
  }
}

/**
 * Diagnostic Test Connection
 * Tests Meta Graph API accessibility, token validity, phone number ID, WABA association, and webhook subscription.
 */
export async function testConnection(connectionId, user = null) {
  const connection = await getConnectionById(connectionId);
  if (!connection) {
    throw new Error(`WhatsApp connection "${connectionId}" not found.`);
  }

  const startTime = Date.now();
  const token = await getMetaAccessToken();

  if (!token) {
    const errorGuidance = {
      status: 'EXPIRED',
      reason: 'No Meta Graph API access token is configured on the server.',
      action: 'Configure META_ACCESS_TOKEN in the Render backend environment variables.'
    };

    await updateConnectionStatus(connectionId, {
      status: 'EXPIRED',
      error: errorGuidance.reason
    });

    await logConnectionEvent({
      connectionId,
      eventType: 'TEST_CONNECTION',
      status: 'FAILURE',
      responseTimeMs: Date.now() - startTime,
      performedById: user?.id,
      performedByName: user?.fullName || user?.name || 'Administrator',
      details: { check: 'token_check', outcome: 'missing_token' },
      errorMessage: errorGuidance.reason
    });

    return {
      success: false,
      connectionStatus: 'EXPIRED',
      responseTimeMs: Date.now() - startTime,
      lastTested: new Date().toISOString(),
      errorDetails: errorGuidance.reason,
      correctiveAction: errorGuidance.action,
      checks: {
        tokenConfigured: false,
        phoneVerified: false,
        wabaAssociated: false,
        webhookSubscribed: false
      }
    };
  }

  try {
    // 1. Verify Phone Number ID & Metadata from Meta Graph API
    const phoneRes = await fetch(
      `https://graph.facebook.com/v20.0/${connection.phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      }
    );
    const phoneData = await phoneRes.json().catch(() => ({}));

    if (!phoneRes.ok || phoneData.error) {
      const guidance = getMetaDiagnosticGuidance(phoneData.error || { message: `HTTP ${phoneRes.status}` });
      const responseTimeMs = Date.now() - startTime;

      await updateConnectionStatus(connectionId, {
        status: guidance.status,
        error: guidance.reason
      });

      await logConnectionEvent({
        connectionId,
        eventType: 'TEST_CONNECTION',
        status: 'FAILURE',
        responseTimeMs,
        performedById: user?.id,
        performedByName: user?.fullName || user?.name || 'Administrator',
        details: { step: 'phone_verification', metaError: phoneData.error?.code },
        errorMessage: guidance.reason
      });

      return {
        success: false,
        connectionStatus: guidance.status,
        responseTimeMs,
        lastTested: new Date().toISOString(),
        errorDetails: guidance.reason,
        correctiveAction: guidance.action,
        checks: {
          tokenConfigured: true,
          phoneVerified: false,
          wabaAssociated: false,
          webhookSubscribed: false
        }
      };
    }

    // 2. Verify WABA Association
    const wabaRes = await fetch(
      `https://graph.facebook.com/v20.0/${connection.wabaId}?fields=id,name,timezone_id,account_review_status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      }
    );
    const wabaData = await wabaRes.json().catch(() => ({}));
    const wabaAssociated = Boolean(wabaRes.ok && !wabaData.error);

    // 3. Verify Webhook Subscription
    const webhookRes = await fetch(
      `https://graph.facebook.com/v20.0/${connection.wabaId}/subscribed_apps`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      }
    );
    const webhookData = await webhookRes.json().catch(() => ({}));
    const isWebhookSubscribed = Boolean(
      webhookRes.ok &&
      Array.isArray(webhookData.data) &&
      webhookData.data.length > 0
    );

    const responseTimeMs = Date.now() - startTime;
    const quality = phoneData.quality_rating || connection.qualityRating || 'GREEN';
    const verified = phoneData.code_verification_status || 'VERIFIED';
    const waStatus = phoneData.status === 'CONNECTED' || verified === 'VERIFIED' ? 'CONNECTED' : (phoneData.status || 'CONNECTED');

    // Update DB row
    await updateConnectionStatus(connectionId, {
      status: waStatus,
      qualityRating: quality,
      codeVerificationStatus: verified,
      webhookStatus: isWebhookSubscribed ? 'SUBSCRIBED' : 'UNVERIFIED',
      displayName: phoneData.verified_name || connection.displayName,
      phoneNumber: phoneData.display_phone_number || connection.phoneNumber,
      error: null,
      markConnected: true
    });

    await logConnectionEvent({
      connectionId,
      eventType: 'TEST_CONNECTION',
      status: 'SUCCESS',
      responseTimeMs,
      performedById: user?.id,
      performedByName: user?.fullName || user?.name || 'Administrator',
      details: {
        phoneVerified: true,
        wabaAssociated,
        webhookSubscribed: isWebhookSubscribed,
        qualityRating: quality
      }
    });

    return {
      success: true,
      connectionStatus: waStatus,
      responseTimeMs,
      lastTested: new Date().toISOString(),
      verifiedName: phoneData.verified_name || connection.displayName,
      displayPhoneNumber: phoneData.display_phone_number || connection.phoneNumber,
      qualityRating: quality,
      codeVerificationStatus: verified,
      checks: {
        tokenConfigured: true,
        phoneVerified: true,
        wabaAssociated,
        webhookSubscribed: isWebhookSubscribed
      }
    };
  } catch (networkErr) {
    const responseTimeMs = Date.now() - startTime;
    const guidance = getMetaDiagnosticGuidance(networkErr);

    await updateConnectionStatus(connectionId, {
      status: guidance.status,
      error: guidance.reason
    });

    await logConnectionEvent({
      connectionId,
      eventType: 'TEST_CONNECTION',
      status: 'FAILURE',
      responseTimeMs,
      performedById: user?.id,
      performedByName: user?.fullName || user?.name || 'Administrator',
      details: { step: 'network_fetch' },
      errorMessage: guidance.reason
    });

    return {
      success: false,
      connectionStatus: guidance.status,
      responseTimeMs,
      lastTested: new Date().toISOString(),
      errorDetails: guidance.reason,
      correctiveAction: guidance.action,
      checks: {
        tokenConfigured: true,
        phoneVerified: false,
        wabaAssociated: false,
        webhookSubscribed: false
      }
    };
  }
}

/**
 * Reconnect Connection Workflow
 * Re-validates credentials, re-subscribes the WABA to backend webhook, and resets connection health.
 */
export async function reconnectConnection(connectionId, user = null, broadcastFn = null) {
  // 1. Concurrency guard: prevent simultaneous duplicate reconnect clicks
  if (activeReconnects.has(connectionId)) {
    return {
      success: false,
      alreadyInProgress: true,
      message: 'A reconnection attempt is already in progress for this phone number.'
    };
  }

  // 2. Debounce rate-limit guard (5 seconds between reconnect attempts)
  const lastTime = lastReconnectTimes.get(connectionId) || 0;
  if (Date.now() - lastTime < 5000) {
    return {
      success: false,
      rateLimited: true,
      message: 'Please wait a few seconds before retrying reconnection.'
    };
  }

  activeReconnects.add(connectionId);
  lastReconnectTimes.set(connectionId, Date.now());

  const connection = await getConnectionById(connectionId);
  if (!connection) {
    activeReconnects.delete(connectionId);
    throw new Error(`WhatsApp connection "${connectionId}" not found.`);
  }

  const startTime = Date.now();

  try {
    // Notify clients that reconnection is checking
    if (broadcastFn) {
      broadcastFn({
        type: 'WHATSAPP_CONNECTION_UPDATED',
        connectionId,
        company: connection.company,
        status: 'RECONNECTING'
      });
    }

    const token = await getMetaAccessToken();
    if (!token) {
      const guidance = {
        status: 'EXPIRED',
        reason: 'No Meta Graph API access token is configured on the server.',
        action: 'Configure META_ACCESS_TOKEN in the Render backend environment variables.'
      };

      await updateConnectionStatus(connectionId, {
        status: 'EXPIRED',
        error: guidance.reason,
        markReconnectAttempt: true
      });

      await logConnectionEvent({
        connectionId,
        eventType: 'RECONNECT_ATTEMPT',
        status: 'FAILURE',
        responseTimeMs: Date.now() - startTime,
        performedById: user?.id,
        performedByName: user?.fullName || user?.name || 'Administrator',
        details: { step: 'token_check', outcome: 'missing_token' },
        errorMessage: guidance.reason
      });

      await auditSecurityEvent({
        actorId: user?.id,
        action: 'whatsapp.connection.reconnect_failed',
        resource: `connection:${connectionId}`,
        outcome: 'FAILURE',
        metadata: { connectionId, error: guidance.reason, company: connection.company }
      });

      return {
        success: false,
        connectionStatus: 'EXPIRED',
        message: 'Unable to verify the WhatsApp connection.',
        reason: guidance.reason,
        correctiveAction: guidance.action
      };
    }

    // 3. Re-subscribe the WABA Webhook App to Meta Cloud API
    const callbackUrl = 'https://royal-wellness-backend.onrender.com/api/webhook';
    const verifyToken = (process.env.META_VERIFY_TOKEN || 'royal_wellness_token_2026').trim();

    const subRes = await fetch(`https://graph.facebook.com/v20.0/${connection.wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        override_callback_uri: callbackUrl,
        verify_token: verifyToken
      })
    });
    const subData = await subRes.json().catch(() => ({}));

    // 4. Verify WABA association before trusting any webhook confirmation
    const wabaRes = await fetch(
      `https://graph.facebook.com/v20.0/${connection.wabaId}?fields=id,name,timezone_id,account_review_status`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    const wabaData = await wabaRes.json().catch(() => ({}));

    if (!wabaRes.ok || wabaData.error) {
      const guidance = getMetaDiagnosticGuidance(wabaData.error || { message: `HTTP ${wabaRes.status}` });
      await updateConnectionStatus(connectionId, {
        status: guidance.status,
        error: guidance.reason,
        markReconnectAttempt: true
      });
      await logConnectionEvent({
        connectionId,
        eventType: 'RECONNECT_ATTEMPT',
        status: 'FAILURE',
        responseTimeMs: Date.now() - startTime,
        performedById: user?.id,
        performedByName: user?.fullName || user?.name || 'Administrator',
        details: { step: 'waba_verification', metaError: wabaData.error?.code },
        errorMessage: guidance.reason
      });
      await auditSecurityEvent({
        actorId: user?.id,
        action: 'whatsapp.connection.reconnect_failed',
        resource: `connection:${connectionId}`,
        outcome: 'FAILURE',
        metadata: { connectionId, error: guidance.reason, company: connection.company }
      });
      return {
        success: false,
        connectionStatus: guidance.status,
        message: 'Unable to verify the WhatsApp connection.',
        reason: guidance.reason,
        correctiveAction: guidance.action
      };
    }

    // A reconnect is only successful when Meta confirms the webhook re-subscription
    if (!subRes.ok || subData.success !== true) {
      const guidance = {
        status: 'ERROR',
        reason: 'Meta did not confirm the WABA webhook re-subscription.',
        action: 'Verify META_VERIFY_TOKEN and that the System User has whatsapp_business_management permission, then retry.'
      };
      await updateConnectionStatus(connectionId, {
        status: guidance.status,
        error: guidance.reason,
        markReconnectAttempt: true
      });
      await logConnectionEvent({
        connectionId,
        eventType: 'RECONNECT_ATTEMPT',
        status: 'FAILURE',
        responseTimeMs: Date.now() - startTime,
        performedById: user?.id,
        performedByName: user?.fullName || user?.name || 'Administrator',
        details: { step: 'webhook_resubscription', httpStatus: subRes.status },
        errorMessage: guidance.reason
      });
      await auditSecurityEvent({
        actorId: user?.id,
        action: 'whatsapp.connection.reconnect_failed',
        resource: `connection:${connectionId}`,
        outcome: 'FAILURE',
        metadata: { connectionId, error: guidance.reason, company: connection.company }
      });
      return {
        success: false,
        connectionStatus: guidance.status,
        message: 'Unable to verify the WhatsApp connection.',
        reason: guidance.reason,
        correctiveAction: guidance.action
      };
    }

    // 5. Validate live phone status
    const phoneRes = await fetch(
      `https://graph.facebook.com/v20.0/${connection.phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      }
    );
    const phoneData = await phoneRes.json().catch(() => ({}));

    if (!phoneRes.ok || phoneData.error) {
      const guidance = getMetaDiagnosticGuidance(phoneData.error || { message: `HTTP ${phoneRes.status}` });
      const responseTimeMs = Date.now() - startTime;

      await updateConnectionStatus(connectionId, {
        status: guidance.status,
        error: guidance.reason,
        markReconnectAttempt: true
      });

      await logConnectionEvent({
        connectionId,
        eventType: 'RECONNECT_ATTEMPT',
        status: 'FAILURE',
        responseTimeMs,
        performedById: user?.id,
        performedByName: user?.fullName || user?.name || 'Administrator',
        details: { step: 'phone_verification', metaError: phoneData.error?.code },
        errorMessage: guidance.reason
      });

      // Record tamper-proof security audit event
      await auditSecurityEvent({
        actorId: user?.id,
        action: 'whatsapp.connection.reconnect_failed',
        resource: `connection:${connectionId}`,
        outcome: 'FAILURE',
        metadata: {
          connectionId,
          error: guidance.reason,
          company: connection.company
        }
      });

      return {
        success: false,
        connectionStatus: guidance.status,
        message: 'Unable to verify the WhatsApp connection.',
        reason: guidance.reason,
        correctiveAction: guidance.action
      };
    }

    const responseTimeMs = Date.now() - startTime;
    const quality = phoneData.quality_rating || connection.qualityRating || 'GREEN';
    const verified = phoneData.code_verification_status || 'VERIFIED';
    const newStatus = 'CONNECTED';

    // Update connection status as CONNECTED and healthy
    await updateConnectionStatus(connectionId, {
      status: newStatus,
      qualityRating: quality,
      codeVerificationStatus: verified,
      webhookStatus: 'SUBSCRIBED',
      displayName: phoneData.verified_name || connection.displayName,
      phoneNumber: phoneData.display_phone_number || connection.phoneNumber,
      error: null,
      markConnected: true,
      markReconnectAttempt: true
    });

    await logConnectionEvent({
      connectionId,
      eventType: 'RECONNECT_ATTEMPT',
      status: 'SUCCESS',
      responseTimeMs,
      performedById: user?.id,
      performedByName: user?.fullName || user?.name || 'Administrator',
      details: {
        reconnected: true,
        webhookResubscribed: true,
        verifiedName: phoneData.verified_name
      }
    });

    // Record tamper-proof security audit event
    await auditSecurityEvent({
      actorId: user?.id,
      action: 'whatsapp.connection.reconnected',
      resource: `connection:${connectionId}`,
      outcome: 'SUCCESS',
      metadata: {
        connectionId,
        company: connection.company,
        phoneNumber: phoneData.display_phone_number || connection.phoneNumber
      }
    });

    // Broadcast SSE update
    if (broadcastFn) {
      broadcastFn({
        type: 'WHATSAPP_CONNECTION_UPDATED',
        connectionId,
        company: connection.company,
        status: newStatus
      });
    }

    return {
      success: true,
      connectionStatus: newStatus,
      message: 'WhatsApp connection verified successfully.',
      details: {
        verifiedName: phoneData.verified_name || connection.displayName,
        qualityRating: quality,
        responseTimeMs
      }
    };
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;
    const guidance = getMetaDiagnosticGuidance(err);

    await updateConnectionStatus(connectionId, {
      status: guidance.status,
      error: guidance.reason,
      markReconnectAttempt: true
    });

    await logConnectionEvent({
      connectionId,
      eventType: 'RECONNECT_ATTEMPT',
      status: 'FAILURE',
      responseTimeMs,
      performedById: user?.id,
      performedByName: user?.fullName || user?.name || 'Administrator',
      details: { step: 'exception', error: err.message },
      errorMessage: guidance.reason
    });

    await auditSecurityEvent({
      actorId: user?.id,
      action: 'whatsapp.connection.reconnect_failed',
      resource: `connection:${connectionId}`,
      outcome: 'FAILURE',
      metadata: { connectionId, error: guidance.reason, company: connection.company }
    });

    return {
      success: false,
      connectionStatus: guidance.status,
      message: 'Unable to verify the WhatsApp connection.',
      reason: guidance.reason,
      correctiveAction: guidance.action
    };
  } finally {
    activeReconnects.delete(connectionId);
  }
}

/**
 * Helper to update connection state in the database
 */
async function updateConnectionStatus(id, {
  status,
  qualityRating,
  codeVerificationStatus,
  webhookStatus,
  displayName,
  phoneNumber,
  error = null,
  markConnected = false,
  markReconnectAttempt = false
}) {
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) return false;

  try {
    let sql = `
      UPDATE public.whatsapp_connections
      SET 
        connection_status = $1,
        last_checked_at = NOW(),
        updated_at = NOW()
    `;
    const params = [status];
    let paramIndex = 2;

    if (markConnected) {
      sql += `, last_connected_at = NOW()`;
    }
    if (markReconnectAttempt) {
      sql += `, last_reconnect_attempt_at = NOW()`;
    }

    if (error !== undefined) {
      sql += `, last_error = $${paramIndex++}`;
      params.push(error);
      if (error) {
        sql += `, last_error_at = NOW()`;
      }
    }

    if (qualityRating) {
      sql += `, quality_rating = $${paramIndex++}`;
      params.push(qualityRating);
    }
    if (codeVerificationStatus) {
      sql += `, code_verification_status = $${paramIndex++}`;
      params.push(codeVerificationStatus);
    }
    if (webhookStatus) {
      sql += `, webhook_status = $${paramIndex++}`;
      params.push(webhookStatus);
    }
    if (displayName) {
      sql += `, display_name = $${paramIndex++}`;
      params.push(displayName);
    }
    if (phoneNumber) {
      sql += `, phone_number = $${paramIndex++}`;
      params.push(phoneNumber);
    }

    sql += ` WHERE id = $${paramIndex}`;
    params.push(id);

    await prisma.$executeRawUnsafe(sql, ...params);
    return true;
  } catch (err) {
    console.warn(`⚠️ [WhatsAppConnections] Failed to update connection state:`, err.message);
    return false;
  }
}
