// In-extension leak scan, sharing patterns with scripts/check-leaks.mjs.
import { findLeaks } from './leak-rules.mjs';

export { findLeaks };

/** Rule names that matched, deduplicated. Never the matched values. */
export function leakReport(value: unknown): string[] {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return [...new Set(findLeaks(text))];
}
