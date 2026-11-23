// Lab maskot: the owner's bench for judging the mascot. Every expression
// and reaction a click away, at any size, theme and motion mode, slowed
// down or stepped frame by frame. Development only (pnpm maskot:lab, and
// the measuring APK built with SULO_LAB=1); never part of a release.
//
// For scripts (frame sheets, clips, measurements): query switches
//   ?bare=1 only the mascot  &mood= &size= &theme=light|dark &mode=full|lite|off
//   &effects=0 &follow=0 &ground=0
// and window.__lab: setMood, react, pause, step, setRate.
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CHECK_QUIET } from '@sulo/ui/mascot/machine';
import { MOODS, type Mood } from '@sulo/ui/mascot/moods';
import type { ReactionName } from '@sulo/ui/mascot/motion';
import type { MotionMode } from '@sulo/ui/mascot/rig';
import { SuloMascot, type SuloMascotHandle } from '@sulo/ui/mascot/SuloMascot';
import tileDark from '../../extension/assets/brand/tile-dark.svg';
import tileLight from '../../extension/assets/brand/tile-light.svg';
import './lab.css';

const q = new URLSearchParams(location.search);
const BARE = q.has('bare');

const MOOD_LABEL: Record<Mood, string> = {
  neutral: 'Netral',
  happy: 'Senang',
  proud: 'Bangga',
  busy: 'Sibuk',
  keen: 'Siaga',
  worried: 'Cemas',
  sad: 'Sedih',
  sleepy: 'Tidur',
  stale: 'Lesu',
  surprised: 'Kaget',
  wink: 'Kedip sebelah',
  celebrate: 'Merayakan',
  dizzy: 'Pusing',
};

const REACTIONS: { name: ReactionName; label: string }[] = [
  { name: 'tap', label: 'Disentuh' },
  { name: 'jump', label: 'Lompat' },
  { name: 'celebrate', label: 'Merayakan' },
  { name: 'startle', label: 'Kaget' },
  { name: 'sag', label: 'Sedih' },
  { name: 'done', label: 'Selesai memperbarui' },
  { name: 'fail', label: 'Gagal memperbarui' },
  { name: 'checked', label: 'Tugas dicentang' },
  { name: 'incoming', label: 'Tugas baru masuk' },
  { name: 'near', label: 'Tenggat dekat' },
  { name: 'allClear', label: 'Semua beres' },
];

const SIZES = [24, 48, 120, 160, 240] as const;
type Mode = 'full' | 'lite' | 'reduced' | 'off';

interface Cost {
  frames: number;
  mean: number;
  worst: number;
  dropped: number;
}

