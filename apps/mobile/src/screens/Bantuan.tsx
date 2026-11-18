// Bantuan: the phone's FAQ (core help/mobile.ts), no guide videos. Each
// answer opens in place.

import { MOBILE_FAQ } from '@sulo/core/help/mobile';
import { FEEDBACK_FORM_URL, isShownLink } from '@sulo/core/links';
import { mobileDash } from '@sulo/core/i18n/mobile';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronDownIcon } from '@sulo/ui/icons';
import { secondaryButton } from './ui';

export function BantuanScreen() {
  const { locale } = useI18n();
  const d = mobileDash(locale);
  return (
    <div className="space-y-4">
      <ul className="-mx-4 divide-y divide-border border-y border-border bg-surface">
        {MOBILE_FAQ.map((e) => (
          <li key={e.id}>
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 text-m15 outline-none focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-inset [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">{e.q[locale]}</span>
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <div className="space-y-2 px-4 pb-4 text-m15r font-normal text-muted-foreground">
                {e.a.map((a, i) => (
                  <p key={i}>{a[locale]}</p>
                ))}
              </div>
            </details>
          </li>
        ))}
      </ul>
      {isShownLink(FEEDBACK_FORM_URL) && (
        <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" className={`${secondaryButton} w-full`}>
          {d.tentang.feedback}
        </a>
      )}
    </div>
  );
}
