const DEFAULT_REGION = 'LK';

/**
 * Normalizes a phone number to standard E.164.
 * Handles Sri Lankan formats:
 *   - 0771234567   -> +94771234567
 *   - 771234567    -> +94771234567
 *   - 94771234567  -> +94771234567
 *   - +94771234567 -> +94771234567
 *   - 0112345678   -> +94112345678 (landlines)
 * Handles international numbers:
 *   - +12025550199  -> +12025550199
 *   - 0012025550199 -> +12025550199
 * Rejects ambiguous, too-short or invalid numbers.
 */
export function normalizeE164(value, defaultRegion = DEFAULT_REGION) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // Remove common formatting characters
  let cleaned = raw.replace(/[\s\-\.\(\)\\\/]/g, '');

  // Convert leading 00 to +
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  // Already prefixed with '+'
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (!/^\d{7,15}$/.test(digits)) return null;

    // Strict validation for Sri Lanka (+94)
    if (digits.startsWith('94')) {
      const lkLocal = digits.slice(2);
      if (!/^[1-9]\d{8}$/.test(lkLocal)) {
        return null;
      }
    }
    return cleaned;
  }

  // Pure digits only from here
  if (!/^\d+$/.test(cleaned)) {
    return null;
  }

  // Regional handling for LK
  if (defaultRegion === 'LK') {
    // 94 followed by 9 digits
    if (cleaned.startsWith('94') && cleaned.length === 11 && /^[1-9]\d{8}$/.test(cleaned.slice(2))) {
      return `+${cleaned}`;
    }

    // 0 followed by 9 digits (07XXXXXXXX or 01XXXXXXXX)
    if (cleaned.startsWith('0') && cleaned.length === 10 && /^[1-9]\d{8}$/.test(cleaned.slice(1))) {
      return `+94${cleaned.slice(1)}`;
    }

    // 9 digits without leading 0 (e.g. 7XXXXXXXX)
    if (cleaned.length === 9 && /^[1-9]\d{8}$/.test(cleaned)) {
      return `+94${cleaned}`;
    }
  }

  // Other valid international phone digits (10-15 digits)
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return `+${cleaned}`;
  }

  return null;
}

export function isValidE164(phone) {
  if (!phone || typeof phone !== 'string') return false;
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

export function normalizeMany(values, defaultRegion = DEFAULT_REGION) {
  return values.map((value, index) => {
    const rawPhone = String(value ?? '').trim();
    const normalized = normalizeE164(rawPhone, defaultRegion);
    return {
      rowNumber: index + 1,
      rawPhone,
      normalizedPhone: normalized,
      isValid: Boolean(normalized)
    };
  });
}
