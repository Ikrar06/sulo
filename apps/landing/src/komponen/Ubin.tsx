// The live visuals inside the bento tiles: the apps' own parts, filled from
// the same sample data as every screen on the page, by the same core
// functions the apps use. Kabar terbaru (UpdatesPanel), the phone's "7 hari ke
// depan" (WeekCard, weekBars), the academic calendar card (AcademicCard).
// Decorative: each tile says what it shows in words too.
import { weekBars } from '@sulo/core/dashboard/week-bars';
import { buildTaskItems } from '@sulo/core/dashboard/tasks';
import { messagesFor } from '@sulo/core/i18n';
import { dashFor } from '@sulo/core/i18n/dashboard';
import { mobileWords } from '@sulo/core/i18n/mobile';
import type { DashboardData } from '@sulo/core/view/dashboard-data';
import { AcademicCard } from '@sulo/ui/dashboard/OverviewParts';
import { I18nProvider } from '@sulo/ui/i18n';
import { UpdatesPanel } from '@sulo/ui/updates/UpdatesPanel';
import { WeekCard } from '../../../mobile/src/screens/WeekCard';
import { ZONA } from '../layar/contoh';
import type { Bahasa } from '../teks';

export type JenisUbin = 'kabar' | 'beban' | 'kalender';

const noop = () => undefined;

function Isi({ data, bahasa, jenis }: { data: DashboardData; bahasa: Bahasa; jenis: JenisUbin }) {
  if (jenis === 'kabar') {
    return (
      <div className="flex flex-col rounded-xl border border-border bg-surface">
        <UpdatesPanel
          entries={data.view.updates.slice(0, 4)}
          courseNames={data.view.courseNames}
          courseColors={data.view.courseColors}
          now={data.now}
          timeZone={ZONA}
          settings={data.prefs.updates}
          onOpen={noop}
          onMarkAllSeen={noop}
          onChangeSettings={noop}
          embedded
          showSettings={false}
        />
      </div>
    );
  }
  if (jenis === 'beban') {
    const w = mobileWords(bahasa);
    const pending = buildTaskItems(data.user!).filter((i) => i.status === 'pending');
    const bars = weekBars(
      pending.map((i) => i.task),
      data.calendar.kegiatan,
      data.now,
      ZONA,
    );
    return <WeekCard bars={bars} intl={messagesFor(bahasa).intl} words={{ title: w.app.week7, empty: w.app.week7Empty, day: w.app.week7Day }} onOpen={noop} />;
  }
  return <AcademicCard calendar={data.calendar} today={data.today} d={dashFor(bahasa)} />;
}

export function Ubin(props: { data: DashboardData; bahasa: Bahasa; jenis: JenisUbin }) {
  return (
    <I18nProvider locale={props.bahasa}>
      <Isi {...props} />
    </I18nProvider>
  );
}
