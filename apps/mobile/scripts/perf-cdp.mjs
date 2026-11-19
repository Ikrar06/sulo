#!/usr/bin/env node
// The emulator half of the performance measurements (CI's Perf Android
// job, scripts/perf-emulator.sh): the measuring APK's WebView through adb's
// devtools socket (forwarded to 127.0.0.1:9222), driven with plain Chrome
// DevTools Protocol over Node's own WebSocket. Playwright cannot hold a
// WebView across navigations; the raw target can. Same measures as
// perf-measure.mjs: scroll Tugas (50 cards), tab switches, a sheet, the
// onboarding screens 1, 5 and 9, and memory after N minutes of tab switching.
// Only synthetic fixtures; nothing reaches SIKOLA.
// Usage: node scripts/perf-cdp.mjs --tier=full|lite --phase=setup|frames|onboarding [--minutes=5] [--out=file.json]
import { writeFileSync } from 'node:fs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const tier = arg('tier', 'full');
const phase = arg('phase', 'frames');
const minutes = Number(arg('minutes', '5'));
const out = arg('out', null);
const ORIGIN = 'https://localhost';
const log = (m) => process.stderr.write(`perf-cdp: ${m}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- A minimal CDP client --------------------------------------------------------------
const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const target = targets.find((t) => t.type === 'page') ?? targets[0];
if (!target) throw new Error('no WebView target');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let nextId = 0;
const waiting = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(String(e.data));
  if (msg.id && waiting.has(msg.id)) {
    const { resolve, reject } = waiting.get(msg.id);
    waiting.delete(msg.id);
    msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
  }
};
const send = (method, params = {}, timeoutMs = 60000) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => waiting.has(id) && (waiting.delete(id), reject(new Error(`${method} timed out`))), timeoutMs);
  });
/** Runs `fn` (a function's source) in the page with JSON args; returns its value. */
const run = async (fn, ...args) => {
  const r = await send('Runtime.evaluate', { expression: `(${fn})(...${JSON.stringify(args)})`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const until = async (fn, args = [], timeoutMs = 30000, what = 'condition') => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await run(fn, ...args).catch(() => false)) return;
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${what}`);
};
const navigate = async (url) => {
  await send('Page.navigate', { url });
  await sleep(1500);
  await until(() => document.readyState === 'complete', [], 30000, 'load');
};

// ---- Page helpers (both languages: the emulator follows its own locale) -------------------
const clickText = (pattern, role = 'button') =>
  run(
    (p, r) => {
      const re = new RegExp(p);
      const els = [...document.querySelectorAll(r === 'tab' ? '[role="tab"]' : 'button, a, [role="button"]')];
      const el = els.find((e) => re.test((e.getAttribute('aria-label') || e.textContent || '').trim()));
      if (!el) return false;
      el.click();
      return true;
    },
    pattern,
    role,
  );
