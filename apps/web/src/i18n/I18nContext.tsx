import React, { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import type { Locale, TranslationDictionary } from './types.js';
import { I18nContext, type I18nContextValue } from './context.js';
import { vi } from './locales/vi.js';
import { en } from './locales/en.js';

const STORAGE_KEY = 'crm_app_locale';

export interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'vi' || saved === 'en') return saved;
    } catch {
      // LocalStorage unavailable
    }
    return 'vi';
  });

  const dict = useMemo<TranslationDictionary>(() => {
    return locale === 'en' ? en : vi;
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
      document.documentElement.lang = newLocale;
    } catch {
      // Ignore
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next = prev === 'vi' ? 'en' : 'vi';
      try {
        localStorage.setItem(STORAGE_KEY, next);
        document.documentElement.lang = next;
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  /**
   * Helper hàm t('onboarding.step1.title', 'Fallback')
   */
  const t = useCallback((keyPath: string, fallback?: string): string => {
    const keys = keyPath.split('.');
    let current: unknown = dict;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = (current as Record<string, unknown>)[k];
      } else {
        return fallback || keyPath;
      }
    }

    if (typeof current === 'string') {
      return current;
    }

    return fallback || keyPath;
  }, [dict]);

  const contextValue = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    toggleLocale,
    dict,
    t,
  }), [locale, setLocale, toggleLocale, dict, t]);

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
};
