import { useId, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { ExternalIcon } from '../icons';
import { CREATOR_LINKS, CREATOR_NAME, FEEDBACK_FORM_URL, isShownLink, REPO_URL, TRAKTEER_URL, type CreatorLinkId } from '@sulo/core/links';
import { DocLayout } from '../ui/doc-layout';
import { SupportButton } from '../ui/support-button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { EyeOffIcon, GitHubIcon, GlobeIcon, InfoCircleIcon, InstagramIcon, LinkedInIcon, ShieldIcon } from '../dashboard-icons';
import { Card } from '../card';
import type { DashMessages } from '@sulo/core/i18n/dashboard';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

const LINK_ICONS: Record<CreatorLinkId, ComponentType<SVGProps<SVGSVGElement>>> = {
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  github: GitHubIcon,
  web: GlobeIcon,
};

const FACT_ICONS: ComponentType<SVGProps<SVGSVGElement>>[] = [ShieldIcon, EyeOffIcon, InfoCircleIcon];

/** A neutral round icon button: no brand colours, the name only as its accessible label. */
const iconLink =
  'inline-flex size-10 items-center justify-center rounded-full border border-border text-foreground outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-offset-2 focus-ring:ring-offset-background';

/**
 * About. Every outside link is a plain link opened by a click; nothing from
 * Trakteer, social media or Google is loaded here (no embed script, no
 * image from a CDN). Icons are our own inline SVG. Shared by the dashboard
 * and the Android app: each passes its version, how to open the privacy
 * notice, and any line of its own under the version.
 */
export function TentangContent({ d, version: appVersion, onOpenPrivacy, versionExtra }: { d: DashMessages; version: string; onOpenPrivacy: () => void; versionExtra?: ReactNode }) {
  const t = d.tentang;
  const creators = CREATOR_LINKS.filter((l) => isShownLink(l.url));
  const feedback = isShownLink(FEEDBACK_FORM_URL);
  const warnId = useId();

  const version = (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-[14px] font-semibold">{t.versionTitle}</p>
      <p className="mt-2 text-[12px] leading-normal text-muted-foreground">
        {t.version(appVersion)}.
        {/* The license line only with a public repository to point at. */}
        {isShownLink(REPO_URL) && (
          <>
            {' '}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
              {t.license}
            </a>
          </>
        )}
      </p>
      {versionExtra}
      <button
        type="button"
        className="mt-2 rounded text-[12px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus"
        onClick={onOpenPrivacy}
      >
        {t.privacy}
      </button>
    </div>
  );
  return (
    <DocLayout aside={version}>
      <section id="tentang-sulo">
        <Card title={t.aboutTitle}>
          <p className="text-[14px] leading-normal">
            {t.intro} {t.neosia}
          </p>
          <ul className="mt-3 space-y-2">
            {t.points.map((p, i) => {
              const Icon = FACT_ICONS[i] ?? InfoCircleIcon;
              return (
                <li key={p} className="flex items-center gap-2 text-[14px] leading-normal">
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <span>{p}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      {/* The maker's name only as a small muted signature, never as a title. */}
      <section id="di-balik-sulo">
        <Card title={t.behindTitle}>
          <p className="text-[14px] leading-normal">{t.behindBody}</p>
          <p className="mt-2 text-[12px] leading-normal text-muted-foreground">{t.signature(CREATOR_NAME)}</p>
          {creators.length > 0 && (
            <ul className="mt-3 flex gap-2">
              {creators.map((l) => {
                const Icon = LINK_ICONS[l.id];
                return (
                  <li key={l.id}>
                    <a href={l.url} {...external} aria-label={t.links[l.id]} title={t.links[l.id]} className={iconLink}>
                      <Icon aria-hidden="true" className="size-4" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* Support (primary) and feedback (secondary, same 40 px height) side by side, stacked 8 px apart on narrow screens; one sentence under them. The "don't send" warning belongs to feedback only, as its tooltip. */}
      <section id="dukung">
        <Card title={t.supportTitle}>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
            {isShownLink(TRAKTEER_URL) && <SupportButton href={TRAKTEER_URL} label={t.coffee} srHint={t.coffeeHint} />}
            {feedback && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={FEEDBACK_FORM_URL}
                      {...external}
                      aria-describedby={warnId}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-[14px] font-medium outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-offset-2 focus-ring:ring-offset-background"
                    >
                      {t.feedback}
                      <ExternalIcon className="size-3.5 text-muted-foreground" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    {t.feedbackNote}
                  </TooltipContent>
                </Tooltip>
                <span id={warnId} className="sr-only">
                  {t.feedbackNote}
                </span>
              </TooltipProvider>
            )}
          </div>
          {isShownLink(TRAKTEER_URL) && <p className="mt-3 text-[12px] leading-normal text-muted-foreground">{t.supportNote}</p>}
        </Card>
      </section>

      {/* One note for every outside link on this page. */}
      <p className="text-[12px] leading-normal text-muted-foreground">{t.externalNote}</p>
    </DocLayout>
  );
}
