// Keeps the developer's machine out of every build (dev, tester, production).
// React's development JSX (dev and tester builds) records each component's
// file as an absolute path, which carries the local user name. This plugin
// rewrites the repository root to nothing, so "/Users/<name>/.../sulo/apps/
// extension/components/x.tsx" becomes "apps/extension/components/x.tsx", and
// any other home-directory path to "~". scripts/check-leaks.mjs fails a build
// or zip that still holds one.

import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\/$/, '');

type Rewrite = { code: string; map: null } | null;

/** A Vite plugin (typed by hand: vite is WXT's dependency, not this package's). */
export function stripLocalPaths(): { name: string; enforce: 'post'; renderChunk(code: string): Rewrite } {
  const home = homedir();
  const strip = (code: string): string | null => {
    if (!code.includes(REPO_ROOT) && !code.includes(home)) return null;
    return code.split(`${REPO_ROOT}/`).join('').split(REPO_ROOT).join('.').split(home).join('~');
  };
  return {
    name: 'sulo:strip-local-paths',
    enforce: 'post',
    // On the finished chunks only: module ids still need their absolute
    // paths while imports are resolved. Covers build, build:dev and zips;
    // pages served live by pnpm dev never leave the machine.
    renderChunk(code) {
      const out = strip(code);
      return out === null ? null : { code: out, map: null };
    },
  };
}
