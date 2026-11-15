# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A setup page opens after installing: a short privacy notice, connecting SIKOLA (it notices when you log in, no reload needed), choosing your active courses, and a final summary.
- Active courses are suggested from SIKOLA's "in progress" list, future end dates and upcoming deadlines. Your own choice always wins, and a new semester only triggers a suggestion to review, never a silent change.
- The "Hari Ini" popup lists tasks from your active courses, including quiz deadlines: overdue, today and tomorrow, this week, later, and without a due date. Remaining time is always written out, with the full date in a tooltip.
- Mark tasks as done, open them in SIKOLA, and copy this week's or all pending tasks as plain text, WhatsApp or Markdown.
- Readable course names and short labels, derived from SIKOLA's course names.
- The toolbar badge counts overdue tasks plus those due within 24 hours, shows "!" when the SIKOLA session has expired, and turns gray when data is out of date.
- Clear messages for an expired session, a changed SIKOLA, the daily limit, being offline, out-of-date data and a remote pause.
- An animated mascot that blinks, glances and changes expression with the state of your tasks, and stays still when your system asks for reduced motion.
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
