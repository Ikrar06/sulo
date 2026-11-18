// The app's touch controls: at least 44 px tall (TalkBack and thumbs), the
// dashboard's radius and colors. Focus rings show for keyboards only.

const base = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-[14px] font-medium outline-none disabled:opacity-50 focus-ring:ring-2 focus-ring:ring-focus';
export const primaryButton = `${base} bg-primary text-primary-foreground`;
export const secondaryButton = `${base} border border-border bg-surface`;
export const dangerButton = `${base} border border-urgency-overdue text-urgency-overdue`;
/** A full-width row in a list (Lainnya, settings): 48 px, chevron on the right. */
export const rowButton = 'flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-[16px] outline-none focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-inset';
/** A filter chip. */
export const chip = (on: boolean) => `inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-[14px] outline-none focus-ring:ring-2 focus-ring:ring-focus ${on ? 'border-foreground bg-foreground text-bg' : 'border-border bg-surface text-foreground'}`;
