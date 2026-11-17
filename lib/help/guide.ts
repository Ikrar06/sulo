// "Mulai pakai" in Bantuan: five steps, each with a short muted clip and a
// numbered list of what it shows (plain text, for everyone and for screen
// readers), after a one-line tip about pinning Sulo. Clips and their
// posters come from `pnpm guide:shots` (synthetic demo data, public/guide/).

export type GuideLocale = 'id' | 'en';
type Text = Record<GuideLocale, string>;


export interface GuideStep {
  id: string;
  title: Text;
  body: Text;
  /** File stem in public/guide/ ({clip}-{theme}-{locale}.webm, poster .webp). */
  clip: string;
  /** Intrinsic size, so the frame keeps its aspect ratio and the markers stay on target. */
  size: { width: number; height: number };
  /** Narrow pictures (the 380 px popup) are shown at their own width, not stretched to the column. */
  maxWidth?: number;
  alt: Text;
  /** What happens in the clip, in order. */
  points: Text[];
}

export const GUIDE_TITLE: Text = { id: 'Mulai pakai', en: 'Getting started' };

/** One line under the title instead of a step: pinning lives in the browser, which cannot be recorded. */
export const GUIDE_TIP: Text = {
  id: 'Supaya Sulo gampang dibuka, klik ikon puzzle di kanan atas browser lalu sematkan Sulo.',
  en: 'To open Sulo easily, click the puzzle icon at the top right of the browser and pin Sulo.',
};

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: 'popup',
    title: { id: 'Lihat tugas terdekat di popup', en: 'See what is due in the popup' },
    body: {
      id: 'Popup menampilkan tugas yang paling dekat tenggatnya. Dari sini kamu bisa memperbarui daftar atau membuka dashboard.',
      en: 'The popup lists the tasks due soonest. From here you can update the list or open the dashboard.',
    },
    clip: 'popup',
    size: { width: 1200, height: 1642 },
    maxWidth: 380,
    alt: { id: 'Popup Sulo dengan daftar tugas terdekat.', en: 'The Sulo popup with the tasks due soonest.' },
    points: [
      { id: 'Tugas yang paling dekat tenggatnya ada di atas.', en: 'The tasks due soonest are at the top.' },
      { id: 'Perbarui memeriksa SIKOLA sekarang. Kalau baru saja diperbarui, tombolnya cukup bilang "Sudah terbaru".', en: 'Update checks SIKOLA now. Right after an update it just says "Up to date".' },
      { id: 'Pengaturan, lalu Buka dashboard.', en: 'Settings, then Open dashboard.' },
    ],
  },
  {
    id: 'tugas',
    title: { id: 'Atur satu tugas', en: 'Work on one task' },
    body: {
      id: 'Di halaman Tugas, buka rincian sebuah tugas untuk memecahnya jadi langkah, menulis catatan, atau menunda pengingatnya.',
      en: 'On the Tasks page, open a task to split it into steps, write a note, or snooze its reminder.',
    },
    clip: 'tugas',
    size: { width: 1200, height: 812 },
    alt: { id: 'Rincian tugas yang terbuka dengan langkah, catatan, dan tombol aksi.', en: 'An open task with steps, a note and action buttons.' },
    points: [
      { id: 'Buka rincian tugas.', en: 'Open a task\'s details.' },
      { id: 'Tulis langkah, lalu tekan Enter.', en: 'Type a step and press Enter.' },
      { id: 'Tulis catatan untuk dirimu sendiri.', en: 'Write a note for yourself.' },
      { id: 'Tunda pengingat 1 jam, 3 jam, atau sampai besok pagi.', en: 'Snooze the reminder for 1 hour, 3 hours or until tomorrow morning.' },
      { id: 'Tandai selesai.', en: 'Mark it as done.' },
    ],
  },
  {
    id: 'mata-kuliah',
    title: { id: 'Pilih mata kuliah yang dipantau', en: 'Choose the courses to follow' },
    body: {
      id: 'Tugas dan kabar hanya diambil dari mata kuliah yang dipantau. Nama dan warnanya bisa kamu sesuaikan.',
      en: 'Tasks and updates come only from the courses you follow. You can change their names and colors.',
    },
    clip: 'mata-kuliah',
    size: { width: 1200, height: 538 },
    alt: { id: 'Daftar mata kuliah dengan titik warna, nama, dan sakelar Dipantau.', en: 'The course list with color dots, names and Followed switches.' },
    points: [
      { id: 'Klik nama, ketik nama baru, lalu Enter. Kosongkan untuk kembali ke nama SIKOLA.', en: 'Click the name, type a new one and press Enter. Clear it to go back to the SIKOLA name.' },
      { id: 'Klik titik warna, pilih dengan panah, lalu Enter.', en: 'Click the color dot, pick with the arrow keys, then Enter.' },
      { id: 'Matikan sakelar Dipantau untuk berhenti memantau mata kuliah itu.', en: 'Turn the Followed switch off to stop following that course.' },
    ],
  },
  {
    id: 'kalender',
    title: { id: 'Pakai kalender akademik', en: 'Use the academic calendar' },
    body: {
      id: 'Kalender menggabungkan jadwal akademik Unhas dengan tenggat tugasmu. Kalender umum bisa ditambahkan ke Google Kalender.',
      en: 'The calendar puts the Unhas academic dates and your deadlines together. The public calendars can be added to Google Calendar.',
    },
    clip: 'kalender',
    size: { width: 1200, height: 978 },
    alt: { id: 'Halaman Kalender dengan filter kategori, grid bulan, dan kartu langganan.', en: 'The Calendar page with category filters, the month grid and subscription cards.' },
    points: [
      { id: 'Klik kategori untuk menyembunyikan atau menampilkannya.', en: 'Click a category to hide or show it.' },
      { id: 'Klik tanggal untuk melihat acaranya di panel kanan.', en: 'Click a date to see its events in the side panel.' },
      { id: 'Tambahkan kalender umum ke Google Kalender, atau pilih ⋯ untuk Outlook, Apple, atau menyalin alamatnya.', en: 'Add a public calendar to Google Calendar, or use ⋯ for Outlook, Apple or copying the address.' },
    ],
  },
  {
    id: 'kabar',
    title: { id: 'Ikuti kabar terbaru', en: 'Follow the latest updates' },
    body: {
      id: 'Sulo mencatat materi dan tugas baru, perubahan tenggat, nilai, dan pengumuman. Kamu memilih mana yang dikirim sebagai notifikasi.',
      en: 'Sulo notes new materials and tasks, changed deadlines, grades and announcements. You choose which ones notify you.',
    },
    clip: 'kabar',
    size: { width: 1200, height: 556 },
    alt: { id: 'Halaman Kabar terbaru dengan filter jenis dan pengaturan notifikasi yang terbuka.', en: 'The Latest updates page with the kind filter and the notification settings open.' },
    points: [
      { id: 'Saring menurut jenis perubahan.', en: 'Filter by kind of change.' },
      { id: 'Atur notifikasi: pilih jenis yang diberitahukan.', en: 'Notification settings: choose which kinds notify you.' },
    ],
  },
];
