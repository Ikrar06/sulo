// The MKPK card on Ringkasan (docs/mkpk/RENCANA.md, F1), the phone's take on
// packages/ui/src/dashboard/MkpkCard.tsx: the same numbers from core, in the
// phone's cards and pills. It reads the transcript's MKPK summary, never the
// transcript itself (grades stay with the screens that show them).

import { useState } from 'react';
import { formatAgo } from '@sulo/core/format/time';
import { neosiaWords } from '@sulo/core/i18n/neosia';
import { MKPK_INFO_URL } from '@sulo/core/links';
import { estimateLoad } from '@sulo/core/mkpk/load';
import { mkpkProgress, sksText } from '@sulo/core/mkpk/progress';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { Private, usePrivacy } from '@sulo/ui/private';
import { useI18n } from '@sulo/ui/i18n';
import { useMobileData } from '../../shell/data';
import { useNeosia } from '../../neosia/NeosiaProvider';

export function MkpkCard() {
  const { locale, m } = useI18n();
  const w = neosiaWords(locale).mkpk;
  const neo = useNeosia();
  const { data, actions } = useMobileData();
  const masked = usePrivacy();
  const [listOpen, setListOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const load = data!.prefs.mkpkLoad;
  if (!neo.enabled || load === 'none') return null;
  const p = mkpkProgress(neo.snapshots, neo.mkpk);
  if (!p.applies) return null;

  const guess = neo.mkpk ? estimateLoad(neo.mkpk.letters) : null;
  const scale = load === 20 || load === 10 ? load : null;
  const fill = scale !== null ? Math.min(100, Math.round((p.passedSks / scale) * 100)) : null;
  const seen = Math.max(p.transcriptAt ?? 0, p.krsAt ?? 0);
  const text = (sks: number) => sksText(sks, locale);
  const choose = (mkpkLoad: 20 | 10 | 'none') => void actions.setPrefs({ mkpkLoad });

  return (
    <Card className="mb-4" inner="space-y-3">
      <p className="text-m15 font-semibold">{w.title}</p>
      {p.transcriptAt === null ? (
        <p className="text-m13 text-muted-foreground">{w.noTranscript}</p>
      ) : (
        <div>
          <p className="text-m15">
            <Private>{scale !== null ? w.passedOf(text(p.passedSks), scale) : w.passed(text(p.passedSks))}</Private>
          </p>
          {fill !== null && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-m-inset" role="img" aria-label={w.scale(scale!)}>
              {!masked && <div className="h-full rounded-full bg-foreground" style={{ width: `${fill}%` }} />}
            </div>
          )}
        </div>
      )}
      {p.enrolledSks > 0 && (
        <p className="text-m13 text-muted-foreground">
          <Private>{w.enrolled(text(p.enrolledSks))}</Private>
        </p>
      )}
      {p.offered.length > 0 && (
        <div>
          <p className="text-m13 text-muted-foreground">{w.offered(p.offered.length)}</p>
          <button type="button" aria-expanded={listOpen} onClick={() => setListOpen(!listOpen)} className="m-hit text-left text-m13 text-muted-foreground underline underline-offset-2">
            {listOpen ? w.hideOffered : w.showOffered}
          </button>
          {listOpen && (
            <ul className="mt-2 space-y-2 text-m13">
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
        <div className="space-y-2 border-t border-border pt-3">
          {guess !== null && !choosing ? (
            <>
              <p className="text-m13">{w.loadGuess(guess)}</p>
              <div className="flex flex-wrap gap-2">
                <PillButton kind="primary" small onPress={() => choose(guess)}>
                  {w.correct}
                </PillButton>
                <PillButton small onPress={() => setChoosing(true)}>
                  {w.change}
                </PillButton>
              </div>
            </>
          ) : (
            <>
              <p className="text-m13">{w.loadAsk}</p>
              <div className="flex flex-col items-start gap-2">
                <PillButton small onPress={() => choose(20)}>
                  {w.choice[20]}
                </PillButton>
                <PillButton small onPress={() => choose(10)}>
                  {w.choice[10]}
                </PillButton>
                <PillButton small onPress={() => choose('none')}>
                  {w.choice.none}
                </PillButton>
              </div>
            </>
          )}
          <button type="button" onClick={() => actions.openExternal(MKPK_INFO_URL)} className="m-hit text-m12 text-muted-foreground underline underline-offset-2">
            {w.rules}
          </button>
        </div>
      )}

      {seen > 0 && <p className="text-m12 text-muted-foreground">{w.source(formatAgo(seen, data!.now, m))}</p>}
    </Card>
  );
}
