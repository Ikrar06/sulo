// Single source of the privacy policy. PRIVACY.md (English) is generated from
// this file with `node scripts/build-privacy.ts`, and the in-extension page
// (privacy.html) renders the Indonesian text. A test fails when PRIVACY.md
// does not match. Edit here, never in PRIVACY.md.
// No imports: the build script runs this file with Node's type stripping.

export type Lang = 'id' | 'en';
export type Text = Record<Lang, string>;

export type Block =
  | { kind: 'p'; text: Text }
  | { kind: 'ul' | 'ol'; items: Text[] };

export interface Section {
  heading: Text;
  blocks: Block[];
}

export const PRIVACY_UPDATED: Text = { id: '15 November 2026', en: '15 November 2026' };

export const PRIVACY_TITLE: Text = { id: 'Kebijakan Privasi', en: 'Privacy Policy' };

export const PRIVACY_INTRO: Block[] = [
  {
    kind: 'p',
    text: {
      id: 'Sulo adalah pendamping akademik tidak resmi untuk mahasiswa Universitas Hasanuddin. Sulo tidak berafiliasi dengan dan tidak didukung oleh Universitas Hasanuddin.',
      en: 'Sulo is an unofficial academic companion for Universitas Hasanuddin students. It is not affiliated with or endorsed by Universitas Hasanuddin.',
    },
  },
  {
    kind: 'p',
    text: {
      id: 'Sulo masih dalam tahap awal. Kebijakan ini menjelaskan aturan yang diikuti proyek, dan menyebutnya kalau sebuah fitur masih direncanakan. Singkatnya: semua data tetap di browsermu, dan tidak ada yang dikirim ke pengembang atau pihak ketiga.',
      en: 'Sulo is in early development. This policy describes the rules the project follows; where a feature is still planned, it says so. In short: everything stays in your browser, and nothing is sent to the developer or to third parties.',
    },
  },
];

