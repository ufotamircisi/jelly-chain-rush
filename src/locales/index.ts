import type { LocaleCode } from '../types';
import en from './en';
import tr from './tr';

type TranslationTable = typeof en;
export type TranslationKey = keyof TranslationTable;

const fallbackLocales: Record<Exclude<LocaleCode, 'en' | 'tr'>, TranslationTable> = {
  es: en,
  pt: en,
  fr: en,
  de: en,
  it: en,
  id: en,
  vi: en,
  nl: en,
  pl: en
};

export const SUPPORTED_LOCALES: LocaleCode[] = ['en', 'tr', 'es', 'pt', 'fr', 'de', 'it', 'id', 'vi', 'nl', 'pl'];

export const translations: Record<LocaleCode, TranslationTable> = {
  en,
  tr,
  ...fallbackLocales
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
  return (key: TranslationKey): string => table[key] ?? translations.en[key];
}
