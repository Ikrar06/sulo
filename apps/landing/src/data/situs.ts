// The site's own address (SITE_URL, brief 9.4: nothing written in for it), and
// the absolute addresses built from it: canonical, the other language, the
// social card, the sitemap. While SITE_URL is not set (a local build), none
// is written: no page may point search engines or a QR code at localhost.
import { pathLain } from './alamat';
import type { Bahasa } from '../teks';

export function alamatSitus(site: URL | undefined): string | null {
  if (!site || /^(localhost|127\.|0\.0\.0\.0)/.test(site.hostname)) return null;
  return site.origin;
}

export interface Alamat {
  kanonik: string;
  id: string;
  en: string;
}

/** A page's own address and its two language versions, or null without SITE_URL. */
export function alamatHalaman(site: URL | undefined, path: string, bahasa: Bahasa): Alamat | null {
  const asal = alamatSitus(site);
  if (!asal) return null;
  const lain = pathLain(path, bahasa);
  const id = bahasa === 'id' ? path : lain;
  const en = bahasa === 'en' ? path : lain;
  return { kanonik: `${asal}${path}`, id: `${asal}${id}`, en: `${asal}${en}` };
}
