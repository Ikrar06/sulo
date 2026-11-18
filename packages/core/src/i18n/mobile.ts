// Words for the Android app (M8b), Indonesian and English. Plain words
// (lib/i18n/glossary.md). Grades never appear here.

import type { Locale } from './index';

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
    offline: 'Tidak ada koneksi internet.',
    dataSoon: 'Daftar tugas, kalender, dan nilai menyusul di versi berikutnya.',
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
    offline: 'No internet connection.',
    dataSoon: 'Tasks, calendar and grades come in the next version.',
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
