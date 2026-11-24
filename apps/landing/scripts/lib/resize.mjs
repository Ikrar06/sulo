// Resizing RGBA images for the build scripts: Lanczos3, separable, on
// premultiplied colors so a transparent neighbour never darkens an edge.

function weights(srcSize, dstSize) {
  const scale = srcSize / dstSize;
  const stretch = Math.max(scale, 1);
  const support = 3 * stretch;
  const sinc = (x) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
  const lanczos = (x) => (Math.abs(x) < 3 ? sinc(x) * sinc(x / 3) : 0);
  const table = [];
  for (let i = 0; i < dstSize; i++) {
    const center = (i + 0.5) * scale - 0.5;
    const from = Math.max(0, Math.floor(center - support));
    const to = Math.min(srcSize - 1, Math.ceil(center + support));
    const w = [];
    let sum = 0;
    for (let j = from; j <= to; j++) {
      const v = lanczos((j - center) / stretch);
      w.push(v);
      sum += v;
    }
    table.push({ from, w: w.map((v) => v / sum) });
  }
  return table;
}

/** Resizes along one axis: `along` 'x' keeps the height, 'y' keeps the width. */
function pass(src, w, h, size, along) {
  const outW = along === 'x' ? size : w;
  const outH = along === 'x' ? h : size;
  const out = new Float32Array(outW * outH * 4);
  const table = weights(along === 'x' ? w : h, size);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const { from, w: ws } = table[along === 'x' ? x : y];
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < ws.length; k++) {
        const sx = along === 'x' ? from + k : x;
        const sy = along === 'x' ? y : from + k;
        const p = (sy * w + sx) * 4;
        const wk = ws[k];
        r += src[p] * wk;
        g += src[p + 1] * wk;
        b += src[p + 2] * wk;
        a += src[p + 3] * wk;
      }
      const q = (y * outW + x) * 4;
      out[q] = r;
      out[q + 1] = g;
      out[q + 2] = b;
      out[q + 3] = a;
    }
  }
  return out;
}

/** @param {{ width: number, height: number, data: Uint8Array }} img */
export function resize(img, width, height) {
  const { width: w, height: h, data } = img;
  const pre = new Float32Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    pre[i] = data[i] * a;
    pre[i + 1] = data[i + 1] * a;
    pre[i + 2] = data[i + 2] * a;
    pre[i + 3] = data[i + 3];
  }
  const out = pass(pass(pre, w, h, width, 'x'), width, h, height, 'y');
  const res = new Uint8Array(width * height * 4);
  for (let i = 0; i < out.length; i += 4) {
    const a = Math.min(255, Math.max(0, out[i + 3]));
    res[i + 3] = Math.round(a);
    if (a < 0.5) continue;
    const k = 255 / a;
    res[i] = Math.min(255, Math.max(0, Math.round(out[i] * k)));
    res[i + 1] = Math.min(255, Math.max(0, Math.round(out[i + 1] * k)));
    res[i + 2] = Math.min(255, Math.max(0, Math.round(out[i + 2] * k)));
  }
  return { width, height, data: res };
}
