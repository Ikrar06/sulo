// Shared by onboarding-shots.mjs and check-onboarding-layout.mjs: starts
// pnpm mobile:web, opens a phone-sized page and walks the onboarding
// (M8c.2), calling `at(name)` at each screen's resting state. The data is
// the synthetic demo account; nothing leaves the browser.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { MOBILE } from './env.mjs';

export const TEXT = {
  id: { intro1: 'Semua tenggat, satu tempat', next: 'Lanjut', start: 'Mulai', signin: 'Masuk', courses: 'Pantau yang mana?', allow: 'Izinkan pengingat', later: 'Nanti saja', done: 'Semua siap.', open: 'Buka Sulo', skip: 'Lewati', back: 'Kembali' },
  en: { intro1: 'Every deadline, one place', next: 'Next', start: 'Get started', signin: 'Sign in', courses: 'Which ones to follow?', allow: 'Allow reminders', later: 'Not now', done: 'All set.', open: 'Open Sulo', skip: 'Skip', back: 'Back' },
};

export async function startServer(port) {
  const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--port', String(port), '--strictPort'], { cwd: MOBILE, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
  await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes(String(port)) && resolve()));
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  return { browser, stop: async () => (await browser.close(), process.kill(-server.pid)) };
}

/** Frame gaps since the last take, from a rAF loop in the page. */
const FRAME_PROBE = () => {
  window.__frames = [];
  let last = performance.now();
  const tick = (t) => {
    window.__frames.push(t - last);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
export const takeFrames = (page) =>
  page.evaluate(() => {
    const f = window.__frames.splice(0);
    return { frames: f.length, over33: f.filter((g) => g > 33.4).length, max: Math.round(Math.max(0, ...f)) };
  });

/** Mascots drawn and visible (opacity above 0 up the tree): there must never be two. */
export const MASCOTS = () =>
  [...document.querySelectorAll('svg[viewBox="-40 -60 590 600"]')].filter((svg) => {
    for (let n = svg; n; n = n.parentElement) if (getComputedStyle(n).opacity === '0' || getComputedStyle(n).display === 'none' || getComputedStyle(n).visibility === 'hidden') return false;
    return svg.getBoundingClientRect().width > 0;
  }).length;

export async function openPage(browser, port, { width, height, scheme = 'light', query = '', lang = 'id', reduced = false, zoom = 1, video = null, cpu = 1, probe = false }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === 'en' ? 'en-US' : 'id-ID', colorScheme: scheme, reducedMotion: reduced ? 'reduce' : 'no-preference', ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}) });
  if (zoom !== 1) await context.addInitScript((z) => document.addEventListener('DOMContentLoaded', () => document.documentElement.style.setProperty('--m-tz', String(z))), zoom);
  if (probe) await context.addInitScript(FRAME_PROBE);
  const page = await context.newPage();
  if (cpu > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.goto(`http://localhost:${port}/${query}`);
  return { context, page };
}

/**
 * Walks the flow. `at(name, page)` is called at each resting state.
 * opts: lang, stopAt ('signin' | 'preparing'), signinClick, noneTicked,
 * noName, denied, keyboard (px the viewport loses on the nickname screen).
 */
export async function walk(page, at, opts = {}) {
  const t = TEXT[opts.lang ?? 'id'];
  const button = (name) => page.getByRole('button', { name, exact: true });
  const slow = opts.slow ?? 1;
  const wait = (ms) => page.waitForTimeout(ms * slow);
  /** Called the moment a screen is entered, before its scene has played (frame sheets). */
  const enter = async (name) => opts.onEnter && (await opts.onEnter(name, page));
  await enter('0');
  await wait(1350);
  await at('0-pembuka', page);
  await page.getByRole('heading', { name: t.intro1 }).waitFor({ timeout: 15000 });
  await enter('1');
  await wait(4100);
  await at('1-tenggat', page);
  await button(t.next).click();
  await enter('2');
  await wait(2900);
  await at('2-pengingat', page);
  await button(t.next).click();
  await enter('3');
  await wait(4000);
  await at('3-privasi', page);
  await button(t.start).click();
  await wait(1500);
  await at('4-masuk', page);
  if (opts.stopAt === 'signin') {
    if (opts.signinClick) {
      await button(t.signin).click();
      await wait(600);
      await at('4b-keadaan', page);
    }
    return;
  }
  await button(t.signin).click();
  await enter('5');
  if (opts.stopAt === 'preparing') {
    await wait(1700);
    await at('5-menyiapkan', page);
    return;
  }
  // The moment the last stage has landed, before the screen moves on.
  await page.waitForFunction(() => document.querySelectorAll('.onb-frame [role="progressbar"] .onb-seg.is-on').length === 4, null, { timeout: 15000 });
  await page.waitForTimeout(380);
  await at('5-menyiapkan', page);
  await page.getByRole('heading', { name: t.courses }).waitFor({ timeout: 15000 });
  await wait(800);
  await at('6-mata-kuliah', page);
  if (opts.noneTicked) {
    const ticked = page.getByRole('checkbox', { checked: true });
    while ((await ticked.count()) > 0) await ticked.first().click();
    await wait(500);
    await at('6b-nol-dipilih', page);
    return;
  }
  await button(t.next).click();
  await wait(700);
  if (opts.keyboard) await page.setViewportSize({ width: page.viewportSize().width, height: page.viewportSize().height - opts.keyboard });
  if (opts.noName) {
    await wait(300);
    await at('7b-tanpa-nama', page);
  } else {
    await page.getByRole('textbox').fill('Andi');
    await wait(700);
    await at('7-nama', page);
  }
  if (opts.keyboard) await page.setViewportSize({ width: page.viewportSize().width, height: page.viewportSize().height + opts.keyboard });
  await button(t.next).click();
  await wait(1300);
  await at('8-pengingat', page);
  await button(opts.denied ? t.later : t.allow).click();
  await page.getByRole('heading', { name: t.done }).waitFor({ timeout: 15000 });
  await enter('9');
  await wait(2300);
  await at('9-selesai', page);
  await button(t.open).click();
  await page.locator('[data-mascot-spot="hero"]').waitFor({ timeout: 15000 });
  await wait(1500);
  await at('10-ringkasan', page);
}
