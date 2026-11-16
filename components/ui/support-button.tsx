import type { SVGProps } from 'react';
import './support-button.css';

/** Coffee cup, drawn for Sulo (not Trakteer's logo): 18 px, stroke 1.75. */
function CupIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      <path d="M4 10h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6z" />
      <path d="M16 11.5h1.5a2.5 2.5 0 0 1 0 5H15.5" />
      <path d="M8 3.5c-.7.8-.7 1.7 0 2.5M12 3.5c-.7.8-.7 1.7 0 2.5" />
    </svg>
  );
}

/** Small "opens elsewhere" arrow, 14 px. */
function ArrowOutIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

export interface SupportButtonProps {
  href: string;
  label: string;
  /** One short line under the button (12 px, muted). Leave it out when the page shows it elsewhere, e.g. under a row of buttons. */
  note?: string;
  /** Read by screen readers after the label, e.g. "via Trakteer, opens in a new tab". */
  srHint: string;
  className?: string;
}

/**
 * "Traktir kopi": a plain link to the support page, opened in a new tab on
 * click. Nothing from the support site is loaded before that.
 */
export function SupportButton({ href, label, note, srHint, className = '' }: SupportButtonProps) {
  return (
    <div className={`flex flex-col items-start gap-2 ${className}`}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="support-btn inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold outline-none focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-offset-2 focus-ring:ring-offset-background"
      >
        <CupIcon className="support-btn-cup shrink-0" />
        <span>{label}</span>
        <span className="sr-only">{srHint}</span>
        <ArrowOutIcon className="support-btn-arrow shrink-0" />
      </a>
      {note && <p className="text-[12px] leading-normal text-muted-foreground">{note}</p>}
    </div>
  );
}
