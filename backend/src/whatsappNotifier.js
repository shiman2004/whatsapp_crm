/**
 * WhatsApp Notification Service for Appointments
 * Dispatches Meta Cloud API & Baileys notifications and records message audits
 */
import { COMPANIES } from './companyConfig.js';

export async function sendAppointmentNotification({
  eventType = 'booking_confirmed', // 'booking_confirmed' | 'rescheduled' | 'cancelled' | 'reminder'
  patientName,
  patientPhone,
  appointmentDate,
  startTime,
  endTime,
  branchName,
  roomName,
  treatmentName,
  doctorName,
  cancellationReason,
  metaToken,
  metaPhoneId,
  prisma,
  customerId
}) {
  if (!patientPhone) return { sent: false, reason: 'No patient phone number provided' };

  const cleanPhone = String(patientPhone).replace(/[^0-9]/g, '');
  if (cleanPhone.length < 9) return { sent: false, reason: 'Invalid phone format' };

  try {
    const { canSendWhatsApp } = await import('./modules/marketing/services/consent.service.js');
    const gate = await canSendWhatsApp(patientPhone, 'template', { check24hWindow: false });
    if (!gate.allowed) {
      return { sent: false, reason: gate.reason, code: gate.code };
    }
  } catch (e) {
    // ignore gate errors to not break existing appointment notifications
  }

  // Prepare standard clinical messages
  let messageText = '';
  const dateStr = appointmentDate || new Date().toISOString().split('T')[0];
  const timeStr = `${startTime || ''}${endTime ? ' - ' + endTime : ''}`.trim();

  if (eventType === 'booking_confirmed') {
    messageText = 
`Hello ${patientName || 'Valued Patient'}, your appointment at Alpha Health Group has been confirmed.

📅 Date: ${dateStr}
⏰ Time: ${timeStr}
📍 Branch: ${branchName || 'Alpha Health Group'}
🚪 Room: ${roomName || 'Clinical Suite'}
🩺 Treatment: ${treatmentName || 'Clinical Consultation'}
👨‍⚕️ Doctor: ${doctorName || 'Assigned Specialist'}

Please arrive 10 minutes prior to your scheduled time. If you need to make changes, kindly reply to this message. Thank you.`;
  } else if (eventType === 'rescheduled') {
    messageText = 
`Hello ${patientName || 'Valued Patient'}, your appointment at Alpha Health Group has been rescheduled.

📅 New Date: ${dateStr}
⏰ New Time: ${timeStr}
📍 Branch: ${branchName || 'Alpha Health Group'}
🚪 Room: ${roomName || 'Clinical Suite'}
🩺 Treatment: ${treatmentName || 'Clinical Consultation'}
👨‍⚕️ Doctor: ${doctorName || 'Assigned Specialist'}

Thank you for choosing Alpha Health Group.`;
  } else if (eventType === 'cancelled') {
    messageText = 
`Hello ${patientName || 'Valued Patient'}, your appointment scheduled for ${dateStr} at ${timeStr} has been cancelled.
${cancellationReason ? `Reason: ${cancellationReason}` : ''}

If you would like to reschedule or have questions, please reply to this message or contact our clinic concierge.`;
  } else {
    messageText = 
`Hello ${patientName || 'Valued Patient'}, this is a reminder for your upcoming appointment at Alpha Health Group.

📅 Date: ${dateStr}
⏰ Time: ${timeStr}
📍 Branch: ${branchName || 'Alpha Health Group'}
🩺 Treatment: ${treatmentName || 'Clinical Consultation'}

We look forward to seeing you.`;
  }

  // Non-blocking dispatch
  try {
    const token = (metaToken || process.env.META_ACCESS_TOKEN || '').trim();
    const phoneId = (metaPhoneId || process.env.META_PHONE_NUMBER_ID_RWC || process.env.META_PHONE_NUMBER_ID || '1358157244046701').trim();

    if (token && phoneId) {
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { body: messageText }
      };

      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.messages?.[0]?.id) {
        const waMessageId = data.messages[0].id;
        console.log(`✅ [Appointment WA Notification] Dispatched to ${cleanPhone} (ID: ${waMessageId})`);

        // If customer exists, log to messages table and audit
        if (prisma && customerId) {
          try {
            // Find existing lead for customer to attach message
            const lead = await prisma.lead.findFirst({
              where: { customerId: customerId },
              orderBy: { createdAt: 'desc' }
            }).catch(() => null);

            if (lead) {
              await prisma.message.create({
                data: {
                  id: waMessageId,
                  leadId: lead.id,
                  customerId: customerId,
                  direction: 'outbound',
                  senderType: 'system',
                  content: messageText,
                  status: 'sent',
                  messageSource: 'Automation',
                  senderName: 'Alpha Appointment Concierge',
                  senderRole: 'System'
                }
              }).catch(() => null);
            }
          } catch (e) {
            console.warn('Logging appointment WA notification to message table skipped:', e.message);
          }
        }

        return { sent: true, waMessageId, status: 'delivered_or_sent' };
      } else {
        console.warn('⚠️ [Appointment WA Notification] Meta API responded with status:', res.status, data);
        return { sent: false, error: data?.error?.message || 'Meta API error' };
      }
    } else {
      console.log(`ℹ️ [Appointment WA Notification] Meta token/phoneId not configured. Simulating outbound text to ${cleanPhone}: "${messageText.slice(0, 60)}..."`);
      return { sent: true, simulated: true, preview: messageText };
    }
  } catch (err) {
    console.warn('⚠️ [Appointment WA Notification] Network dispatch error:', err.message);
    return { sent: false, error: err.message };
  }
}

