import { useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronDownIcon } from '@sulo/ui/icons';
import { Private, usePrivacy } from '@sulo/ui/private';
import { Button } from '@sulo/ui/ui/button';
import { Checkbox } from '@sulo/ui/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@sulo/ui/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@sulo/ui/ui/select';
import { formatAgo } from '@sulo/core/format/time';
import { GRADE_LETTERS } from '@sulo/core/grades/scale';
import { bySemester, computeIpk, differsFromNeosia, improvable, passedSks, readSemesters, readTranscript, semesterLabeler, simulateIpk, transcriptDiagnostics, type TranscriptRow } from '@sulo/core/grades/transcript';
import { neosiaWords } from '@sulo/core/i18n/neosia';
import { NEOSIA_KHS } from '@sulo/core/links';
import { sourceDone } from '@sulo/core/neosia/sources';
import { formatDateKey } from '@sulo/core/calendar/countdown';
import { isOlderThan } from '@sulo/core/neosia/sources';
import { NeosiaChecklist } from '../NeosiaChecklist';
import { neosiaStatus, profile } from '@sulo/core/neosia/view';
import { GpaChart } from '../GpaChart';
import { yAxisRange } from '@sulo/core/grades/axis';
import { XIcon } from '@sulo/ui/dashboard-icons';
import { Card } from '@sulo/ui/card';
import type { PageProps } from '../types';

// Nilai (M7.1, NEOSIA module on only). Grades and GPA are hidden until
// "Tampilkan nilai" (not remembered: leaving the page hides them again);
// privacy mode still masks them. The official GPA is NEOSIA's; Sulo's own
// count and the simulation are estimates with letter weights still to be
// verified (lib/grades/scale.ts). No notification, export, copy, calendar
// file or bug report ever carries anything from this page.

const HIDDEN = '••••';

/** "GANJIL" or "ganjil" → "Ganjil". */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const LOW = new Set(['D', 'E']);

