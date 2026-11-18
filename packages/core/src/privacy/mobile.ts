// The Android app's privacy notice (M8c): what is stored, where, how it is
// protected, every server the app contacts, and how to delete it all.
// Same shape as privacy/content.ts so the same renderer shows it. Keep it
// true to the app: when the app starts contacting anything new, say so here.

import type { Block, Section, Text } from './content';

export const MOBILE_PRIVACY_UPDATED: Text = { id: '18 November 2026', en: '18 November 2026' };

/** The three points shown first, each restating a section below (no new claim). */
export const MOBILE_PRIVACY_SUMMARY: readonly { icon: 'key' | 'shield' | 'eye'; title: Text; body: Text }[] = [
  {
    icon: 'key',
    title: { id: 'Password tidak pernah dilihat', en: 'Your password is never seen' },
    body: { id: 'Kamu masuk di halaman SIKOLA sendiri.', en: 'You sign in on SIKOLA’s own page.' },
  },
  {
    icon: 'shield',
    title: { id: 'Data tetap di HP ini', en: 'Data stays on this phone' },
    body: { id: 'Tanpa server Sulo, analitik, iklan, atau pelacakan.', en: 'No Sulo server, analytics, ads or tracking.' },
  },
  {
    icon: 'eye',
    title: { id: 'SIKOLA hanya dibaca', en: 'SIKOLA is only read' },
    body: { id: 'Sulo tidak mengubah apa pun di SIKOLA.', en: 'Sulo changes nothing on SIKOLA.' },
  },
];

/** The section listing every server: shown as its own card of rows. */
export const MOBILE_PRIVACY_SERVERS_HEADING = 'Servers the app contacts';

export const MOBILE_PRIVACY_TITLE: Text = { id: 'Privasi di aplikasi Android', en: 'Privacy in the Android app' };

export const MOBILE_PRIVACY_INTRO: Block[] = [
  {
    kind: 'p',
    text: {
      id: 'Sulo tidak resmi dan tidak berafiliasi dengan Universitas Hasanuddin. Singkatnya: datamu tetap di HP ini, sesi login disimpan terenkripsi, dan Sulo hanya menghubungi SIKOLA serta repo data publik Sulo.',
      en: 'Sulo is unofficial and not affiliated with Universitas Hasanuddin. In short: your data stays on this phone, the sign-in session is stored encrypted, and Sulo only contacts SIKOLA and Sulo’s public data repository.',
    },
  },
];

