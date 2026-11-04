import assert from 'node:assert/strict';
import { createInvitationMailer } from './src/services/invitationMailer.js';

const invitation = {
  to: 'invitee@example.test',
  fullName: 'Invited Staff',
  inviteUrl: 'https://crm.example.test/#/accept-invitation?token=one-time-token',
};

{
  let transportCreated = false;
  const mailer = createInvitationMailer({
    loadSettings: async () => null,
    createTransport: () => { transportCreated = true; },
  });
  assert.deepEqual(await mailer.sendInvitationEmail(invitation), { delivered: false, reason: 'smtp_not_configured' });
  assert.equal(transportCreated, false);
}

{
  let transportConfig;
  let sent;
  const mailer = createInvitationMailer({
    loadSettings: async () => ({
      smtpHost: 'smtp.example.test', smtpPort: 587, smtpSecure: false,
      smtpUser: 'mailer-user', smtpPassword: 'mailer-password',
      senderName: 'CRM', senderEmail: 'no-reply@example.test',
    }),
    createTransport: (config) => {
      transportConfig = config;
      return { sendMail: async (message) => { sent = message; } };
    },
  });
  assert.deepEqual(await mailer.sendInvitationEmail(invitation), { delivered: true });
  assert.deepEqual(transportConfig, {
    host: 'smtp.example.test', port: 587, secure: false,
    auth: { user: 'mailer-user', pass: 'mailer-password' },
  });
  assert.equal(sent.to, invitation.to);
  assert.match(sent.html, /one-time-token/);
}

{
  const mailer = createInvitationMailer({
    loadSettings: async () => ({ smtpHost: 'smtp.example.test', smtpPort: 587, smtpUser: 'u', smtpPassword: 'p', senderEmail: 'no-reply@example.test' }),
    createTransport: () => ({ sendMail: async () => { throw new Error('SMTP rejected'); } }),
  });
  assert.deepEqual(await mailer.sendInvitationEmail(invitation), { delivered: false, reason: 'smtp_delivery_failed' });
}

console.log('Invitation mailer tests passed');
