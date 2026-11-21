# Contributing to Sulo

Thank you for your interest in Sulo. This document explains how to set up the project, what a good change looks like, and which changes cannot be accepted.

Sulo is currently maintained by one person in their spare time, so replies to issues and pull requests may take a while. Opening an issue to discuss an idea before writing code saves everyone time.

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Setting up

Prerequisites: Node.js 24 or newer and pnpm 10 (the exact version is pinned in `package.json`).

```sh
pnpm install --frozen-lockfile
git config core.hooksPath .githooks
```

The second command enables the repository's git hooks: a scan for personal or session data before every commit, and a check of the commit message.

| Command | What it does |
|---|---|
| `pnpm dev` | Development build with hot reload in a fresh Chrome profile |
| `pnpm build:dev` | Development build in `.output/chrome-mv3-dev`, to load in your own Chrome profile |
| `pnpm build` | Production build in `.output/chrome-mv3` |
| `pnpm test` | Unit tests of the extension, the shared logic and the Android app (Vitest, no browser needed) |
| `pnpm typecheck` | TypeScript, strict, for every package (`packages/core` is checked without DOM types) |
| `pnpm lint` | UI rules, the core's no-platform rule and the personal-data scan |
| `pnpm check-leaks` | Scans the repository for personal or session data |
| `pnpm mobile:web` | The Android app's interface in a desktop browser, with a synthetic demo account |
| `pnpm mobile:apk:debug` | A debug APK (needs JDK 21 and the Android SDK; `pnpm mobile:doctor` says what is missing) |
| `pnpm notify-icons` | Rebuilds the notification icons in `apps/extension/public/notify/` from the static mascots (needs `rsvg-convert`, see below) |

`pnpm mobile:doctor` writes its hints for macOS with Homebrew. On other systems install JDK 21 and the Android SDK command-line tools, then `platforms;android-36` and `build-tools;36.0.0`, and set `ANDROID_HOME`.

To try the extension, open `chrome://extensions`, turn on Developer mode, choose "Load unpacked" and select the build folder.

`pnpm build` and `pnpm zip:tester` also run `apps/extension/scripts/check-no-dev-code.mjs`, which fails if development-only code (the fixture recorder or the reminder simulator) ends up in the build.

### Notification icons

Notifications cannot use SVG, so `apps/extension/public/notify/*.png` are built from the static mascots with `rsvg-convert` (librsvg) and committed, like the extension icons. Rebuild them only when the mascot changes (`node apps/extension/scripts/build-mascot.mjs`, then `pnpm notify-icons`). Installing `rsvg-convert`:

| System | Command |
|---|---|
| macOS (Homebrew) | `brew install librsvg` |
| Debian, Ubuntu | `sudo apt install librsvg2-bin` |
| Fedora | `sudo dnf install librsvg2-tools` |
| Windows (MSYS2) | `pacman -S mingw-w64-x86_64-librsvg` |
| Windows (Chocolatey) | `choco install rsvg-convert` |

## Project rules

These rules hold for every change, however small.

