// A new Android version (M8e E3): a calm card on Ringkasan, a row in
// Tentang, and the full "Sulo perlu diperbarui" screen below a required
// update. "Unduh" only opens the GitHub release asset in the browser; Sulo
// never downloads or installs anything itself (no REQUEST_INSTALL_PACKAGES).
// Next to it: one line on installing it, and the file's SHA-256 to copy in
// debug builds and the test phase only (below 1.0.0).
// No notification for an ordinary update.

import { useCallback, useEffect, useState } from 'react';
import { mobileWords } from '@sulo/core/i18n/mobile';
import type { ReleaseInfo, ReleaseNotice } from '@sulo/core/remote/release';
import type { Platform } from '@sulo/core/platform';
import { useI18n } from '@sulo/ui/i18n';
import { SuloMascot } from '@sulo/ui/mascot/SuloMascot';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { dismissRelease, releaseState, showChecksum } from '../release';
import { iosUpdateGuide } from '@sulo/core/links';
import type { IosReleaseInfo } from '@sulo/core/remote/release';
import { SuloSession } from '../session';

/**
 * The iPhone (owner's decision of 26 Nov 2026, C2): an update is installed from a laptop with Sideloadly, so
 * every update button opens the guide's "Memperbarui Sulo" part instead of a file, and there is no checksum
 * line here (the guide has it).
 */
// The iPhone's words and guide (core i18n/os.ts, set from the platform at start; ?os=ios in the web preview).
const onIphone = () => mobileOs() === 'ios';

/** "1.1.1" from its versionCode (major * 10000 + minor * 100 + patch). */
const versionName = (code: number) => `${Math.floor(code / 10000)}.${Math.floor(code / 100) % 100}.${code % 100}`;
import { useMobileData } from '../shell/data';
import { mobileOs } from '@sulo/core/i18n/os';

/** The notice for now, read again whenever the app's data is (the config comes with it). */
export function useReleaseNotice(platform: Platform, tick: unknown): { notice: ReleaseNotice; dismiss: () => Promise<void> } {
  const [notice, setNotice] = useState<ReleaseNotice>({ kind: 'none' });
  const read = useCallback(async () => setNotice(await releaseState(platform.store, platform.clock.now())), [platform]);
  useEffect(() => {
    void read();
  }, [read, tick]);
  const dismiss = useCallback(async () => {
    if (notice.kind !== 'available') return;
    await dismissRelease(platform.store, notice.release.versionCode, platform.clock.now());
    await read();
  }, [notice, platform, read]);
  return { notice, dismiss };
}

/** How to install; the SHA-256 to compare (with a copy button) only in debug builds and the test phase. */
function Verify({ release }: { release: ReleaseInfo }) {
  const { locale } = useI18n();
  const t = mobileWords(locale).release;
  const [copied, setCopied] = useState(false);
  if (!showChecksum()) return <p className="text-m12 text-muted-foreground">{t.howTo}</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3 rounded-2xl bg-m-inset px-3 py-2">
        <p className="min-w-0 flex-1 text-m12 text-muted-foreground">
          <span className="block font-semibold text-foreground">{t.sha}</span>
          <span className="block break-all tabular-nums">{release.sha256}</span>
        </p>
        <PillButton
          small
          onPress={() =>
            void navigator.clipboard
              .writeText(release.sha256)
              .then(() => setCopied(true))
              .catch(() => undefined)
          }
        >
          {copied ? t.copied : t.copy}
        </PillButton>
      </div>
      <p className="text-m12 text-muted-foreground">{t.howTo}</p>
    </div>
  );
}

/** Ringkasan: one calm card, closed for 3 days by "Nanti". */
export function ReleaseCard({ notice, onDismiss }: { notice: ReleaseNotice; onDismiss: () => void }) {
  const { locale } = useI18n();
  const t = mobileWords(locale).release;
  const { actions } = useMobileData();
  if (notice.kind !== 'available') return null;
  const r = notice.release;
  return (
    <Card className="mb-4" inner="space-y-3">
      <div>
        <p className="text-m15 font-semibold">{t.title}</p>
        <p className="text-m13 text-muted-foreground tabular-nums">{t.version(r.versionName)}</p>
      </div>
      {r.notes && <p className="text-m13">{locale === 'en' ? r.notes.en : r.notes.id}</p>}
      {/* A required update in its grace period (1.1.0): its date, and no "Nanti". */}
      {notice.requiredFrom !== undefined && (
        <p className="text-m13 font-medium">{t.requiredOn(new Date(notice.requiredFrom * 1000).toLocaleDateString(locale === 'en' ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'long' }))}</p>
      )}
      {!onIphone() && <Verify release={r} />}
      <div className="flex gap-2">
        <PillButton kind="primary" small onPress={() => actions.openExternal(onIphone() ? iosUpdateGuide(locale) : r.url)}>
          {onIphone() ? mobileWords(locale).iphone.howToUpdate : t.download}
        </PillButton>
        {notice.requiredFrom === undefined && (
          <PillButton small onPress={onDismiss}>
            {t.later}
          </PillButton>
        )}
      </div>
    </Card>
  );
}

