// The user guide's words by language (the two files are long; this is where they meet).
import type { Bahasa } from '../teks';
import { pakaiId, type KataPakai } from './pakai';
import { pakaiEn } from './pakai-en';

export const pakai: Record<Bahasa, KataPakai> = { id: pakaiId, en: pakaiEn };
