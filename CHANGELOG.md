# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A dashboard in a full tab, opened from ⚙ in the popup: Overview (today, this week, a 14-day workload map, the next important date and the teaching week), Tasks (filters, search, snooze, a personal due date for undated tasks, checklist steps and a note), Courses (active, display name, color, access status), Latest updates, Calendar, Settings, Help and About. Every page has its own link, and opening the dashboard never checks SIKOLA.
- The academic calendar on screen: a one-line "important date" with a countdown under the popup's title, a month and list view with your task deadlines, flags for estimates, open ends and items to double-check, the source decree on every view, and subscription links for Google Calendar.
- Academic calendar notifications a day before KRS, tuition payment, midterms, finals, the drop and withdrawal deadlines and grade appeals, and a week before KRS, tuition and finals. They can be turned off per kind.
- Light and dark themes you can choose, an optional intake year, local usage statistics with a voluntary export, and a Help page with the FAQ that works offline.
- The dashboard greets you by time of day (morning, midday, afternoon, evening) without using your name. The teaching week shows as "Week X of Y" with a thin progress bar; outside the lecture period it names the next agenda item.
- Course colors are picked from eight round swatches plus "Automatic", usable with the arrow keys.
- One date format for due times everywhere: "Jum, 13 Nov, 23.59" in Indonesian and "Fri, 13 Nov, 11:59 PM" in English, without a time zone suffix.
- An About page with what Sulo does, the maker's links and a "Send feedback" link to a public Google Form (opened in a new tab; it reminds you not to send your student number, password or grades).

- The Unhas academic calendar 2026/2027 is built in (from the official decree, checked against its PDF) and updated from Sulo's public data at most once a day. It will be shown in the dashboard; subscribable calendars for core S1 dates, graduation and national holidays are published with the public data.

- "Delete all data" in the popup settings menu removes everything Sulo keeps in this browser, after a dialog that lists what goes and says nothing in SIKOLA is touched. Setup then starts again.

- A full-screen setup page opens after installing: a short privacy notice next to an example of the task list, connecting SIKOLA (it notices when you log in, no reload needed), choosing your courses as clickable cards, and a final screen with your own task list and how to pin Sulo. Steps come from a list, so later modules can add optional steps that can be skipped.
- A "What's new in Sulo" screen mechanism for people who already finished setup. It stays silent until there is something new.
- Active courses are suggested from SIKOLA's "in progress" list, future end dates and upcoming deadlines. Your own choice always wins, and a new semester only triggers a suggestion to review, never a silent change.
- The "Hari Ini" popup lists tasks from your active courses, including quiz deadlines: overdue, today and tomorrow, this week, later, and without a due date. Each row shows the task name, then the course with its color, and the due time on the right with the full date in a tooltip.
- Choose how due times read: both (time left and the due day and time, the default), time left, due time, or a live countdown. Overdue tasks always read "2 hours late", never a negative countdown.
- Indonesian and English. The language follows your browser and can be changed in the popup. The extension name, description and privacy page are available in both.
- "Add to Google Calendar" for each task opens a prefilled Google Calendar page in a new tab. Sulo sends nothing and needs no login or extra permission.
- Mark tasks as done, open them in SIKOLA, and copy this week's or all pending tasks as plain text that reads well in WhatsApp.
- Readable course names derived from SIKOLA's course names, with eight course colors that never sit next to the same color.
- Deadline reminders 3 days, 1 day and 3 hours before (choose from 3 days, 1 day, 6 hours, 3 hours and 1 hour), in your language, with the mascot as icon. Each reminder comes once, also after a deadline changes. Reminders missed while the browser was closed arrive as one summary, quiet hours (22.00 to 06.00 by default) hold reminders until morning except the last one, and an optional morning summary lists the day's tasks. Reminders need no request to SIKOLA, so they keep working when the session has expired.
- Latest updates: Sulo notices new materials and tasks, changed due dates ("moved 2 days later"), new grades or feedback (never the grade itself) and forum posts, and notifies once per course per check, or one summary when more than 3 courses changed. The first check of each course is a silent baseline. A "N new updates" line opens the log (up to 200 entries, grouped by day), and new or changed tasks get a small marker. Each kind of update can be turned off, and quiet hours apply in full. Course structures are checked in the same request as the task sync, at most 5 courses per check and each course at most every 6 hours.
- Snooze a reminder from the notification (1 hour) or from the task menu in the popup (1 hour, 3 hours, tomorrow morning). Snoozed tasks show a small clock.
- A "Reminders" panel in the popup with a test notification and short help for turning on notifications in macOS and Windows. The popup says so when Sulo's notifications are blocked in Chrome.
- When the SIKOLA session expires, one notification per event (and one more after 24 hours), and it recovers silently when you sign in again.
- The toolbar badge counts overdue tasks plus those due within 24 hours, shows "!" when the SIKOLA session has expired, and turns gray when data is out of date.
- A single status line for an expired session, a changed SIKOLA, the daily limit, being offline, out-of-date data and a remote pause. "Offline" appears only when the browser is offline or the last request failed at the network level.
- An animated mascot: the flame sways as one piece, the face follows a beat behind, eyes blink and glance (and follow the cursor during setup), and each state has its own expression, including a smooth double jump when you finish your last task. It stays still when your system asks for reduced motion.
- The privacy policy is available inside the extension.
- Data from one SIKOLA account is deleted when a different account logs in.
- Browser extension for Chrome and Edge (Manifest V3). No password is needed: Sulo uses the SIKOLA session already in the browser.
- Passive session detection. Sulo reads the session key already present on SIKOLA pages, without extra requests.
- A single, safe path for all requests to SIKOLA:
  - only read-only functions are allowed
  - requests run one at a time
  - a daily limit of 40 requests is enforced
  - after server errors, Sulo waits 3 to 24 hours before trying again
  - an expired session stops all requests until you log in again
