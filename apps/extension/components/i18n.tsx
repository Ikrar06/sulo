import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { messagesFor, type Locale, type Messages } from '@sulo/core/i18n';

// Active language for React components. Pages resolve the locale before the
// first render (stored choice, else the browser language) and wrap the tree
// in <I18nProvider>; components read text with useI18n().m.

interface I18n {
  locale: Locale;
  m: Messages;
}

const I18nContext = createContext<I18n>({ locale: 'id', m: messagesFor('id') });

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, m: messagesFor(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
