import { useRef, type KeyboardEvent } from 'react';
import { COURSE_COLOR_COUNT } from '@sulo/core/courses/colors';

/**
 * Course color as a row of 20 px swatches: "Otomatis" plus the eight course
 * tokens. A radio group: one tab stop, arrow keys move and choose (with
 * wrap), Home/End jump; the chosen one carries a ring. Each swatch is named
 * for screen readers; color is never the only cue (aria-checked + ring).
 */
export function ColorSwatches({
  value,
  onChange,
  label,
  autoLabel,
  names,
  autoColor,
  onPick,
}: {
  /** Called after a click or Enter/Space chooses a swatch (arrow keys only move); a popover closes here. */
  onPick?: () => void;
  /** 1..8, or null for automatic. */
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  autoLabel: string;
  names: readonly string[];
  /** The color "Otomatis" currently gives, shown inside its swatch. */
  autoColor: number | null;
}) {
  const options: (number | null)[] = [null, ...Array.from({ length: COURSE_COLOR_COUNT }, (_, i) => i + 1)];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = options.indexOf(value);

  const move = (to: number) => {
    const next = (to + options.length) % options.length;
    onChange(options[next] ?? null);
    refs.current[next]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, number> = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: options.length - 1 };
    if (e.key in keys) {
      e.preventDefault();
      move(keys[e.key]!);
    }
  };

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2">
      {options.map((option, i) => {
        const checked = i === index;
        const name = option === null ? autoLabel : (names[option - 1] ?? String(option));
        return (
          <button
            key={option ?? 'auto'}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={name}
            title={name}
            tabIndex={checked ? 0 : -1}
            onClick={() => {
              onChange(option);
              onPick?.();
            }}
            onKeyDown={onKeyDown}
            className={`relative flex size-5 shrink-0 items-center justify-center rounded-full outline-none focus-ring:outline-2 focus-ring:outline-offset-4 focus-ring:outline-focus ${
              checked ? 'ring-2 ring-foreground ring-offset-2 ring-offset-surface' : ''
            } ${option === null ? 'border border-dashed border-muted-foreground' : ''}`}
            style={option === null ? undefined : { background: `var(--course-${option})` }}
          >
            {option === null && autoColor !== null && <span aria-hidden="true" className="size-2 rounded-full" style={{ background: `var(--course-${autoColor})` }} />}
          </button>
        );
      })}
    </div>
  );
}
