import { describe, expect, it } from 'vitest';
import { CAPTURE_TYPE, MAX_RESPONSE_CHARS } from '../lib/neosia/allowlist';
import { installCapture, type CaptureMessage, type CaptureWindow } from '../lib/neosia/capture';
import { keyShape, observation } from '../lib/neosia/observe';
import { matchUrl } from '../lib/neosia/match';
import { PLACEHOLDER, SYNTHETIC } from './neosia-synthetic';

const API = 'https://api.neosia.unhas.ac.id/api/mahasiswa';
const flush = () => new Promise((r) => setTimeout(r, 0));

/** A minimal XHR whose "load" fires on respond(). */
class FakeXhr {
  status = 0;
  responseType = '';
  responseText = '';
  response: unknown = null;
  private listeners: (() => void)[] = [];
  opened: unknown[] = [];
  open(...args: unknown[]) {
    this.opened = args;
    return 'opened';
  }
  send(..._args: unknown[]) {
    return 'sent';
  }
  addEventListener(type: string, listener: () => void) {
    if (type === 'load') this.listeners.push(listener);
  }
  respond(status: number, body: string, responseType = '', response: unknown = null) {
    this.status = status;
    this.responseType = responseType;
    this.responseText = responseType === '' ? body : '';
    this.response = response;
    this.listeners.forEach((l) => l());
  }
}

function page(fetchImpl: (url: string) => Promise<unknown>) {
  const posted: { message: unknown; origin: string }[] = [];
  const seen: unknown[] = [];
  class Xhr extends FakeXhr {}
  const win: CaptureWindow & { fetch: (input: unknown) => Promise<unknown>; XMLHttpRequest: typeof Xhr } = {
    fetch: (input: unknown) => fetchImpl(String(input)),
    XMLHttpRequest: Xhr,
    postMessage: (message, origin) => void posted.push({ message, origin }),
    location: { origin: 'https://neosia.unhas.ac.id', href: 'https://neosia.unhas.ac.id/krs' },
  };
  const originalFetch = win.fetch;
  installCapture(win, { now: () => 1_794_000_000, onSeen: (m, json) => void seen.push(observation(m, json, 1)) });
  return { win, posted, seen, originalFetch, Xhr };
}

/** A Response-like object that counts clone() calls. */
function response(body: string, ok = true) {
  const r = { ok, clones: 0, clone: () => ({ text: async () => body }), json: async () => JSON.parse(body) };
  r.clone = () => {
    r.clones += 1;
    return { text: async () => body };
  };
  return r;
}

describe('the page-world capture: fetch', () => {
  it('returns exactly what the original fetch returned and posts the projection to the page origin', async () => {
    const res = response(JSON.stringify(SYNTHETIC.getTranskripMahasiswa));
    const p = page(async () => res);
    const returned = await p.win.fetch(`${API}/transkrip/getTranskripMahasiswa`);
    expect(returned).toBe(res);
    await flush();
    expect(p.posted).toHaveLength(1);
    expect(p.posted[0]!.origin).toBe('https://neosia.unhas.ac.id');
    const message = p.posted[0]!.message as CaptureMessage;
    expect(message).toMatchObject({ type: CAPTURE_TYPE, endpoint: 'getTranskripMahasiswa', status: 'ok' });
    expect(JSON.stringify(message)).not.toContain('nilai_angka');
    expect(JSON.stringify(message)).not.toContain(PLACEHOLDER.nim);
  });

  it('keeps the original rejection and adds no unhandled one', async () => {
    const p = page(async () => {
      throw new TypeError('offline');
    });
    await expect(p.win.fetch(`${API}/belanja_krs`)).rejects.toThrow('offline');
    await flush();
    expect(p.posted).toEqual([]);
  });

  it('does not throw or post data for broken, non-JSON, empty or very large bodies', async () => {
    const bodies = ['{"kartu_rencana_studi": {', '<html>maintenance</html>', '', 'x'.repeat(MAX_RESPONSE_CHARS + 1), 'null', '[]', '"text"'];
    for (const body of bodies) {
      const p = page(async () => response(body));
      await expect(p.win.fetch(`${API}/belanja_krs`)).resolves.toBeDefined();
      await flush();
      expect(p.posted.every((x) => (x.message as CaptureMessage).status === 'unknown_shape')).toBe(true);
    }
  });

  it('never throws when the response is odd', async () => {
    for (const odd of [null, undefined, 42, { ok: true }, { ok: true, clone: () => { throw new Error('used'); } }]) {
      const p = page(async () => odd);
      await expect(p.win.fetch(`${API}/belanja_krs`)).resolves.toBe(odd);
      await flush();
    }
  });

  it('ignores failed responses and other hosts', async () => {
    const res = response('{}', false);
    const p = page(async () => res);
    await p.win.fetch(`${API}/belanja_krs`);
    await p.win.fetch('https://jsonplaceholder.typicode.com/todos/1');
    await flush();
    expect(p.posted).toEqual([]);
  });

  it('never reads the body of a path outside the allowlist, and never of the forbidden ones', async () => {
    for (const path of ['mahasiswa/mahasiswa', 'pengunduran-diri-semester', 'pengumuman']) {
      const res = response('{"nik":"0000000000000001"}');
      const p = page(async () => res);
      await p.win.fetch(`${API}/${path}`);
      await flush();
      expect(res.clones, path).toBe(0);
      expect(p.posted).toEqual([]);
      // The dev listing gets the path only.
      expect(p.seen).toEqual([expect.objectContaining({ keys: null })]);
    }
  });

  it('keeps the wrapper named like the original and installs only once', () => {
    const p = page(async () => response('{}'));
    expect((p.win.fetch as { name: string }).name).toBe(p.originalFetch.name);
    expect(installCapture(p.win, { now: () => 1 })).toBe(false);
  });
});

