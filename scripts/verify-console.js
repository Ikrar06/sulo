// Verifikasi endpoint SIKOLA dari Console browser.
// Cara pakai: login ke SIKOLA, buka satu halaman course (course/view.php?id=...),
// tempel seluruh isi berkas ini ke Console, jalankan SEKALI.
// Total 3 request, semuanya hanya membaca. Output hanya nama field dan jumlah item.

(async () => {
  const courseId = Number(new URLSearchParams(location.search).get('id'));
  const key = M.cfg.sesskey;
  const now = Math.floor(Date.now() / 1000);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const call = async (calls, path = 'service.php') => {
    const r = await fetch(`/lib/ajax/${path}?sesskey=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(calls.map((c, i) => ({ index: i, methodname: c[0], args: c[1] })))
    });
    return r.json();
  };

  const shape = d => {
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return `string(${d.length})`; } }
    if (Array.isArray(d)) return { array: d.length, item: d[0] ? Object.keys(d[0]) : [] };
    if (d && typeof d === 'object')
      return Object.fromEntries(Object.entries(d).map(([k, v]) =>
        [k, Array.isArray(v)
          ? `array(${v.length})${v[0] && typeof v[0] === 'object' ? ' keys: ' + Object.keys(v[0]).join(',') : ''}`
          : typeof v]));
    return typeof d;
  };
  const report = (names, res) => names.forEach((n, i) => {
    const x = res[i];
    console.log(n, x?.error ? `GAGAL: ${x.exception?.errorcode}` : 'OK', x?.error ? '' : JSON.stringify(shape(x.data)));
  });

  const b1 = [
    ['core_session_time_remaining', {}],
    ['core_calendar_get_action_events_by_timesort', { timesortfrom: now - 365 * 86400, limitnum: 10 }],
    ['core_courseformat_get_state', { courseid: courseId }]
  ];
  const r1 = await call(b1);
  report(b1.map(c => c[0]), r1);

  await wait(2000);
  const uid = r1[0]?.data?.userid;
  if (uid) {
    const b2 = [['message_popup_get_popup_notifications', { useridto: uid, limit: 5, offset: 0 }]];
    report(b2.map(c => c[0]), await call(b2));
  }

  await wait(2000);
  const r3 = await call([['tool_mobile_get_public_config', {}]], 'service-nologin.php');
  console.log('mobile config', r3[0]?.error ? `GAGAL: ${r3[0].exception?.errorcode}` :
    JSON.stringify({ enablewebservices: r3[0].data.enablewebservices, enablemobilewebservice: r3[0].data.enablemobilewebservice }));

  console.log('bahasa UI:', document.documentElement.lang);
  console.log('modtype:', JSON.stringify([...new Set([...document.querySelectorAll('li.activity')]
    .map(e => [...e.classList].find(c => c.startsWith('modtype_'))))]));
  console.log('li.activity punya data-id:', !!document.querySelector('li.activity[data-id]'));
})();
