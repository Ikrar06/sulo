import { afterEach, describe, expect, it } from 'vitest';
import { MOBILE_FAQ, mobileFaq, searchFaq } from '@sulo/core/help/mobile';
import { mobileWords } from '@sulo/core/i18n/mobile';
import { budgetedTexts, onboardingWords, SUPPORT_MAX, TITLE_MAX } from '@sulo/core/i18n/mobile-onboarding';
import { mobileOs, setMobileOs } from '@sulo/core/i18n/os';
import { sipakamaseWords } from '@sulo/core/i18n/sipakamase';
import { SIPAKAMASE_CONSENT, SIPAKAMASE_CONSENT_IPHONE, type Block, type Section } from '@sulo/core/privacy/content';
import { IPHONE_PRIVACY_SECTIONS, mobilePrivacy, sipakamaseConsent } from '@sulo/core/privacy/iphone';
import { MOBILE_PRIVACY_SECTIONS, MOBILE_PRIVACY_TITLE } from '@sulo/core/privacy/mobile';
import { renderPublicPrivacyHtml } from '@sulo/core/privacy/render';

// What the iPhone must never say about itself: Android's names and settings (owner's decision B3).
const ANDROID_WORDS = /Android|Keystore|APK|Play Store|Play Protect|baterai|battery|WebView|sidik jari|fingerprint/i;

const blockTexts = (b: Block) => (b.kind === 'p' ? [b.text] : b.items);
const sectionTexts = (sections: readonly Section[]) => sections.flatMap((s) => [s.heading, ...s.blocks.flatMap(blockTexts)]);

afterEach(() => setMobileOs('android'));

describe('the phone OS switch', () => {
  it('is Android until the app says otherwise, so the extension and Android keep their words', () => {
    expect(mobileOs()).toBe('android');
    expect(mobileFaq()).toBe(MOBILE_FAQ);
    expect(mobilePrivacy().sections).toBe(MOBILE_PRIVACY_SECTIONS);
    expect(mobilePrivacy().title).toBe(MOBILE_PRIVACY_TITLE);
    expect(sipakamaseConsent()).toBe(SIPAKAMASE_CONSENT);
    expect(mobileWords('id').watch.title).toBe('Pantau tugas baru');
    expect(onboardingWords('id').reminders.watchBody).toBe('Sulo mengecek SIKOLA berkala di latar belakang.');
    expect(sipakamaseWords('id').state.live).toBe('Terhubung dan dijaga.');
  });
});

describe('iPhone help', () => {
  it('hides the Android-only answers, adds the weekly refresh, and names nothing of Android', () => {
    setMobileOs('ios');
    const ids = mobileFaq().map((e) => e.id);
    for (const gone of ['baterai-hp', 'webview-hp', 'pemantauan-dijeda-hp', 'masuk-lagi-pemantauan-hp']) expect(ids).not.toContain(gone);
    expect(ids).toEqual(expect.arrayContaining(['segarkan-7-hari', 'tidak-bisa-dibuka-iphone', 'aman-hp', 'masuk-lagi-hp']));
    for (const e of mobileFaq()) {
      for (const t of [e.q, ...e.a]) {
        expect(t.id, e.id).not.toMatch(ANDROID_WORDS);
        expect(t.en, e.id).not.toMatch(ANDROID_WORDS);
      }
    }
  });
  it('lists every iPhone entry in a group, the iPhone questions under About Sulo', () => {
    setMobileOs('ios');
    const listed = searchFaq('', 'id').flatMap((g) => g.entries.map((e) => e.id));
    expect([...listed].sort()).toEqual(mobileFaq().map((e) => e.id).sort());
    expect(searchFaq('', 'id').find((g) => g.id === 'tentang')?.entries.map((e) => e.id)).toEqual(['segarkan-7-hari', 'tidak-bisa-dibuka-iphone', 'resmi']);
    expect(searchFaq('sideloadly', 'en').flatMap((g) => g.entries.map((e) => e.id))).toContain('segarkan-7-hari');
  });
});

describe('iPhone privacy', () => {
  it('names nothing of Android, and says where the iPhone differs', () => {
    setMobileOs('ios');
    const p = mobilePrivacy();
    expect(p.title.en).toBe('Privacy in the iPhone app');
    const texts = [p.title, ...p.intro.flatMap(blockTexts), ...p.summary.flatMap((s) => [s.title, s.body]), ...sectionTexts(p.sections)];
    for (const t of texts) {
      expect(t.id).not.toMatch(ANDROID_WORDS);
      expect(t.en).not.toMatch(ANDROID_WORDS);
    }
    const all = texts.map((t) => t.en).join(' ');
    expect(all).toContain('Keychain');
    expect(all).toContain('excluded from iCloud and computer backups');
    expect(all).toContain('lets no app block screenshots');
    expect(all).toContain('Sideloadly');
    expect(all).toContain('use Sign out and delete data before deleting the app');
  });
  it('shares the Android sections it reuses word for word', () => {
    const android = sectionTexts(MOBILE_PRIVACY_SECTIONS);
    const shared = sectionTexts(IPHONE_PRIVACY_SECTIONS).filter((t) => android.includes(t));
    expect(shared.length).toBeGreaterThan(10);
    expect(shared.map((t) => t.en)).toContain('Nothing on SIKOLA or NEOSIA changes.');
  });
  it('keeps the servers card first-class: the same heading the screen looks for', () => {
    setMobileOs('ios');
    const p = mobilePrivacy();
    expect(p.sections.some((s) => s.heading.en === p.serversHeading)).toBe(true);
  });
  it('the public page has the iPhone part', () => {
    const html = renderPublicPrivacyHtml('id');
    expect(html).toContain('<h2 id="iphone">Aplikasi iPhone</h2>');
    expect(html).toContain('href="#iphone"');
  });
});

describe('iPhone Sipakamase and onboarding words', () => {
  it('the consent promises nothing about the session on the iPhone', () => {
    setMobileOs('ios');
    expect(sipakamaseConsent()).toBe(SIPAKAMASE_CONSENT_IPHONE);
    expect(SIPAKAMASE_CONSENT_IPHONE.kept[0]?.id).toContain('iPhone tidak menjamin waktunya');
    expect(SIPAKAMASE_CONSENT_IPHONE.kept.slice(1)).toEqual(SIPAKAMASE_CONSENT.kept.slice(1));
    expect(sipakamaseWords('id').state.live).toBe('Terhubung, diperbarui saat Sulo dibuka.');
  });
  it('the onboarding switch keeps the session, within the text budget', () => {
    setMobileOs('ios');
    for (const locale of ['id', 'en'] as const) {
      const w = onboardingWords(locale);
      expect(w.reminders.watchTitle.length).toBeLessThanOrEqual(TITLE_MAX);
      expect(w.reminders.watchBody.length).toBeLessThanOrEqual(SUPPORT_MAX);
      const { titles, supports } = budgetedTexts(w);
      for (const t of titles) expect(t.length, t).toBeLessThanOrEqual(TITLE_MAX);
      for (const t of supports) expect(t.length, t).toBeLessThanOrEqual(SUPPORT_MAX);
      expect(w.sheets.watch).not.toMatch(ANDROID_WORDS);
    }
    expect(onboardingWords('id').reminders.watchTitle).toBe('Jaga sesi SIKOLA');
    expect(mobileWords('en').watch.title).toBe('Keep the SIKOLA session');
  });
});
