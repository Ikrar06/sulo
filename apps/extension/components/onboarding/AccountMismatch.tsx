import { useI18n } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import { Lead, Title } from './Shell';

/** The setup page while another SIKOLA account is detected: same choices as the popup. */
export function AccountMismatch({ onUseNew, onDefer }: { onUseNew: () => void; onDefer: () => void }) {
  const a = useI18n().m.popup.account;
  return (
    <div className="space-y-6">
      <Title>{a.title}</Title>
      <Lead>{a.body}</Lead>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" className="ob-cta" onClick={onUseNew}>
          {a.useThis}
        </Button>
        <Button size="lg" variant="ghost" className="ob-cta" onClick={onDefer}>
          {a.later}
        </Button>
      </div>
      <p className="max-w-[34em] text-[15px] leading-6 text-muted-foreground">{a.useThisNote}</p>
    </div>
  );
}
