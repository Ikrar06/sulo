import { describe, expect, it } from 'vitest';
import { feedUrl, FEED_IDS } from '../lib/calendar/feeds';
import { appleUrl, googleSubscribeUrl, outlookSubscribeUrl, toWebcal } from '../lib/calendar/subscribe-links';

const BASE = 'https://ikrar06.github.io/sulo-data/calendar/';
const FILES = { 'inti-s1': 'sulo-inti-s1.ics', wisuda: 'sulo-wisuda.ics', 'libur-nasional': 'sulo-libur-nasional.ics' } as const;

describe('subscription links for the three feeds', () => {
  for (const id of FEED_IDS) {
    const url = `${BASE}${FILES[id]}`;
    const webcal = `webcal://ikrar06.github.io/sulo-data/calendar/${FILES[id]}`;
    it(`${FILES[id]}`, () => {
      expect(feedUrl(id)).toBe(url);
      expect(toWebcal(url)).toBe(webcal);
      expect(googleSubscribeUrl(url)).toBe(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`);
      expect(outlookSubscribeUrl(url, 'Sulo Inti S1')).toBe(
        `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(webcal)}&name=Sulo%20Inti%20S1`,
      );
      expect(appleUrl(url)).toBe(webcal);
    });
  }
  it('only rewrites the scheme at the start', () => {
    expect(toWebcal('https://a.test/https://b')).toBe('webcal://a.test/https://b');
  });
});
