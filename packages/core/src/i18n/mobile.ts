// Words for the Android app (M8b), Indonesian and English. Plain words
// (lib/i18n/glossary.md). Grades never appear here.

import type { Locale } from './index';
import { dashFor, type DashMessages } from './dashboard';

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
    privacyOn: 'Mode privasi',
    privacyHelp: 'Menyamarkan nama, nilai, dan persentase presensi di layar.',
  },
  about: {
    apkVersion: (v: string) => `Versi APK ${v}`,
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
    privacyOn: 'Privacy mode',
    privacyHelp: 'Masks names, grades and attendance percentages on screen.',
  },
  about: {
    apkVersion: (v: string) => `APK version ${v}`,
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
