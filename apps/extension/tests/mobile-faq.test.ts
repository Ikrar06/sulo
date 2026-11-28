import { describe, expect, it } from 'vitest';
import { MOBILE_FAQ, MOBILE_FAQ_TOPICS, searchFaq } from '@sulo/core/help/mobile';

describe('mobile FAQ topics and search', () => {
  it('every entry is in exactly one topic, and every topic id exists', () => {
    const listed = MOBILE_FAQ_TOPICS.flatMap((t) => [...t.entries]);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(MOBILE_FAQ.map((e) => e.id).sort());
  });
  it('an empty query keeps every group in order', () => {
    expect(searchFaq('', 'id').map((g) => g.title)).toEqual(['Keamanan dan privasi', 'Pembaruan data', 'Pengingat', 'Mata kuliah dan tugas', 'Presensi', 'Jadwal dan nilai dari NEOSIA', 'MKPK dan Sipakamase', 'Tentang Sulo']);
    expect(searchFaq('  ', 'en')[0]?.title).toBe('Security and privacy');
  });
  it('matches every word in the question or answer, ignoring case', () => {
    const hits = searchFaq('PENGINGAT jam tenang', 'id');
    expect(hits.map((g) => g.id)).toEqual(['pengingat']);
    expect(searchFaq('keystore', 'en').flatMap((g) => g.entries.map((e) => e.id))).toContain('aman-hp');
  });
  it('no match gives no groups', () => {
    expect(searchFaq('zzzz tidak ada', 'id')).toEqual([]);
  });
});
