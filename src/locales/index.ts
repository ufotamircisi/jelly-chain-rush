import type { LocaleCode } from '../types';
import { de, es, fr, id, it, nl, pl, pt, vi } from './additionalLocales';
import en from './en';
import tr from './tr';

type TranslationTable = typeof en;
export type TranslationKey = keyof TranslationTable;

export const SUPPORTED_LOCALES: LocaleCode[] = ['en', 'tr', 'es', 'pt', 'fr', 'de', 'it', 'id', 'vi', 'nl', 'pl'];

export const LOCALE_NATIVE_NAMES: Record<LocaleCode, string> = {
  en: 'English',
  tr: 'Turkce',
  es: 'Espanol',
  pt: 'Portugues',
  fr: 'Francais',
  de: 'Deutsch',
  it: 'Italiano',
  id: 'Bahasa Indonesia',
  vi: 'Tieng Viet',
  nl: 'Nederlands',
  pl: 'Polski'
};

export const translations: Record<LocaleCode, TranslationTable> = {
  en,
  tr,
  es,
  pt,
  fr,
  de,
  it,
  id,
  vi,
  nl,
  pl
};

export function detectLocale(): LocaleCode {
  const stored = window.localStorage.getItem('jcr.language');
  if (stored && isLocaleCode(stored)) {
    return stored;
  }

  const browserCodes = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const browserCode of browserCodes) {
    const baseCode = browserCode.toLowerCase().split('-')[0];
    if (isLocaleCode(baseCode)) {
      return baseCode;
    }
  }

  return 'en';
}

export function isLocaleCode(value: string): value is LocaleCode {
  return SUPPORTED_LOCALES.includes(value as LocaleCode);
}

export function createTranslator(locale: LocaleCode) {
  const table = translations[locale] ?? translations.en;
  return (key: TranslationKey): string => table[key];
}
