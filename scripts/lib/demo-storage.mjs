// Synthetic demo data for pnpm guide:shots and pnpm store:shots
// (fixtures/guide/demo-seed.json, built from entrypoints/preview/fixtures.ts:
// no real account, name, student number or email). Every timestamp is moved
// so "now" is the moment the script runs, keeping overdue/today/this week true.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function demoStorage(root) {
  const { generatedAt, storage } = JSON.parse(readFileSync(join(root, 'fixtures/guide/demo-seed.json'), 'utf8'));
  const shift = Math.floor(Date.now() / 1000) - generatedAt;
  const walk = (v, key = '') => {
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return typeof v === 'number' && /At$|^at$|^dueAt$/.test(key) && v > 1e9 ? v + shift : v;
  };
  return walk(storage);
}
