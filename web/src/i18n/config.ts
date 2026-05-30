import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import es from './es.json'
import en from './en.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    // Cualquier idioma no-español → inglés. 'es' → español.
    fallbackLng: 'en',
    supportedLngs: ['es', 'en'],

    // Detección: 1) localStorage, 2) navegador, 3) fallback (en)
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'from-lang',
    },

    // Normalizar: si el navegador dice 'fr', 'de', 'zh', etc. → usar 'en'
    // Si dice 'es-MX', 'es-AR' etc. → 'es'
    load: 'languageOnly',

    interpolation: {
      escapeValue: false, // React ya escapa
    },
  })

export default i18n

// Cambia el idioma y lo persiste
export function setLanguage(lang: string) {
  i18n.changeLanguage(lang)
}

export const SUPPORTED_LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
]
