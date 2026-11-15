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

The second command enables two git hooks: a scan for personal or session data before every commit, and a check that rejects AI co-author trailers in commit messages.

| Command | What it does |
|---|---|
| `pnpm dev` | Development build with hot reload in a fresh Chrome profile |
| `pnpm build:dev` | Development build in `.output/chrome-mv3-dev`, to load in your own Chrome profile |
| `pnpm build` | Production build in `.output/chrome-mv3` |
| `pnpm test` | Vitest, no browser needed |
| `pnpm typecheck` | `wxt prepare` and `tsc --noEmit` |
| `node scripts/check-leaks.mjs` | Scans the repository for personal or session data |
| `pnpm notify-icons` | Rebuilds the notification icons in `public/notify/` from the static mascots (needs `rsvg-convert`, see below) |

To try the extension, open `chrome://extensions`, turn on Developer mode, choose "Load unpacked" and select the build folder.

`pnpm build` and `pnpm zip:tester` also run `scripts/check-no-dev-code.mjs`, which fails if development-only code (the fixture recorder or the reminder simulator) ends up in the build.

### Notification icons

Notifications cannot use SVG, so `public/notify/*.png` are built from the static mascots with `rsvg-convert` (librsvg) and committed, like the extension icons. Rebuild them only when the mascot changes (`node scripts/build-mascot.mjs`, then `pnpm notify-icons`). Installing `rsvg-convert`:

| System | Command |
|---|---|
| macOS (Homebrew) | `brew install librsvg` |
| Debian, Ubuntu | `sudo apt install librsvg2-bin` |
| Fedora | `sudo dnf install librsvg2-tools` |
| Windows (MSYS2) | `pacman -S mingw-w64-x86_64-librsvg` |
| Windows (Chocolatey) | `choco install rsvg-convert` |

## Project rules

These rules hold for every change, however small.

1. **Read only.** No request may change data in SIKOLA: no submissions, no marking notifications as read, no keeping the session alive.
2. **One gateway.** Every request to SIKOLA goes through `lib/moodle/client.ts`, which enforces the allowlist, the daily budget, the serial queue and backoff. No other code calls `fetch` against SIKOLA.
3. **Never parallel.** Requests to SIKOLA run one at a time.
4. **No background scraping.** HTML is fetched only when the user opens a view that needs it, and is then cached.
5. **No disguise.** No changed user agent, no randomized patterns to avoid detection, no hidden requests.
6. **No credentials.** Never ask for, read or store usernames or passwords.
7. **No data leaves the browser.** No telemetry or analytics. The only non-SIKOLA requests go to the public data repository [Ikrar06/sulo-data](https://github.com/Ikrar06/sulo-data): data only, validated, at most once a day per file, carrying nothing that identifies the user.
8. **Minimal permissions.** Adding a permission needs an issue and the maintainer's approval first.
9. **Zero requests to NEOSIA.** The planned NEOSIA module only reads responses the NEOSIA app itself already requested, is off by default, and discards identity and payment details before anything leaves the page.
10. **Sensitive academic data is hidden by default** and never included in exports.

## Code conventions

- TypeScript strict. Identifiers and comments in English, UI text in Indonesian, collected in `lib/i18n/id.ts`.
- `lib/moodle/` and `lib/radar/` never import browser APIs. Storage, clock and fetch are injected so the code runs in Vitest.
- The service worker keeps no state in module variables. All state lives in storage.
- Every Moodle response is validated with Zod. A validation failure is a parser problem, never empty data.
- Logic never depends on interface text that Moodle translates (`formattedtime`, `activitystr`, `modname`, notification subjects, attendance labels). Identify kinds by codes (`modulename`, `module`, `component`, `eventtype`) and times by timestamps. If an HTML parser must use text, provide English and Indonesian variants with tests, and fall back to `unknown` for other languages.
- Times are stored as Unix seconds (UTC) and converted to local time only for display, through `Intl`. Functions that compute "today" take an injected `Clock`.
- Parsers and diff functions are pure and tested.
- No color values in components. Use the tokens in `assets/tailwind.css`.
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
3. Run `pnpm typecheck`, `pnpm test`, `pnpm build` and `node scripts/check-leaks.mjs` before pushing.
4. Update the README, the changelog and code comments in the same pull request when behavior changes.
5. Fill in the pull request template.

Reviewers check that:

- typecheck, tests, build and the leak scan pass in CI
- no real student data appears anywhere
- the change adds no request to SIKOLA and no permission unless that was agreed in an issue
- pure modules stay pure, and new logic has tests
- user-facing text is clear and in Indonesian
- documentation matches the code

## Data rules

Never include real student data in any form: fixtures, screenshots, logs, issue text or commit messages. This covers names, student numbers (NIM), email addresses, grades, session keys, cookies and tokens, including your own.

Tests use synthetic fixtures only:

- `fixtures/synthetic/` holds hand-written data with the same field names, types and structure as real SIKOLA responses. CI validates every file in it against the schemas.
- Do not add fixtures taken from a real account, not even sanitized ones. If you need a new case, write it by hand in `fixtures/synthetic/`.
- The maintainer keeps sanitized recordings outside git and checks that the synthetic fixtures still match their shape with `pnpm fixtures:compare` (field names and types only). The check is skipped when the recordings are absent.
- Never commit raw responses. `fixtures/raw/` is ignored by git for local use only.

## Request rules

Sulo runs without official permission from the university for now, so its footprint must stay small and explainable. A change that adds requests to SIKOLA, or changes any limit in `lib/moodle/limits.ts`, needs to be discussed in an issue first. The same applies to any new manifest permission.

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
