import { describe, expect, it } from 'vitest';
import { NEOSIA_HOME, NEOSIA_LOGIN, neosiaUrl, SIKOLA_HOME, SIKOLA_LOGIN, sikolaUrl } from '../lib/links';

describe('"Buka SIKOLA" and "Buka NEOSIA"', () => {
  it('SIKOLA: the login page only for an expired session or no account yet', () => {
    expect(sikolaUrl('expired')).toBe(SIKOLA_LOGIN);
    expect(sikolaUrl('none')).toBe(SIKOLA_LOGIN);
    expect(sikolaUrl('connected')).toBe(SIKOLA_HOME);
    expect(sikolaUrl('mismatch')).toBe(SIKOLA_HOME);
    expect(SIKOLA_HOME).toBe('https://sikola-v2.unhas.ac.id/my/');
    expect(SIKOLA_LOGIN).toBe('https://sikola-v2.unhas.ac.id/login/index.php');
  });

  it("NEOSIA: always its home; Sulo never knows NEOSIA's login state", () => {
    expect(neosiaUrl()).toBe(NEOSIA_HOME);
    expect(NEOSIA_HOME).toBe('https://neosia.unhas.ac.id/');
    expect(neosiaUrl()).not.toBe(NEOSIA_LOGIN);
  });
});
