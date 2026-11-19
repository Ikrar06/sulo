// The extension's onboarding words (Tahap 2). The phone's words
// (mobile-onboarding.ts) wherever the meaning is the same; only what differs
// is here: the third intro page (the data stays in the browser, not on a
// phone), connecting through the user's own SIKOLA tab, and opening the
// dashboard at the end. The same budget holds (tested): titles at most 28
// characters, supporting lines at most 60, no paragraphs; the longer "why it
// is safe" lives in a dialog.

import type { Locale } from './index';
import { onboardingWords, type OnboardingWords } from './mobile-onboarding';

const id = {
  /** Sample content of the scenes (synthetic). */
  scene: {
    calendarTitle: 'UTS dimulai besok',
    calendarTag: 'Ujian',
    morningTitle: 'Ringkasan pagi',
    morningBody: '2 tugas hari ini, 1 besok',
    readOnly: 'hanya membaca',
    login: ['Nama pengguna', 'Kata sandi'],
    loginButton: 'Masuk',
    steps: ['Klik Buka SIKOLA', 'Masuk seperti biasa', 'Sulo langsung mengenalinya'],
    /** Two more sample tasks, shown under the phone's four when the stage is tall enough. */
    moreCards: [
      { course: 'Kimia Dasar', title: 'Laporan titrasi', due: '6 hari lagi', tone: 'later' },
      { course: 'Bahasa Inggris', title: 'Esai argumentatif', due: '9 hari lagi', tone: 'later' },
    ],
    krsTitle: 'Pengisian KRS dibuka Senin',
    krsTag: 'KRS',
    lateTitle: 'Laporan praktikum 3',
    connectNotes: ['Sulo tidak pernah melihat password-mu.', 'Sesi SIKOLA tetap di browser ini.'],
  },
  intro3: {
    title: 'Datamu tetap di browser-mu',
    body: 'Tanpa server, tanpa iklan, tanpa pelacakan.',
    badges: ['Tanpa password', 'Hanya membaca', 'Tanpa server', 'Tanpa iklan', 'Tanpa akun Sulo', 'Hapus kapan saja'],
    data: ['Tugas', 'Kalender', 'Presensi'],
  },
  connect: {
    title: 'Hubungkan dengan SIKOLA',
    body: 'Masuk di tab SIKOLA seperti biasa.',
    switchBody: 'Hubungkan akun yang sedang masuk di SIKOLA.',
    open: 'Buka SIKOLA',
    checking: 'Memeriksa SIKOLA',
    waiting: 'Menunggu kamu masuk ke SIKOLA',
    needLogin: 'Masuk dulu di tab SIKOLA.',
  },
  why: 'Kenapa aman?',
  close: 'Tutup',
  privacyLink: 'Baca kebijakan privasi',
  courses: {
    next: (n: number) => (n === 1 ? 'Lanjut dengan 1 mata kuliah' : `Lanjut dengan ${n} mata kuliah`),
    previous: (n: number) => `Semester sebelumnya (${n})`,
    search: 'Cari mata kuliah',
  },
  done: {
    body: 'Tugas dan pengingatmu sudah siap.',
    courses: (n: number) => `${n} mata kuliah`,
  },
};

type ExtWords = typeof id;

const en: ExtWords = {
  scene: {
    calendarTitle: 'Midterms start tomorrow',
    calendarTag: 'Exam',
    morningTitle: 'Morning summary',
    morningBody: '2 tasks today, 1 tomorrow',
    readOnly: 'read only',
    login: ['Username', 'Password'],
    loginButton: 'Sign in',
    steps: ['Click Open SIKOLA', 'Sign in as usual', 'Sulo recognises it at once'],
    moreCards: [
      { course: 'Basic Chemistry', title: 'Titration report', due: 'in 6 days', tone: 'later' },
      { course: 'English', title: 'Argumentative essay', due: 'in 9 days', tone: 'later' },
    ],
    krsTitle: 'Course registration opens Monday',
    krsTag: 'KRS',
    lateTitle: 'Lab report 3',
    connectNotes: ['Sulo never sees your password.', 'Your SIKOLA session stays in this browser.'],
  },
  intro3: {
    title: 'Data stays in your browser',
    body: 'No server, no ads, no tracking.',
    badges: ['No password', 'Read only', 'No server', 'No ads', 'No Sulo account', 'Delete any time'],
    data: ['Tasks', 'Calendar', 'Attendance'],
  },
  connect: {
    title: 'Connect to SIKOLA',
    body: 'Sign in on the SIKOLA tab as usual.',
    switchBody: 'Connect the account signed in on SIKOLA.',
    open: 'Open SIKOLA',
    checking: 'Checking SIKOLA',
    waiting: 'Waiting for you to sign in to SIKOLA',
    needLogin: 'Sign in on the SIKOLA tab first.',
  },
  why: 'Why is it safe?',
  close: 'Close',
  privacyLink: 'Read the privacy policy',
  courses: {
    next: (n: number) => (n === 1 ? 'Continue with 1 course' : `Continue with ${n} courses`),
    previous: (n: number) => `Previous semesters (${n})`,
    search: 'Search courses',
  },
  done: {
    body: 'Your tasks and reminders are ready.',
    courses: (n: number) => `${n} ${n === 1 ? 'course' : 'courses'}`,
  },
};

export interface ExtOnboardingWords {
  /** The phone's words, for everything that means the same. */
  phone: OnboardingWords;
  ext: ExtWords;
}

export const extOnboardingWords = (locale: Locale): ExtOnboardingWords => ({ phone: onboardingWords(locale), ext: locale === 'en' ? en : id });

/** Every title and supporting line the extension's onboarding shows, for the budget test. */
export function extBudgetedTexts({ phone, ext }: ExtOnboardingWords): { titles: string[]; supports: string[] } {
  return {
    titles: [phone.intro1.title, phone.intro2.title, ext.intro3.title, ext.connect.title, phone.preparing.title, phone.courses.title, phone.done.title],
    supports: [phone.intro1.body, phone.intro2.body, ext.intro3.body, ext.connect.body, ext.connect.switchBody, ext.connect.checking, ext.connect.waiting, ext.connect.needLogin, ...Object.values(phone.preparing.stages), phone.preparing.failedTitle, phone.courses.body, ext.done.body],
  };
}
