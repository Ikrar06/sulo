#!/usr/bin/env node
// What only a real Android shows, from an EMULATOR with the measuring APK
// (scripts/apk-measure.mjs: the demo account and a stand-in session packed
// in, nothing ever reaches SIKOLA or NEOSIA): the app in Android's own
// WebView with the status bar and safe areas, the launch screen, the icon
// and label in the app drawer, the keyboard over a field, the back button,
// the system's notification permission dialog and a real notification.
// A complement to the web screenshots (scripts/audit-shots.mjs), not a
// replacement: those can be repeated pixel for pixel, these cannot.
//
// Guards, each checked before anything else and none of them optional:
//   - the target must be an emulator (serial "emulator-NNNN"), named in every adb call;
//   - airplane mode must be on and no network connected (turned on if it is not; never turned off);
//   - a Sulo already on the emulator must be a debuggable build (a release build is never replaced or cleared);
//   - nothing of the app's data is read or pulled; logcat is never stored.
// The page is driven through the WebView's devtools socket (debug builds only), the frames are adb screencaps.
//
//   <out>/<tema>/<bahasa>/<nn-layar>--<keadaan>.png   1080x2400
//
// Usage: node scripts/android-shots.mjs --out=<dir> --apk=<measuring apk>
//   [--serial=emulator-5554] [--themes=light,dark] [--langs=id,en] [--skip-install] [--only=<text in the name>]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { adbPath } from './env.mjs';
import { TEXT } from './onboarding-walk.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const base = process.env.INIT_CWD ?? process.cwd();
const outArg = arg('out', null);
const apkArg = arg('apk', null);
if (!outArg || !apkArg) throw new Error('--out=<dir> and --apk=<file> are required');
const out = resolve(base, outArg);
const apk = resolve(base, apkArg);
const serial = arg('serial', 'emulator-5554');
const themes = arg('themes', 'light,dark').split(',');
const langs = arg('langs', 'id,en').split(',');
const only = arg('only', null);
const PKG = 'dev.ikrar.sulo';
const PORT = 9333;
const ORIGIN = 'https://localhost';
const THEME_DIR = { light: 'terang', dark: 'gelap' };
// The same fixed moment as the web screenshots, so both show the same day and counts.
const NOW_MS = Date.parse('2026-11-18T10:00:00+08:00');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => process.stderr.write(`android-shots: ${m}\n`);
const fail = (m) => {
  console.error(`android-shots: ${m}`);
  process.exit(2);
};

