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

export async function auditSecurityEvent({ correlationId, actorId, action, resource, outcome, metadata = {} }) {
  const event = {
    id: crypto.randomUUID(),
    correlationId: String(correlationId || ''),
    actorId: actorId ? String(actorId) : null,
    action: String(action || 'unknown').slice(0, 100),
    resource: String(resource || 'unknown').slice(0, 255),
    outcome: String(outcome || 'unknown').slice(0, 40),
    metadata: safeAuditValue(metadata),
    createdAt: new Date()
  };
  console.log(JSON.stringify({ type: 'security_audit', ...event }));
  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) return false;
  try {
    await prisma.$executeRawUnsafe(`
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

export function sendApiError(res, status, code, message, correlationId) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId });
  res.end(JSON.stringify({ success: false, error: { code, message, correlationId } }));
}
