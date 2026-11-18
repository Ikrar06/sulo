// Changes status_verifikasi in the override file, then rebuilds the data.
// For the holiday check against the SKB 3 Menteri:
//   node scripts/calendar/set-status.ts libur cocok_skb          (every national holiday)
//   node scripts/calendar/set-status.ts <id> cocok_skb            (one holiday or one added event)
//   node scripts/calendar/set-status.ts <id> perlu_cek "catatan"  (flag one, with a note)
// Only entries already in the file change; nothing new is added (no extra
// cuti bersama from other sources without the maintainer's approval).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { STATUS_VERIFIKASI } from '../../../../packages/core/src/calendar/schema.ts';

const YEAR = '2026-2027';
const [target, status, note] = process.argv.slice(2);
if (!target || !status || !(STATUS_VERIFIKASI as readonly string[]).includes(status)) {
  console.error(`Pakai: node scripts/calendar/set-status.ts <libur|id> <${STATUS_VERIFIKASI.join('|')}> ["catatan"]`);
  process.exit(2);
}
const path = new URL(`../../data/calendar/overrides-${YEAR}.json`, import.meta.url);
const overrides = JSON.parse(readFileSync(path, 'utf8'));
type Entry = { id: string; status_verifikasi: string; catatan?: string };
const entries: Entry[] = [...overrides.libur_nasional, ...overrides.tambah];
const chosen = target === 'libur' ? (overrides.libur_nasional as Entry[]) : entries.filter((e) => e.id === target);
if (chosen.length === 0) {
  console.error(`Tidak ada entri dengan id "${target}". Acara dari ICS diubah lewat bagian "ubah" di berkas override.`);
  process.exit(1);
}
for (const entry of chosen) {
  entry.status_verifikasi = status;
  if (note) entry.catatan = note;
}
writeFileSync(path, `${JSON.stringify(overrides, null, 2)}\n`);
console.log(`${chosen.length} entri diubah menjadi ${status}.`);
execFileSync(process.execPath, [new URL('./build.ts', import.meta.url).pathname], { stdio: ['ignore', 'ignore', 'inherit'] });
console.log('Data dibangun ulang: lib/calendar/data/. Jalankan pnpm calendar:publish ../sulo-data untuk menerbitkan.');