1. **Read only.** No request may change data in SIKOLA: no submissions and no marking notifications as read. The extension never keeps the session alive. In the background the Android app does so only while the user has turned on "Pantau tugas baru" (background watching), and says so where it is turned on; an update the user starts counts as the user's own activity.
2. **One gateway.** Every request to SIKOLA goes through `packages/core/src/moodle/client.ts`, which enforces the allowlist, the daily budget, the serial queue and backoff. No other TypeScript code calls `fetch` against SIKOLA. The one native path is the Android watch worker (`WatchWorker.kt`), which only follows a plan written by `packages/core/src/watch/plan.ts`: the same calls, budget and backoff.
3. **Never parallel.** Requests to SIKOLA run one at a time.
4. **No background scraping.** HTML is fetched only when the user opens a view that needs it, and is then cached. The one exception is the attendance recap: one page, at most once a day, as part of an update, and never in the phone's background checks.
5. **No disguise.** Requests never pretend to be something else: no borrowed user agent, no randomized patterns to avoid detection, no hidden requests. The Android app's user agent names Sulo and its version.
6. **No credentials.** Never ask for, read or store usernames or passwords.
7. **No data leaves the device.** No telemetry or analytics. The only non-SIKOLA requests go to the public data repository [Ikrar06/sulo-data](https://github.com/Ikrar06/sulo-data): data only, validated, at most once a day per file (the Android app also re-reads them when it is opened and the last read is over 6 hours old, and its background watching re-reads the settings file every 6 hours), carrying nothing that identifies the user.
8. **Minimal permissions.** Adding a permission needs an issue and the maintainer's approval first.
9. **Zero requests to NEOSIA.** The optional NEOSIA module only reads responses the NEOSIA app itself already requested, is off by default, and discards identity and payment details before anything leaves the page.
10. **Sensitive academic data is hidden by default** and never included in exports.

## Code conventions

- TypeScript strict. Identifiers and comments in English. UI text in Indonesian and English, both in `packages/core/src/i18n/` (never a string written in a component).
- `packages/core` never imports browser APIs, WXT or the DOM (`pnpm lint` and its `tsconfig.json` enforce it). Storage, clock, fetch, alarms and notifications come in through the adaptors in `packages/core/src/platform`, so the same code runs in Vitest, in the extension and in the Android app.
- The service worker keeps no state in module variables. All state lives in storage.
- Every Moodle response is validated with Zod. A validation failure is a parser problem, never empty data.
- Logic never depends on interface text that Moodle translates (`formattedtime`, `activitystr`, `modname`, notification subjects, attendance labels). Identify kinds by codes (`modulename`, `module`, `component`, `eventtype`) and times by timestamps. If an HTML parser must use text, provide English and Indonesian variants with tests, and fall back to `unknown` for other languages.
- Times are stored as Unix seconds (UTC) and converted to local time only for display, through `Intl`. Functions that compute "today" take an injected `Clock`.
- Parsers and diff functions are pure and tested.
- No color values in components. Use the tokens in `apps/extension/assets/tokens.css` (the phone: `apps/mobile/src/tokens.css`).
- The product is "Sulo". SIKOLA and NEOSIA are named only as data sources.
- Ask before adding a dependency, and say why and how large it is.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>

<optional body explaining why>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

## Pull requests

1. Open an issue first for anything larger than a small fix.
2. Keep each pull request focused on one change.
3. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` before pushing.
4. Update the README, the changelog and code comments in the same pull request when behavior changes.
5. Fill in the pull request template.

Reviewers check that:

- typecheck, tests, build and the leak scan pass in CI
- no real student data appears anywhere
- the change adds no request to SIKOLA and no permission unless that was agreed in an issue
- pure modules stay pure, and new logic has tests
- user-facing text is clear, and present in both Indonesian and English
- documentation matches the code

## Data rules

Never include real student data in any form: fixtures, screenshots, logs, issue text or commit messages. This covers names, student numbers (NIM), email addresses, grades, session keys, cookies and tokens, including your own.

Tests use synthetic fixtures only:

- `apps/extension/fixtures/synthetic/` holds data made up by hand, with the same field names, types and structure as real SIKOLA responses. CI validates every JSON file in it against the schemas.
- Do not add fixtures taken from a real account. If you need a new case, write it by hand in that folder. The one exception already there is the maintainer's three attendance pages, which keep SIKOLA's real page structure with every name, id and remark replaced; do not add more of that kind.
- The maintainer keeps sanitized recordings outside git and checks that the synthetic fixtures still match their shape with `pnpm fixtures:compare` (field names and types only). The check is skipped when the recordings are absent.
- Never commit raw responses. `fixtures/raw/` is ignored by git for local use only.
- Screenshots follow the same rule: take them from the synthetic demo account (`pnpm shots:audit`, `pnpm store:shots`), never from a real one.

## Request rules

Sulo runs without official permission from the university for now, so its footprint must stay small and explainable. A change that adds requests to SIKOLA, or changes any limit in `packages/core/src/moodle/limits.ts`, needs to be discussed in an issue first. The same applies to any new manifest permission.

## Changes that will not be accepted

- Automation of academic tasks: filling in course registration (KRS), surveys or attendance, or auto-submitting work.
- Watching class quotas to grab seats.
- Reading quiz content or other students' data.
- Reading, decrypting or reusing authentication tokens.
- Bypassing restrictions in university systems.
- Sending any data to a server, including analytics and telemetry.
- Changing the user agent or otherwise disguising requests.

## Reporting security issues

Please do not open public issues for security problems. See [SECURITY.md](SECURITY.md).
