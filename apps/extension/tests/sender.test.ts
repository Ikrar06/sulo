import { describe, expect, it } from 'vitest';
import { isContentScriptOn, isExtensionPageSender } from '../lib/sender';

const ID = 'abcdefghijklmnopabcdefghijklmnop';
const EXT = `chrome-extension://${ID}`;
const SIKOLA = 'https://sikola-v2.unhas.ac.id';

describe('isExtensionPageSender', () => {
  it('accepts the popup (no tab)', () => {
    expect(isExtensionPageSender({ id: ID, url: `${EXT}/popup.html` }, ID, EXT)).toBe(true);
  });

  it('accepts an extension page opened in a tab, like the recorder', () => {
    expect(isExtensionPageSender({ id: ID, url: `${EXT}/recorder.html`, tab: { id: 7 } }, ID, EXT)).toBe(true);
  });

  it('rejects a content script on SIKOLA', () => {
    expect(isExtensionPageSender({ id: ID, url: `${SIKOLA}/my/`, tab: { id: 7 } }, ID, EXT)).toBe(false);
  });

  it('rejects another extension or a missing url', () => {
    expect(isExtensionPageSender({ id: 'other', url: `${EXT}/popup.html` }, ID, EXT)).toBe(false);
    expect(isExtensionPageSender({ id: ID }, ID, EXT)).toBe(false);
  });
});

describe('isContentScriptOn', () => {
  it('accepts the content script on a SIKOLA page', () => {
    expect(isContentScriptOn({ id: ID, url: `${SIKOLA}/course/view.php?id=1`, tab: { id: 3 } }, ID, SIKOLA)).toBe(true);
  });

  it('rejects other sites, extension pages and senders without a tab', () => {
    expect(isContentScriptOn({ id: ID, url: 'https://example.test/', tab: { id: 3 } }, ID, SIKOLA)).toBe(false);
    expect(isContentScriptOn({ id: ID, url: `${EXT}/recorder.html`, tab: { id: 3 } }, ID, SIKOLA)).toBe(false);
    expect(isContentScriptOn({ id: ID, url: `${SIKOLA}/my/` }, ID, SIKOLA)).toBe(false);
  });
});
