// Words for the Android app (M8b), Indonesian and English. Plain words
// (lib/i18n/glossary.md). Grades never appear here.

import type { Locale } from './index';
import { dashFor, type DashMessages } from './dashboard';

/** A greeting phrase: casual ones only when nothing is overdue or due today; small ones are set at 22 to fit one line. */
export interface GreetPhrase {
  text: string;
  casual?: boolean;
  small?: boolean;
}
type GreetPhrases = Record<'pagi' | 'siang' | 'sore' | 'malam' | 'tengahMalam', GreetPhrase[]>;

const id = {
  unofficial: 'Tidak resmi dan tidak berafiliasi dengan Universitas Hasanuddin.',
  onboarding: {
    title: 'Sulo',
    lead: 'Tugas dan tenggat dari SIKOLA, dengan pengingat di HP-mu.',
    privacyTitle: 'Privasimu',
    privacy: [
      'Kamu masuk di halaman SIKOLA sendiri. Sulo tidak pernah melihat password-mu.',
      'Sesi login disimpan terenkripsi di HP ini dan tidak pernah dikirim ke mana pun.',
      'Tanpa iklan, tanpa pelacakan, tanpa server Sulo.',
    ],
    signIn: 'Masuk ke SIKOLA',
    cancelled: 'Belum masuk. Coba lagi kapan saja.',
  },
  connected: {
    title: 'Terhubung ke SIKOLA',
    expiredTitle: 'Sesi SIKOLA habis',
    expiredLine: 'Masuk lagi ke SIKOLA untuk memperbarui.',
    signInAgain: 'Masuk lagi',
    updated: (when: string) => `Diperbarui ${when}`,
    never: 'Belum pernah diperbarui',
    refresh: 'Perbarui',
    refreshing: 'Memperbarui...',
    upToDate: 'Sudah terbaru.',
    failed: 'Belum bisa memperbarui. Coba lagi nanti.',
    offline: 'Tidak ada koneksi.',
    signOut: 'Keluar',
    signOutTitle: 'Keluar dari Sulo?',
    signOutBody: 'Sesi SIKOLA dan semua data Sulo di HP ini dihapus. Data di SIKOLA tidak tersentuh.',
    cancel: 'Batal',
    lock: 'Kunci aplikasi',
    lockHelp: 'Minta sidik jari atau kunci layar HP saat membuka Sulo.',
    lockUnavailable: 'Pasang kunci layar di HP dulu untuk memakai ini.',
  },
  lock: {
    title: 'Sulo terkunci',
    open: 'Buka',
    noDeviceLock: 'Kunci layar HP sedang mati. Pasang kunci layar lagi untuk membuka Sulo, atau keluar untuk menghapus data Sulo di HP ini.',
    signOut: 'Keluar',
  },
  app: {
    tabsLabel: 'Navigasi utama',
    lainnya: 'Lainnya',
    privasi: 'Privasi',
    back: 'Kembali',
    overdue: (n: number) => (n === 1 ? '1 tugas terlambat' : `${n} tugas terlambat`),
    offline: 'Tidak ada koneksi',
    cooldown: 'Baru saja diperbarui. Coba lagi sebentar lagi.',
    pull: 'Tarik untuk memperbarui',
    release: 'Lepas untuk memperbarui',
    taskTitle: 'Rincian tugas',
    presensiCourse: 'Rincian presensi',
    nearest: 'Tugas terdekat',
    allTasks: 'Semua tugas',
    statOverdue: 'Terlambat',
    statWeek: 'Minggu ini',
    statDaysTo: (label: string) => `Hari ke ${label}`,
    weekShort: (n: number, total: number) => `Minggu ${n}/${total}`,
    /** "UAS 12 hari lagi": text before the number, the number, text after. */
    inDays: (label: string, n: number): [string, string, string] => [`${label} `, String(n), ' hari lagi'],
    attendance: 'Presensi',
    academic: 'Akademik',
    /** Short calendar labels for a running sentence ("Hari ke UAS"). */
    shortKategori: { uas: 'UAS', uts: 'UTS', krs: 'KRS', kkn: 'KKN', wisuda: 'wisuda', libur: 'libur' } as Record<string, string>,
    /** The one line under the greeting. */
    mood: {
      late: (n: number) => `${n} tugas terlambat`,
      soon: (n: number) => (n === 1 ? '1 tenggat dalam 24 jam' : `${n} tenggat dalam 24 jam`),
      calmToday: 'Semua aman hari ini',
      calmWeek: 'Tidak ada tenggat minggu ini',
      asleep: 'Data terakhir dari SIKOLA',
    },
    daysLeft: (n: number) => (n === 1 ? '1 hari lagi' : `${n} hari lagi`),
    noUpcoming: 'Tidak ada tugas mendatang.',
    doneSheet: 'Selesai',
    send: 'Kirim',
    all: 'Semua',
    search: 'Cari',
    closeSearch: 'Tutup pencarian',
    snoozeMenu: 'Tunda pengingat',
    steps: 'Langkah',
    average: 'rata-rata',
    open: 'Buka',
    seeAll: 'Lihat semua',
    next: 'Berikutnya',
    load14: 'Beban 14 hari',
    /** The greeting's second line when there is no nickname. */
    greetLine2: 'begini harimu.',
    heroLate: 'Terlambat',
    noneSoon: 'Tidak ada tugas yang menunggu.',
    lowest: 'Terendah',
    pending: 'Belum selesai',
    done: 'Selesai',
    sessions: (n: number, got: number | null, max: number | null) => (got !== null && max !== null ? `${n} sesi · ${got}/${max} poin` : `${n} sesi`),
  },
  notify: {
    title: 'Izinkan pengingat?',
    body: 'Sulo mengingatkan tenggat tugas dan tanggal penting kalender akademik lewat notifikasi di HP ini. Jadwalnya dibuat di HP, tidak ada yang dikirim keluar.',
    allow: 'Izinkan',
    later: 'Nanti',
    denied: 'Notifikasi mati. Nyalakan lewat Pengaturan HP, bagian Aplikasi, Sulo, Notifikasi.',
  },
  settings: {
    language: 'Bahasa',
    languageNote: 'Mengikuti bahasa HP.',
    bugHelp: 'Kalau ada yang tidak beres, salin info ini lalu tempel di formulir masukan. Isinya versi aplikasi dan catatan teknis pemeriksaan terakhir, tanpa nama, NIM, sesi, atau isi tugas.',
    copied: 'Info disalin.',
    signOutDelete: 'Keluar dan hapus data',
    nicknameHelp: 'Opsional, maksimal 24 karakter. Hanya untuk menyapamu di Ringkasan, disimpan di HP ini.',
    privacyOn: 'Mode privasi',
    privacyHelp: 'Menyamarkan nama, nilai, dan persentase presensi di layar.',
  },
  about: {
    apkVersion: (v: string) => `Versi APK ${v}`,
  },
  /** Ringkasan's greeting (core dashboard/mobile-greeting.ts). [s] marks a casual line, only when nothing is overdue or due today. */
  greet: {
    line1: { pagi: 'Selamat pagi,', siang: 'Selamat siang,', sore: 'Selamat sore,', malam: 'Selamat malam,', tengahMalam: 'Selamat malam,' },
    phrases: <GreetPhrases>{
      pagi: [{ text: 'semangat hari ini!' }, { text: 'yuk, mulai harimu.' }, { text: 'semoga harimu lancar.', small: true }],
      siang: [{ text: 'jangan lupa makan.' }, { text: 'masih semangat, kan?', small: true }, { text: 'pelan-pelan saja.', casual: true }],
      sore: [{ text: 'sedikit lagi, ya.' }, { text: 'yuk, tuntaskan.' }, { text: 'hampir sampai.' }],
      malam: [{ text: 'siap untuk besok?' }, { text: 'waktunya istirahat.', casual: true }, { text: 'hari ini cukup, kok.', casual: true }],
      tengahMalam: [{ text: 'belum tidur, nih?' }, { text: 'jangan begadang, ya.', small: true }],
    },
    state: {
      expired: 'Masuk lagi untuk memperbarui',
      overdue: (n: number) => [String(n), ' tugas terlambat'] as [string, string],
      today: (n: number) => `${n} tenggat hari ini`,
      tomorrow: (n: number) => `${n} tenggat besok`,
      clear: 'Semua aman hari ini',
    },
  },
  dev: {
    title: 'Umur sesi (build debug)',
    remaining: 'Sisa sesi menurut SIKOLA',
    seconds: (n: number) => `${n} detik`,
    none: 'Belum ada catatan.',
    back: 'Kembali',
  },
};

