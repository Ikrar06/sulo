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
    steps: ['Klik Buka SIKOLA', 'Masuk seperti biasa', 'Sulo langsung mengenalinya'],
    /** Intro 2's second banner: an academic calendar event. */
    calendarTitle: 'UTS mulai besok',
    calendarTag: 'Ujian',
    /** A fifth sample task: the one that rises into the stack after the top card is done (four shown at 1440x900). */
    moreCards: [{ course: 'Kimia Dasar', title: 'Laporan titrasi', due: '6 hari lagi', tone: 'later' }],
  },
  intro3: {
    title: 'Datamu tetap di browsermu',
    body: 'Tanpa server, tanpa iklan, tanpa pelacakan.',
    badges: ['Tanpa password', 'Hanya membaca', 'Tanpa server'],
    data: ['Tugas', 'Kalender', 'Presensi'],
  },
  /** "Kenapa aman?": four points, each with its icon. */
  whyPoints: {
    browser: 'Datamu tersimpan di browser ini.',
    password: 'Tidak butuh password. Sulo memakai sesi SIKOLA yang sudah terbuka.',
    read: 'Sulo hanya membaca. Tidak pernah mengubah apa pun di SIKOLA.',
    server: 'Tanpa server Sulo, iklan, atau pelacakan. Bisa dihapus kapan saja.',
  },
  connect: {
    title: 'Hubungkan dengan SIKOLA',
    body: 'Masuk di tab SIKOLA seperti biasa.',
    switchBody: 'Hubungkan akun yang sedang masuk di SIKOLA.',
    open: 'Buka SIKOLA',
    checking: 'Mengecek SIKOLA',
    waiting: 'Menunggu kamu masuk ke SIKOLA',
    needLogin: 'Belum masuk. Buka SIKOLA untuk masuk.',
    connected: 'Terhubung',
  },
  preparing: {
    connected: 'Terhubung ke SIKOLA',
    rows: { tasks: 'Tugas', courses: 'Mata kuliah', attendance: 'Presensi', attendanceDone: 'Presensi siap' },
  },
  why: 'Kenapa aman?',
  close: 'Tutup',
  privacyLink: 'Baca kebijakan privasi',
  courses: {
    next: 'Lanjut',
    previous: (n: number) => `Semester sebelumnya (${n})`,
    search: 'Cari mata kuliah',
  },
  done: {
    body: 'Tugas dan pengingatmu sudah siap.',
    courses: (n: number) => `${n} mata kuliah`,
    noTasks: 'Belum ada tugas. Sulo akan memberi tahu saat ada.',
  },
};

type ExtWords = typeof id;

const en: ExtWords = {
  scene: {
    steps: ['Click Open SIKOLA', 'Log in as usual', 'Sulo recognizes it at once'],
    calendarTitle: 'Midterms start tomorrow',
    calendarTag: 'Exam',
    moreCards: [{ course: 'Basic Chemistry', title: 'Titration report', due: 'in 6 days', tone: 'later' }],
  },
  intro3: {
    title: 'Data stays in your browser',
    body: 'No server, no ads, no tracking.',
    badges: ['No password', 'Read only', 'No server'],
    data: ['Tasks', 'Calendar', 'Attendance'],
  },
  whyPoints: {
    browser: 'Your data stays in this browser.',
    password: 'No password needed. Sulo uses your open SIKOLA session.',
    read: 'Sulo only reads. It never changes anything on SIKOLA.',
    server: 'No Sulo server, ads, or tracking. Delete anytime.',
  },
  connect: {
    title: 'Connect to SIKOLA',
    body: 'Sign in on the SIKOLA tab as usual.',
    switchBody: 'Connect the account signed in on SIKOLA.',
    open: 'Open SIKOLA',
    checking: 'Checking SIKOLA',
    waiting: 'Waiting for you to sign in to SIKOLA',
    needLogin: 'Not signed in. Open SIKOLA to sign in.',
    connected: 'Connected',
  },
  preparing: {
    connected: 'Connected to SIKOLA',
    rows: { tasks: 'Tasks', courses: 'Courses', attendance: 'Attendance', attendanceDone: 'Attendance ready' },
  },
  why: 'Why is this safe?',
  close: 'Close',
  privacyLink: 'Read the privacy policy',
  courses: {
    next: 'Continue',
    previous: (n: number) => `Previous semesters (${n})`,
    search: 'Search courses',
  },
  done: {
    body: 'Your tasks and reminders are ready.',
    courses: (n: number) => `${n} ${n === 1 ? 'course' : 'courses'}`,
    noTasks: "No tasks yet. Sulo will tell you when there's one.",
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
    supports: [phone.intro1.body, phone.intro2.body, ext.intro3.body, ext.connect.body, ext.connect.switchBody, ext.connect.checking, ext.connect.waiting, ext.connect.needLogin, ext.connect.connected, ext.done.noTasks, phone.courses.none, phone.courses.selected(11), ...Object.values(phone.preparing.stages), phone.preparing.failedTitle, phone.courses.body, ext.done.body],
  };
}
