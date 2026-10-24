import { createContext } from 'react';
import type { Locale, TranslationDictionary } from './types.js';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  dict: TranslationDictionary;
  t: (keyPath: string, fallback?: string) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);
