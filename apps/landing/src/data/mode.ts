// Preview mode, for looking at the page before 1.0.0 is out: the download
// buttons borrow the 0.9.1 test build's sizes and lead to the guides instead
// of a file, and the page says so in a small label. A real build (the
// variable unset) never shows it. Build a preview with LANDING_PRATINJAU=1.
export const PRATINJAU = process.env.LANDING_PRATINJAU === '1';

// Visits are counted by the host (Vercel Web Analytics: no cookies) on the
// live site only. The script's address exists nowhere else, so a local build,
// CI and a preview deployment never write it.
export const HITUNG_KUNJUNGAN = process.env.VERCEL_ENV === 'production';
