// The iPhone interest button: one vote per browser (a mark in localStorage,
// wrapped: a private window may refuse it), sent to this site only. The
// answer carries no number. Nothing else about the visitor is sent.
const KUNCI = 'sulo-landing:minat-ios';
const tombol = document.querySelector<HTMLButtonElement>('[data-minat-tombol]');
const hasil = document.querySelector<HTMLElement>('.panduan-minat-hasil');

function sudah(): boolean {
  try {
    return localStorage.getItem(KUNCI) === '1';
  } catch {
    return false;
  }
}

function tandai() {
  try {
    localStorage.setItem(KUNCI, '1');
  } catch {
    // Not remembered in a private window: the server's daily limit still holds.
  }
}

function selesai() {
  if (!tombol || !hasil) return;
  tombol.disabled = true;
  hasil.textContent = tombol.dataset.tercatat ?? '';
}

if (tombol && hasil) {
  if (sudah()) selesai();
  tombol.addEventListener('click', async () => {
    tombol.disabled = true;
    try {
      const r = await fetch('/api/minat-ios', { method: 'POST', credentials: 'omit', cache: 'no-store' });
      // 429: this address already voted enough today; to the visitor it is the same "noted".
      if (r.status === 204 || r.status === 429) {
        tandai();
        selesai();
        return;
      }
      throw new Error(String(r.status));
    } catch {
      tombol.disabled = false;
      hasil.textContent = tombol.dataset.gagal ?? '';
    }
  });
}

export {};
