// sitemap.xml: the home page, the install guides, the user guide and "Yang baru" in both languages, each
// with its other language (hreflang). Empty while SITE_URL is unset.
import type { APIRoute } from 'astro';
import { pathPakai, pathPasang, pathRumah, pathYangBaru, type Aplikasi, type Perangkat } from '../data/alamat';
import { alamatHalaman } from '../data/situs';
import type { Bahasa } from '../teks';

const PERANGKAT: (Perangkat | undefined)[] = [undefined, 'android', 'chrome', 'edge', 'iphone'];
const APLIKASI: (Aplikasi | undefined)[] = [undefined, 'ekstensi', 'android'];

export const GET: APIRoute = ({ site }) => {
  const halaman = (bahasa: Bahasa) => [pathRumah(bahasa), ...PERANGKAT.map((p) => pathPasang(bahasa, p)), ...APLIKASI.map((a) => pathPakai(bahasa, a)), pathYangBaru(bahasa)];
  const entri = (['id', 'en'] as const).flatMap((bahasa) =>
    halaman(bahasa).flatMap((path) => {
      const a = alamatHalaman(site, path, bahasa);
      if (!a) return [];
      return [`  <url>\n    <loc>${a.kanonik}</loc>\n    <xhtml:link rel="alternate" hreflang="id" href="${a.id}"/>\n    <xhtml:link rel="alternate" hreflang="en" href="${a.en}"/>\n  </url>`];
    }),
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entri.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
