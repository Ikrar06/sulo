// A small, forgiving HTML tokenizer: the page sanitizers and the Sipakamase
// readers (sipakamase/parse.ts). Text level only
// (no DOM), so it runs in Node without dependencies. It never throws: markup
// it cannot read comes back as text, which the caller treats as untrusted.

export interface HtmlAttr {
  name: string;
  /** null: the attribute has no value (`disabled`). */
  value: string | null;
  quote: '"' | "'";
}

export type HtmlToken =
  | { kind: 'text'; raw: string }
  | { kind: 'comment'; raw: string }
  | { kind: 'decl'; raw: string }
  /** The content of script, style, textarea or title, which holds no markup. */
  | { kind: 'raw'; raw: string; owner: string; attrs: HtmlAttr[] }
  | { kind: 'open'; name: string; attrs: HtmlAttr[]; selfClose: boolean }
  | { kind: 'close'; name: string };

const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);
export const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

const NAME = /[A-Za-z][^\s/>]*/y;
const SPACE = /\s*/y;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*)))?/y;
const CLOSE = /<\/([A-Za-z][^\s>/]*)[^>]*>?/y;

function readOpen(html: string, at: number): { name: string; attrs: HtmlAttr[]; selfClose: boolean; end: number } | null {
  NAME.lastIndex = at + 1;
  const name = NAME.exec(html);
  if (!name) return null;
  const attrs: HtmlAttr[] = [];
  let selfClose = false;
  let i = NAME.lastIndex;
  for (;;) {
    SPACE.lastIndex = i;
    SPACE.exec(html);
    i = SPACE.lastIndex;
    const c = html[i];
    if (c === undefined) return null;
    if (c === '>') return { name: name[0], attrs, selfClose, end: i + 1 };
    if (c === '/') {
      selfClose = html[i + 1] === '>';
      i += 1;
      continue;
    }
    ATTR.lastIndex = i;
    const m = ATTR.exec(html);
    if (!m) {
      i += 1;
      continue;
    }
    attrs.push({ name: m[1]!, value: m[2] ?? m[3] ?? m[4] ?? null, quote: m[3] !== undefined ? "'" : '"' });
    i = ATTR.lastIndex;
  }
}

export function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  const n = html.length;
  let i = 0;
  const text = (end: number) => {
    if (end > i) tokens.push({ kind: 'text', raw: html.slice(i, end) });
  };
  let from = 0;
  while (i < n) {
    const lt = html.indexOf('<', Math.max(i, from));
    if (lt < 0) break;
    const next = html[lt + 1] ?? '';
    if (html.startsWith('<!--', lt)) {
      text(lt);
      const end = html.indexOf('-->', lt + 4);
      const stop = end < 0 ? n : end + 3;
      tokens.push({ kind: 'comment', raw: html.slice(lt, stop) });
      i = from = stop;
    } else if (next === '!' || next === '?') {
      text(lt);
      const end = html.indexOf('>', lt);
      const stop = end < 0 ? n : end + 1;
      tokens.push({ kind: 'decl', raw: html.slice(lt, stop) });
      i = from = stop;
    } else if (next === '/' && /[A-Za-z]/.test(html[lt + 2] ?? '')) {
      text(lt);
      CLOSE.lastIndex = lt;
      const m = CLOSE.exec(html)!;
      tokens.push({ kind: 'close', name: m[1]! });
      i = from = CLOSE.lastIndex;
    } else if (/[A-Za-z]/.test(next)) {
      const tag = readOpen(html, lt);
      if (!tag) break;
      text(lt);
      tokens.push({ kind: 'open', name: tag.name, attrs: tag.attrs, selfClose: tag.selfClose });
      i = from = tag.end;
      const owner = tag.name.toLowerCase();
      if (RAW_TEXT.has(owner) && !tag.selfClose) {
        const rest = html.slice(i);
        const end = rest.search(new RegExp(`</${owner}\\b`, 'i'));
        const stop = end < 0 ? n : i + end;
        if (stop > i) tokens.push({ kind: 'raw', raw: html.slice(i, stop), owner, attrs: tag.attrs });
        i = from = stop;
      }
    } else {
      // A lone "<" is text.
      from = lt + 1;
    }
  }
  text(n);
  return tokens;
}
