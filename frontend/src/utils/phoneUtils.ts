/**
 * Royal Wellness CRM - WhatsApp Phone Number Utilities
 * Ensures standardized canonical storage & beautiful presentation
 */

/**
 * Normalizes any phone input into canonical E.164-style representation (e.g. "+94771234567" or "94771234567")
 */
export const normalizeWhatsAppNumber = (phone?: string): string => {
  if (!phone) return '';
  if (isHardwareLid(phone)) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits || digits.length >= 13) return '';
  return `+${digits}`;
};

/**
 * Strips all formatting to yield raw digits (e.g. "94771234567")
 */
export const getCleanWhatsAppDigits = (phone?: string): string => {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
};

/**
 * Checks if a string is a raw internal hardware LID (13-16 digits e.g. 1766..., 2384..., etc.)
 */
export const isHardwareLid = (num?: string): boolean => {
  if (!num) return false;
  if (num.includes('@lid')) return true;
  const digits = num.replace(/[^0-9]/g, '');
  // Standard phone numbers worldwide are 7 to 12 digits (e.g., +94771234567 is 11 digits)
  if (digits.length <= 12) return false;
  return digits.length >= 13;
};

/**
 * Formats a phone number for user-facing UI displays (e.g. "+94 77 123 4567")
 */
export const formatWhatsAppDisplay = (phone?: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  
  if (!digits) return '';

  // Internal WhatsApp LID is an internal hardware ID, not a real phone number
  if (isHardwareLid(phone)) {
    return '';
  }

  // Sri Lanka: +94 XX XXX XXXX (11 digits total with country code)
  if (digits.startsWith('94') && digits.length === 11) {
    return `+94 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  
  // Sri Lanka local without 94: 077 123 4567 (10 digits)
  if (digits.startsWith('0') && digits.length === 10) {
    return `+94 ${digits.slice(1, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  // India: +91 XXXXX XXXXX (12 digits with 91)
  if (digits.startsWith('91') && digits.length === 12) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  // UK / Europe standard (e.g. +44 7XXX XXXXXX)
  if (digits.startsWith('44') && digits.length === 12) {
    return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }

  // Generic formatting with country code split
  if (digits.length >= 10) {
    const ccLength = digits.length > 10 ? 2 : 1;
    return `+${digits.slice(0, ccLength)} ${digits.slice(ccLength, ccLength + 3)} ${digits.slice(ccLength + 3, ccLength + 6)} ${digits.slice(ccLength + 6)}`;
  }

  return phone.startsWith('+') ? phone : `+${phone}`;
};
