// Privacy mode on the phone's attendance: beside the percent, everything the
// percent could be worked out from is masked too: the ring and the bar draw
// their track only, and the points ("11/14 poin", a session's "2/2") become
// the mask. The course name, the session count and each session's status stay.
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import type { RecapRow, SessionRow } from '@sulo/core/presensi/types';
import type { CourseRecord } from '@sulo/core/types';
import { I18nProvider } from '@sulo/ui/i18n';
import { ProgressRing } from '@sulo/ui/mobile/ring';
import { PrivacyProvider } from '@sulo/ui/private';
import { CourseCard, CourseHeader, Sessions } from '../src/screens/Presensi';

const course = { id: 401, fullname: 'MEKANIKA FLUIDA B', shortname: 'CE201-Mekanika Fluida B', alias: 'Mekanika Fluida' } as unknown as CourseRecord;
const row: RecapRow = { courseId: 401, cmid: 9001, taken: 7, points: { got: 11, max: 14 }, percent: 78.6 };
const session = { at: 1788238800, dateText: 'Sel 1 Sep 2026', timeText: '1PM - 2:40PM', description: 'Pertemuan 1', status: 'present', statusText: 'Present', points: { got: 2, max: 2 }, remarks: '' } as unknown as SessionRow;
const MASK = '•••';

const html = (node: ReactNode, privacy: boolean) => renderToStaticMarkup(createElement(I18nProvider, { locale: 'id', children: createElement(PrivacyProvider, { value: privacy, children: node }) }));
const text = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
/** The bar's and the ring's fill: an inline width, or the ring's dash. */
const FILL = /style="width:\s*78\.6%"|stroke-dasharray/;

describe('privacy mode masks everything the attendance percent follows from (phone)', () => {
  const d = mobileDash('id');
  const w = mobileWords('id');

  it('a course card: bar filled and points shown without privacy mode; track only and masked points with it', () => {
    const node = createElement(CourseCard, { course, color: 1, row, fetched: true, d, w, locale: 'id', onOpen: () => undefined });
    const open = html(node, false);
    expect(text(open)).toContain('78,6%');
    expect(text(open)).toContain('11/14');
    expect(open).toMatch(FILL);
    const masked = html(node, true);
    expect(text(masked)).not.toMatch(/78[.,]6|11\/14|11 dari 14/);
    expect(masked).not.toMatch(FILL);
    expect(text(masked)).toContain('7 sesi');
    expect(text(masked)).toContain(MASK);
    expect(text(masked)).toContain('Mekanika Fluida');
  });

  it("a course's header: the ring draws its track only and its label drops the percent", () => {
    const node = createElement(CourseHeader, { course, color: 1, row, d, locale: 'id', when: '' });
    const open = html(node, false);
    expect(open).toMatch(FILL);
    expect(open).toContain('aria-label="Mekanika Fluida 78,6%"');
    expect(text(open)).toContain('11 dari 14 poin');
    const masked = html(node, true);
    expect(masked).not.toMatch(FILL);
    expect(masked).toContain('aria-label="Mekanika Fluida"');
    expect(masked).not.toMatch(/78[.,]6|11 dari 14/);
    expect(text(masked)).toContain('7 sesi tercatat');
  });

  it("a session's points are masked, its status stays", () => {
    const node = createElement(Sessions, { sessions: [session], loading: false, d, locale: 'id' });
    expect(text(html(node, false))).toContain('2/2');
    const masked = text(html(node, true));
    expect(masked).not.toContain('2/2');
    expect(masked).toContain(MASK);
    expect(masked).toContain(d.presensi.status.present);
  });

  it('the ring itself: masked, no value arc at all (not even a dot at zero)', () => {
    expect(renderToStaticMarkup(createElement(ProgressRing, { value: 90, label: 'x' }))).toContain('stroke-dasharray');
    expect(renderToStaticMarkup(createElement(ProgressRing, { value: 90, label: 'x', masked: true }))).not.toContain('stroke-dasharray');
  });
});
