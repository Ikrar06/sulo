// A QR code drawn at build time as one SVG path (brief 6.8: the Android
// card's code on a wide screen leads to /pasang/android, never straight to
// the APK, so people read the guide first). qrcode-generator (MIT) is a
// build-time dependency only; nothing of it reaches the visitor.
import qrcode from 'qrcode-generator';

export interface Qr {
  /** Modules per side, the quiet zone included. */
  ukuran: number;
  path: string;
}

/** The address as a QR (error correction M), with the standard 4-module quiet zone. */
export function buatQr(alamat: string): Qr {
  const qr = qrcode(0, 'M');
  qr.addData(alamat);
  qr.make();
  const n = qr.getModuleCount();
  const tepi = 4;
  let path = '';
  for (let r = 0; r < n; r++) {
    // One rectangle per run of dark modules in a row: a much shorter path than one per module.
    for (let c = 0; c < n; ) {
      if (!qr.isDark(r, c)) {
        c++;
        continue;
      }
      let panjang = 1;
      while (c + panjang < n && qr.isDark(r, c + panjang)) panjang++;
      path += `M${c + tepi} ${r + tepi}h${panjang}v1h-${panjang}z`;
      c += panjang;
    }
  }
  return { ukuran: n + tepi * 2, path };
}
