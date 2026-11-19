// The WebView guard inline in index.html, run exactly as shipped (extracted
// from the file) against user agents, in a bare context with only navigator,
// location and stop(): nothing else exists to send or store anything with.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import config from '../capacitor.config';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = /<script id="sulo-webview-guard">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

const android = (chrome: string) => `Mozilla/5.0 (Linux; Android 8.0.0; Pixel 2 Build/OPR6; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 ${chrome} Mobile Safari/537.36`;

function guard(userAgent: string) {
  const replaced: string[] = [];
  let stopped = false;
  const window: Record<string, unknown> = {
    stop: () => (stopped = true),
    location: { replace: (url: string) => replaced.push(url) },
  };
  runInNewContext(script, { window, navigator: { userAgent }, String, parseInt });
  return { replaced, stopped, flagged: window.__suloWebViewTooOld === true };
}

describe('WebView guard in index.html', () => {
  it('is in the head, before the main bundle', () => {
    expect(script).not.toBe('');
    expect(html.indexOf('sulo-webview-guard')).toBeLessThan(html.indexOf('src/main.tsx'));
    expect(html.indexOf('sulo-webview-guard')).toBeLessThan(html.indexOf('</head>'));
  });

  it('uses the same minimum as capacitor.config.ts', () => {
    expect(script).toContain(`var MIN = ${config.android?.minWebViewVersion};`);
  });

  it('Chrome/69 goes to the update page before anything loads', () => {
    expect(guard(android('Chrome/69.0.3497.100'))).toEqual({ replaced: ['/perlu-pembaruan.html'], stopped: true, flagged: true });
  });

  it('Chrome/110 goes to the update page', () => {
    expect(guard(android('Chrome/110.0.5481.153')).replaced).toEqual(['/perlu-pembaruan.html']);
  });

  it('Chrome/111 runs the app', () => {
    expect(guard(android('Chrome/111.0.5563.116'))).toEqual({ replaced: [], stopped: false, flagged: false });
    expect(guard(android('Chrome/140.0.7339.51')).replaced).toEqual([]);
  });

  it('an Android user agent without a Chrome version goes to the update page', () => {
    expect(guard('Mozilla/5.0 (Linux; Android 10; ELE-L29; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Mobile Safari/537.36').replaced).toEqual(['/perlu-pembaruan.html']);
    expect(guard('').replaced).toEqual([]);
  });

  it('a Huawei WebView is judged by its Chromium version too', () => {
    const huawei = (v: string) => `Mozilla/5.0 (Linux; Android 10; HMA-L29; HMSCore 6.11.0.302) AppleWebKit/537.36 (KHTML, like Gecko) ${v} HuaweiBrowser/14.0.0.331 Mobile Safari/537.36`;
    expect(guard(huawei('Chrome/99.0.4844.88')).replaced).toEqual(['/perlu-pembaruan.html']);
    expect(guard(huawei('Chrome/114.0.5735.196')).replaced).toEqual([]);
  });

  it('leaves a desktop browser alone (development in web mode)', () => {
    expect(guard('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15').replaced).toEqual([]);
  });

  it('is plain ES5 that sends and stores nothing', () => {
    for (const modern of [/=>/, /\blet\b/, /\bconst\b/, /`/, /\bclass\b/, /\.\.\./]) expect(script).not.toMatch(modern);
    for (const io of [/fetch/, /XMLHttpRequest/, /sendBeacon/, /Storage/, /cookie/, /indexedDB/, /Image\(/]) expect(script).not.toMatch(io);
  });
});

describe('update page', () => {
  const page = readFileSync(new URL('../public/perlu-pembaruan.html', import.meta.url), 'utf8');
  it('has the app-store line in both languages, hidden until the Play Store link opens nothing', () => {
    expect(page).toContain('<p id="store" class="note" hidden>Perbarui lewat toko aplikasi HP-mu.</p>');
    expect(page).toContain("Update it from your phone's app store.");
  });
});