export const PRIVACY_SECTIONS: Section[] = [
  {
    heading: { id: 'Yang dibaca Sulo', en: 'What Sulo reads' },
    blocks: [
      {
        kind: 'p',
        text: {
          id: 'Sulo memakai sesi SIKOLA yang sudah ada di browsermu untuk membaca datamu sendiri:',
          en: 'Sulo uses the SIKOLA session that already exists in your browser to read your own data:',
        },
      },
      {
        kind: 'ul',
        items: [
          { id: 'daftar mata kuliahmu', en: 'your list of courses' },
          { id: 'tugas dan tenggatnya, termasuk tenggat kuis', en: 'assignments and their due dates, including quiz deadlines' },
          { id: 'susunan tiap mata kuliah (bagian dan aktivitas), mulai tahap radar perubahan', en: 'the structure of each course (sections and activities), from the change radar milestone' },
          { id: 'notifikasi SIKOLA-mu, mulai tahap radar perubahan', en: 'your SIKOLA notifications, from the change radar milestone' },
        ],
      },
      {
        kind: 'p',
        text: {
          id: 'Sulo hanya membaca. Sulo tidak pernah mengumpulkan tugas, tidak menandai apa pun sebagai dibaca, tidak mengubah data di SIKOLA, tidak membaca isi kuis, dan tidak membaca data mahasiswa lain.',
          en: "Sulo only reads. It never submits work, never marks anything as read, never changes data in SIKOLA, never reads quiz content, and never reads other students' data.",
        },
      },
    ],
  },
  {
    heading: { id: 'Yang disimpan Sulo, dan di mana', en: 'What Sulo stores, and where' },
    blocks: [
      {
        kind: 'p',
        text: {
          id: 'Semuanya disimpan lokal di browser (chrome.storage) pada perangkatmu sendiri:',
          en: 'Everything is stored locally in your browser (chrome.storage) on your own device:',
        },
      },
      {
        kind: 'ul',
        items: [
          { id: 'mata kuliah, tugas, dan tenggat', en: 'courses, assignments and due dates' },
          { id: 'pilihanmu: mata kuliah aktif, tugas yang ditandai selesai, dan kelak alias, warna, serta nama panggilan yang kamu isi sendiri', en: 'your choices: active courses, tasks marked done, and later aliases, colors and a nickname you type yourself' },
          { id: 'penghitung pemakaian lokal, yang tidak pernah keluar dari perangkatmu kecuali kamu sendiri mengekspornya', en: 'local usage counters, which never leave your device unless you export them yourself' },
        ],
      },
      {
        kind: 'p',
        text: {
          id: 'Dari notifikasi SIKOLA, Sulo hanya akan menyimpan id, subjek, komponen dan jenis kejadian, waktu dibuat, dan status dibaca. Isi pesan, yang bisa memuat nilai atau komentar dosen, tidak pernah disimpan.',
          en: 'From SIKOLA notifications, Sulo will keep only the id, the subject, the component and event type, when it was created, and whether it has been read. The message body, which may contain grades or lecturer comments, is never stored.',
        },
      },
      {
        kind: 'p',
        text: {
          id: 'Data terikat ke akun SIKOLA-mu. Kalau akun lain login di browser yang sama, data akun sebelumnya dihapus.',
          en: "Data is tied to your SIKOLA account. If a different account logs in on the same browser, the previous account's data is deleted.",
        },
      },
    ],
  },
  {
    heading: { id: 'Yang tidak pernah dilakukan Sulo', en: 'What Sulo never does' },
    blocks: [
      {
        kind: 'ul',
        items: [
          { id: 'Tidak pernah meminta, membaca, atau menyimpan username dan password.', en: 'Never asks for, reads or stores your username or password.' },
          { id: 'Tidak menyimpan cookie, kunci sesi, atau token melewati sesi browser yang sedang berjalan.', en: 'Never stores cookies, session keys or tokens beyond the current browser session.' },
          { id: 'Tidak pernah mengirim datamu ke pengembang, server, atau pihak ketiga mana pun.', en: 'Never sends your data to the developer, to a server, or to any third party.' },
          { id: 'Tanpa analytics, tanpa telemetri, tanpa iklan.', en: 'No analytics, no telemetry, no advertising.' },
          { id: 'Tanpa otomatisasi akademik: Sulo tidak mengisi KRS, survei, atau presensi.', en: 'No automation of academic tasks: Sulo does not fill in course registration, surveys or attendance.' },
        ],
      },
    ],
  },
  {
    heading: { id: 'Koneksi jaringan', en: 'Network requests' },
    blocks: [
      { kind: 'p', text: { id: 'Sulo hanya menghubungi dua tempat:', en: 'Sulo makes requests to two places only:' } },
      {
        kind: 'ol',
        items: [
          {
            id: 'SIKOLA (sikola-v2.unhas.ac.id), untuk membaca datamu sendiri. Maksimal 40 request per hari (biasanya 5 sampai 10), satu per satu, tidak pada jam tenang (00.00 sampai 06.00), dan tidak saat komputermu sedang tidak dipakai.',
            en: 'SIKOLA (sikola-v2.unhas.ac.id), to read your own data. At most 40 requests per day (typically 5 to 10), one at a time, not during quiet hours (00.00 to 06.00), and not while your computer is idle.',
          },
          {
            id: 'Repo data publik Sulo di GitHub Pages (ikrar06.github.io/sulo-data), untuk mengambil berkas konfigurasi kecil, dan kelak kalender akademik. Permintaan ini tidak membawa informasi apa pun tentangmu (tanpa cookie, header tambahan, atau parameter) dan paling sering sekali sehari per berkas. Seperti situs mana pun, GitHub dapat melihat alamat IP-mu saat berkas diambil.',
            en: "Sulo's public data repository on GitHub Pages (ikrar06.github.io/sulo-data), to fetch a small configuration file and, later, the academic calendar. These requests carry no information about you (no cookies, extra headers or parameters) and are made at most once a day per file. As with any website, GitHub can see your IP address when a file is fetched.",
          },
        ],
      },
    ],
  },
  {
    heading: { id: 'Modul opsional', en: 'Optional modules' },
    blocks: [
      {
        kind: 'p',
        text: {
          id: 'Modul opsional, seperti modul NEOSIA yang direncanakan, mati secara bawaan. Sebelum diaktifkan, Sulo menampilkan layar persetujuan yang menjelaskan apa yang dibaca, apa yang dibuang, dan cara mematikannya.',
          en: 'Optional modules, such as the planned NEOSIA module, are off by default. Before one is turned on, Sulo shows a consent screen that explains what it reads, what it discards, and how to turn it off.',
        },
      },
      {
        kind: 'ul',
        items: [
          { id: 'Sulo tidak akan pernah mengirim request ke NEOSIA. Sulo hanya membaca data dari halaman NEOSIA yang kamu buka sendiri.', en: 'Sulo would never send requests to NEOSIA. It would only read data from NEOSIA pages you open yourself.' },
          { id: 'Data identitas (seperti NIK, alamat, tanggal lahir, dan kontak), nominal pembayaran, dan nomor induk dosen dibuang sebelum apa pun disimpan.', en: 'Identity details (such as national ID number, address, date of birth and contact details), payment amounts and lecturer ID numbers are discarded before anything is saved.' },
          { id: 'Nilai dan IPK tersembunyi secara bawaan dan tidak pernah ikut ekspor.', en: 'Grades and GPA are hidden by default and are never included in exports.' },
          { id: 'Mematikan modul menghapus datanya dan mencabut izinnya.', en: 'Turning a module off deletes its data and removes its permissions.' },
        ],
      },
    ],
  },
  {
    heading: { id: 'Menghapus datamu', en: 'Deleting your data' },
    blocks: [
      {
        kind: 'ul',
        items: [
          { id: 'Mencopot ekstensi dari browser menghapus semua datanya. Ini sudah berlaku sekarang.', en: 'Removing the extension from your browser deletes all of its data. This works today.' },
          { id: 'Tombol "Hapus semua data" di pengaturan Sulo direncanakan bersama dashboard, untuk menghapus semuanya tanpa mencopot ekstensi.', en: 'A "Hapus semua data" button in Sulo\'s settings is planned with the dashboard and will delete everything without removing the extension.' },
        ],
      },
    ],
  },
  {
    heading: { id: 'Perubahan kebijakan', en: 'Changes to this policy' },
    blocks: [
      {
        kind: 'p',
        text: {
          id: 'Perubahan diterbitkan bersama versi Sulo yang baru, dan tanggal di atas diperbarui. Kalau isi pemberitahuan privasi di pengaturan awal berubah, Sulo menampilkannya lagi.',
          en: 'Changes are published with new versions of Sulo, and the date at the top is updated. If the privacy notice shown during setup changes, Sulo shows it again.',
        },
      },
    ],
  },
  {
    heading: { id: 'Kontak', en: 'Contact' },
    blocks: [
      {
        kind: 'p',
        text: {
          id: 'Pertanyaan soal privasi bisa disampaikan ke pengelola proyek lewat GitHub (github.com/Ikrar06). Jangan sertakan data pribadi di pesanmu.',
          en: 'Questions about privacy can be raised with the maintainer on GitHub (github.com/Ikrar06). Please do not include personal data in your message.',
        },
      },
    ],
  },
];
