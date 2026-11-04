import nodemailer from 'nodemailer';
import { getPrisma, getDbStatus } from '../db.js';
import { decryptReversible } from '../secretHash.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function loadSmtpSettings() {
  if (!getDbStatus()) return null;
  const prisma = getPrisma();
  if (!prisma) return null;
  const setting = await prisma.systemSetting.findFirst({
    where: { section: 'email_notifications', scope: 'global', scopeId: null },
    select: { payload: true },
  });
  if (!setting?.payload || typeof setting.payload !== 'object') return null;
  const payload = setting.payload;
  return {
    ...payload,
    smtpPassword: decryptReversible(payload.smtpPassword),
  };
}

export function createInvitationMailer({ loadSettings = loadSmtpSettings, createTransport = nodemailer.createTransport } = {}) {
  return {
    async sendInvitationEmail({ to, fullName, inviteUrl }) {
      try {
        const settings = await loadSettings();
        if (!settings?.smtpHost || !settings.smtpUser || !settings.smtpPassword || !settings.senderEmail) {
          return { delivered: false, reason: 'smtp_not_configured' };
        }
        const transport = createTransport({
          host: settings.smtpHost,
          port: Number(settings.smtpPort) || 587,
          secure: settings.smtpSecure === true,
          auth: { user: settings.smtpUser, pass: settings.smtpPassword },
        });
        await transport.sendMail({
          from: settings.senderName ? `${settings.senderName} <${settings.senderEmail}>` : settings.senderEmail,
          to,
          subject: 'Complete your CRM account activation',
          text: `Hello ${fullName}, complete your account activation using this one-time link: ${inviteUrl}`,
          html: `<p>Hello ${escapeHtml(fullName)},</p><p>Complete your CRM account activation using this one-time link:</p><p><a href="${escapeHtml(inviteUrl)}">Activate your account</a></p>`,
        });
        return { delivered: true };
      } catch {
        return { delivered: false, reason: 'smtp_delivery_failed' };
      }
    },
  };
}

export const invitationMailer = createInvitationMailer();
