// Language selection. The default follows the browser's UI language
// (chrome.i18n.getUILanguage): Indonesian for Indonesian browsers, English
// for everything else. The user can override it in the popup settings menu.

import { en } from './en';
import { id, type Messages } from './id';

export type Locale = 'id' | 'en';
export type { Messages };

export const LOCALES: readonly Locale[] = ['id', 'en'];

/** Each language named in itself, for the language menu. */
export const LANGUAGE_NAMES: Record<Locale, string> = { id: 'Bahasa Indonesia', en: 'English' };

const DICTIONARIES: Record<Locale, Messages> = { id, en };

export function messagesFor(locale: Locale): Messages {
  return DICTIONARIES[locale];
}

/** "id", "id-ID", "in" (old code for Indonesian) -> id; anything else -> en. */
export function localeFromUiLanguage(uiLanguage: string | undefined | null): Locale {
  const tag = (uiLanguage ?? '').toLowerCase();
  return tag === 'id' || tag.startsWith('id-') || tag === 'in' || tag.startsWith('in-') ? 'id' : 'en';
}

/** The stored choice wins; null means "follow the browser". */
export function resolveLocale(stored: Locale | null, uiLanguage: string | undefined | null): Locale {
  return stored ?? localeFromUiLanguage(uiLanguage);
}
