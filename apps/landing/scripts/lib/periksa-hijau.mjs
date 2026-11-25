// Green left in a processed device frame: a pixel that shows (alpha above 0)
// with a colour near the key, or with green clearly above red and blue.
// Used by olah-bingkai.mjs (it refuses to write such a frame) and by
// check-bingkai.mjs (CI).

/** How close (per channel) to the key a colour counts as the key. */
export const NEAR_KEY = 64;
/** How far green must exceed red and blue to count as clearly green. */
export const GREEN_LEAD = 32;

/**
 * @param {{ width: number, height: number, data: Uint8Array }} img RGBA
 * @param {number[]} key the key colour
 * @returns {{ x: number, y: number, rgba: number[] }[]} every failing pixel
 */
export function greenPixels(img, key = [0, 255, 0]) {
  const { width, data } = img;
  const out = [];
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] === 0) continue;
    const [r, g, b] = [data[p], data[p + 1], data[p + 2]];
    const nearKey = Math.abs(r - key[0]) < NEAR_KEY && Math.abs(g - key[1]) < NEAR_KEY && Math.abs(b - key[2]) < NEAR_KEY;
    if (nearKey || g - Math.max(r, b) > GREEN_LEAD) {
      const i = p / 4;
      out.push({ x: i % width, y: Math.floor(i / width), rgba: [r, g, b, data[p + 3]] });
    }
  }
  return out;
}
