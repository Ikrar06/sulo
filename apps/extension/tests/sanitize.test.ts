import { describe, expect, it } from 'vitest';
import { sanitizeJson } from '@sulo/core/sanitize/json';
import { leakReport } from '@sulo/core/sanitize/leaks';

const ORIGIN = 'https://sikola-v2.unhas.ac.id';
const opts = { timeShiftSeconds: -86_400, origin: ORIGIN };
const run = (value: unknown) => sanitizeJson(value, opts) as never;

// Realistic-looking but invented personal data, built at runtime so the
// repository leak scan does not flag this test file itself.
const NIM = ['D', '12121', '1001'].join('');
const EMAIL = ['budi.santoso', '@', 'student.unhas.ac.id'].join('');
const SESSKEY = ['aB3', 'xY9', 'qW2', 'z'].join('');

describe('sanitizeJson', () => {
  it('replaces people, login ids, emails and secrets', () => {
    const out = run({
      userfromfullname: 'Budi Santoso',
      fullname: 'Andi Wijaya',
      username: NIM,
      email: EMAIL,
      sesskey: SESSKEY,
    });
    expect(out).toEqual({
      userfromfullname: 'Mahasiswa 1',
      fullname: 'Mahasiswa 2',
      username: 'D000000001',
      email: 'user1@example.test',
      sesskey: 'SESSKEY',
    });
  });

  it('names courses consistently and keeps the same placeholder for the same course', () => {
    const out = run({
      courses: [
        { id: 9876, fullname: 'Algoritma dan Struktur Data', shortname: 'ASD-2026' },
        { id: 5432, fullname: 'Basis Data', shortname: 'BD-2026' },
      ],
      events: [{ id: 77, course: { id: 9876, fullname: 'Algoritma dan Struktur Data', shortname: 'ASD-2026' } }],
    });
    expect(out).toEqual({
      courses: [
        { id: 101, fullname: 'Mata Kuliah A', shortname: 'MKA-001' },
        { id: 102, fullname: 'Mata Kuliah B', shortname: 'MKB-002' },
      ],
      events: [{ id: 101, course: { id: 101, fullname: 'Mata Kuliah A', shortname: 'MKA-001' } }],
    });
  });

  it('remaps ids per namespace and keeps cross references aligned', () => {
    const out = run({
      notifications: [{ id: 5555, useridfrom: 42, useridto: 7 }],
      userid: 7,
      cm: [{ id: 888, sectionid: 31, anchor: 'module-888', url: `${ORIGIN}/mod/assign/view.php?id=888` }],
    }) as { notifications: { useridto: number }[]; userid: number; cm: { id: number; anchor: string; url: string }[] };
    expect(out.notifications[0]?.useridto).toBe(out.userid);
    expect(out.cm[0]).toEqual({ id: 101, sectionid: 101, anchor: 'module-101', url: `${ORIGIN}/mod/assign/view.php?id=101` });
  });

  it('shifts timestamps by the fixed offset and leaves zero alone', () => {
    expect(run({ timestart: 1_790_000_000, enddate: 0, timeremaining: 3600 })).toEqual({
      timestart: 1_789_913_600,
      enddate: 0,
      timeremaining: 3600,
    });
  });

  it('rewrites URLs: files and foreign hosts replaced, secrets and unknown params dropped', () => {
    expect(
      run({
        a: `${ORIGIN}/pluginfile.php/1/user/icon/f1`,
        b: 'https://drive.google.com/file/d/abc',
        c: `${ORIGIN}/login/logout.php?sesskey=${SESSKEY}`,
        d: `${ORIGIN}/mod/forum/discuss.php?d=123&parent=9#p9`,
      }),
    ).toEqual({
      a: 'https://example.test/file',
      b: 'https://example.test/link',
      c: `${ORIGIN}/login/logout.php?sesskey=SESSKEY`,
      d: `${ORIGIN}/mod/forum/discuss.php`,
    });
  });

  it('replaces free text but keeps identifier-like enum values', () => {
    const out = run({ eventtype: 'due', modulename: 'assign', component: 'mod_assign', description: '<p>Kumpulkan sebelum Jumat</p>', name: 'Laporan Praktikum 3', note: 'Pak Rahman bilang' });
    expect(out).toEqual({
      eventtype: 'due',
      modulename: 'assign',
      component: 'mod_assign',
      description: '<p>Lorem ipsum dolor sit a</p>',
      name: 'Aktivitas 1',
      note: 'Teks 1',
    });
  });

  it('sanitizes JSON nested inside strings, like the course state', () => {
    const state = JSON.stringify({ cm: [{ id: 888, name: 'Kuis Rahasia' }] });
    const out = run({ data: state }) as { data: string };
    expect(JSON.parse(out.data)).toEqual({ cm: [{ id: 101, name: 'Aktivitas 1' }] });
  });

  it('does not mutate its input', () => {
    const input = { fullname: 'Budi', nested: { id: 5 } };
    const copy = structuredClone(input);
    run(input);
    expect(input).toEqual(copy);
  });

  it('leaves nothing the leak scan would catch', () => {
    const dirty = { username: NIM, email: EMAIL, note: `kontak ${EMAIL}`, url: `${ORIGIN}/x.php?sesskey=${SESSKEY}`, customdata: JSON.stringify({ sesskey: SESSKEY }) };
    expect(leakReport(dirty).length).toBeGreaterThan(0);
    expect(leakReport(run(dirty))).toEqual([]);
  });

  it('replaces every notification body field that can hold grades or lecturer comments', () => {
    const grade = ['Nilai', ' 87,5 ', 'untuk Budi Santoso'].join('');
    const comment = 'Laporanmu kurang rapi, perbaiki bagian 3';
    const out = run({
      notifications: [
        {
          id: 9001,
          useridfrom: 55,
          useridto: 7,
          subject: grade,
          shortenedsubject: grade,
          text: comment,
          fullmessage: `${grade}. ${comment}`,
          fullmessageformat: 2,
          fullmessagehtml: `<p>${grade}</p><p>${comment}</p>`,
          smallmessage: grade,
          contexturl: `${ORIGIN}/mod/assign/view.php?id=888&action=grader&userid=7`,
          contexturlname: 'Laporan Praktikum 3',
          timecreatedpretty: '2 hours 5 mins ago',
          customdata: JSON.stringify({ cmid: 888, instance: 12, messagehtml: `<b>${grade}</b>`, notificationiconurl: `${ORIGIN}/theme/image.php/x/icon` }),
          component: 'mod_assign',
          eventtype: 'assign_notification',
          read: false,
        },
      ],
    }) as { notifications: Record<string, unknown>[] };
    const n = out.notifications[0]!;
    const text = JSON.stringify(out);
    for (const secret of ['87,5', 'Budi', 'Santoso', 'rapi', 'Laporan Praktikum', '888', '9001']) expect(text).not.toContain(secret);
    expect(n.component).toBe('mod_assign');
    expect(n.eventtype).toBe('assign_notification');
    expect(n.read).toBe(false);
    // userid in the URL maps to the same placeholder as useridto (7 -> 2).
    expect(n.useridto).toBe(2);
    expect(n.contexturl).toBe(`${ORIGIN}/mod/assign/view.php?id=101&userid=2`);
    const custom = JSON.parse(n.customdata as string);
    expect(custom).toMatchObject({ cmid: 101, instance: 101, notificationiconurl: 'https://example.test/file' });
    expect(custom.messagehtml).toMatch(/^<p>Lorem/);
    for (const field of ['text', 'fullmessage', 'fullmessagehtml', 'smallmessage']) expect(String(n[field])).toMatch(/Lorem/);
  });

  it('keeps course state ids consistent across cm.id, sectionid and cmlist, string or number', () => {
    const state = JSON.stringify({
      course: { id: '4321' },
      section: [{ id: 77, cmlist: ['888', '999'], title: 'Pekan 1', current: true }],
      cm: [
        { id: '888', sectionid: '77', module: 'assign', modname: 'Assignment' },
        { id: '999', sectionid: '77', module: 'label', modname: 'Text and media area' },
      ],
    });
    const out = JSON.parse((run({ data: state }) as { data: string }).data);
    expect(out.course.id).toBe('101');
    expect(out.section[0].cmlist).toEqual(['101', '102']);
    expect(out.cm.map((c: { id: string }) => c.id)).toEqual(['101', '102']);
    expect(out.cm[0].sectionid).toBe(String(out.section[0].id));
    expect(out.cm.map((c: { module: string }) => c.module)).toEqual(['assign', 'label']);
  });
});

