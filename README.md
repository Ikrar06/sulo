<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/lockup-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/brand/lockup-light.svg">
    <img alt="Sulo" src="assets/brand/lockup-light.svg" width="320">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/Ikrar06/sulo/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Ikrar06/sulo/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
</p>

An unofficial academic companion for Universitas Hasanuddin students. Works with SIKOLA, with optional NEOSIA support.

Sulo is not affiliated with or endorsed by Universitas Hasanuddin. The name means "torch" in Buginese and Makassarese. Today it reads assignments and deadlines from SIKOLA, the university's Moodle; the academic calendar and NEOSIA are planned.

<!-- Screenshot of the popup goes here once the Today view (M2) is usable. -->

## Status

Early development, limited trial. Only the SIKOLA part works today. Sulo is installed manually by a small group of testers (at most 10) and is not on the Chrome Web Store. Publishing waits for permission from the SIKOLA administrators.

## Features

Working now:

- Passive session detection: a content script reads the sesskey already present on SIKOLA pages. It makes no extra request.
- Connection test from the popup through the service worker, using the browser's existing SIKOLA session.
- A single request gateway with an allowlist of read-only functions, a serial queue, a persistent daily budget, backoff, login-redirect detection and a remote kill switch.
- Validation of all five Moodle web service responses with Zod. A mismatch is reported as a parser problem, never as empty data.
- A fixture recorder and sanitizer for development, so tests run on realistic data without personal information.

Planned:

- Today view: overdue, today and tomorrow, this week, later, no due date. Copy the list as plain text, WhatsApp or Markdown.
- Deadline reminders 3 days, 1 day and 3 hours before, with snooze.
- Change radar: new, removed, renamed and hidden activities, due date changes, new grades, feedback and forum posts.
- Dashboard with a change feed, a 14-day workload map and course management.
- Academic calendar alongside your deadlines.
- NEOSIA as an optional module, off by default and enabled only with explicit consent.

## Privacy and safety

- **No password.** Sulo never asks for, reads or stores credentials. It uses the session you already have in the browser.
- **Read only.** Only an allowlist of read-only Moodle functions can be called. Sulo never submits work, marks anything as read or keeps the session alive on its own.
- **Local data.** Everything is stored in `chrome.storage` on your device. From M2 on, data is keyed by user id and cleared when a different account logs in.
- **No telemetry.** No analytics and no third-party requests. Apart from SIKOLA, Sulo only fetches public data from its own data repository (a kill-switch file now, the academic calendar later): data only, validated, at most once a day, with nothing that identifies the user.
- **Small footprint.** At most 40 requests per day per installation, with a typical target of 5 to 10. Requests run one at a time, never during quiet hours (00.00 to 06.00) or while the computer is idle, and back off for 3 to 24 hours after server errors.
- **Optional modules are off by default.** Planned modules such as NEOSIA must be turned on explicitly, never send requests of their own, and remove their data when turned off.
- **No academic automation.** Sulo does not fill in course registration, surveys or attendance, and does not watch class quotas.
- **Minimal permissions.** `storage`, `alarms`, `notifications`, `idle`, and access to `https://sikola-v2.unhas.ac.id/*` only.

Full policy: [PRIVACY.md](PRIVACY.md).

## Architecture

```
+-------------------+      messages      +----------------------+
| Popup             | <----------------> |                      |
+-------------------+                    |   Service worker     |
| Dashboard (M5)    | <----------------> |   (background.ts)    |
+-------------------+                    |                      |
| Content script    | -- sesskey ------> |  sync, diff,         |
| (SIKOLA pages)    |                    |  notifications       |
+-------------------+                    +----------+-----------+
                                                    |
                                          lib/moodle/client.ts
                                   allowlist, queue, budget, backoff
                                                    |
                                   sikola-v2.unhas.ac.id (JSON batch)
```

All requests to SIKOLA leave from the service worker through one client. Pages that need HTML ask the service worker for it and parse it themselves. `lib/moodle` and `lib/radar` never touch browser APIs; storage, clock and fetch are injected so they can be tested in Node.

## Tech stack