export const MOBILE_PRIVACY_SECTIONS: Section[] = [
  {
    heading: { id: 'Apa yang disimpan', en: 'What is stored' },
    blocks: [
      {
        kind: 'ul',
        items: [
          { id: 'Tugas dan tenggat dari SIKOLA, serta catatan, langkah, dan tenggat pribadi yang kamu tambahkan sendiri.', en: 'Tasks and deadlines from SIKOLA, and the notes, steps and personal deadlines you add yourself.' },
          { id: 'Daftar mata kuliah, termasuk nama dan warna yang kamu pilih.', en: 'Your course list, including the names and colors you choose.' },
          { id: 'Struktur mata kuliah untuk Kabar terbaru (nama dan jenis kegiatan, tanpa isinya).', en: 'Course structures for Updates (activity names and kinds, not their content).' },
          { id: 'Rekap presensi untuk mata kuliah yang dipantau, dan rincian per pertemuan yang kamu buka.', en: 'The attendance recap for the courses you follow, and the per-session details you open.' },
          { id: 'Pengaturan, dan sesi login SIKOLA.', en: 'Your settings, and the SIKOLA sign-in session.' },
        ],
      },
      {
        kind: 'p',
        text: {
          id: 'Yang tidak pernah disimpan atau dibaca: password SIKOLA, isi kuis, dan data mahasiswa lain.',
          en: 'Never stored or read: your SIKOLA password, quiz content, and other students’ data.',
        },
      },
    ],
  },
  {
    heading: { id: 'Di mana disimpan', en: 'Where it is stored' },
    blocks: [
      {
        kind: 'p',
        text: {
          id: 'Semuanya di penyimpanan pribadi aplikasi di HP ini, yang tidak bisa dibaca aplikasi lain. Cadangan Android dan pemindahan data ke HP lain dimatikan untuk Sulo, jadi datanya tidak ikut ke cadangan cloud.',
          en: 'Everything is in the app’s private storage on this phone, which other apps cannot read. Android backup and transfer to another phone are turned off for Sulo, so the data never goes into a cloud backup.',
        },
      },
    ],
  },
  {
    heading: { id: 'Enkripsi', en: 'Encryption' },
    blocks: [
      {
        kind: 'ul',
        items: [
          { id: 'Sesi login SIKOLA dienkripsi dengan AES-256-GCM. Kuncinya ada di Android Keystore dan tidak bisa dikeluarkan dari HP.', en: 'The SIKOLA sign-in session is encrypted with AES-256-GCM. Its key lives in the Android Keystore and cannot leave the phone.' },
          { id: 'Sesi itu tidak pernah sampai ke bagian tampilan aplikasi, tidak masuk log, dan tidak ikut info laporan bug.', en: 'The session never reaches the app’s interface code, never goes into a log, and is never part of the bug report info.' },
          { id: 'Kunci aplikasi (opsional) meminta sidik jari atau kunci layar HP setiap Sulo dibuka.', en: 'The optional app lock asks for your fingerprint or the phone’s screen lock whenever Sulo opens.' },
        ],
      },
    ],
  },
  {
    heading: { id: 'Server yang dihubungi', en: 'Servers the app contacts' },
    blocks: [
      {
        kind: 'ul',
        items: [
          {
            id: 'sikola-v2.unhas.ac.id: masuk di halaman SIKOLA sendiri, lalu membaca tugas, kalender, mata kuliah, kabar, dan presensi. Hanya membaca; Sulo tidak mengubah apa pun di SIKOLA. Permintaan menyebut dirinya Sulo dan versinya.',
            en: 'sikola-v2.unhas.ac.id: you sign in on SIKOLA’s own page, then Sulo reads tasks, the calendar, courses, updates and attendance. Read only; Sulo changes nothing on SIKOLA. Requests name themselves as Sulo and its version.',
          },
          {
            id: 'ikrar06.github.io: repo data publik Sulo, untuk dua berkas data saja, yaitu pengaturan jarak jauh (termasuk sakelar pemantauan) dan kalender akademik terbaru. Dibaca paling sering sekali sehari, ditambah saat aplikasi dibuka kalau bacaan terakhir lebih dari 6 jam. Permintaannya tidak membawa cookie atau apa pun yang mengenali kamu.',
            en: 'ikrar06.github.io: Sulo’s public data repository, for two data files only: the remote settings (including the watching switch) and the latest academic calendar. Read at most once a day, plus when you open the app and the last read is over 6 hours old. The request carries no cookie and nothing that identifies you.',
          },
          {
            id: 'Tidak ada server lain. Tidak ada server Sulo, analitik, iklan, atau pelacakan. Kalender akademik juga ikut di dalam aplikasi, jadi tetap ada tanpa jaringan.',
            en: 'No other server. No Sulo server, analytics, ads or tracking. The academic calendar also ships inside the app, so it is there without a connection.',
          },
          {
            id: 'Tautan yang kamu ketuk (Google Kalender, SIKOLA, formulir masukan) dibuka di browser. Sulo tidak mengirim data apa pun ke sana.',
            en: 'Links you tap (Google Calendar, SIKOLA, the feedback form) open in your browser. Sulo sends nothing to them.',
          },
        ],
      },
    ],
  },
  {
    heading: { id: 'Kapan Sulo memeriksa SIKOLA', en: 'When Sulo checks SIKOLA' },
    blocks: [
      {
        kind: 'p',
        text: {
          id: 'Karena tindakanmu: setelah masuk, saat membuka aplikasi kalau data lebih tua dari 15 menit, tarik untuk memperbarui, atau tombol Perbarui. Ditambah pemantauan latar belakang kalau kamu menyalakannya (bagian berikut). Rekap presensi diperbarui paling sering sekali sehari saat aplikasi dibuka, tidak pernah di latar belakang; rincian per pertemuan diambil saat kamu membukanya. Pengingat dijadwalkan di HP dari data terakhir.',
          en: 'Because of something you do: after signing in, when you open the app and the data is older than 15 minutes, pull to update, or the Update button. Plus background watching if you turn it on (next section). The attendance recap updates at most once a day when the app is opened, never in the background; per-session details are fetched when you open them. Reminders are scheduled on the phone from the latest data.',
        },
      },
    ],
  },
  {
    heading: { id: 'Pemantauan latar belakang (pilihan)', en: 'Background watching (optional)' },
    blocks: [
      {
        kind: 'ul',
        items: [
          {
            id: 'Kalau "Pantau tugas baru" menyala, Sulo mengecek SIKOLA berkala walau aplikasi tertutup: sekitar tiap 20 menit pukul 06.00-22.59 dan tiap 60 menit di malam hari. Setiap cek satu permintaan yang hanya membaca tugas, kabar, dan sisa waktu sesi.',
            en: 'With "Watch for new tasks" on, Sulo checks SIKOLA regularly even when the app is closed: about every 20 minutes from 06.00 to 22.59 and every 60 minutes at night. Each check is one request that only reads tasks, updates and the session’s time left.',
          },
          {
            id: 'Selama fitur ini menyala, login SIKOLA-mu tetap aktif di HP ini, karena cek berkala dihitung SIKOLA sebagai aktivitas. Matikan fitur ini kalau kamu tidak mau sesimu tetap aktif.',
            en: 'While it is on, your SIKOLA sign-in stays active on this phone, because SIKOLA counts the checks as activity. Turn it off if you do not want your session kept active.',
          },
          {
            id: 'Mematikannya: Lainnya, Pengaturan, Notifikasi, "Pantau tugas baru". Cek berhenti seketika; sesudah itu Sulo hanya memeriksa saat kamu membuka aplikasi, menarik layar, atau mengetuk Perbarui.',
            en: 'To turn it off: More, Settings, Notifications, "Watch for new tasks". Checks stop at once; after that Sulo only checks when you open the app, pull down, or tap Update.',
          },
          {
            id: 'Pengelola Sulo bisa mematikan atau memperlambat pemantauan untuk semua pengguna lewat pengaturan jarak jauh, misalnya kalau ada keberatan dari kampus.',
            en: 'Sulo’s maintainer can turn watching off or slow it down for everyone through the remote settings, for example if the university objects.',
          },
          {
            id: 'Cek berkala ikut batas harian yang sama dengan pemeriksaan lain, dan tidak pernah mengambil rekap presensi.',
            en: 'The checks count against the same daily limits as every other check, and never fetch the attendance recap.',
          },
        ],
      },
    ],
  },
  {
    heading: { id: 'Cara menghapus', en: 'How to delete it' },
    blocks: [
      {
        kind: 'ul',
        items: [
          { id: 'Lainnya, Pengaturan, Keluar dan hapus data: menghapus sesi, kuncinya di Keystore, semua data Sulo, dan semua pengingat terjadwal di HP ini.', en: 'More, Settings, Sign out and delete data: deletes the session, its Keystore key, all of Sulo’s data and every scheduled reminder on this phone.' },
          { id: 'Menghapus aplikasi juga menghapus semuanya.', en: 'Uninstalling the app deletes everything too.' },
          { id: 'Data di SIKOLA tidak tersentuh.', en: 'Nothing on SIKOLA changes.' },
        ],
      },
    ],
  },
];
