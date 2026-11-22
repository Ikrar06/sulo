// The phone's onboarding words (M8c.2), Indonesian and English: the owner's
// final copy. A text budget holds (tested): titles at most 28 characters,
// supporting lines at most 60, no paragraphs; longer explanations live in
// bottom sheets (`sheets`). The intro's sample data is synthetic.

import type { Locale } from './index';

/** Checked by the text-budget test: every title and supporting line listed here. */
export const TITLE_MAX = 28;
export const SUPPORT_MAX = 60;

const id = {
  skip: 'Lewati',
  next: 'Lanjut',
  back: 'Kembali',
  pageOf: (i: number, n: number) => `Halaman ${i} dari ${n}`,
  stepOf: (i: number, n: number) => `Langkah ${i} dari ${n}`,
  splash: { name: 'Sulo', tagline: 'Pendamping akademik mahasiswa Unhas' },
  intro1: {
    // \u00A0: the last two words stay together where text-wrap: balance is missing (WebView 111 to 113).
    title: 'Semua tenggat, satu\u00A0tempat',
    body: 'Tugas dari semua mata kuliah SIKOLA.',
    stage: 'Tiga contoh kartu tugas merapikan diri jadi satu tumpukan.',
    cards: [
      { course: 'Hidrologi', title: 'Laporan praktikum 3', due: 'terlambat 1 hari', tone: 'overdue' },
      { course: 'Mekanika Fluida', title: 'Kuis bab 4', due: '4 jam lagi', tone: 'soon' },
      { course: 'Statistika', title: 'Tugas regresi linear', due: '2 hari lagi', tone: 'later' },
      { course: 'Geologi Teknik', title: 'Peta singkapan', due: '5 hari lagi', tone: 'later' },
    ],
  },
  intro2: {
    title: 'Diingatkan sebelum\u00A0terlambat',
    body: 'Tenggat, kalender akademik, dan presensi.',
    stage: 'Contoh notifikasi pengingat, hitung mundur tenggat, dan presensi.',
    notifyTitle: 'Kuis bab 4',
    notifyCourse: 'Mekanika Fluida',
    countdownLabel: 'Tenggat',
    left: (h: number, m: number, s: number) => `${h} jam ${String(m).padStart(2, '0')}.${String(s).padStart(2, '0')}`,
    attendanceLabel: 'Presensi',
  },
  intro3: {
    title: 'Datamu tetap di HP-mu',
    body: 'Tanpa server, tanpa iklan, tanpa pelacakan.',
    stage: 'Data tersimpan di dalam HP dan terkunci.',
    badges: ['Password aman', 'Terenkripsi', 'Tanpa server'],
    data: ['Tugas', 'Nilai', 'Presensi'],
    start: 'Mulai',
  },
  signin: {
    title: 'Masuk ke SIKOLA',
    body: 'Kamu masuk di halaman asli. Sulo tidak melihat password-mu.',
    address: 'sikola-v2.unhas.ac.id',
    open: 'Masuk',
    why: 'Kenapa aman?',
    cancelled: 'Belum masuk. Coba lagi kapan saja.',
    offline: 'Tidak ada koneksi.',
    retry: 'Coba lagi',
    close: 'Tutup',
    privacyLink: 'Baca kebijakan privasi',
  },
  preparing: {
    title: 'Menyiapkan Sulo',
    stages: { tasks: 'Mengambil tugas', courses: 'Mengenali mata kuliah', calendar: 'Menyiapkan kalender', attendance: 'Mengambil presensi' },
    chips: { tasks: (n: number) => `${n} tugas`, courses: (n: number) => `${n} mata kuliah`, calendar: 'kalender siap', attendance: 'presensi siap' },
    failedTitle: 'Belum berhasil mengambil data.',
    retry: 'Coba lagi',
    without: 'Lanjut tanpa data',
  },
  courses: {
    title: 'Pantau yang mana?',
    body: 'Yang sedang berjalan sudah dipilih.',
    selected: (n: number) => `${n} dipilih`,
    none: 'Pilih minimal satu.',
    showAll: 'Tampilkan semua mata kuliah',
  },
  nickname: {
    title: 'Mau dipanggil apa?',
    label: 'Nama panggilan',
    note: 'Opsional. Hanya disimpan di HP ini.',
  },
  reminders: {
    title: 'Mau diingatkan?',
    sampleTitle: 'Tugas regresi linear',
    sampleCourse: 'Statistika',
    stagesLabel: 'Ingatkan sebelum tenggat',
    stages: { 1440: '1 hari', 180: '3 jam', 60: '1 jam' } as Record<number, string>,
    /** The banner's time for the earliest chosen stage. */
    inTime: (stage: string) => `${stage} lagi`,
    watchTitle: 'Pantau tugas baru',
    watchBody: 'Sulo mengecek SIKOLA berkala di latar belakang.',
    detail: 'Detail',
    allow: 'Izinkan pengingat',
    later: 'Nanti saja',
  },
  done: {
    title: 'Semua siap.',
    tasks: (n: number) => `${n} tugas`,
    next: (when: string) => `terdekat ${when}`,
    empty: 'Belum ada tugas',
    open: 'Buka Sulo',
  },
  switchAccount: {
    title: 'Akun berbeda',
    body: 'Data akun sebelumnya di HP ini akan dihapus.',
    use: 'Pakai akun ini',
    cancel: 'Batal',
  },
  sheets: {
    why: ['Kamu masuk di halaman SIKOLA asli. Sulo tidak pernah melihat password-mu.', 'Sesi SIKOLA disimpan terenkripsi di HP ini.', 'Tanpa server Sulo, iklan, atau pelacakan.'],
    watch: 'Sulo mengecek SIKOLA berkala di latar belakang supaya kamu cepat tahu ada tugas baru. Sesi SIKOLA ikut tetap aktif. Bisa dimatikan kapan saja di Pengaturan.',
  },
  unofficial: 'Tidak resmi dan tidak berafiliasi dengan Universitas Hasanuddin.',
};

