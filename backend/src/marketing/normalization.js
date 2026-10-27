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

/**
 * Normalizes an array of numbers or structured contact objects.
 * Supports:
 *   - Plain phone strings: ["+94771234567", "0770000001"]
 *   - Objects: [{ phone: "0771234567", name: "John", notes: "VIP", sourceGroupName: "Expo 2026" }]
 */
export function normalizeMany(values, defaultRegion = DEFAULT_REGION) {
  return values.map((value, index) => {
    let rawPhone = '';
    let name = null;
    let notes = null;
    let sourceGroupName = null;
    let source = null;

    if (value && typeof value === 'object') {
      rawPhone = String(
        value.phone ||
        value.phoneNumber ||
        value.rawPhone ||
        value.mobile ||
        value.contact ||
        value.telephone ||
        value.whatsapp ||
        value.number ||
        ''
      ).trim();
      name = value.name || value.fullName || value.contactName || null;
      notes = value.notes || value.note || value.qualificationNote || null;
      sourceGroupName = value.sourceGroupName || value.sourceName || value.group || value.groupName || null;
      source = value.source || value.originalSource || null;
    } else {
      rawPhone = String(value ?? '').trim();
    }

    const normalized = normalizeE164(rawPhone, defaultRegion);
    return {
      rowNumber: index + 1,
      rawPhone,
      normalizedPhone: normalized,
      isValid: Boolean(normalized),
      name: name ? String(name).trim() : null,
      notes: notes ? String(notes).trim() : null,
      sourceGroupName: sourceGroupName ? String(sourceGroupName).trim() : null,
      source: source ? String(source).trim() : null,
    };
  });
}

/**
 * Standards-compliant RFC-4180 CSV / TSV parser.
 * Handles:
 *   - UTF-8 BOM marker removal (\uFEFF)
 *   - Commas, semicolons, or tabs as delimiters
 *   - Quoted fields containing delimiters, quotes, or newlines
 *   - Escaped double quotes ("") inside quotes
 *   - Both \r\n and \n line breaks
 *   - Header auto-detection and normalization
 */
export function parseStandardsCompliantCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];

  // 1. Remove UTF-8 BOM if present
  let text = csvText.replace(/^\uFEFF/, '');

  // 2. Detect delimiter from first non-empty line
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) || '';
  let delimiter = ',';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = '\t';
  } else if (semicolonCount > commaCount) {
    delimiter = ';';
  }

  // 3. RFC-4180 Tokenizer / Parser state machine
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped double quote
        currentField += '"';
        i++; // skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      // End of field
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      // End of line
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n in \r\n
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some(f => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  // Final field & row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return [];

  // 4. Header Detection
  const firstRow = rows[0].map(h => h.toLowerCase().replace(/[\s\-_]/g, ''));
  const phoneHeaderIdx = firstRow.findIndex(h =>
    ['phone', 'phonenumber', 'mobile', 'contact', 'telephone', 'whatsapp', 'number', 'tel'].includes(h)
  );

  let headers = null;
  let dataRows = rows;

  if (phoneHeaderIdx !== -1) {
    headers = firstRow;
    dataRows = rows.slice(1);
  }

  // 5. Transform rows to contact objects
  return dataRows.map(row => {
    if (!headers) {
      // If no headers detected, assume first column with digits is phone, second is name
      const phoneCol = row.find(c => /[\d]{7,}/.test(c)) || row[0] || '';
      const nameCol = row.find(c => c !== phoneCol && !/^[\d\s+\-()]+$/.test(c)) || '';
      return {
        phone: phoneCol,
        name: nameCol || null,
        sourceGroupName: null,
        notes: null,
      };
    }

    const obj = {};
    headers.forEach((h, idx) => {
      const val = row[idx] || '';
      if (['phone', 'phonenumber', 'mobile', 'contact', 'telephone', 'whatsapp', 'number', 'tel'].includes(h)) {
        obj.phone = val;
      } else if (['name', 'fullname', 'contactname', 'patientname', 'leadname'].includes(h)) {
        obj.name = val;
      } else if (['group', 'groupname', 'sourcegroup', 'sourcegroupname'].includes(h)) {
        obj.sourceGroupName = val;
      } else if (['source', 'originalsource', 'channel'].includes(h)) {
        obj.source = val;
      } else if (['notes', 'note', 'remarks', 'comment', 'qualificationnote'].includes(h)) {
        obj.notes = val;
      }
    });

    return {
      phone: obj.phone || row[0] || '',
      name: obj.name || null,
      sourceGroupName: obj.sourceGroupName || null,
      source: obj.source || null,
      notes: obj.notes || null,
    };
  }).filter(r => Boolean(r.phone && r.phone.trim()));
}
