// What the download buttons say, from src/data/rilis.json. Before 1.0.0 the
// files are not there yet: a preview page may borrow sample sizes (the 0.9.1
// test build's), and then says so on the page. Never committed as available.
import rilis from './rilis.json';
import type { Bahasa } from '../teks';

export interface Unduhan {
  tersedia: boolean;
  url: string;
  ukuran: string;
  versi: string;
}

/** Sample sizes for a preview: the 0.9.1 test build's files (1,609,911 and 6,644,460 bytes). */
const PRATINJAU = { android: 1_609_911, ekstensi: 6_644_460 };

const mb = (bytes: number, bahasa: Bahasa) => `${(bytes / 1_000_000).toLocaleString(bahasa === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 })} MB`;

export function unduhan(jenis: 'android' | 'ekstensi', bahasa: Bahasa, pratinjau = false): Unduhan {
  const r = rilis[jenis];
  if (r.tersedia) return { tersedia: true, url: r.url, ukuran: mb(r.ukuranByte, bahasa), versi: r.versi };
  if (pratinjau) return { tersedia: false, url: '', ukuran: mb(PRATINJAU[jenis], bahasa), versi: '1.0.0' };
  return { tersedia: false, url: '', ukuran: '', versi: '' };
}
