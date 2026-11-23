import { useI18n } from '@sulo/ui/i18n';
import { SuloMascot } from '@sulo/ui/mascot/SuloMascot';
import { Button } from '@sulo/ui/ui/button';
import { Lead, Title } from './Shell';

/** Action bar of "Mata kuliahmu": refresh the list (24-hour TTL skipped once) and save. */
export function ManageFooter({
  selected,
  saving,
  refreshing,
  note,
  onRefresh,
  onSave,
}: {
  selected: number;
  saving: boolean;
  refreshing: boolean;
  note: string | null;
  onRefresh: () => void;
  onSave: () => void;
}) {
  const t = useI18n().m.onboarding.manage;
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button size="lg" variant="outline" className="ob-cta" onClick={onRefresh} disabled={refreshing || saving}>
          {refreshing ? t.refreshing : t.refresh}
        </Button>
        {note && (
          <p role="status" className="truncate text-[15px] text-muted-foreground">
            {note}
          </p>
        )}
      </div>
      <Button size="lg" className="ob-cta" onClick={onSave} disabled={saving || refreshing || selected === 0}>
        {t.save}
      </Button>
    </div>
  );
}

/** After "Simpan" with changes: back to the popup, or close the tab. */
export function ManageSaved({ onBack, onClose, note }: { onBack: () => void; onClose: () => void; note: string | null }) {
  const t = useI18n().m.onboarding.manage;
  return (
    <div className="space-y-6">
      <SuloMascot mood="happy" size={96} grounded />
      <Title>{t.savedTitle}</Title>
      <Lead>{t.savedBody}</Lead>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" className="ob-cta" onClick={onBack}>
          {t.backToSulo}
        </Button>
        <Button size="lg" variant="outline" className="ob-cta" onClick={onClose}>
          {t.close}
        </Button>
      </div>
      {note && <p className="text-[15px] text-muted-foreground">{note}</p>}
    </div>
  );
}

/** "Tidak ada perubahan", shown for about a second before the tab closes. */
export function ManageNoChanges() {
  const t = useI18n().m.onboarding.manage;
  return (
    <div role="status" className="space-y-6">
      <SuloMascot mood="neutral" size={96} grounded />
      <Title>{t.noChanges}</Title>
    </div>
  );
}
