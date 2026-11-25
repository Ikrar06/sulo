import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tokenizeHtml } from '@sulo/core/sanitize/html-tokens';
import { findLeaks } from '@sulo/core/sanitize/leak-rules.mjs';
import { summarizeHar } from '@sulo/core/sanitize/sipakamase-har';
import { SipakamaseSanitizer, SYNTHETIC } from '@sulo/core/sanitize/sipakamase';
import { outputName, runSipakamase } from '../scripts/sanitize-sipakamase';

// Invented people and identifiers, assembled at runtime so the repository
// leak scan does not flag this file. The pages below are written by hand
// from the owner's description of Sipakamase, never from a real page.
const NAME = 'Zulkifli Tandiabang';
const LECTURER = 'Dr. Marwah Lolobua, S.Kom., M.T.';
const NIM = ['H', '0712', '31', '009'].join('');
const NIP = ['1985', '0612', '2010', '12', '1', '003'].join('');
const EMAIL = ['zul.tandi', '@', 'student.unhas.ac.id'].join('');
const PHONE = ['0812', '3456', '7890'].join('');
const ACTIVITY = 'Seminar Nasional Kewirausahaan Digital';
const SECRET = ['f3a9', 'c1d7', 'e2b8', '4a6f'].join('');
const PRIVATE = [NAME, 'Zulkifli', 'Tandiabang', 'Marwah', 'Lolobua', NIM, NIP, EMAIL, PHONE, ACTIVITY, SECRET];

