// A small element tree from html/tokens.ts, for readers that have no DOM
// (core, the extension's service worker). Forgiving like a browser in the
// cases that matter for table and list markup: void elements, cells, rows
// and list items closed by their next sibling, stray closing tags ignored.
// Scripts, styles and comments are dropped. Pure.

import { tokenizeHtml, VOID_TAGS } from './tokens';

export interface HtmlElement {
  tag: string;
  attrs: Readonly<Record<string, string | null>>;
  children: HtmlChild[];
  parent: HtmlElement | null;
}
export type HtmlChild = HtmlElement | string;

/** Opening one of these closes an open one of the same group, up to the boundary. */
const IMPLIED_CLOSE: Record<string, { close: readonly string[]; boundary: readonly string[] }> = {
  td: { close: ['td', 'th'], boundary: ['tr', 'table'] },
  th: { close: ['td', 'th'], boundary: ['tr', 'table'] },
  tr: { close: ['tr', 'td', 'th'], boundary: ['table', 'tbody', 'thead', 'tfoot'] },
  tbody: { close: ['tbody', 'thead', 'tfoot', 'tr', 'td', 'th'], boundary: ['table'] },
  thead: { close: ['tbody', 'thead', 'tfoot', 'tr', 'td', 'th'], boundary: ['table'] },
  tfoot: { close: ['tbody', 'thead', 'tfoot', 'tr', 'td', 'th'], boundary: ['table'] },
  li: { close: ['li'], boundary: ['ul', 'ol'] },
  option: { close: ['option'], boundary: ['select', 'datalist'] },
  p: { close: ['p'], boundary: ['div', 'li', 'td', 'th', 'section', 'body'] },
};
const SKIPPED = new Set(['script', 'style', 'template', 'noscript', 'textarea', 'title']);

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Character references, the ones pages use. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#\d{1,7}|#x[0-9a-fA-F]{1,6}|[A-Za-z]{2,8});/g, (whole, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : Number(ref.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[ref.toLowerCase()] ?? whole;
  });
}

export function buildTree(html: string): HtmlElement {
  const root: HtmlElement = { tag: '#root', attrs: {}, children: [], parent: null };
  let open = root;
  const ancestor = (names: readonly string[], stopAt: readonly string[]): HtmlElement | null => {
    for (let el: HtmlElement | null = open; el && el !== root; el = el.parent) {
      if (stopAt.includes(el.tag)) return null;
      if (names.includes(el.tag)) return el;
    }
    return null;
  };
  for (const token of tokenizeHtml(html)) {
    if (token.kind === 'text') {
      open.children.push(decodeEntities(token.raw));
    } else if (token.kind === 'open') {
      const tag = token.name.toLowerCase();
      const implied = IMPLIED_CLOSE[tag];
      if (implied) {
        const closing = ancestor(implied.close, implied.boundary);
        if (closing?.parent) open = closing.parent;
      }
      const attrs = Object.fromEntries(token.attrs.map((a) => [a.name.toLowerCase(), a.value === null ? null : decodeEntities(a.value)]));
      const el: HtmlElement = { tag, attrs, children: [], parent: open };
      open.children.push(el);
      if (!token.selfClose && !VOID_TAGS.has(tag)) open = el;
    } else if (token.kind === 'close') {
      const tag = token.name.toLowerCase();
      const closing = ancestor([tag], []);
      if (closing?.parent) open = closing.parent;
    } else if (token.kind === 'raw' && !SKIPPED.has(token.owner)) {
      open.children.push(decodeEntities(token.raw));
    }
  }
  return root;
}

/** Every element under `node`, in document order. */
export function elements(node: HtmlElement, tag?: string): HtmlElement[] {
  const out: HtmlElement[] = [];
  const walk = (el: HtmlElement) => {
    for (const child of el.children) {
      if (typeof child === 'string') continue;
      if (tag === undefined || child.tag === tag) out.push(child);
      walk(child);
    }
  };
  walk(node);
  return out;
}

export const childElements = (node: HtmlElement, tag?: string): HtmlElement[] =>
  node.children.filter((c): c is HtmlElement => typeof c !== 'string' && (tag === undefined || c.tag === tag));

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** All text under `node`, whitespace collapsed. */
export function textOf(node: HtmlChild): string {
  if (typeof node === 'string') return collapse(node);
  const parts: string[] = [];
  const walk = (el: HtmlElement) => {
    for (const child of el.children) {
      if (typeof child === 'string') parts.push(child);
      else if (child.tag === 'br') parts.push(' ');
      else walk(child);
    }
  };
  walk(node);
  return collapse(parts.join(' '));
}

/** The text before the first <br> (a cell's first line), not counting text inside child elements listed in `skip`. */
export function firstLine(node: HtmlElement, skip: readonly string[] = ['small']): string {
  const parts: string[] = [];
  for (const child of node.children) {
    if (typeof child === 'string') parts.push(child);
    else if (child.tag === 'br') {
      if (collapse(parts.join(' ')) !== '') break;
    } else if (!skip.includes(child.tag)) parts.push(textOf(child));
  }
  return collapse(parts.join(' '));
}

/** Text directly inside `node` (its own text nodes only). */
export const ownText = (node: HtmlElement): string => collapse(node.children.filter((c): c is string => typeof c === 'string').join(' '));

export const hasClass = (el: HtmlElement, name: string): boolean => (el.attrs.class ?? '').split(/\s+/).includes(name);
