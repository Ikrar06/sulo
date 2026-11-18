// Dashboard cards, shared by the extension and the Android app.

import type { ReactNode } from 'react';
import { ChevronRightIcon } from './icons';

/**
 * A section with a quiet heading; depth from the border and --surface only.
 * Padding 20, title 16 px semibold, 12 px between title and body.
 */
export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-5 ${className}`}>
      {(title || action) && (
        // Baseline-aligned with the title; in a narrow card the action moves under it instead of breaking into two lines.
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {title && <h2 className="text-[16px] leading-6 font-semibold">{title}</h2>}
          {action && <div className="shrink-0 whitespace-nowrap">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** "Lihat semua …" in a card header: 14 px muted with a 14 px chevron. */
export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 rounded text-[14px] text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-ring:ring-2 focus-ring:ring-focus">
      {children}
      <ChevronRightIcon className="size-3.5 self-center" />
    </a>
  );
}
