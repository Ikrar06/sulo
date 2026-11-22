// Privacy mode on the dashboard's attendance (P-02): the percentages are
// masked on the Presensi page and in the Studi card's attendance lines, as on
// the phone, and so is what a percent follows from: the bar's fill and the points. The course name in a row stays (it is a course, not a person);
// the lowest course's name in the Studi card is masked, as on the phone.
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dashFor } from '@sulo/core/i18n/dashboard';
import type { RecapRow, SessionRow } from '@sulo/core/presensi/types';
import type { CourseRecord } from '@sulo/core/types';
import { StudiCard } from '@sulo/ui/dashboard/NeosiaParts';
import { CourseRow, Detail } from '@sulo/ui/dashboard/PresensiParts';
import { I18nProvider } from '@sulo/ui/i18n';
import { PrivacyProvider } from '@sulo/ui/private';

const course = { id: 401, fullname: 'MEKANIKA FLUIDA B', shortname: 'CE201-Mekanika Fluida B', alias: 'Mekanika Fluida' } as unknown as CourseRecord;
const row: RecapRow = { courseId: 401, cmid: 9001, taken: 7, points: { got: 11, max: 14 }, percent: 78.6 };
const MASK = '•••';

function text(node: ReactNode, privacy: boolean, locale: 'id' | 'en' = 'id'): string {
  const html = renderToStaticMarkup(createElement(I18nProvider, { locale, children: createElement(PrivacyProvider, { value: privacy, children: node }) }));
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

describe('privacy mode masks attendance percentages on the dashboard', () => {
  const w = dashFor('id').presensi;

  it('a course row: the percent shows without privacy mode and is masked with it', () => {
    const node = createElement(CourseRow, { course, color: 1, row, fetched: true, w, locale: 'id' });
    expect(text(node, false)).toContain('78,6%');
    const masked = text(node, true);
    expect(masked).not.toContain('78,6');
    expect(masked).toContain(MASK);
    expect(masked).toContain('Mekanika Fluida');
  });

  it("a course's detail: the percent in the card's corner is masked", () => {
    const node = createElement(Detail, { course, color: 1, row, sessions: [], loading: false, w, locale: 'id' });
    expect(text(node, false)).toContain('78,6%');
    const masked = text(node, true);
    expect(masked).not.toContain('78,6');
    expect(masked).toContain(MASK);
  });

  it('a course row: the bar draws its track only and the points are masked; the session count stays', () => {
    const node = createElement(CourseRow, { course, color: 1, row, fetched: true, w, locale: 'id' });
    const markup = (privacy: boolean) => renderToStaticMarkup(createElement(I18nProvider, { locale: 'id', children: createElement(PrivacyProvider, { value: privacy, children: node }) }));
    expect(markup(false)).toMatch(/style="width:\s*78\.6%"/);
    expect(text(node, false)).toContain('11 dari 14 poin');
    expect(markup(true)).not.toMatch(/style="width/);
    const masked = text(node, true);
    expect(masked).not.toMatch(/11 dari 14|78[.,]6/);
    expect(masked).toContain('7 sesi tercatat');
  });

  it("a course's detail: the points under the title and each session's points are masked, the status stays", () => {
    const session = { at: 1788238800, dateText: 'Sel 1 Sep 2026', timeText: '1PM - 2:40PM', description: 'Pertemuan 1', status: 'present', statusText: 'Present', points: { got: 2, max: 2 }, remarks: '' } as unknown as SessionRow;
    const node = createElement(Detail, { course, color: 1, row, sessions: [session], loading: false, w, locale: 'id' });
    const open = text(node, false);
    expect(open).toContain('11 dari 14 poin');
    expect(open).toContain('2/2');
    const masked = text(node, true);
    expect(masked).not.toMatch(/11 dari 14|2\/2/);
    expect(masked).toContain('7 sesi tercatat');
    expect(masked).toContain(w.status.present);
  });

  it('the Studi card: the average, the lowest percent and the lowest course are masked, the sentence stays', () => {
    const attendance = { average: 90, lowest: { name: 'Mekanika Fluida', percent: 78.6 } };
    for (const locale of ['id', 'en'] as const) {
      const node = createElement(StudiCard, { snapshots: {}, sksTarget: 144, neosiaOn: false, attendance });
      const open = text(node, false, locale);
      expect(open).toContain(locale === 'id' ? 'Presensi rata-rata 90%' : 'Average attendance 90%');
      expect(open).toContain(locale === 'id' ? '78,6%' : '78.6%');
      expect(open).toContain('Mekanika Fluida');
      const masked = text(node, true, locale);
      expect(masked).toContain(locale === 'id' ? 'Presensi rata-rata' : 'Average attendance');
      expect(masked).not.toMatch(/90|78[.,]6/);
      expect(masked).not.toContain('Mekanika Fluida');
      expect(masked).toContain(MASK);
    }
  });
});
