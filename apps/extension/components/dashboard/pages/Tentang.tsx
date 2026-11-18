import { useId, type ComponentType, type SVGProps } from 'react';
import { browser } from 'wxt/browser';
import { ExternalIcon } from '@sulo/ui/icons';
import { CREATOR_LINKS, CREATOR_NAME, FEEDBACK_FORM_URL, isShownLink, REPO_URL, TRAKTEER_URL, type CreatorLinkId } from '@sulo/core/links';
import { DocLayout } from '@sulo/ui/ui/doc-layout';
import { SupportButton } from '@sulo/ui/ui/support-button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@sulo/ui/ui/tooltip';
import { GitHubIcon, GlobeIcon, InstagramIcon, LinkedInIcon } from '@sulo/ui/dashboard-icons';
import { Card } from '../Shell';
import type { PageProps } from '../types';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

const LINK_ICONS: Record<CreatorLinkId, ComponentType<SVGProps<SVGSVGElement>>> = {
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  github: GitHubIcon,
  web: GlobeIcon,
};

const textLink =
  'inline-flex items-center gap-2 rounded text-[14px] underline-offset-4 outline-none hover:underline focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-offset-2 focus-ring:ring-offset-background';

/**
 * About. Every outside link is a plain link opened by a click; nothing from
 * Trakteer, social media or Google is loaded here (no embed script, no
 * image from a CDN). Icons are our own inline SVG.
 */
export function TentangPage({ d, actions }: PageProps) {
  const t = d.tentang;
  const creators = CREATOR_LINKS.filter((l) => isShownLink(l.url));
  const feedback = isShownLink(FEEDBACK_FORM_URL);
  const warnId = useId();

  const version = (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-[14px] font-semibold">{t.versionTitle}</p>
      <p className="mt-2 text-[12px] leading-normal text-muted-foreground">
        {t.version(browser.runtime.getManifest().version)}.
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
      <button
        type="button"
        className="mt-2 rounded text-[12px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus"
        onClick={() => actions.openTab(browser.runtime.getURL('/privacy.html'))}
      >
        {t.privacy}
      </button>
    </div>
  );
  return (
    <DocLayout aside={version}>
      <section id="tentang-sulo">
        <Card>
          <p className="text-[14px] leading-normal">{t.intro}</p>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-[14px] leading-normal">
            {t.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Card>
      </section>

      {creators.length > 0 && (
        <section id="pembuat">
          <Card title={t.madeBy(CREATOR_NAME)}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {creators.map((l) => {
                const Icon = LINK_ICONS[l.id];
                return (
                  <li key={l.id}>
                    <a href={l.url} {...external} className={textLink}>
                      <Icon className="size-4 shrink-0" />
                      <span>{t.links[l.id]}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}

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
