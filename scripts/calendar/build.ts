// Builds the academic calendar data from the official ICS (local, never
// committed) and the manual overrides from the PDF (committed).
// Usage: node scripts/calendar/build.ts [path/to/calendar.ics]
// Writes lib/calendar/data/<year>.json (bundled in the extension) and
// data/calendar/selisih-<year>.md (the ICS vs data report).
import { readFileSync, writeFileSync } from 'node:fs';
import { buildCalendar, renderReport, type Overrides } from '../../lib/calendar/build.ts';
import { parseIcsEvents } from '../../lib/calendar/ics-parse.ts';

const YEAR = '2026-2027';
const root = new URL('../../', import.meta.url);
const icsPath = process.argv[2] ?? new URL(`docs/sumber/kalender-akademik-unhas-${YEAR}.ics`, root);
const overrides = JSON.parse(readFileSync(new URL(`data/calendar/overrides-${YEAR}.json`, root), 'utf8')) as Overrides;
const events = parseIcsEvents(readFileSync(icsPath, 'utf8'));
const { file, report } = buildCalendar(events, overrides);

writeFileSync(new URL(`lib/calendar/data/${YEAR}.json`, root), `${JSON.stringify(file, null, 2)}\n`);
const markdown = `# Selisih ICS dan data kalender ${file.tahun_ajaran} (revisi ${file.revisi})\n\nDibuat oleh scripts/calendar/build.ts. Tanggal inklusif.\n\n${renderReport(report, events.length, file)}\n`;
writeFileSync(new URL(`data/calendar/selisih-${YEAR}.md`, root), markdown);
console.log(markdown);
