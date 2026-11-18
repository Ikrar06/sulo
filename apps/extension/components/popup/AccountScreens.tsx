import { useI18n } from '@/components/i18n';
import { Mascot } from '@/components/mascot/Mascot';
import { Button } from '@/components/ui/button';

/**
 * Another SIKOLA account is signed in. Nothing of the stored account is
 * shown. "Pakai akun ini" deletes it (after this explicit choice) and sets up
 * the new one; "Nanti" keeps it hidden until the previous account is back.
 */
export function MismatchScreen({
  deferred,
  still,
  onUseNew,
  onDefer,
}: {
  deferred: boolean;
  still?: boolean;
  onUseNew: () => void;
  onDefer: () => void;
}) {
  const a = useI18n().m.popup.account;
  return (
    <div className="flex flex-col items-center px-6 pt-4 pb-6 text-center">
      <Mascot state="sleepy" size={104} still={still} />
      <h2 className="mt-3 font-heading text-[17px] leading-[22px] text-balance">{deferred ? a.deferredTitle : a.title}</h2>
      <p className="mt-1.5 text-[13px] leading-[19px] text-muted-foreground">{deferred ? a.deferredBody : a.body}</p>
      <div className="mt-4 flex w-full flex-col gap-2">
        <Button variant={deferred ? 'outline' : 'default'} onClick={onUseNew}>
          {a.useThis}
        </Button>
        <p className="text-[12px] leading-4 text-muted-foreground">{a.useThisNote}</p>
        {!deferred && (
          // The one long label in the popup: it may wrap to two lines.
          <Button variant="ghost" className="h-auto min-h-8 py-1.5 whitespace-normal" onClick={onDefer}>
            {a.later}
          </Button>
        )}
      </div>
    </div>
  );
}
