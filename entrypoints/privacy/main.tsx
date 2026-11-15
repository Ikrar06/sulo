import React from 'react';
import ReactDOM from 'react-dom/client';
import { id } from '@/lib/i18n/id';
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_TITLE, PRIVACY_UPDATED, type Block } from '@/lib/privacy/content';
import '@/assets/tailwind.css';

// In-extension privacy policy, rendered from the same source as PRIVACY.md.

function BlockView({ block }: { block: Block }) {
  if (block.kind === 'p') return <p>{block.text.id}</p>;
  const items = block.items.map((item) => <li key={item.id}>{item.id}</li>);
  return block.kind === 'ol' ? <ol className="list-decimal space-y-1 pl-5">{items}</ol> : <ul className="list-disc space-y-1 pl-5">{items}</ul>;
}

function Privacy() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10 text-sm leading-relaxed sm:px-6">
      <h1 className="text-xl">{PRIVACY_TITLE.id}</h1>
      <p className="text-xs text-muted-foreground">{id.privacyPage.updated(PRIVACY_UPDATED.id)}</p>
      {PRIVACY_INTRO.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
      {PRIVACY_SECTIONS.map((s) => (
        <section key={s.heading.id} className="space-y-2 pt-2">
          <h2 className="text-base">{s.heading.id}</h2>
          {s.blocks.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </section>
      ))}
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Privacy root element not found');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Privacy />
  </React.StrictMode>,
);
