# Sulo writing glossary (English)

The English text in `lib/i18n/en.ts` follows the same standard as the Indonesian (`glossary.md`): Sulo's users are students, not programmers.

## Style

- Like a tidy friend: casual, polite, short sentences, everyday words. Address the user as "you".
- One idea per sentence. If five words will do, don't use twelve.
- No technical terms, no exclamation marks, no slang, no emoji.
- Sentence case everywhere. No titles or labels in all caps.
- Problem messages say what happened and what you can do. No apologies, nothing vague.
- A button is named after its result. "Continue" goes to the next step, "Open SIKOLA" opens SIKOLA.
- Numbers as digits ("3 tasks"). Time units written out and plural-aware ("1 hour", "2 hours", "5 minutes"). 24-hour clock ("23:59").
- Keep names as they are: SIKOLA, Unhas, course and task names from SIKOLA are never translated.

## Words

| Avoid | Use |
|---|---|
| sync, synchronization | update, updated |
| Synced 2 mins ago | Updated 2 minutes ago |
| session expired, token invalid | Sign in to SIKOLA again so Sulo can update your tasks |
| parser error, unrecognised response | Sulo can't read SIKOLA properly yet. Try again later |
| daily budget reached, request limit | Sulo has checked often enough today. It will update again tomorrow |
| stale data | Last updated 7 hours ago |
| offline, no network connection | You're offline. Showing your last data |
| toggle, enable, disable | pick, tick, untick |
| Sulo's suggestion, manual pin, score | (never mention to users) |
| class, module (for a course) | course |
| sesskey, request, server, sync | (never mention to users) |
| Unofficial, not affiliated with Unhas | Not an official Unhas app |
| Privacy policy (in the footer) | Privacy |
| remotely disabled | Sulo is taking a short break |

## Unofficial statement

- The full sentence "Sulo is not an official app and is not affiliated with Universitas Hasanuddin" appears in setup step 1 and on the privacy page.
- Footers and other pages use "Not an official Unhas app" with a "Privacy" link.
- The statement appears once per screen, never repeated.
