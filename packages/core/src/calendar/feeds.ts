// Public subscription feeds (published to sulo-data by scripts/calendar/publish.ts).
import { FEEDS, type FeedId } from './ics.ts';

export const FEED_BASE = 'https://ikrar06.github.io/sulo-data/calendar/';
export const FEED_IDS: readonly FeedId[] = ['inti-s1', 'wisuda', 'libur-nasional'];

export const feedUrl = (id: FeedId): string => `${FEED_BASE}${FEEDS[id].file}`;
