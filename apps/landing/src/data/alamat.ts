// Every address the landing page links to, in one place: its own pages in
// both languages, and the few outside ones (the code, the app's privacy page,
// the release notes, the tip jar). Links only: nothing is loaded from them.
import { CREATOR_LINKS, CREATOR_NAME, FEEDBACK_FORM_URL, TRAKTEER_URL } from '@sulo/core/links';
import type { Bahasa } from '../teks';

/** The public repository the releases come from (brief 9.2; the page goes live with 1.0.0, once it is public). */
export const REPO = 'https://github.com/Ikrar06/sulo';
export const RILIS = `${REPO}/releases`;
export const ISU = `${REPO}/issues/new/choose`;
export const LISENSI = `${REPO}/blob/main/LICENSE`;
/** The maker, the tip jar and the feedback form: the apps' own (packages/core/src/links.ts), never a copy. */
export const PEMBUAT = CREATOR_NAME;
/** Where the maker's name leads: the portfolio. */
export const PROFIL = CREATOR_LINKS.find((l) => l.id === 'web')?.url ?? 'https://ikrar.dev';
export const TRAKTEER = TRAKTEER_URL;
/** "Lapor masalah": the app's own feedback form (no account needed); GitHub issues are named in the FAQ. */
export const MASUKAN = FEEDBACK_FORM_URL;
/** The apps' privacy page, kept where it has always been (sulo-data). */
export const PRIVASI_APLIKASI: Record<Bahasa, string> = {
  id: 'https://ikrar06.github.io/sulo-data/privasi.html',
  en: 'https://ikrar06.github.io/sulo-data/privacy.html',
};

export type Perangkat = 'android' | 'chrome' | 'edge' | 'iphone';

const awal = (bahasa: Bahasa) => (bahasa === 'en' ? '/en' : '');
export const pathRumah = (bahasa: Bahasa) => `${awal(bahasa)}/`;
export const pathPasang = (bahasa: Bahasa, perangkat?: Perangkat) => `${awal(bahasa)}/pasang/${perangkat ? `${perangkat}/` : ''}`;
/** The user guide: its first page, or the guide of one app. */
export type Aplikasi = 'ekstensi' | 'android';
export const pathPakai = (bahasa: Bahasa, aplikasi?: Aplikasi) => `${awal(bahasa)}/panduan/${aplikasi ? `${aplikasi}/` : ''}`;
/** The same page in the other language. */
export const pathLain = (path: string, bahasa: Bahasa) => (bahasa === 'en' ? path.replace(/^\/en(\/|$)/, '/') : `/en${path}`);
