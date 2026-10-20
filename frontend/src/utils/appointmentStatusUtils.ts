import { AppointmentStatus } from '../types';

export interface AppointmentStatusConfigItem {
  key: AppointmentStatus;
  label: string;
  colorName: string;
  badgeClass: string;
  schedulerCardClass: string;
  dotClass: string;
  iconEmoji: string;
  description: string;
}

/**
 * Standard Appointment Status Configuration matching Alpha Health Group CRM specs:
 * 
 * Status       Color     Description
 * -------------------------------------------------------------
 * Booked       🔵 Blue    Appointment successfully booked
 * Confirmed    🟢 Green   Customer confirmed the appointment
 * Arrived      🟣 Purple  Customer arrived at the location
 * Paid         🟡 Yellow  Customer completed payment
 * Rescheduled  🟠 Orange  Appointment moved to another date or time
 * Cancelled    🔴 Red     Appointment cancelled
 * No Answer    ⚫ Gray    Customer did not respond
 */
export const APPOINTMENT_STATUS_CONFIG: Record<string, AppointmentStatusConfigItem> = {
  booked: {
    key: 'booked',
    label: 'Booked',
    colorName: 'Blue',
    badgeClass: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    schedulerCardClass: 'bg-blue-950/70 border-blue-500/70 text-blue-100 hover:border-blue-400',
    dotClass: 'bg-blue-400',
    iconEmoji: '🔵',
    description: 'Appointment successfully booked'
  },
  confirmed: {
    key: 'confirmed',
    label: 'Confirmed',
    colorName: 'Green',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    schedulerCardClass: 'bg-emerald-950/70 border-emerald-500/70 text-emerald-100 hover:border-emerald-400',
    dotClass: 'bg-emerald-400',
    iconEmoji: '🟢',
    description: 'Customer confirmed the appointment'
  },
  arrived: {
    key: 'arrived',
    label: 'Arrived',
    colorName: 'Purple',
    badgeClass: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    schedulerCardClass: 'bg-purple-950/70 border-purple-500/70 text-purple-100 hover:border-purple-400',
    dotClass: 'bg-purple-400',
    iconEmoji: '🟣',
    description: 'Customer arrived at the location'
  },
  paid: {
    key: 'paid',
    label: 'Paid',
    colorName: 'Yellow',
    badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    schedulerCardClass: 'bg-amber-950/70 border-amber-500/70 text-amber-100 hover:border-amber-400',
    dotClass: 'bg-amber-400',
    iconEmoji: '🟡',
    description: 'Customer completed payment'
  },
  rescheduled: {
    key: 'rescheduled',
    label: 'Rescheduled',
    colorName: 'Orange',
    badgeClass: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    schedulerCardClass: 'bg-orange-950/70 border-orange-500/70 text-orange-100 hover:border-orange-400',
    dotClass: 'bg-orange-400',
    iconEmoji: '🟠',
    description: 'Appointment moved to another date or time'
  },
  cancelled: {
    key: 'cancelled',
    label: 'Cancelled',
    colorName: 'Red',
    badgeClass: 'bg-rose-500/15 text-rose-400 border border-rose-500/30 line-through opacity-85',
    schedulerCardClass: 'bg-rose-950/50 border-rose-600/50 text-rose-300 line-through opacity-65',
    dotClass: 'bg-rose-400',
    iconEmoji: '🔴',
    description: 'Appointment cancelled'
  },
  no_answer: {
    key: 'no_answer',
    label: 'No Answer',
    colorName: 'Gray',
    badgeClass: 'bg-slate-700/50 text-slate-300 border border-slate-600/40',
    schedulerCardClass: 'bg-slate-900 border-slate-700 text-slate-400 line-through opacity-75',
    dotClass: 'bg-slate-400',
    iconEmoji: '⚫',
    description: 'Customer did not respond'
  }
};

/**
 * Normalizes legacy appointment statuses to the new standard 7 statuses.
 */
export function normalizeAppointmentStatus(status?: string | null): AppointmentStatus {
  if (!status) return 'booked';
  const clean = String(status).toLowerCase().trim();

  // Direct matches
  if (APPOINTMENT_STATUS_CONFIG[clean]) {
    return clean as AppointmentStatus;
  }

  // Legacy mappings
  switch (clean) {
    case 'pending':
      return 'booked';
    case 'checked_in':
    case 'in_progress':
      return 'arrived';
    case 'completed':
      return 'paid';
    case 'no_show':
    case 'no-show':
    case 'no answer':
      return 'no_answer';
    default:
      return 'booked';
  }
}

/**
 * Returns configuration item for an appointment status with fallback.
 */
export function getAppointmentStatusConfig(status?: string | null): AppointmentStatusConfigItem {
  const normalized = normalizeAppointmentStatus(status);
  return APPOINTMENT_STATUS_CONFIG[normalized] || APPOINTMENT_STATUS_CONFIG.booked;
}