type Words = typeof id;

const en: Words = {
  skip: 'Skip',
  next: 'Next',
  back: 'Back',
  pageOf: (i, n) => `Page ${i} of ${n}`,
  stepOf: (i, n) => `Step ${i} of ${n}`,
  splash: { name: 'Sulo', tagline: 'Academic companion for Unhas students' },
  intro1: {
    title: 'Every deadline, one place',
    body: 'Tasks from all your SIKOLA courses.',
    stage: 'Three sample task cards tidy themselves into one stack.',
    cards: [
      { course: 'Hydrology', title: 'Lab report 3', due: '1 day overdue', tone: 'overdue' },
      { course: 'Fluid Mechanics', title: 'Chapter 4 quiz', due: 'in 4 hours', tone: 'soon' },
      { course: 'Statistics', title: 'Linear regression task', due: 'in 2 days', tone: 'later' },
      { course: 'Engineering Geology', title: 'Outcrop map', due: 'in 5 days', tone: 'later' },
    ],
  },
  intro2: {
    title: "Reminded before it's late",
    body: 'Deadlines, academic calendar, attendance.',
    stage: 'A sample reminder, a deadline countdown and attendance.',
    notifyTitle: 'Chapter 4 quiz',
    notifyCourse: 'Fluid Mechanics',
    countdownLabel: 'Due in',
    left: (h, m, s) => `${h} h ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    attendanceLabel: 'Attendance',
  },
  intro3: {
    title: 'Data stays on your phone',
    body: 'No server, no ads, no tracking.',
    stage: 'Your data is kept inside the phone, locked.',
    badges: ['No password kept', 'Encrypted', 'No server'],
    data: ['Tasks', 'Grades', 'Attendance'],
    start: 'Get started',
  },
  signin: {
    title: 'Sign in to SIKOLA',
    body: 'You sign in on the real page. Sulo never sees your password.',
    address: 'sikola-v2.unhas.ac.id',
    open: 'Sign in',
    why: 'Why is this safe?',
    cancelled: 'Not signed in yet. Try again anytime.',
    offline: 'No connection.',
    retry: 'Try again',
    close: 'Close',
    privacyLink: 'Read the privacy policy',
  },
  preparing: {
    title: 'Setting up Sulo',
    stages: { tasks: 'Getting your tasks', courses: 'Finding your courses', calendar: 'Preparing the calendar', attendance: 'Getting attendance' },
    chips: { tasks: (n) => (n === 1 ? '1 task' : `${n} tasks`), courses: (n) => (n === 1 ? '1 course' : `${n} courses`), calendar: 'calendar ready', attendance: 'attendance ready' },
    failedTitle: "Couldn't get your data.",
    retry: 'Try again',
    without: 'Continue without data',
  },
  courses: {
    title: 'Which ones to follow?',
    body: 'Current courses are preselected.',
    selected: (n) => `${n} selected`,
    none: 'Pick at least one.',
    showAll: 'Show all courses',
  },
  nickname: {
    title: 'What should we call you?',
    label: 'Nickname',
    note: 'Optional. Stored only on this phone.',
  },
  reminders: {
    title: 'Want reminders?',
    sampleTitle: 'Linear regression task',
    sampleCourse: 'Statistics',
    stagesLabel: 'Remind me before a deadline',
    stages: { 1440: '1 day', 180: '3 hours', 60: '1 hour' },
    inTime: (stage) => `in ${stage}`,
    watchTitle: 'Watch for new tasks',
    watchBody: 'Sulo checks SIKOLA regularly in the background.',
    detail: 'Details',
    allow: 'Allow reminders',
    later: 'Not now',
  },
  done: {
    title: 'All set.',
    tasks: (n) => (n === 1 ? '1 task' : `${n} tasks`),
    next: (when) => `next due ${when}`,
    empty: 'No tasks yet',
    open: 'Open Sulo',
  },
  switchAccount: {
    title: 'Different account',
    body: "The previous account's data here will be deleted.",
    use: 'Use this account',
    cancel: 'Cancel',
  },
  sheets: {
    why: ['You sign in on the real SIKOLA page. Sulo never sees your password.', 'Your SIKOLA session is stored encrypted on this phone.', 'No Sulo server, no ads, no tracking.'],
    watch: 'Sulo checks SIKOLA regularly in the background so you hear about new tasks quickly. This also keeps your SIKOLA session active. You can turn it off anytime in Settings.',
  },
  unofficial: 'Unofficial. Not affiliated with Universitas Hasanuddin.',
};

export type OnboardingWords = Words;

export const onboardingWords = (locale: Locale): OnboardingWords => (locale === 'en' ? en : id);

/** Every title and supporting line, for the budget test. */
export function budgetedTexts(w: OnboardingWords): { titles: string[]; supports: string[] } {
  return {
    titles: [w.splash.name, w.intro1.title, w.intro2.title, w.intro3.title, w.signin.title, w.preparing.title, w.courses.title, w.nickname.title, w.reminders.title, w.done.title, w.switchAccount.title],
    supports: [w.splash.tagline, w.intro1.body, w.intro2.body, w.intro3.body, w.signin.body, w.signin.cancelled, w.signin.offline, ...Object.values(w.preparing.stages), w.preparing.failedTitle, w.courses.body, w.nickname.note, w.reminders.stagesLabel, w.reminders.watchBody, w.switchAccount.body],
  };
}

