// The theme tile: its card changes between light and dark on its own; the
// page stays as it is. The button says which state it is in (aria-pressed:
// pressed means the card is dark).
for (const tombol of document.querySelectorAll<HTMLButtonElement>('[data-ubin-tema-tombol]')) {
  const kartu = tombol.closest('.ubin')?.querySelector<HTMLElement>('[data-ubin-tema]');
  if (!kartu) continue;
  // It starts in the theme the page is not in, so the change is the first thing it shows.
  const halamanGelap = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  kartu.dataset.theme = halamanGelap ? 'light' : 'dark';
  tombol.setAttribute('aria-pressed', String(!halamanGelap));
  tombol.addEventListener('click', () => {
    const gelap = kartu.dataset.theme !== 'dark';
    kartu.dataset.theme = gelap ? 'dark' : 'light';
    tombol.setAttribute('aria-pressed', String(gelap));
  });
}

export {};
