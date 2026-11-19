import type { ReactNode } from 'react';
import { Button } from '@sulo/ui/ui/button';
import { useI18n } from '@sulo/ui/i18n';
import './onboarding.css';


/** Progress segments read from the step list; the text is for screen readers. */
function Progress({ position, total }: { position: number; total: number }) {
  const { m } = useI18n();
  const t = m.onboarding;
  return (
    <div className="flex items-center gap-2" aria-label={t.stepLabel(position, total)} role="img">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${
            i + 1 === position ? 'w-10 bg-foreground' : i + 1 < position ? 'w-5 bg-foreground/60' : 'w-5 bg-border'
          }`}
        />
      ))}
    </div>
  );
}

export interface ShellProps {
  /** Key for the step transition (the step id). */
  stepKey: string;
  /** 1-based position and total, from the step list; omitted for single screens. */
  progress?: { position: number; total: number };
  /** Right column: what the product looks like at this step. */
  aside?: ReactNode;
  /** Single full-width column (the course list). */
  full?: boolean;
  /** Sticky action bar at the bottom of the page. */
  footer?: ReactNode;
  children: ReactNode;
}

/** One plain background for the whole page; no panels, no gradients. */
export function OnboardingShell({ stepKey, progress, aside, full = false, footer, children }: ShellProps) {
  return (
    <div className={`ob-layout ${full ? 'is-full' : ''}`}>
      <main className="ob-main">
        <div className="ob-content">
          {progress && <Progress position={progress.position} total={progress.total} />}
          <div key={stepKey} className="ob-step">
            {children}
          </div>
        </div>
        {aside && !full && <div className="ob-aside">{aside}</div>}
      </main>
      {footer && <div className="ob-footer">{footer}</div>}
    </div>
  );
}

export const Title = ({ children }: { children: ReactNode }) => (
  <h1 className="font-heading text-[clamp(34px,3.2vw,46px)] leading-[1.08] tracking-[-0.02em] text-balance">{children}</h1>
);

export const Lead = ({ children }: { children: ReactNode }) => (
  <p className="max-w-[34em] text-[18px] leading-[1.6] text-foreground/85">{children}</p>
);

/** "Lewati dulu" for optional steps; the step can be reopened later. */
export function SkipButton({ onSkip }: { onSkip: () => void }) {
  const { m } = useI18n();
  const t = m.onboarding;
  return (
    <Button size="lg" variant="ghost" className="ob-cta" onClick={onSkip}>
      {t.skip}
    </Button>
  );
}
