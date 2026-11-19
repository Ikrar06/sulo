#!/usr/bin/env node
// Contrast of the dashboard's colored chips, cells and the support button, in both themes
// (WCAG 2 ratio). Reads the theme tokens from packages/ui/src/tokens/palette.css and mixes
// colors the way CSS color-mix(in oklch) does. No dependencies.
// Usage: node scripts/contrast.mjs   (exit 1 when any pair is below 4.5:1)


import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../../packages/ui/src/tokens/palette.css', import.meta.url), 'utf8');

/** Tokens of a block whose selector matches `re` (first match). */
function block(re) {
  const m = re.exec(css);
  if (!m) throw new Error(`block not found: ${re}`);
  const start = css.indexOf('{', m.index) + 1;
  let depth = 1;
  let i = start;
  for (; i < css.length && depth > 0; i++) depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0;
  return Object.fromEntries([...css.slice(start, i).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((x) => [x[1], x[2]]));
}
const brand = { ...block(/:root\s*\{\s*\n\s*--brand-amber/), ...block(/:root\s*\{\s*\n\s*--course-1/) };
const dark = { ...brand, ...block(/\[data-theme="dark"\]\s*\{[^}]*--bg:\s*#0b0b0e/), ...block(/\[data-theme="dark"\]\s*\{[^}]*--layer-screen/) };
const light = { ...brand, ...block(/\[data-theme="light"\]\s*\{/) };
/** The course colors, the same in both themes. */
const MOBILE_COURSE = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => brand[`course-${n}`]);

// sRGB <-> OKLab (Björn Ottosson), OKLCH mixing as CSS Color 4.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function oklab([r, g, b]) {
  [r, g, b] = [r, g, b].map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function rgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((c) => Math.min(1, Math.max(0, fromLin(c))));
}
const lch = ([L, a, b]) => [L, Math.hypot(a, b), Math.atan2(b, a)];
const lab = ([L, C, h]) => [L, C * Math.cos(h), C * Math.sin(h)];
/** color-mix(in oklch, a p%, b): shorter hue arc; an achromatic side takes the other's hue. */
function mix(a, b, p) {
  const [A, B] = [lch(oklab(a)), lch(oklab(b))];
  if (A[1] < 1e-4) A[2] = B[2];
  if (B[1] < 1e-4) B[2] = A[2];
  let dh = B[2] - A[2];
  if (dh > Math.PI) dh -= 2 * Math.PI;
  if (dh < -Math.PI) dh += 2 * Math.PI;
  const t = 1 - p;
  return rgb(lab([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + dh * t]));
}
/** Text drawn with opacity over a background. */
const over = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
const lum = (c) => c.map(toLin).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const WHITE = [1, 1, 1];

// The card layers (palette.css): screen, card, inset per theme.
const mobileLayers = (theme) => {
  const t = theme === 'terang' ? light : dark;
  return { screen: hex(t['layer-screen']), card: hex(t['layer-card']), inset: hex(t['layer-inset']) };
};

function pairs(t, theme) {
  const c = (n) => hex(t[n]);
  // Support button (packages/ui/src/ui/support-button.css): same values as the CSS.
  const orange = c('brand-orange');
  const supportHover = theme === 'terang' ? mix(orange, c('ink'), 0.92) : mix(orange, WHITE, 0.88);
  const supportMuted = mix(c('ink'), orange, 0.85);
  // Accent text (countdown numbers, components/dashboard/dashboard.css).
  const accentText = theme === 'terang' ? mix(orange, c('ink'), 0.75) : orange;
  // Calendar categories (components/dashboard/dashboard.css, .db-cat-*).
  const cat = { akademik: c('muted'), ujian: c('brand-amber'), administrasi: c('urgency-week'), libur: c('danger'), wisuda: c('course-7') };
  const bar = (k) => mix(cat[k], c('surface'), 0.18);
  const period = mix(cat.libur, c('surface'), 0.05);
  const ev = c('surface-raised');
  const exam = mix(c('brand-amber'), c('surface'), 0.28);
  return {
    before: {
      'chip acara (bulan lain, opacity 55%)': [over(c('text'), c('bg'), 0.55), over(ev, c('bg'), 0.55)],
      'chip wisuda (bulan lain, opacity 55%)': [over(c('text'), c('bg'), 0.55), over(ev, c('bg'), 0.55)],
      'chip ujian (bulan lain, opacity 55%)': [over(c('text'), c('bg'), 0.55), over(exam, c('bg'), 0.55)],
    },
    after: {
      'peta beban tingkat 0': [c('text'), c('surface-raised')],
      'angka hitung mundur (--accent-text di --surface)': [accentText, c('surface')],
      'angka hitung mundur (--accent-text di --bg)': [accentText, c('bg')],
      'keterlambatan (--urgency-overdue di --surface)': [c('urgency-overdue'), c('surface')],
      ...Object.fromEntries(Object.keys(cat).map((k) => [`kalender: teks bar ${k} (--text di tint 18%)`, [c('text'), bar(k)]])),
      'kalender: label periode (--muted di tint 5%)': [c('muted'), period],
      'kalender: angka tanggal di periode (--text di tint 5%)': [c('text'), period],
      'kalender: angka libur nasional (--danger di --surface)': [c('danger'), c('surface')],
      'kalender: angka libur di periode (--danger di tint 5%)': [c('danger'), period],
      'kalender: angka di luar bulan (--muted di --surface)': [c('muted'), c('surface')],
      'kalender: angka hari ini (--ink di oranye)': [c('ink'), orange],
      'kalender: chip filter mati (--muted di --bg)': [c('muted'), c('bg')],
      'kalender: hari dipilih (--text di --surface-raised)': [c('text'), c('surface-raised')],
      'notice status: teks (--text di tint 8%)': [c('text'), mix(c('status-stale'), c('surface'), 0.08)],
      'sidebar: teks aktif (--text di --surface-raised)': [c('text'), c('surface-raised')],
      'sidebar: teks hover (--text di setengah --surface-raised)': [c('text'), mix(c('surface-raised'), c('bg'), 0.5)],
      'sidebar: teks tidak aktif (--muted di --bg)': [c('muted'), c('bg')],
      'checkbox belum dicentang: tepi (--control-border di --surface, min 3:1)': [c('control-border'), c('surface')],
      'checkbox belum dicentang: tepi (--control-border di --surface-raised, min 3:1)': [c('control-border'), c('surface-raised')],
      // Jadwal class blocks (components/dashboard/pages/Jadwal.tsx): --text on ~18% course tint, on the plain column and on today's column.
      ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`jadwal: blok mata kuliah ${n} (--text di tint 18%)`, [c('text'), mix(c(`course-${n}`), c('surface'), 0.18)]])),
      'jadwal: blok belum terpetakan (--text di tint --muted 18%)': [c('text'), mix(c('muted'), c('surface'), 0.18)],
      'jadwal: tepi blok belum terpetakan (--muted di --surface, min 3:1)': [c('muted'), c('surface')],
      'jadwal: tepi blok belum terpetakan (--muted di kolom hari ini --surface-raised, min 3:1)': [c('muted'), c('surface-raised')],
      // Load map (Tahap 2, e5): the neutral scale, components/dashboard/dashboard.css .db-load-*.
      'peta beban 1 (--text di campuran 12%)': [c('text'), mix(c('text'), c('surface'), 0.12)],
      'peta beban 2 (--text di campuran 26%)': [c('text'), mix(c('text'), c('surface'), 0.26)],
      'peta beban 3 (--surface di campuran 58%)': [c('surface'), mix(c('text'), c('surface'), 0.58)],
      'peta beban 4 (--surface di campuran 80%)': [c('surface'), mix(c('text'), c('surface'), 0.8)],
      // The Android app's card layers (M8c.1).
      ...(() => {
        const L = mobileLayers(theme);
        return {
          'mobile kartu: teks (--text di kartu)': [c('text'), L.card],
          'mobile kartu: teks pendukung (--muted di kartu)': [c('muted'), L.card],
          'mobile kartu: teks pendukung (--muted di latar layar)': [c('muted'), L.screen],
          'mobile kartu: chip/sisipan (--text di sisipan)': [c('text'), L.inset],
          'mobile kartu: teks pendukung di sisipan (--muted di sisipan)': [c('muted'), L.inset],
          'mobile kartu: hitung mundur (--accent-text di kartu)': [accentText, L.card],
          'mobile kartu: terlambat (--urgency-overdue di kartu)': [c('urgency-overdue'), L.card],
          'mobile kartu: tombol utama (--ink di oranye)': [c('ink'), orange],
          'mobile kartu: chip mata kuliah 16% (--text di tint)': [c('text'), mix(c('course-1'), L.card, 0.16)],
          // The phone keeps the bright course set in both themes (apps/mobile/src/tokens.css).
          ...Object.fromEntries(MOBILE_COURSE.map((h, i) => [`mobile: inisial di ubin mata kuliah ${i + 1} (teks gelap di warna solid)`, [hex('#111114'), hex(h)]])),
          ...Object.fromEntries(MOBILE_COURSE.map((h, i) => [`mobile: chip mata kuliah ${i + 1} (--text di tint 18%)`, [c('text'), mix(hex(h), L.card, 0.18)]])),
          ...Object.fromEntries(MOBILE_COURSE.map((h, i) => [`mobile: ikon di tint mata kuliah ${i + 1} (campuran 55%, min 3:1)`, [mix(hex(h), c('text'), 0.55), mix(hex(h), L.card, 0.18)]])),
          'mobile kartu: titik tab aktif (oranye di kartu, min 3:1)': [orange, L.card],
          'mobile kartu: tab tidak aktif (--muted di kartu)': [c('muted'), L.card],
          'mobile kartu: lingkaran centang (--muted di kartu, min 3:1)': [c('muted'), L.card],
        };
      })(),
      // The Android app (apps/mobile, M8c.1): new pairs on its dense screens.
      'mobile: teks pendukung 12/13 (--muted di --surface)': [c('muted'), c('surface')],
      'mobile: teks pendukung 12/13 (--muted di --bg)': [c('muted'), c('bg')],
      'mobile: judul grup sticky (--muted di --bg)': [c('muted'), c('bg')],
      'mobile: tab tidak aktif (--muted di --surface)': [c('muted'), c('surface')],
      'mobile: badge Tugas (--text di --surface-raised)': [c('text'), c('surface-raised')],
      'mobile: segmen aktif (--text di --surface)': [c('text'), c('surface')],
      'mobile: segmen tidak aktif (--muted di --surface-raised)': [c('muted'), c('surface-raised')],
      'mobile: chip/tanggal dipilih (--bg di --text)': [c('bg'), c('text')],
      'mobile: waktu tenggat besok (--urgency-soon di --surface)': [c('urgency-soon'), c('surface')],
      'mobile: waktu tenggat 3 hari (--urgency-week di --surface)': [c('urgency-week'), c('surface')],
      'mobile: hari ini di kalender bulan (--accent-text di --surface)': [accentText, c('surface')],
      'mobile: baris ditekan (--text di --surface-raised)': [c('text'), c('surface-raised')],
      'tombol traktir: teks dan cangkir (--ink di oranye)': [c('ink'), orange],
      'tombol traktir hover: teks dan cangkir': [c('ink'), supportHover],
      'tombol traktir: panah muted': [supportMuted, orange],
      'tombol traktir hover: panah muted': [supportMuted, supportHover],
    },
  };
}

let failed = false;
for (const [theme, tokens] of [['gelap', dark], ['terang', light]]) {
  const { before, after } = pairs(tokens, theme);
  console.log(`\nTema ${theme}`);
  for (const [name, [fg, bg]] of Object.entries(before)) console.log(`  sebelum  ${ratio(fg, bg).toFixed(2)}:1  ${name}`);
  for (const [name, [fg, bg]] of Object.entries(after)) {
    const r = ratio(fg, bg);
    // Non-text edges (WCAG 1.4.11) need 3:1; every text pair needs 4.5:1.
    const min = name.includes('min 3:1') ? 3 : 4.5;
    if (r < min) failed = true;
    console.log(`  sesudah  ${r.toFixed(2)}:1  ${name}${r < min ? `  << di bawah ${min}` : ''}`);
  }
}
process.exit(failed ? 1 : 0);
