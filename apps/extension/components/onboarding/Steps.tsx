import { ExternalIcon } from '@sulo/ui/icons';
import { Button } from '@sulo/ui/ui/button';
import { useI18n } from '@sulo/ui/i18n';
import { entryText, type WhatsNewEntry } from '@sulo/core/onboarding/whats-new';
import { WatchSwitch } from '../WatchSwitch';
import { Lead, Title } from './Shell';


export type ConnectStatus = 'checking' | 'need_login' | 'waiting' | 'connected' | 'failed';

export function StepWhatsNew(props: { entries: readonly WhatsNewEntry[]; noticeChanged: boolean; onDone: () => void }) {
  const { m, locale } = useI18n();
  const t = m.onboarding;
  return (
    <div className="space-y-7">
      <Title>{t.whatsNew.title}</Title>
      {props.entries.length > 0 && (
        <ul className="space-y-5">
          {props.entries.map((e) => (
            <li key={`${e.noticeVersion}-${e.id}`} className="space-y-1">
              <p className="text-[17px] font-semibold">{entryText(e, locale).title}</p>
              <p className="text-[16px] leading-7 text-foreground/85">{entryText(e, locale).body}</p>
              {e.action === 'watch' && (
                <div className="pt-2">
                  <WatchSwitch compact />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {props.noticeChanged && (
        <p className="text-[16px] leading-7">
          {t.whatsNew.noticeChanged}{' '}
          <a className="font-medium underline underline-offset-4" href="/privacy.html" target="_blank" rel="noopener noreferrer">
            {m.privacyLinkLong}
          </a>
        </p>
      )}
      <Button size="lg" className="ob-cta" onClick={props.onDone}>
        {t.whatsNew.ok}
      </Button>
    </div>
  );
}
