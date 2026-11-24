// Pieces of the app's UI around the hero's title: the app's own parts
// (TaskCardView, Card, Chip, ProgressRing from @sulo/ui), filled from the same
// sample data as the screens in the frames, by the same core functions the
// screens use. Decorative: the page says all of it in words too.
import { countdownOf } from '@sulo/core/calendar/countdown';
import { nextImportant } from '@sulo/core/calendar/upcoming';
import { buildTaskItems } from '@sulo/core/dashboard/tasks';
import { formatLeft } from '@sulo/core/format/time';
import { messagesFor } from '@sulo/core/i18n';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { attendanceSummary } from '@sulo/core/presensi/service';
import { urgencyOf } from '@sulo/core/tasks/group';
import type { DashboardData } from '@sulo/core/view/dashboard-data';
import { I18nProvider } from '@sulo/ui/i18n';
import { Card } from '@sulo/ui/mobile/cards';
import { ProgressRing } from '@sulo/ui/mobile/ring';
import { TaskCardView } from '@sulo/ui/mobile/task-card';
import { courseTint } from '@sulo/ui/mobile/tint';
import { URGENCY_TEXT } from '@sulo/ui/urgency';
import { ZONA } from '../layar/contoh';
import type { Bahasa } from '../teks';

export type JenisPotongan = 'tugas-1' | 'tugas-2' | 'tugas-3' | 'presensi' | 'kalender';

const noop = () => undefined;
const persen = (v: number, bahasa: Bahasa) => v.toLocaleString(bahasa === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 });

function Isi({ data, bahasa, jenis }: { data: DashboardData; bahasa: Bahasa; jenis: JenisPotongan }) {
  const m = messagesFor(bahasa);
  const w = mobileWords(bahasa);
  const user = data.user!;
  if (jenis === 'tugas-1' || jenis === 'tugas-2' || jenis === 'tugas-3') {
    // The nearest upcoming tasks: the first, the first from another course, the third.
    const upcoming = buildTaskItems(user)
      .filter((i) => i.status === 'pending' && i.task.dueAt !== null && i.task.dueAt > data.now)
      .sort((a, b) => a.task.dueAt! - b.task.dueAt!);
    const first = upcoming[0]!;
    const item = jenis === 'tugas-1' ? first : jenis === 'tugas-3' ? upcoming[2]! : (upcoming.find((i) => i.task.courseId !== first.task.courseId) ?? upcoming[1]!);
    return (
      <TaskCardView
        course={item.courseName}
        color={courseTint(item.courseColor)}
        title={item.task.name}
        relative={formatLeft(item.task.dueAt!, data.now, ZONA, m)}
        tone={URGENCY_TEXT[urgencyOf(item.task.dueAt, data.now)]}
        done={false}
        doneLabel={item.task.name}
        onDone={noop}
        still
      />
    );
  }
  if (jenis === 'presensi') {
    const att = attendanceSummary(user.presensi?.recap?.rows, user.courses);
    const avg = att?.average ?? 0;
    return (
      <Card inner="flex items-center gap-4">
        <ProgressRing value={avg} size={56} stroke={6} label={`${w.app.attendance} ${persen(avg, bahasa)}%`} />
        <div className="min-w-0">
          <p className="text-m12 text-muted-foreground">{w.app.attendance}</p>
          <p className="text-m22 font-semibold tabular-nums">{persen(avg, bahasa)}%</p>
          <p className="text-m13 text-muted-foreground">{w.app.average}</p>
        </div>
      </Card>
    );
  }
  const next = nextImportant(data.calendar, data.today);
  const c = next ? countdownOf(next.kegiatan, data.today) : null;
  const r = mobileDash(bahasa).ringkasan;
  return (
    <Card inner="flex flex-col">
      <p className="text-m12 text-muted-foreground">{r.calendarTitle}</p>
      <p className="mt-1 text-m15">{next?.kegiatan.judul}</p>
      {c?.kind === 'days' && <p className="text-m13 db-accent-text font-medium tabular-nums">{w.app.daysLeft(c.n)}</p>}
    </Card>
  );
}

export function Potongan(props: { data: DashboardData; bahasa: Bahasa; jenis: JenisPotongan }) {
  return (
    <I18nProvider locale={props.bahasa}>
      <Isi {...props} />
    </I18nProvider>
  );
}
