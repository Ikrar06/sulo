#!/usr/bin/env node
// pnpm mobile:test-restart: with the phone connected (adb, a debug build
// installed and signed in), ends the app's process and opens it again, then
// checks the state came back whole.
//
//   (no flag)          interactive: for each onboarding step, do it on the
//                      phone, press Enter, then one restart
//   --step=now         one restart now
//   --loop=40          40 rounds, each ending the process at a random moment
//                      (0.2 to 20 seconds) in one of five situations: just
//                      opened, idle, mid-sync, mid-vault-write, mid-background
//                      check; half by force-stop, half by swiping the app
//                      away from Recents (what people do)
//   --neosia=10        10 rounds of: end the process, open NEOSIA's Beranda,
//                      see whether NEOSIA asks to sign in again
//   --seed=N           the same random choices again
//
// It reads on the phone (run-as, debug build only) and prints only states,
// sizes, counts, step names and event codes: never a cookie, a sesskey, a
// token, the vault's content or anything SIKOLA or NEOSIA sent.
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { adbPath } from './env.mjs';

const PKG = 'dev.ikrar.sulo';
const adb = (args, input) => execFileSync(adbPath(), args, { encoding: 'utf8', input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

// Seeded random, so a failing run can be repeated with --seed.
let seed = Number(arg('seed') ?? Date.now() % 100000);
const firstSeed = seed;
const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (lo, hi) => Math.round(lo + random() * (hi - lo));

// Runs on the phone as the app: one "key=value" per line; states, sizes, counts and codes only.
const PROBE = `
cd /data/user/0/${PKG} || exit 1
P=shared_prefs
F=files/sulo_session.json
if [ -f $F ]; then
  echo "vault=$(grep -o '"state":"[a-z]*"' $F | sed 's/.*:"\\(.*\\)"/\\1/')"
  echo "vaultBlobBytes=$(grep -o '"blob":"[^"]*"' $F | wc -c)"
  echo "vaultSuspect=$(grep -o '"suspect":"[0-9]*"' $F | grep -o '[0-9][0-9]*')"
else
  v=$(grep -o 'name="state">[a-z]*<' $P/sulo_session.xml 2>/dev/null | sed 's/.*>\\(.*\\)</\\1/')
  echo "vault=\${v:-none}"
  echo "vaultBlobBytes=$(grep -o 'name="blob">[^<]*' $P/sulo_session.xml 2>/dev/null | wc -c)"
fi
echo "coreSession=$(grep -o 'name="sulo:global:session">[^<]*' $P/CapacitorStorage.xml 2>/dev/null | grep -o 'state&quot;:&quot;[A-Z]*' | sed 's/.*;//')"
echo "onboardingStep=$(grep -o 'name="sulo:mobile:onboarding">[^<]*' $P/CapacitorStorage.xml 2>/dev/null | grep -o '&quot;step&quot;:&quot;[a-z0-9]*' | sed 's/.*;//')"
echo "coursesBytes=$(grep -o 'name="sulo:u:[0-9]*:courses">[^<]*' $P/CapacitorStorage.xml 2>/dev/null | wc -c)"
echo "prefsBytes=$(grep -o 'name="sulo:global:prefs">[^<]*' $P/CapacitorStorage.xml 2>/dev/null | wc -c)"
echo "watchOn=$(grep -o 'name="plan">[^<]*' $P/sulo_watch.xml 2>/dev/null | grep -c '&quot;enabled&quot;:true')"
echo "events=$(grep -o 'name="events">[^<]*' $P/sulo_diag.xml 2>/dev/null | grep -o '&quot;e&quot;:&quot;[A-Za-z0-9_:.>+-]*' | sed 's/.*;//' | tr '\\n' ' ')"
`;

function probe() {
  const out = adb(['shell', 'run-as', PKG, 'sh'], PROBE);
  const p = Object.fromEntries(out.trim().split('\n').map((l) => l.split('=')).map(([k, ...v]) => [k.trim(), v.join('=').trim()]));
  p.lastEvent = p.events.split(' ').filter(Boolean).at(-1) ?? '';
  return p;
}

function launch() {
  adb(['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
  adb(['shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1']);
}

/** Ends the process: force-stop, or the way people do it, swiping the app away in Recents. */
async function end(how) {
  if (how === 'force') return void adb(['shell', 'am', 'force-stop', PKG]);
  adb(['shell', 'input', 'keyevent', 'KEYCODE_APP_SWITCH']);
  await sleep(900);
  // The current app's card is in the middle; a swipe up removes it (One UI, AOSP).
  const [w, h] = adb(['shell', 'wm', 'size']).match(/(\d+)x(\d+)/).slice(1).map(Number);
  adb(['shell', 'input', 'swipe', String(w / 2), String(Math.round(h * 0.5)), String(w / 2), String(Math.round(h * 0.08)), '180']);
  await sleep(700);
  adb(['shell', 'input', 'keyevent', 'KEYCODE_HOME']);
  await sleep(1500);
}

const pidOf = () => adb(['shell', 'pidof', PKG]).trim().split(' ')[0] || null;

/** Evaluates `expr` in one of the app's WebViews (debug build: DevTools socket). Its value, or null. */
async function inApp(expr, match = 'localhost') {
  try {
    const pid = pidOf();
    if (!pid) return null;
    adb(['forward', 'tcp:9333', `localabstract:webview_devtools_remote_${pid}`]);
    const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
    const t = targets.find((x) => x.url.includes(match));
    if (!t) return null;
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
    return await new Promise((resolve) => {
      const timer = setTimeout(() => (ws.close(), resolve(null)), 15000);
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.id !== 1) return;
        clearTimeout(timer);
        ws.close();
        resolve(m.result?.result?.value ?? null);
      };
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    });
  } catch {
    return null;
  }
}

/** What must hold after every restart; returns the problems. */
function judge(before, after) {
  const problems = [];
  if (before.vault === 'connected' && after.vault !== 'connected') problems.push(`vault: ${before.vault} → ${after.vault || '-'}`);
  if (after.vault === 'connected' && after.coreSession === 'EXPIRED') problems.push('layar meminta masuk lagi padahal vault connected');
  if (before.onboardingStep === 'finished' && after.onboardingStep !== 'finished') problems.push(`onboarding: finished → ${after.onboardingStep || '-'}`);
  for (const k of ['coursesBytes', 'prefsBytes']) if (Number(before[k]) > 0 && Number(after[k]) === 0) problems.push(`${k}: ${before[k]} → 0`);
  return problems;
}

const line = (s) =>
  `vault ${s.vault}${s.vaultSuspect && s.vaultSuspect !== '0' ? ` (perlu konfirmasi ×${s.vaultSuspect})` : ''}, sesi di layar ${s.coreSession || '-'}, onboarding ${s.onboardingStep || '-'}, mata kuliah ${s.coursesBytes} byte`;

/** Session-history codes added since `before` (the ring keeps the last 120), app starts left out. */
function newEvents(before, after) {
  const a = before.events.split(' ').filter(Boolean);
  const b = after.events.split(' ').filter(Boolean);
  for (let k = Math.min(a.length, b.length); k >= 0; k--) {
    if (a.slice(a.length - k).join(' ') === b.slice(0, k).join(' ')) return b.slice(k).filter((e) => e !== 'app_start');
  }
  return b.filter((e) => e !== 'app_start');
}

const MOMENTS = {
  /** Just opened: the first reads, the vault, core's state. */
  open: async () => between(200, 3000),
  /** Somewhere while it sits there. */
  idle: async () => between(200, 20000),
  /** Mid-sync, like pull-to-refresh. */
  sync: async () => ((await inApp('window.__suloDevSync ? (window.__suloDevSync(), "sync") : "no hook"')), between(200, 4000)),
  /** Mid-vault-write: the same session written again and again. */
  vault: async () => ((await inApp('window.Capacitor.Plugins.SuloSession.devVaultChurn({ ms: 5000 }), "churn"')), between(200, 3000)),
  /** Mid-background-check ("Jalankan cek sekarang"). */
  worker: async () => ((await inApp('window.Capacitor.Plugins.SuloSession.watchRunNow(), "worker"')), between(200, 3000)),
};

async function loop(rounds) {
  console.log(`test-restart --loop=${rounds} --seed=${firstSeed}`);
  launch();
  await sleep(6000);
  const start = probe();
  console.log(`awal: ${line(start)}; pemantauan ${start.watchOn === '1' ? 'menyala' : 'mati'}`);
  if (start.vault !== 'connected') {
    console.error('test-restart: belum masuk SIKOLA (vault bukan connected). Masuk dulu di aplikasi, lalu jalankan lagi.');
    process.exit(2);
  }
  const failures = [];
  for (let n = 1; n <= rounds; n++) {
    const moment = pick(Object.keys(MOMENTS));
    const how = random() < 0.5 ? 'force' : 'swipe';
    const before = probe();
    launch();
    await sleep(2500);
    const wait = await MOMENTS[moment]();
    await sleep(wait);
    await end(how);
    launch();
    await sleep(7000);
    const after = probe();
    const problems = judge(before, after);
    const codes = newEvents(before, after);
    console.log(
      `${problems.length ? 'GAGAL' : 'ok   '} #${String(n).padStart(2)} ${moment.padEnd(6)} ${how === 'force' ? 'force-stop' : 'geser     '} setelah ${(wait / 1000).toFixed(1).padStart(4)} dtk: ${line(after)}${codes.length ? ` | riwayat: ${codes.join(' ')}` : ''}${problems.length ? `\n      ${problems.join('\n      ')}` : ''}`,
    );
    if (problems.length) failures.push(n);
    // The session is gone: stop here, so the phone still shows what happened.
    if (problems.length && after.vault !== 'connected') break;
  }
  console.log(failures.length ? `\ntest-restart: GAGAL di putaran ${failures.join(', ')} (ulangi dengan --seed=${firstSeed}).` : `\ntest-restart: ${rounds} putaran, sesi dan data utuh di setiap putaran.`);
  return failures.length === 0;
}

/** NEOSIA: end the process, open Beranda; NEOSIA keeps its sign-in, or the screen closes itself (needs_login). */
async function neosia(rounds) {
  console.log(`test-restart --neosia=${rounds} --seed=${firstSeed}`);
  let held = 0;
  for (let n = 1; n <= rounds; n++) {
    const how = random() < 0.5 ? 'force' : 'swipe';
    launch();
    await sleep(3000);
    await end(how);
    launch();
    await sleep(5000);
    await inApp("window.__neo = 'pending', window.Capacitor.Plugins.SuloNeosia.open({ page: 'home', close: 'Tutup' }).then((r) => (window.__neo = r.result)), 'opened'");
    await sleep(9000);
    const path = await inApp('location.pathname', 'neosia.unhas.ac.id');
    const result = await inApp('String(window.__neo)');
    // Still open on Beranda: the sign-in held. Closed by itself with needs_login: NEOSIA asked again.
    const ok = path === '/' && result === 'pending';
    if (ok) held++;
    console.log(`${ok ? 'ok   ' : 'GAGAL'} #${String(n).padStart(2)} ${how === 'force' ? 'force-stop' : 'geser     '}: Beranda ${ok ? 'terbuka tanpa masuk lagi' : `tidak terbuka (${result})`}`);
    if (path) adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK']);
    await sleep(1500);
  }
  console.log(`\ntest-restart: NEOSIA ${held}/${rounds} kali terbuka tanpa masuk lagi.`);
  return held === rounds;
}

const STEPS = {
  now: { ask: null, expect: () => [] },
  login: { ask: 'Masuk SIKOLA di aplikasi (onboarding sampai layar memuat selesai).', expect: (a) => [['vault', 'connected'], ['onboardingNotBack', !['splash', 'intro1', 'intro2', 'intro3', 'signin', ''].includes(a.onboardingStep)]] },
  courses: { ask: 'Pilih mata kuliah dan tekan Lanjut.', expect: () => [['vault', 'connected']] },
  done: { ask: 'Selesaikan onboarding dan tekan "Buka Sulo".', expect: () => [['vault', 'connected'], ['onboardingStep', 'finished']] },
};

async function step(name, rl) {
  const s = STEPS[name];
  if (s.ask && rl) await rl.question(`\n[${name}] ${s.ask}\nSetelah selesai, tekan Enter... `);
  const before = probe();
  await end('force');
  launch();
  await sleep(12000);
  const after = probe();
  const problems = judge(before, after);
  for (const [k, want] of s.expect(after)) {
    const got = k === 'onboardingNotBack' ? want : after[k];
    if (k === 'onboardingNotBack' ? got !== true : got !== want) problems.push(`${k}: ${got || '-'}, diharapkan ${want === true ? 'utuh' : want}`);
  }
  console.log(`${problems.length ? 'GAGAL' : 'ok   '} [${name}] setelah force-stop dan buka lagi: ${line(after)}${problems.length ? `\n  ${problems.join('\n  ')}` : ''}`);
  return problems.length === 0;
}

if (!adb(['devices']).split('\n').slice(1).some((l) => /\tdevice$/.test(l))) {
  console.error('test-restart: tidak ada HP yang tersambung (adb devices).');
  process.exit(2);
}
let ok = true;
if (arg('loop')) ok = await loop(Number(arg('loop')));
else if (arg('neosia')) ok = await neosia(Number(arg('neosia')));
else {
  const only = arg('step');
  if (only && !STEPS[only]) {
    console.error(`test-restart: langkah tidak dikenal: ${only} (${Object.keys(STEPS).join(', ')})`);
    process.exit(2);
  }
  const rl = only === 'now' ? null : createInterface({ input: process.stdin, output: process.stdout });
  for (const name of only ? [only] : ['login', 'courses', 'done']) ok = (await step(name, rl)) && ok;
  rl?.close();
  console.log(ok ? '\ntest-restart: keadaan utuh setelah setiap force-stop.' : '\ntest-restart: ada keadaan yang hilang (lihat GAGAL di atas).');
}
process.exit(ok ? 0 : 1);
