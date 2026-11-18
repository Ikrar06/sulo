// Synthetic attendance for pnpm guide:shots (the demo account's courses,
// made-up numbers and sessions; no real data).

export function demoPresensi(now = Math.floor(Date.now() / 1000)) {
  const at = now - 3 * 3600;
  const row = (courseId, cmid, taken, got, max) => ({ courseId, cmid, taken, points: { got, max }, percent: max > 0 ? Math.round((got / max) * 1000) / 10 : null });
  const day = 86_400;
  const sessions = [
    ['present', 'Hadir', 'Kuliah 1: pengantar'],
    ['present', 'Hadir', 'Kuliah 2: tekanan hidrostatis'],
    ['late', 'Terlambat', 'Kuliah 3: gaya apung'],
    ['present', 'Hadir', 'Kuliah 4: aliran laminer'],
    ['absent', 'Tidak hadir', 'Kuliah 5: persamaan Bernoulli'],
    ['excused', 'Izin', 'Kuliah 6: aliran turbulen'],
    ['present', 'Hadir', 'Kuliah 7: kehilangan energi'],
  ].map(([status, statusText, description], i) => {
    const t = now - (7 - i) * 7 * day;
    const d = new Date(t * 1000);
    return {
      dateText: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
      timeText: '07.30 - 10.00',
      at: t,
      description,
      status,
      statusText,
      points: { got: status === 'present' || status === 'excused' ? 2 : status === 'late' ? 1 : 0, max: 2 },
      remarks: status === 'excused' ? 'Surat keterangan sakit' : '',
    };
  });
  return {
    'u:1:presensi': {
      recap: { fetchedAt: at, rows: [row(401, 9401, 7, 11, 14), row(402, 9402, 7, 14, 14), row(403, 9403, 6, 11, 12), row(405, 9405, 0, 0, 0)] },
      details: { 9401: { fetchedAt: at, sessions } },
      lastRequestAt: at,
      unknownShapeAt: null,
    },
  };
}
