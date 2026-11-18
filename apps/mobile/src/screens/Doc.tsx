// Plain text pages (Bantuan, Privasi): paragraphs and lists from core
// content, at a comfortable reading size.

import type { Block, Lang } from '@sulo/core/privacy/content';

export function DocBlocks({ blocks, lang }: { blocks: readonly Block[]; lang: Lang }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.kind === 'p' ? (
          <p key={i} className="text-m15r">
            {b.text[lang]}
          </p>
        ) : b.kind === 'ul' ? (
          <ul key={i} className="list-disc space-y-2 pl-5 text-m15r">
            {b.items.map((t, j) => (
              <li key={j}>{t[lang]}</li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="list-decimal space-y-2 pl-5 text-m15r">
            {b.items.map((t, j) => (
              <li key={j}>{t[lang]}</li>
            ))}
          </ol>
        ),
      )}
    </>
  );
}
