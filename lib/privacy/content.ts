// Single source of the privacy policy. PRIVACY.md (English) is generated from
// this file with `node scripts/build-privacy.ts`, and the in-extension page
// (privacy.html) renders the text in the user's language. A test fails when PRIVACY.md
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

export const PRIVACY_UPDATED: Text = { id: '16 November 2026', en: '16 November 2026' };

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
          { id: 'susunan tiap mata kuliah aktif (bagian dan aktivitas), beberapa kali sehari, untuk mengetahui materi dan tugas baru', en: 'the structure of each active course (sections and activities), a few times a day, to spot new materials and tasks' },
          { id: '20 notifikasi SIKOLA terbarumu, untuk mengetahui nilai, feedback, dan kabar forum baru', en: 'your 20 latest SIKOLA notifications, to spot new grades, feedback and forum posts' },
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
          { id: 'susunan mata kuliah terakhir yang terlihat dan log "Kabar terbaru" (paling banyak 200 entri)', en: 'the last seen structure of each course and the "Latest updates" log (at most 200 entries)' },
          { id: 'pilihanmu: mata kuliah aktif, tugas yang ditandai selesai, dan kelak alias, warna, serta nama panggilan yang kamu isi sendiri', en: 'your choices: active courses, tasks marked done, and later aliases, colors and a nickname you type yourself' },
          { id: 'penghitung pemakaian lokal, yang tidak pernah keluar dari perangkatmu kecuali kamu sendiri mengekspornya', en: 'local usage counters, which never leave your device unless you export them yourself' },
        ],
      },
      {
        kind: 'p',
        text: {
          id: 'Dari notifikasi SIKOLA, Sulo hanya menyimpan id, subjek, komponen dan jenis kejadian, waktu dibuat, status dibaca, alamat halaman terkait (hanya halaman SIKOLA yang dikenal, tanpa parameter selain id), dan nomor mata kuliahnya. Isi pesan (text, fullmessage, fullmessagehtml, smallmessage) dan data tambahan (customdata), yang bisa memuat nilai atau komentar dosen, dibuang saat dibaca dan tidak pernah disimpan. Notifikasi Sulo tentang nilai tidak pernah menyebut angka nilai atau isi komentar.',
          en: "From SIKOLA notifications, Sulo keeps only the id, the subject, the component and event type, when it was created, whether it has been read, the related page address (known SIKOLA pages only, with no parameters other than ids) and the course number. Message bodies (text, fullmessage, fullmessagehtml, smallmessage) and extra data (customdata), which may contain grades or lecturer comments, are dropped when read and never stored. Sulo's own notifications about grades never mention the grade or the comment.",
        },
      },
      {
        kind: 'p',
        text: {
          id: 'Statistik pemakaian lokal (berapa kali popup dan dashboard dibuka, tugas ditandai selesai, dan pengingat tampil) hanya berupa angka dan tersimpan di browsermu. Sulo tidak pernah mengirimnya. Di Pengaturan kamu bisa mengekspornya sebagai berkas dan memutuskan sendiri mau mengirimnya atau tidak.',
          en: 'Local usage statistics (how often the popup and dashboard were opened, tasks marked as done and reminders shown) are numbers only and stay in your browser. Sulo never sends them. In Settings you can export them as a file and decide yourself whether to share it.',
        },
      },
      {
        kind: 'p',
        text: {
          id: 'Data terikat ke akun SIKOLA-mu, dikenali dari nomor pengguna SIKOLA (userid) yang disimpan apa adanya di browsermu. Kalau akun lain masuk ke SIKOLA di browser yang sama, data akun sebelumnya langsung disembunyikan dan Sulo berhenti memeriksa serta mengingatkan. Data itu baru dihapus setelah kamu memilih "Pakai akun ini", atau saat kamu memakai "Hapus semua data". Kalau kamu masuk lagi dengan akun sebelumnya, semuanya muncul kembali.',
          en: "Data is tied to your SIKOLA account, recognised by your SIKOLA user number (userid), stored as is in your browser. If a different account signs in to SIKOLA on the same browser, the previous account's data is hidden at once and Sulo stops checking and reminding. That data is deleted only after you choose \"Use this account\", or when you use \"Delete all data\". If you sign in with the previous account again, everything comes back.",
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
            id: 'Repo data publik Sulo di GitHub Pages (ikrar06.github.io/sulo-data), untuk mengambil berkas konfigurasi kecil dan data kalender akademik. Permintaan ini tidak membawa informasi apa pun tentangmu (tanpa cookie, header tambahan, atau parameter) dan paling sering sekali sehari per berkas. Seperti situs mana pun, GitHub dapat melihat alamat IP-mu saat berkas diambil.',
            en: "Sulo's public data repository on GitHub Pages (ikrar06.github.io/sulo-data), to fetch a small configuration file and the academic calendar data. These requests carry no information about you (no cookies, extra headers or parameters) and are made at most once a day per file. As with any website, GitHub can see your IP address when a file is fetched.",
          },
        ],
      },
      {
        kind: 'p',
        text: {
          id: '"Tambah ke Google Calendar" di menu tugas hanya membuka halaman Google Calendar di tab baru, saat kamu mengekliknya. Halaman itu sudah berisi nama tugas, nama mata kuliah, tenggat, dan tautan ke tugas di SIKOLA. Sulo sendiri tidak mengirim apa pun ke Google dan tidak butuh login; kamu yang memutuskan menyimpannya di Google Calendar.',
          en: '"Add to Google Calendar" in the task menu only opens a Google Calendar page in a new tab when you click it. That page is prefilled with the task name, course name, due time and a link to the task on SIKOLA. Sulo itself sends nothing to Google and needs no login; you decide whether to save it in Google Calendar.',
        },
      },
      {
        kind: 'p',
        text: {
          id: 'Tombol "Traktir kopi" (Trakteer), tautan media sosial, dan "Kirim masukan" (Google Form) di halaman Tentang, serta tautan PDF kalender resmi, hanya membuka situs itu di tab baru saat kamu mengekliknya. Sebelum diklik, Sulo tidak menghubungi situs itu sama sekali, dan tidak ada script, gambar, atau font dari situs itu yang dimuat di halaman Sulo. Sulo tidak mengirim data apa pun ke sana dan tidak mengisi formulir untukmu.',
          en: 'The "Buy me a coffee" button (Trakteer), social media links and "Send feedback" (Google Form) on the About page, and the link to the official calendar PDF, only open that site in a new tab when you click them. Until you click, Sulo does not contact that site at all, and no script, image or font from it is loaded into Sulo\'s pages. Sulo sends no data there and never fills in a form for you.',
        },
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
          { id: '"Hapus semua data" di menu pengaturan popup menghapus semua yang Sulo simpan di browser ini (tugas, mata kuliah, pengingat, kabar terbaru, dan pengaturan) tanpa mencopot ekstensi. Data di SIKOLA tidak tersentuh.', en: '"Delete all data" in the popup settings menu deletes everything Sulo keeps in this browser (tasks, courses, reminders, latest updates and settings) without removing the extension. Nothing in SIKOLA is touched.' },
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
