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

export const PRIVACY_UPDATED: Text = { id: '27 November 2026', en: '27 November 2026' };

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


/**
 * The NEOSIA consent text (M7). The consent dialog before Chrome's
 * permission prompt (components/dashboard/NeosiaConsent.tsx, through
 * lib/neosia/consent.ts) and the NEOSIA section below render this same
 * object, so the two always say the same thing.
 */
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
    { id: 'Masa KRS (tanggal buka dan tutup) dan status KRS, serta kuota SKS', en: 'The KRS window and status, and your credit limit' },
    { id: 'Sudah bayar atau belum, tanpa nominal', en: 'Paid or not paid, without amounts' },
    { id: 'Status survei: sudah diisi atau belum', en: 'The survey status: filled in or not' },
    { id: 'Nilai huruf, IPS, IPK, dan SKS. Tersembunyi sampai kamu memilih Tampilkan', en: 'Letter grades, semester and overall GPA, and credits. Hidden until you choose Show' },
    { id: 'Semester dan masa studi', en: 'Your semester and study period' },
    { id: 'Nama dosen PA', en: 'Your academic advisor’s name' },
  ],
  droppedTitle: { id: 'Yang dibuang sebelum keluar dari halaman NEOSIA', en: 'What is dropped before it leaves the NEOSIA page' },
  dropped: [
    { id: 'NIM, NIK, dan NISN', en: 'Student number, national ID and school ID numbers' },
    { id: 'Kontak: email dan nomor HP', en: 'Contact details: email and phone number' },
    { id: 'Alamat dan tanggal lahir', en: 'Address and date of birth' },
    { id: 'Nominal dan bank pembayaran', en: 'Payment amounts and bank' },
    { id: 'Nilai angka', en: 'Numeric grades' },
    { id: 'NIP, NIDN, dan NUPTK dosen', en: 'Lecturers’ NIP, NIDN and NUPTK numbers' },
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

/** The Sipakamase consent (1.1.0, docs/mkpk/RENCANA-RINCI.md E): the dialog and the privacy page render this object. */
export const SIPAKAMASE_CONSENT: ConsentText = {
  title: { id: 'Hubungkan Sipakamase?', en: 'Connect Sipakamase?' },
  how: {
    id: 'Sulo membaca kegiatan MKPK-mu, SKS yang sudah dikonversi, dan mata kuliah yang sudah lulus, supaya kamu melihat progresnya di satu tempat. Kamu masuk di halaman Sipakamase sendiri. Sulo tidak melihat kata sandimu.',
    en: 'Sulo reads your MKPK activities, the credits already converted and the courses you passed, so you see your progress in one place. You sign in on Sipakamase’s own page. Sulo never sees your password.',
  },
  keptTitle: { id: 'Cara Sulo menjaganya', en: 'How Sulo keeps it up to date' },
  kept: [
    {
      id: 'Selama ada yang kamu tunggu (kegiatan yang belum selesai diproses, atau nilai yang belum sampai NEOSIA), Sulo mengambil satu dari lima halaman MKPK-mu tiap 3 jam. Itu memperbarui datamu dan membuatmu tidak diminta masuk terus. Selama itu sesi Sipakamase-mu tetap aktif di perangkat ini.',
      en: 'While you are waiting for something (an activity not processed yet, or a grade not in NEOSIA yet), Sulo reads one of your five MKPK pages every 3 hours. That keeps your data current and keeps you from being asked to sign in again and again. Meanwhile your Sipakamase session stays active on this device.',
    },
    {
      id: 'Kalau tidak ada yang ditunggu, Sulo berhenti mengambil apa pun sampai kamu membuka Sipakamase atau menekan Perbarui sekarang.',
      en: 'When nothing is waited for, Sulo stops reading until you open Sipakamase or press Update now.',
    },
    {
      id: 'Sulo hanya membaca. Ia tidak mengisi, menghapus, mengonversi, atau mengklaim apa pun.',
      en: 'Sulo only reads. It never fills in, deletes, converts or claims anything.',
    },
  ],
  droppedTitle: { id: 'Yang tidak dibaca', en: 'What is never read' },
  dropped: [
    { id: 'NIM, email, dan nomor HP', en: 'Your student number, email and phone number' },
    { id: 'Nama dosen pendamping dan verifikator', en: 'The names of companions and verifiers' },
    { id: 'Isi obrolan dan notifikasi', en: 'Chat messages and notifications' },
    { id: 'Angka nilai', en: 'Numeric grades' },
  ],
  offTitle: { id: 'Memutuskan', en: 'Disconnecting' },
  off: {
    id: 'Kapan saja, lewat Pengaturan lalu "Putuskan". Semua data Sipakamase langsung terhapus dan izinnya dicabut.',
    en: 'Any time, in Settings with "Disconnect". All Sipakamase data is deleted at once and the permission is removed.',
  },
  unofficial: NEOSIA_CONSENT.unofficial,
};

/**
 * The iPhone's Sipakamase consent (owner's decision of 26 Nov 2026, B3): its keeper runs only when iOS
 * gives the SIKOLA keeper time, so the first point promises nothing about the session. The rest as above.
 */
export const SIPAKAMASE_CONSENT_IPHONE: ConsentText = {
  ...SIPAKAMASE_CONSENT,
  kept: [
    {
      id: 'Selama ada yang kamu tunggu (kegiatan yang belum selesai diproses, atau nilai yang belum sampai NEOSIA), Sulo mengambil satu dari lima halaman MKPK-mu paling sering tiap 3 jam: saat kamu membuka Sulo, dan saat iPhone memberi waktu ke "Jaga sesi SIKOLA". Itu memperbarui datamu dan membuat sesimu lebih jarang habis, tapi iPhone tidak menjamin waktunya.',
      en: 'While you are waiting for something (an activity not processed yet, or a grade not in NEOSIA yet), Sulo reads one of your five MKPK pages at most every 3 hours: when you open Sulo, and when the iPhone gives "Keep the SIKOLA session" time. That keeps your data current and your session from ending as often, but the iPhone does not promise when.',
    },
    ...SIPAKAMASE_CONSENT.kept.slice(1),
  ],
};

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
          { id: 'susunan tiap mata kuliah yang dipantau (bagian dan aktivitas), beberapa kali sehari, untuk mengetahui materi dan tugas baru', en: 'the structure of each course you follow (sections and activities), a few times a day, to spot new materials and tasks' },
          { id: '20 notifikasi SIKOLA terbarumu, untuk mengetahui nilai, feedback, dan kabar forum baru', en: 'your 20 latest SIKOLA notifications, to spot new grades, feedback and forum posts' },
          { id: 'halaman nilai sebuah mata kuliah (atau halaman tugasnya, kalau halaman nilai itu tidak terbaca), hanya saat kamu memilih Lihat nilai: nilai tiap tugas saja, tanpa komentar dosen, nama penilai, bobot, atau berkas', en: "a course's grade page (or the task's own page, when that page cannot be read), only when you choose See grade: each task's grade only, never lecturer comments, the grader's name, weights or files" },
        ],
      },
      {
        kind: 'p',
        text: {
          id: 'Sulo hanya membaca. Sulo tidak pernah mengumpulkan tugas, tidak menandai apa pun sebagai dibaca, tidak mengubah data di SIKOLA, tidak membaca isi kuis, dan tidak membaca data mahasiswa lain.',
          en: "Sulo only reads. It never submits work, never marks anything as read, never changes data on SIKOLA, never reads quiz content, and never reads other students' data.",
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
          { id: 'mata kuliah, tugas, dan tenggat, serta tugas yang kamu tambahkan sendiri (judul, mata kuliah, dan tenggat yang kamu isi)', en: 'courses, assignments and due dates, and the tasks you add yourself (the title, course and due date you type)' },
          { id: 'rekap presensi dari SIKOLA, diperbarui otomatis paling sering sekali sehari, dan rincian per pertemuan yang diambil hanya saat kamu membukanya (untuk mata kuliah yang dipantau: sesi tercatat, poin, persentase, status, dan keterangan)', en: 'your attendance recap from SIKOLA, updated automatically at most once a day, and the per-session details, fetched only when you open them (for the courses you follow: sessions recorded, points, percentage, status, and remarks)' },
          { id: 'susunan mata kuliah terakhir yang terlihat dan log "Kabar terbaru" (paling banyak 200 entri)', en: 'the last seen structure of each course and the "Latest updates" log (at most 200 entries)' },
          { id: 'tugas yang sudah selesai atau lewat tenggat, sampai akhir semester mata kuliahnya, supaya riwayat dan nilainya masih bisa dilihat', en: 'finished and past-due tasks, until their course ends for the semester, so you can still look back at them and their grades' },
          { id: 'nilai tugas yang kamu lihat lewat Lihat nilai, selama tugasnya ada di Sulo; diambil ulang dari SIKOLA paling cepat sehari sekali, kecuali kamu memilih Cek lagi; tidak pernah dikirim, disalin, atau muncul di notifikasi', en: 'task grades you looked at with See grade, while the task is in Sulo; fetched again from SIKOLA at most once a day unless you choose Check again; never sent, copied or shown in a notification' },
          { id: 'pilihanmu: mata kuliah yang dipantau, tugas yang ditandai selesai, nama tampilan dan warna mata kuliah, serta nama panggilan yang kamu isi sendiri', en: 'your choices: the courses you follow, tasks marked done, course display names and colors, and a nickname you type yourself' },
          { id: 'log teknis 300 pengecekan terakhir ke SIKOLA: hanya waktu, nama fungsi, dan status, tanpa isi apa pun; tidak pernah dikirim, dan hanya ikut kalau kamu sendiri menyalin "info untuk laporan bug"', en: 'a technical log of the last 300 checks of SIKOLA: only the time, the function names and the status, with no content; never sent, and only included when you copy "info for a bug report" yourself' },
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
          id: 'Statistik pemakaian lokal (berapa kali popup dan dashboard dibuka, tugas ditandai selesai, dan pengingat tampil) hanya berupa angka dan tersimpan di browsermu. Sulo tidak pernah mengirimnya. Angka ini tidak ditampilkan dan tidak bisa diekspor di versi biasa; hanya build pengembangan yang menampilkannya.',
          en: 'Local usage statistics (how often the popup and dashboard were opened, tasks marked as done and reminders shown) are numbers only and stay in your browser. Sulo never sends them. They are not shown and cannot be exported in the regular version; only development builds show them.',
        },
      },
      {
        kind: 'p',
        text: {
          id: 'Data terikat ke akun SIKOLA-mu, dikenali dari nomor pengguna SIKOLA (userid) yang disimpan apa adanya di browsermu. Kalau akun lain masuk ke SIKOLA di browser yang sama, data akun sebelumnya langsung disembunyikan dan Sulo berhenti mengecek serta mengingatkan. Data itu baru dihapus setelah kamu memilih "Pakai akun ini", atau saat kamu memakai "Hapus semua data". Kalau kamu masuk lagi dengan akun sebelumnya, semuanya muncul kembali.',
          en: "Data is tied to your SIKOLA account, recognized by your SIKOLA user number (userid), stored as is in your browser. If a different account signs in to SIKOLA on the same browser, the previous account's data is hidden at once and Sulo stops checking and reminding. That data is deleted only after you choose \"Use this account\", or when you use \"Delete all data\". If you sign in with the previous account again, everything comes back.",
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
      { kind: 'p', text: { id: 'Sulo hanya menghubungi tempat-tempat ini:', en: 'Sulo makes requests to these places only:' } },
      {
        kind: 'ol',
        items: [
          {
            id: 'SIKOLA (sikola-v2.unhas.ac.id), untuk membaca datamu sendiri. Sulo mengecek SIKOLA seperlunya, satu per satu. Ada batas pengaman 150 permintaan per hari. Kalau batas itu tercapai, Sulo berhenti mengecek sampai besok. Sulo tidak mengecek sendiri pada jam tenang (00.00 sampai 06.00) dan saat komputermu sedang tidak dipakai. Kalau kamu menyalakan "Pantau tugas baru", Sulo mengecek tiap 15 menit selama komputermu dipakai dan saat kamu membuka Sulo, dan selama itu sesi SIKOLA-mu tetap aktif di browser ini. Setelah 7 hari Sulo tidak dibuka, pantauan berhenti sampai kamu membukanya lagi.',
            en: 'SIKOLA (sikola-v2.unhas.ac.id), to read your own data. Sulo checks SIKOLA only as needed, one request at a time. A safety limit caps it at 150 requests a day. If Sulo reaches the limit, it stops checking until the next day. Sulo does not check on its own during quiet hours (00:00 to 06:00) or while your computer is idle. If you turn on "Watch for new tasks", Sulo checks every 15 minutes while your computer is in use and when you open Sulo, and meanwhile your SIKOLA session stays active in this browser. After 7 days without Sulo being opened, watching stops until you open it again.',
          },
          {
            id: 'Repo data publik Sulo di GitHub Pages (ikrar06.github.io/sulo-data), untuk mengambil berkas konfigurasi kecil dan data kalender akademik. Permintaan ini tidak membawa informasi apa pun tentangmu (tanpa cookie, header tambahan, atau parameter) dan paling sering sekali sehari per berkas. Seperti situs mana pun, GitHub dapat melihat alamat IP-mu saat berkas diambil.',
            en: "Sulo's public data repository on GitHub Pages (ikrar06.github.io/sulo-data), to fetch a small configuration file and the academic calendar data. These requests carry no information about you (no cookies, extra headers or parameters) and are made at most once a day per file. As with any website, GitHub can see your IP address when a file is fetched.",
          },
          {
            id: 'Sipakamase (sipakamase.unhas.ac.id), hanya kalau kamu menghubungkannya: permintaan GET ke lima halaman MKPK-mu yang hanya-baca, tidak ke alamat lain. Lihat bagian Modul Sipakamase.',
            en: 'Sipakamase (sipakamase.unhas.ac.id), only if you connect it: GET requests to five read-only pages of your MKPK data, never any other address. See the Sipakamase module section.',
          },
        ],
      },
      {
        kind: 'p',
        text: {
          id: '"Tambah ke Google Kalender" di menu tugas hanya membuka halaman Google Kalender di tab baru, saat kamu mengekliknya. Halaman itu sudah berisi nama tugas, nama mata kuliah, tenggat, dan tautan ke tugas di SIKOLA. Sulo sendiri tidak mengirim apa pun ke Google dan tidak butuh login; kamu yang memutuskan menyimpannya di Google Kalender.',
          en: '"Add to Google Calendar" in the task menu only opens a Google Calendar page in a new tab when you click it. That page is prefilled with the task name, course name, due time and a link to the task on SIKOLA. Sulo itself sends nothing to Google and needs no sign-in; you decide whether to save it in Google Calendar.',
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
    heading: { id: 'Modul NEOSIA (opsional)', en: 'NEOSIA module (optional)' },
    blocks: [
      {
        kind: 'p',
        text: {
          id: 'Mati secara bawaan. Kalau kamu menyalakan "Hubungkan NEOSIA" di Pengaturan, Sulo lebih dulu menampilkan layar persetujuan dengan isi di bawah ini, lalu Chrome menanyakan izinnya.',
          en: 'Off by default. If you turn on "Connect NEOSIA" in Settings, Sulo first shows a consent screen with the text below, then Chrome asks for its permission.',
        },
      },
      { kind: 'p', text: NEOSIA_CONSENT.how },
      { kind: 'p', text: NEOSIA_CONSENT.keptTitle },
      { kind: 'ul', items: [...NEOSIA_CONSENT.kept] },
      { kind: 'p', text: NEOSIA_CONSENT.droppedTitle },
      { kind: 'ul', items: [...NEOSIA_CONSENT.dropped] },
      { kind: 'p', text: NEOSIA_CONSENT.offTitle },
      { kind: 'p', text: NEOSIA_CONSENT.off },
      {
        kind: 'ul',
        items: [
          {
            id: 'Izinnya opsional: "scripting" dan akses ke halaman neosia.unhas.ac.id. Keduanya hanya diminta saat kamu menyalakan modul, dan dicabut saat modul dimatikan. Sulo tidak meminta akses ke alamat API NEOSIA. Kalau kamu mencabut salah satunya lewat pengaturan Chrome, modul mati sendiri dan datanya terhapus.',
            en: 'Its permissions are optional: "scripting" and access to the neosia.unhas.ac.id pages. Both are asked for only when you turn the module on, and removed when it is turned off. Sulo does not ask for access to the NEOSIA API address. If you remove one in Chrome\'s settings, the module turns itself off and its data is deleted.',
          },
          {
            id: 'Sulo tidak pernah mengirim request ke NEOSIA. Dua skrip kecil di halaman NEOSIA membaca respons yang sudah diminta aplikasi NEOSIA sendiri, memilah field yang boleh disimpan di halaman itu juga, lalu membuang sisanya. Respons lengkapnya tidak pernah disimpan, dicatat, atau dikirim.',
            en: 'Sulo never sends a request to NEOSIA. Two small scripts on NEOSIA pages read the responses the NEOSIA app already asked for, pick out the fields that may be kept right there on the page, and drop the rest. The full responses are never stored, logged or sent.',
          },
          {
            id: 'Tautan survei, data pribadimu di NEOSIA, dan halaman pengunduran diri tidak pernah dibaca. Token login NEOSIA tidak pernah dibaca.',
            en: 'The survey link, your personal data page in NEOSIA and the withdrawal page are never read. The NEOSIA sign-in token is never read.',
          },
          {
            id: 'Nilai dan IPK tidak pernah masuk notifikasi, ekspor, daftar yang disalin, berkas kalender, atau info laporan bug. Notifikasi nilai baru hanya menyebut nama mata kuliah.',
            en: 'Grades and GPA never appear in notifications, exports, copied lists, calendar files or bug report info. A new-grade notification names the course only.',
          },
          {
            id: 'Mode privasi (Pengaturan, atau ikon mata di dashboard) menyamarkan nama, nilai, IPK, IPS, SKS, dan persentase presensi di layar.',
            en: 'Privacy mode (in Settings, or the eye icon in the dashboard) masks names, grades, GPA, semester GPA, credits and attendance percentages on screen.',
          },
          {
            id: 'Tidak ada otomatisasi: Sulo tidak mengisi KRS, survei, atau presensi, dan tidak memantau kuota kelas.',
            en: 'No automation: Sulo never fills in KRS, surveys or attendance, and never watches class capacity.',
          },
        ],
      },
    ],
  },
  {
    heading: { id: 'Modul Sipakamase (opsional)', en: 'Sipakamase module (optional)' },
    blocks: [
      {
        kind: 'p',
        text: {
          id: 'Mati secara bawaan. Kalau kamu menekan "Hubungkan" di Pengaturan, Sulo lebih dulu menampilkan layar persetujuan dengan isi di bawah ini; di ekstensi, Chrome lalu menanyakan izinnya.',
          en: 'Off by default. If you press "Connect" in Settings, Sulo first shows a consent screen with the text below; in the extension, Chrome then asks for its permission.',
        },
      },
      { kind: 'p', text: SIPAKAMASE_CONSENT.how },
      { kind: 'p', text: SIPAKAMASE_CONSENT.keptTitle },
      { kind: 'ul', items: [...SIPAKAMASE_CONSENT.kept] },
      { kind: 'p', text: SIPAKAMASE_CONSENT.droppedTitle },
      { kind: 'ul', items: [...SIPAKAMASE_CONSENT.dropped] },
      { kind: 'p', text: SIPAKAMASE_CONSENT.offTitle },
      { kind: 'p', text: SIPAKAMASE_CONSENT.off },
      {
        kind: 'ul',
        items: [
          {
            id: 'Yang disimpan, di perangkat ini saja: per kegiatan semester, basis, jenis, nama, status, ada tidaknya pendamping dan nilai, SKS yang dikonversi; mata kuliah MKPK yang lulus dengan SKS-nya dan sudah di NEOSIA atau belum; kode dan jenis mata kuliah yang diprogramkan.',
            en: 'What is kept, on this device only: per activity its semester, basis, kind, name, status, whether it has a companion and a score, its converted credits; passed MKPK courses with their credits and whether they reached NEOSIA; the codes and kinds of the courses in your KRS.',
          },
          {
            id: 'Sulo hanya meminta lima alamat tetap, dengan GET, tanpa parameter, dan tidak pernah mengikuti tautan dari halamannya. Alamat yang mengubah data (menghapus kegiatan, mengonversi, mengklaim, keluar) ditolak sebelum dikirim.',
            en: 'Sulo asks for five fixed addresses only, with GET, without parameters, and never follows a link from its pages. Addresses that change data (deleting an activity, converting, claiming, signing out) are refused before they are sent.',
          },
          {
            id: 'Ekstensi: izinnya opsional ("scripting" dan akses ke sipakamase.unhas.ac.id), diminta saat menghubungkan dan dicabut saat memutuskan. Satu skrip kecil di halaman kegiatan, riwayat, konversi, dan klaim membaca yang kamu buka sendiri, tanpa request; halaman login dan beranda tidak pernah mendapat skrip.',
            en: 'Extension: its permissions are optional ("scripting" and access to sipakamase.unhas.ac.id), asked for when connecting and removed when disconnecting. One small script on the activity, history, conversion and claim pages reads what you open yourself, without a request; the login page and the home page never get a script.',
          },
          {
            id: 'Android: kamu masuk di halaman Sipakamase sendiri dalam layar tanpa skrip. Cookie sesinya disimpan terenkripsi dengan kunci Android Keystore tersendiri, tidak pernah keluar dari HP, dan terhapus saat Putuskan atau Keluar. Penjagaan sesi di latar belakang hanya ikut cek "Pantau tugas baru" yang sudah berjalan; isi halamannya tidak disimpan.',
            en: 'Android: you sign in on Sipakamase\'s own page in a screen without any script. Its session cookie is kept encrypted with an Android Keystore key of its own, never leaves the phone, and is deleted by Disconnect or Sign out. Keeping the session in the background only rides the "Watch for new tasks" check that already runs; the pages\' content is not kept.',
          },
          {
            id: 'iPhone: kamu masuk di halaman Sipakamase sendiri dalam layar tanpa skrip. Cookie sesinya disimpan di Keychain iPhone, tidak pernah keluar dari iPhone, dan terhapus saat Putuskan atau Keluar. Penjagaan sesi di latar belakang hanya ikut "Jaga sesi SIKOLA" saat iPhone memberinya waktu; isi halamannya tidak disimpan.',
            en: 'iPhone: you sign in on Sipakamase\'s own page in a screen without any script. Its session cookie is kept in the iPhone\'s Keychain, never leaves the iPhone, and is deleted by Disconnect or Sign out. Keeping the session in the background only rides "Keep the SIKOLA session" when the iPhone gives it time; the pages\' content is not kept.',
          },
          {
            id: 'Setelah 7 hari Sulo tidak dibuka, penjagaan berhenti dan kamu diminta menghubungkan lagi.',
            en: 'After 7 days without Sulo being opened, keeping stops and you are asked to connect again.',
          },
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
          { id: '"Hapus semua data" di Pengaturan (bagian "Hapus data") menghapus semua yang Sulo simpan di browser ini (tugas, mata kuliah, pengingat, kabar terbaru, dan pengaturan) tanpa mencopot ekstensi. Data di SIKOLA tidak tersentuh.', en: '"Delete all data" in Settings (under "Delete data") deletes everything Sulo keeps in this browser (tasks, courses, reminders, latest updates and settings) without removing the extension. Nothing on SIKOLA is touched.' },
          { id: '"Putuskan dan hapus data" di kartu NEOSIA (Pengaturan) menghapus semua data NEOSIA dan mencabut izinnya. "Hapus semua data" juga mematikan modul NEOSIA.', en: '"Disconnect and delete data" on the NEOSIA card (Settings) deletes all NEOSIA data and removes its permissions. "Delete all data" also turns the NEOSIA module off.' },
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
          id: 'Pertanyaan soal privasi bisa dikirim lewat formulir masukan: https://forms.gle/XsBuWXGHNR4pPTs17. Jangan sertakan NIM, password, nilai, atau data pribadi lain di pesanmu.',
          en: 'Questions about privacy can be sent through the feedback form: https://forms.gle/XsBuWXGHNR4pPTs17. Please do not include your student number, password, grades or other personal data in your message.',
        },
      },
    ],
  },
];
