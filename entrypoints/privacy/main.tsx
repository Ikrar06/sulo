import React from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createBrowserStore } from '@/lib/browser-store';
import { messagesFor, resolveLocale, type Locale } from '@/lib/i18n';
import { readPrefs } from '@/lib/prefs';
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_TITLE, PRIVACY_UPDATED, type Block } from '@/lib/privacy/content';
import '@/assets/tailwind.css';
import { DocLayout } from '@/components/ui/doc-layout';
import { installInputModality } from '@/lib/ui/input-modality';
import { applyTheme } from '@/lib/ui/theme';

// In-extension privacy policy, rendered from the same source as PRIVACY.md,
// in the user's language (stored choice, else the browser's).

// Focus rings for keyboard users only (see assets/tailwind.css).
installInputModality(document, document.documentElement);

function BlockView({ block, lang }: { block: Block; lang: Locale }) {
  if (block.kind === 'p') return <p>{block.text[lang]}</p>;
  const items = block.items.map((item) => <li key={item.id}>{item[lang]}</li>);
  return block.kind === 'ol' ? <ol className="list-decimal space-y-1 pl-6">{items}</ol> : <ul className="list-disc space-y-1 pl-6">{items}</ul>;
}

/** Same document layout as Bantuan and Tentang: the text at 68ch and a table of contents beside it. */
function Privacy({ lang }: { lang: Locale }) {
  const toc = PRIVACY_SECTIONS.map((s, i) => ({ id: `bagian-${i + 1}`, label: s.heading[lang] }));
  return (
    <main className="mx-auto max-w-[1040px] px-4 py-8 text-[14px] leading-normal sm:px-8">
      <h1 className="font-heading text-[20px] leading-8">{PRIVACY_TITLE[lang]}</h1>
      <p className="mb-6 text-[12px] text-muted-foreground">{messagesFor(lang).privacyPage.updated(PRIVACY_UPDATED[lang])}</p>
      <DocLayout toc={toc} tocLabel={messagesFor(lang).privacyPage.onThisPage}>
        <div className="space-y-3">
          {PRIVACY_INTRO.map((b, i) => (
            <BlockView key={i} block={b} lang={lang} />
          ))}
        </div>
        {PRIVACY_SECTIONS.map((s, i) => (
          <section key={s.heading.id} id={`bagian-${i + 1}`} className="space-y-2 pt-4">
            <h2 className="text-[16px] leading-6 font-semibold">{s.heading[lang]}</h2>
            {s.blocks.map((b, j) => (
              <BlockView key={j} block={b} lang={lang} />
            ))}
          </section>
        ))}
      </DocLayout>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Privacy root element not found');
void readPrefs(createBrowserStore(browser.storage.local)).then((prefs) => {
  applyTheme(document.documentElement, prefs.theme);
  const lang = resolveLocale(prefs.locale, browser.i18n.getUILanguage());
  document.documentElement.lang = lang;
  document.title = PRIVACY_TITLE[lang];
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Privacy lang={lang} />
    </React.StrictMode>,
  );
});
