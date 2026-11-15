# Privacy Policy

Last updated: 15 November 2026

Sulo is an unofficial academic companion for Universitas Hasanuddin students. It is not affiliated with or endorsed by Universitas Hasanuddin.

Sulo is in early development. This policy describes the rules the project follows; where a feature is still planned, it says so. It explains what Sulo reads, what it keeps, and what it never does. In short: everything stays in your browser, and nothing is sent to the developer or to third parties.

## What Sulo reads

Sulo uses the SIKOLA session that already exists in your browser to read your own data:

- your list of courses
- assignments and their due dates
- the structure of each course (sections and activities)
- your SIKOLA notifications

Sulo only reads. It never submits work, never marks anything as read, never changes data in SIKOLA, and never reads other students' data.

## What Sulo stores, and where

Everything is stored locally in your browser (`chrome.storage`) on your own device:

- courses, assignments and due dates, and the changes Sulo has detected
- your settings, such as which courses are active, aliases and colors, and an optional nickname you type yourself
- local usage counters, which never leave your device unless you export them yourself

From SIKOLA notifications, Sulo keeps only these fields:
- the notification id
- the subject
- the component and event type
- when it was created
- whether it has been read

The message body, which may contain grades or lecturer comments, is never stored.

Data is tied to your SIKOLA account. Once account separation ships (planned for the next milestone), a different account logging in deletes the previous account's data.

## What Sulo never does

- Never asks for, reads or stores your username or password.
- Never stores cookies, session keys or tokens beyond the current browser session.
- Never sends your data to the developer, to a server, or to any third party.
- No analytics, no telemetry, no advertising.
- No automation of academic tasks: Sulo does not fill in course registration, surveys or attendance.

## Network requests

Sulo makes requests to two places only:

1. **SIKOLA** (`sikola-v2.unhas.ac.id`), to read your own data. Requests are limited and run one at a time:
   - at most 40 per day, typically 5 to 10
   - not during quiet hours (00.00 to 06.00)
   - not while your computer is idle
2. **Sulo's public data repository** on GitHub Pages (`ikrar06.github.io/sulo-data`), to fetch a small configuration file. Later it will also fetch the academic calendar.
   - These requests carry no information about you: no cookies, no extra headers, no parameters.
   - They are made at most once a day per file.
   - As with any website, GitHub can see your IP address when the file is fetched.

## Optional modules

Optional modules, such as the planned NEOSIA module, are off by default. Before one is turned on, Sulo shows a consent screen that explains:
- what the module reads
- what it discards
- how to turn it off

For NEOSIA in particular:
- Sulo would never send requests to NEOSIA. It would only read data from NEOSIA pages you open yourself.
- It discards identity details (such as national ID number, address, date of birth and contact details), payment amounts, and lecturer ID numbers before anything is saved.
- Grades and GPA are hidden by default and are never included in exports.

Turning a module off deletes its data and removes its permissions.

## Deleting your data

- Removing the extension from your browser deletes all of its data. This works today.
- A "Hapus semua data" button in Sulo's settings is planned with the dashboard and will delete everything without removing the extension.

## Changes to this policy

Changes are published in this file in the project repository, and the date at the top is updated.

## Contact

Questions about privacy can be raised with the maintainer, [@Ikrar06](https://github.com/Ikrar06). Please do not include personal data in your message.
