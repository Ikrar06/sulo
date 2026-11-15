import type { ParsedCourseName } from '../types';

// SIKOLA course fullnames follow, in upper case:
//   NAME [class letter] [(program)] [CODE]
// e.g. "MEKANIKA TANAH II C (TEKNIK SIPIL) [23D01234567]".
// The class letter is a single letter before the program/code. I, V and X are
// never taken as class letters, because they end Roman numerals
// ("STATISTIKA I [..]" has no class letter).

const FULL = /^(?<name>.+?)(?:\s+(?<cls>[A-HJ-UWYZ]))?(?:\s+\((?<program>[^()]+)\))?\s*\[(?<code>[0-9A-Z]{11})\]\s*$/;

export function parseCourseName(fullname: string): ParsedCourseName {
  const trimmed = fullname.trim();
  const match = FULL.exec(trimmed);
  const groups = match?.groups;
  if (!groups?.name || !groups.code) {
    return { name: trimmed, classLetter: null, program: null, code: null, matched: false };
  }
  return {
    name: groups.name.trim(),
    classLetter: groups.cls ?? null,
    program: groups.program?.trim() ?? null,
    code: groups.code,
    matched: true,
  };
}
