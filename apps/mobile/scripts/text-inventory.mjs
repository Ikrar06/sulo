#!/usr/bin/env node
// Every text of the app's dictionaries (packages/core/src/i18n and the FAQ),
// Indonesian and English side by side with their lengths, as a tab-separated
// file for a wording review. A template is listed by its source (the
// function's own text). Also reports keys that exist in one language only.
// Usage: node scripts/text-inventory.mjs <out.tsv>
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadWords, withCore } from './lib/words.mjs';

const out = process.argv[2];
if (!out) throw new Error('out file missing');
const W = await loadWords();
const extra = await withCore(async (load) => {
  const help = await load('/help/index.ts').catch(() => null);
  return { help };
});

const flat = (v, path, into) => {
  if (typeof v === 'string') into.set(path, v);
  else if (typeof v === 'function') into.set(path, `ƒ ${String(v).replace(/\s+/g, ' ')}`);
  else if (Array.isArray(v)) v.forEach((x, i) => flat(x, `${path}[${i}]`, into));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) flat(x, path ? `${path}.${k}` : k, into);
  return into;
};
const rows = [];
const onlyOne = [];
for (const set of Object.keys(W.id)) {
  const id = flat(W.id[set], set, new Map());
  const en = flat(W.en[set], set, new Map());
  for (const key of new Set([...id.keys(), ...en.keys()])) {
    if (!id.has(key) || !en.has(key)) onlyOne.push(`${key}: hanya ${id.has(key) ? 'id' : 'en'}`);
    rows.push([key, id.get(key) ?? '', en.get(key) ?? '']);
  }
}
const clean = (s) => s.replace(/\t/g, ' ').replace(/\n/g, ' ⏎ ');
writeFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), out), ['kunci\tid\ten\tpanjang_id\tpanjang_en', ...rows.map(([k, a, b]) => `${k}\t${clean(a)}\t${clean(b)}\t${a.length}\t${b.length}`)].join('\n') + '\n');
console.log(`text-inventory: ${rows.length} teks per bahasa (${Object.keys(W.id).map((s) => `${s} ${rows.filter((r) => r[0].startsWith(`${s}.`)).length}`).join(', ')})`);
console.log(onlyOne.length > 0 ? `Kunci di satu bahasa saja (${onlyOne.length}):\n${onlyOne.join('\n')}` : 'Kunci id dan en setara.');
if (extra.help) console.log(`modul bantuan: ${Object.keys(extra.help).join(', ')}`);
