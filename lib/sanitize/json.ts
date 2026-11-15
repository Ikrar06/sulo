// JSON sanitizer for Moodle responses: removes personal data from fixtures.
// Pure and deterministic for a given input and options. Imports use explicit
// .ts extensions so `node scripts/sanitize.ts` runs without a build step.
//
// Policy: keep field names, structure and types. Replace every free-text
// value by key; remap ids consistently per namespace; shift timestamps by a
// fixed offset; rewrite URLs. Unknown string fields survive only when they
// look like lowercase identifiers (enum values such as "assign").

export interface SanitizeOptions {
  /** Seconds added to every timestamp. Use a random value per recording. */
  timeShiftSeconds: number;
  /** Origin whose URLs keep their path (other hosts are replaced). */
  origin: string;
}

const PERSON_KEYS = new Set([
  'userfullname', 'userfromfullname', 'usertofullname', 'firstname', 'lastname',
  'middlename', 'alternatename', 'firstnamephonetic', 'lastnamephonetic', 'fullnamedisplay',
]);
const COURSE_NAME_KEYS = new Set(['fullname', 'displayname', 'fullnamedisplay', 'coursename']);
const LOGIN_ID_KEYS = new Set(['username', 'idnumber']);
const SECRET_KEYS = new Set(['sesskey', 'token', 'wstoken', 'privatetoken']);
const LONG_TEXT_KEYS = new Set([
  'description', 'summary', 'fullmessage', 'fullmessagehtml', 'smallmessage', 'message',
  'text', 'intro', 'content', 'alttext', 'formattedtime', 'timeusermidnight_text', 'messagehtml',
]);
const TITLE_LABELS: Record<string, string> = {
  name: 'Aktivitas', title: 'Bagian', subject: 'Notifikasi', shortenedsubject: 'Notifikasi',
  contexturlname: 'Tautan', activityname: 'Aktivitas', sectionname: 'Bagian', categoryname: 'Kategori',
};
const GRADE_KEYS = new Set(['grade', 'rawgrade', 'finalgrade', 'gradeformatted']);
const TIME_KEY = /^(time(start|end|sort|created|modified|read|due|open|close|usermidnight)?|startdate|enddate|lastaccess|timeaccess)$/;
const ID_NAMESPACE_BY_PARENT: Record<string, string> = {
  course: 'course', courses: 'course', cm: 'cm', section: 'section', events: 'event',
  event: 'event', notifications: 'notification', users: 'user', user: 'user',
};
const ID_NAMESPACE_BY_KEY: Record<string, string> = {
  userid: 'user', useridfrom: 'user', useridto: 'user', courseid: 'course', cmid: 'cm',
  coursemoduleid: 'cm', sectionid: 'section', instance: 'instance', eventid: 'event',
  firstid: 'event', lastid: 'event',
};
const SAFE_IDENTIFIER = /^[a-z][a-z0-9_\-]{0,39}$/;
const ANCHOR = /^(module|section)-(\d+)$/;
const LOREM = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ';

class Context {
  private readonly ids = new Map<string, Map<number, number>>();
  private readonly labels = new Map<string, Map<string, string>>();
  readonly options: SanitizeOptions;

  constructor(options: SanitizeOptions) {
    this.options = options;
  }

  id(namespace: string, value: number): number {
    const table = this.ids.get(namespace) ?? new Map<number, number>();
    this.ids.set(namespace, table);
    const existing = table.get(value);
    if (existing !== undefined) return existing;
    const next = (namespace === 'user' ? 1 : 101) + table.size;
    table.set(value, next);
    return next;
  }

  /** Same original string always maps to the same placeholder within one run. */
  label(kind: string, original: string, make: (n: number) => string): string {
    const table = this.labels.get(kind) ?? new Map<string, string>();
    this.labels.set(kind, table);
    const existing = table.get(original);
    if (existing !== undefined) return existing;
    const next = make(table.size + 1);
    table.set(original, next);
    return next;
  }
}

export function sanitizeJson(value: unknown, options: SanitizeOptions): unknown {
  return walk(value, null, null, new Context(options));
}

/** Arrays of ids whose items need remapping (e.g. section.cmlist). */
const ID_LIST_NAMESPACE: Record<string, string> = { cmlist: 'cm' };

function walk(value: unknown, key: string | null, parentKey: string | null, ctx: Context): unknown {
  if (Array.isArray(value)) {
    const listNamespace = key ? ID_LIST_NAMESPACE[key] : undefined;
    if (listNamespace) return value.map((item) => remapIdLike(item, listNamespace, ctx));
    return value.map((item) => walk(item, key, parentKey, ctx));
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const courseLike = 'shortname' in obj || key === 'course' || key === 'courses';
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, courseLike ? walkCourseField(k, v, key, ctx) : walk(v, k, key, ctx)]),
    );
  }
  if (typeof value === 'number') return sanitizeNumber(value, key, parentKey, ctx);
  if (typeof value === 'string') return sanitizeString(value, key, parentKey, ctx);
  return value;
}

function idNamespace(key: string | null, parentKey: string | null): string | undefined {
  if (key === null) return undefined;
  return key === 'id' ? (ID_NAMESPACE_BY_PARENT[parentKey ?? ''] ?? parentKey ?? 'root') : ID_NAMESPACE_BY_KEY[key];
}

