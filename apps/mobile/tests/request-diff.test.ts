import { describe, expect, it } from 'vitest';
import { requestDiff } from '../src/dev/request-diff';

describe('the request difference with and without the capture script', () => {
  it('the same requests: empty', () => {
    const a = { 'GET api.neosia.unhas.ac.id/api/me': 1, 'POST api.neosia.unhas.ac.id/oauth/token': 1 };
    expect(requestDiff(a, { ...a })).toEqual([]);
  });

  it('anything more, less or new is listed', () => {
    expect(requestDiff({ 'GET a/x': 1 }, { 'GET a/x': 2, 'GET a/y': 1 })).toEqual([
      { key: 'GET a/x', without: 1, with: 2 },
      { key: 'GET a/y', without: 0, with: 1 },
    ]);
  });
});
