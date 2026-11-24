// The homography between two quadrilaterals, and its CSS matrix3d: used to
// lay a flat 402 x 874 pt screen onto a tilted frame's screen (four measured
// corners in src/data/bingkai.json). Same arithmetic as scripts/layar-miring.mjs.
type Titik = readonly [number, number];

/** The 3x3 homography (9 numbers, last 1) taking `from` to `to`. */
export function homografi(from: readonly Titik[], to: readonly Titik[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i]!;
    const [X, Y] = to[i]!;
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[p]![c]!)) p = r;
    [A[c], A[p]] = [A[p]!, A[c]!];
    [b[c], b[p]] = [b[p]!, b[c]!];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r]![c]! / A[c]![c]!;
      for (let k = c; k < 8; k++) A[r]![k]! -= f * A[c]![k]!;
      b[r]! -= f * b[c]!;
    }
  }
  return [...b.map((v, i) => v / A[i]![i]!), 1];
}

/** The homography as CSS matrix3d (column-major, z passed through). */
export function matrix3d(h: number[]): string {
  const [a, b, c, d, e, f, g, k] = h as [number, number, number, number, number, number, number, number];
  return `matrix3d(${[a, d, 0, g, b, e, 0, k, 0, 0, 1, 0, c, f, 0, 1].map((v) => +v.toFixed(8)).join(', ')})`;
}
