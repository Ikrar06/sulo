// Cases for the worker's own config reading (core watch/remote.ts and the
// Kotlin WatchRemote), stored in the shared vectors.json by
// watch-vectors.test.ts. `want` is written by hand: what the rule says.
import type { ConfigRead, RemoteDecision, RemoteState, WorkerConfig } from '@sulo/core/watch/remote';

const ON: WorkerConfig['keepAlive'] = { enabled: true, dayIntervalMinutes: 20, nightIntervalMinutes: 110, radarEvery: 3 };
const ok = (keepAlive: Partial<WorkerConfig['keepAlive']> = {}, globalEnabled = true): ConfigRead => ({ kind: 'ok', config: { globalEnabled, keepAlive: { ...ON, ...keepAlive } } });
const failed: ConfigRead = { kind: 'failed' };
const base = { enabled: true, minIntervalMinutes: 30, message: '' };
const body = (v: unknown) => JSON.stringify(v);
const ka = (k: unknown) => body({ ...base, mobile: { backgroundKeepAlive: k } });
const REL = { versionCode: 906, versionName: '0.9.6', url: 'https://github.com/Ikrar06/sulo/releases/download/v0.9.6/sulo-0.9.6-android.apk', sha256: 'a'.repeat(64), minVersionCode: 905, notes: { id: 'Perbaikan keamanan.', en: 'A security fix.' } };

