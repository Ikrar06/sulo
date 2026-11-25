// `pnpm sanitize sipakamase [--rinci]`, run by the owner on their own machine.
// Reads the saved Sipakamase pages in fixtures/raw/sipakamase/ (.html, .htm
// and .har, in any subfolder) and writes sanitized copies to
// fixtures/sipakamase/. Nothing from the pages is printed: only counts.
// Nothing is written when a leak pattern, a replaced name or an identifier
// of the raw pages survives in any output.
//
// --rinci: the HAR summary also lists posted field names, cookie names and
//          how long each cookie the server sets lasts (never a value).
//
// Words the owner has cleared for running text (interface words, one per
// line) are read from fixtures/sipakamase-kata-aman.txt when it exists. The
// words masked in a run are listed in fixtures/raw/sipakamase/_kata-disamarkan.txt,
// which stays in the ignored folder because it may hold names.

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { findLeaks } from '../../../packages/core/src/sanitize/leak-rules.mjs';
import { summarizeHar } from '../../../packages/core/src/sanitize/sipakamase-har.ts';
import { COUNT_KEYS, SipakamaseSanitizer } from '../../../packages/core/src/sanitize/sipakamase.ts';
import { DICTIONARY } from '../../../packages/core/src/sanitize/sipakamase-kosakata.ts';

const ROOT = resolve(import.meta.dirname, '../../..');

export interface SipakamasePaths {
  input: string;
  output: string;
  extraWords: string;
}
const PATHS: SipakamasePaths = {
  input: join(ROOT, 'fixtures/raw/sipakamase'),
  output: join(ROOT, 'fixtures/sipakamase'),
  extraWords: join(ROOT, 'fixtures/sipakamase-kata-aman.txt'),
};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
}

/** An output name from the input's own name: known words stay, the rest becomes "x". */
export function outputName(file: string, taken: ReadonlySet<string>): string {
  const har = extname(file).toLowerCase() === '.har';
  const words = basename(file, extname(file)).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const safe = words.map((w) => (/^\d+$/.test(w) ? (w.length <= 3 ? w : 'n') : DICTIONARY.has(w) ? w : 'x'));
  const slug = safe.filter((w, i) => !(w === 'x' && safe[i - 1] === 'x')).join('-') || 'halaman';
  const ext = har ? '.har.json' : '.html';
  for (let n = 1; ; n++) {
    const name = `${slug}${n === 1 ? '' : `-${n}`}${ext}`;
    if (!taken.has(name)) return name;
  }
}

/** `paths` is for tests; the command always uses the repository's folders. */
export function runSipakamase(argv: string[], paths: SipakamasePaths = PATHS): number {
  const { input: INPUT, output: OUTPUT, extraWords: EXTRA_WORDS } = paths;
  const MASKED_LIST = join(INPUT, '_kata-disamarkan.txt');
  if (!existsSync(INPUT)) {
    console.error('Folder fixtures/raw/sipakamase/ belum ada.');
    return 1;
  }
  const all = walk(INPUT);
  const files = all.filter((f) => /\.(?:html?|har)$/i.test(f));
  if (files.length === 0) {
    console.error('Tidak ada berkas .html, .htm, atau .har di fixtures/raw/sipakamase/.');
    return 1;
  }
  const extraWords = existsSync(EXTRA_WORDS) ? readFileSync(EXTRA_WORDS, 'utf8').split(/\s+/).filter((w) => /^\p{L}[\p{L}\p{N}]*$/u.test(w)) : [];
  const sanitizer = new SipakamaseSanitizer({ salt: randomBytes(16).toString('hex'), extraWords });
  const detail = argv.includes('--rinci');

  // First pass: every file, so that what is replaced in one is known for all.
  const taken = new Set<string>();
  const drafts = files.map((file, i) => {
    const raw = readFileSync(file, 'utf8');
    const name = outputName(file, taken);
    taken.add(name);
    if (!/\.har$/i.test(file)) return { name, kind: 'halaman', text: sanitizer.html(raw), requests: 0, failed: false };
    try {
      const summary = summarizeHar(JSON.parse(raw), sanitizer, detail);
      return { name, kind: 'HAR', text: `${JSON.stringify(summary, null, 2)}\n`, requests: summary.requests.length, failed: false };
    } catch {
      console.error(`Berkas ke-${i + 1} (HAR) bukan JSON yang valid.`);
      return { name, kind: 'HAR', text: '', requests: 0, failed: true };
    }
  });
  if (drafts.some((d) => d.failed)) return 1;

  // Second pass, then the checks. Rule names and counts only, never a value.
  const outputs = drafts.map((d) => ({ ...d, text: sanitizer.finish(d.text) }));
  const problems = outputs.flatMap((o) => {
    const leaks = [...new Set(findLeaks(o.text, `fixtures/sipakamase/${o.name}`))];
    const left = sanitizer.leftovers(o.text);
    return leaks.length > 0 || left > 0 ? [`${o.name}: ${[...leaks, ...(left > 0 ? [`${left} nama atau pengenal dari berkas mentah masih ada`] : [])].join(', ')}`] : [];
  });
  if (problems.length > 0) {
    console.error(`Belum aman, tidak ada yang ditulis:\n${problems.map((p) => `  ${p}`).join('\n')}`);
    return 1;
  }

  mkdirSync(OUTPUT, { recursive: true });
  for (const o of outputs) writeFileSync(join(OUTPUT, o.name), o.text);
  const masked = sanitizer.maskedWords();
  writeFileSync(MASKED_LIST, `${masked.map(([word, count]) => `${count}\t${word}`).join('\n')}\n`);

  console.log(`Ditulis ke fixtures/sipakamase/: ${outputs.length} berkas (${all.length - files.length} berkas lain dilewati).`);
  for (const o of outputs) console.log(`  ${o.name}  ${o.kind}${o.kind === 'HAR' ? `, ${o.requests} permintaan` : ''}, ${o.text.length} karakter`);
  console.log(`Hitungan: ${COUNT_KEYS.map((k) => `${k} ${sanitizer.counts[k]}`).join(', ')}`);
  console.log(`Kata tambahan dari fixtures/sipakamase-kata-aman.txt: ${extraWords.length}. Kata berbeda yang disamarkan di teks halaman: ${masked.length} (daftarnya di fixtures/raw/sipakamase/_kata-disamarkan.txt, jangan dibagikan).`);
  const shapes = sanitizer.tokenShapes().slice(0, 8);
  if (shapes.length > 0) console.log(`Bentuk token id di tautan (panjang tiap bagian, lalu jumlahnya): ${shapes.map(([shape, n]) => `${shape} x${n}`).join(', ')}`);
  console.log('Pemeriksa kebocoran: bersih. Periksa hasilnya dengan mata sebelum dipakai.');
  return 0;
}
