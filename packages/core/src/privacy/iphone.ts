// The iPhone app's privacy notice (owner's decision of 26 Nov 2026, B3): the Android notice where it holds
// on the iPhone word for word (taken from privacy/mobile.ts, so the two never drift), and the iPhone's own
// words where it differs: the Keychain instead of the Android Keystore, backups, a session keeper that runs
// only when iOS gives it time, screenshots iOS lets no app block, and the weekly refresh through Sideloadly.
// mobilePrivacy() picks the one for this phone (i18n/os.ts). Keep it true to the app (Swift in
// apps/mobile/ios/App/App/Sulo): when the app starts doing anything new, say so here.

import { mobileOs } from '../i18n/os.ts';
import { SIPAKAMASE_CONSENT, SIPAKAMASE_CONSENT_IPHONE, type Block, type ConsentText, type Section, type Text } from './content.ts';
import {
  MOBILE_PRIVACY_INTRO,
  MOBILE_PRIVACY_SECTIONS,
  MOBILE_PRIVACY_SERVERS_HEADING,
  MOBILE_PRIVACY_SUMMARY,
  MOBILE_PRIVACY_TITLE,
  MOBILE_PRIVACY_UPDATED,
} from './mobile.ts';

/** An Android section, by its English heading. Throws when it is gone (tested), so a rename is caught. */
function androidSection(headingEn: string): Section {
  const s = MOBILE_PRIVACY_SECTIONS.find((x) => x.heading.en === headingEn);
  if (!s) throw new Error(`privacy: no Android section "${headingEn}"`);
  return s;
}

/** One Android list item the iPhone shares as is, found by how its English text starts. */
function androidItem(headingEn: string, startsWith: string): Text {
  for (const b of androidSection(headingEn).blocks) {
    if (b.kind === 'p') continue;
    const item = b.items.find((t) => t.en.startsWith(startsWith));
    if (item) return item;
  }
  throw new Error(`privacy: no Android item "${startsWith}" in "${headingEn}"`);
}

/** One Android block the iPhone shares as is, by its position in the section. */
function androidBlock(headingEn: string, index: number): Block {
  const b = androidSection(headingEn).blocks[index];
  if (!b) throw new Error(`privacy: no block ${index} in "${headingEn}"`);
  return b;
}

const STORED = 'What is stored';
const SERVERS = MOBILE_PRIVACY_SERVERS_HEADING;
const NEOSIA = 'NEOSIA (optional)';
const DELETE = 'How to delete it';

export const IPHONE_PRIVACY_TITLE: Text = { id: 'Privasi di aplikasi iPhone', en: 'Privacy in the iPhone app' };

export const IPHONE_PRIVACY_SUMMARY: typeof MOBILE_PRIVACY_SUMMARY = MOBILE_PRIVACY_SUMMARY.map((p) =>
  p.icon === 'shield' ? { ...p, title: { id: 'Data tetap di iPhone ini', en: 'Data stays on this iPhone' } } : p,
);

export const IPHONE_PRIVACY_INTRO: Block[] = [
  {
    kind: 'p',
    text: {
      id: 'Sulo tidak resmi dan tidak berafiliasi dengan Universitas Hasanuddin. Singkatnya: datamu tetap di iPhone ini, sesi SIKOLA disimpan di Keychain iPhone, dan Sulo hanya menghubungi SIKOLA serta repo data publik Sulo.',
      en: 'Sulo is unofficial and not affiliated with Universitas Hasanuddin. In short: your data stays on this iPhone, the SIKOLA session is kept in the iPhone’s Keychain, and Sulo only contacts SIKOLA and Sulo’s public data repository.',
    },
  },
];

