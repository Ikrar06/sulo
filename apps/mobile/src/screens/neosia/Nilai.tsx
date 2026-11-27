// Nilai (M8d B4). Hidden by default: grades are read from the encrypted
// store only while this screen shows them (useGrades) and released when it
// closes; privacy mode masks them. The semester GPA chart has core's
// adaptive axis; Sulo's own count and the simulation are labelled as
// estimates (the official GPA is NEOSIA's); "Bisa diperbaiki" lists, it
// never recommends. Never in a notification, an export or a bug report.

import { useId, useMemo, useState } from 'react';
import { formatAgo } from '@sulo/core/format/time';
import { yAxisRange } from '@sulo/core/grades/axis';
import { GRADE_LETTERS } from '@sulo/core/grades/scale';
import { bySemester, computeIpk, improvable, passedSks, readSemesters, readTranscript, semesterLabeler, simulateIpk, type TranscriptRow } from '@sulo/core/grades/transcript';
import { neosiaWords } from '@sulo/core/i18n/neosia';
import { dataOf, DEFAULT_SKS_TARGET, profile } from '@sulo/core/neosia/view';
import type { Projected } from '@sulo/core/neosia/project';
import { Card, EmptyCard, SectionHead, StatCard } from '@sulo/ui/mobile/cards';
import { PillButton, Toggle } from '@sulo/ui/mobile/controls';
import { ChevronDownIcon } from '@sulo/ui/icons';
import { Sheet, SheetOptions } from '@sulo/ui/mobile/sheet';
import { SuloMascot } from '@sulo/ui/mascot/SuloMascot';
import { Private, usePrivacy } from '@sulo/ui/private';
import { useI18n } from '@sulo/ui/i18n';
import { useMobileData } from '../../shell/data';
import type { Screen } from '../../shell/nav';
import { useGrades, useNeosia } from '../../neosia/NeosiaProvider';
import { useSecureScreen } from '../../neosia/secure-screen';

const MASK = '•••';
const two = (x: number | null) => (x === null ? '–' : x.toFixed(2));

