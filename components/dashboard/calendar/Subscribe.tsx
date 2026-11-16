import { useEffect, useRef, useState } from 'react';
import { FEED_IDS, feedUrl } from '@/lib/calendar/feeds';
import { appleUrl, googleSubscribeUrl, outlookSubscribeUrl } from '@/lib/calendar/subscribe-links';
import type { DashMessages } from '@/lib/i18n/dashboard';

/**
 * One-click subscriptions. Every button is a plain link opened in a new tab
 * by the click; the extension fetches nothing and sends nothing to Google
 * or Microsoft, whose pages ask the user to confirm. "Salin alamat" copies
 * the https address locally.
 */
const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
const COPIED_MS = 2000;

const primary =
  'inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[14px] font-medium text-primary-foreground outline-none hover:bg-primary/85 focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-offset-2 focus-ring:ring-offset-background';
const secondary =
  'inline-flex h-8 items-center rounded-lg border border-border px-3 text-[12px] font-medium outline-none hover:bg-muted focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-offset-2 focus-ring:ring-offset-background';

export function Subscribe({ d }: { d: DashMessages }) {
  const s = d.kalender.subscribe;
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current !== null && window.clearTimeout(timer.current)), []);

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), COPIED_MS);
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-[16px] font-semibold">{s.title}</h2>
      <p className="mt-1 text-[14px] leading-normal text-muted-foreground">{s.lead}</p>
      <ul className="mt-3 divide-y divide-border">
        {FEED_IDS.map((id) => {
          const url = feedUrl(id);
          const name = `Sulo ${s.feeds[id].name}`;
          return (
            <li key={id} className="space-y-2 py-3">
              <div>
                <p className="text-[14px] font-semibold">{s.feeds[id].name}</p>
                <p className="text-[14px] leading-normal text-muted-foreground">{s.feeds[id].desc}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a className={primary} href={googleSubscribeUrl(url)} {...external}>
                  {s.google}
                </a>
                <a className={secondary} href={outlookSubscribeUrl(url, name)} {...external}>
                  {s.outlook}
                </a>
                <a className={secondary} href={appleUrl(url)} {...external}>
                  {s.apple}
                </a>
                <button
                  type="button"
                  onClick={() => void copy(url)}
                  className="rounded px-1 text-[12px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus"
                >
                  {copied === url ? s.copied : s.copy}
                </button>
                <span role="status" className="sr-only">
                  {copied === url ? s.copied : ''}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[12px] leading-normal text-muted-foreground">{s.note}</p>
    </section>
  );
}
