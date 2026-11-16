// "Selamat pagi" by local hour: pagi 04–10, siang 11–14, sore 15–17,
// malam 18–03. Pure; the hour comes from the browser's time zone.
export type DayPart = 'pagi' | 'siang' | 'sore' | 'malam';

export function dayPart(localHour: number): DayPart {
  if (localHour >= 4 && localHour <= 10) return 'pagi';
  if (localHour >= 11 && localHour <= 14) return 'siang';
  if (localHour >= 15 && localHour <= 17) return 'sore';
  return 'malam';
}

/** "Selamat pagi, Ikrar" with a nickname, "Selamat pagi" without one (any language). */
export function greetingText(base: string, nickname: string): string {
  const name = nickname.trim();
  return name ? `${base}, ${name}` : base;
}