export const remoteParseCases: { name: string; status: number; body: string | null; want: ConfigRead }[] = [
  { name: 'no-mobile-section', status: 200, body: body(base), want: ok() },
  { name: 'unknown-keys-ignored', status: 200, body: body({ ...base, future: { x: 1 }, mobile: { other: true } }), want: ok() },
  { name: 'keepalive-off', status: 200, body: ka({ enabled: false, dayIntervalMinutes: 30 }), want: ok({ enabled: false, dayIntervalMinutes: 30 }) },
  { name: 'global-off', status: 200, body: body({ ...base, enabled: false }), want: ok({}, false) },
  { name: 'tuned', status: 200, body: ka({ enabled: true, dayIntervalMinutes: 15, nightIntervalMinutes: 110, radarEvery: 6 }), want: ok({ dayIntervalMinutes: 15, nightIntervalMinutes: 110, radarEvery: 6 }) },
  { name: 'out-of-range-take-defaults', status: 200, body: ka({ enabled: true, dayIntervalMinutes: 14, nightIntervalMinutes: 111, radarEvery: 0 }), want: ok() },
  { name: 'non-integer-takes-default', status: 200, body: ka({ dayIntervalMinutes: 30.5, radarEvery: 2.5 }), want: ok() },
  { name: 'wrong-type-interval-takes-default', status: 200, body: ka({ dayIntervalMinutes: '30' }), want: ok() },
  { name: 'switch-not-boolean', status: 200, body: ka({ enabled: 'false' }), want: failed },
  { name: 'switch-null', status: 200, body: ka({ enabled: null }), want: failed },
  { name: 'keepalive-not-object', status: 200, body: ka('off'), want: failed },
  { name: 'keepalive-array', status: 200, body: ka([]), want: failed },
  { name: 'mobile-not-object', status: 200, body: body({ ...base, mobile: 'x' }), want: failed },
  // 1.1.0: one list of switches for every section (core remote/switches.ts).
  { name: 'extension-switch-not-boolean', status: 200, body: body({ ...base, extension: { backgroundWatch: { enabled: 'no' } } }), want: failed },
  { name: 'extension-not-object', status: 200, body: body({ ...base, extension: 1 }), want: failed },
  { name: 'sipakamase-keep-not-boolean', status: 200, body: body({ ...base, sources: { sipakamase: { keep: 0 } } }), want: failed },
  { name: 'sipakamase-enabled-null', status: 200, body: body({ ...base, sources: { sipakamase: { enabled: null } } }), want: failed },
  { name: 'sipakamase-not-object', status: 200, body: body({ ...base, sources: { sipakamase: true } }), want: failed },
  { name: 'neosia-visit-not-boolean', status: 200, body: body({ ...base, sources: { neosia: { scheduledVisit: 'yes' } } }), want: failed },
  { name: 'sources-not-object', status: 200, body: body({ ...base, sources: [] }), want: failed },
  { name: 'sources-switches-off', status: 200, body: body({ ...base, sources: { sipakamase: { enabled: false, keep: false }, neosia: { scheduledVisit: false } }, extension: { backgroundWatch: { enabled: false } } }), want: { kind: 'ok', config: { globalEnabled: true, keepAlive: ON, sipakamaseKeep: false } } },
  { name: 'sipakamase-keep-off-only', status: 200, body: body({ ...base, sources: { sipakamase: { keep: false } } }), want: { kind: 'ok', config: { globalEnabled: true, keepAlive: ON, sipakamaseKeep: false } } },
  { name: 'sipakamase-on', status: 200, body: body({ ...base, sources: { sipakamase: { enabled: true, keep: true, keepIntervalMinutes: 360 } } }), want: ok() },
  { name: 'missing-enabled', status: 200, body: body({ minIntervalMinutes: 30 }), want: failed },
  { name: 'missing-min-interval', status: 200, body: body({ enabled: true }), want: failed },
  { name: 'enabled-not-boolean', status: 200, body: body({ ...base, enabled: 'true' }), want: failed },
  { name: 'min-interval-negative', status: 200, body: body({ ...base, minIntervalMinutes: -1 }), want: failed },
  { name: 'min-interval-fraction', status: 200, body: body({ ...base, minIntervalMinutes: 2.5 }), want: failed },
  { name: 'message-missing-is-fine', status: 200, body: body({ enabled: true, minIntervalMinutes: 0 }), want: ok() },
  { name: 'message-too-long', status: 200, body: body({ ...base, message: 'x'.repeat(501) }), want: failed },
  { name: 'message-not-string', status: 200, body: body({ ...base, message: 5 }), want: failed },
  { name: 'broken-json', status: 200, body: '{"enabled": tru', want: failed },
  { name: 'json-array', status: 200, body: '[]', want: failed },
  { name: 'json-null', status: 200, body: 'null', want: failed },
  { name: 'empty-body', status: 200, body: '', want: failed },
  { name: 'no-body', status: 200, body: null, want: failed },
  { name: 'not-modified', status: 304, body: null, want: { kind: 'not_modified' } },
  { name: 'not-found', status: 404, body: '<html>', want: failed },
  { name: 'server-error', status: 503, body: null, want: failed },
  { name: 'network-failure', status: 0, body: null, want: failed },
  // M8e E3: a valid mobile.release carries its minVersionCode to the worker; anything invalid in it is ignored (never a failed read).
  { name: 'release-with-min', status: 200, body: body({ ...base, mobile: { release: REL } }), want: { kind: 'ok', config: { globalEnabled: true, keepAlive: ON, minVersionCode: 905 } } },
  { name: 'release-without-min', status: 200, body: body({ ...base, mobile: { release: { ...REL, minVersionCode: undefined } } }), want: ok() },
  { name: 'release-min-zero', status: 200, body: body({ ...base, mobile: { release: { ...REL, minVersionCode: 0 } } }), want: ok() },
  { name: 'release-url-elsewhere-ignored', status: 200, body: body({ ...base, mobile: { release: { ...REL, url: 'https://example.com/sulo.apk' } } }), want: ok() },
  { name: 'release-url-other-owner-ignored', status: 200, body: body({ ...base, mobile: { release: { ...REL, url: 'https://github.com/someone/sulo/releases/download/v0.9.6/sulo.apk' } } }), want: ok() },
  { name: 'release-url-dot-segment-ignored', status: 200, body: body({ ...base, mobile: { release: { ...REL, url: 'https://github.com/Ikrar06/../releases/download/v0.9.6/sulo.apk' } } }), want: ok() },
  { name: 'release-url-not-an-asset-ignored', status: 200, body: body({ ...base, mobile: { release: { ...REL, url: 'https://github.com/Ikrar06/sulo/releases/tag/v0.9.6' } } }), want: ok() },
  { name: 'release-min-above-version-ignored', status: 200, body: body({ ...base, mobile: { release: { ...REL, minVersionCode: 907 } } }), want: ok() },
  { name: 'release-bad-sha-ignored', status: 200, body: body({ ...base, mobile: { release: { ...REL, sha256: 'abc' } } }), want: ok() },
  { name: 'release-name-with-suffix-ignored', status: 200, body: body({ ...base, mobile: { release: { ...REL, versionName: '0.9.6-beta' } } }), want: ok() },
  { name: 'release-min-not-integer-ignored', status: 200, body: body({ ...base, mobile: { release: { ...REL, minVersionCode: 905.5 } } }), want: ok() },
  { name: 'release-with-keepalive-off', status: 200, body: body({ ...base, mobile: { backgroundKeepAlive: { enabled: false }, release: REL } }), want: { kind: 'ok', config: { globalEnabled: true, keepAlive: { ...ON, enabled: false }, minVersionCode: 905 } } },
];

