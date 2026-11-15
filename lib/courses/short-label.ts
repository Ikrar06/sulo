import type { CourseId, CourseRecord } from '../types';
import { KEEP_UPPERCASE, LOWERCASE_WORDS, ROMAN_NUMERALS } from './name-exceptions';

export const MAX_LABEL_LENGTH = 5;

/**
 * Short label from word initials: "ANALISA STRUKTUR I" -> "AS1",
 * "WAWASAN BUDAYA DAN IPTEKS" -> "WBI". A single word gives its first three
 * letters ("KALKULUS" -> "KAL").
 */
export function baseLabel(name: string): string {
  const words = name
    .toUpperCase()
    .split(/[\s\-/]+/)
    .filter((w) => w && !LOWERCASE_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return '?';
  if (words.length === 1) {
    const only = words[0]!;
    const roman = ROMAN_NUMERALS[only];
    return roman !== undefined ? String(roman) : only.replace(/[^A-Z0-9]/g, '').slice(0, 3) || '?';
  }
  const parts = words.map((w) => {
    const roman = ROMAN_NUMERALS[w];
    if (roman !== undefined) return String(roman);
    if (/^\d+$/.test(w)) return w;
    if (KEEP_UPPERCASE.has(w)) return w[0]!;
    return w.replace(/[^A-Z0-9]/g, '')[0] ?? '';
  });
  return parts.join('').slice(0, MAX_LABEL_LENGTH) || '?';
}

/**
 * Labels for a set of courses, unique within the set. Collisions get the class
 * letter, then a running number, always within MAX_LABEL_LENGTH.
 * User overrides (`label`) are kept as they are.
 */
export function assignLabels(
  courses: readonly Pick<CourseRecord, 'id' | 'label' | 'parsed'>[],
): Map<CourseId, string> {
  const result = new Map<CourseId, string>();
  const used = new Set<string>();
  for (const c of courses) {
    if (c.label) {
      result.set(c.id, c.label);
      used.add(c.label);
    }
  }
  const pending = courses.filter((c) => !c.label);
  const counts = new Map<string, number>();
  for (const c of pending) {
    const base = baseLabel(c.parsed.name);
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  for (const c of pending) {
    const base = baseLabel(c.parsed.name);
    const candidates = [base];
    if ((counts.get(base) ?? 0) > 1 && c.parsed.classLetter) {
      candidates.unshift(`${base.slice(0, MAX_LABEL_LENGTH - 1)}${c.parsed.classLetter}`);
    }
    let label = candidates.find((l) => !used.has(l));
    for (let n = 2; !label; n += 1) {
      const suffix = String(n);
      const candidate = `${base.slice(0, MAX_LABEL_LENGTH - suffix.length)}${suffix}`;
      if (!used.has(candidate)) label = candidate;
    }
    used.add(label);
    result.set(c.id, label);
  }
  return result;
}
