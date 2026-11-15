<!-- Generated from lib/privacy/content.ts by scripts/build-privacy.ts. Do not edit by hand. -->

# Privacy Policy

Last updated: 15 November 2026

Sulo is an unofficial academic companion for Universitas Hasanuddin students. It is not affiliated with or endorsed by Universitas Hasanuddin.

Sulo is in early development. This policy describes the rules the project follows; where a feature is still planned, it says so. In short: everything stays in your browser, and nothing is sent to the developer or to third parties.

## What Sulo reads

Sulo uses the SIKOLA session that already exists in your browser to read your own data:

- your list of courses
- assignments and their due dates, including quiz deadlines
- the structure of each course (sections and activities), from the change radar milestone
- your SIKOLA notifications, from the change radar milestone

Sulo only reads. It never submits work, never marks anything as read, never changes data in SIKOLA, never reads quiz content, and never reads other students' data.

## What Sulo stores, and where

Everything is stored locally in your browser (chrome.storage) on your own device:

- courses, assignments and due dates
- your choices: active courses, tasks marked done, and later aliases, colors and a nickname you type yourself
- local usage counters, which never leave your device unless you export them yourself

From SIKOLA notifications, Sulo will keep only the id, the subject, the component and event type, when it was created, and whether it has been read. The message body, which may contain grades or lecturer comments, is never stored.

Data is tied to your SIKOLA account. If a different account logs in on the same browser, the previous account's data is deleted.

## What Sulo never does

- Never asks for, reads or stores your username or password.
- Never stores cookies, session keys or tokens beyond the current browser session.
- Never sends your data to the developer, to a server, or to any third party.
- No analytics, no telemetry, no advertising.
- No automation of academic tasks: Sulo does not fill in course registration, surveys or attendance.

## Network requests

Sulo makes requests to two places only:

1. SIKOLA (sikola-v2.unhas.ac.id), to read your own data. At most 40 requests per day (typically 5 to 10), one at a time, not during quiet hours (00.00 to 06.00), and not while your computer is idle.
2. Sulo's public data repository on GitHub Pages (ikrar06.github.io/sulo-data), to fetch a small configuration file and, later, the academic calendar. These requests carry no information about you (no cookies, extra headers or parameters) and are made at most once a day per file. As with any website, GitHub can see your IP address when a file is fetched.

"Add to Google Calendar" in the task menu only opens a Google Calendar page in a new tab when you click it. That page is prefilled with the task name, course name, due time and a link to the task on SIKOLA. Sulo itself sends nothing to Google and needs no login; you decide whether to save it in Google Calendar.

## Optional modules

Optional modules, such as the planned NEOSIA module, are off by default. Before one is turned on, Sulo shows a consent screen that explains what it reads, what it discards, and how to turn it off.

- Sulo would never send requests to NEOSIA. It would only read data from NEOSIA pages you open yourself.
- Identity details (such as national ID number, address, date of birth and contact details), payment amounts and lecturer ID numbers are discarded before anything is saved.
- Grades and GPA are hidden by default and are never included in exports.
- Turning a module off deletes its data and removes its permissions.

## Deleting your data

- Removing the extension from your browser deletes all of its data. This works today.
- A "Hapus semua data" button in Sulo's settings is planned with the dashboard and will delete everything without removing the extension.

## Changes to this policy

Changes are published with new versions of Sulo, and the date at the top is updated. If the privacy notice shown during setup changes, Sulo shows it again.

## Contact

Questions about privacy can be raised with the maintainer on GitHub (github.com/Ikrar06). Please do not include personal data in your message.
