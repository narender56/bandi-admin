export const locales = ['en', 'te', 'hi'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  te: 'తెలుగు',
  hi: 'हिन्दी',
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
