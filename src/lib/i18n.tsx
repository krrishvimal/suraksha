'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import enData from '@/i18n/en.json';
import hiData from '@/i18n/hi.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Language = 'en' | 'hi';
export type Locale = Language;

const en = enData as Record<string, string>;
const hi = hiData as Record<string, string>;

export interface LanguageContextValue {
  language: Language;
  locale: Locale;
  toggleLanguage: () => void;
  setLocale: (lang: Language) => void;
  t: (arg1: string, arg2?: string, arg3?: string) => string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'suraksha-lang' as const;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguage] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  // Hydrate language preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'hi' || stored === 'en') {
        setLanguage(stored);
      }
    } catch {
      // localStorage unavailable (SSR / private browsing) — keep default
    }
    setMounted(true);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => {
      const next: Language = prev === 'en' ? 'hi' : 'en';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Silently fail
      }
      return next;
    });
  }, []);

  const setLocale = useCallback((lang: Language) => {
    setLanguage(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Silently fail
    }
  }, []);

  /**
   * Flexible bilingual translation helper.
   * Supports:
   * 1. t(key, hi, en) -> e.g. t('delete', 'मिटाएं', 'Delete')
   * 2. t(en, hi) -> e.g. t('Your Personal Safety Tool', 'आपका व्यक्तिगत सुरक्षा उपकरण')
   * 3. t(key, 'English / हिन्दी') -> e.g. t('go_back', 'Go back / वापस जाएं')
   * 4. t(key) -> e.g. t('app_name')
   */
  const t = useCallback(
    (arg1: string, arg2?: string, arg3?: string): string => {
      // 3 arguments: t(key, hi, en)
      if (arg3 !== undefined && arg2 !== undefined) {
        return language === 'hi' ? arg2 : arg3;
      }

      // 2 arguments:
      if (arg2 !== undefined) {
        // Form: "English text / हिन्दी टेक्स्ट"
        if (arg2.includes(' / ')) {
          const parts = arg2.split(' / ');
          return language === 'hi' ? (parts[1]?.trim() || parts[0]?.trim()) : parts[0]?.trim();
        }

        // If arg1 is in JSON files:
        if (en[arg1]) {
          return language === 'hi' ? (hi[arg1] || arg2) : (en[arg1] || arg2);
        }

        // Default: arg1 is English, arg2 is Hindi
        return language === 'hi' ? arg2 : arg1;
      }

      // 1 argument: key lookup
      if (en[arg1]) {
        return language === 'hi' ? (hi[arg1] || en[arg1]) : en[arg1];
      }

      return arg1;
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        locale: language,
        toggleLanguage,
        setLocale,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error(
      'useLanguage must be used within a <LanguageProvider>. ' +
        'Wrap your component tree with <LanguageProvider> in layout.tsx.'
    );
  }
  return context;
}
