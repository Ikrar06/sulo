// B0 "Bandingkan request": NEOSIA's requests (method + host/path, counted)
// with the capture script and without it, for the same page. The script must
// add nothing: the right answer is an empty difference.

export interface RequestDiff {
  key: string;
  without: number;
  with: number;
}

export function requestDiff(without: Record<string, number>, withScript: Record<string, number>): RequestDiff[] {
  const keys = [...new Set([...Object.keys(without), ...Object.keys(withScript)])].sort();
  return keys.map((key) => ({ key, without: without[key] ?? 0, with: withScript[key] ?? 0 })).filter((d) => d.without !== d.with);
}
