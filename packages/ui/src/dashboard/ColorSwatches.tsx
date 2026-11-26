import { useRef, type KeyboardEvent } from 'react';
import { COURSE_COLOR_COUNT } from '@sulo/core/courses/colors';

/**
 * Course color as a row of 24 px swatches: the eight course tokens (1.1.0:
 * no separate "Otomatis" swatch; the automatic color is one of the eight
 * and shows as chosen until another is picked). A radio group: one tab stop,
 * arrow keys move and choose (with wrap), Home/End jump. The chosen one
 * carries a ring in its own color, set off by a gap; each swatch is named
 * for screen readers, so color is never the only cue (aria-checked + ring).
 */
export function ColorSwatches({
  value,
  onChange,
  label,
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
  /** Kept for callers; the automatic color now shows as the chosen swatch. */
  autoLabel?: string;
  names: readonly string[];
  /** The color "Otomatis" currently gives: chosen while `value` is null. */
  autoColor: number | null;
}) {
  const options: number[] = Array.from({ length: COURSE_COLOR_COUNT }, (_, i) => i + 1);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const effective = value ?? autoColor;
  const index = Math.max(0, options.indexOf(effective ?? -1));

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
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2 p-1">
      {options.map((option, i) => {
        const checked = option === effective;
        const name = names[option - 1] ?? String(option);
        const color = `var(--course-${option})`;
        return (
          <button
            key={option}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={name}
            title={name}
            tabIndex={i === index ? 0 : -1}
            onClick={() => {
              onChange(option);
              onPick?.();
            }}
            onKeyDown={onKeyDown}
            className="size-6 shrink-0 rounded-full outline-none transition-transform duration-150 ease-out hover:scale-110 active:scale-95 motion-reduce:transition-none focus-ring:outline-2 focus-ring:outline-offset-4 focus-ring:outline-focus"
            // The chosen one: a 2 px gap in the popover's own color (--layer-card), then a 2 px ring in its own color.
            style={{ background: color, boxShadow: checked ? `0 0 0 2px var(--layer-card), 0 0 0 4px ${color}` : undefined }}
          />
        );
      })}
    </div>
  );
}
