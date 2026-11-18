import { useI18n } from '@/components/i18n';
import { neosiaWords } from '@/lib/i18n/neosia';
import { Card } from '../Shell';
import type { PageProps } from '../types';

// Weekly class schedule from NEOSIA (M7 part E3).
export function JadwalPage(_props: PageProps) {
  const { locale } = useI18n();
  const w = neosiaWords(locale);
  return (
    <Card>
      <p className="text-[14px] font-semibold">{w.noData}</p>
      <p className="mt-1 text-[14px] text-muted-foreground">{w.jadwal.empty}</p>
    </Card>
  );
}
