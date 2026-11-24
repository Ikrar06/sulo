// The landing page's words, Indonesian (/) and English (/en/). Its own
// dictionary, apart from the apps' (packages/core/src/i18n), with the same
// terms. No separator dots, bars or slashes between phrases: sentences with
// commas, or separate elements (owner's rule, 24 Nov 2026; checked at build).
export type Bahasa = 'id' | 'en';
export const BAHASA: readonly Bahasa[] = ['id', 'en'];

export const teks = {
  id: {
    lewati: 'Lewati ke isi',
    nav: { fitur: 'Fitur', privasi: 'Privasi', pasang: 'Cara pasang', tanya: 'Tanya jawab', tombolPasang: 'Pasang', tema: 'Ganti tema', bahasaLain: 'English' },
    cip: ['Bukan aplikasi resmi Unhas', 'Gratis', 'Kode terbuka'],
    cipKalimat: 'Gratis, kodenya terbuka, dan bukan aplikasi resmi Unhas.',
    judul: 'Tugas, jadwal, presensi Unhas di satu tempat.',
    // The title's two tones (owner picks one): [ink, muted or highlighted].
    judulBagian: { akhir: ['Tugas, jadwal, presensi Unhas', 'di satu tempat.'], sorot: ['Tugas, jadwal, presensi Unhas', 'di satu tempat.'], awal: ['Tugas, jadwal, presensi Unhas', 'di satu tempat.'] },
    pendukung: 'Sulo merangkum tugas, jadwal, presensi, dan kalender akademik dari akun Unhas-mu sendiri.',
    unduhAndroid: 'Unduh untuk Android',
    unduhEkstensi: 'Unduh ekstensi',
    caraPasang: 'Lihat cara pasang',
    perangkat: 'Untuk Chrome, Edge, dan Android 8 ke atas.',
    dataContoh: 'Tampilan memakai data contoh.',
    pratinjau: 'Pratinjau. Tombol unduh aktif saat versi 1.0.0 terbit.',
    layarHp: 'Ringkasan di aplikasi Android Sulo',
    layarLaptop: 'Dashboard ekstensi Sulo di laptop',
  },
  en: {
    lewati: 'Skip to content',
    nav: { fitur: 'Features', privasi: 'Privacy', pasang: 'How to install', tanya: 'FAQ', tombolPasang: 'Install', tema: 'Change theme', bahasaLain: 'Bahasa Indonesia' },
    cip: ['Not an official Unhas app', 'Free', 'Open source'],
    cipKalimat: 'Free, open source, and not an official Unhas app.',
    judul: 'Your Unhas tasks, classes and attendance, in one place.',
    judulBagian: { akhir: ['Your Unhas tasks, classes and attendance,', 'in one place.'], sorot: ['Your Unhas tasks, classes and attendance,', 'in one place.'], awal: ['Your Unhas tasks, classes and attendance,', 'in one place.'] },
    pendukung: 'Sulo brings together your tasks, classes, attendance and academic calendar, from your own Unhas account.',
    unduhAndroid: 'Download for Android',
    unduhEkstensi: 'Download the extension',
    caraPasang: 'See how to install',
    perangkat: 'For Chrome, Edge, and Android 8 or later.',
    dataContoh: 'The screens show sample data.',
    pratinjau: 'Preview. The download buttons work once version 1.0.0 is out.',
    layarHp: "Ringkasan in Sulo's Android app",
    layarLaptop: "Sulo's extension dashboard on a laptop",
  },
} as const;
