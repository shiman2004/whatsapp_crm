/** Appointment times are stored as UTC ISO strings and shown in Asia/Colombo. */
export const COLOMBO_TIME_ZONE = 'Asia/Colombo';
export const COLOMBO_OFFSET = '+05:30';

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: COLOMBO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: COLOMBO_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** YYYY-MM-DD for the given instant, in clinic time. */
export function colomboDateKey(value: string | Date = new Date()): string {
  return dateKeyFormatter.format(typeof value === 'string' ? new Date(value) : value);
}

/** HH:mm for the given instant, in clinic time. */
export function colomboTimeKey(value: string | Date): string {
  return timeFormatter.format(typeof value === 'string' ? new Date(value) : value);
}

/** Local date + HH:mm in clinic time → UTC ISO string for the API. */
export function toColomboISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00${COLOMBO_OFFSET}`).toISOString();
}

export function formatColomboDate(iso?: string | null, options: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: COLOMBO_TIME_ZONE, ...options });
}

export function formatColomboTime(iso?: string | null): string {
  if (!iso) return '—';
  return colomboTimeKey(iso);
}

export function formatColomboDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return `${formatColomboDate(iso, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · ${formatColomboTime(iso)}`;
}

/** Add minutes to an HH:mm value, returning HH:mm (clamped to the same day). */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min((h * 60) + m + minutes, (23 * 60) + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Shift a YYYY-MM-DD date key without timezone drift. */
export function shiftDateKey(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00${COLOMBO_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + days);
  return colomboDateKey(d);
}

/** Monday-based week containing the given date key. */
export function weekDates(date: string): string[] {
  const day = new Date(`${date}T12:00:00${COLOMBO_OFFSET}`).getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return Array.from({ length: 7 }, (_, i) => shiftDateKey(date, mondayOffset + i));
}

export function formatDateKey(date: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return new Date(`${date}T12:00:00${COLOMBO_OFFSET}`).toLocaleDateString('en-GB', { timeZone: COLOMBO_TIME_ZONE, ...options });
}

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
