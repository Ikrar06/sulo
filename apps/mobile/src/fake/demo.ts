// pnpm mobile:web only: the extension's synthetic demo account (fixtures/guide,
// no real name, student number or email), every time moved so "now" is when
// the page opened, plus made-up attendance. Nothing leaves the browser.

import seed from '../../../extension/fixtures/guide/demo-seed.json';
import { demoPresensi } from '../../../extension/scripts/lib/demo-presensi.mjs';
import type { KeyValueStore, UnixSeconds } from '@sulo/core/types';

const TIME_KEY = /At$|^at$|^dueAt$/;

/** Moves every timestamp by `shift` seconds (the same rule as scripts/lib/demo-storage.mjs). */
export function shiftTimes(value: unknown, shift: number, key = ''): unknown {
  if (Array.isArray(value)) return value.map((v) => shiftTimes(v, shift));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shiftTimes(v, shift, k)]));
  return typeof value === 'number' && TIME_KEY.test(key) && value > 1e9 ? value + shift : value;
}

type Task = { dueAt: number | null; eventId?: number; name?: string };

/** ?demo=banyak: this many tasks (performance measurements, scripts/perf-measure.mjs). */
export const MANY_TASKS = 50;

/**
 * ?demo=aman: nothing overdue; ?demo=kosong: no task at all; ?demo=satu: a
 * single task, three hours overdue (worried, then the celebration when it
 * is done); ?demo=panjang: the hero 59 minutes late, the widest time text;
 * ?demo=banyak: 50 tasks over the next weeks (copies of the demo's own).
 * Without it, the demo account as it is (three overdue tasks).
 */
export function demoVariant(tasks: readonly Task[], now: UnixSeconds, variant: string | null): Task[] {
  if (variant === 'kosong') return [];
  if (variant === 'banyak' && tasks.length > 0) {
    return Array.from({ length: MANY_TASKS }, (_, i) => {
      const t = tasks[i % tasks.length]!;
      return { ...t, eventId: 900_000 + i, name: `${t.name ?? ''} ${Math.floor(i / tasks.length) + 1}`.trim(), dueAt: now + 3600 * (6 + i * 9) };
    });
  }
  if (variant === 'aman') return tasks.filter((t) => t.dueAt === null || t.dueAt >= now + 86_400);
  // ?demo=panjang: the widest time text (core formatters, check-countdown-fit.mjs) on the hero, then the rest upcoming.
  if (variant === 'panjang') {
    const upcoming = tasks.filter((t) => t.dueAt !== null && t.dueAt > now);
    return upcoming.length > 0 ? [{ ...upcoming[0]!, dueAt: now - 59 * 60 - 30 }, ...upcoming.slice(1)] : [];
  }
  if (variant === 'satu') {
    const first = tasks.find((t) => t.dueAt !== null && t.dueAt > now);
    return first ? [{ ...first, dueAt: now - 3 * 3600 }] : [];
  }
  return [...tasks];
}

export async function seedDemo(store: KeyValueStore, now: UnixSeconds): Promise<void> {
  const params = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
  // ?presensi=none: attendance not fetched yet.
  const data = { ...(shiftTimes(seed.storage, now - seed.generatedAt) as Record<string, unknown>), ...(params.get('presensi') === 'none' ? {} : demoPresensi(now)) };
  // The course without sessions opens on an empty detail (mobile only; the extension's demo stays as it is).
  const presensi = data['u:1:presensi'] as { details: Record<string, unknown>; recap: { fetchedAt: number } } | undefined;
  if (presensi) data['u:1:presensi'] = { ...presensi, details: { ...presensi.details, 9405: { fetchedAt: presensi.recap.fetchedAt, sessions: [] } } };
  data['u:1:tasks'] = demoVariant(data['u:1:tasks'] as Task[], now, params.get('demo'));
  // ?lang=en and ?nick=Ikrar: the language and the nickname for a screenshot.
  const prefs = (data['global:prefs'] ?? {}) as Record<string, unknown>;
  // ?grades=1: "Tampilkan nilai" on (NEOSIA screenshots).
  data['global:prefs'] = { ...prefs, locale: params.get('lang') ?? prefs.locale ?? 'auto', nickname: params.get('nick') ?? '', ...(params.get('grades') === '1' ? { gradesShown: true } : {}) };
  // ?release=available|required: a newer version in the config (M8e E3), synthetic and far above any real build (9.1.0).
  const release = params.get('release');
  if (release === 'available' || release === 'required') {
    const config = (data['global:remoteConfig'] ?? { enabled: true, minIntervalMinutes: 30, message: '', fetchedAt: now, okAt: now }) as Record<string, unknown>;
    data['global:remoteConfig'] = { ...config, mobile: { ...((config.mobile as object) ?? {}), release: { versionCode: 90100, versionName: '9.1.0', url: 'https://github.com/Ikrar06/sulo/releases/download/v9.1.0/sulo-9.1.0-android.apk', sha256: '3f1c9a0e5b7d24c86e19af03b25d7c4e8a96f10d2bc35e47a8f9061d2c4b7e5a', minVersionCode: release === 'required' ? 90100 : 0, notes: { id: 'Sulo sekarang terhubung ke Sipakamase: progres MKPK, kegiatan yang belum dikonversi, dan pengingat klaim nilai. Kabar SIKOLA juga sampai lebih cepat.', en: 'Sulo now connects to Sipakamase: MKPK progress, activities not yet converted and reminders to claim grades. SIKOLA news arrives faster too.' } } } };
  }
  // ?neosia=<stage> (src/fake/neosia.ts): NEOSIA connected, except for the invite.
  const neosia = params.get('neosia');
  if (neosia !== null && neosia !== 'invite') data['global:neosia'] = { enabled: true, changedAt: now - 86_400 };
  // Sipakamase connected with it (1.1.0); its data comes from the fake native store (src/fake/sipakamase.ts).
  if (neosia !== null && neosia !== 'invite') data['global:sipakamase'] = { enabled: true, changedAt: now - 3 * 86_400 };
  for (const [key, value] of Object.entries(data)) await store.set(key, value);
}
