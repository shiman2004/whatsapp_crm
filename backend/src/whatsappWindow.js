export function formatWindowTimestamp(dateOrIso) {
  if (!dateOrIso) return '---';
  const date = new Date(dateOrIso);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return '---';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let hours = date.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}, ${String(hours).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')} ${ampm}`;
}

export function formatWindowCountdown(remainingMs) {
  if (remainingMs <= 0) return '00h 00m 00s';
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

export function getWindowStatus(remainingMs, hasCustomerMessage) {
  if (!hasCustomerMessage || remainingMs <= 0) return { status: 'expired', label: '24H Window Expired' };
  const remainingHours = remainingMs / (60 * 60 * 1000);
  if (remainingHours > 6) return { status: 'active', label: 'Active' };
  if (remainingHours >= 1) return { status: 'expiring_soon', label: 'Expiring Soon' };
  return { status: 'urgent', label: 'Urgent' };
}

export function getLatestCustomerMessageTime(lead, messages) {
  if (!lead) return 0;
  const relevantMessages = messages?.length ? messages : (lead.messages || []);
  const inbound = relevantMessages.filter(message => message.direction === 'inbound');
  if (inbound.length) {
    const timestamps = inbound.map(message => new Date(message.createdAt).getTime()).filter(Number.isFinite);
    if (timestamps.length) return Math.max(...timestamps);
  }
  const fallback = new Date(lead.lastCustomerMessageAt || 0).getTime();
  return Number.isFinite(fallback) ? fallback : 0;
}
