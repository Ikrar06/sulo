// Dashboard dictionaries; only dashboard code imports this.
import type { Locale } from '../index';
import { dashEn } from './en';
import { dashId, type DashMessages } from './id';

export type { DashMessages };
export function dashFor(locale: Locale): DashMessages {
  return locale === 'en' ? dashEn : dashId;
}