/** Frame times while it is on: the mean, the worst, and frames that took over one and a half 60 Hz frames. */
function useCost(on: boolean): [Cost, () => void] {
  const [cost, setCost] = useState<Cost>({ frames: 0, mean: 0, worst: 0, dropped: 0 });
  const data = useRef({ frames: 0, total: 0, worst: 0, dropped: 0 });
  const reset = useCallback(() => {
    data.current = { frames: 0, total: 0, worst: 0, dropped: 0 };
    setCost({ frames: 0, mean: 0, worst: 0, dropped: 0 });
  }, []);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let last = performance.now();
    let shown = last;
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      const d = data.current;
      d.frames += 1;
      d.total += dt;
      d.worst = Math.max(d.worst, dt);
      if (dt > 25) d.dropped += 1;
      if (t - shown > 500) {
        shown = t;
        setCost({ frames: d.frames, mean: d.total / d.frames, worst: d.worst, dropped: d.dropped });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return [cost, reset];
}

function Lab() {
  const [mood, setMood] = useState<Mood>((q.get('mood') as Mood) || 'neutral');
  const [size, setSize] = useState<number>(Number(q.get('size')) || 240);
  const [theme, setTheme] = useState<'light' | 'dark'>((q.get('theme') as 'light' | 'dark') || 'light');
  const [mode, setMode] = useState<Mode>((q.get('mode') as Mode) || 'full');
  const [follow, setFollow] = useState(q.get('follow') !== '0' && !BARE);
  const [ground, setGround] = useState(q.get('ground') !== '0');
  const [icon, setIcon] = useState(false);
  const [rate, setRate] = useState(1);
  const [paused, setPaused] = useState(false);
  const [look, setLook] = useState<{ x: number; y: number } | null>(null);
  const [measure, setMeasure] = useState(false);
  const [cost, resetCost] = useCost(measure);
  const [load, setLoad] = useState({ animations: 0, timers: 0, bake: 0 });
  useEffect(() => {
    if (!measure) return;
    const t = window.setInterval(() => {
      const rig = fresh.current?.rig;
      setLoad(rig ? { ...rig.load, bake: rig.lastBakeMs } : { animations: 0, timers: 0, bake: 0 });
    }, 500);
    return () => window.clearInterval(t);
  }, [measure]);
  const fresh = useRef<SuloMascotHandle>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const motion: MotionMode = mode === 'reduced' ? 'lite' : mode;
  const effects = q.get('effects') !== '0';

  const applyRate = useCallback((r: number) => {
    setRate(r);
    fresh.current?.rig?.setRate(r);
  }, []);
  const applyPaused = useCallback((p: boolean) => {
    setPaused(p);
    fresh.current?.rig?.setPaused(p);
  }, []);
  const step = useCallback((ms: number) => fresh.current?.rig?.step(ms), []);
  const react = useCallback((name: ReactionName) => fresh.current?.react(name), []);

  // A new rig starts at speed 1 and running: tell it the bench's speed again when one is made.
  useEffect(() => {
    const t = window.setTimeout(() => {
      fresh.current?.rig?.setRate(rate);
      fresh.current?.rig?.setPaused(paused);
    }, 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, mode, ground]);

  useEffect(() => {
    (window as unknown as { __lab: unknown }).__lab = { setMood, react, pause: applyPaused, step, setRate: applyRate, setLook, setTheme, setSize, setMode, rig: () => fresh.current?.rig ?? null };
  }, [react, applyPaused, step, applyRate]);

  /** From one expression to another: sets the first at once, waits for it to settle, then changes. */
  const transit = useCallback((from: Mood, to: Mood) => {
    setMood(from);
    window.setTimeout(() => setMood(to), 900);
  }, []);

  const newMascot = (px: number, key?: string) => (
    <SuloMascot
      key={key}
      ref={px === size ? fresh : undefined}
      mood={mood}
      size={px}
      motion={motion}
      followCursor={follow && px === size}
      lookX={look?.x}
      lookY={look?.y}
      grounded={ground && px >= 96}
      effects={effects ? undefined : false}
    />
  );
  const tile = (px: number) => <img src={theme === 'dark' ? tileDark : tileLight} alt="" width={px} height={px} style={{ borderRadius: px * 0.22 }} />;

  const stage = (
    <div className="lab-stage flex flex-wrap items-end justify-center gap-10 px-6 py-10" data-stage>
      <figure className="m-0 flex flex-col items-center gap-3">
        <div data-new style={{ padding: size * 0.25 }}>
          {newMascot(size)}
        </div>
      </figure>
      {icon && (
        <figure className="m-0 flex flex-col items-center gap-3">
          <div style={{ padding: size * 0.25 }}>{tile(size * 0.8)}</div>
          {!BARE && <figcaption className="lab-muted text-[13px]">Ikon aplikasi</figcaption>}
        </figure>
      )}
    </div>
  );

  const reduced = useMemo(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  if (BARE) return stage;

  const Toggle = ({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: string }) => (
    <button type="button" className="lab-btn" aria-pressed={on} onClick={() => set(!on)}>
      {children}
    </button>
  );
  const Pick = <T extends string | number>({ value, set, options }: { value: T; set: (v: T) => void; options: readonly (readonly [T, string])[] }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" className="lab-btn" aria-pressed={v === value} onClick={() => set(v)}>
          {label}
        </button>
      ))}
    </div>
  );
  const Group = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
    <section className="lab-card p-4">
      <h2 className="m-0 text-[13px] font-semibold">{title}</h2>
      {note && <p className="lab-muted m-0 mt-1 text-[12px] leading-snug">{note}</p>}
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </section>
  );

  return (
    <div className="mx-auto grid max-w-[1320px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-w-0 flex-col gap-4">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="m-0 text-[20px] font-bold">Lab maskot</h1>
          <p className="lab-muted m-0 text-[12px]">Hanya di server pengembangan. Data sintetis, tanpa jaringan.</p>
        </header>
        <div className="lab-card overflow-hidden">
          {stage}
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] p-3">
            <span className="lab-muted text-[12px]">Ukuran</span>
            <Pick value={size} set={setSize} options={SIZES.map((s) => [s, `${s}`] as const)} />
            <Toggle on={icon} set={setIcon}>Ikon aplikasi</Toggle>
          </div>
        </div>

        <Group title="Semua ukuran sekaligus" note="Ekspresi yang sama di 24, 48, 120, dan 160 px. Tiap ekspresi harus terbaca tanpa label, juga di 24 px.">
          <div className="lab-stage flex flex-wrap items-end gap-8 rounded-lg p-4">
            {[24, 48, 120, 160].map((px) => (
              <div key={px} className="flex flex-col items-center gap-2">
                {newMascot(px, `strip-${px}`)}
                <span className="lab-muted text-[11px]">{px} px</span>
              </div>
            ))}
          </div>
        </Group>

        <Group title="Matriks transisi" note="Baris: dari. Kolom: ke. Ketuk satu sel untuk memainkan peralihan itu (ekspresi awal dipasang dulu, lalu berpindah).">
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-0.5 text-[10px]">
              <thead>
                <tr>
                  <th />
                  {MOODS.map((m) => (
                    <th key={m} className="lab-muted h-16 w-6 align-bottom font-normal">
                      <span className="block origin-bottom-left translate-x-3 -rotate-60 whitespace-nowrap">{MOOD_LABEL[m]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOODS.map((from) => (
                  <tr key={from}>
                    <th className="lab-muted pr-2 text-right font-normal whitespace-nowrap">{MOOD_LABEL[from]}</th>
                    {MOODS.map((to) => (
                      <td key={to}>
                        {from === to ? <span className="block size-[1.6rem]" /> : <button type="button" className="lab-cell" aria-label={`${MOOD_LABEL[from]} ke ${MOOD_LABEL[to]}`} onClick={() => transit(from, to)} />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Group>
      </div>

      <div className="flex flex-col gap-4">
        <Group title="Ekspresi">
          <Pick value={mood} set={setMood} options={MOODS.map((m) => [m, MOOD_LABEL[m]] as const)} />
        </Group>
        <Group title="Reaksi" note={`Sekali main di atas ekspresi yang sedang tampil. Tugas dicentang: bintang hanya untuk centang pertama; centang berikutnya dalam ${CHECK_QUIET} detik cukup lompatan kecil. Perayaan penuh hanya untuk Semua beres.`}>
          <div className="flex flex-wrap gap-1.5">
            {REACTIONS.map((r) => (
              <button key={r.name} type="button" className="lab-btn" onClick={() => react(r.name)}>
                {r.label}
              </button>
            ))}
          </div>
        </Group>
        <Group title="Tema dan mode gerak" note={reduced ? 'Perangkat ini meminta gerak dikurangi: di aplikasi maskot memakai mode Ringan.' : undefined}>
          <Pick value={theme} set={setTheme} options={[['light', 'Terang'], ['dark', 'Gelap']]} />
          <Pick value={mode} set={setMode} options={[['full', 'Penuh'], ['lite', 'Ringan'], ['reduced', 'Gerak dikurangi'], ['off', 'Diam']]} />
          <div className="flex flex-wrap gap-1.5">
            <Toggle on={follow} set={setFollow}>Mata ikut kursor</Toggle>
            <Toggle on={ground} set={setGround}>Bayangan</Toggle>
          </div>
        </Group>
        <Group title="Arah mata" note="Lewat properti lookX dan lookY (misalnya ke tombol utama di layar sentuh).">
          <div className="grid w-fit grid-cols-3 gap-1">
            {[-1, 0, 1].flatMap((y) =>
              [-1, 0, 1].map((x) => (
                <button key={`${x}${y}`} type="button" className="lab-cell" aria-pressed={look?.x === x && look?.y === y} aria-label={`lihat ${x}, ${y}`} onClick={() => setLook({ x, y })} />
              )),
            )}
          </div>
          <button type="button" className="lab-btn w-fit" onClick={() => setLook(null)}>Lepas (tatapan ekspresi sendiri)</button>
        </Group>
        <Group title="Kecepatan" note="Semua gerak maskot mengikuti jam ini: animasi, pewaktu, kedip, dan lirikan.">
          <label className="flex items-center gap-3 text-[13px]">
            <input type="range" min={0.25} max={2} step={0.05} value={rate} onChange={(e) => applyRate(Number(e.target.value))} className="flex-1" />
            <span className="w-12 text-right tabular-nums">{rate.toFixed(2)}x</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            <Toggle on={paused} set={applyPaused}>Jeda</Toggle>
            <button type="button" className="lab-btn" onClick={() => step(1000 / 60)} disabled={!paused}>Maju 1 bingkai</button>
            <button type="button" className="lab-btn" onClick={() => step(100)} disabled={!paused}>Maju 100 ms</button>
            <button type="button" className="lab-btn" onClick={() => applyRate(1)}>1x</button>
          </div>
        </Group>
        <Group title="Biaya" note="Waktu antar-bingkai halaman ini selagi diukur. Bingkai jatuh: lebih dari 25 ms.">
          <div className="flex flex-wrap items-center gap-1.5">
            <Toggle on={measure} set={setMeasure}>Ukur</Toggle>
            <button type="button" className="lab-btn" onClick={resetCost}>Ulang</button>
          </div>
          <p className="m-0 text-[13px] tabular-nums">
            {cost.frames} bingkai · rata-rata {cost.mean.toFixed(1)} ms · terburuk {cost.worst.toFixed(1)} ms · jatuh {cost.dropped}
          </p>
          <p className="lab-muted m-0 text-[12px] tabular-nums">
            Maskot baru: {load.animations} animasi berjalan, {load.timers} pewaktu menunggu, memanggang keyframe terakhir {load.bake.toFixed(2)} ms
          </p>
        </Group>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
);
