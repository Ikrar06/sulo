import type { Clock } from './types';

// System clock using the browser time zone via Intl. Never a hardcoded offset.
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const systemClock: Clock = {
  now: () => Math.floor(Date.now() / 1000),
  localDate: () => dateFormatter.format(new Date()),
  localHour: () => new Date().getHours(),
};