const NOW = 1_800_000_000;
const H = 3600;
const D = 86_400;

export const remoteReadDueCases: { lastReadAt: number; now: number; want: boolean }[] = [
  { lastReadAt: 0, now: NOW, want: true },
  { lastReadAt: NOW - 6 * H, now: NOW, want: true },
  { lastReadAt: NOW - 6 * H + 1, now: NOW, want: false },
  { lastReadAt: NOW - 60, now: NOW, want: false },
];

const cfg = (keepAlive: Partial<WorkerConfig['keepAlive']> = {}, globalEnabled = true): WorkerConfig => ({ globalEnabled, keepAlive: { ...ON, ...keepAlive } });
const state = (s: Partial<RemoteState>): RemoteState => ({ now: NOW, lastAppAt: NOW - H, configOkAt: NOW - H, config: cfg(), ...s });
const hold = (reason: 'no_config' | 'stale_config' | 'update_required' | 'global_off' | 'keepalive_off'): RemoteDecision => ({ action: 'hold', reason, intervalMin: 360 });

export const remoteDecideCases: { name: string; state: RemoteState; want: RemoteDecision }[] = [
  { name: 'on-defaults', state: state({}), want: { action: 'check', schedule: { dayIntervalMin: 20, nightIntervalMin: 110, softDayIntervalMin: 40, radarEvery: 3 } } },
  { name: 'on-config-intervals-used-directly', state: state({ config: cfg({ dayIntervalMinutes: 50, nightIntervalMinutes: 90, radarEvery: 1 }) }), want: { action: 'check', schedule: { dayIntervalMin: 50, nightIntervalMin: 90, softDayIntervalMin: 50, radarEvery: 1 } } },
  { name: 'global-off', state: state({ config: cfg({}, false) }), want: hold('global_off') },
  { name: 'keepalive-off', state: state({ config: cfg({ enabled: false }) }), want: hold('keepalive_off') },
  { name: 'never-read', state: state({ config: null, configOkAt: 0 }), want: hold('no_config') },
  { name: 'config-without-success-time', state: state({ configOkAt: 0 }), want: hold('no_config') },
  { name: 'no-read-72h', state: state({ configOkAt: NOW - 72 * H }), want: hold('stale_config') },
  { name: 'read-just-under-72h', state: state({ configOkAt: NOW - 72 * H + 1 }), want: { action: 'check', schedule: { dayIntervalMin: 20, nightIntervalMin: 110, softDayIntervalMin: 40, radarEvery: 3 } } },
  { name: 'app-not-opened-7-days', state: state({ lastAppAt: NOW - 7 * D }), want: { action: 'paused' } },
  { name: 'app-opened-just-under-7-days', state: state({ lastAppAt: NOW - 7 * D + 1 }), want: { action: 'check', schedule: { dayIntervalMin: 20, nightIntervalMin: 110, softDayIntervalMin: 40, radarEvery: 3 } } },
  { name: 'paused-before-stale', state: state({ lastAppAt: NOW - 8 * D, configOkAt: NOW - 5 * D }), want: { action: 'paused' } },
  { name: 'paused-even-when-off', state: state({ lastAppAt: NOW - 8 * D, config: cfg({}, false) }), want: { action: 'paused' } },
  // M8e E3: below a valid release's minVersionCode nothing goes to SIKOLA (the chain keeps reading the config).
  { name: 'update-required', state: { ...state({ config: { ...cfg({}), minVersionCode: 905 } }), installedCode: 904 }, want: hold('update_required') },
  { name: 'update-required-even-when-off', state: { ...state({ config: { ...cfg({}, false), minVersionCode: 905 } }), installedCode: 900 }, want: hold('update_required') },
  { name: 'at-min-version-checks', state: { ...state({ config: { ...cfg({}), minVersionCode: 905 } }), installedCode: 905 }, want: { action: 'check', schedule: { dayIntervalMin: 20, nightIntervalMin: 110, softDayIntervalMin: 40, radarEvery: 3 } } },
  { name: 'paused-before-update-required', state: { ...state({ lastAppAt: NOW - 8 * D, config: { ...cfg({}), minVersionCode: 905 } }), installedCode: 900 }, want: { action: 'paused' } },
  { name: 'stale-before-update-required', state: { ...state({ configOkAt: NOW - 72 * H, config: { ...cfg({}), minVersionCode: 905 } }), installedCode: 900 }, want: hold('stale_config') },
];