const HOME = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="csrf-token" content="${SECRET}">
<title>Home | Sipakamase</title>
<link rel="stylesheet" href="/assets/css/bootstrap.min.css?v=${SECRET}">
<!-- dibuat untuk ${NAME} -->
</head><body class="hold-transition sidebar-mini">
<nav class="main-header navbar"><ul class="navbar-nav">
<li class="nav-item"><a class="nav-link" href="/caktifitasmahasiswa">Kegiatan Mahasiswa</a></li>
<li class="nav-item"><a class="nav-link" href="/caktifitas">Riwayat Kegiatan</a></li>
<li class="nav-item dropdown"><a class="nav-link" href="#">${NAME}</a></li>
</ul></nav>
<h4>Selamat Datang, ${NAME}</h4>
<img class="foto" src="/foto/${NIM}.jpg" alt="Foto ${NAME}">
<img class="avatar" src="data:image/png;base64,iVBORw0KGgo${SECRET}">
<table class="table table-sm" id="data-diri">
<tr><td>NIM</td><td>:</td><td>${NIM}</td></tr>
<tr><td>Nama</td><td>:</td><td>${NAME}</td></tr>
<tr><td>Program Studi</td><td>:</td><td>Sistem Informasi</td></tr>
<tr><td>Email</td><td>:</td><td>${EMAIL}</td></tr>
<tr><td>Nomor HP</td><td>:</td><td>${PHONE}</td></tr>
<tr><td>Verifikator</td><td>:</td><td>${LECTURER} (${NIP})</td></tr>
</table>
<div class="alert alert-info"><p>Kegiatan yang telah selesai wajib diajukan paling lambat 14 hari setelah kegiatan berakhir.</p></div>
<form action="/home/simpan" method="post">
<input type="hidden" name="_token" value="${SECRET}">
<label for="hp">Nomor HP</label><input type="text" id="hp" name="hp" value="${PHONE}" placeholder="Nomor HP aktif">
<select name="pendamping"><option value="">Pilih</option><option value="812">${LECTURER}</option></select>
<input type="submit" class="btn btn-primary" value="Simpan">
</form>
<script>
  var pengguna = { nama: "${NAME}", nim: '${NIM}', sks: 14 };
  $(function () {
    $.ajax({ url: '/caktifitasmahasiswa/content', type: 'POST', data: { id: 48213 }, success: function (res) { $('#isi').html(res); } });
    if (/["']/.test(pengguna.nama)) alert("Apakah anda yakin ingin menghapus kegiatan ini?");
    // catatan ${NAME}
  });
</script>
</body></html>`;

const ACTIVITIES = `<div class="card"><div class="card-header"><h3 class="card-title">Kegiatan Mahasiswa</h3>
<button type="button" class="btn btn-success" onclick="tambah(&quot;${NIM}&quot;)">+RKL</button>
<a class="btn btn-info" href="/caktifitasmahasiswa/terencana?nim=${NIM}&amp;sem=20241">+Terencana</a></div>
<table id="tabel" class="table table-bordered"><thead><tr>
<th>Semester</th><th>Basis</th><th>Kegiatan</th><th>Nama Kegiatan</th><th>Pendamping Kegiatan</th><th>Nilai</th><th>Status</th><th>Aksi</th>
</tr></thead><tbody>
<tr data-id="48213"><td>Ganjil 2024/2025</td><td>Kepesertaan</td><td>Seminar</td><td>${ACTIVITY}</td><td>${LECTURER}</td><td>A-</td>
<td><span class="badge badge-success">Terlaksana</span></td><td><a class="btn btn-xs btn-danger" href="/caktifitasmahasiswa/hapus/48213">Hapus</a></td></tr>
<tr data-id="48214"><td>20242</td><td>Kompetisi</td><td>Lomba Mandiri</td><td>Lomba Esai Tingkat Wilayah</td><td>${LECTURER}</td><td>87.50</td>
<td>Diajukan</td><td></td></tr>
</tbody></table></div>`;

const CONVERSION = `<div class="card"><h5 class="card-title">${ACTIVITY}</h5>
<p>SKS yang belum dikonversi: 2 dari 4</p>
<table class="table"><thead><tr><th>Kode</th><th>Nama MK</th><th>SKS</th><th>Nilai</th><th>Jenis MK</th></tr></thead><tbody>
<tr><td>23U02130102</td><td>Komunikasi dan Kerjasama</td><td>2</td><td>A</td><td>MKPK/MBKM</td></tr>
<tr><td>23D07141203</td><td>Analisis Proses Bisnis</td><td>3</td><td>B+</td><td>Reguler</td></tr>
</tbody></table></div>`;

const sanitizer = (salt = 'garam-uji') => new SipakamaseSanitizer({ salt });
/** Runs the pages through both passes, as the command does. */
function run(pages: string[], salt?: string): string[] {
  const s = sanitizer(salt);
  return pages.map((p) => s.html(p)).map((p) => s.finish(p));
}

describe('personal data', () => {
  const outputs = run([HOME, ACTIVITIES, CONVERSION]);
  const all = outputs.join('\n');

  it('leaves no name, identifier, activity name or secret anywhere', () => {
    for (const value of PRIVATE) expect(all.toLowerCase()).not.toContain(value.toLowerCase());
    expect(all).not.toContain('Sistem Informasi');
    expect(all).not.toContain('Analisis Proses Bisnis');
  });

  it('passes the leak scan under the fixture folder and the run check', () => {
    const s = sanitizer();
    const done = [HOME, ACTIVITIES, CONVERSION].map((p) => s.html(p)).map((p) => s.finish(p));
    for (const text of done) {
      expect(findLeaks(text, 'fixtures/sipakamase/home.html')).toEqual([]);
      expect(s.leftovers(text)).toBe(0);
    }
  });

  it('never keeps a grade', () => {
    const table = outputs[2]!;
    expect(table).toMatch(/<td>B<\/td><td>MKPK\/MBKM<\/td>/);
    expect(table).not.toContain('B+');
    expect(outputs[1]).not.toContain('87.50');
    expect(outputs[1]).not.toContain('A-');
  });

  it('masks a name that only running text and a script hold', () => {
    const [out] = run([`<h2>Halo ${NAME}</h2><script>var x = cetak(${JSON.stringify(NAME)}); /* ${NAME} */ var Tandiabang = 1;</script>`]);
    expect(out).not.toMatch(/zulkifli|tandiabang/i);
    expect(out).toContain('<h2>xxx xxx xxx</h2>');
  });
});

describe('values outside tables', () => {
  it('replaces what follows a data label, and keeps wording that follows any other label', () => {
    const [out] = run([`<p>Deskripsi: Menjadi ketua panitia seminar nasional tingkat universitas</p><p><b>Tempat</b>: Aula fakultas</p><p>Status: Terlaksana</p><p>Kegiatan: Seminar</p><p>SKS yang belum dikonversi: 2 dari 4</p><small>Diajukan pukul 14:22</small>`]);
    expect(out).toMatch(/<p>Deskripsi: Teks sintetis \d+<\/p>/);
    expect(out).toMatch(/<p><b>Tempat<\/b>: Teks sintetis \d+<\/p>/);
    expect(out).toContain('<p>Status: Terlaksana</p>');
    expect(out).toContain('<p>Kegiatan: Seminar</p>');
    expect(out).toMatch(/<p>SKS yang belum dikonversi: \d dari \d<\/p>/);
    expect(out).not.toContain('panitia');
    expect(out).toMatch(/<small>Diajukan pukul \d\d:\d\d<\/small>/);
  });

  it('masks a name written as one word in a link, once the name is known from anywhere', () => {
    const [out] = run([`<h3 class="profile-username">${NAME.toUpperCase()}</h3><a class="btn" href="/profil/zulkiflitandiabang">Profil</a><img src="/img/zulkifli2023.png"><script>var u = Zulkifli_Tandiabang;</script>`]);
    expect(out).not.toMatch(/zulkifli|tandiabang/i);
    expect(out).toContain('>Profil</a>');
  });

  it('reads numeric character references before judging the text', () => {
    const spelled = [...NAME].map((c) => `&#${c.codePointAt(0)};`).join('');
    const [out] = run([`<p>Halo ${spelled}</p><td>&#84;erlaksana</td><i title="${spelled}"></i>`]);
    expect(out).not.toContain('&#90;');
    expect(out).toContain('<td>Terlaksana</td>');
    expect(out).toContain('<p>xxx xxx xxx</p>');
    expect(out).toContain('title="xxx xxx"');
  });

  it('replaces small numbers in data attributes too', () => {
    const outs = new Set(['a', 'b', 'c', 'd'].map((salt) => run(['<tr data-sks="2" data-status="Terlaksana" data-id="77"></tr>'], salt)[0]));
    for (const out of outs) {
      expect(out).toMatch(/data-sks="[1-9]" data-status="Terlaksana" data-id="[1-9]\d"/);
      expect(out).not.toContain('data-sks="2"');
    }
  });
});

