// The MKPK card (docs/mkpk/RENCANA.md, F1): credits on the transcript, the
// MKPK courses in this semester's KRS, and the ones the study program
// offers, all from NEOSIA data Sulo already has. The study program's load
// (20 or 10 credits) is Sulo's estimate until the student confirms or
// changes it; before that the card shows the credits without a scale.
// Credits are masked in privacy mode, like the overview's other credits.

import { useState } from 'react';
import { useI18n } from '../i18n';
import { Private, usePrivacy } from '../private';
import { Button } from '../ui/button';
import { Card } from '../card';
import { formatAgo } from '@sulo/core/format/time';
import { neosiaWords } from '@sulo/core/i18n/neosia';
import { MKPK_INFO_URL } from '@sulo/core/links';
import { estimateLoad, type MkpkLoadChoice } from '@sulo/core/mkpk/load';
import { mkpkProgress, sksText } from '@sulo/core/mkpk/progress';
import type { MkpkTranscript } from '@sulo/core/mkpk/transcript';
import type { Snapshots } from '@sulo/core/neosia/store';

interface Props {
  snapshots: Snapshots;
  transcript: MkpkTranscript | null;
  /** The confirmed load from the preferences; null until the student chose. */
  load: MkpkLoadChoice | null;
  onLoad: (choice: MkpkLoadChoice) => void;
  now: number;
}

export function MkpkCard({ snapshots, transcript, load, onLoad, now }: Props) {
  const { locale, m } = useI18n();
  const w = neosiaWords(locale).mkpk;
  const masked = usePrivacy();
  const [listOpen, setListOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const p = mkpkProgress(snapshots, transcript);
  if (!p.applies || load === 'none') return null;

  const guess = transcript ? estimateLoad(transcript.letters) : null;
  const scale = load === 20 || load === 10 ? load : null;
  const fill = scale !== null ? Math.min(100, Math.round((p.passedSks / scale) * 100)) : null;
  const seen = Math.max(p.transcriptAt ?? 0, p.krsAt ?? 0);
  const text = (sks: number) => sksText(sks, locale);

  return (
    <Card title={w.title}>
      {p.transcriptAt === null ? (
        <p className="text-[14px] text-muted-foreground">{w.noTranscript}</p>
      ) : (
        <>
          <p className="text-[14px] font-semibold">
            <Private>{scale !== null ? w.passedOf(text(p.passedSks), scale) : w.passed(text(p.passedSks))}</Private>
          </p>
          {fill !== null && (
            // The same bar as the studies card: solid, neutral, empty in privacy mode.
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised" role="img" aria-label={w.scale(scale!)}>
              {!masked && <div className="h-full rounded-full bg-foreground" style={{ width: `${fill}%` }} />}
            </div>
          )}
        </>
      )}
      {p.enrolledSks > 0 && (
        <p className="mt-2 text-[14px] text-muted-foreground">
          <Private>{w.enrolled(text(p.enrolledSks))}</Private>
        </p>
      )}
      {p.offered.length > 0 && (
        <div className="mt-2">
          <p className="text-[14px] text-muted-foreground">{w.offered(p.offered.length)}</p>
          <p>
            <button
              type="button"
              aria-expanded={listOpen}
              onClick={() => setListOpen(!listOpen)}
              className="rounded text-[14px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-ring"
            >
              {listOpen ? w.hideOffered : w.showOffered}
            </button>
          </p>
          {listOpen && (
            <ul className="mt-2 space-y-1 text-[14px]">
              {p.offered.map((o) => (
                <li key={o.code} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">{o.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{`${text(o.sks)} SKS`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {load === null && (
        <div className="mt-4 border-t border-border pt-3">
          {guess !== null && !choosing ? (
            <>
              <p className="text-[14px]">{w.loadGuess(guess)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button onClick={() => onLoad(guess)}>{w.correct}</Button>
                <Button variant="outline" onClick={() => setChoosing(true)}>
                  {w.change}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[14px]">{w.loadAsk}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => onLoad(20)}>
                  {w.choice[20]}
                </Button>
                <Button variant="outline" onClick={() => onLoad(10)}>
                  {w.choice[10]}
                </Button>
                <Button variant="ghost" onClick={() => onLoad('none')}>
                  {w.choice.none}
                </Button>
              </div>
            </>
          )}
          <a href={MKPK_INFO_URL} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block rounded text-[12px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-ring">
            {w.rules}
          </a>
        </div>
      )}

      {seen > 0 && <p className="mt-3 text-[12px] leading-normal text-muted-foreground">{w.source(formatAgo(seen, now, m))}</p>}
    </Card>
  );
}