describe('the page-world capture: XMLHttpRequest', () => {
  it('reads text responses on load without changing open/send results', () => {
    const p = page(async () => null);
    const xhr = new p.Xhr();
    expect(xhr.open('GET', `${API}/belanja_krs/max_sks`)).toBe('opened');
    expect(xhr.send()).toBe('sent');
    xhr.respond(200, JSON.stringify(SYNTHETIC.max_sks));
    expect(p.posted).toHaveLength(1);
    expect(JSON.stringify(p.posted[0]!.message)).not.toContain(PLACEHOLDER.nim);
  });

  it('reads json responses, skips blobs, documents and failed requests', () => {
    const p = page(async () => null);
    const json = new p.Xhr();
    json.open('GET', `${API}/dashboard`);
    json.send();
    json.respond(200, '', 'json', SYNTHETIC.dashboard);
    const blob = new p.Xhr();
    blob.open('GET', `${API}/dashboard`);
    blob.send();
    blob.respond(200, '', 'blob', {});
    const failed = new p.Xhr();
    failed.open('GET', `${API}/dashboard`);
    failed.send();
    failed.respond(500, '{"error":true}');
    expect(p.posted).toHaveLength(1);
    expect(JSON.stringify(p.posted[0]!.message)).not.toContain('nilai_angka');
  });

  it('does not throw on broken bodies', () => {
    const p = page(async () => null);
    for (const body of ['{', '', 'x'.repeat(MAX_RESPONSE_CHARS + 1)]) {
      const xhr = new p.Xhr();
      xhr.open('GET', `${API}/belanja_krs`);
      xhr.send();
      expect(() => xhr.respond(200, body)).not.toThrow();
    }
  });
});

describe('dev observation listing (development builds only)', () => {
  it('lists key names of allowlisted responses, never values, with data-like keys as {n}', () => {
    const keys = keyShape(SYNTHETIC.kelas_kuliah_tersedia);
    expect(keys).toContain('semesters.{n}[].jadwal_kuliahs[].day_of_week');
    expect(keys.join(' ')).not.toContain('HIDROLOGI');
    const o = observation(matchUrl(`${API}/belanja_krs`)!, SYNTHETIC.belanja_krs, 1);
    expect(o.path).toBe('/api/mahasiswa/belanja_krs');
    expect(o.keys).toContain('kartu_rencana_studi.mahasiswa.nik');
    // An id in the path is scrubbed; the path is then not an allowlisted one (anchored match).
    expect(matchUrl(`${API}/${PLACEHOLDER.nim}/belanja_krs`)!.path).toBe('/api/mahasiswa/{id}/belanja_krs');
    expect(JSON.stringify(o)).not.toContain(PLACEHOLDER.nik);
  });
});
