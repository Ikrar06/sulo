// "Copy the address": the browser's own extensions page cannot be opened from
// a link, so the guide offers its address to copy. The button says when it
// is done (and the address stays on the page to copy by hand).
for (const tombol of document.querySelectorAll<HTMLButtonElement>('[data-salin]')) {
  const asli = tombol.textContent ?? '';
  tombol.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(tombol.dataset.salin ?? '');
      tombol.textContent = tombol.dataset.salinBerhasil ?? asli;
      setTimeout(() => {
        tombol.textContent = asli;
      }, 2000);
    } catch {
      // No clipboard here (an old browser, or permission refused): the address is right beside the button.
    }
  });
}

export {};