TypeScript (strict), [WXT](https://wxt.dev) for Manifest V3, React, Tailwind CSS 4 with shadcn/ui, Zod, Vitest. Fonts (Inter, Plus Jakarta Sans) are bundled locally.

## Local development

Prerequisites: Node.js 24 or newer and pnpm 10 (the version is pinned in `package.json`).

```sh
pnpm install --frozen-lockfile
git config core.hooksPath .githooks   # leak scan and commit message checks
```

| Command | What it does |
|---|---|
| `pnpm dev` | Builds to `.output/chrome-mv3-dev` with hot reload and opens a fresh Chrome profile |
| `pnpm build:dev` | Development build in `.output/chrome-mv3-dev`, without opening a browser |
| `pnpm build` | Production build to `.output/chrome-mv3` |
| `pnpm zip` | Production zip in `.output/` |
| `pnpm test` | Vitest, no browser needed |
| `pnpm typecheck` | `wxt prepare` and `tsc --noEmit` |
| `node scripts/check-leaks.mjs` | Scans the repository for personal or session data |

Load the extension in your own Chrome profile, where you are logged in to SIKOLA:

1. Run `pnpm build` (or `pnpm build:dev` for the development build).
2. Open `chrome://extensions` and turn on Developer mode.
3. Choose "Load unpacked" and select `.output/chrome-mv3` (or `.output/chrome-mv3-dev`).

Trial testers receive an installation guide directly from the maintainer.

Asset scripts: `node scripts/build-mascot.mjs` rebuilds the static mascots. `sh scripts/build-icons.sh` rebuilds the 128 px icon and needs `rsvg-convert` (librsvg) installed locally.

## Project structure

```
entrypoints/        background, content script, popup, recorder (dev only)
lib/                shared logic; lib/moodle is the only path to SIKOLA
components/ui/      shadcn/ui components
assets/             design tokens (tailwind.css), fonts, brand assets
public/icon/        extension icons
tests/              Vitest suites
fixtures/           sanitized test data only
scripts/            leak scan, sanitizer, asset builders
```

## Roadmap

M0 scaffold and M1 request safety are done. Next: Today view (M2), reminders (M3), change radar (M4), dashboard and academic calendar (M5a), calendar export (M5b), attendance and next-day prep (M6), the optional NEOSIA module (M7), a course registration planner (M8), and course status rules (M9).

## Documentation

- [PRIVACY.md](PRIVACY.md): what Sulo reads, stores and never does
- [CONTRIBUTING.md](CONTRIBUTING.md): setup, project rules and review
- [SECURITY.md](SECURITY.md): reporting vulnerabilities
- [CHANGELOG.md](CHANGELOG.md): notable changes
- [TRADEMARK.md](TRADEMARK.md): use of the name, logo and mascot
- [fixtures/README.md](fixtures/README.md): test data and how to record it safely

Internal design notes are kept private during the limited trial.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md): it covers setup, conventions, the data and request rules, and the kinds of features that will not be accepted. Sulo is maintained by one person, so please open an issue before larger changes. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), and never include personal data or credentials in a report.

## Disclaimer

Sulo is an independent, unofficial project. It is not affiliated with, endorsed by or supported by Universitas Hasanuddin. SIKOLA and NEOSIA are named only to describe where data comes from. Information shown by Sulo can be incomplete or out of date. For anything that matters, such as deadlines, grades or academic rules, the university's own systems and your academic advisor are authoritative.

## License

The source code is released under the [MIT License](LICENSE).

- **Fonts.** The bundled fonts (Inter and Plus Jakarta Sans) are under the SIL Open Font License 1.1. See `assets/fonts/*/OFL.txt`.
- **Brand.** The Sulo name, logo, icons and mascot are not covered by the MIT License. They may not be used for derived products that could be mistaken for Sulo. See [TRADEMARK.md](TRADEMARK.md).

## Acknowledgements

Built with [WXT](https://wxt.dev), [React](https://react.dev), [Tailwind CSS](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com), [Zod](https://zod.dev) and [Vitest](https://vitest.dev). Fonts: [Inter](https://rsms.me/inter/) and [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans).
