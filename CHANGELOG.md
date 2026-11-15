# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A full-screen setup page opens after installing: a short privacy notice next to an example of the task list, connecting SIKOLA (it notices when you log in, no reload needed), choosing your courses as clickable cards, and a final screen with your own task list and how to pin Sulo. Steps come from a list, so later modules can add optional steps that can be skipped.
- A "What's new in Sulo" screen mechanism for people who already finished setup. It stays silent until there is something new.
- Active courses are suggested from SIKOLA's "in progress" list, future end dates and upcoming deadlines. Your own choice always wins, and a new semester only triggers a suggestion to review, never a silent change.
- The "Hari Ini" popup lists tasks from your active courses, including quiz deadlines: overdue, today and tomorrow, this week, later, and without a due date. Each row shows the task name, then the course with its color, and the due time on the right with the full date in a tooltip.
- Choose how due times read: both (time left and the due day and time, the default), time left, due time, or a live countdown. Overdue tasks always read "2 hours late", never a negative countdown.
- Indonesian and English. The language follows your browser and can be changed in the popup. The extension name, description and privacy page are available in both.
- "Add to Google Calendar" for each task opens a prefilled Google Calendar page in a new tab. Sulo sends nothing and needs no login or extra permission.
- Mark tasks as done, open them in SIKOLA, and copy this week's or all pending tasks as plain text that reads well in WhatsApp.
- Readable course names derived from SIKOLA's course names, with eight course colors that never sit next to the same color.
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

### Security

- A scan for personal or session data runs before every commit and in CI.
