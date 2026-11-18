// Development builds only (M7.1): the words of the local usage statistics
// card. Imported only by components/dashboard/UsageStats.tsx, which the
// settings page loads behind MODE === 'development'; other builds contain
// neither (scripts/check-no-dev-code.mjs).

const id = {
  title: 'Statistik pemakaian (lokal)',
  since: (date: string) => `Dihitung sejak ${date}. Hanya angka, tersimpan di browsermu, tidak pernah dikirim.`,
  counters: {
    popupOpens: 'Popup dibuka',
    dashboardOpens: 'Dashboard dibuka',
    tasksMarkedDone: 'Tugas ditandai selesai',
    remindersShown: 'Pengingat tugas tampil',
    calendarRemindersShown: 'Pengingat kalender tampil',
    updatesShown: 'Notifikasi kabar terbaru tampil',
  },
  export: 'Ekspor statistik',
  exportHelp: 'Menyimpan berkas JSON berisi angka di atas, versi Sulo, dan tanggal. Tanpa nama tugas, mata kuliah, atau akun. Kirim berkasnya hanya kalau kamu mau membantu pengembangan.',
};

const en: typeof id = {
  title: 'Usage statistics (local)',
  since: (date) => `Counted since ${date}. Numbers only, kept in your browser, never sent.`,
  counters: {
    popupOpens: 'Popup opened',
    dashboardOpens: 'Dashboard opened',
    tasksMarkedDone: 'Tasks marked as done',
    remindersShown: 'Task reminders shown',
    calendarRemindersShown: 'Calendar reminders shown',
    updatesShown: 'Update notifications shown',
  },
  export: 'Export statistics',
  exportHelp: 'Saves a JSON file with the numbers above, the Sulo version and the dates. No task names, courses or account. Send it only if you want to help development.',
};

export function statsWords(locale: 'id' | 'en') {
  return locale === 'en' ? en : id;
}