describe('what stays', () => {
  const [home, activities, conversion] = run([HOME, ACTIVITIES, CONVERSION]) as [string, string, string];

  it('keeps tags, classes, ids and attribute names', () => {
    expect(home).toContain('<body class="hold-transition sidebar-mini">');
    expect(home).toContain('<table class="table table-sm" id="data-diri">');
    expect(home).toMatch(/<input type="hidden" name="_token" value="[x0-9]+">/);
    expect(home).toMatch(/<meta name="csrf-token" content="[x0-9]+">/);
    expect(tokenizeHtml(home).filter((t) => t.kind === 'open').length).toBe(tokenizeHtml(HOME).filter((t) => t.kind === 'open').length);
  });

  it('keeps the interface wording: title, menu, headings, column heads, buttons, labels', () => {
    expect(home).toContain('<title>Home | Sipakamase</title>');
    expect(home).toContain('<a class="nav-link" href="/caktifitasmahasiswa">Kegiatan Mahasiswa</a>');
    expect(home).toContain('<label for="hp">Nomor HP</label>');
    expect(home).toContain('value="Simpan"');
    expect(home).toContain('placeholder="Nomor HP aktif"');
    expect(activities).toContain('<th>Pendamping Kegiatan</th>');
    expect(activities).toContain('>+RKL</button>');
    expect(activities).toContain('>Hapus</a>');
  });

  it('keeps rule text word by word and replaces its numbers', () => {
    expect(home).toMatch(/<p>Kegiatan yang telah selesai wajib diajukan paling lambat \d\d hari setelah kegiatan berakhir\.<\/p>/);
    expect(home).not.toContain(' 14 hari');
    expect(conversion).toMatch(/<p>SKS yang belum dikonversi: \d dari \d<\/p>/);
  });

  it('keeps labels of a key-value layout and replaces the values', () => {
    expect(home).toContain(`<tr><td>NIM</td><td>:</td><td>${SYNTHETIC.nim}</td></tr>`);
    expect(home).toContain(`<tr><td>Email</td><td>:</td><td>${SYNTHETIC.email}</td></tr>`);
    expect(home).toContain(`<tr><td>Nomor HP</td><td>:</td><td>${SYNTHETIC.phone}</td></tr>`);
    expect(home).toMatch(/<tr><td>Program Studi<\/td><td>:<\/td><td>Teks sintetis \d+<\/td><\/tr>/);
  });

  it('keeps safe cell values: semester, basis, activity kind, status, MKPK course, course code', () => {
    expect(activities).toContain('<td>Ganjil 2024/2025</td><td>Kepesertaan</td><td>Seminar</td>');
    expect(activities).toContain('<td>20242</td><td>Kompetisi</td><td>Lomba Mandiri</td>');
    expect(activities).toContain('<span class="badge badge-success">Terlaksana</span>');
    expect(activities).toContain('<td>Diajukan</td>');
    expect(conversion).toContain('<td>23U02130102</td><td>Komunikasi dan Kerjasama</td>');
    expect(conversion).toMatch(/<td>23D07141203<\/td><td>Teks sintetis \d+<\/td>/);
  });

  it('gives the same value the same label on every page', () => {
    const inTable = /<td>Seminar<\/td><td>(Teks sintetis \d+)<\/td>/.exec(activities)?.[1];
    expect(inTable).toBeDefined();
    expect(conversion).toContain(`<h5 class="card-title">${inTable}</h5>`);
    expect(new Set(activities.match(/Teks sintetis \d+/g)).size).toBe(3);
  });
});

