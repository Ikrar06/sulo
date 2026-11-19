// Navigation in the Android app: five tabs, each with its own stack of
// detail screens (a task, a course's attendance, the pages under "Lainnya").
// Pure, so Android's back button is tested without a phone:
// - back closes the detail on top, else returns to the previous tab, else
//   leaves the app;
// - tapping the current tab again goes back to its first screen.
// Links use the dashboard's hashes (#tugas/123), so shared cards work as is.

import { parseRoute, type Page } from '@sulo/core/dashboard/routes';

export const TABS = ['ringkasan', 'tugas', 'kalender', 'presensi', 'lainnya'] as const;
export type Tab = (typeof TABS)[number];

/** Screens of the app: the dashboard's pages, the "Lainnya" list and the phone's privacy notice. */
export type ScreenName = Page | 'lainnya' | 'privasi';

export interface Screen {
  name: ScreenName;
  /** A task's event id, a course id, a settings section... */
  detail: string | null;
}

export interface NavState {
  tab: Tab;
  /** Screens opened on top of the current tab's first screen. */
  stack: readonly Screen[];
  /** Tabs visited before, most recent last (each tab once). */
  history: readonly Tab[];
}

export const START: NavState = { tab: 'ringkasan', stack: [], history: [] };

/** Pages reached from "Lainnya" (and Jadwal and Nilai, which come with NEOSIA in M8d). */
const UNDER_LAINNYA: ReadonlySet<ScreenName> = new Set(['kabar', 'mata-kuliah', 'pengaturan', 'bantuan', 'tentang', 'privasi', 'jadwal', 'nilai']);

export function tabOf(name: ScreenName): Tab {
  return (TABS as readonly string[]).includes(name) ? (name as Tab) : UNDER_LAINNYA.has(name) ? 'lainnya' : 'ringkasan';
}

/** "#tugas/123", "#lainnya", "#privasi" -> a screen. */
export function parseScreen(hash: string): Screen {
  const head = hash.replace(/^#\/?/, '').split('/')[0];
  if (head === 'lainnya' || head === 'privasi') return { name: head, detail: null };
  const route = parseRoute(hash);
  return { name: route.page, detail: route.detail };
}

/** The screen on top. */
export function current(state: NavState): Screen {
  return state.stack.at(-1) ?? { name: state.tab, detail: null };
}

function switchTab(state: NavState, tab: Tab): NavState {
  if (tab === state.tab) return state;
  return { tab, stack: [], history: [...state.history.filter((t) => t !== state.tab && t !== tab), state.tab] };
}

/** A tab in the bar: the same tab again goes back to its first screen. */
export function selectTab(state: NavState, tab: Tab): NavState {
  return tab === state.tab ? { ...state, stack: [] } : switchTab(state, tab);
}

/**
 * A tab tapped: the tab already shown on its first screen scrolls back to
 * the top; anything else is selectTab (switch, or close what is open on top).
 */
export function tapTab(state: NavState, tab: Tab): { kind: 'scroll-top' } | { kind: 'nav'; next: NavState } {
  if (tab === state.tab && state.stack.length === 0) return { kind: 'scroll-top' };
  return { kind: 'nav', next: selectTab(state, tab) };
}

/** Opens a screen: in its own tab, on top of that tab's first screen or of what is open there. */
export function open(state: NavState, screen: Screen): NavState {
  const tab = tabOf(screen.name);
  const isRoot = screen.name === tab && screen.detail === null;
  const base = switchTab(state, tab);
  if (isRoot) return { ...base, stack: [] };
  const top = current(base);
  if (top.name === screen.name && top.detail === screen.detail) return base;
  // A detail replaces another detail of the same screen (task to task), a new page goes on top.
  const stack = top.name === screen.name && base.stack.length > 0 ? [...base.stack.slice(0, -1), screen] : [...base.stack, screen];
  return { ...base, stack };
}

/** Android's back button: the next state, or "exit" when there is nothing to go back to. */
export function back(state: NavState): NavState | 'exit' {
  if (state.stack.length > 0) return { ...state, stack: state.stack.slice(0, -1) };
  const previous = state.history.at(-1);
  if (previous === undefined) return state.tab === 'ringkasan' ? 'exit' : { tab: 'ringkasan', stack: [], history: [] };
  return { tab: previous, stack: [], history: state.history.slice(0, -1) };
}