const has = (selector) => run((s) => !!document.querySelector(s), selector);
const PROBE = () => {
  if (!window.__probe) {
    window.__probe = true;
    window.__frames = [];
    let last = performance.now();
    const tick = (t) => {
      window.__frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  window.__frames = [];
  return true;
};
const takeFrames = () =>
  run(() => {
    const f = window.__frames.splice(0);
    const s = [...f].sort((a, b) => a - b);
    return { frames: f.length, max: Math.round(s.at(-1) ?? 0), p95: Math.round(s[Math.floor(s.length * 0.95)] ?? 0), over50: f.filter((g) => g > 50).length };
  });
const TABS = { Ringkasan: '^(Ringkasan|Overview)', Tugas: '^(Tugas|Tasks)', Kalender: '^(Kalender|Calendar)', Presensi: '^(Presensi|Attendance)', Lainnya: '^(Lainnya|More)' };
const tab = async (name) => {
  for (let i = 0; i < 4 && (await clickText('^(Kembali|Back)$')); i++) await sleep(300);
  if (!(await clickText(TABS[name], 'tab'))) throw new Error(`tab ${name} not found`);
};

const result = { tier, phase };
await send('Runtime.enable');
await send('Page.enable');

if (phase === 'probe') {
  // What the WebView shows (the update page check on an old WebView): its address and its text, once there is some.
  const end = Date.now() + 90_000;
  let seen = { href: '', text: '', bg: '' };
  while (Date.now() < end) {
    seen = await run(() => ({ href: location.href, text: document.body ? document.body.innerText.trim() : '', bg: document.body ? getComputedStyle(document.body).backgroundColor : '' })).catch(() => seen);
    if (seen.text) break;
    await sleep(1000);
  }
  Object.assign(result, seen);
}

if (phase === 'setup') {
  // The demo account with 50 tasks, signed in, this tier kept for the cold opens.
  await navigate(`${ORIGIN}/?demo=banyak&perf=${tier}`);
  await until(() => typeof window.__suloEnterDemo === 'function', [], 60000, 'demo hook');
  await run(() => window.__suloEnterDemo());
  await until(() => !!document.querySelector('[data-mascot-spot="hero"]'), [], 60000, 'Ringkasan');
  result.tierInPage = await run(() => document.documentElement.dataset.perf);
  log(`siap, tier ${result.tierInPage}`);
}

if (phase === 'frames') {
  await until(() => !!document.querySelector('[data-mascot-spot="hero"]'), [], 60000, 'Ringkasan');
  result.tierInPage = await run(() => document.documentElement.dataset.perf);
  await tab('Tugas');
  await sleep(1500);
  result.tugasCards = await run(() => document.querySelectorAll('main li').length);
  const box = await run(() => {
    const r = document.querySelector('main').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  await run(PROBE);
  for (const dir of [-1, 1, -1, 1]) await send('Input.synthesizeScrollGesture', { x: box.x, y: box.y, yDistance: dir * 2400, speed: 2400, gestureSourceType: 'touch' }, 30000);
  result.scrollTugas = await takeFrames();
  log('gulir selesai');

  await tab('Ringkasan');
  await sleep(1000);
  await run(PROBE);
  for (let r = 0; r < 2; r++)
    for (const name of Object.keys(TABS)) {
      await tab(name);
      await sleep(450);
    }
  result.switchTabs = await takeFrames();
  log('tab selesai');

  await tab('Lainnya');
  await sleep(500);
  await clickText('^(Pengaturan|Settings)');
  await sleep(1000);
  await run(() => {
    const b = [...document.querySelectorAll('button')].find((e) => /^(Animasi|Animation)/.test(e.textContent.trim()));
    b?.scrollIntoView({ block: 'center' });
  });
  await sleep(400);
  await run(PROBE);
  for (let r = 0; r < 3; r++) {
    await clickText('^(Animasi|Animation)');
    await sleep(600);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(600);
  }
  result.sheet = await takeFrames();
  log('sheet selesai');

  if (minutes > 0) {
    await send('Performance.enable');
    const metrics = async () => {
      await send('HeapProfiler.collectGarbage').catch(() => undefined);
      const { metrics: m } = await send('Performance.getMetrics');
      const get = (n) => m.find((x) => x.name === n)?.value ?? 0;
      return { heapMB: +(get('JSHeapUsedSize') / 1048576).toFixed(1), nodes: get('Nodes'), listeners: get('JSEventListeners') };
    };
    await tab('Ringkasan');
    await sleep(1000);
    const before = await metrics();
    const end = Date.now() + minutes * 60_000;
    const names = Object.keys(TABS);
    let switches = 0;
    while (Date.now() < end) {
      await tab(names[switches % names.length]);
      switches += 1;
      await sleep(700);
    }
    await tab('Ringkasan');
    await sleep(1500);
    result.memory = { minutes, switches, before, after: await metrics() };
    log('memori selesai');
  }
}

if (phase === 'onboarding') {
  // A fresh start: the stored data and the stand-in's sign-in forgotten.
  await run(async () => {
    localStorage.clear();
    await window.Capacitor?.Plugins?.Preferences?.clear?.();
    return true;
  });
  await navigate(`${ORIGIN}/?demo=banyak&perf=${tier}`);
  await until(() => [...document.querySelectorAll('h1, h2')].some((h) => /^(Semua tenggat|Every deadline)/.test(h.textContent.trim())), [], 30000, 'screen 1');
  await run(PROBE);
  await sleep(4000);
  result.onboarding = { 1: await takeFrames() };
  await clickText('^(Lanjut|Next)$');
  await sleep(3000);
  await clickText('^(Lanjut|Next)$');
  await sleep(4000);
  await clickText('^(Mulai|Get started)$');
  await sleep(1500);
  await run(PROBE);
  await clickText('^(Masuk|Sign in)');
  await until(() => [...document.querySelectorAll('h1, h2')].some((h) => /^(Pantau yang mana|Which ones)/.test(h.textContent.trim())), [], 60000, 'screen 6');
  result.onboarding[5] = await takeFrames();
  await sleep(800);
  await clickText('^(Lanjut|Next)$');
  await sleep(1200);
  await run(() => {
    const input = document.querySelector('input');
    if (!input) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Andi');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.blur();
    return true;
  });
  await sleep(800);
  await clickText('^(Lanjut|Next)$');
  await sleep(1500);
  await run(PROBE);
  // "Nanti saja": Android 13+ would otherwise put its own permission dialog over the WebView.
  await clickText('^(Nanti saja|Not now)$');
  await until(() => [...document.querySelectorAll('h1, h2')].some((h) => /^(Semua siap|All set)/.test(h.textContent.trim())), [], 30000, 'screen 9');
  await sleep(2500);
  result.onboarding[9] = await takeFrames();
  log('onboarding selesai');
}

ws.close();
const text = JSON.stringify(result, null, 2);
if (out) writeFileSync(out, text);
console.log(text);
process.exit(0);
