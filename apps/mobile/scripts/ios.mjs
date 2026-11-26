#!/usr/bin/env node
// pnpm ios:<perintah>: iPhone work from VS Code and the terminal, without opening Xcode
// (docs/ios/XCODE-KAPAN.md says when Xcode itself is still needed).
//
//   sync     web build, cap sync ios, project sync (scripts/ios-project.mjs)
//   sim      sync, build for the simulator, install and open it   [--device="iPhone 17"]
//   live     the simulator loading the UI from Vite on this Mac (localhost only, development only)
//   device   owner only: sign with the Personal Team (ios/App/Local.xcconfig), install and open on the iPhone
//   ipa      unsigned archive -> .output/sulo-<versi>-ios[-sintetis].ipa, then scripts/ios-verify.mjs
//   log      the app's log from the simulator, or from the iPhone with --iphone
//   doctor   Xcode, simulator, iPhone, signing team, disk
//
// --data=sintetis (default in Fase 1) builds the web app with synthetic data: no request to SIKOLA,
// NEOSIA, Sipakamase or anywhere else. --data=debug and --data=rilis need the native session (Fase 2).
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statfsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IOS_APP, PBXPROJ, syncProject } from './ios-project.mjs';

const MOBILE = new URL('..', import.meta.url).pathname;
const ROOT = new URL('../../..', import.meta.url).pathname;
const VERSION = JSON.parse(readFileSync(join(MOBILE, 'package.json'), 'utf8')).version;
const PROJECT = join(IOS_APP, 'App.xcodeproj');
const DERIVED = join(MOBILE, 'ios', 'DerivedData');
const LOCAL = join(IOS_APP, 'Local.xcconfig');
const BUNDLE_ID = 'dev.ikrar.sulo';
const LIVE_PORT = 5174;

const [command, ...rest] = process.argv.slice(2);
const flag = (name) => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const has = (name) => rest.includes(`--${name}`);
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: MOBILE, stdio: 'inherit', ...opts });
const out = (cmd, args) => execFileSync(cmd, args, { cwd: MOBILE, encoding: 'utf8' });
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const DATA_MODES = { sintetis: 'web', debug: 'debug', rilis: 'production' };
function dataMode() {
  const data = flag('data') ?? 'sintetis';
  if (!(data in DATA_MODES)) fail(`--data harus salah satu dari: ${Object.keys(DATA_MODES).join(', ')}`);
  if (data !== 'sintetis') fail('Build dengan data sungguhan butuh sesi native iPhone (Fase 2). Untuk sekarang pakai --data=sintetis.');
  return data;
}

function sync() {
  const data = dataMode();
  const mode = DATA_MODES[data];
  run('pnpm', ['exec', 'vite', 'build', '--mode', mode]);
  // Only the hosts Sulo uses, as for the APK (scripts/check-hosts.mjs).
  run('node', ['scripts/check-hosts.mjs', 'dist', ...(data === 'sintetis' ? ['--sintetis'] : [])]);
  run('pnpm', ['exec', 'cap', 'sync', 'ios']);
  const { files } = syncProject();
  console.log(`ios: data ${data}, ${files.length} berkas Swift, versi ${VERSION}.`);
  return data;
}

/** An available iPhone simulator: --device by name, else the first iPhone of the newest runtime. */
function simulator() {
  const list = JSON.parse(out('xcrun', ['simctl', 'list', 'devices', 'available', '-j'])).devices;
  const runtimes = Object.keys(list).filter((r) => r.includes('iOS')).sort().reverse();
  const wanted = flag('device');
  for (const r of runtimes) {
    const d = list[r].find((x) => (wanted ? x.name === wanted : x.name.startsWith('iPhone')));
    if (d) return d;
  }
  return fail(wanted ? `Simulator "${wanted}" tidak ada. Lihat: xcrun simctl list devices available` : 'Tidak ada simulator iPhone. Jalankan: xcodebuild -downloadPlatform iOS');
}

function buildFor(destination, configuration, extra = []) {
  run('xcodebuild', ['-project', PROJECT, '-scheme', 'App', '-configuration', configuration, '-destination', destination, '-derivedDataPath', DERIVED, '-quiet', ...extra, 'build']);
}

function sim() {
  sync();
  const d = simulator();
  buildFor(`id=${d.udid}`, 'Debug');
  spawnSync('xcrun', ['simctl', 'boot', d.udid]);
  spawnSync('open', ['-a', 'Simulator']);
  run('xcrun', ['simctl', 'install', d.udid, join(DERIVED, 'Build/Products/Debug-iphonesimulator/App.app')]);
  run('xcrun', ['simctl', 'launch', d.udid, BUNDLE_ID]);
  console.log(`Sulo jalan di ${d.name}.`);
}

function live() {
  // localhost only: the simulator shares this Mac's network, so no Wi-Fi address, no local-network
  // permission and no HTTP exception in Info.plist. The .ipa never carries this (scripts/ios-verify.mjs).
  const d = simulator();
  const server = spawn('pnpm', ['exec', 'vite', '--mode', 'web', '--host', '127.0.0.1', '--port', String(LIVE_PORT), '--strictPort'], { cwd: MOBILE, stdio: 'inherit' });
  const stop = () => server.kill();
  process.on('SIGINT', stop);
  try {
    run('pnpm', ['exec', 'cap', 'run', 'ios', '--live-reload', '--host', '127.0.0.1', '--port', String(LIVE_PORT), '--target', d.udid]);
  } finally {
    console.log('Muat ulang langsung selesai. Sebelum ios:ipa atau ios:device, ios:sync menulis ulang konfigurasinya.');
  }
}

