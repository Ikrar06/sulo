<!-- Generated from lib/privacy/content.ts by scripts/build-privacy.ts. Do not edit by hand. -->

# Privacy Policy

Last updated: 27 November 2026

Sulo is an unofficial academic companion for Universitas Hasanuddin students. It is not affiliated with or endorsed by Universitas Hasanuddin.

Sulo is in early development. This policy describes the rules the project follows; where a feature is still planned, it says so. In short: everything stays in your browser, and nothing is sent to the developer or to third parties.

## What Sulo reads

Sulo uses the SIKOLA session that already exists in your browser to read your own data:

- your list of courses
- assignments and their due dates, including quiz deadlines
- the structure of each course you follow (sections and activities), a few times a day, to spot new materials and tasks
- your 20 latest SIKOLA notifications, to spot new grades, feedback and forum posts

Sulo only reads. It never submits work, never marks anything as read, never changes data on SIKOLA, never reads quiz content, and never reads other students' data.

## What Sulo stores, and where

Everything is stored locally in your browser (chrome.storage) on your own device:

- courses, assignments and due dates, and the tasks you add yourself (the title, course and due date you type)
- your attendance recap from SIKOLA, updated automatically at most once a day, and the per-session details, fetched only when you open them (for the courses you follow: sessions recorded, points, percentage, status, and remarks)
- the last seen structure of each course and the "Latest updates" log (at most 200 entries)
- your choices: the courses you follow, tasks marked done, course display names and colors, and a nickname you type yourself
- a technical log of the last 300 checks of SIKOLA: only the time, the function names and the status, with no content; never sent, and only included when you copy "info for a bug report" yourself
- local usage counters, which never leave your device unless you export them yourself

From SIKOLA notifications, Sulo keeps only the id, the subject, the component and event type, when it was created, whether it has been read, the related page address (known SIKOLA pages only, with no parameters other than ids) and the course number. Message bodies (text, fullmessage, fullmessagehtml, smallmessage) and extra data (customdata), which may contain grades or lecturer comments, are dropped when read and never stored. Sulo's own notifications about grades never mention the grade or the comment.

Local usage statistics (how often the popup and dashboard were opened, tasks marked as done and reminders shown) are numbers only and stay in your browser. Sulo never sends them. They are not shown and cannot be exported in the regular version; only development builds show them.

Data is tied to your SIKOLA account, recognized by your SIKOLA user number (userid), stored as is in your browser. If a different account signs in to SIKOLA on the same browser, the previous account's data is hidden at once and Sulo stops checking and reminding. That data is deleted only after you choose "Use this account", or when you use "Delete all data". If you sign in with the previous account again, everything comes back.

## What Sulo never does

- Never asks for, reads or stores your username or password.
- Never stores cookies, session keys or tokens beyond the current browser session.
- Never sends your data to the developer, to a server, or to any third party.
- No analytics, no telemetry, no advertising.
- No automation of academic tasks: Sulo does not fill in course registration, surveys or attendance.

## Network requests

Sulo makes requests to these places only:

1. SIKOLA (sikola-v2.unhas.ac.id), to read your own data. Sulo checks SIKOLA only as needed, one request at a time. A safety limit caps it at 150 requests a day. If Sulo reaches the limit, it stops checking until the next day. Sulo does not check on its own during quiet hours (00:00 to 06:00) or while your computer is idle. If you turn on "Watch for new tasks", Sulo checks every 15 minutes while your computer is in use and when you open Sulo, and meanwhile your SIKOLA session stays active in this browser. After 7 days without Sulo being opened, watching stops until you open it again.
2. Sulo's public data repository on GitHub Pages (ikrar06.github.io/sulo-data), to fetch a small configuration file and the academic calendar data. These requests carry no information about you (no cookies, extra headers or parameters) and are made at most once a day per file. As with any website, GitHub can see your IP address when a file is fetched.
3. Sipakamase (sipakamase.unhas.ac.id), only if you connect it: GET requests to five read-only pages of your MKPK data, never any other address. See the Sipakamase module section.

"Add to Google Calendar" in the task menu only opens a Google Calendar page in a new tab when you click it. That page is prefilled with the task name, course name, due time and a link to the task on SIKOLA. Sulo itself sends nothing to Google and needs no sign-in; you decide whether to save it in Google Calendar.

The "Buy me a coffee" button (Trakteer), social media links and "Send feedback" (Google Form) on the About page, and the link to the official calendar PDF, only open that site in a new tab when you click them. Until you click, Sulo does not contact that site at all, and no script, image or font from it is loaded into Sulo's pages. Sulo sends no data there and never fills in a form for you.

## NEOSIA module (optional)

Off by default. If you turn on "Connect NEOSIA" in Settings, Sulo first shows a consent screen with the text below, then Chrome asks for its permission.

