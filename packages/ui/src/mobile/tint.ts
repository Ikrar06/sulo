// Category and course tints: the color at 16% over the card (or inset)
// layer, behind tiles and chips; the text on them stays --text.
// Colors are the design tokens' variables: "course-3", "cat-ujian", "accent".

export type TintColor = `course-${number}` | `cat-${string}` | 'accent' | 'warn' | 'soon' | 'neutral';

const VAR: Record<string, string> = { accent: 'var(--brand-orange)', warn: 'var(--urgency-overdue)', soon: 'var(--urgency-soon)', neutral: 'var(--muted)' };

export const tintVar = (color: TintColor | null | undefined): string => (color ? (VAR[color] ?? `var(--${color})`) : 'var(--muted)');

/** Background for a tile or chip in this color. */
export const tintBg = (color: TintColor | null | undefined, pct = 16, over = 'var(--m-card)'): string => `color-mix(in oklch, ${tintVar(color)} ${pct}%, ${over})`;

export const courseTint = (n: number | null | undefined): TintColor => (n ? `course-${n}` : 'neutral');
