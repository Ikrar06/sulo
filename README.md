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

Planned (see [docs/ROADMAP.md](docs/ROADMAP.md)):

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
- **No telemetry.** No analytics and no third-party requests. The only non-SIKOLA request is a small, optional kill-switch file (data only, fetched at most once a day).
- **Small footprint.** At most 40 requests per day per installation, with a typical target of 5 to 10. Requests run one at a time, never during quiet hours (00.00 to 06.00) or while the computer is idle, and back off for 3 to 24 hours after server errors.
- **Minimal permissions.** `storage`, `alarms`, `notifications`, `idle`, and access to `https://sikola-v2.unhas.ac.id/*` only.

Details: [docs/ATURAN-REQUEST.md](docs/ATURAN-REQUEST.md) and [docs/PRIVASI.md](docs/PRIVASI.md).

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

All requests to SIKOLA leave from the service worker through one client. Pages that need HTML ask the service worker for it and parse it themselves. `lib/moodle` and `lib/radar` never touch browser APIs; storage, clock and fetch are injected so they can be tested in Node. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

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
| `pnpm build` | Production build to `.output/chrome-mv3` |
| `pnpm zip` | Production zip in `.output/` |
| `pnpm test` | Vitest, no browser needed |
| `pnpm typecheck` | `wxt prepare` and `tsc --noEmit` |
| `node scripts/check-leaks.mjs` | Scans the repository for personal or session data |

Load the extension in your own Chrome profile, where you are logged in to SIKOLA:

1. Run `pnpm build` (or `pnpm dev` for the development build).
2. Open `chrome://extensions` and turn on Developer mode.
3. Choose "Load unpacked" and select `.output/chrome-mv3` (or `.output/chrome-mv3-dev`).

Testers follow [docs/PASANG.md](docs/PASANG.md) instead.

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
docs/               architecture, request rules, roadmap, brand, testing
```

## Roadmap

M0 scaffold and M1 request safety are done. Next are the Today view (M2), reminders and session handling (M3), the change radar (M4) and the dashboard (M5). See [docs/ROADMAP.md](docs/ROADMAP.md).

## Documentation

Written in Indonesian.

- [ARCHITECTURE.md](docs/ARCHITECTURE.md): components, data flow, storage, radar
- [ATURAN-REQUEST.md](docs/ATURAN-REQUEST.md): request limits and rules
- [API-MOODLE.md](docs/API-MOODLE.md): Moodle functions verified on SIKOLA
- [ROADMAP.md](docs/ROADMAP.md): milestones and done criteria
- [UI.md](docs/UI.md): popup, dashboard and UI states
- [BRAND.md](docs/BRAND.md): naming, assets, colors, typography, mascot
- [TESTING.md](docs/TESTING.md): test layers and fixture sanitization
- [PRIVASI.md](docs/PRIVASI.md): privacy policy draft
- [PASANG.md](docs/PASANG.md): install guide for testers

## License

[MIT](LICENSE). Bundled fonts are under the SIL Open Font License; see `assets/fonts/*/OFL.txt`.
