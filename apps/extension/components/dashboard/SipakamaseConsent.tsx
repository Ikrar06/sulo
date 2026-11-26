// The Sipakamase consent dialog (1.1.0), before Chrome's own permission
// prompt. Its text is SIPAKAMASE_CONSENT, the same object the privacy page
// shows. Focus starts on "Nanti saja" (Radix AlertDialog).

import { useI18n } from '@sulo/ui/i18n';
import { Button } from '@sulo/ui/ui/button';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@sulo/ui/ui/alert-dialog';
import { sipakamaseWords } from '@sulo/core/i18n/sipakamase';
import { SIPAKAMASE_CONSENT as C } from '@sulo/core/privacy/content';

export function SipakamaseConsent({ open, busy, onCancel, onConnect }: { open: boolean; busy: boolean; onCancel: () => void; onConnect: () => void }) {
  const { locale: l } = useI18n();
  const w = sipakamaseWords(l);
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <AlertDialogContent className="max-h-[calc(100vh-32px)] overflow-y-auto sm:max-w-lg">
        <AlertDialogTitle>{C.title[l]}</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="mt-2 space-y-4 text-[14px] leading-6">
            <p className="text-foreground">{C.how[l]}</p>
            <section>
              <h3 className="text-[14px] font-semibold text-foreground">{C.keptTitle[l]}</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {C.kept.map((t) => (
                  <li key={t.id}>{t[l]}</li>
                ))}
                <li>{w.browserClosed}</li>
              </ul>
            </section>
            <section>
              <h3 className="text-[14px] font-semibold text-foreground">{C.droppedTitle[l]}</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {C.dropped.map((t) => (
                  <li key={t.id}>{t[l]}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="text-[14px] font-semibold text-foreground">{C.offTitle[l]}</h3>
              <p className="mt-1">{C.off[l]}</p>
            </section>
            <p className="text-[12px]">{C.unofficial[l]}</p>
            <p className="text-[12px]">{w.chromeNext}</p>
            <p className="text-[12px]">{w.afterConnect}</p>
          </div>
        </AlertDialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={busy}>
              {w.later}
            </Button>
          </AlertDialogCancel>
          {/* Not an AlertDialogAction: the dialog stays open while Chrome asks. */}
          <Button onClick={onConnect} disabled={busy}>
            {w.connect}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
