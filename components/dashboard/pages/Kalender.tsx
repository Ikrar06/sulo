import type { PageProps } from '../types';

// Filled in later in M5a.
export function KalenderPage({ d }: PageProps) {
  return <p className="text-[14px] text-muted-foreground">{d.common.loading}</p>;
}
