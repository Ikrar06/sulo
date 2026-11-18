import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isLoggedOutPage, readPageSignals, SELECTORS, type QueryRoot } from '@sulo/core/sikola/page-signals';

// Vitest runs without a DOM. This root answers exactly the three selectors
// the content script uses, from the tag structure of a sanitized fixture,
// never from text. Any other selector fails the test, so the two stay in sync.
function htmlRoot(html: string): QueryRoot {
  const forms = html.match(/<form\b[\s\S]*?<\/form>/gi) ?? [];
  const answers: Record<string, boolean> = {
    [SELECTORS.passwordField]: forms.some((f) => /<input\b[^>]*\btype=["']?password["'\s>]/i.test(f)),
    [SELECTORS.sesskeyInput]: /<input\b[^>]*\bname=["']sesskey["']/i.test(html),
    [SELECTORS.sesskeyLink]: /<a\b[^>]*\bhref=["'][^"']*sesskey=/i.test(html),
  };
  return {
    querySelector: (selector: string) => {
      if (!(selector in answers)) throw new Error(`unexpected selector ${selector}`);
      return answers[selector] ? {} : null;
    },
  };
}

const page = (name: string) => htmlRoot(readFileSync(new URL(`../fixtures/synthetic/pages/${name}.html`, import.meta.url), 'utf8'));

describe('passive logout detection (structure only)', () => {
  it('the login page (password form, no sesskey) is logged out', () => {
    expect(readPageSignals(page('login'))).toEqual({ hasPasswordForm: true, hasSesskey: false });
    expect(isLoggedOutPage(readPageSignals(page('login')))).toBe(true);
  });

  it('the "already logged in as" page is not (its logout button carries a sesskey)', () => {
    expect(isLoggedOutPage(readPageSignals(page('already-logged-in')))).toBe(false);
  });

  it('a normal course page is not', () => {
    expect(readPageSignals(page('course'))).toEqual({ hasPasswordForm: false, hasSesskey: true });
    expect(isLoggedOutPage(readPageSignals(page('course')))).toBe(false);
  });

  it('the change-password page is not (password fields, but a sesskey too)', () => {
    expect(isLoggedOutPage(readPageSignals(page('change-password')))).toBe(false);
  });

  it('a page with neither is never called logged out (no guessing)', () => {
    expect(isLoggedOutPage({ hasPasswordForm: false, hasSesskey: false })).toBe(false);
  });

  it('the decision does not depend on the page language', () => {
    const en = readFileSync(new URL('../fixtures/synthetic/pages/login.html', import.meta.url), 'utf8')
      .replace('Masuk', 'Log in')
      .replace('Kata sandi', 'Password');
    expect(isLoggedOutPage(readPageSignals(htmlRoot(en)))).toBe(true);
  });
});
