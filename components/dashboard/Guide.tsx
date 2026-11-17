import { useEffect, useRef, useState } from 'react';
import { GUIDE_STEPS, GUIDE_TITLE, type GuideLocale, type GuideStep } from '@/lib/help/guide';
import { Card } from './Shell';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const words = {
  id: { pause: 'Jeda', play: 'Putar', video: (title: string) => `Video: ${title}` },
  en: { pause: 'Pause', play: 'Play', video: (title: string) => `Video: ${title}` },
} as const;

/**
 * "Mulai pakai": numbered steps, each with a short muted clip of the real
 * extension (cursor, clicks and keys drawn in) and a numbered list of what
 * it shows. The list is plain text, so the steps read without the video.
 * Clips play only while on screen, can be paused, and never play with
 * reduced motion: the poster (last frame) shows instead.
 */
export function Guide({ locale }: { locale: GuideLocale }) {
  return (
    <section id="mulai">
      <Card title={GUIDE_TITLE[locale]}>
        <ol className="space-y-8">
          {GUIDE_STEPS.map((step, i) => (
            <GuideStepView key={step.id} step={step} n={i + 1} locale={locale} />
          ))}
        </ol>
      </Card>
    </section>
  );
}

function GuideStepView({ step, n, locale }: { step: GuideStep; n: number; locale: GuideLocale }) {
  return (
    <li className="space-y-3">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-[12px] font-semibold tabular-nums">
          {n}
        </span>
        <div className="min-w-0">
          <h3 className="text-[16px] leading-6 font-semibold">
            <span className="sr-only">{n}. </span>
            {step.title[locale]}
          </h3>
          <p className="mt-1 text-[14px] leading-normal text-muted-foreground">{step.body[locale]}</p>
        </div>
      </div>

      <figure className="space-y-3 pl-8">{/* lint-ui-allow: 32 px lines the clip up with the step title */}
        <div
          className="relative overflow-hidden rounded-lg border border-border bg-background"
          style={{ aspectRatio: `${step.size.width} / ${step.size.height}`, maxWidth: step.maxWidth }}
        >
          {step.clip ? (
            <>
              {/* One clip per theme; the hidden one is never loaded (preload none, never played). */}
              <Clip src={`/guide/${step.clip}-light-${locale}`} label={step.alt[locale]} locale={locale} className="db-guide-light" />
              <Clip src={`/guide/${step.clip}-dark-${locale}`} label={step.alt[locale]} locale={locale} className="db-guide-dark" />
            </>
          ) : (
            <ToolbarDrawing label={step.alt[locale]} />
          )}
        </div>
        <figcaption>
          <ol className="space-y-1">
            {step.points.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-[14px] leading-normal">
                <span aria-hidden="true" className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-orange text-[12px] font-semibold text-ink tabular-nums">
                  {i + 1}
                </span>
                <span>
                  <span className="sr-only">{i + 1}. </span>
                  {p[locale]}
                </span>
              </li>
            ))}
          </ol>
        </figcaption>
      </figure>
    </li>
  );
}

/** A muted, looping clip that plays while visible; a pause button keeps it still (WCAG 2.2.2). */
function Clip({ src, label, locale, className }: { src: string; label: string; locale: GuideLocale; className: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [still] = useState(reducedMotion);
  const [paused, setPaused] = useState(false);
  const w = words[locale];

  useEffect(() => {
    const el = video.current;
    if (!el || still || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !paused) void el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [still, paused]);

  if (still) return <img src={`${src}.webp`} alt={label} loading="lazy" decoding="async" className={`${className} absolute inset-0 size-full`} />;

  return (
    <div className={`${className} absolute inset-0`}>
      <video ref={video} src={`${src}.webm`} poster={`${src}.webp`} muted loop playsInline preload="none" aria-label={w.video(label)} className="size-full" />
      <button
        type="button"
        onClick={() => {
          const el = video.current;
          if (!el) return;
          if (paused) void el.play().catch(() => {});
          else el.pause();
          setPaused(!paused);
        }}
        className="absolute bottom-2 left-2 h-8 rounded-lg border border-border bg-surface px-3 text-[12px] font-medium outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus"
      >
        {paused ? w.play : w.pause}
      </button>
    </div>
  );
}

/** Step 1: the browser toolbar cannot be recorded, so it is drawn: puzzle, then the pin, then Sulo's icon. Our own shapes; theme colors. */
function ToolbarDrawing({ label }: { label: string }) {
  const panel = { fill: 'var(--surface)', stroke: 'var(--border)', strokeWidth: 2 };
  const ink = { fill: 'none', stroke: 'var(--text)', strokeWidth: 4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const arrow = (x: number) => <path d={`M${x} 180h70m-18-16 18 16-18 16`} {...ink} stroke="var(--muted)" />;
  return (
    <svg role="img" aria-label={label} viewBox="0 0 1200 360" className="absolute inset-0 size-full">
      <rect x="0" y="0" width="1200" height="360" fill="var(--bg)" />
      {/* 1: the extensions button (puzzle piece) */}
      <rect x="160" y="120" width="120" height="120" rx="24" {...panel} />
      <path d="M196 160h20a12 12 0 1 1 24 0h20v20a12 12 0 1 1 0 24v20h-20a12 12 0 1 0-24 0h-20v-20a12 12 0 1 0 0-24z" {...ink} />
      {arrow(320)}
      {/* 2: the extensions list with the pin next to Sulo */}
      <rect x="430" y="100" width="340" height="160" rx="20" {...panel} />
      <image href="/icon/icon-48.png" x="462" y="156" width="48" height="48" />
      <rect x="526" y="168" width="140" height="24" rx="12" fill="var(--surface-raised)" />
      <path d="M716 162l16 16-10 6-10 22-4-4-16 16-4-4 16-16-4-4 22-10 6-10z" {...ink} strokeWidth={3} />
      {arrow(810)}
      {/* 3: Sulo's icon in the toolbar */}
      <rect x="920" y="120" width="120" height="120" rx="24" {...panel} />
      <image href="/icon/icon-48.png" x="950" y="150" width="60" height="60" />
      {/* Numbers that match the list under the drawing. */}
      {[
        [146, 104, 1],
        [700, 132, 2],
        [906, 104, 3],
      ].map(([x, y, n]) => (
        <g key={n} aria-hidden="true">
          <circle cx={x} cy={y} r="18" fill="var(--brand-orange)" />
          <text x={x} y={y! + 7} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--ink)">
            {n}
          </text>
        </g>
      ))}
    </svg>
  );
}
