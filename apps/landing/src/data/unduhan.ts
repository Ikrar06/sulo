// What the download buttons say and where they lead, read from
// src/data/rilis.json alone (brief 9.2): the hero, the install section, the
// closing block and the guides all show the same thing.
//
// Which button leads is the visitor's device (one line of script in
// tata/Dasar.astro, nothing sent): Android downloads the APK; Chrome or Edge
// downloads the zip, or goes to its store once Sulo is there; another desktop
// browser gets the zip with a note; an iPhone gets the honest "not yet".
// Without the script, the Android and extension buttons show side by side.
//
// Before 1.0.0 the files are not there: a button says "Segera tersedia" and
// cannot be pressed, never a dead link. A preview build borrows the 0.9.1
// test build's sizes and leads to the guides instead (the page says so).
import rilis from './rilis.json';
import { PRATINJAU } from './mode';
import { pathPasang } from './alamat';
import { teks, type Bahasa } from '../teks';

/** The 0.9.1 test build's files, for a preview (docs/rilis: 1,609,911 and 6,644,460 bytes). */
const UKURAN_PRATINJAU = { android: 1_609_911, ekstensi: 6_644_460 };

export const mb = (bytes: number, bahasa: Bahasa) => `${(bytes / 1_000_000).toLocaleString(bahasa === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 })}\u00a0MB`;

export interface Berkas {
  /** Pressable: the file is out, or this is a preview (then it leads to the guide). */
  aktif: boolean;
  href: string;
  /** Size on the button, or "Segera tersedia" when the file is not out. */
  ukuran: string;
  versi: string;
  sha256: string;
  /** A real download (the file itself), not a page. */
  unduhan: boolean;
}

export function berkas(jenis: 'android' | 'ekstensi', bahasa: Bahasa): Berkas {
  const r = rilis[jenis];
  const panduan = pathPasang(bahasa, jenis === 'android' ? 'android' : 'chrome');
  if (r.tersedia) return { aktif: true, href: r.url, ukuran: mb(r.ukuranByte, bahasa), versi: r.versi, sha256: r.sha256, unduhan: true };
  if (PRATINJAU) return { aktif: true, href: panduan, ukuran: mb(UKURAN_PRATINJAU[jenis], bahasa), versi: '1.0.0', sha256: '', unduhan: false };
  return { aktif: false, href: '', ukuran: teks[bahasa].segeraTersedia, versi: '', sha256: '', unduhan: false };
}

export type Browser = 'chrome' | 'edge';
export const NAMA_TOKO: Record<Browser, string> = { chrome: 'Chrome Web Store', edge: 'Edge Add-ons' };
/** The extension's page in the browser's own store, once it is published there. */
export const alamatToko = (nama: Browser): string | null => (rilis.toko[nama].status === 'terbit' && rilis.toko[nama].url ? rilis.toko[nama].url : null);

export type Untuk = 'tanpa-js' | 'android' | 'chrome' | 'edge' | 'desktop-lain' | 'ios';

export interface Tombol {
  /** The devices it shows for (space-separated, matched against html[data-perangkat]). */
  untuk: string;
  label: string;
  ukuran: string;
  href: string;
  aktif: boolean;
  unduhan: boolean;
  /** The honest "not on iPhone yet": a lighter button. */
  ringan?: boolean;
}

export interface Catatan {
  untuk: string;
  teks: string;
  href?: string;
}

export function tombolUnduh(bahasa: Bahasa): { tombol: Tombol[]; catatan: Catatan[] } {
  const t = teks[bahasa];
  const apk = berkas('android', bahasa);
  const zip = berkas('ekstensi', bahasa);
  const dariBerkas = (b: Berkas) => ({ ukuran: b.ukuran, href: b.href, aktif: b.aktif, unduhan: b.unduhan });
  const toko = (nama: Browser): Tombol => {
    const url = alamatToko(nama);
    if (url) return { untuk: nama, label: nama === 'chrome' ? t.pasangChrome : t.pasangEdge, ukuran: '', href: url, aktif: true, unduhan: false };
    return { untuk: nama, label: t.unduhEkstensi, ...dariBerkas(zip) };
  };
  const tombol: Tombol[] = [
    { untuk: 'tanpa-js android', label: t.unduhAndroid, ...dariBerkas(apk) },
    { untuk: 'tanpa-js desktop-lain', label: t.unduhEkstensi, ...dariBerkas(zip) },
    toko('chrome'),
    toko('edge'),
    { untuk: 'ios', label: t.belumIphone, ukuran: '', href: pathPasang(bahasa, 'iphone'), aktif: true, unduhan: false, ringan: true },
  ];
  const browser = (nama: Browser): Catatan => ({ untuk: nama, teks: alamatToko(nama) ? t.catatan.toko(NAMA_TOKO[nama]) : nama === 'chrome' ? t.catatan.chrome : t.catatan.edge });
  // Plain status lines (impeccable critique): the way to the guide is the second button, one per device.
  const catatan: Catatan[] = [
    { untuk: 'tanpa-js', teks: t.catatan.tanpaJs },
    { untuk: 'android', teks: t.catatan.android },
    { untuk: 'android-aplikasi', teks: t.catatan.aplikasi },
    browser('chrome'),
    browser('edge'),
    { untuk: 'desktop-lain', teks: t.catatan.lain },
    { untuk: 'ios', teks: t.catatan.ios },
  ];
  return { tombol, catatan };
}

/** "See how to install", to the visitor's own guide: no device chosen twice. On an iPhone the main button is already that page. */
export function tombolPanduan(bahasa: Bahasa): { untuk: string; href: string }[] {
  return [
    { untuk: 'tanpa-js desktop-lain', href: pathPasang(bahasa) },
    { untuk: 'android', href: pathPasang(bahasa, 'android') },
    { untuk: 'chrome', href: pathPasang(bahasa, 'chrome') },
    { untuk: 'edge', href: pathPasang(bahasa, 'edge') },
  ];
}