export const IPHONE_PRIVACY_SECTIONS: Section[] = [
  {
    heading: { id: 'Apa yang disimpan', en: STORED },
    blocks: [
      androidBlock(STORED, 0),
      androidBlock(STORED, 1),
      {
        kind: 'p',
        text: {
          id: 'Data terikat ke akun SIKOLA-mu. Kalau akun lain masuk, data akun sebelumnya langsung disembunyikan dan Sulo berhenti mengecek serta mengingatkan, termasuk penjaga sesi. Data itu, juga data NEOSIA-nya, baru dihapus setelah kamu memilih "Pakai akun ini".',
          en: 'Data is tied to your SIKOLA account. When another account signs in, the previous account’s data is hidden at once and Sulo stops checking and reminding, the session keeper included. That data, its NEOSIA data too, is deleted only after you choose "Use this account".',
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
          id: 'Semuanya di penyimpanan pribadi aplikasi di iPhone ini, yang tidak bisa dibaca aplikasi lain. Berkas Sulo, termasuk data halaman NEOSIA yang terbuka di dalam Sulo, dikecualikan dari cadangan iCloud dan cadangan ke komputer. Yang tetap ikut cadangan hanya dua penanda tanpa data (apakah sesi tersambung, dan apakah ada pembaruan yang menunggu aplikasi dibuka), serta isi Keychain yang hanya bisa dipakai di iPhone ini.',
          en: 'Everything is in the app’s private storage on this iPhone, which other apps cannot read. Sulo’s files, the data of NEOSIA’s pages opened inside Sulo included, are excluded from iCloud and computer backups. All a backup still holds is two flags without data (whether a session is connected, and whether an update waits for the app to open) and the Keychain items, which only work on this iPhone.',
        },
      },
      {
        kind: 'p',
        text: {
          id: 'Tambah ke Kalender iPhone memakai lembar tambah-acara bawaan iOS: kamu yang menyimpannya, dan acaranya ada di Kalender, bukan di Sulo. Sulo tidak membaca kalendermu. Di iOS 17 ke atas tidak ada izin yang diminta; di iOS 16, iPhone meminta izin Kalender sekali, saat pertama dipakai.',
          en: 'Add to iPhone Calendar uses iOS’s own add-event sheet: you save it, and the event lives in Calendar, not in Sulo. Sulo never reads your calendar. iOS 17 and later ask for no permission; on iOS 16 the iPhone asks for Calendar access once, the first time.',
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
          {
            id: 'Sesi SIKOLA disimpan di Keychain iPhone, hanya untuk iPhone ini: tidak pindah ke iPhone lain, juga lewat cadangan.',
            en: 'The SIKOLA session is kept in the iPhone’s Keychain, for this iPhone only: it never moves to another iPhone, through a backup either.',
          },
          androidItem('Encryption', 'The session never reaches'),
          {
            id: 'Kunci aplikasi (opsional) meminta Face ID, Touch ID, atau kode iPhone setiap Sulo dibuka.',
            en: 'The optional app lock asks for Face ID, Touch ID or the iPhone’s passcode whenever Sulo opens.',
          },
          {
            id: 'Data Sulo baru bisa dibuka setelah iPhone dibuka pertama kali sejak dinyalakan. Kalau sesi tidak bisa dibaca lagi, sesi itu dihapus dan Sulo meminta kamu masuk lagi. Saat Sulo dipasang dari awal, isi Keychain yang tersisa dari pemasangan sebelumnya langsung dihapus.',
            en: 'Sulo’s data can only be opened after the iPhone has been unlocked once since it was turned on. If the session can no longer be read, it is deleted and Sulo asks you to sign in again. When Sulo is installed from scratch, anything an earlier install left in the Keychain is deleted at once.',
          },
        ],
      },
    ],
  },
  {
    heading: { id: 'Server yang dihubungi', en: SERVERS },
    blocks: [
      {
        kind: 'ul',
        items: [
          androidItem(SERVERS, 'sikola-v2.unhas.ac.id'),
          {
            id: 'ikrar06.github.io: repo data publik Sulo, untuk dua berkas data saja, yaitu pengaturan jarak jauh (termasuk apakah penjaga sesi sedang dimatikan pengelola) dan kalender akademik terbaru. Kalender dibaca paling sering sekali sehari, ditambah saat aplikasi dibuka kalau bacaan terakhir lebih dari 6 jam. Pengaturan jarak jauh dibaca paling sering tiap 6 jam, saat aplikasi dibuka; penjaga sesi tidak membacanya sendiri. Permintaannya tidak membawa cookie atau apa pun yang mengenali kamu.',
            en: 'ikrar06.github.io: Sulo’s public data repository, for two data files only: the remote settings (including whether the developer has turned the session keeper off) and the latest academic calendar. The calendar is read at most once a day, plus when you open the app and the last read is over 6 hours old. The remote settings are read at most every 6 hours, when you open the app; the session keeper never reads them itself. The request carries no cookie and nothing that identifies you.',
          },
          androidItem(SERVERS, 'neosia.unhas.ac.id'),
          androidItem(SERVERS, 'sipakamase.unhas.ac.id'),
          {
            id: 'Pengaturan jarak jauh yang sama juga memberi tahu kalau ada versi baru Sulo untuk iPhone. "Cara memperbarui" membuka panduannya di sulo.ikrar.dev lewat browser, dan "Kirim tautan ke laptop" membuka lembar bagikan iPhone berisi tautan itu saja; kamu yang memilih tujuannya. Sulo tidak mengunduh atau memasang apa pun sendiri. Untuk perbaikan keamanan, versi lama bisa diminta memperbarui dulu: selama itu Sulo tidak mengecek SIKOLA, dan data terakhirmu tetap bisa dilihat.',
            en: 'The same remote settings also tell you when a new Sulo version for iPhone is out. "How to update" opens its guide on sulo.ikrar.dev in your browser, and "Send the link to my laptop" opens the iPhone’s share sheet with that link only; you choose where it goes. Sulo never downloads or installs anything itself. For a security fix, an old version can be asked to update first: until then Sulo does not check SIKOLA, and your latest data stays viewable.',
          },
          androidItem(SERVERS, 'No other server.'),
          androidItem(SERVERS, 'Links you tap'),
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
          id: 'Karena tindakanmu: setelah masuk, saat membuka aplikasi kalau data lebih tua dari 15 menit, tarik untuk memperbarui, atau tombol Perbarui. Ditambah penjaga sesi kalau kamu menyalakannya (bagian berikut), yang hanya memeriksa sisa waktu sesi. Rekap presensi diperbarui paling sering sekali sehari saat aplikasi dibuka, tidak pernah di latar belakang; rincian per pertemuan diambil saat kamu membukanya. Pengingat dijadwalkan di iPhone dari data terakhir.',
          en: 'Because of something you do: after signing in, when you open the app and the data is older than 15 minutes, pull to update, or the Update button. Plus the session keeper if you turn it on (next section), which only checks the session’s time left. The attendance recap updates at most once a day when the app is opened, never in the background; per-session details are fetched when you open them. Reminders are scheduled on the iPhone from the latest data.',
        },
      },
    ],
  },
  {
    heading: { id: 'Jaga sesi SIKOLA (pilihan)', en: 'Keeping the SIKOLA session (optional)' },
    blocks: [
      {
        kind: 'ul',
        items: [
          {
            id: 'Kalau "Jaga sesi SIKOLA" menyala, Sulo meminta iPhone memberinya waktu di latar belakang. Saat waktu itu datang, Sulo mengirim satu permintaan kecil yang hanya membaca sisa waktu sesi SIKOLA. Tugas dan kabar tidak dicek di latar belakang.',
            en: 'With "Keep the SIKOLA session" on, Sulo asks the iPhone for time in the background. When that time comes, Sulo sends one small request that only reads the SIKOLA session’s time left. Tasks and updates are not checked in the background.',
          },
          {
            id: 'iPhone yang menentukan kapan dan seberapa sering, dan bisa tidak sama sekali, misalnya dalam Mode Daya Rendah atau kalau Refresh Aplikasi Latar dimatikan. Sulo sendiri tidak pernah mengecek lebih sering dari tiap 20 menit pukul 06.00-22.59 dan tiap 110 menit di malam hari.',
            en: 'The iPhone decides when and how often, and may not at all, for example in Low Power Mode or with Background App Refresh off. Sulo itself never checks more often than every 20 minutes from 06:00 to 22:59 and every 110 minutes at night.',
          },
          {
            id: 'Selama penjaga berhasil berjalan, sesi SIKOLA-mu tetap aktif di iPhone ini, karena SIKOLA menghitung pengecekan itu sebagai aktivitas. Matikan fitur ini kalau kamu tidak mau sesimu tetap aktif.',
            en: 'While the keeper gets to run, your SIKOLA session stays active on this iPhone, because SIKOLA counts the checks as activity. Turn it off if you do not want your session kept active.',
          },
          {
            id: 'Mematikannya: Lainnya, Pengaturan, Notifikasi, "Jaga sesi SIKOLA". Penjaga berhenti seketika.',
            en: 'To turn it off: More, Settings, Notifications, "Keep the SIKOLA session". The keeper stops at once.',
          },
          {
            id: 'Kalau SIKOLA menyatakan sesinya habis, Sulo menawarkan "Masuk lagi" sekali: di ringkasan pagi kalau menyala, atau dalam satu notifikasi.',
            en: 'When SIKOLA says the session has ended, Sulo offers "Sign in again" once: in the morning summary when it is on, or in one notification.',
          },
          {
            id: 'Pengelola Sulo bisa mematikan atau memperlambat penjaga untuk semua pengguna lewat pengaturan jarak jauh. Penjaga memakai pengaturan yang terakhir dibaca aplikasi; kalau bacaan itu lebih tua dari 72 jam, penjaga berhenti sampai kamu membuka Sulo.',
            en: 'Sulo’s developer can turn the keeper off or slow it down for everyone through the remote settings. The keeper uses the settings the app read last; when that read is over 72 hours old, the keeper stops until you open Sulo.',
          },
          {
            id: 'Kalau kamu tidak membuka Sulo selama 7 hari, penjaga berhenti. Buka Sulo untuk melanjutkannya.',
            en: 'If you do not open Sulo for 7 days, the keeper stops. Open Sulo to resume it.',
          },
          androidItem('Background watching (optional)', 'The checks count against'),
        ],
      },
    ],
  },
  {
    heading: { id: 'NEOSIA (pilihan)', en: NEOSIA },
    blocks: [
      {
        kind: 'ul',
        items: [
          androidItem(NEOSIA, 'Off until you connect it.'),
          androidItem(NEOSIA, 'From the pages you open,'),
          {
            id: 'Semua data NEOSIA disimpan terenkripsi (AES-256-GCM) dengan kunci tersendiri di Keychain iPhone, terpisah dari sesi SIKOLA. Nilai dan IPK tersembunyi secara bawaan, hanya dibuka saat layar Nilai atau kartu Studi menampilkannya, dan tidak pernah masuk notifikasi, ekspor, atau info laporan bug.',
            en: 'All NEOSIA data is stored encrypted (AES-256-GCM) with a key of its own in the iPhone’s Keychain, separate from the SIKOLA session. Grades and GPA are hidden by default, opened only while the Grades screen or the Studies card shows them, and never go into notifications, exports or the bug report info.',
          },
          {
            id: 'iPhone tidak mengizinkan aplikasi memblokir tangkapan layar. Selama nilai atau IPK tampil, Sulo menutup layarnya saat kamu berpindah aplikasi, jadi pratinjaunya di daftar aplikasi kosong, dan selama layar direkam atau dicerminkan.',
            en: 'The iPhone lets no app block screenshots. While grades or the GPA are on screen, Sulo covers its screen when you switch apps, so its preview in the app switcher is blank, and while the screen is recorded or mirrored.',
          },
        ],
      },
    ],
  },
  {
    heading: { id: 'Sipakamase (pilihan)', en: 'Sipakamase (optional)' },
    blocks: [
      { kind: 'p', text: SIPAKAMASE_CONSENT_IPHONE.how },
      { kind: 'ul', items: [...SIPAKAMASE_CONSENT_IPHONE.kept] },
      { kind: 'p', text: SIPAKAMASE_CONSENT_IPHONE.droppedTitle },
      { kind: 'ul', items: [...SIPAKAMASE_CONSENT_IPHONE.dropped] },
      {
        kind: 'ul',
        items: [
          {
            id: 'Cookie sesi Sipakamase disimpan di Keychain iPhone, terpisah dari sesi SIKOLA, tidak pernah keluar dari iPhone, dan tidak pernah sampai ke JavaScript. Data MKPK-nya di berkas terenkripsi tersendiri per akun.',
            en: 'The Sipakamase session cookie is kept in the iPhone’s Keychain, apart from the SIKOLA session, never leaves the iPhone and never reaches JavaScript. Its MKPK data is in an encrypted file of its own, per account.',
          },
          {
            id: 'Penjagaan sesinya hanya ikut waktu latar belakang yang diberikan iPhone ke "Jaga sesi SIKOLA", tanpa bangun tambahan: satu halaman tiap 3 jam atau lebih lambat, paling banyak 10 kali sehari bersama bacaan aplikasi. Isi halaman yang diambil di latar belakang tidak disimpan; datamu diperbarui saat kamu membuka Sulo.',
            en: 'Keeping its session only rides the background time the iPhone gives "Keep the SIKOLA session", with no wake of its own: one page every 3 hours or slower, at most 10 a day together with the app’s reads. Pages fetched in the background are not kept; your data updates when you open Sulo.',
          },
          {
            id: 'Kapan saja, lewat Pengaturan lalu "Putuskan". Semua data dan sesi Sipakamase di iPhone ini langsung terhapus.',
            en: 'Any time, in Settings with "Disconnect". All Sipakamase data and its session on this iPhone are deleted at once.',
          },
        ],
      },
    ],
  },
  {
    heading: { id: 'Pemasangan di iPhone', en: 'Installing on iPhone' },
    blocks: [
      {
        kind: 'ul',
        items: [
          {
            id: 'Sulo untuk iPhone tidak ada di App Store. Kamu memasangnya dari laptop dengan Sideloadly dan Apple ID-mu sendiri. Masuk ke Apple ID terjadi di Sideloadly, bukan di Sulo: Sulo tidak pernah melihat Apple ID maupun kata sandinya. Sideloadly adalah alat pihak ketiga dengan kebijakannya sendiri.',
            en: 'Sulo for iPhone is not on the App Store. You install it from a laptop with Sideloadly and your own Apple ID. Signing in to your Apple ID happens in Sideloadly, not in Sulo: Sulo never sees your Apple ID or its password. Sideloadly is a third-party tool with its own policy.',
          },
          {
            id: 'Dengan Apple ID gratis, Apple membatasi pemasangan ini 7 hari. Sulo membaca tanggal berakhirnya dari berkas pemasangannya sendiri, lalu menjadwalkan satu pengingat di iPhone sehari sebelumnya. Tidak ada yang dikirim ke mana pun, dan pengingat ini bisa dimatikan di Pengaturan.',
            en: 'With a free Apple ID, Apple limits this install to 7 days. Sulo reads the end date from its own install file and schedules one reminder on the iPhone the day before. Nothing is sent anywhere, and the reminder can be turned off in Settings.',
          },
        ],
      },
    ],
  },
  {
    heading: { id: 'Cara menghapus', en: DELETE },
    blocks: [
      {
        kind: 'ul',
        items: [
          {
            id: 'Lainnya, Pengaturan, Keluar dan hapus data: menghapus sesi SIKOLA, data dan sesi NEOSIA serta Sipakamase, kunci-kuncinya di Keychain, semua data Sulo, dan semua pengingat terjadwal di iPhone ini.',
            en: 'More, Settings, Sign out and delete data: deletes the SIKOLA session, the NEOSIA and Sipakamase data and sessions, their keys in the Keychain, all of Sulo’s data and every scheduled reminder on this iPhone.',
          },
          {
            id: 'Lainnya, Pengaturan, NEOSIA, Putuskan NEOSIA: menghapus semua data NEOSIA beserta sesi NEOSIA di iPhone ini.',
            en: 'More, Settings, NEOSIA, Disconnect NEOSIA: deletes all NEOSIA data and the NEOSIA sign-in on this iPhone.',
          },
          {
            id: 'Menghapus aplikasi menghapus berkas Sulo. Isi Keychain-nya (sesi dan kunci) disimpan iPhone sampai Sulo dipasang lagi, saat Sulo langsung menghapusnya. Karena itu, pakai Keluar dan hapus data dulu sebelum menghapus aplikasi.',
            en: 'Deleting the app deletes Sulo’s files. Its Keychain items (sessions and keys) are kept by the iPhone until Sulo is installed again, when Sulo deletes them at once. So use Sign out and delete data before deleting the app.',
          },
          androidItem(DELETE, 'Nothing on SIKOLA'),
        ],
      },
    ],
  },
];

/** The notice this phone shows: Android's, or the iPhone's own (i18n/os.ts). */
export function mobilePrivacy() {
  const ios = mobileOs() === 'ios';
  return {
    title: ios ? IPHONE_PRIVACY_TITLE : MOBILE_PRIVACY_TITLE,
    updated: MOBILE_PRIVACY_UPDATED,
    summary: ios ? IPHONE_PRIVACY_SUMMARY : MOBILE_PRIVACY_SUMMARY,
    intro: ios ? IPHONE_PRIVACY_INTRO : MOBILE_PRIVACY_INTRO,
    sections: ios ? IPHONE_PRIVACY_SECTIONS : MOBILE_PRIVACY_SECTIONS,
    serversHeading: MOBILE_PRIVACY_SERVERS_HEADING,
  };
}

/** The Sipakamase consent this phone shows (the extension never sets the OS, so it keeps Android's words). */
export const sipakamaseConsent = (): ConsentText => (mobileOs() === 'ios' ? SIPAKAMASE_CONSENT_IPHONE : SIPAKAMASE_CONSENT);
