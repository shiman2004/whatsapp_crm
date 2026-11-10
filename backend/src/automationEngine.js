/**
 * automationEngine.js — Real Event-Driven Automation Execution Engine
 * Evaluates Trigger-Condition-Action workflow rules configured in System Settings.
 */
import crypto from 'node:crypto';
import { getPrisma, getDbStatus } from './db.js';
import { SettingsService } from './services/settingsService.js';
import { auditSecurityEvent } from './securityAudit.js';
import { decryptReversible } from './secretHash.js';

/**
 * Safe deterministic condition parser (no eval).
 * Supports expressions like: `true`, `brand == "RWC"`, `new_stage == "converted" && deal_value > 100000`
 */
export function evaluateAutomationCondition(conditionStr, context = {}) {
  const raw = String(conditionStr || '').trim();
  if (!raw || raw.toLowerCase() === 'true') return true;
  if (raw.toLowerCase() === 'false') return false;

  const clauses = raw.split('&&').map(s => s.trim()).filter(Boolean);
  for (const clause of clauses) {
    const eqMatch = clause.match(/^([a-zA-Z0-9_]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (!eqMatch) continue; // Ignore unparseable clauses safely rather than throwing

    const [, key, op, rawTarget] = eqMatch;
    const actualVal = context[key];
    const targetClean = rawTarget.trim().replace(/^["']|["']$/g, '');

    if (op === '==') {
      if (String(actualVal ?? '').toLowerCase() !== targetClean.toLowerCase()) return false;
    } else if (op === '!=') {
      if (String(actualVal ?? '').toLowerCase() === targetClean.toLowerCase()) return false;
    } else {
      const actualNum = Number(actualVal ?? 0);
      const targetNum = Number(targetClean);
      if (Number.isNaN(actualNum) || Number.isNaN(targetNum)) return false;
      if (op === '>' && !(actualNum > targetNum)) return false;
      if (op === '<' && !(actualNum < targetNum)) return false;
      if (op === '>=' && !(actualNum >= targetNum)) return false;
      if (op === '<=' && !(actualNum <= targetNum)) return false;
    }
  }
  return true;
}

/**
 * Dry-run verification for UI "Test Simulation" button
 */
export function dryRunAutomationRule(rule = {}, sampleContext = {}) {
  const trigger = rule.trigger || 'lead.created';
  const condition = rule.condition || 'true';
  const action = rule.action || 'send_whatsapp_template';

  const context = {
    brand: sampleContext.company || 'RWC',
    company: sampleContext.company || 'RWC',
    new_stage: sampleContext.new_stage || 'converted',
    deal_value: sampleContext.deal_value ?? 150000,
    ...sampleContext,
  };

  const conditionPassed = evaluateAutomationCondition(condition, context);
  const supportedActions = [
    'send_whatsapp_template',
    'assign_round_robin',
    'send_email_notification',
    'dispatch_webhook',
  ];
  const actionValid = supportedActions.includes(action);

  return {
    success: true,
    trigger,
    condition,
    conditionPassed,
    action,
    actionValid,
    message: conditionPassed
      ? `✅ Dry-run verified: Trigger "${trigger}" matched, condition "${condition}" passed, action "${action}" ready to execute.`
      : `ℹ️ Dry-run evaluated: Trigger "${trigger}" matched, but condition "${condition}" returned FALSE for sample context (${context.company}).`,
  };
}

async function executeAssignRoundRobin(prisma, context) {
  if (!prisma || !getDbStatus() || !context.leadId) return { executed: false, reason: 'missing_lead_or_db' };
  const lead = await prisma.lead.findUnique({ where: { id: context.leadId } });
  if (!lead || lead.assignedTo) return { executed: false, reason: 'already_assigned_or_missing' };

  const company = lead.company || context.company || 'RWC';
  const coordinators = await prisma.user.findMany({
    where: {
      active: true,
      role: { in: ['coordinator', 'sales_coordinator'] },
      OR: [{ company }, { company: 'ALL' }, { company: null }],
    },
    select: { id: true, fullName: true },
  });
  if (!coordinators.length) return { executed: false, reason: 'no_coordinators_available' };

  // Pick coordinator with fewest active leads
  const counts = await prisma.lead.groupBy({
    by: ['assignedTo'],
    where: { assignedTo: { in: coordinators.map(c => c.id) }, stage: { notIn: ['converted', 'lost'] } },
    _count: { id: true },
  });
  const countMap = new Map(counts.map(c => [c.assignedTo, c._count.id]));
  const sorted = [...coordinators].sort((a, b) => (countMap.get(a.id) || 0) - (countMap.get(b.id) || 0));
  const chosen = sorted[0];

  await prisma.lead.update({
    where: { id: lead.id },
    data: { assignedTo: chosen.id, acceptedAt: new Date() },
  });
  return { executed: true, assignedTo: chosen.id, assignedName: chosen.fullName };
}

async function executeSendWhatsAppTemplate(context) {
  const phone = context.phone || context.patientPhone;
  if (!phone) return { executed: false, reason: 'no_phone' };
  const token = (process.env.META_ACCESS_TOKEN || '').trim();
  const company = String(context.company || 'RWC').toUpperCase();
  const phoneId = company === 'CRAS'
    ? (process.env.META_PHONE_NUMBER_ID_CRAS || process.env.META_PHONE_NUMBER_ID || '').trim()
    : (process.env.META_PHONE_NUMBER_ID_RWC || process.env.META_PHONE_NUMBER_ID || '').trim();

  if (!token || !phoneId) return { executed: false, reason: 'meta_credentials_missing' };

  try {
    const { canSendWhatsApp } = await import('./modules/marketing/services/consent.service.js');
    const gate = await canSendWhatsApp(phone, 'template', { check24hWindow: false });
    if (!gate.allowed) return { executed: false, reason: gate.reason || 'consent_blocked' };
  } catch {}

  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  if (cleanPhone.length < 9) return { executed: false, reason: 'invalid_phone' };

  const templateName = company === 'CRAS' ? 'cras_welcome_greeting' : 'rwc_welcome_greeting';
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'template',
      template: { name: templateName, language: { code: 'en' } },
    }),
  });
  return { executed: res.ok, status: res.status, templateName };
}

