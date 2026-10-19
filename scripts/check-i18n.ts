import { de, en, es, fr, ja, locales, resolveLocale, t, zh } from '../src/i18n/index.js'

const catalogs: Record<string, Partial<Record<string, string>>> = { en, zh, es, fr, de, ja }
const referenceKeys = Object.keys(en).sort()
const errors: string[] = []

for (const locale of locales) {
  if (locale === 'en') {
    continue
  }

  const catalog = catalogs[locale]
  const keys = Object.keys(catalog).sort()
  const extra = keys.filter((key) => !referenceKeys.includes(key))

  if (extra.length > 0) {
    errors.push(`${locale}: extra keys: ${extra.join(', ')}`)
  }

  for (const key of keys) {
    const value = catalog[key]
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push(`${locale}: empty message for ${key}`)
      continue
    }

    const referencePlaceholders = new Set((en[key as keyof typeof en] ?? '').match(/\{\w+\}/g) ?? [])
    const placeholders = new Set(value.match(/\{\w+\}/g) ?? [])
    const missing = [...referencePlaceholders].filter((item) => !placeholders.has(item))
    const extraPlaceholders = [...placeholders].filter((item) => !referencePlaceholders.has(item))

    if (missing.length > 0 || extraPlaceholders.length > 0) {
      errors.push(
        `${locale}: placeholder mismatch for ${key} (missing: ${missing.join(', ') || 'none'}; extra: ${extraPlaceholders.join(', ') || 'none'})`,
      )
    }
  }
}

if (resolveLocale('es-MX') !== 'es' || resolveLocale('zh_CN') !== 'zh' || resolveLocale('xx-YY') !== 'en') {
  errors.push('locale resolution fallback is broken')
}

if (t('es', 'nav.home') !== 'Inicio') {
  errors.push('Spanish catalog lookup is broken')
}

if (t('de', 'search.apply') !== 'Anwenden') {
  errors.push('German catalog lookup is broken')
}

const missingCount = locales.reduce((count, locale) => {
  return count + referenceKeys.filter((key) => !(key in catalogs[locale])).length
}, 0)

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(
  `i18n catalogs OK (${referenceKeys.length} English messages across ${locales.length} locales, ${missingCount} fallback messages)`,
)
