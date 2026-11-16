// Links to outside services, opened only when the user clicks (docs/UI.md,
// "Tautan ke luar"). Plain links in a new tab; nothing from these services
// is loaded into any extension page. An empty value hides its link.

/** "Traktir kopi" (Trakteer). */
export const TRAKTEER_URL = 'https://trakteer.id/krar';

export type CreatorLinkId = 'instagram' | 'linkedin' | 'github' | 'web';

/** "Dibuat oleh": the maintainer's public profiles. Empty URLs are hidden. */
export const CREATOR_NAME = 'Ikrar Gempur Tirani';
export const CREATOR_LINKS: readonly { id: CreatorLinkId; label: string; url: string }[] = [
  { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/krargmprr/' },
  { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/ikrargempurtirani/' },
  { id: 'github', label: 'GitHub', url: 'https://github.com/Ikrar06' },
  { id: 'web', label: 'Portofolio', url: 'https://ikrar.dev' },
];

/**
 * "Kirim masukan" (Google Form): the public link only, never the editor
 * link (scripts/leak-rules.mjs fails the build on one). Empty hides the button.
 */
export const FEEDBACK_FORM_URL = '';

/** True for a link that may be shown: https and not empty. */
export function isShownLink(url: string): boolean {
  return /^https:\/\/\S+$/.test(url);
}
