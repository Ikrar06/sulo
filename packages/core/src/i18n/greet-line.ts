// The greeting's first line by the local hour's slot (core dashboard/mobile-greeting.ts
// greetSlot), the phone's words. Its own small module so the extension's dashboard
// takes the same line without the phone's whole word list.

import type { GreetSlot } from '../dashboard/mobile-greeting';

export const GREET_LINE1: Record<'id' | 'en', Record<GreetSlot, string>> = {
  id: { pagi: 'Selamat pagi,', siang: 'Selamat siang,', sore: 'Selamat sore,', malam: 'Selamat malam,', tengahMalam: 'Selamat malam,' },
  en: { pagi: 'Good morning,', siang: 'Good afternoon,', sore: 'Good afternoon,', malam: 'Good evening,', tengahMalam: 'Good evening,' },
};
