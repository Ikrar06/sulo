// "Mulai pakai" in Bantuan: six steps, each with an annotated picture.
// Pictures come from `pnpm guide:shots` (synthetic demo data, public/guide/);
// marker positions are percent of the picture, measured by that script
// (scripts/guide/markers.json) per language. Step 1 is a drawing, since the
// browser's own toolbar cannot be captured.

export type GuideLocale = 'id' | 'en';
type Text = Record<GuideLocale, string>;

export interface GuideMarker {
  /** Percent of the picture's width and height, per language (labels change widths). */
  at: Record<GuideLocale, [number, number]>;
  text: Text;
}

export interface GuideStep {
  id: string;
  title: Text;
  body: Text;
  /** File stem in public/guide/ ({image}-{theme}-{locale}.webp); null for the drawn toolbar step. */
  image: string | null;
  /** Intrinsic size, so the frame keeps its aspect ratio and the markers stay on target. */
  size: { width: number; height: number };
  /** Narrow pictures (the 380 px popup) are shown at their own width, not stretched to the column. */
  maxWidth?: number;
  alt: Text;
  markers: GuideMarker[];
}

const same = (x: number, y: number): Record<GuideLocale, [number, number]> => ({ id: [x, y], en: [x, y] });

export const GUIDE_TITLE: Text = { id: 'Mulai pakai', en: 'Getting started' };

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: 'sematkan',
    title: { id: 'Sematkan Sulo di toolbar', en: 'Pin Sulo to the toolbar' },
    body: {
      id: 'Klik ikon puzzle di kanan atas browser, lalu klik pin di sebelah Sulo. Ikon Sulo akan selalu terlihat di toolbar.',
      en: 'Click the puzzle icon at the top right of the browser, then the pin next to Sulo. Its icon then stays in the toolbar.',
    },
    image: null,
    size: { width: 1200, height: 360 },
    alt: { id: 'Gambar toolbar browser: ikon puzzle, pin, lalu ikon Sulo.', en: 'Drawing of the browser toolbar: the puzzle icon, the pin, then the Sulo icon.' },
    markers: [
      { at: same(12.2, 50), text: { id: 'Ikon puzzle (Ekstensi) di toolbar.', en: 'The puzzle icon (Extensions) in the toolbar.' } },
      { at: same(57.2, 47.8), text: { id: 'Pin di samping Sulo di daftar ekstensi.', en: 'The pin next to Sulo in the extensions list.' } },
      { at: same(75.5, 50), text: { id: 'Ikon Sulo yang sudah tersemat. Klik untuk membuka popup.', en: 'The pinned Sulo icon. Click it to open the popup.' } },
    ],
  },
  {
    id: 'popup',
    title: { id: 'Lihat tugas terdekat di popup', en: 'See what is due in the popup' },
    body: {
      id: 'Popup menampilkan tugas yang paling dekat tenggatnya. Dari sini kamu bisa memperbarui daftar atau membuka dashboard.',
      en: 'The popup lists the tasks due soonest. From here you can update the list or open the dashboard.',
    },
    image: 'popup',
    size: { width: 1200, height: 1389 },
    maxWidth: 380,
    alt: { id: 'Popup Sulo dengan daftar tugas terdekat.', en: 'The Sulo popup with the tasks due soonest.' },
    markers: [
      { at: same(4.7, 22.3), text: { id: 'Tugas terdekat. Klik untuk membukanya di SIKOLA.', en: 'The next task. Click it to open it in SIKOLA.' } },
      { at: same(71.1, 6.8), text: { id: 'Perbarui: memeriksa SIKOLA sekarang.', en: 'Update: checks SIKOLA now.' } },
      { at: same(85.8, 6.8), text: { id: 'Pengaturan, termasuk "Buka dashboard".', en: 'Settings, including "Open dashboard".' } },
    ],
  },
  {
    id: 'tugas',
    title: { id: 'Atur satu tugas', en: 'Work on one task' },
    body: {
      id: 'Di halaman Tugas, buka rincian sebuah tugas untuk memecahnya jadi langkah, menulis catatan, atau menunda pengingatnya.',
      en: 'On the Tasks page, open a task to split it into steps, write a note, or snooze its reminder.',
    },
    image: 'tugas',
    size: { width: 1200, height: 501 },
    alt: { id: 'Rincian tugas yang terbuka dengan langkah, catatan, dan tombol aksi.', en: 'An open task with steps, a note and action buttons.' },
    markers: [
      { at: same(3.1, 43.4), text: { id: 'Langkah: tulis lalu tekan Enter.', en: 'Steps: type one and press Enter.' } },
      { at: same(3.1, 69), text: { id: 'Catatan untuk dirimu sendiri, tersimpan otomatis.', en: 'A note for yourself, saved as you leave the field.' } },
      { at: { id: [43.5, 91.5], en: [41, 91.5] }, text: { id: 'Tunda pengingat 1 jam, 3 jam, atau sampai besok pagi.', en: 'Snooze the reminder for 1 hour, 3 hours or until tomorrow morning.' } },
      { at: same(4.7, 5.9), text: { id: 'Tandai selesai.', en: 'Mark as done.' } },
    ],
  },
  {
    id: 'mata-kuliah',
    title: { id: 'Pilih mata kuliah yang dipantau', en: 'Choose the courses to follow' },
    body: {
      id: 'Tugas dan kabar hanya diambil dari mata kuliah yang dipantau. Nama dan warnanya bisa kamu sesuaikan.',
      en: 'Tasks and updates come only from the courses you follow. You can change their names and colors.',
    },
    image: 'mata-kuliah',
    size: { width: 1200, height: 391 },
    alt: { id: 'Daftar mata kuliah dengan titik warna, nama, dan sakelar Dipantau.', en: 'The course list with color dots, names and Followed switches.' },
    markers: [
      { at: same(93.2, 27.1), text: { id: 'Sakelar Dipantau.', en: 'The Followed switch.' } },
      { at: same(4.8, 24), text: { id: 'Klik nama untuk menggantinya. Kosongkan untuk kembali ke nama SIKOLA.', en: 'Click the name to change it. Clear it to go back to the SIKOLA name.' } },
      { at: same(3.6, 17.8), text: { id: 'Klik titik warna untuk memilih warna lain.', en: 'Click the color dot to pick another color.' } },
    ],
  },
  {
    id: 'kalender',
    title: { id: 'Pakai kalender akademik', en: 'Use the academic calendar' },
    body: {
      id: 'Kalender menggabungkan jadwal akademik Unhas dengan tenggat tugasmu. Kalender umum bisa ditambahkan ke Google Kalender.',
      en: 'The calendar puts the Unhas academic dates and your deadlines together. The public calendars can be added to Google Calendar.',
    },
    image: 'kalender',
    size: { width: 1200, height: 1428 },
    alt: { id: 'Halaman Kalender dengan filter kategori, grid bulan, dan kartu langganan.', en: 'The Calendar page with category filters, the month grid and subscription cards.' },
    markers: [
      { at: { id: [1.4, 8.5], en: [1.4, 8.4] }, text: { id: 'Filter kategori: klik untuk menampilkan atau menyembunyikan.', en: 'Category filters: click to show or hide.' } },
      { at: { id: [1.5, 43.9], en: [1.5, 43.2] }, text: { id: 'Klik tanggal untuk melihat acaranya di panel kanan.', en: 'Click a date to see its events in the side panel.' } },
      { at: { id: [3.6, 88.8], en: [3.6, 87.5] }, text: { id: 'Tambahkan kalender umum ke Google Kalender.', en: 'Add a public calendar to Google Calendar.' } },
    ],
  },
  {
    id: 'kabar',
    title: { id: 'Ikuti kabar terbaru', en: 'Follow the latest updates' },
    body: {
      id: 'Sulo mencatat materi dan tugas baru, perubahan tenggat, nilai, dan pengumuman. Kamu memilih mana yang dikirim sebagai notifikasi.',
      en: 'Sulo notes new materials and tasks, changed deadlines, grades and announcements. You choose which ones notify you.',
    },
    image: 'kabar',
    size: { width: 1200, height: 555 },
    alt: { id: 'Halaman Kabar terbaru dengan filter jenis dan pengaturan notifikasi yang terbuka.', en: 'The Latest updates page with the kind filter and the notification settings open.' },
    markers: [
      { at: same(19.7, 3.5), text: { id: 'Saring menurut jenis perubahan.', en: 'Filter by kind of change.' } },
      { at: same(1.9, 24.8), text: { id: 'Satu perubahan. Yang belum dilihat bertitik.', en: 'One change. Unseen ones have a dot.' } },
      { at: { id: [84.2, 3.5], en: [79.9, 3.5] }, text: { id: 'Atur notifikasi: pilih jenis yang diberitahukan.', en: 'Notification settings: choose which kinds notify you.' } },
    ],
  },
];
