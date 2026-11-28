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
import { AlertIcon, ChevronDownIcon } from '@sulo/ui/icons';
import { sipakamaseWords } from '@sulo/core/i18n/sipakamase';
import { mkpkReminders, reminderText, type MkpkReminder } from '@sulo/core/mkpk/reminders';
import { summarizeSipakamase, type SipakamaseSummary } from '@sulo/core/mkpk/sipakamase-summary';
import { lastReadAt } from '@sulo/core/sipakamase/store';
import { useSipakamase } from '../../sipakamase/SipakamaseProvider';
import { useMobileData } from '../../shell/data';
import { useNeosia } from '../../neosia/NeosiaProvider';
import { useSipakamaseInvite } from '../sipakamase/SipakamaseInvite';

export function MkpkCard() {
  const { locale, m } = useI18n();
  const w = neosiaWords(locale).mkpk;
  const neo = useNeosia();
  const { data, actions } = useMobileData();
  const masked = usePrivacy();
  const [listOpen, setListOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [allReminders, setAllReminders] = useState(false);
  const sip = useSipakamase();
  // Ringkasan's own "Hubungkan Sipakamase" card is up: this card's quiet link waits.
  const invited = useSipakamaseInvite();
  const sw = sipakamaseWords(locale);
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

  const ring = 'outline-none focus-ring:ring-2 focus-ring:ring-focus';

  return (
    <Card className="mb-4">
      <p className="text-m15 font-semibold">{w.title}</p>

      {p.transcriptAt === null ? (
        <p className="mt-2 text-m13 text-muted-foreground">{w.noTranscript}</p>
      ) : (
        // One number carries the card; its unit and scale sit beside it in the quiet voice.
        <div className="mt-3">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-m22 font-semibold tabular-nums">
              <Private>{text(p.passedSks)}</Private>
            </span>
            <span className="text-m13 text-muted-foreground">{scale !== null ? w.passedUnitOf(scale) : w.passedUnit}</span>
          </p>
          {fill !== null && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-m-inset" role="img" aria-label={w.scale(scale!)}>
              {!masked && <div className="m-fill-grow h-full rounded-full bg-foreground" style={{ width: `${fill}%` }} />}
            </div>
          )}
        </div>
      )}

      {/* Label and value rows instead of sentences: read down the right edge. */}
      {(p.enrolledSks > 0 || p.offered.length > 0) && (
        <div className="mt-3">
          {p.enrolledSks > 0 && (
            <div className="flex min-h-11 items-center justify-between gap-3 border-t border-m-line">
              <span className="text-m13 text-muted-foreground">{w.enrolledLabel}</span>
              <span className="text-m15 tabular-nums">
                <Private>{w.sksValue(text(p.enrolledSks))}</Private>
              </span>
            </div>
          )}
          {p.offered.length > 0 && (
            <div className="border-t border-m-line">
              <button
                type="button"
                aria-expanded={listOpen}
                aria-label={`${w.offeredLabel}, ${w.coursesValue(p.offered.length)}. ${listOpen ? w.hideOffered : w.showOffered}`}
                onClick={() => setListOpen(!listOpen)}
                className={`m-press flex min-h-11 w-full items-center justify-between gap-3 rounded-[8px] text-left ${ring}`}
              >
                <span className="text-m13 text-muted-foreground">{w.offeredLabel}</span>
                <span className="flex items-center gap-1 text-m15 tabular-nums">
                  {w.coursesValue(p.offered.length)}
                  <ChevronDownIcon aria-hidden="true" className={`size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${listOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {listOpen && (
                <ul className="space-y-2 pb-1 text-m13">
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

      {sip.enabled ? (
        <SipakamaseRows summary={summarizeSipakamase(sip.data, sip.connection)} reminders={mkpkReminders(sip.data, p)} text={text} all={allReminders} onAll={() => setAllReminders(true)} />
      ) : invited ? null : (
        <p className="mt-3 border-t border-m-line pt-3 text-m13 text-muted-foreground">
          {sw.card.invite}{' '}
          <button type="button" onClick={sip.ask} className={`m-hit rounded text-foreground underline underline-offset-2 ${ring}`}>
            {sw.connect}
          </button>
        </p>
      )}

      {load === null && (
        // The load question, set apart by space alone (no divider, no card in the card).
        <div className="mt-4 space-y-2">
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
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-m13 font-medium">{w.loadAsk}</p>
                <button type="button" onClick={() => actions.openExternal(MKPK_INFO_URL)} className={`m-hit shrink-0 rounded text-m12 text-muted-foreground underline underline-offset-2 ${ring}`}>
                  {w.rulesShort}
                </button>
              </div>
              <div role="group" aria-label={w.loadAsk} className="grid grid-cols-3 gap-1 rounded-full bg-m-inset p-1">
                {([20, 10, 'none'] as const).map((c) => (
                  <button key={c} type="button" onClick={() => choose(c)} aria-label={w.choice[c]} className={`m-hit m-press min-h-9 rounded-full px-1 text-m13 ${ring}`}>
                    {w.loadShort[c]}
                  </button>
                ))}
              </div>
              <p className="text-m12 text-muted-foreground">{w.loadHelp}</p>
            </>
          )}
        </div>
      )}

      {(seen > 0 || (sip.data && lastReadAt(sip.data))) && (
        <p className="mt-3 text-m12 text-muted-foreground">
          {[seen > 0 ? w.source(formatAgo(seen, data!.now, m)) : null, sip.data && lastReadAt(sip.data) ? sw.card.source(formatAgo(lastReadAt(sip.data)!, data!.now, m)) : null].filter(Boolean).join(' ')}
        </p>
      )}
    </Card>
  );
}

const SHOWN_REMINDERS = 2;

/** Sipakamase's rows on the card: credits not in NEOSIA, credits not converted, then the named reminders. */
function SipakamaseRows({ summary, reminders, text, all, onAll }: { summary: SipakamaseSummary; reminders: MkpkReminder[]; text: (sks: number) => string; all: boolean; onAll: () => void }) {
  const { locale } = useI18n();
  const sw = sipakamaseWords(locale);
  // The card's own unit ("SKS", or "credits" in English), as on the rows above these.
  const { sksValue } = neosiaWords(locale).mkpk;
  const named = reminders.filter((r) => r.kind !== 'd');
  const shown = all ? named : named.slice(0, SHOWN_REMINDERS);
  const problem = summary.state === 'needs_login' ? sw.card.needsLogin : summary.state === 'broken' ? sw.card.broken : null;
  const row = (label: string, sks: number) => (
    <div className="flex min-h-11 items-center justify-between gap-3 border-t border-m-line">
      <span className="text-m13 text-muted-foreground">{label}</span>
      <span className="text-m15 tabular-nums">
        <Private>{sksValue(text(sks))}</Private>
      </span>
    </div>
  );
  return (
    <div>
      {summary.notInNeosiaSks !== null && summary.notInNeosiaSks > 0 && row(sw.card.notInNeosiaLabel, summary.notInNeosiaSks)}
      {summary.unconvertedSks !== null && summary.unconvertedSks > 0 && row(sw.card.unconvertedLabel, summary.unconvertedSks)}
      {shown.length > 0 && (
        <ul className="space-y-2 border-t border-m-line pt-3">
          {shown.map((r, i) => (
            <li key={`${r.kind}-${i}`} className="flex items-start gap-2 text-m13">
              <AlertIcon aria-hidden="true" className="mt-px size-4 shrink-0 text-urgency-soon" />
              <span>{reminderText(r, sw, text)}</span>
            </li>
          ))}
          {!all && named.length > SHOWN_REMINDERS && (
            <li>
              <button type="button" onClick={onAll} className="m-hit rounded text-m13 text-muted-foreground underline underline-offset-2 outline-none focus-ring:ring-2 focus-ring:ring-focus">
                {sw.card.more(named.length - SHOWN_REMINDERS)}
              </button>
            </li>
          )}
        </ul>
      )}
      {problem && <p className="mt-2 text-m12 text-muted-foreground">{problem}</p>}
    </div>
  );
}