/** Remaps a number or numeric string, keeping its type. */
function remapIdLike(item: unknown, namespace: string, ctx: Context): unknown {
  if (typeof item === 'number' && Number.isInteger(item) && item > 0) return ctx.id(namespace, item);
  if (typeof item === 'string' && /^\d+$/.test(item) && Number(item) > 0) return String(ctx.id(namespace, Number(item)));
  return item;
}

function walkCourseField(k: string, v: unknown, parentKey: string | null, ctx: Context): unknown {
  if (typeof v === 'string' && COURSE_NAME_KEYS.has(k)) {
    return ctx.label('course', v, (n) => `Mata Kuliah ${letters(n)}`);
  }
  if (typeof v === 'string' && k === 'shortname') {
    return ctx.label('courseShort', v, (n) => `MK${letters(n)}-${String(n).padStart(3, '0')}`);
  }
  return walk(v, k, parentKey ?? 'course', ctx);
}

function sanitizeNumber(value: number, key: string | null, parentKey: string | null, ctx: Context): number {
  if (key === null || !Number.isInteger(value)) return value;
  if (TIME_KEY.test(key)) return value > 0 ? value + ctx.options.timeShiftSeconds : value;
  if (GRADE_KEYS.has(key)) return fakeGrade(value);
  const namespace = idNamespace(key, parentKey);
  return namespace && value > 0 ? ctx.id(namespace, value) : value;
}

function sanitizeString(value: string, key: string | null, parentKey: string | null, ctx: Context): string {
  if (value === '') return value;
  // Ids exported as numeric strings (course state) are remapped like numbers.
  const namespace = idNamespace(key, parentKey);
  if (namespace && /^\d+$/.test(value)) return String(remapIdLike(value, namespace, ctx));
  const nested = tryParseJson(value);
  if (nested !== undefined) return JSON.stringify(walk(nested, key, null, ctx));

  if (key !== null) {
    if (SECRET_KEYS.has(key)) return 'SESSKEY';
    if (PERSON_KEYS.has(key) || key === 'fullname') return ctx.label('person', value, (n) => `Mahasiswa ${n}`);
    if (LOGIN_ID_KEYS.has(key)) return ctx.label('login', value, (n) => `D${String(n).padStart(9, '0')}`);
    if (key === 'email') return ctx.label('email', value, (n) => `user${n}@example.test`);
    const titleLabel = TITLE_LABELS[key];
    if (titleLabel) return ctx.label(`title:${titleLabel}`, value, (n) => `${titleLabel} ${n}`);
    if (LONG_TEXT_KEYS.has(key)) return lorem(value);
    if (GRADE_KEYS.has(key) && /^\d+(\.\d+)?$/.test(value)) return String(fakeGrade(Number(value)));
  }

  if (/^https?:\/\//i.test(value)) return sanitizeUrl(value, ctx);
  const anchor = ANCHOR.exec(value);
  if (anchor) return `${anchor[1]}-${ctx.id(anchor[1] === 'module' ? 'cm' : 'section', Number(anchor[2]))}`;
  if (SAFE_IDENTIFIER.test(value) || /^\d+$/.test(value)) return value;
  return ctx.label('text', value, (n) => `Teks ${n}`);
}

function sanitizeUrl(raw: string, ctx: Context): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'https://example.test/link';
  }
  if (url.origin !== ctx.options.origin) return 'https://example.test/link';
  if (/pluginfile\.php|\/user\/pix|\/theme\/image|\/image\.php/.test(url.pathname)) return 'https://example.test/file';

  const kept = new URLSearchParams();
  for (const [param, value] of url.searchParams) {
    const replacement = sanitizeParam(url.pathname, param, value, ctx);
    if (replacement !== null) kept.set(param, replacement);
  }
  const query = kept.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
}

function sanitizeParam(pathname: string, param: string, value: string, ctx: Context): string | null {
  if (param === 'sesskey' || param === 'key' || param === 'token') return 'SESSKEY';
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  if (param === 'id') {
    if (pathname.startsWith('/mod/')) return String(ctx.id('cm', n));
    if (pathname.startsWith('/course/')) return String(ctx.id('course', n));
    if (pathname.startsWith('/user/')) return String(ctx.id('user', n));
    return null;
  }
  const namespace = { course: 'course', cmid: 'cm', userid: 'user', user: 'user', event: 'event', eventid: 'event' }[param];
  return namespace ? String(ctx.id(namespace, n)) : null;
}

function tryParseJson(value: string): unknown {
  const t = value.trim();
  if (!(t.startsWith('{') || t.startsWith('['))) return undefined;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return undefined;
  }
}

function lorem(original: string): string {
  const length = Math.max(1, original.replace(/<[^>]*>/g, '').length);
  const text = LOREM.repeat(Math.ceil(length / LOREM.length)).slice(0, length).trim() || 'Lorem';
  return original.trimStart().startsWith('<') ? `<p>${text}</p>` : text;
}

/** Deterministic fake grade in the same range (0..max(100, value)). */
function fakeGrade(value: number): number {
  const max = Math.max(100, Math.ceil(value));
  return Math.round(((value * 7919 + 13) % (max + 1)) * 100) / 100;
}

function letters(n: number): string {
  let out = '';
  let i = n;
  while (i > 0) {
    const r = (i - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    i = Math.floor((i - 1) / 26);
  }
  return out;
}