describe('links and scripts', () => {
  const [home, activities] = run([HOME, ACTIVITIES]) as [string, string];

  it('keeps routes, replaces ids and masks query values', () => {
    expect(activities).toMatch(/href="\/caktifitasmahasiswa\/hapus\/\d{5}"/);
    expect(activities).not.toContain('48213');
    expect(activities).toMatch(new RegExp(`href="/caktifitasmahasiswa/terencana\\?nim=${SYNTHETIC.nim}&amp;sem=\\d{5}"`));
    expect(home).toMatch(/href="\/assets\/css\/bootstrap\.min\.css\?v=[x0-9]+"/);
    expect(home).toContain('<form action="/home/simpan" method="post">');
  });

  it('drops the payload of an embedded image and the name of a photo file', () => {
    expect(home).toContain('src="data:image/png;base64,x"');
    expect(home).toContain(`src="/foto/${SYNTHETIC.nim}.jpg"`);
    expect(home).toContain('alt="xxx xxx xxx"');
  });

  it('keeps the shape of a script: calls, routes and dictionary words', () => {
    expect(home).toContain("$.ajax({ url: '/caktifitasmahasiswa/content', type: 'POST'");
    expect(home).toContain("$('#isi').html(res);");
    expect(run([`<script>$.post("<?= base_url('cklaim/content') ?>");</script>`])[0]).toContain("base_url('cklaim/content')");
    expect(home).toContain('alert("Apakah anda yakin ingin menghapus kegiatan ini?")');
    expect(home).toContain('if (/["\']/.test(pengguna.nama))');
    expect(home).toMatch(/var pengguna = \{ nama: "xxx xxx", nim: 'D000000001', sks: \d\d \};/);
    expect(home).toMatch(/data: \{ id: \d{5} \}/);
  });

  it('cleans an inline handler and drops comments', () => {
    expect(activities).toContain(`onclick="tambah(&quot;${SYNTHETIC.nim}&quot;)"`);
    expect(home).toContain('<!-- komentar dibuang -->');
  });
});

