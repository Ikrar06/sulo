// Sanitizes a JSON file with the same rules the fixture recorder uses.
// Usage: node scripts/sanitize.ts <input.json> <output.json> [--shift-days N]
// Runs on Node 24+ (built-in TypeScript type stripping), no build step.
// Refuses to write the output if a leak pattern survives sanitization.

import { readFileSync, writeFileSync } from 'node:fs';
import { sanitizeJson } from '../lib/sanitize/json.ts';
import { findLeaks } from './leak-rules.mjs';

const SIKOLA_ORIGIN = 'https://sikola-v2.unhas.ac.id';

function main(argv: string[]): number {
  const [input, output] = argv;
  if (!input || !output) {
    console.error('Pemakaian: node scripts/sanitize.ts <input.json> <output.json> [--shift-days N]');
    return 2;
  }
  const shiftIndex = argv.indexOf('--shift-days');
  const shiftDays = shiftIndex >= 0 ? Number(argv[shiftIndex + 1]) : -37;
  if (!Number.isFinite(shiftDays)) {
    console.error('--shift-days harus angka');
    return 2;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(input, 'utf8'));
  } catch {
    console.error('Input bukan JSON yang valid');
    return 1;
  }

  const clean = sanitizeJson(raw, { timeShiftSeconds: shiftDays * 86_400, origin: SIKOLA_ORIGIN });
  const text = `${JSON.stringify(clean, null, 2)}\n`;
  const leaks = [...new Set(findLeaks(text))];
  if (leaks.length > 0) {
    // Rule names only, never the matched values.
    console.error(`Masih ada pola bocor setelah sanitasi: ${leaks.join(', ')}. Berkas tidak ditulis.`);
    return 1;
  }
  writeFileSync(output, text);
  console.log(`Tersanitasi: ${output}`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
