import { Lead, Message } from '../types';

export type WindowStatusType = 'active' | 'expiring_soon' | 'urgent' | 'expired';

export interface WindowStatusInfo {
  status: WindowStatusType;
  label: string;
  dotColor: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  iconColor: string;
  countdownColor: string;
}

/**
 * Formats date/time matching screenshot: "13 Oct 2026, 10:50:18 PM"
 */
export function formatWindowTimestamp(dateOrIso: string | number | Date | null | undefined): string {
  if (!dateOrIso) return '---';
  const d = new Date(dateOrIso);
  if (isNaN(d.getTime()) || d.getTime() === 0) return '---';

  const day = d.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = hours.toString().padStart(2, '0');

  return `${day} ${month} ${year}, ${formattedHours}:${minutes}:${seconds} ${ampm}`;
}

/**
 * Formats countdown matching screenshot: "22h 15m 42s"
 */
export function formatWindowCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return '00h 00m 00s';
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = seconds.toString().padStart(2, '0');

  return `${hStr}h ${mStr}m ${sStr}s`;
}

/**
 * Returns window status based on requirements:
 * 🟢 Active — More than 6 hours remaining
 * 🟠 Expiring Soon — 1 to 6 hours remaining
 * 🔴 Urgent — Less than 1 hour remaining
 * ⚫ 24H Window Expired — 0 hours remaining
 */
export function getWindowStatus(remainingMs: number, hasCustomerMessage: boolean): WindowStatusInfo {
  if (!hasCustomerMessage || remainingMs <= 0) {
    return {
      status: 'expired',
      label: '24H Window Expired',
      dotColor: 'bg-slate-500',
      badgeBg: 'bg-slate-800/80',
      badgeBorder: 'border-slate-700',
      textColor: 'text-slate-400',
      iconColor: 'text-slate-500',
      countdownColor: 'text-slate-400'
    };
  }

  const remainingHours = remainingMs / (1000 * 60 * 60);

  if (remainingHours > 6) {
    return {
      status: 'active',
      label: 'Active',
      dotColor: 'bg-emerald-400',
      badgeBg: 'bg-emerald-500/15',
      badgeBorder: 'border-emerald-500/30',
      textColor: 'text-emerald-400',
      iconColor: 'text-emerald-400',
      countdownColor: 'text-emerald-400'
    };
  }

  if (remainingHours >= 1) {
    return {
      status: 'expiring_soon',
      label: 'Expiring Soon',
      dotColor: 'bg-amber-400',
      badgeBg: 'bg-amber-500/15',
      badgeBorder: 'border-amber-500/30',
      textColor: 'text-amber-400',
      iconColor: 'text-amber-400',
      countdownColor: 'text-amber-400'
    };
  }

  return {
    status: 'urgent',
    label: 'Urgent',
    dotColor: 'bg-rose-500 animate-ping',
    badgeBg: 'bg-rose-500/15',
    badgeBorder: 'border-rose-500/30',
    textColor: 'text-rose-400',
    iconColor: 'text-rose-400',
    countdownColor: 'text-rose-400'
  };
}

/**
 * Calculates the latest customer inbound message timestamp.
 * Staff replies (outbound) are strictly excluded and NEVER reset this timestamp.
 */
export function getLatestCustomerMessageTime(lead: Lead, messages?: Message[]): number {
  if (!lead) return 0;

  const relevantMessages: Message[] = (messages && messages.length > 0)
    ? messages
    : ((lead as any).messages || []);

  const inbound = relevantMessages.filter((m: Message) => m.direction === 'inbound');

  if (inbound.length > 0) {
    const latest = inbound.reduce((latestMsg: Message, m: Message) => {
      const t = new Date(m.createdAt).getTime();
      const curLatest = new Date(latestMsg.createdAt).getTime();
      return t > curLatest ? m : latestMsg;
    });
    return new Date(latest.createdAt).getTime();
  }

  if (lead.lastCustomerMessageAt) {
    const t = new Date(lead.lastCustomerMessageAt).getTime();
    if (!isNaN(t)) return t;
  }

  return 0;
}