// ---- adb, always with the emulator's serial ----------------------------------------------------------
if (!/^emulator-\d+$/.test(serial)) fail(`sasaran harus emulator (emulator-NNNN), bukan "${serial}". HP fisik tidak pernah disasar.`);
const adbBin = adbPath();
const adb = (...args) => execFileSync(adbBin, ['-s', serial, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const sh = (...args) => adb('shell', ...args).replace(/\r/g, '');
const quiet = (...args) => {
  try {
    return sh(...args);
  } catch {
    return '';
  }
};
if (!execFileSync(adbBin, ['devices'], { encoding: 'utf8' }).split('\n').some((l) => l.startsWith(`${serial}\t`) && l.trim().endsWith('device'))) fail(`${serial} tidak tersambung. Jalankan pnpm mobile:emu.`);
if (!existsSync(apk)) fail(`APK tidak ada: ${apk}. Bangun dengan node scripts/apk-measure.mjs.`);

function offline() {
  return sh('settings', 'get', 'global', 'airplane_mode_on').trim() === '1' && /Active default network: none/.test(sh('dumpsys', 'connectivity'));
}
if (!offline()) {
  sh('cmd', 'connectivity', 'airplane-mode', 'enable');
  await sleep(3000);
  if (!offline()) fail('mode pesawat tidak bisa dinyalakan atau masih ada jaringan. Berhenti: tidak ada yang dipasang atau dibuka.');
}
const installed = quiet('pm', 'list', 'packages', PKG).includes(`package:${PKG}`);
if (installed && !/DEBUGGABLE/.test(sh('dumpsys', 'package', PKG))) fail('Sulo yang terpasang di emulator adalah build rilis. Tidak diganti dan tidak dibuka. Copot dulu kalau memang boleh.');
if (!process.argv.includes('--skip-install')) {
  log('memasang APK pengukur');
  adb('install', '-r', apk);
}

// ---- A steady status bar (SystemUI demo mode: display only, airplane mode stays on) -----------------
function statusBar(on) {
  if (!on) return void quiet('am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'exit');
  quiet('settings', 'put', 'global', 'sysui_demo_allowed', '1');
  const demo = (...extras) => quiet('am', 'broadcast', '-a', 'com.android.systemui.demo', ...extras);
  demo('-e', 'command', 'enter');
  demo('-e', 'command', 'clock', '-e', 'hhmm', '1000');
  demo('-e', 'command', 'battery', '-e', 'level', '100', '-e', 'plugged', 'false');
  demo('-e', 'command', 'network', '-e', 'airplane', 'hide', '-e', 'wifi', 'show', '-e', 'level', '4', '-e', 'mobile', 'hide');
  demo('-e', 'command', 'notifications', '-e', 'visible', 'false');
}

// ---- The WebView through its devtools socket ---------------------------------------------------------
let ws = null;
let appLang = 'id';
let nextId = 0;
const waiting = new Map();
const send = (method, params = {}, timeoutMs = 30000) =>
  new Promise((ok, no) => {
    const id = ++nextId;
    waiting.set(id, { ok, no });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => waiting.has(id) && (waiting.delete(id), no(new Error(`${method} timed out`))), timeoutMs);
  });
const run = async (fn, ...args) => {
  const r = await send('Runtime.evaluate', { expression: `(${fn})(...${JSON.stringify(args)})`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const until = async (fn, args = [], timeoutMs = 30000, what = 'condition') => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await run(fn, ...args).catch(() => false)) return;
    await sleep(250);
  }
  throw new Error(`menunggu ${what} terlalu lama`);
};

/** Starts the app from nothing (its data cleared: the measuring build's own synthetic data only) and attaches. */
async function launch({ fixedClock = true, clear = true, grant = false } = {}) {
  if (ws) ws.close();
  quiet('am', 'force-stop', PKG);
  if (clear) sh('pm', 'clear', PKG);
  // The app follows the phone's language until one is chosen: set for this app only (no root, no reboot). Clearing the data resets it.
  quiet('cmd', 'locale', 'set-app-locales', PKG, '--user', '0', '--locales', appLang === 'en' ? 'en-US' : 'id-ID');
  // Granted up front where the run is not about the question itself: Android's dialog pauses the page behind it.
  if (grant) quiet('pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS');
  sh('am', 'start', '-n', `${PKG}/.MainActivity`);
  let pid = '';
  for (let i = 0; i < 60 && !pid; i++) {
    pid = quiet('pidof', PKG).trim();
    if (!pid) await sleep(500);
  }
  for (let i = 0; i < 60 && !quiet('cat', '/proc/net/unix').includes(`webview_devtools_remote_${pid}`); i++) await sleep(500);
  try {
    adb('forward', '--remove', `tcp:${PORT}`);
  } catch {
    // Nothing forwarded yet.
  }
  adb('forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`);
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    const list = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json()).catch(() => []);
    target = list.find((t) => t.type === 'page' && String(t.url).startsWith(ORIGIN)) ?? null;
    if (!target) await sleep(500);
  }
  if (!target) throw new Error('WebView tidak ditemukan');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.onopen = ok;
    ws.onerror = no;
  });
  ws.onmessage = (e) => {
    const msg = JSON.parse(String(e.data));
    const w = waiting.get(msg.id);
    if (!w) return;
    waiting.delete(msg.id);
    msg.error ? w.no(new Error(msg.error.message)) : w.ok(msg.result);
  };
  await send('Runtime.enable');
  await send('Page.enable');
  // Airplane mode stays on. The page alone is told it is online, so the screens show their usual state and
  // not "no connection" on every one (the measuring build has no request to send either way).
  await send('Page.addScriptToEvaluateOnNewDocument', { source: ONLINE });
  await run(`() => { ${ONLINE}; window.dispatchEvent(new Event('online')); }`).catch(() => undefined);
  if (fixedClock) await fixClock();
}
const ONLINE = `try { Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => true }); } catch (e) {}`;
/** From the next page load on, "now" is the fixed moment (timers keep running). */
const fixClock = () =>
  send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => { const Real = Date; const fixed = ${NOW_MS}; globalThis.Date = class extends Real { constructor(...a) { if (a.length === 0) super(fixed); else super(...a); } static now() { return fixed; } }; })();`,
  });
const navigate = async (query) => {
  await send('Page.navigate', { url: `${ORIGIN}/${query}` });
  await sleep(1200);
  await until(() => document.readyState === 'complete', [], 30000, 'halaman');
};
const clickText = (pattern) =>
  run((p) => {
    const re = new RegExp(p);
    const el = [...document.querySelectorAll('button, a, [role="button"], [role="tab"]')].find((e) => re.test((e.getAttribute('aria-label') || e.textContent || '').trim()) && e.getBoundingClientRect().width > 0);
    if (!el) return false;
    el.click();
    return true;
  }, pattern);
const go = async (hash) => {
  await run((h) => (location.hash = h), hash);
  await sleep(900);
};
/** A real touch at an element's centre (a user gesture: a field gets the keyboard). */
async function tap(selector) {
  const p = await run((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }, selector);
  if (!p) throw new Error(`tidak ada ${selector}`);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
/** A button of a system dialog (the permission question), by its text, through the accessibility tree. */
function systemButton(pattern) {
  const xml = execFileSync(adbBin, ['-s', serial, 'exec-out', 'uiautomator', 'dump', '/dev/tty'], { encoding: 'utf8' });
  const m = new RegExp(`text="(${pattern})"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`).exec(xml);
  return m ? { x: (Number(m[2]) + Number(m[4])) / 2, y: (Number(m[3]) + Number(m[5])) / 2 } : null;
}
function tapSystem(pattern) {
  const at = systemButton(pattern);
  if (!at) return false;
  sh('input', 'tap', String(at.x), String(at.y));
  return true;
}

const done = [];
const failed = [];
let dir = out;
async function shot(name, wait = 700) {
  if (only && !name.includes(only)) return;
  await sleep(wait);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.png`);
  writeFileSync(file, execFileSync(adbBin, ['-s', serial, 'exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 }));
  done.push(file);
}
async function steps(label, list) {
  for (const [name, fn] of list) {
    try {
      await fn();
    } catch (e) {
      failed.push(`${label} ${name}: ${String(e.message ?? e).split('\n')[0]}`);
    }
  }
}
const enterDemo = async () => {
  await until(() => typeof window.__suloEnterDemo === 'function', [], 60000, 'pintu demo');
  await run(() => window.__suloEnterDemo());
  await until(() => !!document.querySelector('[data-mascot-spot="hero"], [role="dialog"]'), [], 60000, 'Ringkasan');
  await sleep(900);
};
const LATER = '^(Nanti|Later)$';
const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exact = (label) => `^${escapeRe(label)}$`;
const heading = (text, timeoutMs = 30000) => until((t) => [...document.querySelectorAll('h1, h2, h3, [role="heading"]')].some((h) => h.textContent.trim().replace(/\s+/g, ' ') === t && h.getBoundingClientRect().width > 0), [text], timeoutMs, `judul "${text}"`);

async function combo(theme, lang, first) {
  dir = join(out, THEME_DIR[theme], lang);
  const label = `${theme} ${lang}`;
  sh('cmd', 'uimode', 'night', theme === 'dark' ? 'yes' : 'no');
  await sleep(800);

  appLang = lang;
  const t = TEXT[lang];

  // ---- The real onboarding from a cold start, with Android's own keyboard and permission dialog ----
  await steps(label, [
    ['onboarding 1 sampai 4', async () => {
      // No reload here: a reopened app skips the intro (it was seen).
      await launch({ fixedClock: false });
      await heading(t.intro1);
      await shot('00-onboarding--1-tenggat', 4300);
      await clickText(exact(t.next));
      await shot('00-onboarding--2-pengingat', 3200);
      await clickText(exact(t.next));
      await shot('00-onboarding--3-privasi', 4200);
      await clickText(exact(t.start));
      await shot('00-onboarding--4-masuk', 2000);
    }],
    ['onboarding 5 sampai 7', async () => {
      await clickText(exact(t.signin));
      await shot('00-onboarding--5-menyiapkan', 900);
      // Scheduling the first reminders makes Android ask for the notification permission right here
      // (the plugin asks on schedule, Android 13+), before the app's own question on screen 8. Shot as it is.
      await sleep(3200);
      if (systemButton('Allow|Izinkan')) {
        await shot('00-onboarding--5-izin-notifikasi-android', 200);
        tapSystem('Allow|Izinkan');
      }
      await heading(t.courses);
      await shot('00-onboarding--6-mata-kuliah', 1200);
      await clickText(exact(t.next));
      await shot('00-onboarding--7-nama', 1300);
      await tap('.onb-frame input');
      await shot('00-onboarding--7-nama-papan-ketik', 2000);
      sh('input', 'keyevent', 'KEYCODE_BACK');
      await sleep(900);
    }],
    ['onboarding 8 dan 9', async () => {
      if (!(await clickText(exact(t.skip)))) await clickText(exact(t.next));
      await shot('00-onboarding--8-pengingat', 1600);
      await clickText(exact(t.allow));
      await sleep(1800);
      if (systemButton('Allow|Izinkan')) {
        await shot('00-onboarding--8-izin-notifikasi-android', 200);
        tapSystem('Allow|Izinkan');
      }
      await heading(t.done);
      await shot('00-onboarding--9-selesai', 2500);
      await clickText(exact(t.open));
      await until(() => !!document.querySelector('[data-mascot-spot="hero"]'), [], 30000, 'Ringkasan');
    }],
    // From here the clock is fixed and the demo account is laid out around it, as in the web screenshots.
    ['akun demo dengan jam tetap', async () => {
      quiet('pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS');
      await fixClock();
      await navigate(`?lang=${lang}`);
      await enterDemo();
      await clickText(LATER).catch(() => false);
      await sleep(3600);
    }],
    ['ringkasan', async () => {
      await shot('10-ringkasan--atas');
      await run(() => { const m = document.querySelector('main'); m?.scrollTo({ top: m.scrollHeight }); });
      await shot('10-ringkasan--bawah');
    }],
    ['tugas dan rincian', async () => {
      await go('#tugas');
      await shot('11-tugas--daftar');
      await run(() => document.querySelector('main section.m-card .m-cover')?.click());
      await shot('12-rincian-tugas--terbuka', 900);
      await clickText('^(Aksi lainnya|More actions)$');
      await shot('12-rincian-tugas--sheet-aksi', 900);
      sh('input', 'keyevent', 'KEYCODE_BACK');
      await sleep(700);
      sh('input', 'keyevent', 'KEYCODE_BACK');
      await shot('11-tugas--setelah-tombol-kembali', 900);
    }],
    ['papan ketik di pencarian', async () => {
      await clickText('^(Cari|Search)$');
      await sleep(500);
      await tap('input[type="search"]');
      await shot('11-tugas--cari-papan-ketik', 1800);
      sh('input', 'keyevent', 'KEYCODE_BACK');
      await sleep(500);
      await clickText('^(Tutup pencarian|Close search)$');
    }],
    ['kalender', async () => (await go('#kalender'), shot('13-kalender--daftar'))],
    ['presensi', async () => (await go('#presensi'), shot('14-presensi--rekap'))],
    ['lainnya', async () => (await go('#lainnya'), shot('15-lainnya--daftar'))],
    ['kabar', async () => (await go('#kabar'), shot('16-kabar--daftar'))],
    ['mata kuliah', async () => (await go('#mata-kuliah'), shot('17-mata-kuliah--daftar'))],
    ['pengaturan', async () => (await go('#pengaturan'), shot('18-pengaturan--atas'))],
    ['sheet nama dengan papan ketik', async () => {
      await clickText('^(Nama panggilan|Nickname)');
      await shot('18-pengaturan--sheet-nama', 900);
      await tap('[role="dialog"] input');
      await shot('18-pengaturan--sheet-nama-papan-ketik', 1800);
      sh('input', 'keyevent', 'KEYCODE_BACK');
      await sleep(600);
      sh('input', 'keyevent', 'KEYCODE_BACK');
      await sleep(600);
    }],
    ['bantuan', async () => (await go('#bantuan'), shot('19-bantuan--daftar'))],
    ['tentang', async () => (await go('#tentang'), shot('20-tentang--atas'))],
    // The new-version card and the screen below the required version (synthetic config, ?release=).
    ['versi baru', async () => {
      await navigate(`?lang=${lang}&release=available`);
      await enterDemo();
      await clickText(LATER).catch(() => false);
      await shot('10-ringkasan--versi-baru', 3600);
    }],
    ['perlu diperbarui', async () => {
      await navigate(`?lang=${lang}&release=required`);
      await enterDemo().catch(() => undefined);
      await navigate(`?lang=${lang}&release=required`);
      await shot('31-perlu-diperbarui--layar', 1500);
    }],
    ['halaman webview lama', async () => (await navigate('perlu-pembaruan.html'), shot('32-webview-lama--halaman'))],
  ]);

  if (!first) return;
  // ---- Once: launch screen, a real notification, reduced motion, the light tier, drawer and recents ----
  await steps(label, [
    ['layar pembuka', async () => {
      if (ws) ws.close();
      ws = null;
      quiet('am', 'force-stop', PKG);
      sh('pm', 'clear', PKG);
      sh('am', 'start', '-n', `${PKG}/.MainActivity`);
      // Four frames in a row (a screencap takes a few hundred ms itself): the launch screen, then the first paint.
      for (const n of ['a', 'b', 'c', 'd']) await shot(`90-layar-pembuka--${n}`, 80);
    }],
    ['notifikasi sungguhan', async () => {
      // Real time here: a notification is scheduled a second ahead of the phone's own clock.
      await launch({ fixedClock: false, grant: true });
      await navigate(`?lang=${lang}`);
      await enterDemo();
      await clickText(LATER).catch(() => false);
      await sleep(800);
      await run(() => window.dispatchEvent(new Event('sulo:dev')));
      await sleep(1200);
      if (!(await clickText('^Ringkasan pagi sekarang$'))) throw new Error('tombol uji ringkasan pagi tidak ada');
      await sleep(4000);
      statusBar(false);
      sh('cmd', 'statusbar', 'expand-notifications');
      await shot('91-notifikasi--ringkasan-pagi', 1800);
      sh('cmd', 'statusbar', 'collapse');
      statusBar(true);
    }],
    ['gerak dikurangi', async () => {
      sh('settings', 'put', 'global', 'animator_duration_scale', '0');
      await launch({ grant: true });
      await heading(t.intro1);
      await shot('92-gerak-dikurangi--onboarding', 1500);
      await navigate(`?lang=${lang}`);
      await enterDemo();
      await clickText(LATER).catch(() => false);
      await shot('92-gerak-dikurangi--ringkasan', 3600);
    }],
    ['mode ringan', async () => {
      sh('settings', 'put', 'global', 'animator_duration_scale', '1');
      await launch({ grant: true });
      await navigate(`?lang=${lang}&perf=lite`);
      await enterDemo();
      await clickText(LATER).catch(() => false);
      await shot('93-mode-ringan--ringkasan', 3600);
    }],
    ['laci aplikasi dan aplikasi terakhir', async () => {
      sh('input', 'keyevent', 'KEYCODE_APP_SWITCH');
      await shot('94-aplikasi-terakhir--kartu', 1500);
      sh('input', 'keyevent', 'KEYCODE_HOME');
      await sleep(1200);
      sh('input', 'swipe', '540', '1900', '540', '500', '300');
      await shot('95-laci-aplikasi--ikon', 1500);
      sh('input', 'keyevent', 'KEYCODE_HOME');
    }],
  ]);
  sh('settings', 'put', 'global', 'animator_duration_scale', '1');
}

statusBar(true);
try {
  let first = true;
  for (const theme of themes)
    for (const lang of langs) {
      log(`${theme} ${lang}`);
      await combo(theme, lang, first);
      first = false;
    }
} finally {
  if (ws) ws.close();
  statusBar(false);
  quiet('settings', 'put', 'global', 'animator_duration_scale', '1');
  quiet('cmd', 'uimode', 'night', 'no');
  quiet('am', 'force-stop', PKG);
  try {
    adb('forward', '--remove', `tcp:${PORT}`);
  } catch {
    // Already gone.
  }
}
if (failed.length > 0) console.log(`Langkah gagal (${failed.length}):\n${failed.join('\n')}`);
console.log(`android-shots: ${done.length} gambar di ${out}, ${failed.length} langkah gagal. Mode pesawat tetap menyala.`);
