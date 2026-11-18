import type { CourseRecord } from '../types';
import { KEEP_UPPERCASE, LOWERCASE_WORDS, ROMAN_NUMERALS } from './name-exceptions';

const hasLowercase = (s: string) => /[a-z]/.test(s);

function titleWord(word: string, isFirst: boolean): string {
  if (ROMAN_NUMERALS[word] !== undefined || KEEP_UPPERCASE.has(word) || /\d/.test(word)) return word;
  const lower = word.toLowerCase();
  if (!isFirst && LOWERCASE_WORDS.has(lower)) return lower;
  return lower
    .split('-')
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join('-');
}

/**
 * Readable alias for an all-caps course name: "ANALISA STRUKTUR I" ->
 * "Analisa Struktur I". Names that already contain lower case are kept as is.
 */
export function toDisplayCase(name: string): string {
  if (hasLowercase(name)) return name;
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => titleWord(word, i === 0))
    .join(' ');
}

/** The alias shown in the UI: the user's alias, or the parsed name in display case. */
export function courseAlias(course: Pick<CourseRecord, 'alias' | 'parsed'>): string {
  return course.alias ?? toDisplayCase(course.parsed.name);
}

/** Name plus class letter for lists ("Analisa Struktur I B"). */
export function courseNameWithClass(course: Pick<CourseRecord, 'alias' | 'parsed'>): string {
  const alias = courseAlias(course);
  return course.parsed.classLetter ? `${alias} ${course.parsed.classLetter}` : alias;
}
