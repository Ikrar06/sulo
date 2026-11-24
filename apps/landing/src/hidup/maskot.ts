// The page's mascots come alive with the apps' own engine (@sulo/ui/mascot/rig):
// breathing, blinking, the eyes following a pointer. The markup is the app
// component's own render at build (SuloMascot); this only finds its parts and
// hands them to the rig, under the component's own rules:
// - it stops while the page is hidden or the mascot is off screen;
// - under reduced motion, or on a weak device (core perf/tier.ts, the phone
//   app's rule, from what the browser says: memory and cores), it is lite: a
//   blink and a change of the eyes, nothing else;
// - its size decides what it may do (under 72 px half the keys, no stars).
// On a touch screen the eyes look at the main button instead of a pointer.
// Nothing is stored or sent.
import { detectTier } from '@sulo/core/perf/tier';
import type { Mood } from '@sulo/ui/mascot/moods';
import { MascotRig, type MotionMode, type RigParts, type SizeTier } from '@sulo/ui/mascot/rig';

/** The component's size tiers (SuloMascot.tsx tierFor), on the size it is drawn at. */
const tierFor = (px: number): SizeTier => (px < 32 ? 'tiny' : px < 72 ? 'small' : 'full');

function perangkatRingan(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const ram = typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 ? nav.deviceMemory * 1024 : null;
  const cores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : null;
  return detectTier({ lowRamDevice: null, totalRamMb: ram, cpuCores: cores, webView: null }).tier === 'lite';
}

function bagian(svg: SVGSVGElement): RigParts | null {
  const satu = <T extends SVGElement>(s: string) => svg.querySelector<T>(s);
  const semua = <T extends SVGElement>(s: string) => [...svg.querySelectorAll<T>(s)];
  const [eyeL, eyeR] = semua<SVGPathElement>('.sm-eye');
  const parts = {
    svg,
    root: satu<SVGGElement>('.sm-root'),
    back: satu<SVGPathElement>('.sm-back'),
    front: satu<SVGPathElement>('.sm-front'),
    face: satu<SVGPathElement>('.sm-face'),
    eyes: satu<SVGGElement>('.sm-eyes'),
    look: satu<SVGGElement>('.sm-look'),
    blink: satu<SVGGElement>('.sm-blink'),
    eyeL,
    eyeR,
    drawn: satu<SVGGElement>('.sm-drawn'),
    stars: satu<SVGGElement>('.sm-stars'),
    spirals: satu<SVGGElement>('.sm-spirals'),
  };
  if (Object.values(parts).some((p) => !p)) return null;
  return {
    ...(parts as { [K in keyof typeof parts]: NonNullable<(typeof parts)[K]> }),
    starEyes: semua('.sm-star-eye'),
    spiralEyes: semua('.sm-spiral'),
    shadow: satu('.sm-shadow'),
    sparks: semua('.sm-spark'),
    zs: semua('.sm-z'),
    orbit: semua('.sm-orbit'),
  };
}

const ringan = perangkatRingan();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const kasar = matchMedia('(pointer: coarse)');
const mode = (): MotionMode => (reduced.matches || ringan ? 'lite' : 'full');

/** The first shown element of a selector (the main button differs by device). */
const terlihat = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].find((e) => e.offsetParent !== null) ?? null;

function hidupkan(wadah: HTMLElement) {
  const svg = wadah.querySelector<SVGSVGElement>('svg.sm');
  const parts = svg && bagian(svg);
  if (!svg || !parts) return;
  const mood = ([...svg.classList].find((c) => c.startsWith('is-'))?.slice(3) ?? 'neutral') as Mood;
  const px = svg.getBoundingClientRect().width;
  const tier = tierFor(px);
  if (tier === 'tiny') return;
  const efek = () => px >= 96 && tier === 'full' && mode() === 'full' && parts.sparks.length > 0;
  const rig = new MascotRig(parts, { mood, motion: mode(), tier, effects: efek() });
  rig.setFollow(true);

  // Where the eyes look on a touch screen: the main button, never a pointer that is not there.
  const lihat = wadah.dataset.lihat;
  const arahkan = () => {
    const target = kasar.matches && lihat ? terlihat(lihat) : null;
    if (!target) return rig.setLook(null);
    const a = svg.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    rig.setLook({ x: (dx / d) * 0.7, y: (dy / d) * 0.7 });
  };

  let diLayar = false;
  let halaman = document.visibilityState !== 'hidden';
  const perbarui = () => rig.setActive(diLayar && halaman);
  new IntersectionObserver((entries) => {
    diLayar = entries.some((e) => e.isIntersecting);
    if (diLayar) arahkan();
    perbarui();
  }).observe(svg);
  document.addEventListener('visibilitychange', () => {
    halaman = document.visibilityState !== 'hidden';
    perbarui();
  });
  reduced.addEventListener('change', () => {
    rig.setMotion(mode());
    rig.setTier(tier, efek());
  });

  // Touched: a small reaction; on the name tile, another of its own expressions each time.
  if (wadah.dataset.sentuh !== undefined) {
    const giliran: Mood[] = ['happy', 'surprised', 'wink', 'proud', 'keen', 'celebrate'];
    let ke = 0;
    svg.addEventListener('click', () => {
      if (wadah.dataset.ganti !== undefined) {
        ke = (ke + 1) % giliran.length;
        rig.setMood(giliran[ke]!);
      }
      rig.react('tap');
    });
  }

  // The main button: keen while a pointer is on it, a small jump when it is pressed (brief 7.4).
  const sorot = wadah.dataset.sorot;
  if (sorot) {
    for (const tombol of document.querySelectorAll<HTMLElement>(sorot)) {
      tombol.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && rig.setMood('keen'));
      tombol.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && rig.setMood(mood));
      tombol.addEventListener('click', () => rig.react('jump'));
    }
  }
}

for (const wadah of document.querySelectorAll<HTMLElement>('[data-maskot]')) hidupkan(wadah);
