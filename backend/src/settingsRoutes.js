import { SettingsService, VersionConflictError, DEFAULT_SETTINGS } from './services/settingsService.js';
import { getPrisma, getDbStatus } from './db.js';
import { readBoundedJson, PayloadTooLargeError, REQUEST_BODY_LIMITS } from './requestBody.js';

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function parseBody(req, limit = REQUEST_BODY_LIMITS.settings) {
  const { data } = await readBoundedJson(req, limit);
  return data;
}

function queryOf(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

export const SETTINGS_SECTIONS_CATALOG = [
  // 1. Organization Administration
  { id: 'company', label: 'Company & Branch Management', category: 'Organization Administration', scope: 'company', adminOnly: true },
  { id: 'users', label: 'User Management', category: 'Organization Administration', scope: 'global', adminOnly: true },
  { id: 'roles', label: 'Roles & Access Control', category: 'Organization Administration', scope: 'global', adminOnly: true },
  // 2. Communication
  { id: 'whatsapp_messaging', label: 'WhatsApp Messaging Configuration', category: 'Communication', scope: 'company', adminOnly: true },
  // 3. Business Operations
  { id: 'sales', label: 'Leads & Pipeline Settings', category: 'Business Operations', scope: 'company', adminOnly: true },
  { id: 'marketing', label: 'Contacts & Marketing Settings', category: 'Business Operations', scope: 'company', adminOnly: true },
  { id: 'clinical', label: 'Appointment & Clinical Settings', category: 'Business Operations', scope: 'company', adminOnly: true },
  { id: 'academic', label: 'Exam Department', category: 'Business Operations', scope: 'global', adminOnly: true },
  { id: 'automation', label: 'Automation & Workflow Engine', category: 'Business Operations', scope: 'company', adminOnly: true },
  { id: 'email_notifications', label: 'Notifications & Email', category: 'Business Operations', scope: 'global', adminOnly: true },
  { id: 'custom_fields', label: 'Custom Fields & Forms', category: 'Business Operations', scope: 'company', adminOnly: true },
  // 4. Platform Administration
  { id: 'integrations', label: 'Integrations & API Management', category: 'Platform Administration', scope: 'global', adminOnly: true },
  { id: 'security_policy', label: 'Security & Audit Center', category: 'Platform Administration', scope: 'global', adminOnly: true },
  { id: 'data_management', label: 'Data Management & Backup', category: 'Platform Administration', scope: 'global', adminOnly: true },
  { id: 'system_monitoring', label: 'System Infrastructure & Monitoring', category: 'Platform Administration', scope: 'global', adminOnly: true },
  { id: 'reporting', label: 'Dashboard & Reporting Settings', category: 'Platform Administration', scope: 'company', adminOnly: true },
  { id: 'appearance', label: 'Appearance & General Preferences', category: 'Platform Administration', scope: 'user', adminOnly: false }
];

export async function handleSettingsRoutes(req, res, pathname, user, correlationId) {
  // Routes covered: /api/settings/*, /api/companies/:companyId/settings/*, /api/users/me/preferences
  const isSettingsPath = pathname.startsWith('/api/settings');
  const isCompanySettingsPath = /^\/api\/companies\/[^\/]+\/settings/.test(pathname);
  const isUserPrefPath = pathname === '/api/users/me/preferences';

  if (!isSettingsPath && !isCompanySettingsPath && !isUserPrefPath) {
    return false;
  }

  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return true;
  }

  // 1. User preferences endpoint (accessible by any active authenticated user)
  if (isUserPrefPath) {
    if (!user?.id || user.active === false) {
      json(res, 401, { success: false, error: 'Sign in to access preferences.' });
      return true;
    }

    if (req.method === 'GET') {
      const result = await SettingsService.getSetting('appearance', 'user', user.id);
      json(res, 200, { success: true, ...result });
      return true;
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      try {
        const body = await parseBody(req);
        const result = await SettingsService.updateSetting({
          section: 'appearance',
          scope: 'user',
          scopeId: user.id,
          version: body.version || 1,
          data: body.data || body,
          user,
          correlationId
        });
        json(res, 200, { success: true, ...result });
      } catch (err) {
        if (err instanceof VersionConflictError) {
          json(res, 409, { success: false, error: err.code, message: err.message, ...err.details });
        } else {
          json(res, 400, { success: false, error: err.message });
        }
      }
      return true;
    }
  }

  // 2. All other settings require Super Admin role
  if (!user?.id || user.active === false || user.role !== 'super_admin') {
    json(res, 403, { success: false, error: 'Super Admin authorization is required to access system settings.' });
    return true;
  }

  const prisma = getPrisma();
  if (!prisma || !getDbStatus()) {
    json(res, 503, { success: false, error: 'Settings service requires database storage.' });
    return true;
  }

  try {
    const query = queryOf(req);

    // ---------------------------------------------------------------- Catalog of Sections
    if (pathname === '/api/settings/sections' && req.method === 'GET') {
      json(res, 200, { success: true, sections: SETTINGS_SECTIONS_CATALOG });
      return true;
    }

    // ---------------------------------------------------------------- Audit Logs
    if (pathname === '/api/settings/audit-logs' && req.method === 'GET') {
      const result = await SettingsService.getAuditLogs({
        page: query.page,
        limit: query.limit,
        section: query.section,
        userId: query.userId,
        fromDate: query.from,
        toDate: query.to
      });
      json(res, 200, { success: true, ...result });
      return true;
    }

    // ---------------------------------------------------------------- System Monitoring Health
    if (pathname === '/api/settings/monitoring/health' && req.method === 'GET') {
      const dbConnected = getDbStatus();
      const startTime = process.uptime();
      const hasMetaToken = Boolean((process.env.META_ACCESS_TOKEN || '').trim());
      json(res, 200, {
        success: true,
        status: dbConnected ? 'healthy' : 'degraded',
        uptimeSeconds: Math.floor(startTime),
        database: {
          status: dbConnected ? 'connected' : 'disconnected',
          provider: 'Supabase PostgreSQL',
          orm: 'Prisma 7.10.1'
        },
        services: {
          whatsappGateways: hasMetaToken ? 'connected' : 'unconfigured',
          scheduler: 'active',
          realtimeSockets: 'active'
        },
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
      return true;
    }

    // ---------------------------------------------------------------- SMTP Test Dispatcher
    if (pathname === '/api/settings/email/test' && req.method === 'POST') {
      const body = await parseBody(req);
      const recipient = String(body.recipient || body.to || user.email || '').trim();
      if (!recipient || !recipient.includes('@')) {
        json(res, 400, { success: false, error: 'Valid recipient email address is required.' });
        return true;
      }

      const prisma = getPrisma();
      if (prisma && getDbStatus()) {
        try {
          const { decryptReversible } = await import('./secretHash.js');
          const setting = await prisma.systemSetting.findFirst({
            where: { section: 'email_notifications', scope: 'global', scopeId: null },
            select: { payload: true },
          });
          const smtp = setting?.payload || {};
          const smtpPass = decryptReversible(smtp.smtpPassword || smtp.smtpPass || '');

          if (!smtp.smtpHost || !smtp.smtpUser || !smtpPass) {
            json(res, 400, {
              success: false,
              error: 'SMTP server credentials are not configured yet. Enter SMTP Host, Username, and Password, then Save Changes first.'
            });
            return true;
          }

          const { default: nodemailer } = await import('nodemailer');
          const transport = nodemailer.createTransport({
            host: smtp.smtpHost,
            port: Number(smtp.smtpPort) || 587,
            secure: smtp.smtpSecure === true || Number(smtp.smtpPort) === 465,
            auth: { user: smtp.smtpUser, pass: smtpPass },
          });

          const senderEmail = smtp.senderEmail || smtp.smtpUser;
          const senderName = smtp.senderName || smtp.fromName || 'Alpha Health Group CRM';
          await transport.sendMail({
            from: `${senderName} <${senderEmail}>`,
            to: recipient,
            subject: 'CRM SMTP Configuration Test Email',
            text: `Hello,\n\nThis is a real-time verification email confirming your SMTP settings on Royal Wellness CRM are working properly.\n\nTimestamp: ${new Date().toISOString()}`,
          });

          json(res, 200, {
            success: true,
            message: `Real verification email successfully dispatched via ${smtp.smtpHost} to ${recipient}.`,
            timestamp: new Date().toISOString()
          });
          return true;
        } catch (smtpErr) {
          json(res, 502, {
            success: false,
            error: `SMTP dispatch failed: ${smtpErr.message}`
          });
          return true;
        }
      }

      json(res, 503, { success: false, error: 'Database offline; cannot load SMTP configuration.' });
      return true;
    }

    // ---------------------------------------------------------------- Company-Scoped Endpoints (/api/companies/:companyId/settings/:section)
    const companyMatch = pathname.match(/^\/api\/companies\/([^\/]+)\/settings\/([^\/]+)$/);
    if (companyMatch) {
      const companyId = companyMatch[1];
      const section = companyMatch[2];

      if (req.method === 'GET') {
        const result = await SettingsService.getSetting(section, 'company', companyId);
        json(res, 200, { success: true, ...result });
        return true;
      }

      if (req.method === 'PUT') {
        const body = await parseBody(req);
        try {
          const result = await SettingsService.updateSetting({
            section,
            scope: 'company',
            scopeId: companyId,
            version: body.version || 1,
            data: body.data || {},
            user,
            correlationId
          });
          json(res, 200, { success: true, ...result });
        } catch (err) {
          if (err instanceof VersionConflictError) {
            json(res, 409, { success: false, error: err.code, message: err.message, ...err.details });
          } else {
            json(res, 400, { success: false, error: err.message });
          }
        }
        return true;
      }
    }

    // ---------------------------------------------------------------- Standard Section Endpoints (/api/settings/:section)
    const sectionMatch = pathname.match(/^\/api\/settings\/([a-zA-Z0-9_\-]+)$/);
    if (sectionMatch) {
      const section = sectionMatch[1];
      const scope = query.scope || 'global';
      const scopeId = query.scopeId || null;

      if (req.method === 'GET') {
        const result = await SettingsService.getSetting(section, scope, scopeId);
        json(res, 200, { success: true, ...result });
        return true;
      }

      if (req.method === 'PUT') {
        const body = await parseBody(req);
        try {
          const result = await SettingsService.updateSetting({
            section,
            scope: body.scope || scope,
            scopeId: body.scopeId || scopeId,
            version: body.version || 1,
            data: body.data || {},
            user,
            correlationId
          });
          json(res, 200, { success: true, ...result });
        } catch (err) {
          if (err instanceof VersionConflictError) {
            json(res, 409, { success: false, error: err.code, message: err.message, ...err.details });
          } else {
            json(res, 400, { success: false, error: err.message });
          }
        }
        return true;
      }
    }

    json(res, 404, { success: false, error: 'Settings endpoint not found.' });
    return true;
  } catch (err) {
    if (err.status === 413 || err.statusCode === 413 || err.code === 'PAYLOAD_TOO_LARGE') {
      json(res, 413, { success: false, code: 'PAYLOAD_TOO_LARGE', error: 'Request body too large.' });
      return true;
    }
    console.error('[SettingsRoutes Error]:', err);
    json(res, 500, { success: false, error: 'Internal server error in settings handler.' });
    return true;
  }
}

