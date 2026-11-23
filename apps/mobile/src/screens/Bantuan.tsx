// Bantuan (M8c.1, cards): a search card that filters the questions, then
// the FAQ by topic (core help/mobile.ts) under 13 px group titles. Each
// question is its own card; tapping it opens the answer inside the same
// card (height eases open, the chevron turns), one card open at a time.
// Last a "Masih bingung?" card; with no match, one sentence and the same
// feedback button.

import { useEffect, useId, useMemo, useState } from 'react';
import { searchFaq } from '@sulo/core/help/mobile';
import { FEEDBACK_FORM_URL, isShownLink } from '@sulo/core/links';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import type { FaqEntry } from '@sulo/core/help/content';
import { XIcon } from '@sulo/ui/dashboard-icons';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronDownIcon, SearchIcon } from '@sulo/ui/icons';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';

/** `initialOpen`: a question to open and bring into view (a link such as #bantuan/seberapa-cepat-hp). */
export function BantuanScreen({ initialOpen = null }: { initialOpen?: string | null }) {
  const { locale } = useI18n();
  const d = mobileDash(locale);
  const h = mobileWords(locale).help;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(initialOpen);
  useEffect(() => {
    if (initialOpen) document.getElementById(`faq-q-${initialOpen}`)?.scrollIntoView({ block: 'center' });
  }, [initialOpen]);
  const groups = useMemo(() => searchFaq(query, locale), [query, locale]);
  const feedback = isShownLink(FEEDBACK_FORM_URL) ? <PillButton href={FEEDBACK_FORM_URL}>{d.tentang.feedback}</PillButton> : null;

  return (
    <div className="space-y-6">
      <Card dense className="has-focus-ring:ring-2 has-focus-ring:ring-focus">
        <label className="-m-3 flex items-center gap-3 p-3">
          <SearchIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={h.search}
            aria-label={h.search}
            className="m-search h-8 min-w-0 flex-1 bg-transparent text-m15 outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          />
          {query !== '' && (
            <button type="button" onClick={() => setQuery('')} aria-label={h.clearSearch} className="m-hit m-hit-x flex size-7 shrink-0 items-center justify-center rounded-full bg-m-inset outline-none focus-ring:ring-2 focus-ring:ring-focus">
              <XIcon className="size-4" />
            </button>
          )}
        </label>
      </Card>

      {groups.length === 0 ? (
        <Card>
          <p role="status" className="text-m15">
            {h.noMatch}
          </p>
          {feedback && <div className="mt-3">{feedback}</div>}
        </Card>
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.id} aria-labelledby={`faq-${g.id}`}>
              <h2 id={`faq-${g.id}`} className="mb-2 text-m13 font-semibold text-muted-foreground">
                {g.title}
              </h2>
              <ul className="space-y-3">
                {g.entries.map((e) => (
                  <li key={e.id} id={`faq-q-${e.id}`}>
                    <Question entry={e} lang={locale} open={open === e.id} onToggle={() => setOpen((v) => (v === e.id ? null : e.id))} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {feedback && (
            <Card>
              <h2 className="text-m15 font-semibold">{h.stillTitle}</h2>
              <p className="mt-1 text-m13 text-muted-foreground">{h.stillBody}</p>
              <div className="mt-3">{feedback}</div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Question({ entry, lang, open, onToggle }: { entry: FaqEntry; lang: 'id' | 'en'; open: boolean; onToggle: () => void }) {
  const panel = useId();
  return (
    <section className="m-card rounded-card">
      <button type="button" aria-expanded={open} aria-controls={panel} onClick={onToggle} className="flex w-full items-center gap-3 rounded-card p-4 text-left outline-none focus-ring:ring-2 focus-ring:ring-focus">
        <span className="line-clamp-2 min-w-0 flex-1 text-m15 font-medium">{entry.q[lang]}</span>
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-m-inset">
          <ChevronDownIcon className={`size-4 transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {/* The answer eases open by animating the grid row from 0fr to 1fr. */}
      <div id={panel} role="region" aria-hidden={!open} className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="space-y-2 px-4 pb-4 text-m15r font-normal text-muted-foreground" inert={!open}>
            {entry.a.map((a, i) => (
              <p key={i}>{a[lang]}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
