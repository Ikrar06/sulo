import React from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createBrowserStore } from '@/lib/browser-store';
import { messagesFor, resolveLocale, type Locale } from '@/lib/i18n';
import { readPrefs } from '@/lib/prefs';
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_TITLE, PRIVACY_UPDATED, type Block } from '@/lib/privacy/content';
import '@/assets/tailwind.css';
import { installInputModality } from '@/lib/ui/input-modality';
import { applyTheme } from '@/lib/ui/theme';

// In-extension privacy policy, rendered from the same source as PRIVACY.md,
// in the user's language (stored choice, else the browser's).

// Focus rings for keyboard users only (see assets/tailwind.css).
installInputModality(document, document.documentElement);

function BlockView({ block, lang }: { block: Block; lang: Locale }) {
  if (block.kind === 'p') return <p>{block.text[lang]}</p>;
  const items = block.items.map((item) => <li key={item.id}>{item[lang]}</li>);
  return block.kind === 'ol' ? <ol className="list-decimal space-y-1 pl-5">{items}</ol> : <ul className="list-disc space-y-1 pl-5">{items}</ul>;
}

function Privacy({ lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10 text-sm leading-relaxed sm:px-6">
      <h1 className="text-xl">{PRIVACY_TITLE[lang]}</h1>
      <p className="text-xs text-muted-foreground">{messagesFor(lang).privacyPage.updated(PRIVACY_UPDATED[lang])}</p>
      {PRIVACY_INTRO.map((b, i) => (
        <BlockView key={i} block={b} lang={lang} />
      ))}
      {PRIVACY_SECTIONS.map((s) => (
        <section key={s.heading.id} className="space-y-2 pt-2">
          <h2 className="text-base">{s.heading[lang]}</h2>
          {s.blocks.map((b, i) => (
            <BlockView key={i} block={b} lang={lang} />
          ))}
        </section>
      ))}
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