export function NilaiPage({ data, actions }: PageProps) {
  const { m, locale } = useI18n();
  const w = neosiaWords(locale);
  const n = w.nilai;
  const masked = usePrivacy();
  // One remembered choice for every grade (prefs.gradesShown, hidden by default), shared with the Studi card.
  const shown = data.prefs.gradesShown;
  const setShown = (gradesShown: boolean) => void actions.setPrefs({ gradesShown });
  const snapshots = data.neosia.snapshots;
  const rows = useMemo(() => readTranscript(snapshots.getTranskripMahasiswa?.data), [snapshots]);
  const semesters = useMemo(() => readSemesters(snapshots['mahasiswa/semester']?.data), [snapshots]);
  const p = profile(snapshots);
  const status = neosiaStatus(snapshots);
  const transcriptAt = snapshots.getTranskripMahasiswa?.seenAt ?? null;

  // KHS page data missing (the transcript, or the semester list that names its
  // semesters): the page is the checklist, with the KHS first in line.
  if (rows.length === 0 || !sourceDone(snapshots, 'khs')) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <RefreshButton label={w.refresh.grades} actions={actions} />
        </div>
        <NeosiaChecklist snapshots={snapshots} now={data.now} highlight="khs" />
      </div>
    );
  }

  const official = p?.ipk ?? null;
  const computed = computeIpk(rows);
  const mismatch = differsFromNeosia(computed, official);
  const passed = p?.sksPassed ?? passedSks(rows);
  const groups = bySemester(rows);
  const labeler = semesterLabeler(rows, semesters);
  /** "Ganjil 2025/2026", or "Semester 3" by order when NEOSIA gave no name. */
  const label = (id: string) => {
    const l = labeler(id);
    return l.jenis && l.tahunAjaran ? `${capitalize(l.jenis)} ${l.tahunAjaran}` : n.semesterOrdinal(l.index);
  };
  /** "Ganjil 23/24" on the chart's axis, else "Sem. 3". */
  const shortLabel = (id: string) => {
    const l = labeler(id);
    const years = l.tahunAjaran?.match(/^\d{2}(\d{2})\/\d{2}(\d{2})$/);
    return l.jenis && years ? `${capitalize(l.jenis)} ${years[1]}/${years[2]}` : n.semesterShort(l.index);
  };
  const points = [...groups]
    .reverse()
    .filter((g) => g.ips !== null && g.semester !== '-')
    .map((g) => ({ label: shortLabel(g.semester), ips: g.ips!, sks: g.sks, text: n.chartPoint(label(g.semester), g.ips!.toFixed(2), g.sks) }));
  const axisMin = yAxisRange(points.map((pt) => pt.ips)).min;
  const reveal = shown && !masked;
  const fmt = (v: number | null) => (v === null ? '-' : v.toFixed(2));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-muted-foreground">{status.lastSeenAt !== null ? n.source(formatAgo(status.lastSeenAt, data.now, m)) : ''}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" aria-pressed={shown} onClick={() => setShown(!shown)}>
            {shown ? n.hide : n.show}
          </Button>
          <RefreshButton label={w.refresh.grades} actions={actions} />
        </div>
      </div>
      {/* A transcript older than 30 days: when it is from, and how to update it. */}
      {isOlderThan(transcriptAt, data.now) && transcriptAt !== null && (
        <p className="text-[12px] text-muted-foreground">{w.refresh.stale(formatDateKey(new Date(transcriptAt * 1000).toISOString().slice(0, 10), m.intl, { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
      )}

      <section className="grid gap-4 sm:grid-cols-3" aria-label={n.title}>
        <Stat label={n.ipk} value={shown ? <Private>{fmt(official ?? computed)}</Private> : HIDDEN} />
        <Stat label={n.sksPassed} value={<Private>{n.ofTarget(passed, data.prefs.sksTarget)}</Private>} />
        <Stat label={n.sisa} value={p?.masaStudi?.sisa != null ? n.semesters(p.masaStudi.sisa) : '-'} />
      </section>
      {mismatch && <p className="text-[12px] text-muted-foreground">{n.mismatch}</p>}
      {/* Development builds only: both numbers, to check the count against NEOSIA. */}
      {import.meta.env.MODE === 'development' && (
        <p className="text-[12px] text-muted-foreground tabular-nums">
          GPA check (dev build only): Sulo {fmt(computed)} / NEOSIA {fmt(official)}
        </p>
      )}

      <Card title={n.chartTitle}>
        {points.length === 0 ? (
          // No point: no empty axes, one sentence and the page that fills it.
          <div className="flex flex-wrap items-center gap-3 py-4">
            <p className="text-[14px] text-muted-foreground">{w.refresh.chartEmpty}</p>
            <Button variant="outline" size="sm" asChild>
              <a href={NEOSIA_KHS} target="_blank" rel="noopener noreferrer">
                {w.refresh.openKhs}
              </a>
            </Button>
          </div>
        ) : (
          // Hidden grades or privacy mode: the line stays, numbers go.
          <GpaChart title={n.chartTitle} points={points} hideValues={!reveal} />
        )}
        {/* One line: an estimate, and where the axis starts when not at 0. */}
        {points.length > 0 && (
          <p className="mt-2 text-[12px] text-muted-foreground">{n.chartNote(axisMin > 0 ? axisMin.toFixed(2) : null)}</p>
        )}
      </Card>

      <div className="space-y-2">
        {groups.map((g, i) => (
          <Semester key={g.semester} title={g.semester === '-' ? n.semesterUnknown : label(g.semester)} summary={n.semesterSummary(g.sks, reveal && g.ips !== null ? g.ips.toFixed(2) : HIDDEN)} rows={g.rows} reveal={shown} open={i === 0} />
        ))}
      </div>

      {/* Without a transcript there is nothing to list or simulate. */}
      {rows.length > 0 && <Improvable rows={rows} reveal={shown} />}
      {rows.length > 0 && <Simulation rows={rows} reveal={reveal} now={computed} />}
      {import.meta.env.MODE === 'development' && <DevTranscript rows={rows} semesters={semesters} />}
    </div>
  );
}

/** Development builds only: how the stored transcript reads. Counts, never grades. */
function DevTranscript({ rows, semesters }: { rows: readonly TranscriptRow[]; semesters: ReturnType<typeof readSemesters> }) {
  const d = transcriptDiagnostics(rows, semesters);
  return (
    <p className="text-[12px] text-muted-foreground tabular-nums">
      Transcript check (dev build only): {d.stored} rows stored, {d.counted} counted, {d.mapped} mapped to a semester ({semesters.length} semesters stored). Not counted because: not used {d.notUsed}, letter off the scale {d.noLetter}, no credits {d.noCredits}, no semester {d.noSemester}.
    </p>
  );
}

/** "Perbarui dari NEOSIA": opens the NEOSIA KHS page in a new tab on the user's click. */
/** "Perbarui dari NEOSIA": the KHS page in a new tab, which closes by itself once its data came in. */
function RefreshButton({ label, actions }: { label: string; actions: PageProps['actions'] }) {
  return (
    <Button variant="outline" onClick={() => void actions.send({ type: 'neosia/refresh', page: 'khs' })}>
      {label}
    </Button>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[24px] leading-8 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Letter({ letter, reveal }: { letter: string | null; reveal: boolean }) {
  if (!reveal) return <span className="text-muted-foreground">{HIDDEN}</span>;
  const low = letter !== null && LOW.has(letter.toUpperCase());
  return (
    <Private>
      {/* Neutral chip; D and E in the warning color (text and edge only). */}
      <span className={`inline-flex min-w-8 justify-center rounded-md border px-2 text-[12px] leading-5 font-semibold ${low ? 'border-urgency-soon text-urgency-soon' : 'border-border text-foreground'}`}>{letter ?? '-'}</span>
    </Private>
  );
}

function Semester({ title, summary, rows, reveal, open }: { title: string; summary: string; rows: readonly TranscriptRow[]; reveal: boolean; open: boolean }) {
  const { locale } = useI18n();
  const n = neosiaWords(locale).nilai;
  return (
    <Collapsible defaultOpen={open} className="rounded-xl border border-border bg-surface">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left outline-none focus-ring:ring-2 focus-ring:ring-focus">
        <span className="text-[16px] leading-6 font-semibold">{title}</span>
        <span className="flex items-center gap-3 text-[12px] text-muted-foreground tabular-nums">
          {summary}
          <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-5 pb-4">
        <table className="w-full text-left text-[14px]">
          <thead className="text-[12px] text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-normal">{n.code}</th>
              <th className="py-1 pr-3 font-normal">{n.course}</th>
              <th className="py-1 pr-3 text-right font-normal">{n.sks}</th>
              <th className="py-1 text-right font-normal">{n.grade}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={`border-t border-border ${r.used ? '' : 'opacity-50'}`} title={r.used ? undefined : n.notCounted}>
                <td className="py-2 pr-3 font-mono text-[12px] text-muted-foreground">{r.code}</td>
                <td className="py-2 pr-3">
                  {r.name}
                  {r.transfer && <span className="ml-2 rounded border border-border px-1 text-[12px] text-muted-foreground">{n.transfer}</span>}
                  {r.manual && <span className="ml-2 rounded border border-border px-1 text-[12px] text-muted-foreground">{n.manual}</span>}
                  {!r.used && <span className="sr-only">, {n.notCounted}</span>}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.sks}</td>
                <td className="py-2 text-right">
                  <Letter letter={r.letter} reveal={reveal} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** "Bisa diperbaiki": a plain list from the transcript, never a recommendation. */
function Improvable({ rows, reveal }: { rows: readonly TranscriptRow[]; reveal: boolean }) {
  const { locale } = useI18n();
  const n = neosiaWords(locale).nilai;
  const [withC, setWithC] = useState(false);
  const list = improvable(rows, withC);
  return (
    <Card title={n.improvable}>
      <p className="max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{n.improvableNote}</p>
      <label className="mt-3 flex items-center gap-2 text-[14px]">
        <Checkbox checked={withC} onCheckedChange={(v) => setWithC(v === true)} />
        {n.includeC}
      </label>
      {!reveal ? (
        <p className="mt-3 text-[14px] text-muted-foreground">{HIDDEN}</p>
      ) : list.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted-foreground">{withC ? n.improvableNoneC : n.improvableNone}</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {list.map((r) => (
            <li key={r.key} className="flex items-center gap-3 text-[14px]">
              <span className="min-w-0 flex-1">{r.name}</span>
              <span className="text-[12px] text-muted-foreground tabular-nums">
                {r.sks} {n.sks}
              </span>
              <Letter letter={r.letter} reveal />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Pick courses, change their letters, see the estimated GPA. Nothing is saved. */
function Simulation({ rows, reveal, now }: { rows: readonly TranscriptRow[]; reveal: boolean; now: number | null }) {
  const { locale } = useI18n();
  const n = neosiaWords(locale).nilai;
  const [changes, setChanges] = useState<Record<string, string>>({});
  const counted = rows.filter((r) => r.used);
  const chosen = counted.filter((r) => r.key in changes);
  const available = counted.filter((r) => !(r.key in changes));
  const result = simulateIpk(rows, changes);
  return (
    <Collapsible className="rounded-xl border border-border bg-surface">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left outline-none focus-ring:ring-2 focus-ring:ring-focus">
        <span className="text-[16px] leading-6 font-semibold">
          {n.sim} <span className="text-[12px] font-normal text-muted-foreground">({n.estimate})</span>
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-5 pb-5">
        <p className="text-[12px] text-muted-foreground">{n.simNote}</p>
        {!reveal ? (
          <p className="text-[14px] text-muted-foreground">{HIDDEN}</p>
        ) : (
          <>
            <Select value="" onValueChange={(key) => setChanges({ ...changes, [key]: rows.find((r) => r.key === key)?.letter ?? 'A' })}>
              <SelectTrigger aria-label={n.simAdd} className="w-full sm:w-96">
                <SelectValue placeholder={n.simAdd} />
              </SelectTrigger>
              <SelectContent>
                {available.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.name} ({r.letter ?? '-'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {chosen.length === 0 ? (
              <p className="text-[14px] text-muted-foreground">{n.simEmpty}</p>
            ) : (
              <ul className="space-y-2">
                {chosen.map((r) => (
                  <li key={r.key} className="flex flex-wrap items-center gap-3 text-[14px]">
                    <span className="min-w-0 flex-1">
                      {r.name} <span className="text-muted-foreground">({r.letter ?? '-'})</span>
                    </span>
                    <Select value={changes[r.key]} onValueChange={(v) => setChanges({ ...changes, [r.key]: v })}>
                      <SelectTrigger aria-label={`${n.grade}: ${r.name}`} className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADE_LETTERS.map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={n.simRemove(r.name)}
                      onClick={() => setChanges(Object.fromEntries(Object.entries(changes).filter(([k]) => k !== r.key)))}
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <dl className="grid gap-x-6 gap-y-1 text-[14px] tabular-nums sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">{n.simNow}</dt>
              <dd>
                <Private>{now === null ? '-' : now.toFixed(2)}</Private>
              </dd>
              <dt className="text-muted-foreground">{n.simIpk}</dt>
              <dd className="font-semibold">
                <Private>{result === null ? '-' : result.toFixed(2)}</Private>
              </dd>
            </dl>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
