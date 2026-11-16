import { useState } from 'react';
import { GUIDE_STEPS, GUIDE_TITLE, type GuideLocale, type GuideStep } from '@/lib/help/guide';
import { Card } from './Shell';

/**
 * "Mulai pakai": numbered steps, each with a picture and numbered markers.
 * Markers are HTML over the picture (never printed into it), placed in
 * percent inside a frame with a fixed aspect ratio, so they follow the
 * picture when it shrinks. The captions under the picture are plain text
 * for screen readers; the markers are decoration (aria-hidden). Hovering or
 * focusing a caption lights up its marker, and hovering a marker its caption.
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
  const [lit, setLit] = useState<number | null>(null);
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

      <figure className="space-y-3 pl-8">{/* lint-ui-allow: 32 px lines the picture up with the step title */}
        <div
          className="relative overflow-hidden rounded-lg border border-border bg-background"
          style={{ aspectRatio: `${step.size.width} / ${step.size.height}`, maxWidth: step.maxWidth }}
        >
          {step.image ? (
            <>
              {/* Local files only, loaded lazily by the browser; the one matching the theme is shown. */}
              <img src={`/guide/${step.image}-light-${locale}.webp`} alt={step.alt[locale]} loading="lazy" decoding="async" className="db-guide-light absolute inset-0 size-full" />
              <img src={`/guide/${step.image}-dark-${locale}.webp`} alt={step.alt[locale]} loading="lazy" decoding="async" className="db-guide-dark absolute inset-0 size-full" />
            </>
          ) : (
            <ToolbarDrawing label={step.alt[locale]} />
          )}
          {step.markers.map((m, i) => (
            <span
              key={i}
              aria-hidden="true"
              onMouseEnter={() => setLit(i)}
              onMouseLeave={() => setLit(null)}
              className={`absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand-orange text-[12px] font-semibold text-ink tabular-nums transition-transform motion-reduce:transition-none ${
                lit === i ? 'scale-125 ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''
              }`}
              style={{ left: `${m.at[locale][0]}%`, top: `${m.at[locale][1]}%` }}
            >
              {i + 1}
            </span>
          ))}
        </div>
        <figcaption>
          <ol className="space-y-1">
            {step.markers.map((m, i) => (
              <li
                key={i}
                tabIndex={0}
                onMouseEnter={() => setLit(i)}
                onMouseLeave={() => setLit(null)}
                onFocus={() => setLit(i)}
                onBlur={() => setLit(null)}
                className={`flex items-start gap-2 rounded-md px-2 py-1 text-[14px] leading-normal outline-none focus-ring:ring-2 focus-ring:ring-focus ${lit === i ? 'bg-surface-raised' : ''}`}
              >
                <span aria-hidden="true" className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-orange text-[12px] font-semibold text-ink tabular-nums">
                  {i + 1}
                </span>
                <span>
                  <span className="sr-only">{i + 1}. </span>
                  {m.text[locale]}
                </span>
              </li>
            ))}
          </ol>
        </figcaption>
      </figure>
    </li>
  );
}

/** Step 1: the browser toolbar cannot be captured, so it is drawn: puzzle, then the pin, then Sulo's icon. Our own shapes; theme colors. */
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
    </svg>
  );
}
