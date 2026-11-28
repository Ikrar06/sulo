// After a real download starts (a link to the file itself: the hero's, an
// install card's or the closing block's), one quiet line near that button says
// so: the download began, follow the guide, about how long (aria-live, read
// aloud once). Nothing is sent anywhere; the browser shows its own download
// prompt as usual.
for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-tombol-utama][download]')) {
  a.addEventListener('click', () => {
    const wadah = a.closest<HTMLElement>('[data-unduh-wadah]');
    const baris = wadah?.querySelector<HTMLElement>('[data-unduh-baris]');
    if (!wadah || !baris) return;
    // data-teks-<minutes> next to the line: read by its attribute name (a dash before a digit stays in dataset's key).
    baris.textContent = baris.getAttribute(`data-teks-${a.dataset.menit ?? '3'}`) ?? '';
    wadah.setAttribute('data-unduh', '');
  });
}

export {};
