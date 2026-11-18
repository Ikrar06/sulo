// Category and course tints: the color at 16% over the card (or inset)
// layer, behind tiles and chips; the text on them stays --text.
// Colors are the design tokens' variables: "course-3", "cat-ujian", "accent".

export type TintColor = `course-${number}` | `cat-${string}` | 'accent' | 'warn' | 'soon' | 'neutral';

const VAR: Record<string, string> = { accent: 'var(--brand-orange)', warn: 'var(--urgency-overdue)', soon: 'var(--urgency-soon)', neutral: 'var(--muted)' };

export const tintVar = (color: TintColor | null | undefined): string => (color ? (VAR[color] ?? `var(--${color})`) : 'var(--muted)');

/** Background for a tile or chip in this color. */
export const tintBg = (color: TintColor | null | undefined, pct = 16, over = 'var(--m-card)'): string => `color-mix(in oklch, ${tintVar(color)} ${pct}%, ${over})`;

export const courseTint = (n: number | null | undefined): TintColor => (n ? `course-${n}` : 'neutral');

/** Text and edge on a solid course color: always the dark text color, and a hairline so a light swatch keeps its edge on a white card. */
export const ON_SOLID = { color: '#111114', boxShadow: 'inset 0 0 0 1px rgb(17 17 20 / 0.08)' } as const;

/** Icons on a tint: the color mixed 55% with the text color (5.0-5.4:1 on the tint, both themes). */
export const tintIcon = (color: TintColor | null | undefined): string => `color-mix(in oklch, ${tintVar(color)} 55%, var(--text))`;

/** A course's initials for its tile: the first letters of its first two words. */
export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
