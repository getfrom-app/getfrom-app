import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import es from './es.json'
import en from './en.json'
import de from './de.json'
import fr from './fr.json'
import it from './it.json'
import pt from './pt.json'
import el from './el.json'
import nl from './nl.json'
import pl from './pl.json'
import ru from './ru.json'
import tr from './tr.json'
import sv from './sv.json'

// Idiomas soportados por la interfaz. El selector de Ajustes los lista todos.
export const SUPPORTED_LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'el', label: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'sv', label: 'Svenska', flag: '🇸🇪' },
]

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map(l => l.code)

// Normaliza cualquier idioma a uno soportado: 'es-MX'→'es', 'pt-BR'→'pt',
// 'el-GR'→'el'. Si el idioma no está traducido (p.ej. 'zh', 'ja') → inglés.
export function normalizeLang(lng?: string): string {
  if (!lng) return 'en'
  const base = lng.toLowerCase().split('-')[0]
  return SUPPORTED_CODES.includes(base) ? base : 'en'
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      de: { translation: de },
      fr: { translation: fr },
      it: { translation: it },
      pt: { translation: pt },
      el: { translation: el },
      nl: { translation: nl },
      pl: { translation: pl },
      ru: { translation: ru },
      tr: { translation: tr },
      sv: { translation: sv },
    },
    // Cualquier idioma no soportado → inglés (nunca español por defecto).
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_CODES,

    // Detección: 1) elección explícita en localStorage, 2) idioma del navegador.
    // NO cacheamos la detección automática: solo se persiste cuando el usuario
    // elige idioma a mano (setLanguage). Así una build vieja no deja a nadie
    // clavado en un idioma que nunca eligió. Clave 'fromly-lang' (la vieja
    // 'from-lang' queda invalidada a propósito).
    detection: {
      order: ['localStorage', 'navigator'],
      caches: [],
      lookupLocalStorage: 'fromly-lang',
      convertDetectedLanguage: normalizeLang,
    },

    load: 'languageOnly',

    interpolation: {
      escapeValue: false, // React ya escapa
    },
  })

export default i18n

// Cambia el idioma y lo persiste como elección EXPLÍCITA del usuario.
export function setLanguage(lang: string) {
  const normalized = normalizeLang(lang)
  try {
    localStorage.setItem('fromly-lang', normalized)
  } catch {
    // localStorage no disponible (modo privado, etc.) — no es fatal.
  }
  i18n.changeLanguage(normalized)
}
