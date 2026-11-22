// Passive logout detection on SIKOLA pages the user opens. Pure.
//
// A page counts as "logged out" only from its structure: a form with a
// password field and no sesskey anywhere (no sesskey input, no link with
// sesskey=). Element contents, labels and other text are never read, so the
// page language does not matter (CONTRIBUTING.md, "Code conventions").
// - Login page: password field, no sesskey -> logged out.
// - "Already logged in as ..." page: logout button carries a sesskey -> not.
// - Any normal page while logged in: sesskey in the user menu -> not.
// - Change-password page: password fields but also a sesskey -> not.

/** The minimal DOM surface the content script passes in (document in the browser). */
export interface QueryRoot {
  querySelector(selector: string): unknown;
}

export const SELECTORS = {
  passwordField: 'form input[type="password"]',
  sesskeyInput: 'input[name="sesskey"]',
  sesskeyLink: 'a[href*="sesskey="]',
} as const;

export interface PageSignals {
  hasPasswordForm: boolean;
  hasSesskey: boolean;
}

export function readPageSignals(root: QueryRoot): PageSignals {
  const has = (selector: string) => root.querySelector(selector) !== null;
  return {
    hasPasswordForm: has(SELECTORS.passwordField),
    hasSesskey: has(SELECTORS.sesskeyInput) || has(SELECTORS.sesskeyLink),
  };
}

export function isLoggedOutPage(signals: PageSignals): boolean {
  return signals.hasPasswordForm && !signals.hasSesskey;
}
