// Mata kuliah: the dashboard's course list (followed, name, color).
import { mobileDash } from '@sulo/core/i18n/mobile';
import { MataKuliahList } from '@sulo/ui/dashboard/MataKuliahList';
import { useI18n } from '@sulo/ui/i18n';
import { useMobileData } from '../shell/data';

export function MataKuliahScreen() {
  const { locale } = useI18n();
  const { data, actions } = useMobileData();
  return (
    <div className="m-touch">
      <MataKuliahList d={mobileDash(locale)} user={data!.user!} actions={actions} />
    </div>
  );
}
