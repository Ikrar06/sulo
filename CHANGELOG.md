# Changelog

User-facing changes to Sulo. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-11-28

### Added

- **Task grades from SIKOLA.** Tasks shows which tasks are graded, and a graded task is marked as done on its own. The number shows only after "Show grades" (hidden by default, masked in privacy mode, never in a notification). Sulo reads the grades page of each course you follow, the grade column only and never the lecturer's comments, when you open Tasks (at most once every 10 minutes) and when it updates. Done, Graded and Long past due list the history, older assignments missing from the SIKOLA calendar included.
- **Your own tasks.** Add work your lecturer gave outside SIKOLA, such as a presentation, with its course and due date; Sulo reminds you of it like a SIKOLA task. Kept on this device only.
- **Add a task to your device's own calendar.** On iPhone, iOS's own add-event sheet (Calendar access is asked once on iOS 16 only; iOS 17 and later ask nothing); on Android, your calendar app's new-event screen, no permission; on the dashboard, an .ics file for Mac Calendar or Outlook beside Google Calendar. On iPhone the academic calendar subscribes to its own Calendar too.
- **Sulo for iPhone.** Installed from a laptop with Sideloadly and your own Apple ID, on iOS 16.4 or later. With a free Apple ID the install lasts 7 days, and Sideloadly refreshes it by itself while your laptop is on and the iPhone is on its cable or the same Wi-Fi; if a refresh is missed, Sulo reminds you the day before. Swipe in from the left edge to go back. The same tasks, calendar, attendance, NEOSIA and Sipakamase as on Android. On iPhone new tasks show when you open Sulo, and "Keep the SIKOLA session" (optional) keeps your session only when the iPhone gives it time. The guide: [sulo.ikrar.dev/en/pasang/iphone](https://sulo.ikrar.dev/en/pasang/iphone).
- **Sign in again, once for every source** (phone): when SIKOLA, NEOSIA or Sipakamase signed you out, the morning summary offers Sign in again, at most once a day and never as a separate repeating notification; one tap walks through each source.
- **Sipakamase.** Connect Sipakamase (optional, off until you agree to it) and the MKPK card shows the activity credits not converted yet and the passed courses not yet in NEOSIA, with reminders: a course in your KRS not passed yet as the grade-entry deadline nears, a passed course you can program when KRS opens, an activity with no companion, a grade to claim. Changes to your activities' status arrive as news. Sulo only reads five fixed pages of your MKPK data; you sign in on Sipakamase's own page, and Sulo never fills in, deletes, converts or claims anything. While you are waiting for something, Sulo keeps the session alive with one read every 3 hours (on the phone only on the background check that already runs); when nothing is pending it stops. Once NEOSIA is set up and the MKPK card shows, the overview offers to connect it, so it no longer has to be found in Settings.
- **MKPK card.** With NEOSIA connected: the MKPK credits on your transcript and in your KRS, the MKPK courses your program offers this semester, and your program's MKPK load (Sulo's estimate until you confirm it).
- **Watch for new tasks in the extension** (optional): SIKOLA is checked every 15 minutes while your computer is in use and each time you open Sulo, so new tasks and updates arrive as notifications without pressing Update. Your SIKOLA session stays active in this browser while it is on.
- **Update from NEOSIA closes itself.** The page opens, its data comes in, and the tab (extension) or screen (phone) closes by itself.
- **Update NEOSIA automatically** (Android, optional): when you open Sulo and a visit is due (daily during KRS and grade periods, weekly otherwise), NEOSIA's Beranda loads out of sight; if NEOSIA asks you to sign in again, Sulo says so.
- **What's new in Sulo** on the phone too, once after an update; for 1.1.0 it names task grades and your own tasks.
- Small, purposeful motion: a detail slides in and back, the done circle pops, the week's bars grow once. Reduced motion and the light mode keep things still.
- Dark and tinted app icons on iPhone, following the Home Screen's look.
- A quick check when you open the phone app with data from 5 to 15 minutes ago.

### Changed