export type MobileWords = typeof id;

const en: MobileWords = {
  unofficial: 'Unofficial and not affiliated with Universitas Hasanuddin.',
  onboarding: {
    title: 'Sulo',
    lead: 'Tasks and deadlines from SIKOLA, with reminders on your phone.',
    privacyTitle: 'Your privacy',
    privacy: [
      "You sign in on SIKOLA's own page. Sulo never sees your password.",
      'The sign-in session is stored encrypted on this phone and never sent anywhere.',
      'No ads, no tracking, no Sulo server.',
    ],
    signIn: 'Sign in to SIKOLA',
    cancelled: 'Not signed in. Try again any time.',
  },
  connected: {
    title: 'Connected to SIKOLA',
    expiredTitle: 'SIKOLA session ended',
    expiredLine: 'Sign in to SIKOLA again to update.',
    signInAgain: 'Sign in again',
    updated: (when: string) => `Updated ${when}`,
    never: 'Not updated yet',
    refresh: 'Update',
    refreshing: 'Updating...',
    upToDate: 'Already up to date.',
    failed: "Couldn't update. Try again later.",
    offline: 'No connection.',
    signOut: 'Sign out',
    signOutTitle: 'Sign out of Sulo?',
    signOutBody: "The SIKOLA session and all of Sulo's data on this phone are deleted. Nothing on SIKOLA changes.",
    cancel: 'Cancel',
    lock: 'App lock',
    lockHelp: "Ask for your fingerprint or the phone's screen lock when Sulo opens.",
    lockUnavailable: 'Set a screen lock on the phone first.',
  },
  lock: {
    title: 'Sulo is locked',
    open: 'Open',
    noDeviceLock: "The phone's screen lock is off. Turn it back on to open Sulo, or sign out to delete Sulo's data on this phone.",
    signOut: 'Sign out',
  },
  app: {
    tabsLabel: 'Main navigation',
    lainnya: 'More',
    privasi: 'Privacy',
    back: 'Back',
    overdue: (n: number) => (n === 1 ? '1 overdue task' : `${n} overdue tasks`),
    offline: 'No connection',
    cooldown: 'Just updated. Try again in a moment.',
    pull: 'Pull to update',
    release: 'Release to update',
    taskTitle: 'Task details',
    presensiCourse: 'Attendance details',
    nearest: 'Coming up',
    allTasks: 'All tasks',
    statOverdue: 'Overdue',
    statWeek: 'This week',
    statDaysTo: (label: string) => `Days to ${label}`,
    weekShort: (n: number, total: number) => `Week ${n}/${total}`,
    inDays: (label: string, n: number): [string, string, string] => [`${label} in `, String(n), n === 1 ? ' day' : ' days'],
    attendance: 'Attendance',
    academic: 'Academic',
    shortKategori: { uas: 'finals', uts: 'midterms', krs: 'KRS', kkn: 'KKN', wisuda: 'graduation', libur: 'the break' },
    mood: {
      late: (n: number) => (n === 1 ? '1 overdue task' : `${n} overdue tasks`),
      soon: (n: number) => (n === 1 ? '1 deadline within 24 hours' : `${n} deadlines within 24 hours`),
      calmToday: 'All clear today',
      calmWeek: 'No deadlines this week',
      asleep: 'The latest data from SIKOLA',
    },
    daysLeft: (n: number) => (n === 1 ? '1 day left' : `${n} days left`),
    noUpcoming: 'No upcoming tasks.',
    doneSheet: 'Done',
    send: 'Send',
    all: 'All',
    search: 'Search',
    closeSearch: 'Close search',
    snoozeMenu: 'Snooze reminders',
    steps: 'Steps',
    average: 'average',
    open: 'Open',
    seeAll: 'See all',
    next: 'Next',
    load14: '14-day load',
    greetLine2: "here's your day.",
    heroLate: 'Overdue',
    noneSoon: 'No tasks waiting.',
    lowest: 'Lowest',
    pending: 'To do',
    done: 'Done',
    sessions: (n: number, got: number | null, max: number | null) => `${n === 1 ? '1 session' : `${n} sessions`}${got !== null && max !== null ? ` · ${got}/${max} points` : ''}`,
  },
  notify: {
    title: 'Allow reminders?',
    body: 'Sulo reminds you of task deadlines and key academic calendar dates with notifications on this phone. They are scheduled on the phone; nothing is sent out.',
    allow: 'Allow',
    later: 'Later',
    denied: "Notifications are off. Turn them on in the phone's Settings, under Apps, Sulo, Notifications.",
  },
  settings: {
    language: 'Language',
    languageNote: "Follows the phone's language.",
    bugHelp: "If something is wrong, copy this and paste it into the feedback form. It holds the app version and technical notes on the last check: no name, student number, session or task content.",
    copied: 'Info copied.',
    signOutDelete: 'Sign out and delete data',
    nicknameHelp: 'Optional, up to 24 characters. Only used to greet you on Ringkasan, kept on this phone.',
    privacyOn: 'Privacy mode',
    privacyHelp: 'Masks names, grades and attendance percentages on screen.',
  },
  about: {
    apkVersion: (v: string) => `APK version ${v}`,
  },
  greet: {
    line1: { pagi: 'Good morning,', siang: 'Good afternoon,', sore: 'Good afternoon,', malam: 'Good evening,', tengahMalam: 'Good evening,' },
    phrases: {
      pagi: [{ text: 'have a good one!' }, { text: "let's get started." }, { text: "you've got this." }],
      siang: [{ text: "don't skip lunch." }, { text: 'still going strong?' }, { text: 'take it easy.', casual: true }],
      sore: [{ text: 'almost there.' }, { text: "let's wrap it up." }, { text: 'nearly done.' }],
      // "that's enough for today." is left out: at 22 px it is 237 px wide, one more than the
      // greeting's column at 384 (measured in the app's font, M8c.1).
      malam: [{ text: 'ready for tomorrow?', small: true }, { text: 'time to wind down.', casual: true }],
      tengahMalam: [{ text: 'still up?' }, { text: "don't stay up too late.", small: true }],
    },
    state: {
      expired: 'Sign in again to update',
      overdue: (n: number) => [String(n), n === 1 ? ' overdue task' : ' overdue tasks'] as [string, string],
      today: (n: number) => `${n} due today`,
      tomorrow: (n: number) => `${n} due tomorrow`,
      clear: 'All clear today',
    },
  },
  dev: {
    title: 'Session age (debug build)',
    remaining: 'Session time left according to SIKOLA',
    seconds: (n: number) => `${n} seconds`,
    none: 'Nothing recorded yet.',
    back: 'Back',
  },
};

