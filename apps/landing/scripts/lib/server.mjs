// A small static server for the built site (dist/), for the screenshot and
// check scripts: no dependency, nothing but files, never on a public address.
// Text is gzipped when the browser asks, as any real host does, so a local
// Lighthouse run weighs the page as visitors will receive it.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

/** Serves `root` on 127.0.0.1 at a free port; resolves with its address and a stop(). */
export function serve(root) {
  const base = resolve(root);
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(base, path));
    if (!file.startsWith(base)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      const missing = join(base, '404.html');
      res.writeHead(404, { 'content-type': TYPES['.html'] });
      if (existsSync(missing)) createReadStream(missing).pipe(res);
      else res.end('404');
      return;
    }
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    const teks = /^(text\/|application\/(json|xml)|image\/svg)/.test(type);
    if (teks && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', vary: 'accept-encoding' });
      createReadStream(file).pipe(createGzip()).pipe(res);
      return;
    }
    res.writeHead(200, { 'content-type': type });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      ok({ url: `http://127.0.0.1:${port}`, stop: () => new Promise((done) => server.close(done)) });
    });
  });
}
