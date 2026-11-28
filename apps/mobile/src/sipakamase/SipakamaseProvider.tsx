// Sipakamase on the phone's screens (1.1.0): the module's state, the
// connection, the stored fragments and the actions, read through the
// encrypted store. The consent sheet lives here, so the settings, the MKPK
// card and "Yang baru di Sulo" open the same one.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readConnection, type Connection, OFF } from '@sulo/core/sipakamase/connection';
import { readSipakamaseModule } from '@sulo/core/sipakamase/module';
import { readSipakamaseData, type SipakamaseData } from '@sulo/core/sipakamase/store';
import { dismissSipakamaseInvite, readSipakamaseInvite } from '@sulo/core/sipakamase/invite';
import type { RefreshResult } from '@sulo/core/sipakamase/run';
import type { Platform } from '@sulo/core/platform';
import { onboardingWords } from '@sulo/core/i18n/mobile-onboarding';
import { useI18n } from '@sulo/ui/i18n';
import { connectSipakamase, disconnectSipakamase, keepSipakamase, notifyMkpk, refreshSipakamase, signInAgain, sipakamaseStore, type ConnectResult } from './service';
import { SipakamaseConsentSheet } from './SipakamaseConsent';
import { applyWatchPlan } from '../watch-native';
import { isReadOnly } from '../read-only';

export interface SipakamaseState {
  enabled: boolean;
  connection: Connection;
  data: SipakamaseData | null;
  /** Opens the consent sheet; "Hubungkan" there signs in. */
  ask: () => void;
  /** When Ringkasan's invite was put off with "Nanti saja" (core sipakamase/invite.ts); undefined until read. */
  inviteDismissedAt: number | null | undefined;
  laterInvite: () => Promise<void>;
  signIn: () => Promise<ConnectResult>;
  refresh: () => Promise<RefreshResult>;
  disconnect: () => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<SipakamaseState | null>(null);

/** Outside the app (the landing page renders screens with sample data): not connected, nothing happens. */
const NOT_CONNECTED: SipakamaseState = {
  enabled: false,
  connection: OFF,
  data: null,
  ask: () => undefined,
  inviteDismissedAt: undefined,
  laterInvite: async () => undefined,
  signIn: async () => 'closed',
  refresh: async () => ({ kind: 'off' }),
  disconnect: async () => undefined,
  reload: async () => undefined,
};

export const useSipakamase = (): SipakamaseState => useContext(Ctx) ?? NOT_CONNECTED;

export function SipakamaseProvider({ platform, children }: { platform: Platform; children: ReactNode }) {
  const { locale } = useI18n();
  const store = useMemo(() => sipakamaseStore(platform), [platform]);
  const [enabled, setEnabled] = useState(false);
  const [connection, setConnection] = useState<Connection>(OFF);
  const [data, setData] = useState<SipakamaseData | null>(null);
  const [consent, setConsent] = useState(false);
  // The invite's "Nanti saja" is not Sipakamase data: kept in the plain store, like NEOSIA's.
  const [inviteDismissedAt, setInviteDismissedAt] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    void readSipakamaseInvite(platform.store).then((s) => setInviteDismissedAt(s.dismissedAt));
  }, [platform]);

  const reload = useCallback(async () => {
    const module = await readSipakamaseModule(store);
    setEnabled(module.enabled);
    setConnection(await readConnection(store, module.enabled));
    setData(module.enabled ? await readSipakamaseData(store) : null);
    // The worker's plan follows: it keeps the session only while something is waited for.
    void applyWatchPlan(platform).catch(() => undefined);
  }, [store, platform]);

  useEffect(() => {
    void reload();
    // Opening the app: the keeper's read when one is due (core decides), then fresh state.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !isReadOnly()) void keepSipakamase(platform).then(() => notifyMkpk(platform)).then(reload);
    };
    onVisible();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [platform, reload]);

  const bar = onboardingWords(locale).signin;
  const words = { close: bar.close, offline: bar.offline, retry: bar.retry };
  const value: SipakamaseState = {
    enabled,
    connection,
    data,
    ask: () => setConsent(true),
    inviteDismissedAt,
    laterInvite: async () => {
      const now = platform.clock.now();
      await dismissSipakamaseInvite(platform.store, now);
      setInviteDismissedAt(now);
    },
    signIn: async () => {
      const r = await signInAgain(platform, words);
      await reload();
      return r;
    },
    refresh: async () => {
      const r = await refreshSipakamase(platform);
      void notifyMkpk(platform);
      await reload();
      return r;
    },
    disconnect: async () => {
      await disconnectSipakamase(platform);
      await reload();
    },
    reload,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <SipakamaseConsentSheet
        open={consent}
        onClose={() => setConsent(false)}
        onConnect={async () => {
          const r = await connectSipakamase(platform, words);
          await reload();
          setConsent(false);
          return r;
        }}
      />
    </Ctx.Provider>
  );
}
