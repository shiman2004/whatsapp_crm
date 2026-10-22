const DEFAULT_REGION = 'LK';

export function normalizeE164(value, region = DEFAULT_REGION) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const compact = raw.replace(/[().\s-]/g, '');
  let candidate = compact;
  if (candidate.startsWith('00')) candidate = `+${candidate.slice(2)}`;
  if (!candidate.startsWith('+') && region === 'LK') {
    candidate = candidate.startsWith('0') ? `+94${candidate.slice(1)}` : `+94${candidate}`;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(candidate)) return null;
  return candidate;
}

export function normalizeMany(values, region) {
  return values.map((value, index) => ({
    rowNumber: index + 1,
    rawPhone: String(value ?? '').trim(),
    normalizedPhone: normalizeE164(value, region)
  }));
}
