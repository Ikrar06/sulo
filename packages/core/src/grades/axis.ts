// The semester GPA chart's y axis (M7.1): adaptive so small changes near the
// top stay visible. Pure.
// - top is always 4.00
// - bottom: the lowest value minus 0.25, rounded down to a multiple of 0.25,
//   never below 0; at least 0.5 of range (else 3.50)
// - grid lines every 0.25, or every 0.5 when the range is over 2

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface YAxis {
  min: number;
  max: number;
  step: number;
  /** Grid lines from the bottom up, the bottom itself included. */
  ticks: number[];
}

export function yAxisRange(values: readonly number[]): YAxis {
  const max = 4;
  const lowest = values.length ? Math.min(...values) : max;
  let min = Math.max(0, round2(Math.floor(round2((lowest - 0.25) / 0.25)) * 0.25));
  if (max - min < 0.5) min = 3.5;
  const step = max - min > 2 ? 0.5 : 0.25;
  const ticks = [min];
  for (let t = Math.ceil(round2(min / step)) * step; t <= max + 1e-9; t = round2(t + step)) if (t > min + 1e-9) ticks.push(round2(t));
  return { min, max, step, ticks };
}
