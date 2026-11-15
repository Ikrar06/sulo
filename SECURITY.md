# Security Policy

Sulo runs inside the browser with access to the user's SIKOLA session. A bug in Sulo can therefore affect a student's account, and security reports are taken seriously.

## Supported versions

Sulo is in early development and has no stable release yet. Only the latest commit on `main` is supported. Once releases exist, only the most recent release will receive fixes.

| Version | Supported |
|---|---|
| `main` (unreleased) | Yes |
| Anything older | No |

## Reporting a vulnerability

Please report privately through GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue.

If that option is not available, contact the maintainer, [@Ikrar06](https://github.com/Ikrar06), through the contact options on their GitHub profile and ask for a private channel. Do not include details in a public place.

Please include:

- what the problem is and why it matters
- steps to reproduce, using a build of Sulo and synthetic or sanitized data
- the Sulo commit or version and your browser version

**Never include personal data or credentials in a report.** That means no passwords, cookies, session keys (sesskey), tokens, grades, student numbers or screenshots that show any of them. Describe the issue with placeholders instead.

## What counts as a vulnerability

- A leak of session data (cookies, sesskey) or of personal or academic data outside the user's own browser.
- Requests that break the documented limits: more requests than the daily budget, parallel requests to SIKOLA, background HTML scraping, or any request to NEOSIA.
- Execution of code that comes from outside the extension, including through the remote configuration or data files.
- A bypass of an allowlist: calling a Moodle function, fetching a page or capturing a NEOSIA endpoint that is not on the list.
- Data that should be dropped (for example the fields listed in `docs/NEOSIA.md`) reaching storage, exports or logs.
- Messages from web pages being trusted without validation, or rendered as HTML.

Out of scope: problems in SIKOLA, NEOSIA or other university systems themselves (report those to the university), and issues that require a compromised browser or device.

## What to expect

This is a one-person project, so timelines are best effort:

- Acknowledgement within 7 days.
- A first assessment within 14 days.
- A fix or mitigation for serious issues as soon as possible. If needed, the remote kill switch can stop all requests from every installation within a day.

You will be credited in the changelog unless you prefer otherwise.
