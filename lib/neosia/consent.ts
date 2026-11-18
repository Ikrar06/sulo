// The NEOSIA consent text, in one place: the dialog before Chrome's
// permission prompt (components/dashboard/NeosiaConsent.tsx) and the NEOSIA
// section of the privacy page (lib/privacy/content.ts) both render this, so
// they always say the same thing. Plain words (lib/i18n/glossary.md).

import type { Locale } from '../i18n';

type Text = Record<Locale, string>;

export interface ConsentText {
  title: Text;
  how: Text;
  keptTitle: Text;
  kept: readonly Text[];
  droppedTitle: Text;
  dropped: readonly Text[];
  offTitle: Text;
  off: Text;
  unofficial: Text;
}

export const NEOSIA_CONSENT: ConsentText = {
  title: { id: 'Hubungkan NEOSIA?', en: 'Connect NEOSIA?' },
  how: {
    id: 'Sulo hanya membaca data saat kamu membuka NEOSIA sendiri. Sulo tidak pernah menghubungi NEOSIA.',
    en: 'Sulo only reads data while you open NEOSIA yourself. Sulo never contacts NEOSIA.',
  },
  keptTitle: { id: 'Yang disimpan di browsermu', en: 'What is kept in your browser' },
  kept: [
    { id: 'Jadwal kuliah: mata kuliah, kelas, hari, jam, ruang, dan nama dosen', en: 'Class schedule: courses, classes, days, times, rooms and lecturer names' },
    { id: 'Jendela dan status KRS, serta kuota SKS', en: 'The KRS window and status, and your credit limit' },
    { id: 'Sudah bayar atau belum, tanpa nominal', en: 'Paid or not paid, without amounts' },
    { id: 'Nama dosen PA dan status survei', en: 'Your academic advisor’s name and the survey status' },
    { id: 'Nilai huruf, IPS, IPK, dan SKS. Tersembunyi sampai kamu memilih Tampilkan', en: 'Letter grades, semester and overall GPA, and credits. Hidden until you choose Show' },
    { id: 'Semester dan masa studi', en: 'Your semester and study period' },
  ],
  droppedTitle: { id: 'Yang dibuang sebelum keluar dari halaman NEOSIA', en: 'What is dropped before it leaves the NEOSIA page' },
  dropped: [
    { id: 'NIM, NIK, dan NISN', en: 'Student number, national ID and school ID numbers' },
    { id: 'Kontak: email dan nomor HP', en: 'Contact details: email and phone number' },
    { id: 'Alamat dan tanggal lahir', en: 'Address and date of birth' },
    { id: 'Nominal dan bank pembayaran', en: 'Payment amounts and bank' },
    { id: 'Nilai angka', en: 'Numeric grades' },
    { id: 'Nomor induk dosen', en: 'Lecturers’ ID numbers' },
  ],
  offTitle: { id: 'Mematikan dan menghapus', en: 'Turning it off' },
  off: {
    id: 'Kapan saja, lewat Pengaturan lalu "Putuskan dan hapus data". Semua data NEOSIA terhapus dan izinnya dicabut.',
    en: 'Any time, in Settings with "Disconnect and delete data". All NEOSIA data is deleted and the permission is removed.',
  },
  unofficial: {
    id: 'Sulo bukan aplikasi resmi dan tidak berafiliasi dengan Universitas Hasanuddin.',
    en: 'Sulo is not an official app and is not affiliated with Universitas Hasanuddin.',
  },
};