describe('numbers', () => {
  it('replaces a number with another of the same shape, the same way within a run', () => {
    const [a] = run(['<td>3.50</td><td>3.50</td><td>120</td>'], 'satu');
    const cells = [...a!.matchAll(/<td>([^<]+)<\/td>/g)].map((m) => m[1]!);
    expect(cells[0]).toMatch(/^\d\.\d\d$/);
    expect(cells[0]).toBe(cells[1]);
    expect(cells[0]).not.toBe('3.50');
    expect(cells[2]).toMatch(/^[1-9]\d\d$/);
  });

  it('depends on the salt, so a number cannot be worked back from the fixture', () => {
    const variants = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((salt) => run(['<td>48213</td>'], salt)[0]));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('turns long digit runs into zeros that the leak scan accepts', () => {
    const [out] = run([`<p>Nomor induk ${NIP} dan ${['7371', '0141', '0199', '0001'].join('')}</p>`]);
    expect(out).toMatch(/Nomor xxx 0{15}\d{3} dan 0{13}\d{3}/);
    expect(findLeaks(out!, 'fixtures/sipakamase/x.html')).toEqual([]);
  });
});

describe('odd markup', () => {
  it('does not throw and treats what it cannot read as text', () => {
    const [out] = run([`<div class="a" data-x='1 > 0'>2 < 3 <b>${NAME}<td>${NAME}<p unclosed`]);
    expect(out).not.toMatch(/zulkifli|tandiabang/i);
    expect(out).toContain('<div class="a"');
  });

  it('closes cells that the page leaves open', () => {
    const [out] = run([`<table><tr><td>${NAME}<td>Terlaksana<tr><th>Status<td>${NAME}</table><h3>Riwayat Kegiatan</h3>`]);
    expect(out).toContain('<td>Terlaksana');
    expect(out).toContain('<th>Status');
    expect(out).toContain('<h3>Riwayat Kegiatan</h3>');
    expect(out).not.toMatch(/zulkifli|tandiabang/i);
  });
});

describe('leak rules for saved pages', () => {
  it('flags any email and a mobile number, only under the Sipakamase fixture folder', () => {
    const mail = ['siapa', '@', 'gmail.com'].join('');
    expect(findLeaks(`x ${mail} y`, 'fixtures/sipakamase/a.html')).toContain('Alamat email di halaman tersimpan');
    expect(findLeaks(`hp ${PHONE}`, 'fixtures/sipakamase/a.html')).toContain('Pola mirip nomor HP');
    expect(findLeaks(`hp +62 812-3456-7890`, 'fixtures/sipakamase/a.html')).toContain('Pola mirip nomor HP');
    expect(findLeaks(`x ${mail} hp ${PHONE}`, 'fixtures/synthetic/a.json')).toEqual([]);
    expect(findLeaks(`x ${mail} hp ${PHONE}`)).toEqual([]);
  });

  it('lets the placeholders pass', () => {
    expect(findLeaks(`${SYNTHETIC.email} ${SYNTHETIC.phone} ${SYNTHETIC.nim}`, 'fixtures/sipakamase/a.html')).toEqual([]);
  });
});

describe('HAR summary', () => {
  const har = {
    log: {
      entries: [
        {
          startedDateTime: '2026-11-20T02:00:00.000Z',
          request: {
            method: 'GET',
            url: `https://sipakamase.unhas.ac.id/caktifitas/detail/48213?nim=${NIM}&token=${SECRET}`,
            headers: [{ name: 'Cookie', value: `ci_session=${SECRET}` }, { name: 'X-Requested-With', value: 'XMLHttpRequest' }],
            cookies: [{ name: 'ci_session', value: SECRET }],
            bodySize: 0,
          },
          response: {
            status: 200,
            headers: [{ name: 'Set-Cookie', value: `ci_session=${SECRET}; path=/` }, { name: 'Content-Type', value: 'text/html; charset=UTF-8' }],
            cookies: [{ name: 'ci_session', value: SECRET, expires: '2026-11-20T04:00:00.000Z', httpOnly: true, secure: false }],
            content: { size: 5120, mimeType: 'text/html; charset=UTF-8', text: `<td>${NAME}</td>` },
            redirectURL: '',
          },
        },
        {
          startedDateTime: '2026-11-20T02:00:01.500Z',
          request: { method: 'POST', url: 'https://sipakamase.unhas.ac.id/cklaim/content', headers: [], postData: { mimeType: 'application/x-www-form-urlencoded', text: `nim=${NIM}&kode=23U02130102` }, bodySize: 31 },
          response: { status: 302, headers: [], content: { size: 0, mimeType: '' }, redirectURL: `https://sipakamase.unhas.ac.id/login?next=${SECRET}` },
        },
      ],
    },
  };

  it('keeps the shape of each request and no value', () => {
    const s = sanitizer();
    const summary = summarizeHar(har, s);
    const text = s.finish(JSON.stringify(summary));
    for (const value of PRIVATE) expect(text.toLowerCase()).not.toContain(value.toLowerCase());
    expect(text).not.toContain('XMLHttpRequest');
    const [first, second] = summary.requests;
    expect(first).toMatchObject({ order: 1, sinceStartMs: 0, method: 'GET', host: 'sipakamase.unhas.ac.id', queryNames: ['nim', 'token'], status: 200, contentType: 'text/html', responseBytes: 5120 });
    expect(first!.path).toMatch(/^\/caktifitas\/detail\/\d{5}$/);
    expect(first!.requestHeaderNames).toEqual(['cookie', 'x-requested-with']);
    expect(first!.responseHeaderNames).toEqual(['content-type', 'set-cookie']);
    expect(first).not.toHaveProperty('cookiesSet');
    expect(second).toMatchObject({ sinceStartMs: 1500, method: 'POST', path: '/cklaim/content', status: 302, redirectsTo: 'sipakamase.unhas.ac.id/login' });
    expect(second).not.toHaveProperty('postedFieldNames');
  });

  it('adds field and cookie names, flags and lifetimes only when asked', () => {
    const summary = summarizeHar(har, sanitizer(), true);
    expect(summary.requests[0]!.cookiesSent).toEqual(['ci_session']);
    expect(summary.requests[0]!.cookiesSet).toEqual([{ name: 'ci_session', httpOnly: true, secure: false, sameSite: null, lifetimeSeconds: 7200 }]);
    expect(summary.requests[1]!.postedFieldNames).toEqual(['kode', 'nim']);
    expect(JSON.stringify(summary)).not.toContain(SECRET);
  });

  it('accepts a file that is not a HAR', () => {
    expect(summarizeHar({ apa: 'saja' }, sanitizer()).requests).toEqual([]);
    expect(summarizeHar(null, sanitizer()).requests).toEqual([]);
  });
});

describe('output names', () => {
  it('keeps known words of a file name and nothing else', () => {
    expect(outputName('/x/Kegiatan Mahasiswa.html', new Set())).toBe('kegiatan-mahasiswa.html');
    expect(outputName(`/x/Home - ${NAME} ${NIM}.htm`, new Set())).toBe('home-x.html');
    expect(outputName('/x/sipakamase.unhas.ac.id.har', new Set())).toBe('sipakamase-unhas-x-id.har.json');
    expect(outputName('/x/home.html', new Set(['home.html']))).toBe('home-2.html');
  });
});

describe('the command', () => {
  afterEach(() => vi.restoreAllMocks());

  function folders(files: Record<string, string>) {
    const root = mkdtempSync(join(tmpdir(), 'sulo-sipakamase-'));
    const paths = { input: join(root, 'raw'), output: join(root, 'out'), extraWords: join(root, 'kata-aman.txt') };
    mkdirSync(join(paths.input, 'Home_files'), { recursive: true });
    for (const [name, text] of Object.entries(files)) writeFileSync(join(paths.input, name), text);
    return paths;
  }

  it('writes sanitized copies, prints counts only and lists masked words beside the raw files', () => {
    const printed: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => void printed.push(line));
    vi.spyOn(console, 'error').mockImplementation((line: string) => void printed.push(line));
    const paths = folders({
      'Home.html': HOME,
      [`Kegiatan Mahasiswa - ${NAME}.html`]: ACTIVITIES,
      'rekaman.har': JSON.stringify({ log: { entries: [{ startedDateTime: '2026-11-20T02:00:00.000Z', request: { method: 'GET', url: `https://sipakamase.unhas.ac.id/home?nim=${NIM}`, headers: [] }, response: { status: 200, headers: [], content: { size: 10, mimeType: 'text/html' } } }] } }),
      'Home_files/jquery.min.js': `var rahasia = "${NAME}";`,
      'catatan.txt': NAME,
    });

    expect(runSipakamase([], paths)).toBe(0);
    expect(readdirSync(paths.output).sort()).toEqual(['home.html', 'kegiatan-mahasiswa-x.html', 'rekaman.har.json']);
    const written = readdirSync(paths.output).map((f) => readFileSync(join(paths.output, f), 'utf8')).join('\n');
    for (const value of PRIVATE) expect(written.toLowerCase()).not.toContain(value.toLowerCase());
    for (const value of PRIVATE) expect(printed.join('\n').toLowerCase()).not.toContain(value.toLowerCase());
    expect(printed.join('\n')).toContain('3 berkas (2 berkas lain dilewati)');
    expect(readFileSync(join(paths.input, '_kata-disamarkan.txt'), 'utf8')).toMatch(/^\d+\t\p{L}+$/mu);
  });

  it('keeps a word the owner has cleared', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const paths = folders({ 'home.html': '<p>Batas pengajuan mengikuti kalender akademik fakultas masing-masing.</p><h3>Rekapitulasi Capaian</h3>' });
    expect(runSipakamase([], paths)).toBe(0);
    expect(readFileSync(join(paths.output, 'home.html'), 'utf8')).toContain('Batas pengajuan mengikuti kalender akademik fakultas masing-masing.');
    const again = folders({ 'home.html': '<p>Halaman Gerbang</p>' });
    expect(runSipakamase([], again)).toBe(0);
    expect(readFileSync(join(again.output, 'home.html'), 'utf8')).toContain('xxx xxx');
    writeFileSync(again.extraWords, 'gerbang\n');
    expect(runSipakamase([], again)).toBe(0);
    expect(readFileSync(join(again.output, 'home.html'), 'utf8')).toContain('Halaman Gerbang');
  });

  it('writes nothing and says why when there is nothing to read', () => {
    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((line: string) => void errors.push(line));
    const paths = folders({ 'catatan.txt': 'x' });
    expect(runSipakamase([], paths)).toBe(1);
    expect(errors.join(' ')).toContain('Tidak ada berkas');
  });
});
