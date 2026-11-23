#!/usr/bin/env node
// The notification sounds, from the owner's WAV files to what the app ships.
//   node scripts/build-sounds.mjs [--check]
//
//   sounds/src/<n>.wav (and <n>.mp3)      the owner's files, untouched
//   android/app/src/main/res/raw/sulo_notif_<n>.<ext>   what Android's notification channels play
//   public/sounds/sulo_notif_<n>.<ext>                  the same bytes, for the preview in Pengaturan
//
// For each sound it reports the length, the channels, the peak, how loud it
// is, and the silence at its start and end; then it cuts the silence at the
// start and brings all of them to one loudness, so none is much louder than
// the rest. Nothing is cut at the end and nothing is shortened: a sound
// longer than 2 s is only reported.
//
// Format: Ogg Vorbis when a tool for it is on this machine (ffmpeg with
// libvorbis, or oggenc); otherwise MP3 through lame; without either, the
// owner's own MP3 is copied as it is (then the loudness is not evened out,
// and the script says so). It installs nothing.
// --check changes nothing and only prints the report.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MOBILE } from './env.mjs';

const SOUNDS = [1, 2, 3, 4];
const SRC = join(MOBILE, 'sounds/src');
const RAW = join(MOBILE, 'android/app/src/main/res/raw');
const PREVIEW = join(MOBILE, 'public/sounds');
/** Below this a sample counts as silence. */
const SILENCE_DB = -50;
/** Every sound's loudest 0.4 s is brought to this level (RMS, dB below full scale)... */
const TARGET_DB = -20;
/** ...unless that would push its peak above this. */
const PEAK_CEILING_DB = -1;
const LONG_S = 2;
const checkOnly = process.argv.includes('--check');

const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));
const has = (tool, args = ['--version']) => spawnSync(tool, args, { stdio: 'ignore' }).status === 0;

