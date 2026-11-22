# Changelog

User-facing changes to Sulo. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Planned as 0.2.0. Tester builds only; not submitted to any store, and no public Android release yet.

### Added

- **An Android app.** Your tasks, the academic calendar, attendance and latest updates on your phone, with reminders. You sign in on SIKOLA's own page; Sulo never sees your password, and the session is stored encrypted on the phone. Optional: "Watch for new tasks" checks SIKOLA in the background (about every 20 minutes by day, every 110 minutes at night) and can be turned off at any time; an app lock with your fingerprint or screen lock; a lighter mode with less motion.
- **Attendance.** Your attendance as SIKOLA records it, per course and per session. Read only; the recap updates itself once a day, or when you press Update.
- **A new first-run guide** in the extension, with the mascot showing what Sulo does before it asks for anything.
- "Add to Google Calendar" on a task: title, course and due time only, opened in a new tab when you click it.
- Sulo says in words when it is updating, when it is up to date and when it could not update.
- **NEOSIA, optional and off by default.** "Connect NEOSIA" in Settings shows what is kept and what is dropped before Chrome asks for permission. Sulo never contacts NEOSIA: it reads what the NEOSIA pages you open already loaded, keeps an allowlist of fields and drops the rest on the page. "Disconnect and delete data" removes everything and the permission.
- **KRS readiness** on the overview from 14 days before the KRS window until it closes: dates, paid or not, advisor, survey, credit limit and KRS status, with reminders 3 days and 1 day before it closes.
- **Schedule** page: your weekly classes from Monday to Saturday, holidays marked, and a calendar file for Google Calendar. Classes can also show in the calendar.
- A short profile on the overview (semester, credits, GPA behind Show) and a note when a new grade is out, naming the course only.
- Privacy mode: the eye in the dashboard header masks names, grades, GPA and credits.

### Changed

- One look for the extension and the phone: cards, course chips, round check marks and one set of icons.
- Settings has one icon everywhere (a gear), and small icons share one size.
- New interface icons (Phosphor Icons): a heavier, rounder line. The selected tab on the phone and the current page in the dashboard's sidebar show the same drawing, filled.
- The overdue count on the phone's Tugas tab sits beside the icon and no longer covers it.
- Courses SIKOLA will not open no longer stop the rest of an update.
- When SIKOLA signs you out, Sulo says "SIKOLA asks you to sign in again" instead of "Your SIKOLA session ended".

### Fixed

- Help answers that pointed to buttons and places that had moved: "Delete all data" is in Settings under "Delete data", and the calendar feeds are added with the "Google Calendar" button on each calendar.
- The same thing is called the same everywhere (reload the list, copied, connected, Google Kalender in Indonesian), and English texts that read like a word-for-word translation were rewritten.

### Privacy

- Grades and GPA never appear in notifications, exports, copied lists, calendar files or bug report info. The bug report says only whether NEOSIA is on and when its data last came.
- On Android, the screen cannot be captured or recorded while grades are shown.
- Privacy mode also masks attendance percentages in the extension, as it does on the phone.
- In privacy mode the attendance bar, the ring and the points are masked too, in the extension and on the phone: the percent could be worked out from them.
- The privacy page states the limit as it is: Sulo checks SIKOLA only as needed, one request at a time, with a safety limit of 150 requests a day.

## [0.1.0] - 2026-11-18

The first public version.

### Added

- **Your tasks in one place.** The popup lists the assignments and quizzes from the SIKOLA courses you follow: overdue, today and tomorrow, this week, later, and without a due date. Each row shows the course and the time left; choose how due times read (time left, due time, both, or a live countdown).
- **Reminders** before a deadline (3 days, 1 day and 3 hours by default), quiet hours, an optional morning summary, and snoozing from the notification or the task menu.
- **Latest updates:** new materials and tasks, changed deadlines, new grades or feedback (never the grade itself) and forum posts, with one notification per course per check.
- **A dashboard in a full tab:** an overview with today's tasks, the next academic date and the teaching week; a task list with search, filters, steps, notes, a personal due date and snoozing; your courses with display names, colors and a Followed switch; latest updates; settings; help with short video steps; and an About page.
- **The Unhas academic calendar 2026/2027:** a month grid with multi-day events and your deadlines, category filters, a side panel for the selected day and what comes next, a list view, reminders for registration, payments, exams and other key dates, and public calendars you can add to Google Calendar, Outlook or Apple Calendar.
- Light and dark themes, Indonesian and English.
- "Copy info for a bug report" in the settings, shown in full before anything is copied.

### Changed

- Sulo checks SIKOLA sparingly: about every 3 hours while you use your computer, never at night, and when you click Update. Updates and reminders keep working from the stored list when you are offline.
- A click on Update right after a check says "Up to date" instead of checking again.
- Courses are "followed" or "not followed" everywhere, and the course list is reloaded with "Reload list".

### Fixed

- Marking a task as done keeps it in place with Undo for 5 seconds instead of making it disappear.
- A new task found both in the calendar and on the course page shows up as one update.
- The countdown keeps the HH:MM:SS form under an hour instead of switching to minutes.
- Deadlines at exactly midnight name the night before ("Tuesday midnight").

### Privacy

- No password, no Sulo server, no analytics, no ads. Everything is stored on your device; "Delete all data" removes it. Sulo only reads from SIKOLA and never hands in work or changes anything there.
- Sulo is unofficial and not affiliated with Universitas Hasanuddin.