Sulo only reads data while you open NEOSIA yourself. Sulo never contacts NEOSIA.

What is kept in your browser

- Class schedule: courses, classes, days, times, rooms and lecturer names
- The KRS window and status, and your credit limit
- Paid or not paid, without amounts
- The survey status: filled in or not
- Letter grades, semester and overall GPA, and credits. Hidden until you choose Show
- Your semester and study period
- Your academic advisor’s name

What is dropped before it leaves the NEOSIA page

- Student number, national ID and school ID numbers
- Contact details: email and phone number
- Address and date of birth
- Payment amounts and bank
- Numeric grades
- Lecturers’ NIP, NIDN and NUPTK numbers

Turning it off

Any time, in Settings with "Disconnect and delete data". All NEOSIA data is deleted and the permission is removed.

- Its permissions are optional: "scripting" and access to the neosia.unhas.ac.id pages. Both are asked for only when you turn the module on, and removed when it is turned off. Sulo does not ask for access to the NEOSIA API address. If you remove one in Chrome's settings, the module turns itself off and its data is deleted.
- Sulo never sends a request to NEOSIA. Two small scripts on NEOSIA pages read the responses the NEOSIA app already asked for, pick out the fields that may be kept right there on the page, and drop the rest. The full responses are never stored, logged or sent.
- The survey link, your personal data page in NEOSIA and the withdrawal page are never read. The NEOSIA sign-in token is never read.
- Grades and GPA never appear in notifications, exports, copied lists, calendar files or bug report info. A new-grade notification names the course only.
- Privacy mode (in Settings, or the eye icon in the dashboard) masks names, grades, GPA, semester GPA, credits and attendance percentages on screen.
- No automation: Sulo never fills in KRS, surveys or attendance, and never watches class capacity.

## Sipakamase module (optional)

Off by default. If you press "Connect" in Settings, Sulo first shows a consent screen with the text below; in the extension, Chrome then asks for its permission.

Sulo reads your MKPK activities, the credits already converted and the courses you passed, so you see your progress in one place. You sign in on Sipakamase’s own page. Sulo never sees your password.

How Sulo keeps it up to date

- While you are waiting for something (an activity not processed yet, or a grade not in NEOSIA yet), Sulo reads one of your five MKPK pages every 3 hours. That keeps your data current and keeps you from being asked to sign in again and again. Meanwhile your Sipakamase session stays active on this device.
- When nothing is waited for, Sulo stops reading until you open Sipakamase or press Update now.
- Sulo only reads. It never fills in, deletes, converts or claims anything.

What is never read

- Your student number, email and phone number
- The names of companions and verifiers
- Chat messages and notifications
- Numeric grades

Disconnecting

Any time, in Settings with "Disconnect". All Sipakamase data is deleted at once and the permission is removed.

- What is kept, on this device only: per activity its semester, basis, kind, name, status, whether it has a companion and a score, its converted credits; passed MKPK courses with their credits and whether they reached NEOSIA; the codes and kinds of the courses in your KRS.
- Sulo asks for five fixed addresses only, with GET, without parameters, and never follows a link from its pages. Addresses that change data (deleting an activity, converting, claiming, signing out) are refused before they are sent.
- Extension: its permissions are optional ("scripting" and access to sipakamase.unhas.ac.id), asked for when connecting and removed when disconnecting. One small script on the activity, history, conversion and claim pages reads what you open yourself, without a request; the login page and the home page never get a script.
- Android: you sign in on Sipakamase's own page in a screen without any script. Its session cookie is kept encrypted with an Android Keystore key of its own, never leaves the phone, and is deleted by Disconnect or Sign out. Keeping the session in the background only rides the "Watch for new tasks" check that already runs; the pages' content is not kept.
- iPhone: you sign in on Sipakamase's own page in a screen without any script. Its session cookie is kept in the iPhone's Keychain, never leaves the iPhone, and is deleted by Disconnect or Sign out. Keeping the session in the background only rides "Keep the SIKOLA session" when the iPhone gives it time; the pages' content is not kept.
- After 7 days without Sulo being opened, keeping stops and you are asked to connect again.

## Deleting your data

- Removing the extension from your browser deletes all of its data. This works today.
- "Delete all data" in Settings (under "Delete data") deletes everything Sulo keeps in this browser (tasks, courses, reminders, latest updates and settings) without removing the extension. Nothing on SIKOLA is touched.
- "Disconnect and delete data" on the NEOSIA card (Settings) deletes all NEOSIA data and removes its permissions. "Delete all data" also turns the NEOSIA module off.

## Changes to this policy

Changes are published with new versions of Sulo, and the date at the top is updated. If the privacy notice shown during setup changes, Sulo shows it again.

## Contact

Questions about privacy can be sent through the feedback form: https://forms.gle/XsBuWXGHNR4pPTs17. Please do not include your student number, password, grades or other personal data in your message.
