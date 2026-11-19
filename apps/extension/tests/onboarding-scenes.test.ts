// The onboarding's scenes are pictures, not forms (Tahap 2): no "Username",
// "Password" or "Sign in" (nor their Indonesian words), no input or button,
// nothing focusable, and the stage is hidden from screen readers. The course
// list is the one interactive scene and is left out.
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Journey } from '@/components/onboarding/journey';
import { SceneConnect } from '@/components/onboarding/journey-connect';
import { SceneDone } from '@/components/onboarding/journey-done';
import { introScene } from '@/components/onboarding/journey-intro';
import { ScenePreparing } from '@/components/onboarding/journey-preparing';
import { I18nProvider } from '@sulo/ui/i18n';

const SIGN_IN = /username|password|sign in|nama pengguna|kata sandi/i;
/** Intro 3's privacy badge (the owner's words) says there is no password; it is not a field label. */
const ALLOWED = /tanpa password|no password/gi;
const CONTROLS = /<(input|button|textarea|select|a)\b|tabindex=|role="(button|checkbox|textbox|link)"|contenteditable/i;

/** The stage's markup, rendered in the journey frame. */
function stage(scene: ReactNode, locale: 'id' | 'en'): { hidden: boolean; html: string; text: string } {
  const page = renderToStaticMarkup(createElement(I18nProvider, { locale }, createElement(Journey, { stepKey: 's', scene, children: null })));
  const start = page.indexOf('<section data-ob-stage');
  const end = page.indexOf('<section class="obj-side"');
  const html = page.slice(start, end);
  return { hidden: /^<section data-ob-stage="" class="obj-stage" aria-hidden="true">/.test(html), html, text: html.replace(/<[^>]+>/g, ' ') };
}

const SCENES: [string, () => ReactNode][] = [
  ['intro 1', () => introScene(0)],
  ['intro 2', () => introScene(1)],
  ['intro 3', () => introScene(2)],
  ['hubungkan', () => createElement(SceneConnect)],
  ['menyiapkan', () => createElement(ScenePreparing, { stages: [{ stage: 'tasks', result: 'ok' }], counts: { tasks: 12, courses: 5 } })],
  ['menyiapkan gagal', () => createElement(ScenePreparing, { stages: [{ stage: 'tasks', result: 'failed' }], counts: { tasks: 0, courses: 0 }, failed: true })],
  ['selesai tanpa tugas', () => createElement(SceneDone, { tasks: [] })],
  ['selesai', () => createElement(SceneDone, { tasks: [{ eventId: 1, name: 'Laporan', courseName: 'Hidrologi', courseColor: 1, url: '', urgency: 'day', dueAt: 0, remaining: '5 jam', left: '5 jam lagi', clock: '', fullDate: '', far: false, snoozedUntil: null, marker: null } as never] })],
];

describe('onboarding scenes are pictures, not forms', () => {
  for (const locale of ['id', 'en'] as const) {
    for (const [name, make] of SCENES) {
      it(`${locale} ${name}`, () => {
        const s = stage(make(), locale);
        expect(s.html.length, 'stage rendered').toBeGreaterThan(40);
        expect(s.hidden, 'aria-hidden').toBe(true);
        expect(s.text.replace(ALLOWED, '')).not.toMatch(SIGN_IN);
        expect(s.html).not.toMatch(CONTROLS);
      });
    }
  }
});
