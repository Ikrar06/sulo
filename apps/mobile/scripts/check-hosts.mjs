#!/usr/bin/env node
// Only the hosts Sulo uses (M8e E2). Scans the release web bundle (dist/)
// and the native sources, resources and manifest for http(s) hosts and fails
// on any host not listed below with its reason. Unencrypted traffic itself
// is refused by res/xml/network_security_config.xml.
// Usage: node scripts/check-hosts.mjs [dist] [--sintetis]
// --sintetis: the synthetic-data build (iPhone Fase 1), whose fixtures use the reserved .test domain.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MOBILE = new URL('..', import.meta.url).pathname;
const dist = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? join(MOBILE, 'dist');
const synthetic = process.argv.includes('--sintetis');
const NATIVE = ['android/app/src/main/java', 'android/app/src/main/res', 'android/app/src/main/AndroidManifest.xml', 'ios/App/App/Sulo', 'ios/App/App/Info.plist']
  .map((p) => join(MOBILE, p))
  .filter((p) => existsSync(p));

/** host -> why it may appear. */
const ALLOWED = {
  // Requests Sulo makes (Sulo's hard rules for the phone).
  'sikola-v2.unhas.ac.id': 'SIKOLA: login page and read-only requests (core client.ts)',
  'ikrar06.github.io': "Sulo's public data repository: remote config and academic calendar",
  // Pages the user opens; Sulo sends nothing there itself.
  'neosia.unhas.ac.id': "NEOSIA's own pages, opened from a tap (zero requests by Sulo)",
  'api.neosia.unhas.ac.id': "NEOSIA's API, called by NEOSIA's own page; only its path allowlist is matched",
  'sipakamase.unhas.ac.id': 'Sipakamase (1.1.0): its login page, and GETs to five read-only fragments (core sipakamase/allowlist.ts)',
  'github.com': 'links: the owner\'s GitHub and release downloads (opened in the browser)',
  'www.unhas.ac.id': 'link: the official academic calendar PDF (opened in the browser)',
  'forms.gle': 'link: feedback form (opened in the browser)',
  'teer.id': 'link: Trakteer support page (opened in the browser)',
  'calendar.google.com': 'link: add to Google Calendar (opened in the browser)',
  'play.google.com': 'link: update Android System WebView (opened in the browser)',
  'www.instagram.com': "link: the owner's social profile (opened in the browser)",
  'www.linkedin.com': "link: the owner's social profile (opened in the browser)",
  'ikrar.dev': "link: the owner's portfolio (opened in the browser)",
  'sulo.ikrar.dev': "link: Sulo's own site, the iPhone install and update guide (opened in the browser)",
  // Debug builds only (PublicConfig.urlFor, BuildConfig.DEBUG): a test config from the data repository.
  'raw.githubusercontent.com': 'debug only: test config (never used by a release build)',
  // Not addresses: XML namespaces and library error/docs strings.
  'www.w3.org': 'namespace (SVG, XML)',
  'schemas.android.com': 'namespace (Android XML)',
  'www.apple.com': 'namespace (the plist DTD in Info.plist)',
  'cordova.apache.org': "namespace (Capacitor's config.xml)",
  'json-schema.org': 'namespace (Zod JSON schema strings)',
  'react.dev': "React's error-decoder text",
  'tailwindcss.com': "Tailwind's license comment",
};

const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).flatMap((n) => walk(join(p, n))) : /\.(js|html|css|json|kt|java|xml|swift|plist)$/.test(p) ? [p] : []);
const unknown = new Map();
for (const file of [...walk(dist), ...NATIVE.flatMap(walk)]) {
  // Regexes in the sources write a host's dots escaped (github\\.com): read them as plain dots.
  for (const m of readFileSync(file, 'utf8').replace(/\\+\./g, '.').matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)) {
    const host = m[1].toLowerCase();
    // .test is reserved and never resolves (RFC 6761): only the synthetic build's fixtures may use it.
    if (!(host in ALLOWED) && host !== 'localhost' && !(synthetic && host.endsWith('.test'))) unknown.set(host, file.replace(MOBILE, ''));
  }
}
if (unknown.size > 0) {
  console.error(`check-hosts: host yang tidak terdaftar (${unknown.size}):`);
  for (const [host, file] of unknown) console.error(`  ${host}  (${file})`);
  process.exit(1);
}
console.log(`check-hosts: bersih (${Object.keys(ALLOWED).length} host terdaftar).`);
