// The Android app's privacy notice (M8c): what is stored, where, how it is
// protected, every server the app contacts, and how to delete it all.
// Same shape as privacy/content.ts so the same renderer shows it. Keep it
// true to the app: when the app starts contacting anything new, say so here.

import { SIPAKAMASE_CONSENT, type Block, type Section, type Text } from './content.ts';

export const MOBILE_PRIVACY_UPDATED: Text = { id: '22 November 2026', en: '22 November 2026' };

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
      id: 'Sulo tidak resmi dan tidak berafiliasi dengan Universitas Hasanuddin. Singkatnya: datamu tetap di HP ini, sesi SIKOLA disimpan terenkripsi, dan Sulo hanya menghubungi SIKOLA serta repo data publik Sulo.',
      en: 'Sulo is unofficial and not affiliated with Universitas Hasanuddin. In short: your data stays on this phone, the SIKOLA session is stored encrypted, and Sulo only contacts SIKOLA and Sulo’s public data repository.',
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
          { id: 'Struktur mata kuliah untuk Kabar terbaru (nama dan jenis kegiatan, tanpa isinya).', en: 'Course structures for Latest updates (activity names and kinds, not their content).' },
          { id: 'Rekap presensi untuk mata kuliah yang dipantau, dan rincian per pertemuan yang kamu buka.', en: 'The attendance recap for the courses you follow, and the per-session details you open.' },
          { id: 'Pengaturan, dan sesi SIKOLA.', en: 'Your settings, and the SIKOLA session.' },
        ],
      },
      {
        kind: 'p',
        text: {
          id: 'Yang tidak pernah disimpan atau dibaca: password SIKOLA, isi kuis, dan data mahasiswa lain.',
          en: 'Never stored or read: your SIKOLA password, quiz content, and other students’ data.',
        },
      },
      {
        kind: 'p',
        text: {
          id: 'Data terikat ke akun SIKOLA-mu. Kalau akun lain masuk, data akun sebelumnya langsung disembunyikan dan Sulo berhenti mengecek serta mengingatkan, termasuk pemantauan latar belakang. Data itu, juga data NEOSIA-nya, baru dihapus setelah kamu memilih "Pakai akun ini".',
          en: 'Data is tied to your SIKOLA account. When another account signs in, the previous account’s data is hidden at once and Sulo stops checking and reminding, background watching included. That data, its NEOSIA data too, is deleted only after you choose "Use this account".',
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
          { id: 'Sesi SIKOLA dienkripsi dengan AES-256-GCM. Kuncinya ada di Android Keystore dan tidak bisa dikeluarkan dari HP.', en: 'The SIKOLA session is encrypted with AES-256-GCM. Its key lives in the Android Keystore and cannot leave the phone.' },
          { id: 'Sesi itu tidak pernah sampai ke bagian tampilan aplikasi, tidak masuk log, dan tidak ikut info laporan bug.', en: 'The session never reaches the app’s interface code, never goes into a log, and is never part of the bug report info.' },
          { id: 'Kunci aplikasi (opsional) meminta sidik jari atau kunci layar HP setiap Sulo dibuka.', en: 'The optional app lock asks for your fingerprint or the phone’s screen lock whenever Sulo opens.' },
          { id: 'Data Sulo baru bisa dibuka setelah HP dibuka pertama kali sejak dinyalakan. Kalau kunci sesi hilang atau tidak bisa dipakai lagi, sesi yang tidak terbaca dihapus dan Sulo meminta kamu masuk lagi.', en: 'Sulo’s data can only be opened after the phone has been unlocked once since it was turned on. If the session key is lost or can no longer be used, the unreadable session is deleted and Sulo asks you to sign in again.' },
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
            id: 'ikrar06.github.io: repo data publik Sulo, untuk dua berkas data saja, yaitu pengaturan jarak jauh (termasuk apakah pemantauan sedang dimatikan pengelola) dan kalender akademik terbaru. Kalender dibaca paling sering sekali sehari, ditambah saat aplikasi dibuka kalau bacaan terakhir lebih dari 6 jam. Pengaturan jarak jauh dibaca paling sering tiap 6 jam, oleh aplikasi saat dibuka atau oleh pemantauan latar belakang kalau menyala. Permintaannya tidak membawa cookie atau apa pun yang mengenali kamu.',
            en: 'ikrar06.github.io: Sulo’s public data repository, for two data files only: the remote settings (including whether the developer has turned watching off) and the latest academic calendar. The calendar is read at most once a day, plus when you open the app and the last read is over 6 hours old. The remote settings are read at most every 6 hours, by the app when you open it or by background watching if it is on. The request carries no cookie and nothing that identifies you.',
          },
          {
            id: 'neosia.unhas.ac.id (hanya kalau kamu menghubungkan NEOSIA): halaman NEOSIA terbuka di dalam Sulo saat kamu mengetuknya, atau, kalau kamu menyalakan "Perbarui NEOSIA otomatis", saat kamu membuka Sulo dan sudah waktunya (sekali sehari di masa KRS dan masa nilai, sekali seminggu di luar itu). Halaman itu memuat datanya sendiri. Sulo tidak pernah mengirim permintaan ke NEOSIA.',
            en: 'neosia.unhas.ac.id (only if you connect NEOSIA): NEOSIA’s pages open inside Sulo when you tap them, or, if you turn on "Update NEOSIA automatically", when you open Sulo and a visit is due (once a day during KRS and grade periods, once a week otherwise). Those pages load their own data. Sulo never sends a request to NEOSIA.',
          },
          {
            id: 'sipakamase.unhas.ac.id (hanya kalau kamu menghubungkan Sipakamase): masuk di halaman Sipakamase sendiri, lalu GET ke lima halaman MKPK-mu yang hanya-baca. Alamat yang mengubah data ditolak sebelum dikirim. Permintaan menyebut dirinya Sulo dan versinya.',
            en: 'sipakamase.unhas.ac.id (only if you connect Sipakamase): you sign in on Sipakamase’s own page, then Sulo makes GET requests to five read-only pages of your MKPK data. Addresses that change data are refused before they are sent. Requests name themselves as Sulo and its version.',
          },
          {
            id: 'Pengaturan jarak jauh yang sama juga memberi tahu kalau ada versi baru Sulo. Tombol Unduh membuka halaman rilis di github.com lewat browser; Sulo tidak mengunduh atau memasang apa pun sendiri. Untuk perbaikan keamanan, versi lama bisa diminta memperbarui dulu: selama itu Sulo tidak mengecek SIKOLA, dan datamu tetap ada.',
            en: 'The same remote settings also tell you when a new Sulo version is out. Download opens the release page on github.com in your browser; Sulo never downloads or installs anything itself. For a security fix, an old version can be asked to update first: until then Sulo does not check SIKOLA, and your data stays.',
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
    heading: { id: 'Kapan Sulo mengecek SIKOLA', en: 'When Sulo checks SIKOLA' },
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
            id: 'Kalau "Pantau tugas baru" menyala, Sulo mengecek SIKOLA berkala walau aplikasi tertutup: sekitar tiap 20 menit pukul 06.00-22.59 dan tiap 110 menit di malam hari. Setiap cek satu permintaan yang hanya membaca tugas, kabar, dan sisa waktu sesi.',
            en: 'With "Watch for new tasks" on, Sulo checks SIKOLA regularly even when the app is closed: about every 20 minutes from 06:00 to 22:59 and every 110 minutes at night. Each check is one request that only reads tasks, updates and the session’s time left.',
          },
          {
            id: 'Selama fitur ini menyala, sesi SIKOLA-mu tetap aktif di HP ini, karena cek berkala dihitung SIKOLA sebagai aktivitas. Matikan fitur ini kalau kamu tidak mau sesimu tetap aktif.',
            en: 'While it is on, your SIKOLA session stays active on this phone, because SIKOLA counts the checks as activity. Turn it off if you do not want your session kept active.',
          },
          {
            id: 'Mematikannya: Lainnya, Pengaturan, Notifikasi, "Pantau tugas baru". Cek berhenti seketika; sesudah itu Sulo hanya mengecek saat kamu membuka aplikasi, menarik layar, atau mengetuk Perbarui.',
            en: 'To turn it off: More, Settings, Notifications, "Watch for new tasks". Checks stop at once; after that Sulo only checks when you open the app, pull down, or tap Update.',
          },
          {
            id: 'Pengelola Sulo bisa mematikan atau memperlambat pemantauan untuk semua pengguna lewat pengaturan jarak jauh, misalnya kalau ada keberatan dari kampus. Pemantauan membaca pengaturan itu sendiri paling sering tiap 6 jam, jadi perubahannya berlaku tanpa kamu membuka aplikasi. Kalau pengaturan tidak terbaca selama 72 jam, pemantauan berhenti mengecek SIKOLA sampai terbaca lagi.',
            en: 'Sulo’s developer can turn watching off or slow it down for everyone through the remote settings, for example if the university objects. Watching reads those settings itself at most every 6 hours, so a change applies without you opening the app. If the settings cannot be read for 72 hours, watching stops checking SIKOLA until they can.',
          },
          {
            id: 'Kalau kamu tidak membuka Sulo selama 7 hari, pemantauan berhenti dengan satu notifikasi. Buka Sulo untuk melanjutkannya.',
            en: 'If you do not open Sulo for 7 days, watching stops with one notification. Open Sulo to resume it.',
          },
          {
            id: 'Cek berkala ikut batas harian yang sama dengan pengecekan lain, dan tidak pernah mengambil rekap presensi.',
            en: 'The checks count against the same daily limits as every other check, and never fetch the attendance recap.',
          },
        ],
      },
    ],
  },
  {
    heading: { id: 'NEOSIA (pilihan)', en: 'NEOSIA (optional)' },
    blocks: [
      {
        kind: 'ul',
        items: [
          { id: 'Mati sampai kamu menghubungkannya. Kamu masuk di halaman NEOSIA sendiri; Sulo tidak membaca password maupun token login NEOSIA, dan halaman login tidak pernah mendapat skrip Sulo.', en: 'Off until you connect it. You sign in on NEOSIA’s own page; Sulo reads neither your password nor NEOSIA’s sign-in token, and the sign-in page never gets Sulo’s script.' },
          { id: 'Dari halaman yang kamu buka, Sulo menyimpan jadwal kuliah, kelas, status KRS, nama PA, status bayar (lunas atau belum), nilai huruf, IPS, IPK, SKS, masa studi, masa KRS (tanggal buka dan tutup), dan status survei. NIM, NIK, alamat, tanggal lahir, kontak, nilai angka, dan nominal pembayaran dibuang sebelum disimpan. Tautan survei tidak pernah dibaca.', en: 'From the pages you open, Sulo keeps the class schedule, classes, KRS status, your advisor’s name, payment status (paid or not), letter grades, semester and cumulative GPA, credits, study period, the KRS window and the survey status. Student number, national ID number, address, birth date, contacts, numeric scores and payment amounts are dropped before anything is stored. The survey link is never read.' },
          { id: 'Semua data NEOSIA disimpan terenkripsi dengan kunci Android Keystore tersendiri, terpisah dari sesi SIKOLA. Nilai dan IPK tersembunyi secara bawaan, hanya dibuka saat layar Nilai atau kartu Studi menampilkannya, dan tidak pernah masuk notifikasi, ekspor, atau info laporan bug.', en: 'All NEOSIA data is stored encrypted with an Android Keystore key of its own, separate from the SIKOLA session. Grades and GPA are hidden by default, opened only while the Grades screen or the Studies card shows them, and never go into notifications, exports or the bug report info.' },
          { id: 'Selama nilai atau IPK tampil di layar, layar Sulo tidak bisa direkam atau ditangkap aplikasi lain, dan pratinjaunya di daftar aplikasi terbaru kosong.', en: 'While grades or the GPA are on screen, other apps cannot record or capture Sulo’s screen, and its preview in the recent-apps list is blank.' },
        ],
      },
    ],
  },
  {
    heading: { id: 'Sipakamase (pilihan)', en: 'Sipakamase (optional)' },
    blocks: [
      { kind: 'p', text: SIPAKAMASE_CONSENT.how },
      { kind: 'ul', items: [...SIPAKAMASE_CONSENT.kept] },
      { kind: 'p', text: SIPAKAMASE_CONSENT.droppedTitle },
      { kind: 'ul', items: [...SIPAKAMASE_CONSENT.dropped] },
      {
        kind: 'ul',
        items: [
          {
            id: 'Cookie sesi Sipakamase disimpan terenkripsi dengan kunci Android Keystore tersendiri, tidak pernah keluar dari HP, dan tidak pernah sampai ke JavaScript. Data MKPK-nya di berkas terenkripsi tersendiri per akun.',
            en: 'The Sipakamase session cookie is kept encrypted with an Android Keystore key of its own, never leaves the phone and never reaches JavaScript. Its MKPK data is in an encrypted file of its own, per account.',
          },
          {
            id: 'Penjagaan sesi di latar belakang hanya ikut cek "Pantau tugas baru" yang sudah membangunkan HP, tanpa bangun tambahan. Isi halaman yang diambil di latar belakang tidak disimpan; datamu diperbarui saat kamu membuka Sulo.',
            en: 'Keeping the session in the background only rides the "Watch for new tasks" check that already wakes the phone, with no wake of its own. Pages fetched in the background are not kept; your data updates when you open Sulo.',
          },
          {
            id: 'Kapan saja, lewat Pengaturan lalu "Putuskan". Semua data dan sesi Sipakamase di HP ini langsung terhapus.',
            en: 'Any time, in Settings with "Disconnect". All Sipakamase data and its session on this phone are deleted at once.',
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
          { id: 'Lainnya, Pengaturan, NEOSIA, Putuskan NEOSIA: menghapus semua data NEOSIA beserta sesi NEOSIA di HP ini. Keluar juga menghapusnya.', en: 'More, Settings, NEOSIA, Disconnect NEOSIA: deletes all NEOSIA data and the NEOSIA sign-in on this phone. Signing out deletes it too.' },
          { id: 'Menghapus aplikasi juga menghapus semuanya.', en: 'Uninstalling the app deletes everything too.' },
          { id: 'Data di SIKOLA dan NEOSIA tidak tersentuh.', en: 'Nothing on SIKOLA or NEOSIA changes.' },
        ],
      },
    ],
  },
];
