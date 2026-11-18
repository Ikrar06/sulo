// The app's controls at the phone's sizes (src/tokens.css): primary button
// 40, secondary 36, chip 30, segmented 36, list row 56, all with a 44 px touch
// target (m-hit). Focus rings show for keyboards only.

const ring = 'outline-none focus-ring:ring-2 focus-ring:ring-focus';
const button = `m-hit inline-flex items-center justify-center gap-2 rounded-ctl px-4 text-m15 ${ring} disabled:opacity-50`;
export const primaryButton = `${button} h-10 bg-primary text-primary-foreground`;
export const secondaryButton = `${button} h-9 border border-border bg-surface`;
export const dangerButton = `${button} h-9 border border-urgency-overdue text-urgency-overdue`;

/** A full-width row in a list without a card: 52 high, pressed feedback. */
export const rowButton = `m-press flex min-h-13 w-full items-center gap-3 px-4 text-left text-m15 ${ring} focus-ring:ring-inset`;

/** A filter chip: 30 visual, 44 touch. */
export const chip = (on: boolean) => `m-hit inline-flex h-[30px] shrink-0 items-center gap-2 rounded-full border px-3 text-m12 ${ring} ${on ? 'border-foreground bg-foreground text-bg' : 'border-border bg-surface text-foreground'}`;

/** A segmented control's track and its options (36 high). */
export const segmentTrack = 'grid h-9 grid-flow-col auto-cols-fr gap-1 rounded-ctl bg-surface-raised p-0.5';
export const segment = (on: boolean) => `m-hit rounded-[8px] text-m13 ${ring} ${on ? 'border border-border bg-surface font-medium text-foreground' : 'text-muted-foreground'}`;

/** A section heading above a group (12, medium, muted). */
export const groupTitle = 'px-4 pt-4 pb-2 text-m12 text-muted-foreground';

/** A list that runs to the screen's edges, rows divided by a 1 px line. */
export const edgeList = '-mx-4 divide-y divide-border border-y border-border bg-surface';

/** A grouping card (never nested): 16 padding, radius 14. */
export const card = 'rounded-card border border-border bg-surface p-4';
