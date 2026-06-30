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

    // Detección: 1) elección explícita en localStorage, 2) idioma del navegador.
    // NO cacheamos la detección automática: solo se persiste cuando el usuario
    // elige idioma a mano (setLanguage). Así una build vieja no deja a un usuario
    // griego/alemán clavado en un idioma que nunca eligió.
    // Clave nueva ('fromly-lang') para invalidar de una vez los caches malos que
    // builds antiguas escribieron en 'from-lang' (p.ej. español por defecto).
    detection: {
      order: ['localStorage', 'navigator'],
      caches: [],
      lookupLocalStorage: 'fromly-lang',
      // Normalizar lo que detecte el navegador: solo español explícito → 'es';
      // cualquier otra cosa (griego, alemán, francés…) → 'en'.
      convertDetectedLanguage: (lng: string) =>
        lng?.toLowerCase().startsWith('es') ? 'es' : 'en',
    },

    // 'es-MX', 'es-AR' etc. → 'es'
    load: 'languageOnly',

    interpolation: {
      escapeValue: false, // React ya escapa
    },
  })

export default i18n

// Cambia el idioma y lo persiste como elección EXPLÍCITA del usuario.
// (El detector ya no auto-cachea, así que aquí escribimos la clave a mano.)
export function setLanguage(lang: string) {
  const normalized = lang?.toLowerCase().startsWith('es') ? 'es' : 'en'
  try {
    localStorage.setItem('fromly-lang', normalized)
  } catch {
    // localStorage no disponible (modo privado, etc.) — no es fatal.
  }
  i18n.changeLanguage(normalized)
}

export const SUPPORTED_LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
]
