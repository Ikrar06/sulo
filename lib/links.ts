// Links to outside services, opened only when the user clicks (docs/UI.md,
// "Tautan ke luar"). Plain links in a new tab; nothing from these services
// is loaded into any extension page. An empty value hides its link.

/** "Traktir kopi" (Trakteer). */
export const TRAKTEER_URL = 'https://trakteer.id/krar';

/** Social media profiles; added later. Empty entries are hidden. */
export const SOCIAL_LINKS: readonly { label: string; url: string }[] = [];

/** "Kirim kritik dan saran" (Google Form); added later. Empty hides the button. */
export const FEEDBACK_FORM_URL = '';

/** True for a link that may be shown: https and not empty. */
export function isShownLink(url: string): boolean {
  return /^https:\/\/\S+$/.test(url);
}
