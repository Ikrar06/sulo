import { ArrowUpRightIcon, CoffeeIcon } from '../dashboard-icons';
import './support-button.css';

interface SupportButtonProps {
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
        <CoffeeIcon className="support-btn-cup size-5 shrink-0" />
        <span>{label}</span>
        <span className="sr-only">{srHint}</span>
        <ArrowUpRightIcon className="support-btn-arrow size-4 shrink-0" />
      </a>
      {note && <p className="text-[12px] leading-normal text-muted-foreground">{note}</p>}
    </div>
  );
}
