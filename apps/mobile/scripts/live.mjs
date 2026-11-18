#!/usr/bin/env node
// pnpm mobile:live: live reload on the phone over Wi-Fi. The phone loads the
// UI from this computer's dev server (same network), development only.
// SuloSession stays native as in the APK.
import { execFileSync, spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { MOBILE, androidEnv } from './env.mjs';

const ip = Object.values(networkInterfaces()).flat().find((a) => a && a.family === 'IPv4' && !a.internal)?.address;
if (!ip) {
  console.error('Tidak ada alamat jaringan lokal. Sambungkan komputer dan HP ke Wi-Fi yang sama.');
  process.exit(1);
}
const port = 5174;
const server = spawn('pnpm', ['exec', 'vite', '--host', ip, '--port', String(port), '--strictPort'], { cwd: MOBILE, stdio: 'inherit' });
try {
  execFileSync('pnpm', ['exec', 'cap', 'run', 'android', '--live-reload', '--host', ip, '--port', String(port)], { cwd: MOBILE, env: androidEnv(), stdio: 'inherit' });
} finally {
  process.on('SIGINT', () => server.kill());
}
