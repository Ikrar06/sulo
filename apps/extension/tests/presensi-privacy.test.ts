// Privacy mode on the dashboard's attendance (P-02): the percentages are
// masked on the Presensi page and in the Studi card's attendance lines, as on
// the phone. The course name in a row stays (it is a course, not a person);
// the lowest course's name in the Studi card is masked, as on the phone.
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dashFor } from '@sulo/core/i18n/dashboard';
import type { RecapRow } from '@sulo/core/presensi/types';
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
