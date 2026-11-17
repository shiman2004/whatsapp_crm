export interface FilterOption {
  value: string;
  label: string;
}

const PLACEHOLDERS = new Set(['—', '-', 'n/a', 'na', 'null', 'undefined', 'none']);

/**
 * Trim filter option text, drop empty/placeholder values, and dedupe case-insensitively.
 */
export function sanitizeFilterOptions(
  options: Array<{ value?: string | null; label?: string | null }>,
): FilterOption[] {
  const seen = new Set<string>();
  const result: FilterOption[] = [];
  for (const option of options) {
    const value = String(option.value ?? '').trim();
    if (!value || PLACEHOLDERS.has(value.toLowerCase())) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ value, label: String(option.label ?? '').trim() || value });
  }
  return result;
}