- A remote off switch, so the project can pause every installation if the university asks.
- Checks on every response from SIKOLA, so a change on their side is shown as "SIKOLA berubah" instead of an empty list.
- Development tools that record sample responses with all personal data removed before saving.
- Visual identity: colors, dark and light themes, bundled fonts, app icons, and static mascot expressions.
- Documentation: architecture, request rules, privacy, brand guide, and plans for the academic calendar, the optional NEOSIA module, attendance and course registration planning.

### Changed

- Signing in to SIKOLA with another account no longer deletes your data right away. Sulo hides the previous account's tasks, stops checking and reminding, and asks: "Use this account" deletes the previous data and starts setup for the new one; "Later" keeps everything hidden until you sign in with the previous account again, which brings it all back.
- Setup picks up where you left off. "Choose courses" opens "Your courses": the saved list without checking SIKOLA, a "Refresh list" button, and changes saved only when you click Save ("No changes" when nothing changed).
- Older installations draw their background check minute again from the new 0 to 20 minute range.
- Opening the popup never contacts SIKOLA or anything else: it shows your stored list and when it was last updated. Only "Perbarui" (update) checks right away.
- Sulo checks a little after the browser starts and after you come back to your computer, but only when your list is more than an hour old, and never during quiet hours.
- Fewer and smaller checks: tasks and notifications at most every 3 hours in the background, the course list once a day (also during setup), course pages every 6 hours, five at most. When the day's limit is close, Sulo skips the less important parts first.
- Setup checks SIKOLA once and reuses a list from the last few minutes instead of asking again.
- Sulo's checks no longer keep your SIKOLA session alive.
- When you open a SIKOLA page that shows the login form, Sulo notices you are signed out right away, without checking.
- After a SIKOLA problem, waits are spread out a little per installation, and problems with Sulo's public data never pause SIKOLA checks.

### Fixed

- Cleaning up leftover data could delete a first account's freshly saved data when the extension woke up at the same moment as the first check.

- One course that cannot be opened no longer makes Sulo think you were logged out. Only the session check itself, or a login page at the top level, means the session ended. Courses with an access error are skipped for 24 hours and flagged after 3 failures in a row; server errors are retried at the next check, and when every course fails that way Sulo backs off from SIKOLA instead.
- Only one sync runs at a time: pressing update while one is running waits for it instead of sending another request, and the popup says "Sedang memperbarui".
- The same course change seen by two overlapping checks is logged and notified once.
- After switching SIKOLA accounts, the previous account's notifications are cleared, reminders of the previous account stop, and leftover data is removed. A setup tab that was open for the previous account no longer writes into the new one; it asks to reload.

### Security

- Every request goes through one scheduler that knows exactly which sites Sulo may contact; requests to NEOSIA are always refused. Sulo's public data is fetched without cookies or extra headers, at most once a day.
- The unused connection-test message was removed. Development-only tools (the fixture recorder and the reminder simulator) are excluded from production and tester builds, and a build check fails if any of it slips in.

- A scan for personal or session data runs before every commit and in CI.
