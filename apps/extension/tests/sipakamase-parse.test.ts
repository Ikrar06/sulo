import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildTree, firstLine, textOf } from '@sulo/core/html/tree';
import { parseClaim, parseConversions, parseCourses, parseHistory, parseRunning, readNumber } from '@sulo/core/sipakamase/parse';

const fx = (name: string) => readFileSync(new URL(`../fixtures/synthetic/sipakamase/${name}.html`, import.meta.url), 'utf8');

describe('html tree', () => {
  it('closes cells, rows and list items the way a browser does', () => {
    const root = buildTree('<table><tr><td>a<td>b<br><small>c</small><tr><td>d</table><ul><li>x<li>y</ul>');
    expect(textOf(root)).toBe('a b c d x y');
    const tds = root.children[0];
    expect(typeof tds).not.toBe('string');
  });

  it('reads a cell up to its first line break and decodes entities', () => {
    const td = buildTree('<td>Terlaksana&nbsp;<br> <small>catatan</small></td>').children[0] as never;
    expect(firstLine(td)).toBe('Terlaksana');
    expect(textOf(buildTree('<p>A &amp; B &#39;C&#39;</p>'))).toBe("A & B 'C'");
  });

  it('drops scripts and styles', () => {
    expect(textOf(buildTree('<div>a<script>var x = "<td>";</script><style>.a{}</style>b</div>'))).toBe('a b');
  });
});

describe('Sipakamase readers', () => {
  it('reads the activities in progress: status, companion and score as yes or no', () => {
    const r = parseRunning(fx('kegiatan'));
    expect(r).toEqual({
      ok: true,
      data: [
        { semester: 'Awal 2026/2027', basis: 'kompetisi', kind: 'Lomba Mandiri', name: 'Lomba Esai Lingkungan Kampus', status: 'done', statusText: 'Terlaksana', hasCompanion: false, hasScore: false },
        { semester: 'Awal 2026/2027', basis: 'keorganisasian', kind: 'Kepengurusan', name: 'Pengurus Himpunan Mahasiswa Sintetis', status: 'planned', statusText: 'Terencana', hasCompanion: true, hasScore: false },
      ],
    });
  });

  it('reads the history without the score itself', () => {
    const r = parseHistory(fx('riwayat'));
    expect(r.ok && r.data.map((a) => [a.name, a.status, a.hasScore, a.hasCompanion])).toEqual([
      ['Seminar Nasional Teknologi Sintetis', 'finished', true, null],
      ['Panitia Pekan Olahraga Sintetis', 'finished', false, null],
    ]);
    expect(JSON.stringify(r)).not.toContain('88.50');
  });

  it('reads the claim page: passed courses with their NEOSIA state, and the KRS, never a grade', () => {
    const r = parseClaim(fx('klaim'));
    expect(r).toEqual({
      ok: true,
      data: {
        passed: [
          { code: '23U02130202', name: 'Manajemen Kegiatan', sks: 2, inNeosia: true },
          { code: '23U02131102', name: 'Kepemimpinan Inovatif', sks: 2, inNeosia: false },
        ],
        programmed: [
          { code: '23D12130902', kind: 'reguler' },
          { code: '23U02132304', kind: 'mkpk' },
        ],
      },
    });
    expect(JSON.stringify(r)).not.toMatch(/90\.00|84\.25/);
  });

  it('reads the courses passed and not yet passed with the credits collected, never the grade', () => {
    const r = parseCourses(fx('matakuliah'));
    expect(r).toEqual({
      ok: true,
      data: {
        passed: [
          { name: 'Manajemen Kegiatan', sks: 2, collected: 2 },
          { name: 'Kepemimpinan Inovatif', sks: 2, collected: 2 },
        ],
        notPassed: [{ name: 'Pengambilan Keputusan', sks: 2, collected: 1.25 }],
      },
    });
  });

  it('reads each activity\'s converted and unconverted credits', () => {
    expect(parseConversions(fx('rekappoin'))).toEqual({
      ok: true,
      data: [
        { name: 'Lomba Esai Lingkungan Kampus', sksTotal: 0.58, sksUnconverted: 0.58 },
        { name: 'Panitia Pekan Olahraga Sintetis', sksTotal: 3.2, sksUnconverted: 0.92 },
      ],
    });
  });

  it('never returns an address from a page', () => {
    for (const r of [parseRunning(fx('kegiatan')), parseHistory(fx('riwayat')), parseClaim(fx('klaim')), parseCourses(fx('matakuliah')), parseConversions(fx('rekappoin'))]) {
      expect(JSON.stringify(r)).not.toMatch(/hx-get|\/caktifitas|\/ckonversimhs|delete|sksmk|http/);
    }
  });

  it('fails whole when the headings changed, and tells a login page apart', () => {
    expect(parseRunning(fx('kegiatan').replace('<th>Status</th>', '<th>Keadaan</th>'))).toEqual({ ok: false, reason: 'shape' });
    expect(parseHistory('<div>Sesi habis</div><form><input name="u"><input type="password" name="p"></form>')).toEqual({ ok: false, reason: 'login' });
    expect(parseClaim('<div>Halaman lain</div>')).toEqual({ ok: false, reason: 'shape' });
    expect(parseConversions('<p>apa saja</p>')).toEqual({ ok: false, reason: 'shape' });
    expect(parseCourses(fx('matakuliah').replace('(2) <span class="float-end"><span class="badge bg-primary">2.00', '(2) <span class="float-end"><span class="badge bg-primary">dua'))).toEqual({ ok: false, reason: 'shape' });
  });

  it('accepts empty lists', () => {
    expect(parseRunning('<table><tbody><tr><th>Aksi</th><th>#</th><th>Semester</th><th>Basis</th><th>Kegiatan</th><th>Nama Kegiatan</th><th>Pendamping Kegiatan</th><th>Nilai</th><th>Status</th></tr></tbody></table>')).toEqual({ ok: true, data: [] });
    expect(parseConversions('<ul><li>Matakuliah MKPK yang direkognisi</li></ul>')).toEqual({ ok: true, data: [] });
  });

  it('keeps an unknown status as written, with the code unknown', () => {
    const r = parseRunning(fx('kegiatan').replace('Terencana<br>', 'Menunggu Verifikasi<br>'));
    expect(r.ok && r.data[1]).toMatchObject({ status: 'unknown', statusText: 'Menunggu Verifikasi' });
  });

  it('reads numbers with a dot or a comma', () => {
    expect(readNumber('0,58')).toBe(0.58);
    expect(readNumber(' 3.20 ')).toBe(3.2);
    expect(readNumber('-')).toBeNull();
  });
});
