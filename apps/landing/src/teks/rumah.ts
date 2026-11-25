// The home page's sections below the hero, Indonesian and English. English is
// written again, not translated word for word. Terms follow the apps'
// glossary ("Kabar terbaru", "Dashboard"); every feature named is in 1.0.0
// (docs/landing/PENILAIAN.md section 7, checked against the repo). No
// separator dots, bars, slashes or dashes between phrases (owner's rule).
import type { Bahasa } from '../teks';

export const rumah = {
  id: {
    fakta: {
      label: 'Yang perlu kamu tahu',
      isi: ['Tidak pernah meminta kata sandi', 'Data tetap di perangkatmu', 'Tanpa iklan dan pelacak', 'Kode terbuka'],
    },
    sumber: {
      judul: 'Datanya dari mana?',
      intro: 'Sulo membaca tiga sumber dan merangkumnya di satu tempat. Dua dari akunmu sendiri, satu dari kalender resmi Unhas.',
      sikola: { nama: 'SIKOLA', isi: 'Tugas, tenggat, materi baru, dan presensi. Hanya dibaca, tidak pernah diubah.' },
      neosia: { nama: 'NEOSIA', label: 'Pilihan', isi: 'Jadwal kuliah, KRS, dan nilai yang disembunyikan, hanya saat kamu sendiri membuka NEOSIA. Mati sampai kamu menyalakannya.' },
      kalender: { nama: 'Kalender akademik', isi: 'Tanggal kuliah, UTS, UAS, dan libur, dari kalender resmi Unhas.' },
      sulo: { nama: 'Sulo', isi: 'Satu daftar tugas, satu jadwal, dan pengingat yang datang tepat waktu.' },
    },
    sehari: {
      judul: 'Sehari bareng Sulo',
      intro: 'Dari bangun sampai tidur, ini yang Sulo kerjakan untukmu.',
      baru: 'sekarang',
      momen: [
        { jam: '06.30', judul: 'Ringkasan pagi', isi: 'Satu notifikasi tanpa suara berisi tenggat hari ini dan besok.' },
        { jam: '09.40', judul: 'Kuliah dan presensi', isi: 'Rekap presensimu per mata kuliah. Sulo hanya membacanya, tidak pernah mengisinya.' },
        { jam: '13.15', judul: 'Ada yang berubah', isi: 'Tugas baru, atau tenggat yang diundur, muncul di Kabar terbaru.' },
        { jam: '19.00', judul: 'Mengerjakan', isi: 'Semua tugas di satu daftar, urut dari yang paling dekat. Tambahkan ke Google Kalender kalau perlu.' },
        { jam: '21.00', judul: 'Pengingat', isi: 'Tenggat besok diingatkan. Pengingat yang jatuh di jam tenang, 22.00 sampai 06.00, ditahan sampai pagi.' },
      ],
    },
  },
  en: {
    fakta: {
      label: 'What you should know',
      isi: ['Never asks for your password', 'Your data stays on your device', 'No ads, no trackers', 'Open source'],
    },
    sumber: {
      judul: 'Where does it come from?',
      intro: 'Sulo reads three sources and puts them together in one place. Two come from your own account, one from the official Unhas calendar.',
      sikola: { nama: 'SIKOLA', isi: 'Tasks, deadlines, new course material and attendance. Read only, never changed.' },
      neosia: { nama: 'NEOSIA', label: 'Optional', isi: 'Your class schedule, KRS and grades, kept hidden, only while you have NEOSIA open yourself. Off until you turn it on.' },
      kalender: { nama: 'Academic calendar', isi: 'Teaching weeks, midterms, finals and holidays, from the official Unhas calendar.' },
      sulo: { nama: 'Sulo', isi: 'One task list, one schedule, and reminders that come on time.' },
    },
    sehari: {
      judul: 'A day with Sulo',
      intro: 'From waking up to going to bed, here is what Sulo does for you.',
      baru: 'now',
      momen: [
        { jam: '06.30', judul: 'Morning summary', isi: 'One silent notification with what is due today and tomorrow.' },
        { jam: '09.40', judul: 'Classes and attendance', isi: 'Your attendance for each course, at a glance. Sulo only reads it and never fills it in.' },
        { jam: '13.15', judul: 'Something changed', isi: 'A new task, or a deadline that moved, shows up in Kabar terbaru.' },
        { jam: '19.00', judul: 'Getting it done', isi: 'Every task in one list, the closest first. Add one to Google Calendar if you like.' },
        { jam: '21.00', judul: 'A reminder', isi: "Tomorrow's deadline, flagged. A reminder that falls in quiet hours, 22.00 to 06.00, waits until morning." },
      ],
    },
  },
} as const satisfies Record<Bahasa, unknown>;
