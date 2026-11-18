// Sanitizes a JSON file with the same rules the fixture recorder uses, or a
// saved SIKOLA attendance page (.html, sanitize/html.ts).
// Usage: node scripts/sanitize.ts <input.json|.html> <output> [--shift-days N]
// Runs on Node 24+ (built-in TypeScript type stripping), no build step.
// Refuses to write the output if a leak pattern survives sanitization.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sanitizeJson } from '../../../packages/core/src/sanitize/json.ts';
import { sanitizeAttendanceHtml, signedInNames } from '../../../packages/core/src/sanitize/html.ts';
import { findLeaks } from '../../../packages/core/src/sanitize/leak-rules.mjs';

const SIKOLA_ORIGIN = 'https://sikola-v2.unhas.ac.id';

function main(argv: string[]): number {
  // pnpm runs this from apps/extension; paths are read from where the command was typed.
  const fromCaller = (p: string | undefined) => (p === undefined ? undefined : resolve(process.env.INIT_CWD ?? process.cwd(), p));
  const [input, output] = [fromCaller(argv[0]), fromCaller(argv[1])];
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

  if (input.endsWith('.html')) return sanitizeHtmlFile(input, output);

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

/** HTML: counts only on screen, never a replaced value. */
function sanitizeHtmlFile(input: string, output: string): number {
  const raw = readFileSync(input, 'utf8');
  const { html, report } = sanitizeAttendanceHtml(raw);
  const leaks = [...new Set(findLeaks(html, 'fixtures/synthetic/page.html'))];
  // The user's own name must be gone, whatever form it took.
  const nameLeft = signedInNames(raw).some((n) => html.toLowerCase().includes(n.toLowerCase()));
  if (leaks.length > 0 || nameLeft || !report.keptRegion || report.personMarkersLeft > 0) {
    console.error(`Belum aman: ${[...leaks, ...(nameLeft ? ['nama pengguna masih ada'] : []), ...(report.keptRegion ? [] : ['region utama tidak ditemukan']), ...(report.personMarkersLeft > 0 ? [`${report.personMarkersLeft} penanda pengguna tersisa`] : [])].join(', ')}. Berkas tidak ditulis.`);
    return 1;
  }
  writeFileSync(output, html);
  console.log(`Tersanitasi: ${output}`);
  console.log(`Diganti atau dibuang: ${Object.entries(report).filter(([k]) => k !== 'keptRegion').map(([k, v]) => `${k} ${v}`).join(', ')}`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