/** IPS per semester, oldest left: a line on core's adaptive axis, with the values also as text for screen readers. */
function IpsChart({ points, label }: { points: { label: string; ips: number }[]; label: string }) {
  const axis = yAxisRange(points.map((p) => p.ips));
  const W = 320;
  const H = 156;
  const LEFT = 44;
  const PLOT = H - 34;
  // The last label is right-aligned on its point, so it never runs past the edge.
  const x = (i: number) => (points.length === 1 ? (LEFT + W) / 2 : LEFT + (i * (W - LEFT - 14)) / (points.length - 1));
  const y = (v: number) => 8 + PLOT * (1 - (v - axis.min) / (axis.max - axis.min));
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        {axis.ticks.map((t) => (
          <g key={t}>
            <line x1={LEFT - 8} x2={W - 4} y1={y(t)} y2={y(t)} stroke="var(--m-line)" strokeWidth="1" />
            <text x="0" y={y(t) + 4} fontSize="10" fill="currentColor" opacity="0.6">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        <polyline points={points.map((p, i) => `${x(i)},${y(p.ips)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.ips)} r="3.5" fill="currentColor" />
            <text x={x(i)} y={H - 4} fontSize="10" textAnchor={points.length > 1 && i === points.length - 1 ? 'end' : 'middle'} fill="currentColor" opacity="0.6">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="sr-only">{points.map((p) => `${p.label} ${two(p.ips)}`).join(', ')}</figcaption>
    </figure>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * One semester's courses (the dashboard's Nilai has the same list): its order and name, credits and IPS, and
 * each course with its code, credits and letter. Opens in place like Bantuan's answers; a row that does not
 * count toward the GPA is dimmed and says so to screen readers.
 */
function SemesterCard({ title, sub, summary, rows, open, onToggle }: { title: string; sub: string | null; summary: string; rows: readonly TranscriptRow[]; open: boolean; onToggle: () => void }) {
  const { locale } = useI18n();
  const t = neosiaWords(locale).nilai;
  const panel = useId();
  return (
    <section className="m-card rounded-card">
      <button type="button" aria-expanded={open} aria-controls={panel} onClick={onToggle} className="flex w-full items-center gap-3 rounded-card p-4 text-left outline-none focus-ring:ring-2 focus-ring:ring-focus">
        <span className="min-w-0 flex-1">
          <span className="block text-m15 font-semibold">{title}</span>
          {sub && <span className="block text-m12 text-muted-foreground">{sub}</span>}
        </span>
        <span className="shrink-0 text-m12 text-muted-foreground tabular-nums">
          <Private>{summary}</Private>
        </span>
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-m-inset">
          <ChevronDownIcon className={`size-4 transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {/* The list eases open by animating the grid row from 0fr to 1fr. */}
      <div id={panel} role="region" aria-label={title} aria-hidden={!open} className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <ul className="px-4 pb-3" inert={!open}>
            {rows.map((r) => (
              <li key={r.key} className={`flex items-center gap-3 py-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line ${r.used ? '' : 'opacity-60'}`}>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-m13">
                    <Private>{r.name}</Private>
                  </span>
                  <span className="block text-m12 text-muted-foreground tabular-nums">
                    {[r.code, `${r.sks} ${t.sks}`, r.transfer ? t.transfer : null, r.manual ? t.manual : null].filter(Boolean).join(' · ')}
                    {!r.used && <span className="sr-only">, {t.notCounted}</span>}
                  </span>
                </span>
                <span className="flex h-8 min-w-11 shrink-0 items-center justify-center rounded-lg bg-m-inset px-2 text-m13 font-semibold tabular-nums">
                  <Private>{r.letter ?? '–'}</Private>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function NilaiScreen({ go }: { go: (s: Screen) => void }) {
  const { locale, m } = useI18n();
  const n = neosiaWords(locale);
  const t = n.nilai;
  const neo = useNeosia();
  const { data } = useMobileData();
  const hide = usePrivacy();
  const prefs = data!.prefs;
  const shown = prefs.gradesShown;
  const grades = useGrades(neo.enabled && shown);
  // The Nilai screen is always out of screenshots, recordings and the recent-apps preview while open.
  useSecureScreen(true);
  const [includeC, setIncludeC] = useState(false);
  const [sim, setSim] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState<TranscriptRow | null>(null);
  // The newest semester starts open (undefined); then one open at a time, or none.
  const [openSemester, setOpenSemester] = useState<string | null | undefined>(undefined);

  const rows = useMemo(() => readTranscript(grades ? (dataOf(grades, 'getTranskripMahasiswa') as Projected) : null), [grades]);
  const semesters = useMemo(() => readSemesters(grades ? (dataOf(grades, 'mahasiswa/semester') as Projected) : null), [grades]);

  if (!neo.enabled) return <EmptyCard mascot={<SuloMascot mood="neutral" size={48} />} text={n.invite.text} />;
  if (!shown) {
    return (
      <div className="space-y-3 pt-2">
        <EmptyCard mascot={<SuloMascot mood="neutral" size={48} />} text={n.mobile.hiddenGrades} />
        <PillButton full onPress={() => go({ name: 'pengaturan', detail: 'neosia' })}>
          {n.mobile.openSettings}
        </PillButton>
      </div>
    );
  }
  if (grades === null) return null;
  if (rows.length === 0) {
    return (
      <div className="space-y-3 pt-2">
        <EmptyCard mascot={<SuloMascot mood="neutral" size={48} />} text={t.empty} />
        <PillButton full onPress={() => void neo.open('khs')}>
          {n.refresh.openKhs}
        </PillButton>
      </div>
    );
  }

  const p = profile(grades);
  const label = semesterLabeler(rows, semesters);
  const groups = bySemester(rows);
  const points = [...groups].reverse().filter((g) => g.ips !== null && g.semester !== '-').map((g) => ({ label: t.semesterShort(label(g.semester).index), ips: g.ips! }));
  const target = prefs.sksTarget || DEFAULT_SKS_TARGET;
  const mine = computeIpk(rows);
  const simulated = Object.keys(sim).length ? simulateIpk(rows, sim) : null;
  const fixable = improvable(rows, includeC);
  const seenAt = grades.getTranskripMahasiswa?.seenAt ?? null;

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        {/* Plain-string cards: masked here in privacy mode, like the Studi card. */}
        <StatCard label={t.ipk} value={hide ? MASK : p?.ipk !== null && p?.ipk !== undefined ? p.ipk.toFixed(2) : '–'} />
        <StatCard label={t.sksPassed} value={hide ? MASK : t.ofTarget(passedSks(rows), target)} />
      </div>

      {points.length > 0 && (
        <Card inner="space-y-2">
          <p className="text-m15 font-semibold">{t.chartTitle}</p>
          <Private>
            <IpsChart points={points} label={t.chartTitle} />
          </Private>
          <p className="text-m12 text-muted-foreground">{t.chartNote(yAxisRange(points.map((x) => x.ips)).min > 0 ? yAxisRange(points.map((x) => x.ips)).min.toFixed(2) : null)}</p>
        </Card>
      )}

      <section aria-labelledby="semester-title" className="space-y-2">
        <SectionHead id="semester-title" title={t.perSemester} />
        {groups.map((g) => {
          const l = label(g.semester);
          const open = (openSemester === undefined ? groups[0]?.semester : openSemester) === g.semester;
          return (
            <SemesterCard
              key={g.semester}
              title={g.semester === '-' ? t.semesterUnknown : t.semesterOrdinal(l.index)}
              sub={g.semester !== '-' && l.jenis && l.tahunAjaran ? `${capitalize(l.jenis)} ${l.tahunAjaran}` : null}
              summary={t.semesterSummary(g.sks, hide || g.ips === null ? MASK : g.ips.toFixed(2))}
              rows={g.rows}
              open={open}
              onToggle={() => setOpenSemester(open ? null : g.semester)}
            />
          );
        })}
      </section>

      <section aria-labelledby="sim-title">
        <SectionHead id="sim-title" title={t.sim} />
        <Card inner="space-y-3">
          <p className="text-m12 text-muted-foreground">{t.simNote}</p>
          <p className="text-m13">
            {t.simNow}: <Private>{two(mine)}</Private> ({t.estimate})
          </p>
          {simulated !== null && (
            <p className="text-m15 font-semibold">
              {t.simIpk}: <Private>{two(simulated)}</Private> ({t.estimate})
            </p>
          )}
          <ul className="space-y-1">
            {rows
              .filter((r) => r.used && r.letter !== null)
              .slice(0, 40)
              .map((r) => (
                <li key={r.key}>
                  <button type="button" onClick={() => setPicking(r)} className="m-press -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-1 text-left outline-none focus-ring:ring-2 focus-ring:ring-focus">
                    <span className="min-w-0 flex-1 truncate text-m13">
                      <Private>{r.name}</Private>
                    </span>
                    {/* The letter as a small pill: tapping it opens the letters. */}
                    <span className="flex h-8 min-w-11 shrink-0 items-center justify-center rounded-lg bg-m-inset px-2 text-m13 font-semibold tabular-nums">
                      <Private>{sim[r.key] ? `${r.letter} → ${sim[r.key]}` : r.letter}</Private>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
          {Object.keys(sim).length > 0 && (
            <PillButton small onPress={() => setSim({})}>
              {n.mobile.reset}
            </PillButton>
          )}
        </Card>
      </section>

      <section aria-labelledby="fix-title">
        <SectionHead id="fix-title" title={t.improvable} />
        <Card inner="space-y-3">
          <p className="text-m12 text-muted-foreground">{t.improvableNote}</p>
          <label className="flex items-center justify-between gap-3 text-m13">
            {t.includeC}
            <Toggle checked={includeC} onChange={setIncludeC} label={t.includeC} />
          </label>
          {fixable.length === 0 ? (
            <p className="text-m13 text-muted-foreground">{includeC ? t.improvableNoneC : t.improvableNone}</p>
          ) : (
            <ul className="space-y-2">
              {fixable.map((r) => (
                <li key={r.key} className="flex items-center gap-3 text-m13">
                  <span className="min-w-0 flex-1 truncate">
                    <Private>{r.name}</Private>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <Private>
                      {r.letter} · {r.sks} {t.sks}
                    </Private>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <p className="text-m12 text-muted-foreground">{seenAt !== null ? t.source(formatAgo(seenAt, data!.now, m)) : null}</p>
      <PillButton full onPress={() => void neo.refreshFrom('khs')}>
        {n.refresh.grades}
      </PillButton>

      <Sheet open={picking !== null} onOpenChange={(o) => !o && setPicking(null)} title={hide ? t.sim : (picking?.name ?? '')}>
        {picking && (
          <SheetOptions
            value={sim[picking.key] ?? picking.letter ?? ''}
            options={GRADE_LETTERS.map((l) => ({ value: l, label: l }))}
            onChoose={(l) => {
              setSim((s) => (l === picking.letter ? Object.fromEntries(Object.entries(s).filter(([k]) => k !== picking.key)) : { ...s, [picking.key]: l }));
              setPicking(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
