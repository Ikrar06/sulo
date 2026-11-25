// Sanitizer for saved Sipakamase pages (sipakamase.unhas.ac.id), so their
// shape can be studied and turned into test fixtures without the owner's data.
// Written without ever seeing a real page, so nothing is trusted by default:
//
// - Markup stays: tag names, attribute names, class and id.
// - Table cells, form fields and options keep a value only when the whole
//   value is on the safe list (sipakamase-kosakata.ts), a semester or a
//   course code. Numbers become other numbers of the same shape, letter
//   grades become one fixed grade, everything else "Teks sintetis N".
// - Running text (headings, labels, buttons, rule text) and script strings
//   keep dictionary words only. Other words become "xxx", and a run of
//   capitalized words holding one unknown word is masked whole (a name).
// - Whatever was replaced in one place is replaced everywhere, in every file
//   of the run (`finish`), so a name cannot survive in a script or a link.
//
// One instance handles one run: numbering and the salt for replaced numbers
// are shared across the files, which keeps cross references between pages.

import { tokenizeHtml, VOID_TAGS, type HtmlAttr, type HtmlToken } from './html-tokens.ts';
import { DICTIONARY, isSafeCell } from './sipakamase-kosakata.ts';

export const SYNTHETIC = { email: 'mahasiswa@example.invalid', nim: 'D000000001', phone: '080000000000', grade: 'B', word: 'xxx' } as const;

export interface SipakamaseOptions {
  /** Mixed into replaced numbers. Random per run, so a number cannot be worked back. */
  salt: string;
  /** More words the owner has cleared for running text (interface words only). */
  extraWords?: readonly string[];
}

export const COUNT_KEYS = ['cellsKept', 'cellsReplaced', 'wordsKept', 'wordsMasked', 'numbers', 'grades', 'emails', 'studentNumbers', 'phones', 'attributes', 'urls', 'scripts', 'comments'] as const;
export type SipakamaseCounts = Record<(typeof COUNT_KEYS)[number], number>;

