import { useEffect, useRef, useState } from 'react';
import { GUIDE_STEPS, GUIDE_TIP, GUIDE_TITLE, type GuideLocale, type GuideStep } from '@sulo/core/help/guide';
import { Card } from '@sulo/ui/card';

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
        <p className="mb-6 text-[14px] leading-normal text-muted-foreground">{GUIDE_TIP[locale]}</p>
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
          {/* One clip per theme; the hidden one is never loaded (preload none, never played). */}
          <Clip src={`/guide/${step.clip}-light-${locale}`} label={step.alt[locale]} locale={locale} className="db-guide-light" />
          <Clip src={`/guide/${step.clip}-dark-${locale}`} label={step.alt[locale]} locale={locale} className="db-guide-dark" />
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
