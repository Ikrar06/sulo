// Another SIKOLA account is signed in (Tahap 2, e2): the choice right on the
// dashboard, with the popup's own words and messages. "Pakai akun ini" asks
// first, because it deletes the previous account's data in Sulo (not in
// SIKOLA); "Nanti" keeps that data hidden until the previous account is back.

import { useState } from 'react';
import { useI18n } from '@sulo/ui/i18n';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@sulo/ui/ui/alert-dialog';
import { Button } from '@sulo/ui/ui/button';

export function MismatchCard({ deferred, onUseNew, onDefer }: { deferred: boolean; onUseNew: () => void; onDefer: () => void }) {
  const a = useI18n().m.popup.account;
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5">
      <Mascot state="sleepy" size={56} />
      <div className="min-w-0 flex-1">
        <h2 className="text-[16px] font-semibold">{deferred ? a.deferredTitle : a.title}</h2>
        <p className="mt-1 max-w-[68ch] text-[14px] text-muted-foreground">{deferred ? a.deferredBody : a.body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant={deferred ? 'outline' : 'default'} onClick={() => setConfirm(true)}>
            {a.useThis}
          </Button>
          {!deferred && (
            <Button variant="ghost" onClick={onDefer}>
              {a.later}
            </Button>
          )}
        </div>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>{a.confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription className="mt-2">{a.useThisNote}</AlertDialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button variant="outline">{a.cancel}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive-solid" onClick={onUseNew}>
                {a.useThis}
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
