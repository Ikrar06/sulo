// The MKPK card (docs/mkpk/RENCANA.md, F1): credits on the transcript, the
// MKPK courses in this semester's KRS, and the ones the study program
// offers, all from NEOSIA data Sulo already has. The study program's load
// (20 or 10 credits) is Sulo's estimate until the student confirms or
// changes it; before that the card shows the credits without a scale.
// Credits are masked in privacy mode, like the overview's other credits.

import { useState } from 'react';
import { useI18n } from '../i18n';
import { ChevronDownIcon } from '../icons';
import { Private, usePrivacy } from '../private';
import { Button } from '../ui/button';
import { Card } from '../card';
import { formatAgo } from '@sulo/core/format/time';
import { neosiaWords } from '@sulo/core/i18n/neosia';
import { MKPK_INFO_URL } from '@sulo/core/links';
import { estimateLoad, type MkpkLoadChoice } from '@sulo/core/mkpk/load';
import { mkpkProgress, sksText } from '@sulo/core/mkpk/progress';
import { reminderText, type MkpkReminder } from '@sulo/core/mkpk/reminders';
import type { SipakamaseSummary } from '@sulo/core/mkpk/sipakamase-summary';
import { sipakamaseWords, type SipakamaseWords } from '@sulo/core/i18n/sipakamase';
import { AlertCircleIcon } from '../dashboard-icons';
import type { MkpkTranscript } from '@sulo/core/mkpk/transcript';
import type { Snapshots } from '@sulo/core/neosia/store';

interface Props {
  snapshots: Snapshots;
  transcript: MkpkTranscript | null;
  /** The confirmed load from the preferences; null until the student chose. */
  load: MkpkLoadChoice | null;
  onLoad: (choice: MkpkLoadChoice) => void;
  now: number;
  /** Sipakamase (1.1.0): its summary and reminders when connected; `onConnect` opens its consent when not. */
  /** `invited`: the overview's "Hubungkan Sipakamase" line is on screen, so the card's own quiet link waits. */
  sipakamase?: { summary: SipakamaseSummary; reminders: MkpkReminder[]; onConnect: () => void; invited?: boolean } | null;
}

