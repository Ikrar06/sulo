#!/usr/bin/env node
// Compares the shape (field paths and value types, never values) of the
// synthetic fixtures in fixtures/synthetic/ with the recorded fixtures kept
// locally in docs/fixtures/. Recorded fixtures come from a real account and
// never enter the repository, so this check runs only on a maintainer's
// machine and is skipped automatically when docs/fixtures/ is absent (CI).
//
// Usage: node scripts/compare-fixture-shapes.mjs
//
// Fails when the synthetic fixture
//   - lacks a field path seen in the recording,
//   - has a field path the recording never had, or
//   - never uses a type the recording uses at the same path.
// Extra types in the synthetic fixture (e.g. a string where the recording
// only had null) are reported as notes: they cover cases not yet recorded.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
// docs/ stays at the repository root.
const RECORDED_DIR = join(ROOT, '../../docs/fixtures');
const SYNTHETIC_DIR = join(ROOT, 'fixtures/synthetic');

if (!existsSync(RECORDED_DIR)) {
  console.log('docs/fixtures/ tidak ada, perbandingan bentuk dilewati.');
  process.exit(0);
}

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

function parseJsonString(v) {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!(t.startsWith('{') || t.startsWith('['))) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

/** Map of path -> set of types. Array items share the path "[]". */
function shape(value, path = '', out = new Map()) {
  const add = (p, t) => out.set(p, (out.get(p) ?? new Set()).add(t));
  const nested = parseJsonString(value);
  if (nested !== undefined) {
    add(path, 'json-string');
    return shape(nested, `${path}<json>`, out);
  }
  add(path, typeOf(value));
  if (Array.isArray(value)) value.forEach((item) => shape(item, `${path}[]`, out));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) shape(child, `${path}.${key}`, out);
  }
  return out;
}

const pairs = readdirSync(RECORDED_DIR)
  .filter((f) => f.endsWith('.recorded.json'))
  .map((f) => ({ name: f.replace('.recorded.json', ''), recorded: join(RECORDED_DIR, f) }))
  .map((p) => ({ ...p, synthetic: join(SYNTHETIC_DIR, `${p.name}.normal.json`) }));

let problems = 0;
for (const { name, recorded, synthetic } of pairs) {
  if (!existsSync(synthetic)) {
    console.error(`${name}: fixture sintetis tidak ada (${name}.normal.json)`);
    problems++;
    continue;
  }
  const rec = shape(JSON.parse(readFileSync(recorded, 'utf8')).data);
  const syn = shape(JSON.parse(readFileSync(synthetic, 'utf8')));
  const lines = [];
  for (const [path, types] of rec) {
    const synTypes = syn.get(path);
    if (!synTypes) lines.push(`  KURANG  ${path || '(root)'} (${[...types].join('|')})`);
    else {
      const missing = [...types].filter((t) => !synTypes.has(t));
      if (missing.length) lines.push(`  TIPE    ${path || '(root)'}: rekaman ${[...types].join('|')}, sintetis ${[...synTypes].join('|')}`);
    }
  }
  for (const path of syn.keys()) {
    if (!rec.has(path)) lines.push(`  LEBIH   ${path}`);
  }
  const notes = [...syn]
    .filter(([path, types]) => rec.has(path) && [...types].some((t) => !rec.get(path).has(t)))
    .map(([path, types]) => `  catatan ${path}: sintetis juga ${[...types].filter((t) => !rec.get(path).has(t)).join('|')}`);

  problems += lines.length;
  console.log(`${name}: ${lines.length === 0 ? 'bentuk cocok' : `${lines.length} perbedaan`}`);
  for (const line of [...lines, ...notes]) console.log(line);
}

if (problems > 0) {
  console.error(`\n${problems} perbedaan bentuk. Sesuaikan fixture sintetis.`);
  process.exit(1);
}
