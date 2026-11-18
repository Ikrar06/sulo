// Privacy mode (M7): names, grades, GPA and credits are masked on screen,
// for example before a screenshot. One flag in the preferences, local to
// this browser; pages read it through this context.

import { createContext, useContext, type ReactNode } from 'react';
import { useI18n } from '@/components/i18n';
import { neosiaWords } from '@/lib/i18n/neosia';

const PrivacyContext = createContext(false);

export const PrivacyProvider = PrivacyContext.Provider;

export function usePrivacy(): boolean {
  return useContext(PrivacyContext);
}

/** The value, or a neutral mask while privacy mode is on. */
export function Private({ children }: { children: ReactNode }) {
  const on = usePrivacy();
  const { locale } = useI18n();
  if (!on) return <>{children}</>;
  return (
    <span role="img" aria-label={neosiaWords(locale).privacy.masked} className="tracking-widest text-muted-foreground select-none">
      •••
    </span>
  );
}
