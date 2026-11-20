// The Android version rule (M8e E2), the same as app/build.gradle's:
// versionName = apps/mobile/package.json's version, digits and dots only
// ("0.9.0"; the extension stores refuse suffixes); versionCode = major *
// 10000 + minor * 100 + patch, so every 0.9.x (900 + x) stays below 1.0.0
// (10000). Minor and patch stay under 100.

/** The versionCode for "x.y.z", or an Error for anything else. */
export function versionCode(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  if (!m) throw new Error(`Versi harus angka dan titik (x.y.z): ${version}`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (minor > 99 || patch > 99) throw new Error(`Minor dan patch harus di bawah 100: ${version}`);
  return major * 10000 + minor * 100 + patch;
}

/** The highest versionCode among release tags ("v0.9.1"), leaving out `except` (the tag being released). */
export function highestReleased(tags, except = null) {
  let best = null;
  for (const tag of tags) {
    if (tag === except) continue;
    const m = /^v(\d+\.\d+\.\d+)$/.exec(tag.trim());
    if (!m) continue;
    const code = versionCode(m[1]);
    if (best === null || code > best.code) best = { tag: tag.trim(), code };
  }
  return best;
}
