// The actions that take a task row's due time place while the row is
// hovered or focused (popup, dashboard Tugas and Ringkasan): 28 px circles on
// a faint neutral fill (the inset layer), a 16 px icon in the muted text
// color, a slightly stronger fill on hover, a round focus ring for keyboards.
// Shown only while the row (a `group`) is hovered or holds keyboard focus;
// pointer events only then, so a touch screen never taps one unseen.

export const ROW_ACTION =
  'relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--layer-inset)] text-muted-foreground outline-none transition-[opacity,background-color] duration-[120ms] hover:bg-[color-mix(in_oklch,var(--text)_10%,var(--layer-inset))] focus-ring:ring-2 focus-ring:ring-focus [&_svg]:size-4';

export const ROW_ACTION_SHOWN = 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-ring:pointer-events-auto group-focus-ring:opacity-100 focus-ring:pointer-events-auto focus-ring:opacity-100 group-has-[[data-state=open]]:pointer-events-auto group-has-[[data-state=open]]:opacity-100 data-[state=open]:opacity-100';

/** The due time's classes: it fades out (120 ms) while the actions show. */
export const FADES_FOR_ACTIONS = 'transition-opacity duration-[120ms] group-hover:opacity-0 group-focus-ring:opacity-0 group-has-[[data-state=open]]:opacity-0';
