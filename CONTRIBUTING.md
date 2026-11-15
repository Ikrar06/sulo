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

To try the extension, open `chrome://extensions`, turn on Developer mode, choose "Load unpacked" and select the build folder.

## Code conventions

The project rules live in [CLAUDE.md](CLAUDE.md) and in [docs/](docs/). Technical documents are written in Indonesian. Read at least:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for components and data flow
- [docs/ATURAN-REQUEST.md](docs/ATURAN-REQUEST.md) for request limits
- [docs/TESTING.md](docs/TESTING.md) for tests and fixtures
- [docs/BRAND.md](docs/BRAND.md) for naming, tokens and assets

Rules worth stating here:

- TypeScript strict. Identifiers and comments in English, UI text in Indonesian, collected in `lib/i18n/id.ts`.
- `lib/moodle/` and `lib/radar/` never import browser APIs. Storage, clock and fetch are injected so the code runs in Vitest.
- Every request to SIKOLA goes through `lib/moodle/client.ts`. No other code calls `fetch` against SIKOLA.
- Every Moodle response is validated with Zod. A validation failure is a parser problem, never empty data.
- Logic never depends on translated interface text. Use codes and timestamps.
- Times are stored as Unix seconds (UTC) and converted to local time only for display.
- No color values in components. Use the tokens in `assets/tailwind.css`.
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
4. Update the documents in `docs/` in the same pull request when behavior changes.
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

Fixtures must go through the sanitizer:

- The development build has a fixture recorder that sanitizes before saving.
- For other JSON, use `node scripts/sanitize.ts <in.json> <out.json>`.
- Never commit raw responses. `fixtures/raw/` is ignored by git for local use only.

## Request rules

Sulo runs without official permission from the university for now, so its footprint must stay small and explainable. A change that adds requests to SIKOLA, or changes any number in [docs/ATURAN-REQUEST.md](docs/ATURAN-REQUEST.md), needs to be discussed in an issue first. The same applies to any new manifest permission.

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
