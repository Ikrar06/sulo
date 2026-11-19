// The fixture sanitizers' edges (core sanitize/json.ts, html.ts, leaks):
// every branch that decides whether something personal survives.
// Personal-looking values are invented and built at runtime so the
// repository leak scan does not flag this file.
import { describe, expect, it } from 'vitest';
import { sanitizeAttendanceHtml, signedInNames, SYNTHETIC_ACCOUNT_MARKER } from '@sulo/core/sanitize/html';
import { sanitizeJson } from '@sulo/core/sanitize/json';
import { leakReport } from '@sulo/core/sanitize/leaks';
import { findLeaks, plausibleNik, plausibleNip, ruleApplies, LEAK_RULES } from '@sulo/core/sanitize/leak-rules.mjs';

const ORIGIN = 'https://sikola-v2.unhas.ac.id';
const run = (value: unknown) => sanitizeJson(value, { timeShiftSeconds: 100, origin: ORIGIN }) as never;
const NIM = ['D', '12121', '1001'].join('');
const NIK = ['7371', '0512', '0399', '0001'].join('');
const NIP = ['1985', '0412', '2010', '12', '1', '003'].join('');
const EMAIL = ['budi.santoso', '@', 'student.unhas.ac.id'].join('');
const SESSKEY = ['aB3', 'xY9', 'qW2', 'z'].join('');

describe('sanitizeJson edges', () => {
  it('grades are replaced whether whole or fractional, numbers or numeric strings', () => {
    const out = run({ grade: 87.5, rawgrade: 92, finalgrade: '78.25', gradeformatted: '80,50' }) as Record<string, unknown>;
    expect(out.grade).not.toBe(87.5);
    expect(out.rawgrade).not.toBe(92);
    expect(out.finalgrade).not.toBe('78.25');
    expect(out.gradeformatted).not.toBe('80,50');
    // Same input, same output (fixtures stay stable).
    expect(run({ grade: 87.5 })).toEqual({ grade: out.grade });
  });

  it('top-level values and keys without a rule', () => {
    expect(run('Catatan bebas Budi')).toBe('Teks 1');
    expect(run(42)).toBe(42);
    expect(run(null)).toBeNull();
    expect(run(true)).toBe(true);
    expect(run({ ratio: 0.5, count: 3, empty: '' })).toEqual({ ratio: 0.5, count: 3, empty: '' });
  });

  it('ids: zero and negative stay, lists remap only positive ids, other values pass', () => {
    expect(run({ userid: 0, courseid: -1 })).toEqual({ userid: 0, courseid: -1 });
    expect(run({ section: [{ id: 5, cmlist: [0, 'x', 1.5, 9, '9'] }] })).toEqual({ section: [{ id: 101, cmlist: [0, 'x', 1.5, 101, '101'] }] });
    expect(run({ thing: { id: 77 } })).toEqual({ thing: { id: 101 } });
    expect(run({ id: 77 })).toEqual({ id: 101 });
  });

  it('course fields: names by letter past Z, other course fields walked as usual', () => {
    const courses = Array.from({ length: 28 }, (_, i) => ({ id: 1000 + i, fullname: `Kuliah ${i}`, shortname: `K-${i}`, visible: 1, summary: '<p>Ringkasan</p>', startdate: 10 }));
    const out = run({ courses }) as { courses: { fullname: string; shortname: string; summary: string; startdate: number }[] };
    expect(out.courses[25]!.fullname).toBe('Mata Kuliah Z');
    expect(out.courses[26]!.fullname).toBe('Mata Kuliah AA');
    expect(out.courses[27]!.shortname).toBe('MKAB-028');
    expect(out.courses[0]!.summary).toMatch(/^<p>Lorem/);
    expect(out.courses[0]!.startdate).toBe(110);
    expect(run({ course: { fullname: 7 } })).toEqual({ course: { fullname: 7 } });
  });

  it('URLs: broken, other hosts, files, and every id parameter', () => {
    expect(run({ u: 'https://[broken' })).toEqual({ u: 'https://example.test/link' });
    expect(run({ u: `${ORIGIN}/user/pix.php/5/f1.jpg` })).toEqual({ u: 'https://example.test/file' });
    const out = run({
      a: `${ORIGIN}/course/view.php?id=4321`,
      b: `${ORIGIN}/user/profile.php?id=99`,
      c: `${ORIGIN}/grade/report.php?id=4321`,
      d: `${ORIGIN}/calendar/view.php?course=4321&event=8&view=day`,
      e: `${ORIGIN}/x.php?token=${SESSKEY}&key=${SESSKEY}`,
    }) as Record<string, string>;
    expect(out.a).toBe(`${ORIGIN}/course/view.php?id=101`);
    expect(out.b).toBe(`${ORIGIN}/user/profile.php?id=1`);
    expect(out.c).toBe(`${ORIGIN}/grade/report.php`);
    expect(out.d).toBe(`${ORIGIN}/calendar/view.php?course=101&event=101`);
    expect(out.e).toBe(`${ORIGIN}/x.php?token=SESSKEY&key=SESSKEY`);
  });

  it('text that only looks like JSON is treated as text', () => {
    expect(run({ note: '{ bukan json Budi' })).toEqual({ note: 'Teks 1' });
    expect(run({ description: '' })).toEqual({ description: '' });
  });
});

