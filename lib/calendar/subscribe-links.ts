// One-click subscription links for the public feeds. Each is a plain link
// opened in a new tab by the user's click; the extension fetches nothing.
// Google and Outlook show their own confirmation before adding anything.

/** https://… -> webcal://… (calendar apps treat webcal as a subscription). */
export function toWebcal(httpsUrl: string): string {
  return httpsUrl.replace(/^https:\/\//i, 'webcal://');
}

/** Google Calendar (web): "Add calendar" dialog for the feed. */
export function googleSubscribeUrl(feedUrl: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(toWebcal(feedUrl))}`;
}

/** Outlook on the web: "Subscribe from web" with a name. */
export function outlookSubscribeUrl(feedUrl: string, name: string): string {
  return `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(toWebcal(feedUrl))}&name=${encodeURIComponent(name)}`;
}

/** Apple Calendar and other apps open webcal:// themselves. */
export function appleUrl(feedUrl: string): string {
  return toWebcal(feedUrl);
}
