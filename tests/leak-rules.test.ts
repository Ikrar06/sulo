import { describe, expect, it } from 'vitest';
import { findLeaks, ruleApplies } from '../scripts/leak-rules.mjs';

// Sample values are assembled at runtime so this file itself does not trip
// the repository scan.
const digits = (n: number, seed = '7351') => seed.repeat(Math.ceil(n / seed.length)).slice(0, n);
const NIK = digits(16);
const NIP = digits(18, '1985');
const LONG_KEY = ['Zq81', 'xT02', 'mN55', 'pL9w', 'Ab'].join('');

describe('NIK and NIP patterns', () => {
  it('flags 16- and 18-digit runs', () => {
    expect(findLeaks(`"nomor": "${NIK}"`)).toContain('Pola mirip NIK (16 digit)');
    expect(findLeaks(`nip ${NIP}`)).toContain('Pola mirip NIP (18 digit)');
  });

  it('does not double-report an 18-digit run as a NIK', () => {
    expect(findLeaks(`nip ${NIP}`)).not.toContain('Pola mirip NIK (16 digit)');
  });

  it('lets sanitized zero placeholders pass', () => {
    expect(findLeaks(`"nomor": "${'0'.repeat(13)}001"`)).toEqual([]);
    expect(findLeaks(`"nip": "${'0'.repeat(15)}001"`)).toEqual([]);
  });

  it('ignores shorter numbers and decimals', () => {
    expect(findLeaks('"timesort": 1790000000, "ms": 1790000000123, "x": 0.1234567890123456')).toEqual([]);
  });
});

describe('key-like URL parameters', () => {
  it.each(['key', 'token', 'signature', 'sig'])('flags %s= with a long value', (param) => {
    expect(findLeaks(`https://example.test/survey?id=1&${param}=${LONG_KEY}`)).toContain('Parameter mirip kunci di URL');
  });

  it('lets short values and SESSKEY placeholders pass', () => {
    expect(findLeaks('https://example.test/x?key=abc')).toEqual([]);
    expect(findLeaks('https://sikola-v2.unhas.ac.id/login/logout.php?sesskey=SESSKEY&key=SESSKEY')).toEqual([]);
  });
});

describe('sensitive NEOSIA field names', () => {
  const sample = '{ "nik": "x", "nisn": "x", "tanggal_lahir": "x", "alamat": "x" }';

  it('are flagged in fixtures and recorder output', () => {
    expect(findLeaks(sample, 'fixtures/recorded/x.json').filter((n) => n.includes('NEOSIA'))).toHaveLength(4);
    expect(findLeaks(sample).filter((n) => n.includes('NEOSIA'))).toHaveLength(4);
  });

  it('are allowed outside fixtures (docs and code may name them)', () => {
    expect(findLeaks(sample, 'lib/neosia/allowlist.ts')).toEqual([]);
    expect(ruleApplies({ onlyFixtures: true }, 'README.md')).toBe(false);
  });
});

describe('existing rules still hold', () => {
  it('lets the sanitized placeholders used across fixtures pass', () => {
    const clean = JSON.stringify({ username: 'D000000001', email: 'user1@example.test', sesskey: 'SESSKEY', url: 'https://sikola-v2.unhas.ac.id/x?sesskey=SESSKEY' });
    expect(findLeaks(clean)).toEqual([]);
  });
});

describe('Google Form links', () => {
  // Built from pieces, so this test file itself never matches the rule.
  const form = ['https://docs.google.com', 'forms', 'd', 'e', '1FAIpQLSexample'].join('/');
  it('fails on the editor link', () => {
    expect(findLeaks(`url: '${form.replace('/e/', '/')}/ed${'it'}'`, 'lib/links.ts')).toContain('Tautan edit Google Form');
    expect(findLeaks(`${form}/ed${'it'}#responses`, 'docs/x.md')).toContain('Tautan edit Google Form');
  });
  it('lets the public form link pass', () => {
    expect(findLeaks(`${form}/viewform?usp=sf_link`, 'lib/links.ts')).not.toContain('Tautan edit Google Form');
  });
});
