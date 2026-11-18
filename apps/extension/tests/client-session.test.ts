import { describe, expect, it } from 'vitest';
import { calls } from '@sulo/core/moodle/calls';
import { interpretBatch } from '@sulo/core/moodle/client';

const batch = [calls.sessionTimeRemaining(), calls.calendarActionEvents(1_790_000_000), calls.courseformatState(401)];
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const ok = (data: unknown) => ({ error: false, data });
const err = (errorcode: string) => ({ error: true, exception: { errorcode, message: 'x' } });

describe('session detection in a batch (only the session call or the top level decides)', () => {
  it('a course that cannot be opened does not end the session when the session call worked', async () => {
    const outcome = await interpretBatch(json([ok({ userid: 1, timeremaining: 7000 }), ok({ events: [] }), err('requireloginerror')]), batch);
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    expect(outcome.results[2]).toEqual({ ok: false, errorcode: 'requireloginerror' });
  });

  it("an invalid sesskey on another call is that call's error only", async () => {
    const outcome = await interpretBatch(json([ok({ userid: 1, timeremaining: 7000 }), ok({ events: [] }), err('invalidsesskey')]), batch);
    expect(outcome.kind).toBe('ok');
  });

  it('the session call failing with a login error means the session is gone', async () => {
    expect((await interpretBatch(json([err('requireloginerror'), ok({ events: [] }), ok('{}')]), batch)).kind).toBe('login_required');
    expect((await interpretBatch(json([err('servicerequireslogin'), ok({ events: [] }), ok('{}')]), batch)).kind).toBe('login_required');
    expect((await interpretBatch(json([err('invalidsesskey'), ok({ events: [] }), ok('{}')]), batch)).kind).toBe('invalid_sesskey');
  });

  it('an HTML page or a redirect at the top level means the session is gone', async () => {
    const html = new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    expect((await interpretBatch(html, batch)).kind).toBe('login_required');
    expect((await interpretBatch(new Response(null, { status: 303, headers: { location: '/login/index.php' } }), batch)).kind).toBe('login_required');
  });

  it('a top-level login error means the session is gone', async () => {
    expect((await interpretBatch(json({ error: 'x', errorcode: 'servicerequireslogin' }), batch)).kind).toBe('login_required');
  });
});
