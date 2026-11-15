// Writes the public files into a checkout of Ikrar06/sulo-data:
//   calendar/<year>.json, calendar/latest.json, the three ICS feeds,
//   schema/calendar.schema.json (generated from the Zod schema), and the
//   ICS vs data report (calendar/selisih-<year>.md).
// Usage: node scripts/calendar/publish.ts ../sulo-data
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { buildFeed, FEEDS, type FeedId } from '../../lib/calendar/ics.ts';
import { calendarFileSchema } from '../../lib/calendar/schema.ts';

const target = process.argv[2];
if (!target) {
  console.error('Pakai: node scripts/calendar/publish.ts <folder sulo-data>');
  process.exit(2);
}
const YEAR = '2026-2027';
const file = calendarFileSchema.parse(JSON.parse(readFileSync(new URL(`../../lib/calendar/data/${YEAR}.json`, import.meta.url), 'utf8')));
mkdirSync(join(target, 'calendar'), { recursive: true });
mkdirSync(join(target, 'schema'), { recursive: true });
const json = `${JSON.stringify(file, null, 2)}\n`;
writeFileSync(join(target, 'calendar', `${YEAR}.json`), json);
writeFileSync(join(target, 'calendar', 'latest.json'), json);
writeFileSync(join(target, 'calendar', `selisih-${YEAR}.md`), readFileSync(new URL(`../../data/calendar/selisih-${YEAR}.md`, import.meta.url), 'utf8'));
for (const feed of Object.keys(FEEDS) as FeedId[]) writeFileSync(join(target, 'calendar', FEEDS[feed].file), buildFeed(feed, [file]));
const schema = z.toJSONSchema(calendarFileSchema, { io: 'input', unrepresentable: 'any' });
writeFileSync(join(target, 'schema', 'calendar.schema.json'), `${JSON.stringify({ ...schema, title: 'Sulo academic calendar', $id: 'https://ikrar06.github.io/sulo-data/schema/calendar.schema.json' }, null, 2)}\n`);
console.log(`Ditulis ke ${target}: calendar/${YEAR}.json, calendar/latest.json, ${Object.values(FEEDS).map((f) => `calendar/${f.file}`).join(', ')}, schema/calendar.schema.json`);
