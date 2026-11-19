// Tentang: the identity card (app icon, name, tagline, version; seven
// taps on the version open the debug screen in debug builds), "Tentang
// Sulo" (one sentence and three facts with icons), "Di balik Sulo" (a short
// story, the maker's name only as a 13 px muted signature, the links as
// neutral round icon buttons), support, a row to the privacy policy, and
// one 12 px note on outside links. The maker's name appears nowhere else in
// the app. Every outside link is a plain link opening a new tab; nothing
// from those sites is loaded here.

import { useRef } from 'react';
import { CREATOR_LINKS, CREATOR_NAME, FEEDBACK_FORM_URL, isShownLink, REPO_URL, TRAKTEER_URL, type CreatorLinkId } from '@sulo/core/links';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { EyeOffIcon, GitHubIcon, GlobeIcon, InfoCircleIcon, InstagramIcon, LinkedInIcon, ShieldIcon } from '@sulo/ui/dashboard-icons';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronRightIcon } from '@sulo/ui/icons';
import { Card, GroupCard, IconTile } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import tile from '../../../extension/assets/brand/tile-dark.svg';
import { DEV_EVENT } from '../events';

const LINK_ICONS = { instagram: InstagramIcon, linkedin: LinkedInIcon, github: GitHubIcon, web: GlobeIcon } satisfies Record<CreatorLinkId, unknown>;
const FACT_ICONS = [ShieldIcon, EyeOffIcon, InfoCircleIcon];
const row = 'flex min-h-12 w-full items-center gap-3 py-3 text-left text-m15 outline-none focus-ring:ring-2 focus-ring:ring-focus rounded-[8px] [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line';

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
            <p className="text-m13 text-muted-foreground">{t.tagline}</p>
            <button type="button" onClick={tap} className="m-hit mt-1 block rounded text-left text-m12 text-muted-foreground tabular-nums outline-none focus-ring:ring-2 focus-ring:ring-focus">
              {w.about.apkVersion(__SULO_VERSION__)}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-m15 font-semibold">{t.aboutTitle}</h2>
        <p className="mt-1 text-m15r">{t.intro}</p>
        <ul className="mt-3 space-y-2">
          {t.points.map((p, i) => (
            <li key={p} className="flex items-center gap-3">
              <IconTile color="neutral" icon={FACT_ICONS[i] ?? InfoCircleIcon} />
              <span className="min-w-0 text-m15r">{p}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-m15 font-semibold">{t.behindTitle}</h2>
        <p className="mt-1 text-m15r">{t.behindBody}</p>
        <p className="mt-2 text-m13 text-muted-foreground">{t.signature(CREATOR_NAME)}</p>
        {creators.length > 0 && (
          <ul className="mt-3 flex gap-2">
            {creators.map((l) => {
              const Icon = LINK_ICONS[l.id];
              return (
                <li key={l.id}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label={t.links[l.id]} className="m-hit m-press inline-flex size-11 items-center justify-center rounded-full bg-m-inset text-foreground outline-none focus-ring:ring-2 focus-ring:ring-focus">
                    <Icon aria-hidden="true" className="size-5" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

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

      <GroupCard>
        <a href="#privasi" className={row}>
          <span className="min-w-0 flex-1">{t.privacy}</span>
          <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </a>
        {isShownLink(REPO_URL) && (
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={row}>
            <span className="min-w-0 flex-1">{t.license}</span>
            <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </a>
        )}
      </GroupCard>

      <p className="px-1 text-m12 text-muted-foreground">{t.externalNote}</p>
    </div>
  );
}
