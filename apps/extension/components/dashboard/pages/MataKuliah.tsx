import { MataKuliahList } from '@sulo/ui/dashboard/MataKuliahList';
import { NeosiaMapping } from '../NeosiaMapping';
import type { PageProps } from '../types';

/** Mata kuliah: the shared course list, then the NEOSIA mapping. */
export function MataKuliahPage({ d, data, actions }: PageProps) {
  return (
    <MataKuliahList d={d} user={data.user!} actions={actions}>
      <NeosiaMapping data={data} />
    </MataKuliahList>
  );
}
