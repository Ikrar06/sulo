// What a debug APK is: its SHA-256, and the commit it was built from
// (assets/public/build-info.json, written by vite.config.ts). Shared by
// pnpm mobile:install and pnpm mobile:fetch-apk.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ROOT } from './env.mjs';

export function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** The build info inside the APK, or null for an APK made before it was added. */
export function apkInfo(file) {
  try {
    return JSON.parse(execFileSync('unzip', ['-p', file, 'assets/public/build-info.json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch {
    return null;
  }
}

export function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/** How the APK's commit stands against HEAD: same, older (an ancestor), or not on this branch. */
export function against(commit) {
  const head = git('rev-parse', 'HEAD');
  if (!commit || commit === 'unknown') return { head, relation: 'unknown' };
  if (commit === head) return { head, relation: 'same' };
  const known = git('cat-file', '-t', commit) === 'commit';
  if (!known) return { head, relation: 'unknown' };
  const ancestor = (() => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', commit, head], { cwd: ROOT, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();
  const behind = ancestor ? Number(git('rev-list', '--count', `${commit}..${head}`)) : null;
  return { head, relation: ancestor ? 'older' : 'elsewhere', behind };
}
