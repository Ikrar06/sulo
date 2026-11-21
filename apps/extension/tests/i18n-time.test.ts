import { describe, expect, it } from 'vitest';
import { googleCalendarUrl } from '@sulo/core/format/gcal';
import { formatAgo, countdownOrLate, formatDueClock, formatLeft, formatRemaining } from '@sulo/core/format/time';
import { localeFromUiLanguage, messagesFor, resolveLocale } from '@sulo/core/i18n';
import { en } from '@sulo/core/i18n/en';
import { id } from '@sulo/core/i18n/id';
import { DEFAULT_PREFS, PREFS_KEY, readPrefs, writePrefs } from '@sulo/core/prefs';
import { memoryStore } from './helpers';

const TZ = 'Asia/Makassar';
const at = (y: number, mo: number, d: number, h: number, mi: number, s = 0) => Date.UTC(y, mo - 1, d, h - 8, mi, s) / 1000; // WITA
const NOW = at(2026, 11, 13, 10, 0); // Fri 13 Nov 2026, 10.00 WITA
const H = 3600;

describe('due time formats', () => {
  it('"Sisa waktu dan jam": time left plus the due day and time', () => {
    expect(formatLeft(NOW + 5 * H, NOW, TZ)).toBe('5 jam lagi');
    expect(formatDueClock(NOW + 5 * H, NOW, TZ)).toBe('hari ini 15.00');
    expect(formatLeft(at(2026, 11, 19, 23, 59), NOW, TZ)).toBe('6 hari lagi');
    expect(formatDueClock(at(2026, 11, 19, 23, 59), NOW, TZ)).toBe('Kamis 23.59');
    expect(formatDueClock(at(2026, 11, 14, 8, 0), NOW, TZ)).toBe('besok 08.00');
    expect(formatDueClock(at(2026, 12, 2, 23, 59), NOW, TZ)).toBe('2 Des 23.59');
  });

  it('"Hitung mundur": hh:mm:ss under a day, days plus hh:mm:ss from a day', () => {
    expect(countdownOrLate(NOW + 5 * H + 12 * 60 + 30, NOW, TZ)).toBe('05:12:30');
    expect(countdownOrLate(NOW + 2 * 86_400 + 5 * H + 12 * 60 + 30, NOW, TZ)).toBe('2 hari 05:12:30');
    expect(countdownOrLate(NOW + 59, NOW, TZ)).toBe('00:00:59');
  });

  it('never counts down below zero: past due reads "terlambat"', () => {
    expect(countdownOrLate(NOW - 2 * H, NOW, TZ)).toBe('terlambat 2 jam');
    expect(countdownOrLate(at(2026, 11, 10, 23, 59), NOW, TZ)).toBe('terlambat 3 hari');
    expect(formatLeft(NOW - 2 * H, NOW, TZ)).toBe('terlambat 2 jam');
  });

  it('reads naturally in English, with plurals and a 24-hour clock', () => {
    expect(formatRemaining(NOW + 1 * H, NOW, TZ, en)).toBe('1 hour');
    expect(formatRemaining(NOW - 3 * H, NOW, TZ, en)).toBe('3 hours late');
    expect(formatLeft(NOW + 5 * H, NOW, TZ, en)).toBe('5 hours left');
    expect(formatDueClock(at(2026, 11, 19, 23, 59), NOW, TZ, en)).toBe('Thursday 23:59');
    expect(formatDueClock(at(2026, 11, 14, 8, 0), NOW, TZ, en)).toBe('tomorrow 08:00');
    expect(countdownOrLate(NOW + 86_400 + 1, NOW, TZ, en)).toBe('1d 00:00:01');
    expect(formatAgo(NOW - 300, NOW, en)).toBe('5 minutes ago');
  });
});

describe('language', () => {
  it('follows the browser: Indonesian for id (and the old "in" code), English otherwise', () => {
    expect(localeFromUiLanguage('id')).toBe('id');
    expect(localeFromUiLanguage('id-ID')).toBe('id');
    expect(localeFromUiLanguage('in')).toBe('id');
    expect(localeFromUiLanguage('en-US')).toBe('en');
    expect(localeFromUiLanguage('ja')).toBe('en');
    expect(localeFromUiLanguage(undefined)).toBe('en');
  });

  it('lets a stored choice win over the browser', () => {
    expect(resolveLocale('en', 'id')).toBe('en');
    expect(resolveLocale(null, 'id')).toBe('id');
    expect(messagesFor('en').popup.title).toBe('Today');
  });

  it('has the same keys in both dictionaries', () => {
    const keys = (o: object, prefix = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
    expect(keys(en).sort()).toEqual(keys(id).sort());
  });
});

describe('preferences', () => {
  it('defaults to following the browser and the "Sisa waktu dan jam" format', async () => {
    expect(await readPrefs(memoryStore())).toEqual(DEFAULT_PREFS);
  });

  it('stores a choice and ignores unreadable values', async () => {
    const store = memoryStore();
    await writePrefs(store, { dueFormat: 'countdown' });
    expect(await readPrefs(store)).toEqual({ ...DEFAULT_PREFS, dueFormat: 'countdown' });
    expect(await readPrefs(memoryStore({ [PREFS_KEY]: { locale: 'fr', dueFormat: 42 } }))).toEqual(DEFAULT_PREFS);
  });
});

describe('Google Calendar link', () => {
  it('builds a template link ending at the due time, without any request', () => {
    const url = new URL(googleCalendarUrl({ title: 'Kuis pekan 6 (Kalkulus II)', dueAt: at(2026, 11, 14, 23, 59), details: 'Tugas Kalkulus II di SIKOLA.\nhttps://x' }));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Kuis pekan 6 (Kalkulus II)');
    expect(url.searchParams.get('dates')).toBe('20261114T152900Z/20261114T155900Z');
    expect(url.searchParams.get('details')).toContain('https://x');
  });
});