- The phone's session keepers time themselves from how long sessions really last on your phone. The notes behind it hold times only, never leave the phone, and show on the Diagnostik screen (seven taps on the version in About).
- After 7 days without Sulo being opened, watching and session keeping stop with one notification; opening Sulo starts them again (Sipakamase asks to connect again).
- One remembered choice shows grades on the dashboard: "Show" on the Studies card and on Grades now do the same thing.
- Lighter screens: KRS readiness as short label and value rows, shorter help in Settings, notification system steps folded away, every button in the extension a pill like on the phone, and "Open dashboard" always visible in the popup.
- A required Android update can be set to apply from a date, so the update card shows first.
- Update by hand at most every 5 minutes (it was 2).
- A finished task no longer offers to be added to a calendar.
- "Add a task" sits in the dashboard's header.
- In the first-run guide, when SIKOLA asks Sulo to pause, the guide says so and when it can try again, instead of failing again and again.
- The phone shows no scrollbars, rows that scroll sideways only scroll sideways, and a long press no longer selects the app's own text.
- A sheet on the phone rises before the keyboard: its fields wait for a tap (the nickname and course name too), so opening one no longer makes the screen jump.
- The phone's GPA simulation keeps the estimate in view and its courses in a drawer, closed at first, as on the dashboard: Grades is no longer a whole transcript long. Every course can be simulated (the list stopped at 40).

### Fixed

- The phone's background check now refuses a remote config whose extension switch is broken, like the app does, and a failed config read no longer drops the extension's settings.
- On iPhone, going from a screen with a longer title to one with a shorter title no longer leaves the end of the old title painted ("Calendarce").
- While a sheet is open, the screen behind it no longer slides under the status bar (Android 15 and later, and iPhone).

## [1.0.0] - 2026-11-25

The first public release. The extension and the Android app are the same as 0.9.1; what is new is that anyone can get them.

### Added

- Downloads on this repository's Releases page: the Android APK with its SHA-256, and the extension as a zip for Chrome and Edge until it is in their stores.
- A website, [sulo.ikrar.dev](https://sulo.ikrar.dev), that gives the right file for your device and walks through installing it.

## [0.9.1] - 2026-11-24

For testers.

### Fixed

- **Large text on the phone.** Sulo now follows the phone's font size all the way, also past 130%, and every screen makes room for it instead of letting text run out of its card or over other text:
  - the first welcome screen shows fewer sample tasks when they do not fit, and the cards no longer lie over each other;
  - on the overview, the attendance average sits on its own line, and the calendar and attendance cards stack one above the other when they are too narrow side by side;
  - task, calendar, attendance and settings cards, chips, buttons and screen titles grow with the text;
  - long words and web addresses break instead of running out of the screen.
- Small buttons (back, skip, page dots, "See all", search clear, add step) and the days of the month view and of the next 7 days are easier to tap; on a very narrow screen these rows scroll sideways.

## [0.9.0] - 2026-11-23

For testers. Not submitted to any store yet, and the Android app is shared with testers directly.

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
- **A choice of notification sound** on the phone (Settings, Notifications): Sound 1 to 4, the phone's own sound, or silent. A tap plays it once. Deadline reminders and news use it; the morning summary and other notices stay silent.
- The mascot reacts to what happens: a small hop when you tick a task (stars on the first of a run), a celebration when the last one is done, a nod after an update and a shake of the head when it fails.

### Changed

- One look for the extension and the phone: cards, course chips, round check marks and one set of icons.
- A new mascot: the flame bends as one body, its eyes change shape instead of jumping, and every expression has its own outline. It uses less battery than before, and keeps still (only blinking) with reduced motion or on the phone's lighter mode. Its eyes follow the pointer on the dashboard.
- Without a connection the mascot looks tired instead of asleep; it only sleeps when SIKOLA asks you to sign in again.
- Settings has one icon everywhere (a gear), and small icons share one size.
- New interface icons (Phosphor Icons): a heavier, rounder line. The selected tab on the phone and the current page in the dashboard's sidebar show the same drawing, filled.
- The overdue count on the phone's Tugas tab sits beside the icon and no longer covers it.
- Courses SIKOLA will not open no longer stop the rest of an update.
- When SIKOLA signs you out, Sulo says "SIKOLA asks you to sign in again" instead of "Your SIKOLA session ended".

### Fixed

- Help answers that pointed to buttons and places that had moved: "Delete all data" is in Settings under "Delete data", and the calendar feeds are added with the "Google Calendar" button on each calendar.
- The lock in the first-run guide no longer has the top of its shackle cut off.
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
