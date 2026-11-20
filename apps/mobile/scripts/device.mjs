// Which Android device the mobile scripts talk to: the phone over USB or the
// emulator (AVD "sulo"). With more than one connected, --device=emu or
// --device=hp picks one; the chosen device is always printed.
import { execFileSync } from 'node:child_process';
import { adbPath } from './env.mjs';

const list = () =>
  execFileSync(adbPath(), ['devices'], { encoding: 'utf8' })
    .split('\n')
    .slice(1)
    .map((l) => l.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => ({ serial, kind: serial.startsWith('emulator-') ? 'emu' : 'hp' }));

/** The serial to use, or exits with a clear line. Prints "Perangkat: …". */
export function pickDevice(argv = process.argv) {
  const want = argv.find((a) => a.startsWith('--device='))?.slice(9);
  if (want && !['emu', 'hp'].includes(want)) {
    console.error(`--device harus emu atau hp, bukan "${want}".`);
    process.exit(2);
  }
  const all = list();
  const candidates = want ? all.filter((d) => d.kind === want) : all;
  if (candidates.length === 0) {
    console.error(want ? `Tidak ada ${want === 'emu' ? 'emulator' : 'HP'} yang tersambung (adb devices). ${want === 'emu' ? 'Jalankan pnpm mobile:emu.' : 'Sambungkan HP lewat USB.'}` : 'Tidak ada perangkat yang tersambung (adb devices). Jalankan pnpm mobile:emu atau sambungkan HP.');
    process.exit(2);
  }
  if (candidates.length > 1) {
    console.error(`Lebih dari satu perangkat tersambung (${all.map((d) => `${d.kind} ${d.serial}`).join(', ')}). Pilih dengan --device=emu atau --device=hp.`);
    process.exit(2);
  }
  const d = candidates[0];
  console.log(`Perangkat: ${d.kind === 'emu' ? 'emulator' : 'HP'} (${d.serial})`);
  return d;
}

/** adb bound to one device. */
export function adbFor(serial) {
  return (args, input) => execFileSync(adbPath(), ['-s', serial, ...args], { encoding: 'utf8', input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
}
