// After a real download starts (the hero's link to the file itself), one
// quiet line takes the note's place: the download began, follow the guide,
// about how long (aria-live, read aloud once). Nothing is sent anywhere; the
// browser shows its own download prompt as usual.
const teks = document.querySelector<HTMLElement>('.pembuka-teks');
const baris = document.querySelector<HTMLElement>('.pembuka-unduh');
for (const a of document.querySelectorAll<HTMLAnchorElement>('.pembuka a[data-tombol-utama][download]')) {
  a.addEventListener('click', () => {
    if (!teks || !baris) return;
    baris.textContent = (a.dataset.menit === '2' ? baris.dataset.teks2 : baris.dataset.teks3) ?? '';
    teks.setAttribute('data-unduh', '');
  });
}

export {};