export function MkpkCard({ snapshots, transcript, load, onLoad, now, sipakamase = null }: Props) {
  const { locale, m } = useI18n();
  const w = neosiaWords(locale).mkpk;
  const masked = usePrivacy();
  const [listOpen, setListOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [allReminders, setAllReminders] = useState(false);
  const sw = sipakamaseWords(locale);
  const p = mkpkProgress(snapshots, transcript);
  if (!p.applies || load === 'none') return null;

  const guess = transcript ? estimateLoad(transcript.letters) : null;
  const scale = load === 20 || load === 10 ? load : null;
  const fill = scale !== null ? Math.min(100, Math.round((p.passedSks / scale) * 100)) : null;
  const seen = Math.max(p.transcriptAt ?? 0, p.krsAt ?? 0);
  const text = (sks: number) => sksText(sks, locale);

  const link = 'rounded text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-ring';

  return (
    <Card title={w.title}>
      {p.transcriptAt === null ? (
        <p className="text-[14px] text-muted-foreground">{w.noTranscript}</p>
      ) : (
        // One number carries the card; its unit and scale sit beside it in the quiet voice.
        <div>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[24px] leading-8 font-semibold tabular-nums">
              <Private>{text(p.passedSks)}</Private>
            </span>
            <span className="text-[14px] text-muted-foreground">{scale !== null ? w.passedUnitOf(scale) : w.passedUnit}</span>
          </p>
          {fill !== null && (
            // The same bar as the studies card: solid, neutral, empty in privacy mode.
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised" role="img" aria-label={w.scale(scale!)}>
              {!masked && <div className="h-full rounded-full bg-foreground" style={{ width: `${fill}%` }} />}
            </div>
          )}
        </div>
      )}

      {/* Label and value rows instead of sentences: read down the right edge. */}
      {(p.enrolledSks > 0 || p.offered.length > 0) && (
        <div className="mt-3 text-[14px]">
          {p.enrolledSks > 0 && (
            <div className="flex min-h-10 items-center justify-between gap-3 border-t border-border">
              <span className="text-muted-foreground">{w.enrolledLabel}</span>
              <span className="tabular-nums">
                <Private>{w.sksValue(text(p.enrolledSks))}</Private>
              </span>
            </div>
          )}
          {p.offered.length > 0 && (
            <div className="border-t border-border">
              <button
                type="button"
                aria-expanded={listOpen}
                onClick={() => setListOpen(!listOpen)}
                className="flex min-h-10 w-full items-center justify-between gap-3 rounded text-left outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-ring"
              >
                <span className="text-muted-foreground">{w.offeredLabel}</span>
                <span className="flex items-center gap-1 tabular-nums">
                  {w.coursesValue(p.offered.length)}
                  <ChevronDownIcon aria-hidden="true" className={`size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${listOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {listOpen && (
                <ul className="space-y-1 pb-1" aria-label={w.offeredLabel}>
                  {p.offered.map((o) => (
                    <li key={o.code} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0">{o.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{w.sksValue(text(o.sks))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {sipakamase && <SipakamasePart part={sipakamase} sw={sw} text={text} allReminders={allReminders} onAll={() => setAllReminders(true)} />}

      {load === null && (
        // The load question, set apart by space alone.
        <div className="mt-4 space-y-2">
          {guess !== null && !choosing ? (
            <>
              <p className="text-[14px]">{w.loadGuess(guess)}</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => onLoad(guess)}>{w.correct}</Button>
                <Button variant="outline" onClick={() => setChoosing(true)}>
                  {w.change}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[14px] font-medium">{w.loadAsk}</p>
                <a href={MKPK_INFO_URL} target="_blank" rel="noopener noreferrer" className={`shrink-0 text-[12px] ${link}`}>
                  {w.rulesShort}
                </a>
              </div>
              <div role="group" aria-label={w.loadAsk} className="grid grid-cols-3 gap-2">
                {([20, 10, 'none'] as const).map((c) => (
                  <Button key={c} variant="outline" onClick={() => onLoad(c)} aria-label={w.choice[c]}>
                    {w.loadShort[c]}
                  </Button>
                ))}
              </div>
              <p className="text-[12px] text-muted-foreground">{w.loadHelp}</p>
            </>
          )}
        </div>
      )}

      {(seen > 0 || sipakamase?.summary.readAt) && (
        <p className="mt-3 text-[12px] leading-normal text-muted-foreground">
          {[seen > 0 ? w.source(formatAgo(seen, now, m)) : null, sipakamase?.summary.readAt ? sw.card.source(formatAgo(sipakamase.summary.readAt, now, m)) : null].filter(Boolean).join(' ')}
        </p>
      )}
    </Card>
  );
}

/** Reminders shown before "n lainnya": the card stays a glance. */
const SHOWN_REMINDERS = 2;

function SipakamasePart({ part, sw, text, allReminders, onAll }: { part: NonNullable<Props['sipakamase']>; sw: SipakamaseWords; text: (sks: number) => string; allReminders: boolean; onAll: () => void }) {
  const { summary, reminders, onConnect } = part;
  if (!summary.connected) {
    if (part.invited) return null;
    return (
      <p className="mt-3 border-t border-border pt-3 text-[14px] text-muted-foreground">
        {sw.card.invite}{' '}
        <button type="button" onClick={onConnect} className="rounded text-foreground underline underline-offset-2 outline-none focus-ring:ring-2 focus-ring:ring-ring">
          {sw.connect}
        </button>
      </p>
    );
  }
  // d is the row above; the list holds what has a name.
  const named = reminders.filter((r) => r.kind !== 'd');
  const shown = allReminders ? named : named.slice(0, SHOWN_REMINDERS);
  const problem = summary.state === 'needs_login' ? sw.card.needsLogin : summary.state === 'broken' ? sw.card.broken : null;
  return (
    <div className="text-[14px]">
      {summary.notInNeosiaSks !== null && summary.notInNeosiaSks > 0 && (
        <div className="flex min-h-10 items-center justify-between gap-3 border-t border-border">
          <span className="text-muted-foreground">{sw.card.notInNeosiaLabel}</span>
          <span className="tabular-nums">
            <Private>{`${text(summary.notInNeosiaSks)} SKS`}</Private>
          </span>
        </div>
      )}
      {summary.unconvertedSks !== null && summary.unconvertedSks > 0 && (
        <div className="flex min-h-10 items-center justify-between gap-3 border-t border-border">
          <span className="text-muted-foreground">{sw.card.unconvertedLabel}</span>
          <span className="tabular-nums">
            <Private>{`${text(summary.unconvertedSks)} SKS`}</Private>
          </span>
        </div>
      )}
      {shown.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-2">
          {shown.map((r, i) => (
            <li key={`${r.kind}-${i}`} className="flex items-start gap-2 text-[12px] leading-5">
              <AlertCircleIcon aria-hidden="true" className="mt-1 size-3.5 shrink-0 text-urgency-soon" />
              <span>{reminderText(r, sw, text)}</span>
            </li>
          ))}
          {!allReminders && named.length > SHOWN_REMINDERS && (
            <li>
              <button type="button" onClick={onAll} className="rounded text-[12px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-ring">
                {sw.card.more(named.length - SHOWN_REMINDERS)}
              </button>
            </li>
          )}
        </ul>
      )}
      {problem && <p className="mt-2 text-[12px] text-muted-foreground">{problem}</p>}
    </div>
  );
}