const EMAIL = String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}`;
/** Unhas course code: curriculum year, a letter, eight digits (23U02130102). */
const COURSE_CODE = String.raw`(?<![A-Za-z0-9])\d{2}[A-Z]\d{8}(?![A-Za-z0-9])`;
const NIM = String.raw`(?<![A-Za-z0-9])[A-Za-z]\d{8,10}(?![A-Za-z0-9])`;
const PHONE = String.raw`(?<![A-Za-z\d.])(?:\+?62|0)[\s-]?8(?:[\s-]?\d){7,11}(?!\d)`;
const TOKEN = new RegExp(
  `(?<entity>&(?:#\\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);)|(?<literal>Q\\s*&(?:amp;)?\\s*A)|(?<email>${EMAIL})|(?<code>${COURSE_CODE})|(?<nim>${NIM})|(?<phone>${PHONE})|(?<word>\\p{L}(?:[\\p{L}\\p{N}]|['’](?=\\p{L}))*)|(?<num>\\p{N}+)`,
  'gu',
);
const TERM = '(?:ganjil|genap|antara|awal|akhir|pendek)';
const YEARS = String.raw`(?:19|20)\d{2}\s*\/\s*(?:19|20)\d{2}`;
const SEMESTER = new RegExp(`^(?:semester\\s+\\d{1,2}|(?:semester\\s+)?(?:${TERM}\\s+)?(?:ta\\.?\\s+)?${YEARS}(?:\\s*[-–(]?\\s*${TERM}\\)?)?|(?:19|20)\\d{2}[1-3])$`, 'i');
const UNITS = new Set(['sks', 'dari', 'jam', 'menit', 'hari', 'minggu', 'bulan', 'tahun', 'poin', 'kegiatan', 'mk', 'semester', 'kali', 'orang', 'ke', 'per', 'total', 'jumlah']);

const URL_ATTRS = new Set([
  'href', 'src', 'action', 'formaction', 'data-url', 'data-href', 'data-src', 'data-link', 'poster', 'cite', 'background', 'longdesc', 'manifest',
  // htmx: the request an element makes.
  'hx-get', 'hx-post', 'hx-put', 'hx-patch', 'hx-delete', 'hx-push-url', 'hx-replace-url',
]);
/** htmx and hyperscript attributes that hold selectors, event names or a small script: read like a script string. */
const SCRIPT_ATTRS = /^(?:_|hx-(?:target|swap|swap-oob|trigger|indicator|select|select-oob|include|ext|boost|sync|params|encoding|disabled-elt|disinherit|inherit|history|history-elt|preserve|validate)|data-hx-[a-z-]+|data-script)$/;
/** htmx attributes that hold JSON or code. */
const CODE_ATTRS = /^(?:hx-(?:vals|headers|request|vars)|hx-on[:-].*)$/;
const PROSE_ATTRS = new Set(['title', 'alt', 'placeholder', 'aria-label', 'aria-description', 'aria-valuetext', 'aria-placeholder', 'data-original-title', 'data-title', 'data-content', 'data-confirm', 'data-placeholder', 'data-text', 'label', 'summary']);
const KEEP_ATTRS = new Set([
  'class', 'id', 'type', 'role', 'rel', 'target', 'method', 'enctype', 'colspan', 'rowspan', 'scope', 'align', 'valign', 'width', 'height', 'border', 'cellpadding',
  'cellspacing', 'lang', 'dir', 'charset', 'for', 'name', 'http-equiv', 'media', 'tabindex', 'autocomplete', 'rows', 'cols', 'maxlength', 'minlength', 'size', 'span',
  'wrap', 'accept', 'as', 'loading', 'decoding', 'crossorigin', 'referrerpolicy', 'sizes', 'viewbox', 'fill', 'stroke', 'style', 'form', 'headers', 'step', 'min', 'max',
]);
const KEEP_ATTR_PREFIX = /^(?:aria-|xmlns|xml:|data-(?:toggle|target|dismiss|parent|placement|widget|backdrop|keyboard|slide|ride|card-widget|bs-|dt-))/;
/** Elements whose text is the page's own wording even inside a table cell. */
/** In "Label: value", a label ending in one of these is followed by someone's data, never by the page's own wording. */
const DATA_LABELS = new Set([
  'deskripsi', 'uraian', 'keterangan', 'catatan', 'komentar', 'nama', 'judul', 'tempat', 'lokasi', 'penyelenggara', 'pendamping', 'verifikator', 'dosen', 'pembimbing',
  'prodi', 'studi', 'fakultas', 'jurusan', 'departemen', 'email', 'hp', 'telepon', 'alamat', 'nim', 'nip', 'nilai', 'kegiatan', 'alasan', 'pesan', 'peran', 'jabatan',
  'posisi', 'lahir', 'kelamin', 'agama', 'angkatan', 'ipk', 'ips',
]);
const UI_TAGS = new Set(['button', 'label', 'th', 'dt', 'legend', 'caption', 'summary']);
const UI_LINK = /(?:^|\s)(?:btn|button|dropdown-item|nav-link|page-link)(?:[\s-]|$)/;
/** Elements whose text is a value: kept only when the whole value is safe. */
const CELL_TAGS = new Set(['dd', 'option', 'optgroup', 'select', 'textarea', 'pre', 'code', 'datalist', 'output']);
/** Opening one of these closes an open one of the same group, up to the boundary. */
const IMPLIED_CLOSE: Record<string, { close: string[]; boundary: string[] }> = {
  td: { close: ['td', 'th'], boundary: ['tr', 'table'] },
  th: { close: ['td', 'th'], boundary: ['tr', 'table'] },
  tr: { close: ['tr'], boundary: ['table'] },
  tbody: { close: ['tbody', 'thead', 'tfoot'], boundary: ['table'] },
  thead: { close: ['tbody', 'thead', 'tfoot'], boundary: ['table'] },
  tfoot: { close: ['tbody', 'thead', 'tfoot'], boundary: ['table'] },
  option: { close: ['option'], boundary: ['select', 'datalist'] },
  li: { close: ['li'], boundary: ['ul', 'ol'] },
  dt: { close: ['dt', 'dd'], boundary: ['dl'] },
  dd: { close: ['dt', 'dd'], boundary: ['dl'] },
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const plain = (s: string) => s.replace(/&nbsp;|&#160;| /g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const phraseKey = (s: string) => s.replace(/(?:\s|&nbsp;)+/g, ' ').trim().toLowerCase();
const lettersOf = (s: string) => s.match(/\p{L}+/gu) ?? [];
/** Numeric character references that spell letters, digits or spaces, as the characters themselves. */
const decodeNumeric = (s: string) =>
  s.replace(/&#(?:(\d{1,7})|x([0-9a-fA-F]{1,6}));/g, (whole, dec: string | undefined, hex: string | undefined) => {
    const code = dec !== undefined ? Number(dec) : parseInt(hex!, 16);
    const char = code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    return /^[\p{L}\p{N} ]$/u.test(char) ? char : whole;
  });

function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Which cells are labels of a key-value layout: "NIM :" or a cell followed by ":". */
function labelCells(tokens: readonly HtmlToken[]): Set<number> {
  const labels = new Set<number>();
  let row: { at: number; text: string }[] = [];
  const endRow = () => {
    row.forEach((cell, k) => {
      const own = plain(cell.text);
      const next = row[k + 1] ? plain(row[k + 1]!.text) : '';
      if ((own.length > 1 && /[:：]$/.test(own)) || /^[:：]/.test(next)) labels.add(cell.at);
    });
    row = [];
  };
  tokens.forEach((t, at) => {
    if (t.kind === 'open' || t.kind === 'close') {
      const name = t.name.toLowerCase();
      if (name === 'tr' || name === 'table') endRow();
      else if (t.kind === 'open' && (name === 'td' || name === 'th')) row.push({ at, text: '' });
    } else if (t.kind === 'text' && row.length > 0) {
      row[row.length - 1]!.text += t.raw;
    }
  });
  endRow();
  return labels;
}

export class SipakamaseSanitizer {
  readonly counts: SipakamaseCounts = Object.fromEntries(COUNT_KEYS.map((k) => [k, 0])) as SipakamaseCounts;
  private readonly salt: string;
  private readonly words: ReadonlySet<string>;
  /** Replaced cell values and their labels: replaced wherever they appear. */
  private readonly phrases = new Map<string, string>();
  /** Unknown words from replaced cells and fields (people, places): masked everywhere. */
  private readonly names = new Set<string>();
  /** Words masked in the pages' running text, with how often. */
  private readonly masked = new Map<string, number>();
  /** Names written as one word ("andibaso"), from values of two to five words: masked wherever they occur. */
  private readonly joined = new Set<string>();
  /** Shapes of opaque path segments ("7.27": seven characters, a dot, twenty-seven), with how often. Lengths only. */
  private readonly shapes = new Map<string, number>();
  /** Identifier-shaped values seen in the raw input, for the final check. */
  private readonly rawIds = new Set<string>();

  constructor(options: SipakamaseOptions) {
    this.salt = options.salt;
    this.words = new Set([...DICTIONARY, ...(options.extraWords ?? []).map((w) => w.toLowerCase())]);
  }

  // ---- Numbers ----

  /** Another digit run of the same length. Runs of 8 or more become zeros and three digits. */
  private digits(run: string): string {
    this.counts.numbers += 1;
    if (run.length >= 8) return `${'0'.repeat(run.length - 3)}${String(fnv(`${this.salt}|${run}`) % 1000).padStart(3, '0')}`;
    const out = [...run].map((_d, i) => {
      const h = fnv(`${this.salt}|${run}|${i}`);
      if (i === 0) return run.length > 1 && run[0] === '0' ? '0' : String(1 + (h % 9));
      return String(h % 10);
    });
    if (out.join('') === run) out[out.length - 1] = String(((Number(out[out.length - 1]) + 1) % 9) + 1);
    return out.join('');
  }

  // ---- Words ----

  private isWord(word: string): boolean {
    // One letter: an initial or a variable. A to E could be a grade, and a digit is never a word.
    if (word.length === 1) return /^\p{L}$/u.test(word) && !/[A-E]/.test(word);
    const lower = word.toLowerCase().replace(/’/g, "'");
    if (this.words.has(lower)) return true;
    const stem = /^(.{4,})(?:nya|lah|kah|pun)$/.exec(lower);
    if (stem && this.words.has(stem[1]!)) return true;
    const parts = word.split(/(?<=[\p{Ll}\p{N}])(?=\p{Lu})|(?<=\p{Lu})(?=\p{Lu}\p{Ll})/u);
    return parts.length > 1 && parts.every((p) => p.length === 1 || this.words.has(p.toLowerCase()));
  }

  /** Running text: dictionary words stay, the rest is masked. `track` remembers masked words for the whole run. */
  private prose(text: string, track = false): string {
    type Part = { out: string; word?: { raw: string; keep: boolean; cap: boolean } };
    const parts: Part[] = [];
    let last = 0;
    for (const m of text.matchAll(TOKEN)) {
      if (m.index > last) parts.push({ out: text.slice(last, m.index) });
      last = m.index + m[0].length;
      const g = m.groups!;
      if (g.entity !== undefined || g.literal !== undefined || g.code !== undefined) parts.push({ out: m[0] });
      else if (g.email !== undefined) parts.push({ out: this.fixed('emails', SYNTHETIC.email) });
      else if (g.nim !== undefined) parts.push({ out: this.fixed('studentNumbers', SYNTHETIC.nim) });
      else if (g.phone !== undefined) parts.push({ out: this.fixed('phones', SYNTHETIC.phone) });
      else if (g.num !== undefined) parts.push({ out: this.digits(m[0]) });
      else parts.push({ out: m[0], word: { raw: m[0], keep: this.isWord(m[0]), cap: /^\p{Lu}/u.test(m[0]) } });
    }
    if (last < text.length) parts.push({ out: text.slice(last) });

    // A run of capitalized words with one unknown word in it is a name: mask the run.
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i]!.word?.cap) continue;
      const run = [i];
      let j = i;
      while (parts[j + 1] && !parts[j + 1]!.word && /^(?:[\s.,'’-]|&nbsp;){1,4}$/.test(parts[j + 1]!.out) && parts[j + 2]?.word?.cap) {
        j += 2;
        run.push(j);
      }
      if (run.length >= 2 && run.some((k) => !parts[k]!.word!.keep)) {
        // Two unknown words in the run: a person or a place, remembered for the whole run of files.
        if (track && run.filter((k) => !parts[k]!.word!.keep).length >= 2) this.rememberNames(run.map((k) => parts[k]!.word!.raw).join(' '));
        for (const k of run) parts[k]!.word!.keep = false;
      }
      i = j;
    }

    return parts
      .map((p) => {
        if (!p.word) return p.out;
        if (p.word.keep) {
          this.counts.wordsKept += 1;
          return p.out;
        }
        this.counts.wordsMasked += 1;
        const lower = p.word.raw.toLowerCase();
        if (track && lower.length >= 4 && !this.words.has(lower)) this.masked.set(lower, (this.masked.get(lower) ?? 0) + 1);
        return SYNTHETIC.word;
      })
      .join('');
  }

  private fixed(key: 'emails' | 'studentNumbers' | 'phones' | 'grades', value: string): string {
    this.counts[key] += 1;
    return value;
  }

  /** Identifier patterns only, for text that is otherwise kept (class, id, style, code). */
  private light(text: string): string {
    return text
      .replace(new RegExp(EMAIL, 'g'), () => this.fixed('emails', SYNTHETIC.email))
      .replace(new RegExp(NIM, 'g'), () => this.fixed('studentNumbers', SYNTHETIC.nim))
      .replace(new RegExp(PHONE, 'g'), () => this.fixed('phones', SYNTHETIC.phone))
      .replace(/\d{5,}/g, (d) => this.digits(d));
  }

  private rememberNames(value: string): void {
    const all = lettersOf(value).map((w) => w.toLowerCase());
    for (const w of all) if (w.length >= 3 && !this.words.has(w)) this.names.add(w);
    if (all.length < 2 || all.length > 5 || all.every((w) => this.words.has(w))) return;
    // The same name written as one word: every stretch of two or more neighbours.
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 2; j <= all.length; j++) {
        const glued = all.slice(i, j).join('');
        if (glued.length >= 6) this.joined.add(glued);
      }
    }
  }

  /** A text node outside cells: "Label: value" and ": value" hold a value, the rest is wording. */
  private textNode(raw: string): string {
    const bare = /^(\s*[:：]\s*)(\S[\s\S]*)$/.exec(raw);
    if (bare) return `${bare[1]}${this.cell(bare[2]!)}`;
    const pair = /^(\s*)([^:：\n]{1,60}?)(\s*[:：]\s+)(\S[\s\S]*)$/.exec(raw);
    const labelWords = pair ? lettersOf(pair[2]!) : [];
    if (pair && labelWords.length >= 1 && labelWords.length <= 5 && labelWords.every((w) => this.isWord(w)) && DATA_LABELS.has(labelWords[labelWords.length - 1]!.toLowerCase())) {
      return `${pair[1]}${this.prose(pair[2]!, true)}${pair[3]}${this.cell(pair[4]!)}`;
    }
    return this.prose(raw, true);
  }

  private label(core: string): string {
    const key = phraseKey(core);
    const known = this.phrases.get(key);
    if (known) return known;
    const next = `Teks sintetis ${this.phrases.size + 1}`;
    this.phrases.set(key, next);
    this.rememberNames(core);
    return next;
  }

  /** A whole value (cell, option, field): kept only when it is on the safe list. */
  private cell(text: string): string {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
    const core = plain(m[2]!);
    if (core === '') return text;
    if (isSafeCell(core) || SEMESTER.test(core) || new RegExp(`^${COURSE_CODE}$`).test(core) || /^[^\p{L}\p{N}]+$/u.test(core)) {
      this.counts.cellsKept += 1;
      return text;
    }
    this.counts.cellsReplaced += 1;
    return `${m[1]}${this.cellValue(core)}${m[3]}`;
  }

  private cellValue(core: string): string {
    if (new RegExp(`^${EMAIL}$`).test(core)) return this.fixed('emails', SYNTHETIC.email);
    if (new RegExp(`^${NIM}$`).test(core)) return this.fixed('studentNumbers', SYNTHETIC.nim);
    if (new RegExp(`^${PHONE}$`).test(core)) return this.fixed('phones', SYNTHETIC.phone);
    if (/^[\d\s.,:/%+\-()]+$/.test(core)) return core.replace(/\d+/g, (d) => this.digits(d));
    if (/^[A-Z]{1,2}[+-]?$/.test(core)) return this.fixed('grades', SYNTHETIC.grade);
    // "2 SKS", "3 dari 4": the words are units, the numbers are replaced.
    if (/\d/.test(core) && lettersOf(core).every((w) => UNITS.has(w.toLowerCase()))) return this.prose(core);
    return this.label(core);
  }

  /** A value with letters replaced by x and digits by other digits, at most 32 characters. */
  private opaque(value: string): string {
    return value.slice(0, 32).replace(/\p{Lu}/gu, 'X').replace(/\p{L}/gu, 'x').replace(/\d+/g, (d) => this.digits(d));
  }

  /** An attribute or query value that is not markup, a link or wording. */
  private field(value: string): string {
    const core = plain(value);
    if (core === '') return value;
    if (/\s/.test(core)) return this.cell(value);
    if (isSafeCell(core) || this.isWord(core)) return value;
    if (new RegExp(`^${EMAIL}$`).test(core)) return this.fixed('emails', SYNTHETIC.email);
    if (new RegExp(`^${NIM}$`).test(core)) return this.fixed('studentNumbers', SYNTHETIC.nim);
    if (new RegExp(`^${PHONE}$`).test(core)) return this.fixed('phones', SYNTHETIC.phone);
    if (/^\d+$/.test(core)) return this.digits(core);
    // A value with digits in it is a token or an id, not a name.
    if (!/\d/.test(core)) this.rememberNames(core);
    return this.opaque(core);
  }

  // ---- Links ----

  private segment(seg: string): string {
    if (seg === '' || seg === '.' || seg === '..') return seg;
    if (/^\d+$/.test(seg)) return this.digits(seg);
    const file = /^(.*?)((?:\.[A-Za-z0-9]{1,5}){1,3})$/.exec(seg);
    const base = file ? file[1]! : seg;
    const tail = file ? file[2]! : '';
    // A route name: lowercase letters only, no extension.
    if (!file && /^[a-z][a-z_-]{0,39}$/.test(base)) return seg;
    const words = base.split(/[^\p{L}]+/u).filter(Boolean);
    if (words.length > 0 && words.every((w) => this.isWord(w))) return `${base.replace(/\d{5,}/g, (d) => this.digits(d))}${tail}`;
    // The lengths of an id token's parts hint at how the server signs it; nothing of its content is kept.
    if (seg.length >= 12) {
      const shape = seg.split('.').map((part) => part.length).join('.');
      this.shapes.set(shape, (this.shapes.get(shape) ?? 0) + 1);
    }
    return `${this.opaque(base)}${tail}`;
  }

  /** A link: host and route names stay, ids become other numbers, query values and opaque parts are masked. */
  url(raw: string): string {
    const value = raw.trim();
    if (value === '') return raw;
    this.counts.urls += 1;
    if (/^data:/i.test(value)) return value.replace(/^(data:[^,]*,)[\s\S]*$/i, '$1x');
    if (/^javascript:/i.test(value)) return `javascript:${this.js(value.slice(11))}`;
    if (/^mailto:/i.test(value)) return `mailto:${SYNTHETIC.email}`;
    if (/^(?:tel|sms):/i.test(value)) return `tel:${SYNTHETIC.phone}`;
    const clean = this.light(value);
    const m = /^((?:[a-z][a-z0-9+.-]*:)?(?:\/\/[^/?#]*)?)([^?#]*)(\?[^#]*)?(#[\s\S]*)?$/i.exec(clean);
    if (!m) return this.opaque(clean);
    const origin = m[1]!.replace(/\/\/[^@/]*@/, '//');
    const path = m[2]!.split('/').map((s) => this.segment(s)).join('/');
    const query = (m[3] ?? '')
      .slice(1)
      .split(/(&amp;|&)/)
      .map((piece, k) => {
        if (k % 2 === 1 || piece === '') return piece;
        const [name, ...rest] = piece.split('=');
        const safeName = /^[\w\-.[\]%]{1,40}$/.test(name!) ? name! : 'x';
        return rest.length > 0 ? `${safeName}=${this.field(rest.join('='))}` : safeName;
      })
      .join('');
    return `${origin}${path}${m[3] ? `?${query}` : ''}${m[4] ? `#${this.prose(m[4].slice(1))}` : ''}`;
  }

  // ---- Scripts ----

  private jsString(body: string): string {
    if (body === '') return body;
    const linkLike = /^(?:https?:)?\/\//i.test(body) || /^\.{0,2}\/[^\s<>]*$/.test(body) || /^[\w\-.~%]+(?:\/[\w\-.~%]+)+\/?(?:\?[^\s<>]*)?$/.test(body);
    if (linkLike) return this.url(body);
    // Escapes stay as they are, the text between them is treated as wording.
    return body.split(/(\\(?:u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S]))/).map((p, k) => (k % 2 === 1 ? p : this.prose(p))).join('');
  }

  private jsCode(code: string): string {
    return this.light(code).replace(/(?<![\w$.])\d+(?:\.\d+)?(?![\w$])/g, (n) => (n === '0' || n === '1' ? n : n.replace(/\d+/g, (d) => this.digits(d))));
  }

  /** Script text: code stays, strings and comments keep dictionary words, numbers are replaced. */
  js(code: string): string {
    const n = code.length;
    let out = '';
    let i = 0;
    let codeStart = 0;
    let prev = '';
    const flush = (end: number) => {
      if (end > codeStart) out += this.jsCode(code.slice(codeStart, end));
    };
    while (i < n) {
      const c = code[i]!;
      if (c === '"' || c === "'" || c === '`') {
        let j = i + 1;
        while (j < n && code[j] !== c && !(c !== '`' && code[j] === '\n')) j += code[j] === '\\' ? 2 : 1;
        j = Math.min(j, n);
        const closed = code[j] === c;
        flush(i);
        out += `${c}${this.jsString(code.slice(i + 1, j))}${closed ? c : ''}`;
        i = codeStart = closed ? j + 1 : j;
        prev = c;
      } else if (c === '/' && code[i + 1] === '/') {
        const end = code.indexOf('\n', i);
        const stop = end < 0 ? n : end;
        flush(i);
        out += `//${this.prose(code.slice(i + 2, stop))}`;
        i = codeStart = stop;
      } else if (c === '/' && code[i + 1] === '*') {
        const end = code.indexOf('*/', i + 2);
        const stop = end < 0 ? n : end;
        flush(i);
        out += `/*${this.prose(code.slice(i + 2, stop))}${end < 0 ? '' : '*/'}`;
        i = codeStart = end < 0 ? n : end + 2;
      } else if (c === '/' && (prev === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prev) || /\b(?:return|typeof|case|of|in|do|else|void|delete)\s*$/.test(code.slice(Math.max(0, i - 12), i)))) {
        // A regular expression literal: skipped as code, so a quote inside it does not open a string.
        let j = i + 1;
        let inClass = false;
        while (j < n && code[j] !== '\n' && (inClass || code[j] !== '/')) {
          if (code[j] === '\\') j += 1;
          else if (code[j] === '[') inClass = true;
          else if (code[j] === ']') inClass = false;
          j += 1;
        }
        i = code[j] === '/' ? j + 1 : i + 1;
        prev = '/';
      } else {
        if (!/\s/.test(c)) prev = c;
        i += 1;
      }
    }
    flush(n);
    return out;
  }

  // ---- Markup ----

  private attribute(tag: string, type: string, attr: HtmlAttr): string {
    const name = attr.name.toLowerCase();
    const value = attr.value ?? '';
    if (value === '') return value;
    this.counts.attributes += 1;
    if (name.startsWith('on')) return this.js(value.replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'"));
    if (URL_ATTRS.has(name)) return /^(?:true|false)$/i.test(value) ? value : this.url(value);
    if (CODE_ATTRS.test(name)) return this.js(value.replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'"));
    if (SCRIPT_ATTRS.test(name)) return this.jsString(value);
    if (name === 'srcset') return value.split(',').map((part) => part.trim().split(/\s+/).map((p, k) => (k === 0 ? this.url(p) : p)).join(' ')).join(', ');
    if (PROSE_ATTRS.has(name) || name === 'hx-confirm' || name === 'hx-prompt') return this.prose(value, true);
    if (name === 'value') return tag === 'button' || (tag === 'input' && /^(?:submit|button|reset)$/.test(type)) ? this.prose(value, true) : this.field(value);
    if (KEEP_ATTRS.has(name) || KEEP_ATTR_PREFIX.test(name)) return this.light(value);
    return this.field(value);
  }

  private openTag(token: Extract<HtmlToken, { kind: 'open' }>): string {
    const tag = token.name.toLowerCase();
    const type = (token.attrs.find((a) => a.name.toLowerCase() === 'type')?.value ?? '').toLowerCase();
    const attrs = token.attrs.map((a) => {
      if (a.value === null) return ` ${a.name}`;
      const value = this.attribute(tag, type, { ...a, value: decodeNumeric(a.value) });
      return ` ${a.name}=${a.quote}${a.quote === '"' ? value.replace(/"/g, '&quot;') : value.replace(/'/g, '&#39;')}${a.quote}`;
    });
    return `<${token.name}${attrs.join('')}${token.selfClose ? ' /' : ''}>`;
  }

  private rawText(token: Extract<HtmlToken, { kind: 'raw' }>): string {
    if (token.owner === 'title') return this.prose(token.raw, true);
    if (token.owner === 'textarea') return this.cell(token.raw);
    if (token.owner === 'style') return this.light(token.raw);
    this.counts.scripts += 1;
    const type = (token.attrs.find((a) => a.name.toLowerCase() === 'type')?.value ?? '').toLowerCase();
    return /template|html|handlebars|mustache/.test(type) ? this.html(token.raw) : this.js(token.raw);
  }

  /** One saved page or fragment. Call `finish` on the result once every file of the run has been through here. */
  html(raw: string): string {
    this.rememberRaw(raw);
    const tokens = tokenizeHtml(raw);
    const labels = labelCells(tokens);
    let stack: { name: string; at: number; ui: boolean }[] = [];
    const inCell = (): boolean => {
      for (let k = stack.length - 1; k >= 0; k--) {
        const el = stack[k]!;
        if (el.ui) return false;
        if (el.name === 'td') return !labels.has(el.at);
        if (CELL_TAGS.has(el.name)) return true;
      }
      return false;
    };
    return tokens
      .map((t, at) => {
        if (t.kind === 'text') return inCell() ? this.cell(decodeNumeric(t.raw)) : this.textNode(decodeNumeric(t.raw));
        if (t.kind === 'raw') return this.rawText(t);
        if (t.kind === 'comment') {
          this.counts.comments += 1;
          return '<!-- komentar dibuang -->';
        }
        if (t.kind === 'decl') return /^<!doctype[^>]*>$/i.test(t.raw) ? t.raw : '';
        const name = t.name.toLowerCase();
        if (t.kind === 'close') {
          const k = stack.findLastIndex((el) => el.name === name);
          if (k >= 0) stack = stack.slice(0, k);
          return `</${t.name}>`;
        }
        const implied = IMPLIED_CLOSE[name];
        if (implied) {
          const boundary = stack.findLastIndex((el) => implied.boundary.includes(el.name));
          const k = stack.findLastIndex((el) => implied.close.includes(el.name));
          if (k > boundary) stack = stack.slice(0, k);
        }
        if (!t.selfClose && !VOID_TAGS.has(name)) {
          const cls = t.attrs.find((a) => a.name.toLowerCase() === 'class')?.value ?? '';
          stack = [...stack, { name, at, ui: UI_TAGS.has(name) || (name === 'a' && UI_LINK.test(cls)) }];
        }
        return this.openTag(t);
      })
      .join('');
  }

  // ---- The whole run ----

  /** Emails, student numbers, phone numbers and long digit runs of the raw input: none may come out. */
  private rememberRaw(raw: string): void {
    for (const re of [new RegExp(EMAIL, 'g'), new RegExp(NIM, 'g'), new RegExp(PHONE, 'g'), /(?<!\d)\d{16}(?!\d)|(?<!\d)\d{18}(?!\d)/g]) {
      for (const m of raw.matchAll(re)) if (m[0] !== SYNTHETIC.email && m[0] !== SYNTHETIC.nim) this.rawIds.add(m[0]);
    }
  }

  /**
   * What the second pass looks for. Words are looked up per run of letters
   * rather than with one large alternation, which keeps a megabyte page fast.
   */
  private runIndex(text: string) {
    const lower = text.toLowerCase();
    const names = [...this.names].filter((w) => !this.words.has(w));
    const whole = new Set([...names, ...this.masked.keys()]);
    const inside = new Set([...names.filter((w) => w.length >= 6), ...this.joined]);
    const lengths = [...new Set([...inside].map((w) => w.length))];
    // Only phrases whose first and last word occur in this text at all.
    const phrases = [...this.phrases.keys()]
      .filter((p) => p.includes(' ') || lettersOf(p).join('').length >= 6)
      .filter((p) => {
        const parts = p.split(' ');
        return lower.includes(parts[0]!) && lower.includes(parts[parts.length - 1]!);
      })
      .sort((a, b) => b.length - a.length);
    return {
      lower,
      phrases: phrases.length > 0 ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${phrases.map((p) => p.split(' ').map(escapeRe).join('(?:\\s|&nbsp;)+')).join('|')})(?![\\p{L}\\p{N}])`, 'giu') : null,
      /** A run of letters that is a replaced word, or holds a name of six letters or more. */
      hit: (run: string): boolean => {
        const w = run.toLowerCase();
        if (w === SYNTHETIC.word) return false;
        if (whole.has(w)) return true;
        return lengths.some((n) => {
          for (let i = 0; i + n <= w.length; i++) if (inside.has(w.slice(i, i + n))) return true;
          return false;
        });
      },
    };
  }

  /** Second pass over one output: whatever was replaced anywhere in the run is replaced here too. */
  finish(text: string): string {
    const index = this.runIndex(text);
    const phrased = index.phrases ? text.replace(index.phrases, (m) => this.phrases.get(phraseKey(m)) ?? SYNTHETIC.word) : text;
    return phrased
      .replace(/\p{L}+/gu, (run) => (index.hit(run) ? SYNTHETIC.word : run))
      .replace(new RegExp(EMAIL, 'g'), (m) => (/@example\.(?:invalid|test)$/i.test(m) ? m : SYNTHETIC.email))
      .replace(new RegExp(NIM, 'g'), SYNTHETIC.nim)
      .replace(new RegExp(PHONE, 'g'), SYNTHETIC.phone);
  }

  /** How many replaced names, phrases or raw identifiers are still in `text`. Must be 0 before anything is written. */
  leftovers(text: string): number {
    const index = this.runIndex(text);
    const ids = [...this.rawIds].filter((id) => id !== SYNTHETIC.phone && index.lower.includes(id.toLowerCase())).length;
    return ids + (index.phrases ? (text.match(index.phrases) ?? []).length : 0) + (text.match(/\p{L}+/gu) ?? []).filter((run) => index.hit(run)).length;
  }

  /** Shapes of the id tokens found in links, most frequent first. */
  tokenShapes(): [string, number][] {
    return [...this.shapes.entries()].sort((a, b) => b[1] - a[1]);
  }

  /** Words masked in running text, most frequent first: for the owner's eyes only (they may be names). */
  maskedWords(): [string, number][] {
    return [...this.masked.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }
}
