import flameUrl from '@/assets/brand/flame-full.svg';

/**
 * Sulo's static brand mark (the flame from docs/BRAND.md), for the dashboard
 * sidebar and the popup header. Not the animated mascot, which only appears
 * in the overview hero, empty states, the "Masih bingung?" card and setup.
 */
export function BrandMark({ size }: { size: number }) {
  return <img src={flameUrl} alt="" aria-hidden="true" width={size} height={size} className="shrink-0" />;
}
