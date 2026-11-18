import { CheckIcon, ExternalIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n';
import type { WhatsNewEntry } from '@sulo/core/onboarding/whats-new';
import { PinIllustration } from './illustrations';
import { Lead, Title } from './Shell';


export function StepIntro({ noticeOutdated, onContinue }: { noticeOutdated: boolean; onContinue: () => void }) {
  const { m } = useI18n();
  const t = m.onboarding;
  return (
    <div className="space-y-7">
      <Title>{t.intro.title}</Title>
      <Lead>{t.intro.lead}</Lead>
      {noticeOutdated && <p className="rounded-lg bg-surface-raised px-4 py-3 text-[15px]">{t.intro.noticeUpdated}</p>}
      <ul className="space-y-3">
        {t.intro.points.map((p) => (
          <li key={p} className="flex items-start gap-3 text-[17px] leading-7">
            <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-amber/20 text-foreground">
              <CheckIcon className="size-3.5" />
            </span>
            {p}
          </li>
        ))}
      </ul>
      <p className="max-w-[36em] text-[15px] leading-6 text-muted-foreground">
        {m.disclaimer}{' '}
        <a className="font-medium text-foreground underline underline-offset-4" href="/privacy.html" target="_blank" rel="noopener noreferrer">
          {m.privacyLinkLong}
        </a>
      </p>
      <Button size="lg" className="ob-cta" onClick={onContinue}>
        {t.intro.start}
      </Button>
    </div>
  );
}

export type ConnectStatus = 'checking' | 'need_login' | 'waiting' | 'connected' | 'failed';

export function StepConnect(props: { status: ConnectStatus; failedReason?: string; onOpenSikola: () => void; onRetry: () => void; lead?: string }) {
  const { m } = useI18n();
  const t = m.onboarding;
  const { status } = props;
  const showActions = status === 'need_login' || status === 'waiting' || status === 'failed';
  return (
    <div className="space-y-7">
      <Title>{t.connect.title}</Title>
      <Lead>{props.lead ?? t.connect.lead}</Lead>
      {/* Nothing is being checked before the user logs in, so no status then. */}
      <div role="status" className="flex min-h-12 items-center gap-3 text-[16px]">
        {status === 'need_login' ? null : status === 'connected' ? (
          <>
            <span className="flex size-7 items-center justify-center rounded-full bg-brand-amber/25">
              <CheckIcon className="size-4" />
            </span>
            <span>
              <span className="font-semibold">{t.connect.connected}</span>
              <span className="block text-[15px] text-muted-foreground">{t.connect.loading}</span>
            </span>
          </>
        ) : status === 'failed' ? (
          <span className="text-muted-foreground">{t.connect.failed(props.failedReason ?? '')}</span>
        ) : (
          <>
            <span className="ob-pulse" aria-hidden="true" />
            <span className="text-muted-foreground">{status === 'waiting' ? t.connect.waiting : t.connect.checking}</span>
          </>
        )}
      </div>
      {showActions && (
        <div className="flex flex-wrap gap-3">
          <Button size="lg" className="ob-cta" onClick={props.onOpenSikola}>
            {t.connect.open}
            <ExternalIcon className="size-4" />
          </Button>
          {status === 'failed' && (
            <Button size="lg" variant="outline" className="ob-cta" onClick={props.onRetry}>
              {t.connect.retry}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function StepDone({ tasks, onOpen, note }: { tasks: number; onOpen: () => void; note?: string | null }) {
  const { m } = useI18n();
  const t = m.onboarding;
  return (
    <div className="space-y-7">
      <Title>{t.done.title}</Title>
      <Lead>{t.done.summary(tasks)}</Lead>
      <div className="max-w-[460px] space-y-4 rounded-2xl bg-surface-raised p-5">
        <p className="text-[16px] font-semibold">{t.done.pinTitle}</p>
        <PinIllustration />
        <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-6 text-foreground/85">
          {t.done.pinSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
      <div className="space-y-3">
        <Button size="lg" className="ob-cta" onClick={onOpen}>
          {t.done.open}
        </Button>
        {note && (
          <p role="status" className="text-[15px] text-muted-foreground">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * "Yang baru di Sulo": for people who finished onboarding before. Shows the
 * new entries and, when the privacy notice changed, a link to read it.
 */
export function StepWhatsNew(props: { entries: readonly WhatsNewEntry[]; noticeChanged: boolean; onDone: () => void }) {
  const { m } = useI18n();
  const t = m.onboarding;
  return (
    <div className="space-y-7">
      <Title>{t.whatsNew.title}</Title>
      {props.entries.length > 0 && (
        <ul className="space-y-5">
          {props.entries.map((e) => (
            <li key={`${e.noticeVersion}-${e.title}`} className="space-y-1">
              <p className="text-[17px] font-semibold">{e.title}</p>
              <p className="text-[16px] leading-7 text-foreground/85">{e.body}</p>
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