describe('leak rules', () => {
  it('a string is scanned as it is; names only, never values', () => {
    expect(leakReport(`kontak ${EMAIL}`)).toEqual(['Alamat email Unhas']);
    expect(leakReport({ a: 'D000000001' })).toEqual([]);
  });
  it('NIK and NIP only when they could be real', () => {
    expect(plausibleNik(NIK)).toBe(true);
    expect(plausibleNik('0000000000000001')).toBe(false);
    expect(plausibleNip(NIP)).toBe(true);
    expect(plausibleNip('999999999999999999')).toBe(false);
    expect(findLeaks(`nik ${NIK} nip ${NIP} nim ${NIM}`)).toEqual(['Pola mirip NIM', 'Pola mirip NIK (16 digit)', 'Pola mirip NIP (18 digit)']);
  });
  it('NEOSIA field names count only in fixtures', () => {
    const rule = LEAK_RULES.find((r) => r.onlyFixtures)!;
    expect(ruleApplies(rule, 'fixtures/neosia/x.json')).toBe(true);
    expect(ruleApplies(rule, 'apps/extension/fixtures/x.json')).toBe(true);
    expect(ruleApplies(rule, 'packages/core/src/neosia/allowlist.ts')).toBe(false);
    expect(findLeaks('{"nik": 1, "alamat": 2}', 'packages/core/src/x.ts')).toEqual([]);
    expect(findLeaks('{"nik": 1, "alamat": 2}')).toEqual(['Field sensitif NEOSIA di fixture', 'Field sensitif NEOSIA di fixture']);
  });
});