async function executeEmailNotification(prisma, rule, eventName, context) {
  if (!prisma || !getDbStatus()) return { executed: false, reason: 'db_offline' };
  const setting = await prisma.systemSetting.findFirst({
    where: { section: 'email_notifications', scope: 'global', scopeId: null },
    select: { payload: true },
  });
  const smtp = setting?.payload || {};
  const smtpPass = decryptReversible(smtp.smtpPassword || smtp.smtpPass || '');
  if (!smtp.smtpHost || !smtp.smtpUser || !smtpPass) {
    return { executed: false, reason: 'smtp_not_configured' };
  }

  const recipient = context.notifyEmail || smtp.senderEmail || smtp.smtpUser;
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host: smtp.smtpHost,
    port: Number(smtp.smtpPort) || 587,
    secure: smtp.smtpSecure === true || Number(smtp.smtpPort) === 465,
    auth: { user: smtp.smtpUser, pass: smtpPass },
  });
  await transport.sendMail({
    from: `${smtp.senderName || 'Alpha Health Group CRM'} <${smtp.senderEmail || smtp.smtpUser}>`,
    to: recipient,
    subject: `[CRM Automation] ${rule.name || eventName}`,
    text: `Automation rule "${rule.name}" triggered on event "${eventName}".\n\nContext:\n${JSON.stringify(context, null, 2)}`,
  });
  return { executed: true, recipient };
}

async function executeDispatchWebhook(eventName, context) {
  const integrations = await SettingsService.getSetting('integrations', 'global', null);
  const webhooks = integrations?.data?.webhooks || [];
  const activeHooks = webhooks.filter(w => w.enabled !== false && w.url && (!w.events?.length || w.events.includes(eventName) || w.events.includes('*')));
  if (!activeHooks.length) return { executed: false, reason: 'no_matching_webhooks' };

  const bodyStr = JSON.stringify({ event: eventName, timestamp: new Date().toISOString(), data: context });
  const results = [];
  for (const hook of activeHooks) {
    try {
      const sig = hook.secret
        ? crypto.createHmac('sha256', String(hook.secret)).update(bodyStr).digest('hex')
        : '';
      const r = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sig ? { 'X-CRM-Signature-256': `sha256=${sig}` } : {}),
        },
        body: bodyStr,
      });
      results.push({ url: hook.url, status: r.status });
    } catch (err) {
      results.push({ url: hook.url, error: err.message });
    }
  }
  return { executed: true, results };
}

/**
 * Dispatch an event into the automation engine (non-blocking safe runner).
 */
export async function dispatchAutomationEvent(eventName, context = {}) {
  try {
    if (process.env.NODE_ENV === 'test' && !context.__forceInTest) {
      // Avoid external outbound calls during automated test matrix unless explicitly tested
      return { skipped: true, reason: 'test_environment' };
    }

    const company = context.company || 'RWC';
    const [companySetting, globalSetting] = await Promise.all([
      SettingsService.getSetting('automation', 'company', company).catch(() => null),
      SettingsService.getSetting('automation', 'company', 'ALL').catch(() => null),
    ]);

    const companyRules = Array.isArray(companySetting?.data?.rules) ? companySetting.data.rules : [];
    const globalRules = Array.isArray(globalSetting?.data?.rules) ? globalSetting.data.rules : [];
    const allRules = [...companyRules, ...globalRules];

    const matching = allRules.filter(r => r && r.enabled !== false && r.trigger === eventName);
    if (!matching.length) return { matched: 0, executed: [] };

    const prisma = getPrisma();
    const evalContext = { ...context, brand: company, company };
    const outcomes = [];

    for (const rule of matching) {
      if (!evaluateAutomationCondition(rule.condition, evalContext)) continue;

      let result = { executed: false, reason: 'unknown_action' };
      try {
        if (rule.action === 'assign_round_robin') {
          result = await executeAssignRoundRobin(prisma, evalContext);
        } else if (rule.action === 'send_whatsapp_template') {
          result = await executeSendWhatsAppTemplate(evalContext);
        } else if (rule.action === 'send_email_notification') {
          result = await executeEmailNotification(prisma, rule, eventName, evalContext);
        } else if (rule.action === 'dispatch_webhook') {
          result = await executeDispatchWebhook(eventName, evalContext);
        }
      } catch (actionErr) {
        result = { executed: false, error: actionErr.message };
      }

      outcomes.push({ ruleId: rule.id, ruleName: rule.name, action: rule.action, result });
      await auditSecurityEvent({
        actorId: context.actorId || 'system-automation',
        action: 'automation.executed',
        resource: `${eventName}:${rule.id}`,
        outcome: result.executed ? 'success' : 'skipped',
        metadata: { ruleName: rule.name, action: rule.action, result },
      }).catch(() => {});
    }

    return { matched: matching.length, executed: outcomes };
  } catch (err) {
    console.warn(`⚠️ [AutomationEngine] Error dispatching ${eventName}:`, err.message);
    return { error: err.message };
  }
}
