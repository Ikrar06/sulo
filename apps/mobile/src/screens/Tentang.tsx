// Tentang (M8c.1, cards): the identity card (app icon, name, version; seven
// taps on the APK version open the debug screen in debug builds), what Sulo
// is, the maker with links as pill chips, support (Traktir kopi primary,
// Kirim masukan secondary, both full width) and one 12 px note on outside
// links. Every outside link is a plain link opening a new tab; nothing from
// those sites is loaded here.

import { useRef } from 'react';
import { CREATOR_LINKS, CREATOR_NAME, FEEDBACK_FORM_URL, isShownLink, REPO_URL, TRAKTEER_URL, type CreatorLinkId } from '@sulo/core/links';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { GitHubIcon, GlobeIcon, InstagramIcon, LinkedInIcon } from '@sulo/ui/dashboard-icons';
import { useI18n } from '@sulo/ui/i18n';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import tile from '../../../extension/assets/brand/tile-dark.svg';
import { DEV_EVENT } from '../events';

const LINK_ICONS = { instagram: InstagramIcon, linkedin: LinkedInIcon, github: GitHubIcon, web: GlobeIcon } satisfies Record<CreatorLinkId, unknown>;
const chip = 'inline-flex h-8 items-center gap-2 rounded-full bg-m-inset px-3 text-m13 outline-none focus-ring:ring-2 focus-ring:ring-focus';
const textLink = 'rounded underline underline-offset-2 outline-none focus-ring:ring-2 focus-ring:ring-focus';

export function TentangScreen() {
  const { locale } = useI18n();
  const t = mobileDash(locale).tentang;
  const w = mobileWords(locale);
  const taps = useRef(0);
  const creators = CREATOR_LINKS.filter((l) => isShownLink(l.url));
  const coffee = isShownLink(TRAKTEER_URL);
  const feedback = isShownLink(FEEDBACK_FORM_URL);
  // Debug builds: seven taps open the session-age screen.
  const tap = () => {
    taps.current += 1;
    if (taps.current >= 7 && __SULO_DEV__) {
      taps.current = 0;
      window.dispatchEvent(new Event(DEV_EVENT));
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-4">
          <img src={tile} alt="" width={56} height={56} className="size-14 shrink-0 rounded-ctl" />
          <div className="min-w-0">
            <h2 className="text-m18 font-semibold">Sulo</h2>
            <button type="button" onClick={tap} className="m-hit block rounded text-left text-m13 text-muted-foreground tabular-nums outline-none focus-ring:ring-2 focus-ring:ring-focus">
              {w.about.apkVersion(__SULO_VERSION__)}
            </button>
          </div>
        </div>
        <p className="mt-3 text-m12 text-muted-foreground">
          {isShownLink(REPO_URL) && (
            <>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={textLink}>
                {t.license}
              </a>{' '}
            </>
          )}
          <a href="#privasi" className={textLink}>
            {t.privacy}
          </a>
        </p>
      </Card>

      <Card>
        <p className="text-m15r">{t.intro}</p>
        <ul className="mt-3 space-y-2 text-m15r">
          {t.points.map((p) => (
            <li key={p} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Card>

      {creators.length > 0 && (
        <Card>
          <h2 className="text-m15 font-semibold">{t.madeBy(CREATOR_NAME)}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {creators.map((l) => {
              const Icon = LINK_ICONS[l.id];
              return (
                <li key={l.id}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className={chip}>
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {t.links[l.id]}
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {(coffee || feedback) && (
        <Card>
          <h2 className="text-m15 font-semibold">{t.supportTitle}</h2>
          {coffee && <p className="mt-1 text-m13 text-muted-foreground">{t.supportNote}</p>}
          <div className="mt-3 flex flex-col gap-2">
            {coffee && (
              <PillButton kind="primary" full href={TRAKTEER_URL}>
                {t.coffee}
                <span className="sr-only"> {t.coffeeHint}</span>
              </PillButton>
            )}
            {feedback && (
              <PillButton full href={FEEDBACK_FORM_URL}>
                {t.feedback}
              </PillButton>
            )}
          </div>
          {feedback && <p className="mt-2 text-m12 text-muted-foreground">{t.feedbackNote}</p>}
        </Card>
      )}

      <p className="px-1 text-m12 text-muted-foreground">{t.externalNote}</p>
    </div>
  );
}