describe('sanitizeAttendanceHtml', () => {
  const navbar = (name: string) =>
    `<nav><span class="usertext mr-1">${name}</span><span class="userinitials size-35" title="${name}">BS</span>` +
    `<img src="${ORIGIN}/pluginfile.php/1/user/icon/f2" class="userpicture" alt="Picture of ${name}">` +
    `<a href="${ORIGIN}/user/profile.php?id=4242">${name}</a><div class="popover-region" data-userid="4242"></div></nav>`;
  const page = (name: string) =>
    `<!doctype html><html><head><title>Presensi</title><script>var s = "${SESSKEY}";</script></head><body>${navbar(name)}` +
    `<div id="page"><div role="main" id="region-main"><h2>Presensi ${name}</h2>` +
    `<script>M.cfg = {"sesskey":"${SESSKEY}"};</script><style>.x{}</style><!-- ${EMAIL} -->` +
    `<p>${EMAIL} ${NIM} ${NIK} ${NIP}</p>` +
    `<a href="${ORIGIN}/user/view.php?id=4242&amp;course=9">profil</a> <a href="${ORIGIN}/mod/attendance/view.php?id=8&amp;studentid=4242">rinci</a>` +
    `<span data-userid="4242"></span><a href="${ORIGIN}/x.php?sesskey=${SESSKEY}">x</a>` +
    `<input type="hidden" name="sesskey" value="${SESSKEY}">{"sesskey": "${SESSKEY}"}` +
    `<table><tr><td class="cell remarks">Terlambat karena ${name}</td><td class="remarks"> </td></tr></table>` +
    `<a href="${ORIGIN}/course/view.php?id=9">Hidrologi Terapan</a><a href="${ORIGIN}/course/view.php?id=9">Hidrologi Terapan</a><a href="${ORIGIN}/course/view.php?id=10">Statistika</a>` +
    `</div></div><footer id="page-footer">Masuk sebagai <a href="${ORIGIN}/user/profile.php?id=4242">${name}</a></footer></body></html>`;

  it('reads the signed-in name from every place Moodle shows it', () => {
    expect(signedInNames(navbar('Budi Santoso'))).toEqual(['Budi Santoso']);
    expect(signedInNames(`<img alt="Gambar Andi Wijaya" class="userpicture">`)).toEqual(['Andi Wijaya']);
    expect(signedInNames(`logged in as <a href="#">Rani Putri</a>`)).toEqual(['Rani Putri']);
    expect(signedInNames(`<span class="usertext">Al</span><span class="usertext">12345</span>`)).toEqual([]);
  });

  it('keeps the main region and replaces every personal detail', () => {
    const { html, report } = sanitizeAttendanceHtml(page('Budi Santoso'));
    // The output's own header comment aside, the body has no comment left.
    expect(html.slice(html.indexOf('<body>'))).not.toContain('<!--');
    for (const secret of ['Budi', 'Santoso', EMAIL, NIM, NIK, NIP, SESSKEY, '4242', 'Hidrologi', 'Statistika', 'Terlambat', '<script', '<style', 'usertext', 'userpicture']) expect(html).not.toContain(secret);
    expect(html).toContain('Mahasiswa Sintetis');
    expect(html).toContain('mahasiswa@example.invalid');
    expect(html).toContain('D000000001');
    expect(html).toContain('Catatan sintetis');
    expect(html).toContain('Mata Kuliah Sintetis 1');
    expect(html).toContain('Mata Kuliah Sintetis 2');
    expect(html.match(/Mata Kuliah Sintetis 1/g)).toHaveLength(2);
    expect(html).toContain(SYNTHETIC_ACCOUNT_MARKER.trim());
    expect(report).toMatchObject({ keptRegion: true, emails: 1, studentNumbers: 1, nationalIds: 2, sesskeys: 3, remarks: 2, courseNames: 3 });
    expect(signedInNames(page('Budi Santoso'))).toContain('Budi Santoso');
    // A profile link inside the main region keeps its (replaced) path: the report flags it for review.
    expect(report.personMarkersLeft).toBe(1);
    expect(html).toContain('/user/view.php?id=1');
    expect(report.userIds).toBeGreaterThanOrEqual(3);
    expect(report.removedScripts).toBe(2);
    expect(leakReport(html)).toEqual([]);
  });

  it('a page without a main region drops only the head, and no marker without an account', () => {
    const { html, report } = sanitizeAttendanceHtml(`<html><head><script>x</script></head><body><p>${EMAIL}</p></body></html>`);
    expect(report.keptRegion).toBe(false);
    expect(report.namesDetected).toBe(0);
    expect(html).not.toContain(EMAIL);
    expect(html).not.toContain('data-userid');
  });

  it('a main region running to the end of the page (no footer)', () => {
    const { html } = sanitizeAttendanceHtml(`<div id="region-main"><p>Isi ${NIM}</p></div>`);
    expect(html).toContain('<p>Isi D000000001</p>');
  });
});
