// Splits a sentence so that words with a hyphen ("Unhas-mu") can be kept whole
// (class "utuh"): a browser may otherwise break the line right after the hyphen.
export interface Potong {
  teks: string;
  utuh: boolean;
}

export function pecah(teks: string): Potong[] {
  return teks
    .split(/(\S*\p{L}-\p{L}\S*)/u)
    .filter((t) => t.length > 0)
    .map((t) => ({ teks: t, utuh: /\p{L}-\p{L}/u.test(t) }));
}