/** A PCM WAV file as float samples, interleaved. 16, 24 and 32 bit integer only. */
function readWav(file) {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file}: not a WAV file`);
  let fmt = null;
  let data = null;
  for (let at = 12; at + 8 <= b.length; ) {
    const id = b.toString('ascii', at, at + 4);
    const size = b.readUInt32LE(at + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(at + 8), channels: b.readUInt16LE(at + 10), rate: b.readUInt32LE(at + 12), bits: b.readUInt16LE(at + 22) };
    if (id === 'data') data = b.subarray(at + 8, Math.min(b.length, at + 8 + size));
    at += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`${file}: no fmt or data chunk`);
  if (fmt.format !== 1 && fmt.format !== 0xfffe) throw new Error(`${file}: not integer PCM`);
  const bytes = fmt.bits / 8;
  const count = Math.floor(data.length / bytes);
  const samples = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    const o = i * bytes;
    samples[i] = bytes === 2 ? data.readInt16LE(o) / 32768 : bytes === 3 ? data.readIntLE(o, 3) / 8388608 : data.readInt32LE(o) / 2147483648;
  }
  return { ...fmt, samples, frames: count / fmt.channels };
}

/** 16-bit PCM WAV bytes. */
function writeWav(file, { channels, rate, samples }) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), i * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8, 'ascii');
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(channels, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * channels * 2, 28);
  head.writeUInt16LE(channels * 2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36, 'ascii');
  head.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([head, data]));
}

/** What the report says about one sound. */
export function measure({ channels, rate, samples, frames }) {
  const threshold = 10 ** (SILENCE_DB / 20);
  let peak = 0;
  let first = -1;
  let last = -1;
  const mono = new Float64Array(frames);
  for (let f = 0; f < frames; f += 1) {
    let loudest = 0;
    let sum = 0;
    for (let c = 0; c < channels; c += 1) {
      const v = samples[f * channels + c];
      loudest = Math.max(loudest, Math.abs(v));
      sum += v;
    }
    mono[f] = sum / channels;
    peak = Math.max(peak, loudest);
    if (loudest > threshold) {
      if (first < 0) first = f;
      last = f;
    }
  }
  // Loudness: the RMS of the loudest 0.4 s (the whole sound when it is shorter). Not a standard loudness unit: enough to compare four short sounds.
  const window = Math.min(frames, Math.round(rate * 0.4));
  let energy = 0;
  let best = 0;
  for (let f = 0; f < frames; f += 1) {
    energy += mono[f] ** 2;
    if (f >= window) energy -= mono[f - window] ** 2;
    if (f >= window - 1) best = Math.max(best, energy / window);
  }
  return {
    seconds: frames / rate,
    channels,
    rate,
    peakDb: db(peak),
    loudDb: db(Math.sqrt(best)),
    leadMs: first < 0 ? 0 : (first / rate) * 1000,
    tailMs: last < 0 ? 0 : ((frames - 1 - last) / rate) * 1000,
    firstFrame: Math.max(0, first),
  };
}

const encoder = has('ffmpeg', ['-hide_banner', '-h', 'encoder=libvorbis']) && /libvorbis/.test(spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' }).stdout ?? '') ? 'ffmpeg' : has('oggenc') ? 'oggenc' : has('lame', ['--version']) ? 'lame' : null;
const ext = encoder === 'ffmpeg' || encoder === 'oggenc' ? 'ogg' : 'mp3';
console.log(`Alat: ${encoder ?? 'tidak ada (MP3 pemilik disalin apa adanya)'}; format keluaran: ${ext.toUpperCase()}`);

const tmp = mkdtempSync(join(tmpdir(), 'sulo-sounds-'));
const rows = [];
try {
  if (!checkOnly) for (const dir of [RAW, PREVIEW]) mkdirSync(dir, { recursive: true });
  for (const n of SOUNDS) {
    const wav = readWav(join(SRC, `${n}.wav`));
    const before = measure(wav);
    // Cut the silence at the start; leave the end as the owner made it.
    const trimmed = wav.samples.subarray(before.firstFrame * wav.channels);
    const gainDb = Math.min(TARGET_DB - before.loudDb, PEAK_CEILING_DB - before.peakDb);
    const gain = 10 ** (gainDb / 20);
    const out = { channels: wav.channels, rate: wav.rate, samples: trimmed.map((v) => v * gain), frames: trimmed.length / wav.channels };
    const after = measure(out);
    rows.push({ n, before, gainDb, after });
    if (checkOnly) continue;
    const name = `sulo_notif_${n}.${ext}`;
    const target = join(RAW, name);
    if (encoder === null) {
      copyFileSync(join(SRC, `${n}.mp3`), target);
    } else {
      const fixed = join(tmp, `${n}.wav`);
      writeWav(fixed, out);
      if (encoder === 'ffmpeg') execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', fixed, '-c:a', 'libvorbis', '-q:a', '5', target]);
      else if (encoder === 'oggenc') execFileSync('oggenc', ['--quiet', '-q', '5', '-o', target, fixed]);
      else execFileSync('lame', ['--quiet', '-V', '4', '--noreplaygain', fixed, target]);
    }
    copyFileSync(target, join(PREVIEW, name));
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const f1 = (v) => v.toFixed(1);
console.log('\nSumber (WAV pemilik):');
for (const { n, before: b } of rows) console.log(`  ${n}.wav  ${b.seconds.toFixed(3)} s  ${b.channels} kanal  ${b.rate} Hz  puncak ${f1(b.peakDb)} dBFS  kekerasan ${f1(b.loudDb)} dB  hening awal ${Math.round(b.leadMs)} ms, akhir ${Math.round(b.tailMs)} ms${b.seconds > LONG_S ? `  LEBIH DARI ${LONG_S} s (tidak dipotong)` : ''}`);
console.log(`\nSesudah (hening awal dipangkas, kekerasan disamakan ke ${TARGET_DB} dB, puncak paling tinggi ${PEAK_CEILING_DB} dBFS):`);
for (const { n, gainDb, after: a } of rows) console.log(`  sulo_notif_${n}  ${a.seconds.toFixed(3)} s  penguatan ${gainDb >= 0 ? '+' : ''}${f1(gainDb)} dB  puncak ${f1(a.peakDb)} dBFS  kekerasan ${f1(a.loudDb)} dB`);
if (encoder === null) console.log('\nPERHATIAN: tidak ada alat pengubah format; MP3 pemilik disalin apa adanya dan kekerasannya TIDAK disamakan.');
if (!checkOnly) console.log(`\nDitulis: ${RAW}/sulo_notif_<n>.${ext} dan ${PREVIEW}/sulo_notif_<n>.${ext}`);
