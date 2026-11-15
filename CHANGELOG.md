# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Browser extension for Chrome and Edge (Manifest V3) with a temporary popup that tests the connection to SIKOLA using the session already in the browser. No password is needed.
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
