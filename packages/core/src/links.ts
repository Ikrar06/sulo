// Links to outside services, opened only when the user clicks (docs/UI.md,
// "Tautan ke luar"). Plain links in a new tab; nothing from these services
// is loaded into any extension page. An empty value hides its link.

/** SIKOLA's dashboard: where "Buka SIKOLA" goes while signed in (SIKOLA itself sends a signed-out visitor to its login). */
export const SIKOLA_HOME = 'https://sikola-v2.unhas.ac.id/my/';
/** SIKOLA's login page: only when the session expired or no account was ever connected. */
export const SIKOLA_LOGIN = 'https://sikola-v2.unhas.ac.id/login/index.php';
/** NEOSIA's home: every "Buka NEOSIA" (NEOSIA itself asks for a login when needed). */
export const NEOSIA_HOME = 'https://neosia.unhas.ac.id/';
/** NEOSIA's login page. Not used in the extension (Sulo cannot know NEOSIA's login state); kept for the mobile version. */
export const NEOSIA_LOGIN = 'https://neosia.unhas.ac.id/login';

/** What Sulo knows about the SIKOLA account. */
export type SikolaAccountState = 'connected' | 'expired' | 'mismatch' | 'none';

/** "Buka SIKOLA": the login page only for an expired session or no account yet; otherwise SIKOLA's dashboard. */
export function sikolaUrl(state: SikolaAccountState): string {
  return state === 'expired' || state === 'none' ? SIKOLA_LOGIN : SIKOLA_HOME;
}

/** "Buka NEOSIA": always NEOSIA's home. Sulo sends no request to NEOSIA, so it never knows whether you are signed in. */
export function neosiaUrl(): string {
  return NEOSIA_HOME;
}

/** The public source repository. Empty: the MIT line and its link stay hidden on About. */
export const REPO_URL = '';

/** "Traktir kopi" (Trakteer). */
export const TRAKTEER_URL = 'https://teer.id/krar';

/** Unhas's own page on MKPK (load per cluster, rules, rubric): a plain link that opens a new tab. */
export const MKPK_INFO_URL = 'https://www.unhas.ac.id/mkpk/?lang=id';

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
export const FEEDBACK_FORM_URL = 'https://forms.gle/XsBuWXGHNR4pPTs17';

/** True for a link that may be shown: https and not empty. */
export function isShownLink(url: string): boolean {
  return /^https:\/\/\S+$/.test(url);
}

/** NEOSIA pages a "Buka" button opens (no student number or other identity in them). */
export const NEOSIA_TRANSKRIP = 'https://neosia.unhas.ac.id/transkrip-nilai';
export const NEOSIA_KRS = 'https://neosia.unhas.ac.id/kartu-rencana-studi';
export const NEOSIA_KHS = 'https://neosia.unhas.ac.id/kartu-hasil-studi';
export const NEOSIA_MATAKULIAH = 'https://neosia.unhas.ac.id/matakuliah';

/** Sulo's own site (the landing page and its guides). */
export const SULO_SITE = 'https://sulo.ikrar.dev';

/** The iPhone guide's "Memperbarui Sulo" part, in the app's language (owner's decision of 26 Nov 2026, C3). */
export function iosUpdateGuide(locale: 'id' | 'en'): string {
  return `${SULO_SITE}${locale === 'en' ? '/en' : ''}/pasang/iphone#perbarui`;
}
