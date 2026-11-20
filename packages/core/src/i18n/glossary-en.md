# Sulo writing glossary (English)

The English text in `lib/i18n/en.ts` follows the same standard as the Indonesian (`glossary.md`): Sulo's users are students, not programmers.

## Style

- Like a tidy friend: casual, polite, short sentences, everyday words. Address the user as "you".
- One idea per sentence. If five words will do, don't use twelve.
- No technical terms, no exclamation marks, no slang, no emoji.
- Sentence case everywhere. No titles or labels in all caps.
- Problem messages say what happened and what you can do. No apologies, nothing vague.
- A button is named after its result. "Continue" goes to the next step, "Open SIKOLA" opens SIKOLA.
- Numbers as digits ("3 tasks"). Time units written out and plural-aware ("1 hour", "2 hours", "5 minutes"). 24-hour clock ("23:59").
- Keep names as they are: SIKOLA, Unhas, course and task names from SIKOLA are never translated.

## Words

| Avoid | Use |
|---|---|
| sync, synchronization | update, updated |
| Synced 2 mins ago | Updated 2 minutes ago |
| session expired, token invalid | Sign in to SIKOLA again so Sulo can update your tasks |
| parser error, unrecognised response | Sulo can't read SIKOLA properly yet. Try again later |
| daily budget reached, request limit, backoff | Never shown (M5a.4). Data older than 12 hours: "Sulo hasn't updated since {time}. Try Update later." |
| stale data | Last updated 7 hours ago |
| offline, no network connection | You're offline. Showing your last data |
| toggle, enable, disable | pick, tick, untick |
| Sulo's suggestion, manual pin, score | (never mention to users) |
| class, module (for a course) | course |
| sesskey, request, server, sync | (never mention to users) |
| Unofficial, not affiliated with Unhas | Not an official Unhas app |
| Privacy policy (in the footer) | Privacy |
| remotely disabled | Sulo is taking a short break |

## Unofficial statement

- The full sentence "Sulo is not an official app and is not affiliated with Universitas Hasanuddin" appears in setup step 1 and on the privacy page.
- Footers and other pages use "Not an official Unhas app" with a "Privacy" link.
- The statement appears once per screen, never repeated.

## Notifications

| Kind | Title | Body |
|---|---|---|
| Task | Laporan praktikum, 3 hours left | Fisika Dasar. Due Thursday 23:59. |
| Summary | 3 tasks are almost due | Nearest: Laporan praktikum, 5 hours left. |
| Morning summary | Your tasks today | 1 due today, 3 this week. Nearest: ... |
| Session expired | Your tasks can't be updated | Sign in to SIKOLA again so Sulo can update your tasks. |
| Test | Test notification from Sulo | If you can see this, Sulo reminders will show up. |

- Buttons: "Snooze 1 hour", "Mark as done". In the popup: "Snooze reminder", "Tomorrow morning, 07:00", "Cancel snooze".
- Settings use checkboxes and plain sentences ("Remind me before things are due", "Don't disturb me at certain hours"). Avoid "toggle", "switch", "enable".
- Notifications never include grades or other sensitive data.

## Latest updates

| Update | Notification title |
|---|---|
| New material | 3 new materials in Hidrologi |
| New task | New task in Hidrologi |
| Due date changed | Laporan praktikum: due date moved 2 days later / 1 day earlier |
| Grade or feedback | New grade or feedback in Analisa Struktur I |
| Forum | New forum post in Hidrologi |
| Summary | 9 updates from 5 courses |

- Say "moved later" and "moved earlier", not "postponed" or "brought forward".
- Grade notifications never mention the grade or the comment.
- Panel: "Latest updates", "3 new updates", "Mark all as seen", "Tell me about". Row markers: "New", "Due date changed".

## Accounts and data

| Situation | Text |
|---|---|
| Another account signs in to SIKOLA | Title "A different SIKOLA account was found". Buttons "Use this account" and "Later, I'll sign in with the previous account" |
| After "Later" | "The previous account's tasks are hidden" + "Sign in to SIKOLA with the previous account again, then click Update." |
| Delete all data | Title "Delete all Sulo data?", buttons "Delete all data" and "Cancel" |
| Choose courses | Title "Your courses", buttons "Refresh list" and "Save", then "No changes" or "Saved" with "Back to Sulo" |

- Say what happens to the data in everyday words: "hidden", "deleted", "not touched". Never mention user ids, storage or an "active" account.
- Every sentence about deleting says that nothing in SIKOLA is touched.

## Dashboard and calendar

- Dashboard pages: Overview, Tasks, Courses, Latest updates, Calendar, Settings, Help, About.
- "Personal due date" for a date the user sets; it never changes SIKOLA.
- "Important date", "Week 14 of 16", "Week not available yet", "In 14 days", "Until 12 Feb".
- Calendar flags: "Month only", "No end date", "Needs checking". Every calendar view ends with "Check the official document".
- "Buy me a coffee" with "via Trakteer". "Usage statistics (local)" and "Export statistics".

## M6: unified terms

| Thing | Term |
|---|---|
| courses Sulo follows | followed / not followed (not "active") |
| checking SIKOLA now | Update |
| fetching the course list again | Reload list (not "Refresh list") |
| change log | Latest updates |
| empty state | one sentence: what will show up here |