export function mobileWords(locale: Locale): MobileWords {
  return locale === 'en' ? en : id;
}

/**
 * The dashboard's words as the Android app shows them: where the extension
 * says "in your browser", the phone says "on this phone". NEOSIA comes to the
 * app in M8d, so About does not mention it yet.
 */
export function mobileDash(locale: Locale): DashMessages {
  const d = dashFor(locale);
  const phone =
    locale === 'en'
      ? {
          customDueHelp: 'SIKOLA gives this task no due date. A personal one is kept only on this phone and used for reminders.',
          stepsHelp: 'Break the task into small steps. Kept only on this phone.',
          intro: 'Sulo is a companion app for Unhas students. It brings your tasks and changes from SIKOLA and the dates from the academic calendar together in one place, with reminders.',
          points: ['All data stays on this phone. There is no Sulo server and no tracking.', 'Not an official Unhas app.'],
        }
      : {
          customDueHelp: 'SIKOLA tidak memberi tenggat untuk tugas ini. Tenggat pribadi hanya disimpan di HP ini dan dipakai untuk pengingat.',
          stepsHelp: 'Pecah tugas jadi langkah kecil. Hanya tersimpan di HP ini.',
          intro: 'Sulo adalah aplikasi pendamping untuk mahasiswa Unhas. Sulo mengumpulkan tugas dan perubahan dari SIKOLA serta jadwal dari kalender akademik di satu tempat, lengkap dengan pengingat.',
          points: ['Semua data tersimpan di HP ini. Tidak ada server Sulo, tidak ada pelacakan.', 'Bukan aplikasi resmi Unhas.'],
        };
  return {
    ...d,
    tugas: { ...d.tugas, customDueHelp: phone.customDueHelp, stepsHelp: phone.stepsHelp },
    tentang: { ...d.tentang, intro: phone.intro, points: phone.points },
  };
}