/** Tentang: one line under the version while a newer one exists (also after "Nanti"). */
export function ReleaseAboutRow({ release }: { release: ReleaseInfo | null }) {
  const { locale } = useI18n();
  const t = mobileWords(locale).release;
  const { actions } = useMobileData();
  if (!release) return null;
  return (
    <Card inner="space-y-3">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-m15 font-semibold tabular-nums">{t.aboutRow(release.versionName)}</p>
        <PillButton kind="primary" small onPress={() => actions.openExternal(onIphone() ? iosUpdateGuide(locale) : release.url)}>
          {onIphone() ? mobileWords(locale).iphone.howToUpdate : t.download}
        </PillButton>
      </div>
      {!onIphone() && <Verify release={release} />}
    </Card>
  );
}

/** Below a required update: the whole app is this screen. No SIKOLA request (the client refuses), the worker holds, data stays. */
export function UpdateRequiredScreen({ release, openExternal, onReadOnly }: { release: ReleaseInfo; openExternal: (url: string) => void; onReadOnly?: () => void }) {
  const { locale } = useI18n();
  const t = mobileWords(locale).release;
  if (onIphone()) return <UpdateRequiredIphone release={release as IosReleaseInfo} openExternal={openExternal} onReadOnly={onReadOnly} />;
  return (
    <main className="flex min-h-dvh flex-col justify-center bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="flex flex-col items-center text-center">
          <SuloMascot mood="stale" size={48} />
          <h1 className="mt-3 text-m22 font-semibold">{t.requiredTitle}</h1>
          <p className="mt-2 text-m15r text-muted-foreground">{t.requiredBody}</p>
          <p className="text-m15r text-muted-foreground">{t.requiredData}</p>
          <p className="mt-1 text-m13 text-muted-foreground tabular-nums">{t.version(release.versionName)}</p>
        </div>
        {release.notes && <p className="text-center text-m13">{locale === 'en' ? release.notes.en : release.notes.id}</p>}
        <PillButton kind="primary" full onPress={() => openExternal(release.url)}>
          {t.download}
        </PillButton>
        <Verify release={release} />
      </div>
    </main>
  );
}

/**
 * The iPhone's "Sulo perlu diperbarui" (C2): why, in plain words; the installed and the minimum version; the
 * guide; the guide's link sent to the laptop through the share sheet (the update happens there); and, unless
 * the release turned it off, "Lihat data terakhir": the kept data, read-only, with no request anywhere.
 */
function UpdateRequiredIphone({ release, openExternal, onReadOnly }: { release: IosReleaseInfo; openExternal: (url: string) => void; onReadOnly?: () => void }) {
  const { locale } = useI18n();
  const t = mobileWords(locale).release;
  const p = mobileWords(locale).iphone;
  const guide = iosUpdateGuide(locale);
  return (
    <main className="flex min-h-dvh flex-col justify-center bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="flex flex-col items-center text-center">
          <SuloMascot mood="stale" size={48} />
          <h1 className="mt-3 text-m22 font-semibold">{t.requiredTitle}</h1>
          <p className="mt-2 text-m15r text-muted-foreground">{p.requiredBody}</p>
          <p className="text-m15r text-muted-foreground">{t.requiredData}</p>
          <p className="mt-1 text-m13 text-muted-foreground tabular-nums">{p.versions(__SULO_VERSION__, versionName(release.minVersionCode))}</p>
        </div>
        {release.notes && <p className="text-center text-m13">{locale === 'en' ? release.notes.en : release.notes.id}</p>}
        <div className="space-y-2">
          <PillButton kind="primary" full onPress={() => openExternal(guide)}>
            {p.howToUpdate}
          </PillButton>
          <PillButton full onPress={() => void SuloSession.share({ url: guide, text: p.shareTitle }).catch(() => undefined)}>
            {p.sendToLaptop}
          </PillButton>
          {release.readOnlyAllowed && onReadOnly && (
            <PillButton full onPress={onReadOnly}>
              {p.readOnly}
            </PillButton>
          )}
        </div>
      </div>
    </main>
  );
}
