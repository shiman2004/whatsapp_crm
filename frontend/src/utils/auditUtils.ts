/**
 * Internal Message Sender Identification & Audit Trail Utilities
 * Module: Alpha Health Group - WhatsApp CRM Live Chat
 * Visibility: Super Admin ONLY
 */

/**
 * Format timestamp in Sri Lanka Time (Asia/Colombo / UTC+5:30)
 * Example output: "12 Oct 2026, 10:06 PM"
 */
export function formatSriLankaDateTime(dateInput?: string | Date | number): string {
  if (!dateInput) return '';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    
    // Format using Intl.DateTimeFormat in Asia/Colombo time zone
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Colombo',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);

    // en-GB produces: "12 Oct 2026, 10:06 pm" -> convert pm/am to uppercase PM/AM
    return formatted.replace(/\bam\b/gi, 'AM').replace(/\bpm\b/gi, 'PM');
  } catch {
    return new Date(dateInput).toLocaleString();
  }
}

/**
 * Format user role nicely for audit display
 * e.g. "super_admin" -> "Super Admin", "leads_officer" -> "Sales Officer", "coordinator" -> "Sales Officer"
 */
export function formatSenderRole(role?: string, roleTitle?: string): string {
  if (roleTitle && roleTitle.trim()) {
    return roleTitle.trim();
  }
  if (!role) return '';
  const r = role.toLowerCase().trim();
  if (r === 'super_admin' || r === 'super admin') return 'Super Admin';
  if (r === 'leads_officer' || r === 'leads officer') return 'Sales Officer';
  if (r === 'sales_officer' || r === 'sales officer') return 'Sales Officer';
  if (r === 'clinic_manager' || r === 'clinic manager') return 'Clinic Manager';
  if (r === 'coordinator') return 'Sales Officer';
  if (r === 'system' || r === 'automation') return 'System / Automation';
  // Fallback: capitalize words
  return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Build the Super Admin audit display text
 * Format: "Sent by: {Name} ({Role}) • {Date}, {Time}"
 * Examples:
 * - "Sent by: Jahan (Super Admin) • 12 Oct 2026, 10:06 PM"
 * - "Sent by: Faiha (Sales Officer) • 12 Oct 2026, 10:10 PM"
 * - "Sent by: Hasini (Sales Officer) • 12 Oct 2026, 10:13 PM"
 * - "Sent by: Dr. Zeenath (Clinic Manager) • 12 Oct 2026, 10:18 PM"
 * - "Sent by: System / Automation • 12 Oct 2026, 10:20 PM"
 */
export function getMessageSenderAuditText(message: {
  senderName?: string;
  senderRole?: string;
  senderType?: string;
  messageSource?: string;
  sentAt?: string;
  createdAt?: string;
}): string | null {
  const isSystem = message.messageSource === 'System' || 
                   message.messageSource === 'Automation' || 
                   message.senderType === 'system' || 
                   message.senderType === 'ai';

  const timeStr = formatSriLankaDateTime(message.sentAt || message.createdAt);

  if (isSystem) {
    return timeStr ? `Sent by: System / Automation • ${timeStr}` : 'Sent by: System / Automation';
  }

  // If no sender information is recorded for this historical message, do not invent identity
  if (!message.senderName && !message.senderRole) {
    return null;
  }

  const name = message.senderName || 'Staff';
  const role = formatSenderRole(message.senderRole);

  if (role) {
    return timeStr ? `Sent by: ${name} (${role}) • ${timeStr}` : `Sent by: ${name} (${role})`;
  }

  return timeStr ? `Sent by: ${name} • ${timeStr}` : `Sent by: ${name}`;
}
