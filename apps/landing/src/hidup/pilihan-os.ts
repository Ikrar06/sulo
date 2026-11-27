// The Windows and Mac switch of a guide step (komponen/PilihanOs.astro): shows the switch, opens the visitor's
// own system first (a Mac browser says "Macintosh"; everything else starts on Windows, Sideloadly's other home),
// and keeps one panel at a time. Arrow keys move between the two, as in any tab list. Nothing is sent or stored.
const mac = /Macintosh|Mac OS X/.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent);

for (const wadah of document.querySelectorAll<HTMLElement>('[data-pilihan-os]')) {
  const saklar = wadah.querySelector<HTMLElement>('[role="tablist"]');
  const tombol = [...wadah.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const isi = [...wadah.querySelectorAll<HTMLElement>('.pilihan-os-isi')];
  if (!saklar || tombol.length === 0) continue;

  const pilih = (os: string, fokus = false) => {
    for (const t of tombol) {
      const aktif = t.dataset.os === os;
      t.setAttribute('aria-selected', String(aktif));
      t.tabIndex = aktif ? 0 : -1;
      if (aktif && fokus) t.focus();
    }
    for (const p of isi) p.hidden = p.dataset.os !== os;
  };

  for (const p of isi) {
    p.setAttribute('role', 'tabpanel');
    p.setAttribute('aria-labelledby', p.id.replace(/-(windows|mac)$/, '-tab-$1'));
  }
  saklar.hidden = false;
  wadah.classList.add('is-saklar');
  pilih(mac ? 'mac' : 'windows');

  for (const t of tombol) {
    t.addEventListener('click', () => pilih(t.dataset.os ?? 'windows'));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const lain = tombol.find((x) => x !== t);
      if (lain) pilih(lain.dataset.os ?? 'windows', true);
    });
  }
}

export {};
