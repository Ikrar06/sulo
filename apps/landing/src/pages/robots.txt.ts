// robots.txt: everything but the device screens (/layar/, pictures of the
// apps inside frames) may be read; the sitemap's address once SITE_URL is set.
import type { APIRoute } from 'astro';
import { alamatSitus } from '../data/situs';

export const GET: APIRoute = ({ site }) => {
  const asal = alamatSitus(site);
  const baris = ['User-agent: *', 'Allow: /', 'Disallow: /layar/', ...(asal ? [`Sitemap: ${asal}/sitemap.xml`] : [])];
  return new Response(`${baris.join('\n')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
