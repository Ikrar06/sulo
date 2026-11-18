import { describe, expect, it } from 'vitest';
import { FAQ, HOW_IT_WORKS } from '../lib/help/content';
import { CREATOR_LINKS, FEEDBACK_FORM_URL, isShownLink, TRAKTEER_URL } from '../lib/links';
import { bump, bumpUsage, exportUsage, readUsage, USAGE_COUNTERS, USAGE_KEY } from '../lib/stats/usage';
import { memoryStore } from './helpers';

describe('help content', () => {
  it('covers every required question, each in both languages', () => {
    expect(FAQ.map((f) => f.id)).toEqual([
      'aman',
      'password',
      'tugas-tidak-muncul',
      'tidak-diperbarui',
      'pengingat',
      'macos',
      'kabar-lama',
      'mata-kuliah-aktif',
      'akun-lain',
      'hapus-data',
      'resmi',
      'sikola-berubah',
      'langganan-kalender',
      'langganan-terlambat',
      'neosia',
      'tidak-disimpan',
    ]);
    for (const text of [...FAQ.flatMap((f) => [f.q, ...f.a]), ...HOW_IT_WORKS.flatMap((s) => [s.heading, ...s.paragraphs])]) {
      expect(text.id.trim()).not.toBe('');
      expect(text.en.trim()).not.toBe('');
    }
  });

  it('uses plain words: no technical terms from the glossary', () => {
    const all = [...FAQ.flatMap((f) => [f.q, ...f.a]), ...HOW_IT_WORKS.flatMap((s) => s.paragraphs)].map((t) => `${t.id} ${t.en}`).join(' ');
    expect(all).not.toMatch(/\bsesskey\b|\bsync\b|\bsinkron|\brequest\b|\bserver\b/i);
  });
});

describe('outside links', () => {
  it('Trakteer, the feedback form and the creator links are set', () => {
    expect(TRAKTEER_URL).toBe('https://teer.id/krar');
    expect(isShownLink(TRAKTEER_URL)).toBe(true);
    // The public short link, never an editor link (leak-rules blocks /edit).
    expect(FEEDBACK_FORM_URL).toBe('https://forms.gle/XsBuWXGHNR4pPTs17');
    expect(isShownLink(FEEDBACK_FORM_URL)).toBe(true);
    expect(isShownLink('')).toBe(false);
    expect(CREATOR_LINKS.map((l) => [l.id, l.url])).toEqual([
      ['instagram', 'https://www.instagram.com/krargmprr/'],
      ['linkedin', 'https://www.linkedin.com/in/ikrargempurtirani/'],
      ['github', 'https://github.com/Ikrar06'],
      ['web', 'https://ikrar.dev'],
    ]);
    expect(CREATOR_LINKS.every((l) => isShownLink(l.url))).toBe(true);
    expect(isShownLink('http://contoh.test')).toBe(false);
    expect(isShownLink('')).toBe(false);
  });
});

describe('local usage statistics', () => {
  it('starts at zero today, counts up, never down', async () => {
    const store = memoryStore();
    expect(await readUsage(store, '2026-11-16')).toEqual({ since: '2026-11-16', counters: Object.fromEntries(USAGE_COUNTERS.map((c) => [c, 0])) });
    await bumpUsage(store, '2026-11-16', 'popupOpens');
    await bumpUsage(store, '2026-11-17', 'popupOpens', 2);
    await bumpUsage(store, '2026-11-17', 'tasksMarkedDone', -3);
    const usage = await readUsage(store, '2026-11-18');
    expect(usage.since).toBe('2026-11-16');
    expect(usage.counters.popupOpens).toBe(3);
    expect(usage.counters.tasksMarkedDone).toBe(0);
  });

  it('bump is pure', () => {
    const before = { since: '2026-11-16', counters: Object.fromEntries(USAGE_COUNTERS.map((c) => [c, 0])) as Record<(typeof USAGE_COUNTERS)[number], number> };
    const after = bump(before, 'dashboardOpens');
    expect(before.counters.dashboardOpens).toBe(0);
    expect(after.counters.dashboardOpens).toBe(1);
  });

  it('a damaged record starts over instead of breaking', async () => {
    expect((await readUsage(memoryStore({ [USAGE_KEY]: { since: 'kemarin' } }), '2026-11-16')).since).toBe('2026-11-16');
  });

  it('the export holds numbers, the version and dates only', async () => {
    const store = memoryStore();
    await bumpUsage(store, '2026-11-16', 'remindersShown', 4);
    const file = JSON.parse(exportUsage(await readUsage(store, '2026-11-16'), '0.0.1', '2026-12-04'));
    expect(Object.keys(file).sort()).toEqual(['counters', 'exportedOn', 'since', 'sulo']);
    expect(file.counters.remindersShown).toBe(4);
  });
});
