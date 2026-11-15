// Data for turning upper-case course names into readable aliases.
// Keep this list short and add words only when they appear in real names.

/** Words that stay fully upper case. Roman numerals are handled separately. */
export const KEEP_UPPERCASE = new Set(['BMI', 'IPTEKS', 'TIK', 'K3', 'SIG', 'CAD', 'MKU', 'PKN', 'KKN']);

/** Indonesian conjunctions and prepositions, lower case unless they start the name. */
export const LOWERCASE_WORDS = new Set([
  'dan',
  'di',
  'ke',
  'dari',
  'untuk',
  'atau',
  'pada',
  'dengan',
  'yang',
  'dalam',
  'terhadap',
  'bagi',
  'serta',
]);

export const ROMAN_NUMERALS: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
};
