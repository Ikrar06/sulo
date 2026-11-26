import { describe, expect, it } from 'vitest';
import { sipakamaseWords } from '@sulo/core/i18n/sipakamase';
import { mkpkNotices, nextGradeDeadline, openKrsWindow, type MkpkNoticeInput } from '@sulo/core/mkpk/notices';
import { runMkpkNotices } from '@sulo/core/mkpk/notices-run';
import { SIPAKAMASE_MODULE_KEY } from '@sulo/core/sipakamase/module';
import { applyFragment, EMPTY_DATA, SIPAKAMASE_NEWS_KEY, statusChanges } from '@sulo/core/sipakamase/store';
import type { Kegiatan } from '@sulo/core/calendar/schema';
import { memoryStore } from './helpers';

const keg = (id: string, kategori: Kegiatan['kategori'], mulai: string, selesai: string | null) =>
  ({ id, semester: 'awal', kategori, judul: id, mulai, selesai, ujung_terbuka: false, perkiraan: false, audiens: 'mahasiswa', jenjang: ['S1'], status_verifikasi: 'terverifikasi', asal: 'ics', nilai_lain: [], rincian: [], catatan: '' }) as unknown as Kegiatan;
const CAL = [keg('2026-2027-awal-batas-akhir-penginputan-nilai-daring-semester', 'nilai', '2026-12-18', '2026-12-18'), keg('2026-2027-akhir-pengisian-krs-daring-semester-akhir', 'krs', '2027-01-03', '2027-02-12')];
const base = (extra: Partial<MkpkNoticeInput> = {}): MkpkNoticeInput => ({
  enabled: true,
  quiet: false,
  today: '2026-11-26',
  reminders: [{ kind: 'a', name: 'Kepemimpinan Inovatif' }, { kind: 'c', name: 'Pemecahan Masalah' }, { kind: 'b', name: 'X' }],
  news: [],
  kegiatan: CAL,
  sent: {},
  words: sipakamaseWords('id').notice,
  ...extra,
});

describe('MKPK notifications', () => {
  it('finds the grade deadline and the open KRS window in the calendar', () => {
    expect(nextGradeDeadline(CAL, '2026-11-26')).toBe('2026-12-18');
    expect(nextGradeDeadline(CAL, '2026-12-19')).toBeNull();
    expect(openKrsWindow(CAL, '2027-01-10')).toBe('2027-01-03');
    expect(openKrsWindow(CAL, '2026-12-20')).toBeNull();
  });

  it('notifies item a from 30 days before the deadline, once', () => {
    const r = mkpkNotices(base());
    expect(r.show.map((n) => n.body)).toEqual(['Kepemimpinan Inovatif belum lulus di Sipakamase. Batas penginputan nilai 22 hari lagi.']);
    expect(mkpkNotices(base({ sent: r.sent })).show).toEqual([]);
    expect(mkpkNotices(base({ today: '2026-11-17' })).show).toEqual([]);
  });

  it('notifies item c while the KRS window is open', () => {
    expect(mkpkNotices(base({ today: '2027-01-05' })).show.map((n) => n.body)).toEqual(['KRS dibuka. Pemecahan Masalah sudah lulus di Sipakamase dan bisa diprogramkan.']);
  });

  it('is silent when switched off or in quiet hours, and never more than three at once', () => {
    expect(mkpkNotices(base({ enabled: false })).show).toEqual([]);
    expect(mkpkNotices(base({ quiet: true })).show).toEqual([]);
    const news = Array.from({ length: 5 }, (_, i) => ({ name: `K${i}`, from: 'Terlaksana', to: 'Selesai', at: i }));
    const r = mkpkNotices(base({ news }));
    expect(r.show).toHaveLength(3);
    expect(r.newsShown).toBe(3);
  });
});

describe('Sipakamase news', () => {
  const a = (name: string, statusText: string) => ({ semester: 's', basis: 'kompetisi' as const, kind: 'k', name, status: 'done' as const, statusText, hasCompanion: true, hasScore: false });

  it('is silent on the first read, then reports a status change, also from running to history', () => {
    const first = applyFragment(EMPTY_DATA, { fragment: 'running', data: [a('Lomba Esai', 'Terlaksana')] }, 1);
    expect(statusChanges(EMPTY_DATA, first, 1)).toEqual([]);
    const moved = applyFragment(applyFragment(first, { fragment: 'running', data: [] }, 2), { fragment: 'history', data: [a('lomba esai', 'Selesai')] }, 2);
    expect(statusChanges(first, moved, 2)).toEqual([{ name: 'lomba esai', from: 'Terlaksana', to: 'Selesai', at: 2 }]);
  });

  it('a run shows queued news and empties the queue', async () => {
    const store = memoryStore({ [SIPAKAMASE_MODULE_KEY]: { enabled: true, changedAt: 1 }, [SIPAKAMASE_NEWS_KEY]: [{ name: 'Lomba Esai', from: 'Terlaksana', to: 'Selesai', at: 1 }] });
    const shown: string[] = [];
    // 10.00 in Makassar: outside the default quiet hours.
    const n = await runMkpkNotices({ store, now: 1_795_663_200, timeZone: 'Asia/Makassar', locale: 'id', show: async (id, _t, body) => void shown.push(`${id} ${body}`) });
    expect(n).toBe(1);
    expect(shown[0]).toMatch(/^mkpk\|news:1:Lomba Esai Kegiatanmu di Sipakamase berubah: Lomba Esai sekarang Selesai\.$/);
    expect(store.dump()[SIPAKAMASE_NEWS_KEY]).toEqual([]);
  });
});
