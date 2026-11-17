# Changelog

User-facing changes to Sulo. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
