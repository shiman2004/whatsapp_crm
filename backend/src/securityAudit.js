import crypto from 'crypto';
import { getPrisma, getDbStatus } from './db.js';

export function createCorrelationId(requestId) {
  const candidate = String(requestId || '').trim();
  return /^[a-zA-Z0-9._:-]{1,100}$/.test(candidate) ? candidate : crypto.randomUUID();
}

function safeAuditValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value.slice(0, 500);
  try {
    return JSON.stringify(value, (key, nested) => {
      if (/password|pin|token|secret|authorization|content|medical/i.test(key)) return '[REDACTED]';
      return nested;
    }).slice(0, 2000);
  } catch {
    return '[UNSERIALIZABLE]';
  }
}

export function buildSecurityEvent({ correlationId, actorId, action, resource, outcome, metadata = {} }) {
  return {
    id: crypto.randomUUID(),
    correlationId: String(correlationId || ''),
    actorId: actorId ? String(actorId) : null,
    action: String(action || 'unknown').slice(0, 100),
    resource: String(resource || 'unknown').slice(0, 255),
    outcome: String(outcome || 'unknown').slice(0, 40),
    metadata: safeAuditValue(metadata),
    createdAt: new Date()
  };
}

/** Writes one audit row through a Prisma client or transaction client. */
export async function persistSecurityEvent(client, event) {
  if (!client) return false;
  try {
    await client.$executeRawUnsafe(`
      INSERT INTO public.security_audit_events
        (id, correlation_id, actor_id, action, resource, outcome, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, event.id, event.correlationId, event.actorId, event.action, event.resource, event.outcome, event.metadata, event.createdAt);
    return true;
  } catch (error) {
    console.error('[Security] Audit persistence failed:', error.message);
    return false;
  }
}

export async function auditSecurityEvent(payload) {
  const event = buildSecurityEvent(payload);
  console.log(JSON.stringify({ type: 'security_audit', ...event }));
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) return false;
  return persistSecurityEvent(prisma, event);
}

/** Same audit trail, but joins the caller's transaction so the write is atomic with the change. */
export async function auditSecurityEventInTransaction(tx, payload) {
  const event = buildSecurityEvent(payload);
  console.log(JSON.stringify({ type: 'security_audit', ...event }));
  return persistSecurityEvent(tx, event);
}

export function parseAuditMetadata(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function sendApiError(res, status, code, message, correlationId) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId });
  res.end(JSON.stringify({ success: false, error: { code, message, correlationId } }));
}
