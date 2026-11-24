// A link to one answer (#tanya-..., from the questions' own side, a guide or a
// shared link) opens it, so the answer shows rather than only its question.
function bukaJawaban(): void {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id.startsWith('tanya-')) return;
  const jawaban = document.getElementById(id);
  if (jawaban instanceof HTMLDetailsElement) jawaban.open = true;
}

addEventListener('hashchange', bukaJawaban);
bukaJawaban();

export {};
