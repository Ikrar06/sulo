import { useToast } from '@sulo/ui/ui/toast';
import { MoreIcon } from '@sulo/ui/icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@sulo/ui/ui/dropdown-menu';
import { FEED_IDS, feedUrl } from '@sulo/core/calendar/feeds';
import { appleUrl, googleSubscribeUrl, outlookSubscribeUrl } from '@sulo/core/calendar/subscribe-links';
import type { DashMessages } from '@sulo/core/i18n/dashboard';

/**
 * One-click subscriptions as three small cards. Every option is a plain link
 * opened in a new tab by the click; the extension fetches nothing and sends
 * nothing to Google, Microsoft or Apple, whose pages ask the user to
 * confirm. "Salin alamat" copies the https address locally.
 */
const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
const COPIED_MS = 2000;

const primary =
  'inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[14px] font-medium text-primary-foreground outline-none hover:bg-primary/85 focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-offset-2 focus-ring:ring-offset-background';

export function Subscribe({ d }: { d: DashMessages }) {
  const s = d.kalender.subscribe;
  const toast = useToast();
  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.show({ message: s.copied, duration: COPIED_MS });
  };

  return (
    <section>
      <h2 className="text-[16px] leading-6 font-semibold">{s.title}</h2>
      <p className="mt-1 text-[14px] text-muted-foreground">{s.lead}</p>
      <ul className="mt-3 grid gap-4 md:grid-cols-3">
        {FEED_IDS.map((id) => {
          const url = feedUrl(id);
          const feed = s.feeds[id];
          return (
            <li key={id} className="flex flex-col rounded-xl border border-border bg-surface p-5">
              <p className="text-[14px] font-semibold">{feed.name}</p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-normal text-muted-foreground" title={feed.desc}>
                {feed.desc}
              </p>
              <div className="mt-auto flex items-center gap-2 pt-3">
                <a className={primary} href={googleSubscribeUrl(url)} {...external}>
                  {s.google}
                </a>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={d.kalender.moreMenu(feed.name)}
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-border outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus data-[state=open]:bg-surface-raised"
                  >
                    <MoreIcon className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem asChild>
                      <a href={outlookSubscribeUrl(url, `Sulo ${feed.name}`)} {...external}>
                        {s.outlook}
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={appleUrl(url)} {...external}>
                        {s.apple}
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void copy(url)}>{s.copy}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[12px] leading-normal text-muted-foreground">{s.note}</p>
    </section>
  );
}
