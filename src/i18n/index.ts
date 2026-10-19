import { en, type MessageKey } from './en.js'
import { zh } from './zh.js'
import { es } from './es.js'
import { fr } from './fr.js'
import { de } from './de.js'
import { ja } from './ja.js'

export const locales = ['en', 'zh', 'es', 'fr', 'de', 'ja'] as const

export type Locale = (typeof locales)[number]
export type { MessageKey }
export { en, zh, es, fr, de, ja }

export type LocaleOption = {
  code: Locale
  label: string
  intl: string
  flag: string
}

export const localeOptions: LocaleOption[] = [
  { code: 'en', label: 'English', intl: 'en-US', flag: '🇬🇧' },
  { code: 'zh', label: '中文', intl: 'zh-CN', flag: '🇨🇳' },
  { code: 'es', label: 'Español', intl: 'es-ES', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', intl: 'fr-FR', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', intl: 'de-DE', flag: '🇩🇪' },
  { code: 'ja', label: '日本語', intl: 'ja-JP', flag: '🇯🇵' },
]

const catalogs: Record<Locale, Partial<Record<MessageKey, string>>> = { en, zh, es, fr, de, ja }

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value)
}

export function resolveLocale(value: string | undefined): Locale {
  if (!value) {
    return 'en'
  }

  const base = value.trim().toLowerCase().replace('_', '-').split('-')[0]
  return isLocale(base) ? base : 'en'
}

export function localeLabel(locale: Locale): string {
  return localeOptions.find((option) => option.code === locale)?.label ?? 'English'
}

export function t(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const template = catalogs[locale][key] ?? catalogs.en[key] ?? key
  if (!params) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

function intlLocale(locale: Locale): string {
  return localeOptions.find((option) => option.code === locale)?.intl ?? 'en-US'
}

export function formatCompactNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatDate(value: string, locale: Locale): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}
