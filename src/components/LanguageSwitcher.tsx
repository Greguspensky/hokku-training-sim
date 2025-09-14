'use client'

import { useRouter, usePathname } from '@/i18n/routing'
import { useLocale } from 'next-intl'
import { routing } from '@/i18n/routing'

const languageNames = {
  en: 'English',
  ru: 'Русский', 
  de: 'Deutsch',
  es: 'Español',
  ka: 'ქართული',
  fr: 'Français',
  it: 'Italiano'
} as const

export default function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()

  const switchLanguage = (newLocale: string) => {
    // The next-intl router handles the locale prefix automatically
    router.push(pathname, {locale: newLocale})
  }

  return (
    <div className="relative group">
      <button className="flex items-center space-x-2 px-3 py-2 text-sm text-slate-300 hover:text-white rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
        <span className="text-base">🌐</span>
        <span>{languageNames[locale as keyof typeof languageNames]}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="py-2">
          {routing.locales.map((lang) => (
            <button
              key={lang}
              onClick={() => switchLanguage(lang)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                locale === lang
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {languageNames[lang]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}