function team() {
  const text = existsSync(LOCAL) ? readFileSync(LOCAL, 'utf8') : '';
  return /^\s*DEVELOPMENT_TEAM\s*=\s*([A-Z0-9]{10})\s*$/m.exec(text)?.[1] ?? null;
}

function iphone() {
  const res = spawnSync('xcrun', ['devicectl', 'list', 'devices', '--json-output', '-'], { encoding: 'utf8' });
  const devices = res.status === 0 ? (JSON.parse(res.stdout).result?.devices ?? []) : [];
  return devices.find((d) => d.hardwareProperties?.platform === 'iOS' && d.connectionProperties?.pairingState === 'paired') ?? null;
}

function device() {
  const id = team();
  if (!id) fail(`Tim penanda tangan belum ada. Buat ${LOCAL} berisi satu baris: DEVELOPMENT_TEAM = <ID tim 10 karakter>. Lihat docs/ios/XCODE-KAPAN.md bagian 2.`);
  const phone = iphone();
  if (!phone) fail('iPhone tidak terlihat. Colok kabelnya, buka kunci iPhone, lalu cek: xcrun devicectl list devices');
  sync();
  buildFor(`id=${phone.hardwareProperties.udid}`, 'Debug', ['-allowProvisioningUpdates', '-allowProvisioningDeviceRegistration', '-xcconfig', LOCAL]);
  const app = join(DERIVED, 'Build/Products/Debug-iphoneos/App.app');
  run('xcrun', ['devicectl', 'device', 'install', 'app', '--device', phone.identifier, app]);
  run('xcrun', ['devicectl', 'device', 'process', 'launch', '--device', phone.identifier, BUNDLE_ID]);
  console.log('Sulo terpasang dan terbuka di iPhone. Profil ini berlaku 7 hari; jalankan lagi sebelum habis.');
}

function ipa() {
  const data = sync();
  const work = mkdtempSync(join(tmpdir(), 'sulo-ipa-'));
  try {
    const archive = join(work, 'Sulo.xcarchive');
    run('xcodebuild', ['-project', PROJECT, '-scheme', 'App', '-configuration', 'Release', '-destination', 'generic/platform=iOS', '-archivePath', archive, '-derivedDataPath', DERIVED, '-quiet', 'archive', 'CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGN_IDENTITY=']);
    const payload = join(work, 'Payload');
    mkdirSync(payload);
    cpSync(join(archive, 'Products/Applications/App.app'), join(payload, 'App.app'), { recursive: true });
    mkdirSync(join(ROOT, '.output'), { recursive: true });
    const name = `sulo-${VERSION}-ios${data === 'sintetis' ? '-sintetis' : ''}.ipa`;
    const target = join(ROOT, '.output', name);
    rmSync(target, { force: true });
    run('zip', ['-qry', target, 'Payload'], { cwd: work });
    run('node', ['scripts/ios-verify.mjs', target, ...(data === 'sintetis' ? ['--sintetis'] : [])]);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function log() {
  if (has('iphone')) {
    const phone = iphone();
    if (!phone) fail('iPhone tidak terlihat.');
    // Relaunches Sulo with its output attached.
    run('xcrun', ['devicectl', 'device', 'process', 'launch', '--console', '--terminate-existing', '--device', phone.identifier, BUNDLE_ID]);
    return;
  }
  run('xcrun', ['simctl', 'spawn', 'booted', 'log', 'stream', '--level', 'info', '--predicate', 'process == "App"']);
}

function doctor() {
  const line = (ok, text) => console.log(`${ok ? 'ok  ' : 'BELUM'} ${text}`);
  const xcode = spawnSync('xcode-select', ['-p'], { encoding: 'utf8' }).stdout.trim();
  line(xcode.includes('Xcode.app'), `xcode-select: ${xcode}`);
  const version = spawnSync('xcodebuild', ['-version'], { encoding: 'utf8' }).stdout.split('\n')[0];
  line(Boolean(version), version || 'xcodebuild tidak jalan');
  const runtimes = spawnSync('xcrun', ['simctl', 'runtime', 'list'], { encoding: 'utf8' }).stdout.split('\n').filter((l) => l.startsWith('iOS'));
  line(runtimes.length > 0, `runtime simulator: ${runtimes.map((r) => r.split(' - ')[0]).join(', ') || 'tidak ada'}`);
  const phone = iphone();
  line(Boolean(phone), phone ? `iPhone: ${phone.hardwareProperties.productType}, iOS ${phone.deviceProperties.osVersionNumber}, Mode Pengembang ${phone.deviceProperties.developerModeStatus}` : 'iPhone tidak tersambung (hanya perlu untuk ios:device)');
  line(Boolean(team()), team() ? 'tim penanda tangan ada di ios/App/Local.xcconfig' : 'ios/App/Local.xcconfig belum berisi DEVELOPMENT_TEAM (hanya perlu untuk ios:device)');
  line(!/DEVELOPMENT_TEAM = /.test(readFileSync(PBXPROJ, 'utf8')), 'project.pbxproj tanpa DEVELOPMENT_TEAM');
  const free = (() => {
    const s = statfsSync('/');
    return Math.round((s.bavail * s.bsize) / 1e9);
  })();
  line(free >= 10, `ruang kosong ${free} GB`);
}

const commands = { sync, sim, live, device, ipa, log, doctor };
if (!commands[command]) fail(`Perintah: ${Object.keys(commands).join(', ')}`);
commands[command]();
