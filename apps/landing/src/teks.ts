// The landing page's words, Indonesian (/) and English (/en/). Its own
// dictionary, apart from the apps' (packages/core/src/i18n), with the same
// terms. No separator dots, bars or slashes between phrases: sentences with
// commas, or separate elements (owner's rule, 24 Nov 2026; checked at build).
export type Bahasa = 'id' | 'en';
export const BAHASA: readonly Bahasa[] = ['id', 'en'];

export const teks = {
  id: {
    lewati: 'Lewati ke isi',
    judulHalaman: 'Sulo: tugas, jadwal, presensi Unhas di satu tempat',
    deskripsi: 'Pendamping akademik tidak resmi untuk mahasiswa Unhas. Tugas SIKOLA, jadwal, presensi, dan kalender akademik di satu tempat, tanpa kata sandi.',
    nav: { fitur: 'Fitur', privasi: 'Privasi', pasang: 'Cara pasang', panduan: 'Panduan', tanya: 'Tanya jawab', tombolPasang: 'Pasang', tema: 'Ganti tema', temaGelap: 'Pakai tema gelap', temaTerang: 'Pakai tema terang', bahasaLain: 'English', menu: 'Menu', tutup: 'Tutup menu' },
    // The third chip shows on a wide screen only: three never fit one line on a phone of 360 or 390.
    cip: ['Bukan aplikasi resmi Unhas', 'Gratis', 'Kode terbuka'],
    judul: 'Tugas, jadwal, presensi Unhas di satu tempat.',
    // The title's two tones (owner, 24 Nov 2026): ink, then grey.
    judulBagian: ['Tugas, jadwal, presensi Unhas', 'di satu tempat.'],
    // USULAN replaced (impeccable critique, 24 Nov 2026): the first screen now answers "is it safe?" too.
    pendukung: 'Sulo merangkumnya dari akun Unhas-mu sendiri, tanpa pernah meminta kata sandimu.',
    /** The sentence's promise of safety, set in ink so it reads in the first five seconds (phase 6 test). */
    aman: 'tanpa pernah meminta kata sandimu.',
    unduhAndroid: 'Unduh untuk Android',
    unduhEkstensi: 'Unduh ekstensi',
    pasangChrome: 'Pasang di Chrome',
    pasangEdge: 'Pasang di Edge',
    pasangIphone: 'Cara pasang di iPhone',
    segeraTersedia: 'Segera tersedia',
    caraPasang: 'Lihat cara pasang',
    // One line under the buttons, for the visitor's device.
    catatan: {
      tanpaJs: 'Untuk Chrome, Edge, dan Android 8 ke atas.',
      android: 'Belum ada di Play Store, tetapi memasangnya cuma sekitar 2 menit.',
      chrome: 'Belum ada di Chrome Web Store, jadi dipasang manual. Sekitar 3 menit.',
      edge: 'Belum ada di Edge Add-ons, jadi dipasang manual. Sekitar 3 menit.',
      toko: (toko: string) => `Dipasang dari ${toko}.`,
      lain: 'Sulo berjalan di Chrome dan Edge.',
      ios: 'Dipasang dari laptop lewat Sideloadly, sekitar 10 menit.',
      aplikasi: 'Kalau unduhan tidak mulai, buka halaman ini di Chrome.',
    },
    // After the download starts: one quiet line in place of the note (read aloud once, nothing sent).
    unduhMulai: (menit: number) => `Unduhan dimulai. Ikuti panduan pasangnya, sekitar ${menit} menit.`,
    dataContoh: 'Tampilan memakai data contoh.',
    pratinjau: 'Pratinjau. Tombol unduh aktif saat versi 1.0.0 terbit.',
    layarHp: 'Ringkasan di aplikasi Sulo di HP',
    layarLaptop: 'Dashboard ekstensi Sulo di laptop',
    layarPopup: 'Popup ekstensi Sulo',
  },
  en: {
    lewati: 'Skip to content',
    judulHalaman: 'Sulo: your Unhas tasks, classes and attendance in one place',
    deskripsi: 'An unofficial study companion for Unhas students. SIKOLA tasks, classes, attendance and the academic calendar in one place, with no password.',
    nav: { fitur: 'Features', privasi: 'Privacy', pasang: 'How to install', panduan: 'Guide', tanya: 'FAQ', tombolPasang: 'Install', tema: 'Change theme', temaGelap: 'Use the dark theme', temaTerang: 'Use the light theme', bahasaLain: 'Bahasa Indonesia', menu: 'Menu', tutup: 'Close the menu' },
    cip: ['Not an official Unhas app', 'Free', 'Open source'],
    judul: 'Your Unhas tasks, classes and attendance, in one place.',
    judulBagian: ['Your Unhas tasks, classes and attendance,', 'in one place.'],
    pendukung: 'Sulo gathers them from your own Unhas account, and never asks for your password.',
    aman: 'never asks for your password.',
    unduhAndroid: 'Download for Android',
    unduhEkstensi: 'Download the extension',
    pasangChrome: 'Add to Chrome',
    pasangEdge: 'Add to Edge',
    pasangIphone: 'How to install on iPhone',
    segeraTersedia: 'Available soon',
    caraPasang: 'See how to install',
    catatan: {
      tanpaJs: 'For Chrome, Edge, and Android 8 or later.',
      android: 'Not on Google Play yet. About 2 minutes to install.',
      chrome: 'Not on the Chrome Web Store yet. Install it by hand, about 3 minutes.',
      edge: 'Not on Edge Add-ons yet. Install it by hand, about 3 minutes.',
      toko: (toko: string) => `Installs from ${toko === 'Edge Add-ons' ? toko : `the ${toko}`}.`,
      lain: 'Sulo runs in Chrome and Edge.',
      ios: 'Installed from a laptop with Sideloadly, about 10 minutes.',
      aplikasi: 'If the download does not start, open this page in Chrome.',
    },
    unduhMulai: (menit: number) => `Your download has started. Follow the install guide, about ${menit} minutes.`,
    dataContoh: 'The screens show sample data.',
    pratinjau: 'Preview. The download buttons work once version 1.0.0 is out.',
    layarHp: "Ringkasan in Sulo's phone app",
    layarLaptop: "Sulo's extension dashboard on a laptop",
    layarPopup: "Sulo's extension popup",
  },
} as const;
