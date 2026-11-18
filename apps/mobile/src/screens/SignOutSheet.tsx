// "Keluar dari Sulo?" (Lainnya and Pengaturan): signing out deletes the
// session, all data and the scheduled reminders on this phone. Both buttons
// full width, stacked, so the long label never wraps.

import { mobileWords } from '@sulo/core/i18n/mobile';
import { useI18n } from '@sulo/ui/i18n';
import { PillButton } from '@sulo/ui/mobile/controls';
import { Sheet } from '@sulo/ui/mobile/sheet';
import { signOutEverything } from '../account';
import { useMobileData } from '../shell/data';

export function SignOutSheet({ open, onOpenChange, onSignedOut }: { open: boolean; onOpenChange: (open: boolean) => void; onSignedOut: () => void }) {
  const { locale } = useI18n();
  const w = mobileWords(locale);
  const { platform } = useMobileData();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={w.connected.signOutTitle}>
      <p className="text-m15r text-muted-foreground">{w.connected.signOutBody}</p>
      <div className="mt-4 flex flex-col gap-2">
        <PillButton
          full
          danger
          onPress={async () => {
            await signOutEverything(platform);
            onOpenChange(false);
            onSignedOut();
          }}
        >
          {w.settings.signOutDelete}
        </PillButton>
        <PillButton full onPress={() => onOpenChange(false)}>
          {w.connected.cancel}
        </PillButton>
      </div>
    </Sheet>
  );
}
