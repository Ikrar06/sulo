import { describe, expect, it } from 'vitest';
import { isValidSesskey, pickSesskey } from '../lib/sesskey';

const BASE = 'https://sikola-v2.unhas.ac.id';

describe('pickSesskey', () => {
  it('prefers the hidden input value', () => {
    expect(pickSesskey({ inputValues: ['SESSKEY001'], hrefs: [`${BASE}/login/logout.php?sesskey=SESSKEY002`] }, BASE)).toBe(
      'SESSKEY001',
    );
  });

  it('falls back to the logout link', () => {
    expect(pickSesskey({ inputValues: [], hrefs: [`${BASE}/login/logout.php?sesskey=SESSKEY002`] }, BASE)).toBe('SESSKEY002');
  });

  it('resolves relative links against the base url', () => {
    expect(pickSesskey({ inputValues: [], hrefs: ['/login/logout.php?sesskey=SESSKEY002'] }, BASE)).toBe('SESSKEY002');
  });

  it('ignores links to other origins', () => {
    expect(pickSesskey({ inputValues: [], hrefs: ['https://example.test/x?sesskey=SESSKEY002'] }, BASE)).toBeNull();
  });

  it('skips malformed values', () => {
    expect(pickSesskey({ inputValues: ['', 'has space 1'], hrefs: ['not a url ::', `${BASE}/x?sesskey=<script>`] }, BASE)).toBeNull();
  });

  it('returns null on a page without sesskey (e.g. login page)', () => {
    expect(pickSesskey({ inputValues: [], hrefs: [] }, BASE)).toBeNull();
  });
});

describe('isValidSesskey', () => {
  it.each([
    ['SESSKEY001', true],
    ['short', false],
    ['a'.repeat(33), false],
    ['abc-def-123', false],
    [123, false],
    [null, false],
  ])('%s -> %s', (value, expected) => {
    expect(isValidSesskey(value)).toBe(expected);
  });
});
