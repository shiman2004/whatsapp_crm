/**
 * Date Utility for WhatsApp CRM
 * Provides authentic WhatsApp Web date dividers, group headers, and chat list timestamps.
 */

/**
 * Computes calendar day difference between target date and base date (normalized to local midnight).
 * Positive number means target is in the past (e.g. 1 = yesterday).
 * 0 means target is today.
 * Negative number means target is in the future.
 */
export function getCalendarDayDiff(target: Date, base: Date = new Date()): number {
  if (isNaN(target.getTime()) || isNaN(base.getTime())) return 0;
  const startOfBase = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const diffMs = startOfBase - startOfTarget;
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Returns a unique string key for a calendar date (local time) to compare day boundaries.
 * Format: "YYYY-MM-DD"
 */
export function getDayKey(dateInput?: string | Date | number | null): string {
  if (!dateInput) return 'invalid';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'invalid';
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Formats a message timestamp into a WhatsApp Web chat divider label:
 * - "Today"
 * - "Yesterday"
 * - "Monday", "Sunday", etc. (within the past 6 days)
 * - "10 October 2026" (older than 6 days)
 */
export function formatChatDateDivider(dateInput?: string | Date | number | null): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffDays = getCalendarDayDiff(date, now);

  if (diffDays <= 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays >= 2 && diffDays <= 6) {
    return date.toLocaleDateString([], { weekday: 'long' });
  }

  // Older than 6 days: standard full date matching WhatsApp Web
  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Formats a timestamp for the left sidebar chat list (exact WhatsApp Web behavior):
 * - If today: "08:57"
 * - If yesterday: "Yesterday"
 * - If within last 6 days: "Sun", "Mon", etc.
 * - If older than 6 days: "10/10/26"
 */
export function formatChatListTimestamp(dateInput?: string | Date | number | null): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffDays = getCalendarDayDiff(date, now);

  if (diffDays <= 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays >= 2 && diffDays <= 6) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }

  return date.toLocaleDateString([], {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });
}
