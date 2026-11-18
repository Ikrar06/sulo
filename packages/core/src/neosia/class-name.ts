// The class label next to a course on the schedule (M7.1): NEOSIA's class
// name is shown only for what it adds ("Kls. Informatika", "B"). When it
// starts with the course's own name, that doubled part is dropped. Pure.

const SEPARATORS = /^[\s\-–—:,.()/]+|[\s\-–—:,()/]+$/g;
const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * What remains of `className` once a leading course name (any of `names`,
 * any letter case) is removed; null when nothing is left.
 */
export function classSuffix(className: string | null, names: readonly (string | null)[]): string | null {
  if (!className) return null;
  let rest = className.replace(/\s+/g, ' ').trim();
  const candidates = names.filter((n): n is string => !!n && n.trim().length > 0).sort((a, b) => b.length - a.length);
  for (const name of candidates) {
    if (norm(rest).startsWith(norm(name))) {
      rest = rest.slice(name.replace(/\s+/g, ' ').trim().length);
      break;
    }
  }
  rest = rest.replace(SEPARATORS, '').trim();
  return rest.length > 0 ? rest : null;
}
