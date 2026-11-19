#!/usr/bin/env node
// pnpm mobile:test-restart [--step=now|login|courses|done|neosia]: with the
// phone connected (adb, a debug build installed), ends the app's process
// right after a step and opens it again, then checks the state came back
// whole. Interactive by default: for each step it asks you to do it on the
// phone, then presses Enter for you to continue.
//
// It reads on the phone (run-as, the debug build only) and prints only
// presence, sizes, counts and step names: never a cookie, a sesskey, a
// token, the vault's content or anything SIKOLA or NEOSIA sent.
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { adbPath } from './env.mjs';

const PKG = 'dev.ikrar.sulo';
const adb = (args, input) => execFileSync(adbPath(), args, { encoding: 'utf8', input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });

// Runs on the phone as the app (run-as): one "key=value" per line, values are states, sizes and counts only.
const PROBE = `
cd /data/user/0/${PKG} || exit 1
P=shared_prefs
v=$(grep -o 'name="state">[a-z]*<' $P/sulo_session.xml 2>/dev/null | sed 's/.*>\\(.*\\)</\\1/')
echo "vault=\${v:-none}"
echo "vaultBlobBytes=$(grep -o 'name="blob">[^<]*' $P/sulo_session.xml 2>/dev/null | wc -c)"
echo "onboardingStep=$(grep -o 'name="sulo:mobile:onboarding">[^<]*' $P/CapacitorStorage.xml 2>/dev/null | grep -o '&quot;step&quot;:&quot;[a-z0-9]*' | sed 's/.*;//')"
echo "coreSession=$(grep -o 'name="sulo:global:session">[^<]*' $P/CapacitorStorage.xml 2>/dev/null | grep -o 'state&quot;:&quot;[A-Z]*' | sed 's/.*;//')"
echo "currentUser=$(grep -c 'name="sulo:global:currentUser"' $P/CapacitorStorage.xml 2>/dev/null)"
echo "coursesBytes=$(grep -o 'name="sulo:u:[0-9]*:courses">[^<]*' $P/CapacitorStorage.xml 2>/dev/null | wc -c)"
echo "tasksBytes=$(grep -o 'name="sulo:u:[0-9]*:tasks">[^<]*' $P/CapacitorStorage.xml 2>/dev/null | wc -c)"
echo "prefsBytes=$(grep -o 'name="sulo:global:prefs">[^<]*' $P/CapacitorStorage.xml 2>/dev/null | wc -c)"
L="app_webview/Default/Local Storage/leveldb"
echo "neosiaKeys=$(cat "$L"/*.ldb "$L"/*.log 2>/dev/null | grep -a -o '_https://neosia.unhas.ac.id.\\{1,40\\}' | sort -u | wc -l)"
echo "lastEvent=$(grep -o 'name="events">[^<]*' $P/sulo_diag.xml 2>/dev/null | grep -o '&quot;e&quot;:&quot;[A-Za-z0-9_:.-]*' | tail -1 | sed 's/.*;//')"
`;

function probe() {
  const out = adb(['shell', 'run-as', PKG, 'sh'], PROBE);
  return Object.fromEntries(out.trim().split('\n').map((l) => l.split('=')).map(([k, ...v]) => [k.trim(), v.join('=').trim()]));
}

function restart() {
  adb(['shell', 'am', 'force-stop', PKG]);
  adb(['shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1']);
  // The app opens and settles (its first reads and a possible sync).
  execFileSync('sleep', ['12']);
}

const STEPS = {
  now: { ask: null, expect: () => [] },
  login: { ask: 'Masuk SIKOLA di aplikasi (onboarding sampai layar memuat selesai).', expect: (a) => [['vault', 'connected'], ['onboardingNotBack', !['splash', 'intro1', 'intro2', 'intro3', 'signin', ''].includes(a.onboardingStep)]] },
  courses: { ask: 'Pilih mata kuliah dan tekan Lanjut.', expect: () => [['vault', 'connected']] },
  done: { ask: 'Selesaikan onboarding dan tekan "Buka Sulo".', expect: () => [['vault', 'connected'], ['onboardingStep', 'finished']] },
  neosia: { ask: 'Di layar dev, ketuk "Masuk NEOSIA", masuk, tunggu layar menutup sendiri, lalu tunggu 10 detik.', expect: () => [['vault', 'connected'], ['neosiaKeysKept', true]] },
};

const KEEP = ['vault', 'coreSession', 'vaultBlobBytes', 'onboardingStep', 'currentUser', 'coursesBytes', 'prefsBytes'];

async function run(name, rl) {
  const step = STEPS[name];
  if (step.ask && rl) await rl.question(`\n[${name}] ${step.ask}\nSetelah selesai, tekan Enter... `);
  const before = probe();
  restart();
  const after = probe();
  const problems = [];
  for (const k of KEEP) if (before[k] !== after[k]) problems.push(`${k}: ${before[k] || '-'} → ${after[k] || '-'}`);
  // What the screens read ("Masuk lagi untuk memperbarui"): core's state, apart from the vault.
  if (after.vault === 'connected' && after.coreSession === 'EXPIRED') problems.push('coreSession: EXPIRED padahal vault connected (layar akan meminta masuk lagi)');
  for (const [k, want] of step.expect(after)) {
    const got = k === 'onboardingNotBack' ? want : k === 'neosiaKeysKept' ? Number(after.neosiaKeys) > 0 && after.neosiaKeys === before.neosiaKeys : after[k];
    if (k === 'onboardingNotBack' || k === 'neosiaKeysKept' ? got !== true : got !== want) problems.push(`${k}: ${k === 'neosiaKeysKept' ? `${before.neosiaKeys} → ${after.neosiaKeys}` : got || '-'}, diharapkan ${want === true ? 'utuh' : want}`);
  }
  const summary = `vault ${after.vault} (${after.vaultBlobBytes} byte), sesi di layar ${after.coreSession || '-'}, onboarding ${after.onboardingStep || '-'}, mata kuliah ${after.coursesBytes} byte, NEOSIA ${after.neosiaKeys} kunci, kejadian terakhir ${after.lastEvent || '-'}`;
  console.log(`${problems.length ? 'GAGAL' : 'ok   '} [${name}] setelah force-stop dan buka lagi: ${summary}${problems.length ? `\n  ${problems.join('\n  ')}` : ''}`);
  return problems.length === 0;
}

const only = process.argv.find((a) => a.startsWith('--step='))?.slice(7);
if (only && !STEPS[only]) {
  console.error(`test-restart: langkah tidak dikenal: ${only} (${Object.keys(STEPS).join(', ')})`);
  process.exit(2);
}
if (!adb(['devices']).split('\n').slice(1).some((l) => /\tdevice$/.test(l))) {
  console.error('test-restart: tidak ada HP yang tersambung (adb devices).');
  process.exit(2);
}
const rl = only === 'now' ? null : createInterface({ input: process.stdin, output: process.stdout });
let ok = true;
for (const name of only ? [only] : ['login', 'courses', 'done', 'neosia']) ok = (await run(name, rl)) && ok;
rl?.close();
console.log(ok ? '\ntest-restart: keadaan utuh setelah setiap force-stop.' : '\ntest-restart: ada keadaan yang hilang (lihat GAGAL di atas).');
process.exit(ok ? 0 : 1);
